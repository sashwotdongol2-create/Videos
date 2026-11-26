"""Per-frame measurement at native frame rate: every decoded frame becomes one row in frames.parquet.

Camera motion between consecutive frames is measured in the frequency domain:
  * translation (pan / tilt / lateral drift): phase correlation of Hann-windowed grayscale frames
  * scale (dolly / zoom) and rotation: Fourier-Mellin, i.e. phase correlation of the log-polar
    resampled FFT magnitude spectra (translation-invariant, so it isolates zoom and roll)
"""
from __future__ import annotations

import cv2
import numpy as np
import pandas as pd

from .util import frame_times, log, read_json

CAM = 256          # camera-motion analysis size (frame squashed to CAM x CAM; uniform zoom stays uniform)
LP_W, LP_H = 256, 360  # log-polar spectrum: columns = log radius, rows = angle (1 row per degree)
STAT_W = 270       # width for colour statistics


def _highpass(shape):
    y = np.cos(np.pi * np.linspace(-0.5, 0.5, shape[0]))[:, None]
    x = np.cos(np.pi * np.linspace(-0.5, 0.5, shape[1]))[None, :]
    return ((1.0 - x * y) * (2.0 - x * y)).astype(np.float32)


_HANN = cv2.createHanningWindow((CAM, CAM), cv2.CV_32F)
_HP = _highpass((CAM, CAM))
_MAXR = CAM / 2.0
_LOGBASE = np.log(_MAXR) / LP_W


def _logpolar_spectrum(g: np.ndarray) -> np.ndarray:
    f = np.abs(np.fft.fftshift(np.fft.fft2(g * _HANN))).astype(np.float32) * _HP
    f = np.log1p(f)
    lp = cv2.warpPolar(f, (LP_W, LP_H), (CAM / 2.0, CAM / 2.0), _MAXR, cv2.WARP_POLAR_LOG + cv2.INTER_LINEAR)
    return lp.astype(np.float32)


_LP_WIN = cv2.createHanningWindow((LP_W, LP_H), cv2.CV_32F)


def camera_step(prev_g, cur_g, prev_lp, cur_lp):
    """Return dx, dy (fraction of frame per frame, +x = content moves right), scale ratio, rotation deg, response."""
    (dx, dy), resp = cv2.phaseCorrelate(prev_g, cur_g, _HANN)
    (sr, sa), resp_lp = cv2.phaseCorrelate(prev_lp, cur_lp, _LP_WIN)
    # content scaled up by s  ->  spectrum scaled by 1/s  ->  log-radius shift of -log(s)/_LOGBASE columns
    scale = float(np.exp(-sr * _LOGBASE))
    rot = float(-sa * 360.0 / LP_H)
    return dx / CAM, dy / CAM, scale, rot, resp, resp_lp


_YY, _XX = np.mgrid[0:CAM:2, 0:CAM:2].astype(np.float32)
_X = ((_XX - CAM / 2) / CAM).ravel()
_Y = ((_YY - CAM / 2) / CAM).ravel()
_A = np.zeros((2 * len(_X), 4), np.float32)
_A[0::2, 0], _A[0::2, 1], _A[0::2, 2] = _X, -_Y, 1
_A[1::2, 0], _A[1::2, 1], _A[1::2, 3] = _Y, _X, 1


def dense_similarity(prev_g, cur_g):
    """Dense optical flow (Farneback) -> robust weighted fit of a similarity transform.
    Works on smooth CGI where sparse features are scarce. Returns scale, dx, dy (fraction of frame), rot deg."""
    fl = cv2.calcOpticalFlowFarneback(prev_g.astype(np.uint8), cur_g.astype(np.uint8), None, 0.5, 4, 21, 4, 7, 1.5, 0)
    fl = fl[::2, ::2] / CAM
    gx = cv2.Sobel(prev_g, cv2.CV_32F, 1, 0)[::2, ::2]
    gy = cv2.Sobel(prev_g, cv2.CV_32F, 0, 1)[::2, ::2]
    w0 = np.sqrt(gx * gx + gy * gy).ravel()
    w0 = np.repeat((w0 / (w0.mean() + 1e-6)).clip(0, 5), 2)
    bb = fl.reshape(-1)
    ww = w0
    p = np.zeros(4, np.float32)
    for _ in range(4):  # IRLS with Huber weights: moving props / thread are outliers
        sw = np.sqrt(ww)
        p, *_ = np.linalg.lstsq(_A * sw[:, None], bb * sw, rcond=None)
        res = np.abs(_A @ p - bb)
        c = 1.345 * np.median(res) / 0.6745 + 1e-9
        ww = w0 * np.where(res < c, 1.0, c / np.maximum(res, 1e-12))
    return float(1 + p[0]), float(p[2]), float(p[3]), float(np.degrees(p[1]))


