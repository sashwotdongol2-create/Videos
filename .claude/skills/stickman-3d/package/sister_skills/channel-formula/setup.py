"""One-time install for the channel-formula skill.

  python setup.py                                  # venv in <skill>/.venv, workspaces in ~/channel-formula
  python setup.py --home D:/channels               # where channel workspaces (videos, data, reports) go
  python setup.py --venv D:/envs/cf                # put the (~3 GB) venv somewhere else, or reuse an existing one
  python setup.py --python C:/Python311/python.exe # a specific Python 3.11

Creates the venv (uv if available, else python -m venv), installs CPU torch 2.5.1 + requirements.txt, downloads the
EasyOCR models with curl (EasyOCR's own downloader times out), writes config.json, then runs `analyze.py doctor`.
Re-running is safe: finished steps are skipped.
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path

SKILL = Path(__file__).resolve().parent
TORCH = ["torch==2.5.1", "torchaudio==2.5.1"]
TORCH_INDEX = "https://download.pytorch.org/whl/cpu"
EASYOCR = {"english_g2": "https://github.com/JaidedAI/EasyOCR/releases/download/v1.3/english_g2.zip",
           "craft_mlt_25k": "https://github.com/JaidedAI/EasyOCR/releases/download/pre-v1.1.6/craft_mlt_25k.zip"}


def sh(cmd, **kw):
    print(">", " ".join(map(str, cmd)), flush=True)
    subprocess.run([str(c) for c in cmd], check=True, **kw)


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--home", default=None, help="workspaces root (default ~/channel-formula)")
    p.add_argument("--library", default=None, help="where approved formulas are published (default <home>/_library)")
    p.add_argument("--venv", default=None, help="venv dir (default <skill>/.venv); an existing venv is reused")
    p.add_argument("--python", default=None, help="Python 3.11 interpreter for a new venv")
    a = p.parse_args()

    old = json.loads((SKILL / "config.json").read_text()) if (SKILL / "config.json").exists() else {}
    home = Path(a.home or old.get("home") or Path.home() / "channel-formula").resolve()
    venv = Path(a.venv or old.get("venv") or SKILL / ".venv").resolve()
    home.mkdir(parents=True, exist_ok=True)
    library = Path(a.library or old.get("library") or home / "_library").resolve()
    library.mkdir(parents=True, exist_ok=True)
    (SKILL / "config.json").write_text(json.dumps({"home": str(home), "venv": str(venv), "library": str(library)}, indent=1))
    print(f"config.json: home={home} venv={venv} library={library}")

    py = venv / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
    uv = shutil.which("uv")
    if not py.exists():
        if uv:
            sh([uv, "venv", "--python", a.python or "3.11", venv])
        else:
            base = a.python or (shutil.which("python3.11") or ("py" if os.name == "nt" else "python3"))
            sh([base, *(["-3.11"] if base == "py" else []), "-m", "venv", venv])
    pip = [uv, "pip", "install", "--python", py] if uv else [py, "-m", "pip", "install"]
    try:
        subprocess.run([str(py), "-c", "import torch, cv2, demucs, faster_whisper, easyocr, yt_dlp"], check=True,
                       capture_output=True)
        print("packages already installed")
    except subprocess.CalledProcessError:
        sh(pip + TORCH + ["--index-url", TORCH_INDEX])
        sh(pip + ["-r", SKILL / "requirements.txt"])

    mdir = Path.home() / ".EasyOCR" / "model"
    mdir.mkdir(parents=True, exist_ok=True)
    for name, url in EASYOCR.items():
        if (mdir / f"{name}.pth").exists():
            continue
        z = mdir / f"{name}.zip"
        sh(["curl", "-L", "--retry", "3", "-o", z, url])
        zipfile.ZipFile(z).extractall(mdir)

    for tool in ("ffmpeg", "ffprobe"):
        if not shutil.which(tool):
            print(f"WARNING: {tool} not on PATH. Install ffmpeg (Windows: winget install Gyan.FFmpeg).")
    if not (shutil.which("node") or shutil.which("deno")):
        print("WARNING: no node/deno: yt-dlp needs one for YouTube's JS challenge. Install Node.js.")
    sh([py, SKILL / "tool" / "analyze.py", "doctor"], env=dict(os.environ, CF_IN_VENV="1"))


if __name__ == "__main__":
    sys.exit(main())
