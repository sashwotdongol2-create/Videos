"""Shared helpers: paths, logging, JSON I/O, ffprobe, status tracking."""
from __future__ import annotations

import json
import logging
import math
import os
import subprocess
import sys
import time
from pathlib import Path

import numpy as np

from .config import ROOT, SKILL, load_config  # noqa: F401

CFG = load_config()
HOME = CFG["home"]
# One workspace per channel: <home>/<handle>/{data,channel,report}; analyze.py sets CA_WS from --ch / the fetch URL.
WS = Path(os.environ.get("CA_WS") or HOME / "_unset")
DATA = WS / "data"
CHANNEL_DIR = WS / "channel"
REPORT = WS / "report"
MODELS = HOME / "_models"   # whisper weights, shared across channels


def sample_path(fmt: str | None = None) -> Path:
    """The workspace's sample file: sample_<fmt>.json, or the only/newest one when fmt is None."""
    if fmt:
        return CHANNEL_DIR / f"sample_{fmt}.json"
    found = sorted(CHANNEL_DIR.glob("sample_*.json"), key=lambda p: p.stat().st_mtime)
    if not found:
        raise SystemExit(f"No sample in {CHANNEL_DIR}: run `analyze.py fetch <channel_url>` first.")
    return found[-1]

# Bump a stage's version when its output format/logic changes: finished videos re-run that stage.
STAGE_VERSIONS = {
    "download": 1,
    "frames": 3,
    "shots": 3,
    "audio": 2,
    "script": 2,
    "ocr": 1,
}

log = logging.getLogger("ca")


def setup_logging(verbose: bool = False) -> None:
    logging.basicConfig(
        level=logging.DEBUG if verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
        datefmt="%H:%M:%S",
        stream=sys.stdout,
    )
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass


class NpEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, (np.integer,)):
            return int(o)
        if isinstance(o, (np.floating,)):
            f = float(o)
            return None if math.isnan(f) or math.isinf(f) else f
        if isinstance(o, np.ndarray):
            return o.tolist()
        if isinstance(o, np.bool_):
            return bool(o)
        if isinstance(o, Path):
            return str(o)
        return super().default(o)


def _clean(o):
    if isinstance(o, float) and (math.isnan(o) or math.isinf(o)):
        return None
    if isinstance(o, dict):
        return {k: _clean(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [_clean(v) for v in o]
    return o


def write_json(path: Path, obj) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(_clean(json.loads(json.dumps(obj, cls=NpEncoder))), indent=2, ensure_ascii=False), encoding="utf-8")
    os.replace(tmp, path)


def read_json(path: Path, default=None):
    path = Path(path)
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def run(cmd: list[str], check: bool = True, capture: bool = True, timeout: float | None = None) -> subprocess.CompletedProcess:
    log.debug("run: %s", " ".join(map(str, cmd)))
    return subprocess.run(
        [str(c) for c in cmd], check=check, capture_output=capture, text=True,
        encoding="utf-8", errors="replace", timeout=timeout,
    )


def ffprobe(path: Path) -> dict:
    """Stream metadata plus an exact video frame count (packet count) and per-frame timestamps."""
    out = run(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", path]).stdout
    info = json.loads(out)
    v = next(s for s in info["streams"] if s["codec_type"] == "video")
    a = next((s for s in info["streams"] if s["codec_type"] == "audio"), None)
    num, den = (int(x) for x in v.get("avg_frame_rate", "0/1").split("/"))
    rnum, rden = (int(x) for x in v.get("r_frame_rate", "0/1").split("/"))
    pts = frame_times(path)
    return {
        "fps": num / den if den else None,
        "r_frame_rate": rnum / rden if rden else None,
        "width": int(v["width"]),
        "height": int(v["height"]),
        "duration": float(info["format"].get("duration") or v.get("duration") or 0),
        "vcodec": v.get("codec_name"),
        "pix_fmt": v.get("pix_fmt"),
        "acodec": a.get("codec_name") if a else None,
        "audio_sample_rate": int(a["sample_rate"]) if a else None,
        "audio_channels": int(a["channels"]) if a else None,
        "n_frames": len(pts),
        "vfr": bool(len(pts) > 2 and np.std(np.diff(pts)) > 0.1 * np.median(np.diff(pts))),
        "size_bytes": int(info["format"].get("size") or 0),
    }


def frame_times(path: Path) -> np.ndarray:
    """Presentation timestamps of every video frame (sorted packet pts; no decode needed)."""
    out = run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "packet=pts_time",
               "-of", "csv=p=0", path]).stdout
    vals = []
    for line in out.splitlines():
        line = line.strip().strip(",")
        if line and line != "N/A":
            try:
                vals.append(float(line))
            except ValueError:
                pass
    t = np.sort(np.array(vals, dtype=np.float64))
    if len(t):
        t -= t[0]
    return t


class Status:
    """Per-video stage completion record (data/<id>/status.json)."""

    def __init__(self, vdir: Path):
        self.path = Path(vdir) / "status.json"
        self.d = read_json(self.path, {})

    def done(self, stage: str) -> bool:
        return self.d.get(stage, {}).get("version") == STAGE_VERSIONS[stage]

    def mark(self, stage: str, seconds: float, **extra) -> None:
        self.d[stage] = {"version": STAGE_VERSIONS[stage], "seconds": round(seconds, 1),
                         "at": time.strftime("%Y-%m-%dT%H:%M:%S"), **extra}
        write_json(self.path, self.d)


def rgb_hex(rgb) -> str:
    r, g, b = (int(round(float(c))) for c in rgb)
    return f"#{r:02x}{g:02x}{b:02x}"
