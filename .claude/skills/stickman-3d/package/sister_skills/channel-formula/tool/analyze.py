"""channel-formula CLI: measure a YouTube channel's videos frame by frame and turn the numbers into its formula.

One workspace per channel: <home>/<handle>/ with data/ (one folder per video), channel/ (listing, sample), report/.
<home> and the venv come from <skill>/config.json (written by setup.py); CF_HOME / CF_VENV override them.

  python analyze.py doctor                                   # check venv, ffmpeg, node, models, config
  python analyze.py fetch <channel_url> [--fmt shorts|videos] [--hits 20 --recent 6 --control 8]
  python analyze.py --ch <handle> analyze --workers 4        # frames, shots, audio, script, ocr (resumable)
  python analyze.py --ch <handle> status                     # stages finished per video (+ vision labels)
  python analyze.py --ch <handle> vision-todo                # videos still needing vision.json (Claude labelling)
  python analyze.py --ch <handle> report                     # features.csv, stats.csv, categorical.json, charts, formula.json
  python analyze.py --ch <handle> formula                    # report/FORMULA_draft.md with every number filled in
  python analyze.py --ch <handle> publish                    # after approval: FORMULA.md + rules.json -> the library
  python analyze.py --ch <handle> clean [--yes]              # after publish: delete the whole workspace (dry run first)
  python analyze.py --ch <handle> compare <my_video.mp4>     # my video vs the library formula -> <video dir>/_compare/.../delta.md

`fetch` derives <handle> from the URL (@name). Any Python can launch this file: it re-runs itself inside the venv.
"""
from __future__ import annotations

import argparse
import os
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))
from ca.config import load_config  # noqa: E402  (stdlib only: safe before switching into the venv)

CFG = load_config()
VENV_PY = CFG["venv"] / ("Scripts/python.exe" if os.name == "nt" else "bin/python")


def _ensure_venv() -> None:
    """Re-run this command with the venv's Python (it has torch, opencv, yt-dlp ...)."""
    if Path(sys.executable).resolve() == VENV_PY.resolve() or os.environ.get("CF_IN_VENV"):
        return
    if not VENV_PY.exists():
        if len(sys.argv) > 1 and sys.argv[1] == "doctor":
            return
        sys.exit(f"No venv at {CFG['venv']}. Run: python {ROOT.parent / 'setup.py'}")
    env = dict(os.environ, CF_IN_VENV="1")
    sys.exit(subprocess.call([str(VENV_PY), str(Path(__file__).resolve()), *sys.argv[1:]], env=env))


def handle_from_url(url: str) -> str:
    m = re.search(r"youtube\.com/(@[^/?#]+|c/[^/?#]+|channel/[^/?#]+|user/[^/?#]+)", url)
    h = re.sub(r"[^\w.-]", "_", (m.group(1) if m else url).split("/")[-1].lstrip("@")).lower()
    if not re.fullmatch(r"[a-z0-9_][\w.-]*", h) or h.strip(".") == "":   # "", ".", ".." would point at <home> or above
        sys.exit(f"Not a channel handle: {url!r}")
    return h


def _pick_workspace(argv: list[str]) -> None:
    """Set CA_WS before ca.util's workspace paths are used."""
    ch = None
    if "--ch" in argv:
        ch = argv[argv.index("--ch") + 1]
    elif len(argv) > 2 and argv[1] == "fetch":
        ch = handle_from_url(argv[2])
    if ch:
        os.environ["CA_WS"] = str(CFG["home"] / handle_from_url(ch))   # created by fetch's writes, never by a lookup
    elif len(argv) > 1 and argv[1] not in ("doctor", "-h", "--help"):
        sys.exit("Pass --ch <handle> (the channel's workspace under %s), or start with `fetch <channel_url>`." % CFG["home"])


_ensure_venv()
os.environ["PATH"] = str(VENV_PY.parent) + os.pathsep + os.environ["PATH"]   # the venv's yt-dlp first
_pick_workspace(sys.argv)
from ca.util import DATA, WS, Status, log, read_json, sample_path, setup_logging  # noqa: E402

STAGES = ["frames", "shots", "audio", "script", "ocr"]


