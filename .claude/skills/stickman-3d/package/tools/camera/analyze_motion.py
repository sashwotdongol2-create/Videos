"""Frame-by-frame camera motion + transition measurement for stickman Shorts.
Per frame t (vs t-1), on a 180x320 grayscale copy:
  hist   : HSV histogram correlation (1 = same picture)
  diff   : mean abs pixel change (0-255)
  tx, ty : global translation in % of frame width / height per frame (RANSAC similarity fit on tracked corners)
  zoom   : scale change per frame (log, >0 = pushing in)
  rot    : roll change per frame (degrees)
  inl    : inlier ratio of the fit (how coherent the motion is: low = new picture / cross-fade / chaos)
Writes <name>.frames.csv; events/shot statistics are computed in stats.py."""
import csv, math, sys
from pathlib import Path
import cv2, numpy as np

W, H = 180, 320


def run(path: Path):
    cap = cv2.VideoCapture(str(path)); fps = cap.get(cv2.CAP_PROP_FPS) or 30
    out = path.with_suffix(".frames.csv")
    prev = prevh = None; rows = []; i = 0
    while True:
        ok, fr = cap.read()
        if not ok: break
        sm = cv2.resize(fr, (W, H), interpolation=cv2.INTER_AREA)
        g = cv2.cvtColor(sm, cv2.COLOR_BGR2GRAY)
        hsv = cv2.cvtColor(sm, cv2.COLOR_BGR2HSV)
        h = cv2.calcHist([hsv], [0, 1], None, [24, 16], [0, 180, 0, 256]); cv2.normalize(h, h)
        r = dict(f=i, t=round(i / fps, 4), hist=1.0, diff=0.0, tx=0.0, ty=0.0, zoom=0.0, rot=0.0, inl=1.0, npts=0)
        if prev is not None:
            r["hist"] = round(float(cv2.compareHist(prevh, h, cv2.HISTCMP_CORREL)), 4)
            r["diff"] = round(float(np.mean(cv2.absdiff(prev, g))), 3)
            p0 = cv2.goodFeaturesToTrack(prev, 300, 0.01, 6)
            if p0 is not None and len(p0) >= 12:
                p1, st, _ = cv2.calcOpticalFlowPyrLK(prev, g, p0, None, winSize=(21, 21), maxLevel=3)
                k = st.ravel() == 1
                a, b = p0[k].reshape(-1, 2), p1[k].reshape(-1, 2)
                r["npts"] = int(len(a))
                if len(a) >= 10:
                    M, inl = cv2.estimateAffinePartial2D(a, b, method=cv2.RANSAC, ransacReprojThreshold=1.5)
                    if M is not None:
                        s = math.hypot(M[0, 0], M[1, 0])
                        # translation of the frame centre (removes the zoom-induced shift)
                        cx, cy = W / 2, H / 2
                        nx = M[0, 0] * cx + M[0, 1] * cy + M[0, 2]; ny = M[1, 0] * cx + M[1, 1] * cy + M[1, 2]
                        r.update(tx=round((nx - cx) / W * 100, 3), ty=round((ny - cy) / H * 100, 3),
                                 zoom=round(math.log(s), 5), rot=round(math.degrees(math.atan2(M[1, 0], M[0, 0])), 3),
                                 inl=round(float(inl.mean()), 3))
                else:
                    r["inl"] = 0.0
            else:
                r["inl"] = 0.0
        rows.append(r); prev, prevh = g, h; i += 1
    with open(out, "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=list(rows[0].keys())); w.writeheader(); w.writerows(rows)
    print(path.name, i, "frames", round(i / fps, 1), "s", flush=True)


if __name__ == "__main__":
    for p in sys.argv[1:]:
        if not Path(p).with_suffix(".frames.csv").exists(): run(Path(p))
