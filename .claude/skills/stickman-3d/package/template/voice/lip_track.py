# Lip-sync track from the real voice: per film frame, how open the mouth is (from the voice loudness) and its shape
# (from the letter being spoken, via the word timings). The engine reads src/lip.json at film time (faceAnim.ts lipAt),
# so a character's mouth follows the voice wherever its `talk` ranges are on.
# usage: python lip_track.py [voice.wav] [words.json] [out lip.json]   (defaults: public/voice.wav, src/words.json, src/lip.json)
import json, subprocess, sys
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
wav = sys.argv[1] if len(sys.argv) > 1 else str(ROOT / "public/voice.wav")
wj = sys.argv[2] if len(sys.argv) > 2 else str(ROOT / "src/words.json")
out = sys.argv[3] if len(sys.argv) > 3 else str(ROOT / "src/lip.json")
FPS, SR = 30, 16000
LEAD = 1  # the mouth shapes a sound about one frame before it is heard

pcm = subprocess.run(["ffmpeg", "-v", "error", "-i", wav, "-ac", "1", "-ar", str(SR), "-f", "s16le", "-"], capture_output=True, check=True).stdout
x = np.frombuffer(pcm, np.int16).astype(np.float32) / 32768
hop = SR // FPS
n = len(x) // hop + 1
x = np.pad(x, (0, n * hop - len(x)))
# loudness of the speech band only (drops breath rumble and sibilant hiss, which barely move the jaw)
spec = np.abs(np.fft.rfft(x.reshape(n, hop) * np.hanning(hop), axis=1))
freqs = np.fft.rfftfreq(hop, 1 / SR)
band = spec[:, (freqs > 200) & (freqs < 3000)].mean(axis=1)
db = 20 * np.log10(band + 1e-9)
lo, hi = np.percentile(db, 30), np.percentile(db, 97)
env = np.clip((db - lo) / (hi - lo + 1e-9), 0, 1) ** 1.3
# jaw physics: opens fast, closes a little slower, never chatters faster than ~2 frames
sm = np.zeros(n)
for i in range(n):
    p = sm[i - 1] if i else 0
    sm[i] = p + (env[i] - p) * (0.75 if env[i] > p else 0.5)
sm = np.concatenate([sm[LEAD:], np.zeros(LEAD)])

words = json.load(open(wj, encoding="utf-8"))
ROUND, WIDE, OPEN, SHUT, TEETH = set("ouw"), set("eiy"), set("a"), set("mbp"), set("fv")
open_, rnd, teeth = sm.copy(), np.zeros(n), np.zeros(n)
for w in words:
    letters = [c for c in w["w"].lower() if c.isalpha()]
    if not letters:
        continue
    f0, f1 = int(round(w["s"] * FPS)) - LEAD, int(round(w["e"] * FPS)) - LEAD
    for f in range(max(0, f0), min(n, max(f1, f0 + 1))):
        c = letters[min(len(letters) - 1, int((f - f0) / max(1, f1 - f0) * len(letters)))]
        if c in ROUND:
            rnd[f] = 1
        elif c in WIDE:
            rnd[f] = -0.6
            open_[f] *= 0.75
        elif c in OPEN:
            open_[f] = min(1, open_[f] * 1.2)
        elif c in TEETH:
            teeth[f] = 1
            open_[f] *= 0.4
    if letters[0] in SHUT and 0 <= f0 < n:  # lips press together on m / b / p
        open_[max(0, f0 - 1):f0 + 1] = 0
# silence between words closes the mouth fully
for f in range(n):
    t = (f + LEAD) / FPS
    if not any(w["s"] - 0.05 <= t <= w["e"] + 0.05 for w in words):
        open_[f] *= 0.2
rnd = np.convolve(rnd, [0.25, 0.5, 0.25], "same")
q = lambda a: [round(float(v), 2) for v in a]
json.dump({"fps": FPS, "open": q(open_), "round": q(rnd), "teeth": q(teeth)}, open(out, "w"), separators=(",", ":"))
print(out, n, "frames", f"{n / FPS:.1f} s", "mean open", round(float(open_.mean()), 2), "talking frames", int((open_ > 0.15).sum()))
