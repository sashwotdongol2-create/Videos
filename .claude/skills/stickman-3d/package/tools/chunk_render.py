# Chunked Film render with retries (D.B. Cooper film, 2026-11-21): a single 6-worker `S render` crashed at frame 1821
# of 2124 after 26 minutes, intermittently, losing the whole render. This renders 300-frame chunks (4 workers), retries
# a failed chunk up to 4 times, skips chunks already on disk (re-run to resume), then joins them.
# usage: python chunk_render.py <project> [scale=0.5] [--final]
#   writes out/film_draft.mp4 + public/film.mp4 (+ public/.film_draft mark unless --final), then run `S final [--draft]`.
#   Bundle first if the code changed: `npx remotion bundle src/index.ts --out-dir=build` (touch a src file so it rebuilds).
import json, shutil, subprocess, sys
from pathlib import Path

P = Path(sys.argv[1]).resolve()
SCALE = next((a for a in sys.argv[2:] if not a.startswith("--")), "0.5")
FINAL = "--final" in sys.argv
N = json.loads((P / "src" / "film.json").read_text())["frames"]; STEP = 300
d = P / "out" / "chunks"; d.mkdir(parents=True, exist_ok=True); parts = []
for a in range(0, N, STEP):
    b = min(N - 1, a + STEP - 1); o = d / f"c_{a:05d}.mp4"; parts.append(o)
    if o.exists() and o.stat().st_size > 1000: continue
    for k in range(4):
        r = subprocess.run(f'npx remotion render build Film "{o}" --gl=angle --timeout=240000 --scale={SCALE} --concurrency=4 '
                           f'--codec=h264 --crf=18 --muted --frames={a}-{b} --log=error',
                           cwd=P, shell=True, capture_output=True, text=True, encoding="utf-8", errors="replace")
        if r.returncode == 0 and o.exists(): print("chunk", a, b, "ok", flush=True); break
        print("chunk", a, b, "FAILED try", k, (r.stdout + r.stderr)[-600:], flush=True)
    else: sys.exit(f"chunk failed 4 times: {a}-{b}")
lst = d / "list.txt"; lst.write_text("".join(f"file '{x.as_posix()}'\n" for x in parts))
out = P / "out" / "film_draft.mp4"
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", str(out)], check=True)
shutil.copy(out, P / "public" / "film.mp4")
mark = P / "public" / ".film_draft"
if FINAL: mark.unlink(missing_ok=True)
else: mark.write_text("public/film.mp4 is the DRAFT picture")
print("done", out, "-> next: `S final" + ("" if FINAL else " --draft") + "`")
