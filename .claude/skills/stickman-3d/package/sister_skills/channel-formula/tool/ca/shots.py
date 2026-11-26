"""Shot boundaries and transition types, plus keyframes / contact sheet for visual review.

Boundary detection uses two signals from every frame:
  * spike  = one-frame Bhattacharyya histogram distance (hist_d). A hard cut is one big spike.
  * window = distance between frame i-W and i+W histograms. Motion transitions (whip pans,
             zoom-throughs, dissolves) change the picture over several frames, so they show
             up here even when no single frame jumps.
Each boundary is then classified from the camera-motion signal around it.
"""
from __future__ import annotations

import cv2
import numpy as np
import pandas as pd

from .util import log, read_json, write_json

W = 6               # half-window (frames) for the gradual-change score
HARD_SPIKE = 0.20   # one-frame histogram distance that counts as a cut candidate
HARD_RATIO = 3.0    # spike must stand this far above its neighbours
WIN_THRESH = 0.45   # windowed distance for a gradual / motion transition
WHIP_T = 0.04       # per-frame translation (fraction of frame) that counts as whip motion
ZOOM_T = 0.025      # per-frame |log scale| that counts as a zoom burst


def _hists(path):
    cap = cv2.VideoCapture(str(path))
    hs = []
    while True:
        ok, f = cap.read()
        if not ok:
            break
        sm = cv2.resize(f, (90, 160), interpolation=cv2.INTER_AREA)
        hsv = cv2.cvtColor(sm, cv2.COLOR_BGR2HSV)
        h = cv2.calcHist([hsv], [0, 1, 2], None, [16, 4, 4], [0, 180, 0, 256, 0, 256])
        cv2.normalize(h, h, 1.0, 0.0, cv2.NORM_L1)
        hs.append(h)
    cap.release()
    return hs


def _nms(idx, score, radius):
    keep = []
    for i in sorted(idx, key=lambda i: -score[i]):
        if all(abs(i - k) > radius for k in keep):
            keep.append(i)
    return sorted(keep)


def detect(df: pd.DataFrame, hists, fps: float):
    n = len(df)
    spike = df["hist_d"].fillna(0).to_numpy()
    win = np.zeros(n)
    for i in range(W, n - W):
        win[i] = cv2.compareHist(hists[i - W], hists[i + W], cv2.HISTCMP_BHATTACHARYYA)
    # camera motion magnitude per frame (feature-tracked, fallback phase correlation)
    tx = df["dx"].fillna(0).to_numpy()
    ty = df["dy"].fillna(0).to_numpy()
    ls = np.log(df["ds_scale"].fillna(1).clip(0.5, 2).to_numpy())
    trans = np.hypot(tx, ty)
    sharp = df["sharp"].to_numpy()

    def neigh(x, i, r=4):
        lo, hi = max(1, i - r), min(n, i + r + 1)
        v = np.concatenate([x[lo:i], x[i + 1:hi]])
        return float(np.median(v)) if len(v) else 0.0

    hard = [i for i in range(1, n) if spike[i] > HARD_SPIKE and spike[i] > HARD_RATIO * max(neigh(spike, i), 0.02)]
    grad = [i for i in range(W, n - W) if win[i] > WIN_THRESH and win[i] >= win[max(0, i - 3):i + 4].max()]
    cands = _nms(hard + grad, np.maximum(spike, win), int(round(fps * 0.4)))

    out = []
    for i in cands:
        lo, hi = max(1, i - W), min(n, i + W + 1)
        tmax = float(trans[lo:hi].max())
        zmax = float(np.abs(ls[lo:hi]).max())
        sh_drop = float(np.min(sharp[lo:hi]) / max(np.median(sharp[max(0, i - 3 * W):max(1, i - W)]) if i > W else sharp[0], 1e-6))
        is_spike = i in hard or spike[max(1, i - 1):i + 2].max() > HARD_SPIKE and spike[max(1, i - 1):i + 2].max() > HARD_RATIO * max(neigh(spike, i), 0.02)
        # motion just before / after the boundary, excluding the boundary frame itself (a cut fakes huge motion)
        around = np.r_[max(1, i - W):max(1, i - 1), min(n, i + 2):hi]
        t_ar = float(trans[around].max()) if len(around) else 0.0
        z_ar = float(np.abs(ls[around]).max()) if len(around) else 0.0
        if t_ar > WHIP_T or (sh_drop < 0.35 and t_ar > WHIP_T / 2):
            kind = "whip_pan"
        elif z_ar > ZOOM_T:
            kind = "zoom_through"
        elif is_spike:
            kind = "hard_cut"
        else:
            lm = df["luma_mean"].to_numpy()
            kind = "fade" if lm[lo:hi].min() < 20 or lm[lo:hi].max() > 235 else "dissolve_or_morph"
        out.append({"frame": int(i), "t": float(df["t"].iloc[i]), "kind": kind, "spike": float(spike[i]), "window": float(win[i]),
                    "motion_around": t_ar, "zoom_around": z_ar, "sharp_drop": sh_drop, "trans_max": tmax, "zoom_max": zmax})
    return out


