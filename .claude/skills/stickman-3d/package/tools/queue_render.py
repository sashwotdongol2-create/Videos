"""Render + final for several projects, one after another, with a watchdog.

  python queue_render.py <project dir> [<project dir> ...] [--render-s 480] [--final-s 300] [--tries 3]

Why: on 2026-11-25 a queue of six 30 s films stood still for 35 minutes because the first render froze at frame 609
(headless Chrome at 0 % CPU; a render normally takes under 3 minutes) and a plain shell loop waits for ever. Here each
step has a time limit; when it passes, the step's whole process group is killed, stray headless browsers are cleaned
up, the GPU lock is cleared and the step runs again. Prints one line per step; the full output is in
<project>/out/logs/build.log. Ends with a contact sheet (2 fps, 96 frames = 48 s) in <project>/out/qa/cs/sheet.jpg.
"""
import argparse, json, os, shutil, signal, subprocess, sys, time
from pathlib import Path

PKG = Path(__file__).resolve().parents[1]
cfg = json.loads((PKG / "config.json").read_text()); py = cfg.get("python") or sys.executable
ap = argparse.ArgumentParser()
ap.add_argument("dirs", nargs="+"); ap.add_argument("--render-s", type=int, default=480)
ap.add_argument("--final-s", type=int, default=300); ap.add_argument("--tries", type=int, default=3)
a = ap.parse_args()

def clean():
    for pat in ("chrome-headless-shell", "remotion render", "remotion bundle"): subprocess.run(["pkill", "-f", pat])
    lock = Path(cfg.get("lock_dir", "")) / "blender.lock"
    if cfg.get("lock_dir") and lock.exists(): shutil.rmtree(lock, ignore_errors=True)

def step(d, what, limit, log):
    for k in range(a.tries):
        t = time.time()
        with open(log, "a") as f:
            p = subprocess.Popen([py, str(PKG / "stickman3d.py"), "-p", str(d), what], stdout=f, stderr=subprocess.STDOUT, start_new_session=True)
            try:
                rc = p.wait(timeout=limit)
            except subprocess.TimeoutExpired:
                os.killpg(p.pid, signal.SIGKILL); p.wait(); clean(); rc = "HUNG"
        print(f"  {what}: {rc} in {time.time() - t:.0f} s" + ("" if rc == 0 else f" (try {k + 1} of {a.tries})"), flush=True)
        if rc == 0: return True
        time.sleep(3)
    return False

bad = []
for d in map(Path, a.dirs):
    d = d.resolve(); print(f"=== {d.name} {time.strftime('%H:%M:%S')}", flush=True)
    log = d / "out" / "logs" / "build.log"; log.parent.mkdir(parents=True, exist_ok=True); log.write_text("")
    if not (step(d, "render", a.render_s, log) and step(d, "final", a.final_s, log)): bad.append(d.name); continue
    txt = log.read_text(errors="ignore")
    for l in txt.splitlines():
        if any(k in l for k in ("QA STAGE", "LENS BLOCKED", "not spoken", "unknown emote", "QA console clean", " I: ", "Peak:")): print("  " + l.strip()[:150], flush=True)
    (d / "out" / "qa" / "cs").mkdir(parents=True, exist_ok=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(d / "out" / "final.mp4"), "-vf", "fps=2,scale=180:-1,tile=12x8", "-frames:v", "1", str(d / "out" / "qa" / "cs" / "sheet.jpg")])
print("ALLDONE", "FAILED: " + ", ".join(bad) if bad else "all ok", flush=True)
