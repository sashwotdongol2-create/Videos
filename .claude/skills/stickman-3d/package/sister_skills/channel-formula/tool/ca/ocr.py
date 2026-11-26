"""On-screen text (burned-in captions, labels) with EasyOCR at 3 fps: words per caption, size, position, colour."""
from __future__ import annotations

import cv2
import numpy as np

from .util import log, read_json, write_json

_READER = None
STEP_S = 1.0


def _reader():
    global _READER
    if _READER is None:
        import easyocr
        _READER = easyocr.Reader(["en"], gpu=False, verbose=False)
    return _READER


def run(vdir):
    fps = read_json(vdir / "meta.json")["probe"]["fps"]
    step = max(1, int(round(fps * STEP_S)))
    cap = cv2.VideoCapture(str(vdir / "video.mp4"))
    i, rows = 0, []
    while True:
        ok, f = cap.read()
        if not ok:
            break
        if i % step == 0:
            H, Wd = f.shape[:2]
            sm = cv2.resize(f, (540, int(540 * H / Wd)))
            sh, sw = sm.shape[:2]
            res = _reader().readtext(sm, detail=1, paragraph=False, text_threshold=0.6, low_text=0.35)
            items = []
            for box, txt, conf in res:
                if conf < 0.4 or not txt.strip():
                    continue
                b = np.array(box)
                x0, y0, x1, y1 = b[:, 0].min(), b[:, 1].min(), b[:, 0].max(), b[:, 1].max()
                crop = sm[int(y0):int(y1), int(x0):int(x1)]
                bright = crop.reshape(-1, 3)
                bright = bright[bright.sum(axis=1) > np.percentile(bright.sum(axis=1), 80)] if len(bright) else bright
                col = bright.mean(axis=0)[::-1] if len(bright) else [np.nan] * 3
                items.append({"text": txt, "conf": float(conf), "cx": float((x0 + x1) / 2 / sw), "cy": float((y0 + y1) / 2 / sh),
                              "h": float((y1 - y0) / sh), "w": float((x1 - x0) / sw), "rgb": [float(c) for c in col]})
            rows.append({"i": i, "t": i / fps, "items": items})
        i += 1
    cap.release()
    with_text = [r for r in rows if r["items"]]
    words = [len(" ".join(it["text"] for it in r["items"]).split()) for r in with_text]
    out = {"step_frames": step, "samples": rows, "text_frac": len(with_text) / max(len(rows), 1),
           "words_on_screen_median": float(np.median(words)) if words else 0.0}
    hs = [it["h"] for r in with_text for it in r["items"]]
    cys = [it["cy"] for r in with_text for it in r["items"]]
    if hs:
        out["text_height_median"] = float(np.median(hs))
        out["text_y_median"] = float(np.median(cys))
    write_json(vdir / "ocr.json", out)
    log.info("  text on %.0f%% of samples, %.1f words, y=%.2f", out["text_frac"] * 100, out["words_on_screen_median"], out.get("text_y_median", -1))
    return {"text_frac": out["text_frac"]}