def keyframes(vdir, df, bounds, fps):
    n = len(df)
    starts = [0] + [b["frame"] for b in bounds]
    ends = [b["frame"] for b in bounds] + [n]
    shots = []
    for k, (s, e) in enumerate(zip(starts, ends)):
        shots.append({"shot": k, "start": s, "end": e, "frames": e - s, "seconds": (e - s) / fps,
                      "key": min(s + max(1, (e - s) // 2), n - 1)})
    picks = set()
    for s in shots:
        picks.update({min(s["start"] + 2, n - 1), s["key"]})
    picks.update(int(round(t * fps)) for t in np.arange(0, 3, 0.5) if t * fps < n)
    picks.update(int(round(t * fps)) for t in np.arange(0, n / fps, 2.0))
    picks = sorted(p for p in picks if p < n)
    kdir = vdir / "keyframes"
    kdir.mkdir(exist_ok=True)
    cap = cv2.VideoCapture(str(vdir / "video.mp4"))
    thumbs, i, j = [], 0, 0
    while j < len(picks):
        ok, f = cap.read()
        if not ok:
            break
        if i == picks[j]:
            cv2.imwrite(str(kdir / f"{i:05d}.jpg"), cv2.resize(f, (360, int(360 * f.shape[0] / f.shape[1]))), [cv2.IMWRITE_JPEG_QUALITY, 85])
            th = cv2.resize(f, (135, int(135 * f.shape[0] / f.shape[1])), interpolation=cv2.INTER_AREA)
            cv2.putText(th, f"{i} {i / fps:.1f}s", (3, 14), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (0, 0, 0), 3)
            cv2.putText(th, f"{i} {i / fps:.1f}s", (3, 14), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (255, 255, 255), 1)
            thumbs.append(th)
            j += 1
        i += 1
    cap.release()
    if thumbs:
        cols = 10
        h, w = thumbs[0].shape[:2]
        rows = (len(thumbs) + cols - 1) // cols
        sheet = np.zeros((rows * h, cols * w, 3), np.uint8)
        for k, th in enumerate(thumbs):
            th = cv2.resize(th, (w, h))
            sheet[(k // cols) * h:(k // cols + 1) * h, (k % cols) * w:(k % cols + 1) * w] = th
        cv2.imwrite(str(vdir / "contact_sheet.jpg"), sheet, [cv2.IMWRITE_JPEG_QUALITY, 80])
    return shots, picks


def strip_sheet(vdir, bounds, half=4):
    """One row per candidate boundary: frames i-4 .. i+4, for visual labelling."""
    if not bounds:
        return
    want = {b["frame"] + k for b in bounds for k in range(-half, half + 1)}
    cap = cv2.VideoCapture(str(vdir / "video.mp4"))
    fr, i = {}, 0
    last = max(want)
    while i <= last:
        ok, x = cap.read()
        if not ok:
            break
        if i in want:
            fr[i] = cv2.resize(x, (108, 192), interpolation=cv2.INTER_AREA)
        i += 1
    cap.release()
    blank = np.zeros((192, 108, 3), np.uint8)
    rows = []
    for n, b in enumerate(bounds):
        row = np.hstack([fr.get(b["frame"] + k, blank) for k in range(-half, half + 1)])
        lab = f"#{n} f{b['frame']} {b['t']:.1f}s"
        cv2.putText(row, lab, (3, 16), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 3)
        cv2.putText(row, lab, (3, 16), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 1)
        rows.append(row)
    cv2.imwrite(str(vdir / "bounds_sheet.jpg"), np.vstack(rows), [cv2.IMWRITE_JPEG_QUALITY, 80])


def run(vdir):
    meta = read_json(vdir / "meta.json")
    fps = meta["probe"]["fps"]
    df = pd.read_parquet(vdir / "frames.parquet")
    hists = _hists(vdir / "video.mp4")
    m = min(len(hists), len(df))
    df, hists = df.iloc[:m].reset_index(drop=True), hists[:m]
    bounds = detect(df, hists, fps)
    shots, picks = keyframes(vdir, df, bounds, fps)
    strip_sheet(vdir, bounds)
    kinds = pd.Series([b["kind"] for b in bounds]).value_counts().to_dict() if bounds else {}
    write_json(vdir / "shots.json", {"fps": fps, "boundaries": bounds, "shots": shots, "keyframes": picks, "kinds": kinds})
    log.info("  %d shots, transitions %s", len(shots), kinds)
    return {"shots": len(shots)}