def run(vdir):
    meta = read_json(vdir / "meta.json")
    probe = meta["probe"]
    pts = frame_times(vdir / "video.mp4")
    cap = cv2.VideoCapture(str(vdir / "video.mp4"))
    if not cap.isOpened():
        raise RuntimeError("OpenCV cannot open video")
    rows = []
    prev_g = prev_lp = prev_small = prev_hist = None
    i = 0
    h0, w0 = probe["height"], probe["width"]
    sh = int(round(STAT_W * h0 / w0))
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        small = cv2.resize(frame, (STAT_W, sh), interpolation=cv2.INTER_AREA)
        hsv = cv2.cvtColor(small, cv2.COLOR_BGR2HSV)
        y = cv2.cvtColor(small, cv2.COLOR_BGR2YCrCb)[:, :, 0].astype(np.float32)
        g = cv2.resize(cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY), (CAM, CAM), interpolation=cv2.INTER_AREA).astype(np.float32)
        lp = _logpolar_spectrum(g)
        med = cv2.resize(frame, (540, int(540 * h0 / w0)), interpolation=cv2.INTER_AREA)
        sharp = float(cv2.Laplacian(cv2.cvtColor(med, cv2.COLOR_BGR2GRAY), cv2.CV_32F).var())
        hist = cv2.calcHist([hsv], [0, 1, 2], None, [16, 4, 4], [0, 180, 0, 256, 0, 256])
        cv2.normalize(hist, hist, 1.0, 0.0, cv2.NORM_L1)
        # dominant colour: mode of a 16-level-per-channel quantisation on a tiny frame
        tiny = cv2.resize(frame, (54, 96), interpolation=cv2.INTER_AREA).reshape(-1, 3)
        q = (tiny // 16).astype(np.int32)
        key = q[:, 0] * 256 + q[:, 1] * 16 + q[:, 2]
        bins = np.bincount(key, minlength=4096)
        k = int(bins.argmax())
        dom = tiny[key == k].mean(axis=0)  # BGR
        # border colour (outer 6% ring), where flat backgrounds show
        bh, bw = int(sh * 0.06), int(STAT_W * 0.06)
        ring = np.concatenate([small[:bh].reshape(-1, 3), small[-bh:].reshape(-1, 3),
                               small[:, :bw].reshape(-1, 3), small[:, -bw:].reshape(-1, 3)])
        border = ring.mean(axis=0)
        border_std = float(ring.std(axis=0).mean())
        r = {
            "i": i, "t": float(pts[i]) if i < len(pts) else np.nan,
            "luma_mean": float(y.mean()), "luma_p5": float(np.percentile(y, 5)), "luma_p95": float(np.percentile(y, 95)),
            "contrast": float(y.std()), "sat_mean": float(hsv[:, :, 1].mean()),
            "hue_mean": float(hsv[:, :, 0].mean()), "sharp": sharp,
            "dom_r": float(dom[2]), "dom_g": float(dom[1]), "dom_b": float(dom[0]), "dom_frac": float(bins[k] / len(key)),
            "bord_r": float(border[2]), "bord_g": float(border[1]), "bord_b": float(border[0]), "bord_std": border_std,
        }
        if prev_g is not None:
            dx, dy, sc, rot, resp, resp_lp = camera_step(prev_g, g, prev_lp, lp)
            ds_s, ds_dx, ds_dy, ds_rot = dense_similarity(prev_g, g)
            r.update(dx=dx, dy=dy, scale=sc, rot=rot, pc_resp=resp, lp_resp=resp_lp,
                     ds_scale=ds_s, ds_dx=ds_dx, ds_dy=ds_dy, ds_rot=ds_rot,
                     diff=float(np.abs(small.astype(np.int16) - prev_small.astype(np.int16)).mean()),
                     hist_d=float(cv2.compareHist(prev_hist, hist, cv2.HISTCMP_BHATTACHARYYA)))
        rows.append(r)
        prev_g, prev_lp, prev_small, prev_hist = g, lp, small, hist
        i += 1
        if i % 300 == 0:
            log.info("  frames %d / %d", i, probe["n_frames"])
    cap.release()
    df = pd.DataFrame(rows)
    df.to_parquet(vdir / "frames.parquet", index=False)
    if abs(len(df) - probe["n_frames"]) > 2:
        log.warning("decoded %d frames but container has %d", len(df), probe["n_frames"])
    return {"decoded": len(df), "container_frames": probe["n_frames"], "fps": probe["fps"]}
