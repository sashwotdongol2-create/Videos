"""Shot / transition / camera-move statistics from <video>.frames.csv (analyze_motion.py).
Events
  HARD CUT   : one frame where the picture changes (1-hist > CUT_H and diff > CUT_D), neighbours calm
  SOFT TRANS : a 3-24 frame window whose summed picture change >= SOFT_SUM with no single cut frame; typed by the
               camera motion inside it: whip (fast pan/tilt), zoom (fast push/pull through), roll (spin), dissolve
               (no coherent motion: cross-fade / blur / flash)
Camera motion (inside shots, frames that are not part of an event)
  speed = |(tx,ty)| in % of frame per frame; static when speed < 0.04 and |zoom| < 4e-4 and |rot| < 0.03
  dominant axis per moving frame: pan / tilt / push / pull / roll
Output: per-video JSON lines + a channel summary table (stats.md)."""
import csv, json, math, statistics as st, sys
from collections import Counter, defaultdict
from pathlib import Path

CUT_H, CUT_D, SOFT_SUM = 0.35, 18.0, 0.9
R = Path(__file__).parent


def load(p):
    rows = list(csv.DictReader(open(p)))
    return [{k: float(v) for k, v in r.items()} for r in rows]


import cv2, numpy as np
_caps = {}
def frame(p, i):
    v = str(p).replace(".frames.csv", ".mp4")
    c = _caps.get(v) or cv2.VideoCapture(v); _caps[v] = c
    c.set(cv2.CAP_PROP_POS_FRAMES, i); ok, f = c.read()
    return cv2.resize(f, (180, 320)).astype(np.float32) if ok else None


def is_blend(p, a, b):
    """mid frame ~ average of the frames either side -> a cross-fade, not a camera move"""
    A, B, M = frame(p, max(0, a - 1)), frame(p, b), frame(p, (a + b) // 2)
    if A is None or B is None or M is None: return False
    eb = np.abs(M - (A + B) / 2).mean(); ea = np.abs(M - A).mean(); e2 = np.abs(M - B).mean()
    return eb < 0.6 * min(ea, e2)


def analyse(p):
    F = load(p); n = len(F); fps = 30.0
    ch = [1 - f["hist"] for f in F]
    cut = [i for i in range(1, n) if ch[i] > CUT_H and F[i]["diff"] > CUT_D]
    # merge cut frames closer than 3 frames
    cuts = []
    for i in cut:
        if not cuts or i - cuts[-1] > 3: cuts.append(i)
    busy = set()
    for c in cuts: busy.update(range(c - 1, c + 2))
    # soft transitions: windows of strong cumulative change without a hard cut
    soft = []; i = 1
    while i < n:
        if i in busy: i += 1; continue
        best = None
        for L in range(3, 25):
            j = i + L
            if j > n or any(k in busy for k in range(i, j)): break
            s = sum(ch[i:j])
            if s >= SOFT_SUM and max(ch[i:j]) <= CUT_H:
                best = (i, j); break
        if best and ch[i] > 0.02:
            a, b = best
            seg = F[a:b]
            sp = st.mean(math.hypot(f["tx"], f["ty"]) for f in seg)
            zm = st.mean(abs(f["zoom"]) for f in seg); ro = st.mean(abs(f["rot"]) for f in seg)
            inl = st.mean(f["inl"] for f in seg)
            kind = "whip" if sp > 2.5 else "zoom" if zm > 0.02 else "roll" if ro > 1.5 else "move"
            if kind != "whip" and is_blend(p, a, b): kind = "dissolve"
            soft.append(dict(a=a, b=b, dur=round((b - a) / fps, 3), kind=kind, speed=round(sp, 2)))
            busy.update(range(a, b)); i = b
        else:
            i += 1
    events = sorted([dict(a=c, b=c + 1, kind="cut", dur=0.0) for c in cuts] + soft, key=lambda e: e["a"])
    # shots = spans between events
    bounds = [0] + [e["a"] for e in events] + [n]
    shots = [(bounds[k], bounds[k + 1]) for k in range(len(bounds) - 1) if bounds[k + 1] - bounds[k] >= 6]
    shot_len = [(b - a) / fps for a, b in shots]
    # camera motion inside shots
    mv = Counter(); speeds = []; zooms = []; rots = []; still_runs = []; run = 0; moving_frames = 0; tot = 0
    for a, b in shots:
        for f in F[a + 1:b]:
            if f["inl"] < 0.5 or f["npts"] < 25: continue
            tot += 1
            sp = math.hypot(f["tx"], f["ty"]); z = f["zoom"]; r = f["rot"]
            if sp < 0.04 and abs(z) < 4e-4 and abs(r) < 0.03:
                mv["static"] += 1; run += 1; continue
            if run: still_runs.append(run / fps); run = 0
            moving_frames += 1; speeds.append(sp); zooms.append(z); rots.append(abs(r))
            # dominant component, scaled to comparable units (zoom 0.002/frame ~ pan 0.2 %/frame)
            comp = {"pan": abs(f["tx"]), "tilt": abs(f["ty"]), "push" if z > 0 else "pull": abs(z) * 100, "roll": abs(r) * 4}
            mv[max(comp, key=comp.get)] += 1
        if run: still_runs.append(run / fps); run = 0
    # does motion carry across hard cuts (the camera is moving on both sides)?
    carry = 0
    for c in cuts:
        pre = [math.hypot(f["tx"], f["ty"]) + abs(f["zoom"]) * 100 for f in F[max(0, c - 6):c - 1]]
        post = [math.hypot(f["tx"], f["ty"]) + abs(f["zoom"]) * 100 for f in F[c + 2:c + 7]]
        if pre and post and st.mean(pre) > 0.08 and st.mean(post) > 0.08: carry += 1
    dur = n / fps
    kinds = Counter(e["kind"] for e in events)
    out = dict(video=Path(p).stem.replace(".frames", ""), dur=round(dur, 1), events=len(events),
               events_per_min=round(len(events) / dur * 60, 1), shot_med=round(st.median(shot_len), 2) if shot_len else None,
               shot_mean=round(st.mean(shot_len), 2) if shot_len else None,
               pct_soft=round(100 * len(soft) / max(1, len(events)), 1),
               kinds={k: kinds[k] for k in ("cut", "move", "whip", "zoom", "roll", "dissolve")},
               soft_dur_med=round(st.median([s["dur"] for s in soft]), 2) if soft else None,
               pct_time_moving=round(100 * moving_frames / max(1, tot), 1),
               motion_mix={k: round(100 * mv[k] / max(1, moving_frames), 1) for k in ("pan", "tilt", "push", "pull", "roll")},
               speed_med=round(st.median(speeds), 3) if speeds else 0, speed_p90=round(sorted(speeds)[int(0.9 * len(speeds))], 3) if speeds else 0,
               push_med_per_s=round(st.median([z for z in zooms if z > 0] or [0]) * 30 * 100, 2),
               still_hold_med=round(st.median(still_runs), 2) if still_runs else 0,
               cuts_with_motion_both_sides_pct=round(100 * carry / max(1, len(cuts)), 1),
               first_event_s=round(events[0]["a"] / fps, 2) if events else None)
    return out, events


if __name__ == "__main__":
    res = []
    for p in sorted(R.glob("videos/*.frames.csv")):
        o, ev = analyse(p); res.append(o)
        json.dump(ev, open(p.with_name(p.name.replace(".frames.csv", ".events.json")), "w"))
    json.dump(res, open(R / "per_video.json", "w"), indent=1)
    for o in res: print(json.dumps(o))