def cmd_doctor(a):
    ok = True
    def line(good, what, fix=""):
        nonlocal ok
        ok &= bool(good)
        print(("  OK   " if good else "  MISS ") + what + ("" if good else f"   -> {fix}"))
    print(f"skill  {ROOT.parent}\nhome   {CFG['home']}\nvenv   {CFG['venv']}")
    line(VENV_PY.exists(), "venv python", f"python {ROOT.parent / 'setup.py'}")
    line(shutil.which("ffmpeg") and shutil.which("ffprobe"), "ffmpeg + ffprobe on PATH", "install ffmpeg")
    line(shutil.which("node") or shutil.which("deno"), "node or deno (yt-dlp's YouTube JS solver)", "install Node.js")
    line((VENV_PY.parent / ("yt-dlp.exe" if os.name == "nt" else "yt-dlp")).exists(), "yt-dlp in the venv", "re-run setup.py")
    eo = Path.home() / ".EasyOCR" / "model"
    line((eo / "english_g2.pth").exists() and (eo / "craft_mlt_25k.pth").exists(), "EasyOCR models", "re-run setup.py")
    if VENV_PY.exists() and Path(sys.executable).resolve() == VENV_PY.resolve():
        for mod in ("cv2", "torch", "demucs", "faster_whisper", "easyocr", "librosa", "scenedetect", "pandas"):
            try:
                __import__(mod)
                line(True, f"import {mod}")
            except Exception as ex:  # noqa: BLE001
                line(False, f"import {mod} ({ex.__class__.__name__})", "re-run setup.py")
    print("ready" if ok else "not ready")


def cmd_fetch(a):
    from ca import fetch
    if a.list:   # full listing only: channel/listing_<fmt>.json + a tab-separated titles file for topic picking
        rows = [e for e in fetch.listing(a.channel, a.fmt, a.refresh) if e.get("view_count")]
        out = WS / "channel" / f"titles_{a.fmt}.tsv"
        out.write_text("\n".join(f"{e['id']}\t{e['view_count']}\t{e.get('title') or ''}" for e in rows), encoding="utf-8")
        log.info("Listing: %d videos -> %s", len(rows), out)
        return
    keep = set(Path(a.keep).read_text(encoding="utf-8").split()) if a.keep else None
    vids = fetch.select_sample(a.channel, a.fmt, n_hits=a.hits, n_recent=a.recent, n_ctrl=a.control, refresh=a.refresh,
                               min_age_days=a.min_age, keep=keep)
    log.info("Workspace %s. Sample: %d videos", WS, len(vids))
    for v in vids:
        log.info("  %-8s %-12s %12s views  %s", v["group"], v["id"], f"{v['views']:,}", v["title"])
    if a.no_download:
        return
    for i, v in enumerate(vids, 1):
        log.info("download %d/%d", i, len(vids))
        try:
            fetch.download(v)
        except Exception as ex:  # noqa: BLE001
            log.error("[%s] download failed: %s", v["id"], ex)


def analyze_dir(vdir: Path, stages=STAGES, force=False):
    from ca import frames, shots, audio, script, ocr
    mods = {"frames": frames, "shots": shots, "audio": audio, "script": script, "ocr": ocr}
    st = Status(vdir)
    for s in stages:
        if st.done(s) and not force:
            continue
        t0 = time.time()
        log.info("[%s] %s ...", vdir.name, s)
        extra = mods[s].run(vdir) or {}
        st.mark(s, time.time() - t0, **extra)
        log.info("[%s] %s done in %.0fs", vdir.name, s, time.time() - t0)


def _sample_ids(fmt=None):
    return [v["id"] for v in read_json(sample_path(fmt))["videos"]]


def cmd_analyze(a):
    ids = a.only or _sample_ids(a.fmt)
    if a.ids_file:  # IDs may start with "-", which argparse can't take on the command line
        ids = Path(a.ids_file).read_text().split()
    stages = a.stages.split(",") if a.stages else STAGES
    if a.workers > 1:
        return _spawn_workers(a, ids, stages)
    for i, vid in enumerate(ids, 1):
        vdir = DATA / vid
        if not (vdir / "video.mp4").exists():
            log.warning("[%s] not downloaded, skipping", vid)
            continue
        log.info("=== %d/%d %s", i, len(ids), vid)
        try:
            analyze_dir(vdir, stages, a.force)
        except Exception:  # noqa: BLE001
            log.exception("[%s] analysis failed", vid)


