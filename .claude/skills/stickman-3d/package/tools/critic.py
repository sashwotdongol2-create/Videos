#!/usr/bin/env python3
"""Strict critic numbers for a stickman-3d render (adapted from blocky-shorts v1.2 tools/critic.py, MIT).

usage: python critic.py PROJECT_DIR VIDEO [--json out.json]

  TIMING  src/shots.gen.json still matches shots_plan.json + src/words.json (a re-voice without `timing`; WARN, since a
          cut moved by hand on purpose also differs)
  SYNC    every shot entered by a hard cut (src/edit.json "cuts" / kinds "cut") cuts on its planned frame (> 1 frame
          off = FAIL); push / whip entries are reported (their change spreads over several frames); dissolves skipped
  STATIC  the longest run of (almost) unchanged frames: >= 2.0 s FAIL, >= 1.0 s WARN (the camera never rests)
  EDGES   one-word captions (white fill + black stroke, final.mp4 only): the closest caption pixel to a side edge;
          < 6 % of the width FAIL
  SOUND   the audio streams of the video (none in public/film.mp4; the final has the mix)
A partial render (`render --frames A-B` writes from frame A) is checked from its first frame: pass --offset A.
Exit 1 when anything FAILs. Needs numpy and ffmpeg / ffprobe on PATH.
"""
import argparse, json, subprocess, sys
from pathlib import Path

import numpy as np

FPS = 30


def frames(path, w, h, gray=True):
    fmt = "gray" if gray else "rgb24"
    p = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-vf", f"scale={w}:{h}", "-f", "rawvideo", "-pix_fmt", fmt, "-"],
                       capture_output=True, check=True)
    a = np.frombuffer(p.stdout, np.uint8)
    return a.reshape(-1, h, w) if gray else a.reshape(-1, h, w, 3)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("project")
    ap.add_argument("video")
    ap.add_argument("--offset", type=int, default=0, help="global frame of the video's first frame (partial renders)")
    ap.add_argument("--json")
    a = ap.parse_args()
    P = Path(a.project)
    fails, warns, info = [], [], {}

    shots = json.loads((P / "src" / "shots.gen.json").read_text(encoding="utf-8"))
    edit = json.loads((P / "src" / "edit.json").read_text(encoding="utf-8")) if (P / "src" / "edit.json").exists() else {}
    kinds = {int(k): v for k, v in (edit.get("kinds") or {}).items()}
    for c in edit.get("cuts") or []:
        kinds.setdefault(int(c), "cut")

    # TIMING: the same formula as `stickman3d.py timing`
    try:
        W = json.loads((P / "src" / "words.json").read_text(encoding="utf-8"))
        plan = json.loads((P / "shots_plan.json").read_text(encoding="utf-8"))
        f = lambda i: 0 if i == 0 else round(W[i]["s"] * 30) - 3
        want = {s["id"]: f(s["w"]) for s in plan}
        stale = [(s["id"], s["a"], want.get(s["id"])) for s in shots if want.get(s["id"]) is not None and want[s["id"]] != s["a"]]
        print(f"TIMING  {len(shots)} shots; {len(stale)} start frame(s) differ from shots_plan.json + words.json")
        for sid, have, w in stale[:10]:
            warns.append(f"TIMING  shot {sid} starts at {have}, the words say {w}: run `timing` again (unless the cut was moved on purpose)")
    except (FileNotFoundError, IndexError, KeyError) as e:
        print(f"TIMING  skipped ({e})")

    g = frames(a.video, 135, 240).astype(np.float32)
    d = np.abs(np.diff(g, axis=0)).mean(axis=(1, 2))  # d[k] = change from frame k to k+1
    n = len(g)

    # SYNC
    checked, spread = [], []
    for s in shots[1:]:
        kind = kinds.get(s["id"], "dissolve")
        c = s["a"] - a.offset
        if kind == "dissolve" or c < 2 or c + 4 >= n:
            continue
        lo, hi = max(1, c - 4), min(len(d), c + 5)
        k = lo - 1 + int(np.argmax(d[lo - 1:hi])) + 1
        if kind == "cut":
            checked.append((s["id"], s["a"], k + a.offset))
            if abs(k - c) > 1:
                fails.append(f"SYNC    shot {s['id']} cuts at frame {k + a.offset}, planned {s['a']} ({k - c:+d})")
        else:
            spread.append(f"{s['id']}:{kind} peak {k - c:+d}")
    print(f"SYNC    {len(checked)} hard cut(s) checked" + (f"; push/whip peaks vs the planned frame: {', '.join(spread)}" if spread else ""))

    # STATIC
    still = d < 0.35
    run = best = best_at = 0
    for k, s_ in enumerate(still):
        run = run + 1 if s_ else 0
        if run > best:
            best, best_at = run, k - run + 1
    info["static_s"] = round(best / FPS, 2)
    print(f"STATIC  longest near-still run {best} frames = {best / FPS:.2f} s (from frame {best_at + a.offset})")
    if best / FPS >= 2.0:
        fails.append(f"STATIC  {best / FPS:.2f} s without movement from frame {best_at + a.offset}")
    elif best / FPS >= 1.0:
        warns.append(f"STATIC  a near-still run of {best / FPS:.2f} s from frame {best_at + a.offset}")

    # EDGES: caption pixels = white with the black stroke within 3 px (snow or a white wall alone does not count)
    c = frames(a.video, 270, 480, gray=False)[::5]
    band = c[:, int(0.62 * 480):int(0.80 * 480)].astype(np.int16)
    white = band.min(axis=3) > 240
    dark = band.max(axis=3) < 50
    near = np.zeros_like(dark)
    for sh in (-3, -2, -1, 1, 2, 3):
        near |= np.roll(dark, sh, axis=2)
    cap = white & near
    cols = cap.any(axis=1)  # frames x width
    rows = [r for r in cols if r.sum() >= 3]
    if rows:
        m = min(min(int(np.argmax(r)) for r in rows), min(269 - (len(r) - 1 - int(np.argmax(r[::-1]))) for r in rows)) / 270
        info["caption_edge"] = round(m, 3)
        print(f"EDGES   closest caption pixel to a side edge: {m * 100:.1f} % of the width")
        if m < 0.06:
            fails.append(f"EDGES   caption text {m * 100:.1f} % from the edge (< 6 %)")
    else:
        print("EDGES   no captions found (public/film.mp4 has none; check out/final.mp4)")

    # SOUND
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=index,codec_type,codec_name,duration", "-of", "csv=p=0", str(a.video)],
                       capture_output=True, text=True).stdout.strip().splitlines()
    aud = [x for x in r if "audio" in x]
    print(f"SOUND   {len(aud)} audio stream(s)" + (f": {'; '.join(aud)}" if aud else ""))

    for w in warns:
        print("WARN", w)
    for f_ in fails:
        print("FAIL", f_)
    print(f"{len(fails)} FAIL, {len(warns)} WARN")
    if a.json:
        Path(a.json).parent.mkdir(parents=True, exist_ok=True)
        Path(a.json).write_text(json.dumps({"fails": fails, "warns": warns, **info}, indent=1), encoding="utf-8")
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