def _spawn_workers(a, ids, stages):
    """N child processes, round-robin over the ids, each capped to cpu/N threads (uncapped workers grind to a halt)."""
    n = min(a.workers, len(ids))
    threads = str(max(1, (os.cpu_count() or 4) // n))
    env = dict(os.environ, OMP_NUM_THREADS=threads, MKL_NUM_THREADS=threads, OPENBLAS_NUM_THREADS=threads)
    procs = []
    for k in range(n):
        part = ids[k::n]
        idf = WS / f"_ids_w{k}.txt"
        idf.write_text("\n".join(part))
        logf = open(WS / f"analyze_w{k}.log", "w", encoding="utf-8")
        cmd = [sys.executable, str(ROOT / "analyze.py"), "--ch", WS.name, "analyze", "--ids-file", str(idf),
               "--stages", ",".join(stages)] + (["--force"] if a.force else [])
        procs.append(subprocess.Popen(cmd, env=env, stdout=logf, stderr=subprocess.STDOUT, cwd=ROOT))
        log.info("worker %d: %d videos, %s threads, log %s", k, len(part), threads, logf.name)
    codes = [p.wait() for p in procs]
    log.info("workers done, exit codes %s", codes)
    cmd_status(a)


def cmd_status(a):
    ids = _sample_ids(getattr(a, "fmt", None))
    stages = ["download"] + STAGES
    done = {s: 0 for s in stages + ["vision"]}
    for vid in ids:
        st = Status(DATA / vid)
        for s in stages:
            done[s] += int(st.done(s))
        done["vision"] += int((DATA / vid / "vision.json").exists())
    print(f"{WS}  ({len(ids)} videos in the sample)")
    print("  " + "  ".join(f"{s} {done[s]}/{len(ids)}" for s in stages + ["vision"]))


def cmd_vision_todo(a):
    todo = [vid for vid in _sample_ids(a.fmt)
            if Status(DATA / vid).done("shots") and not (DATA / vid / "vision.json").exists()]
    print(f"{len(todo)} videos need vision.json (instructions: {ROOT.parent / 'references' / 'VISION_REVIEW.md'})")
    for vid in todo:
        print(DATA / vid)


def cmd_report(a):
    from ca import report
    report.build(a.fmt)


def cmd_formula(a):
    from ca import formula
    out = formula.draft(a.fmt)
    print(f"wrote {out}")


def cmd_publish(a):
    from ca import library
    print(f"published to {library.publish(a.fmt, a.allow_draft)}")


def cmd_clean(a):
    from ca import library
    library.clean(a.yes)


def cmd_compare(a):
    from ca import fetch, report
    vdir = fetch.prepare_local(Path(a.video), a.name)
    analyze_dir(vdir)
    report.compare(vdir)


def main():
    setup_logging()
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--ch", help="channel handle (workspace <home>/<handle>)")
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("doctor").set_defaults(fn=cmd_doctor)
    f = sub.add_parser("fetch"); f.add_argument("channel"); f.add_argument("--fmt", default="shorts")
    f.add_argument("--hits", type=int, default=20); f.add_argument("--recent", type=int, default=6)
    f.add_argument("--control", type=int, default=8); f.add_argument("--min-age", type=int, default=30)
    f.add_argument("--refresh", action="store_true")
    f.add_argument("--no-download", action="store_true")
    f.add_argument("--list", action="store_true", help="only write the full listing (channel/titles_<fmt>.tsv)")
    f.add_argument("--keep", help="file of video IDs to sample from (topic subset, e.g. history videos)")
    f.set_defaults(fn=cmd_fetch)
    an = sub.add_parser("analyze"); an.add_argument("--only", nargs="*"); an.add_argument("--stages"); an.add_argument("--ids-file")
    an.add_argument("--workers", type=int, default=1); an.add_argument("--fmt")
    an.add_argument("--force", action="store_true"); an.set_defaults(fn=cmd_analyze)
    for name, fn in (("status", cmd_status), ("vision-todo", cmd_vision_todo), ("report", cmd_report), ("formula", cmd_formula)):
        s = sub.add_parser(name); s.add_argument("--fmt"); s.set_defaults(fn=fn)
    pb = sub.add_parser("publish"); pb.add_argument("--fmt"); pb.add_argument("--allow-draft", action="store_true")
    pb.set_defaults(fn=cmd_publish)
    cl = sub.add_parser("clean"); cl.add_argument("--yes", action="store_true"); cl.set_defaults(fn=cmd_clean)
    c = sub.add_parser("compare"); c.add_argument("video"); c.add_argument("--name"); c.set_defaults(fn=cmd_compare)
    a = p.parse_args()
    a.fn(a)


if __name__ == "__main__":
    main()
