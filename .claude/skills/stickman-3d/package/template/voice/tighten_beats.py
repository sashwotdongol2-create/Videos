# Zack D. Films pacing on our own voice take: cut every pause longer than MAXG down to KEEP seconds (silence removed from
# the middle of the gap, 10 ms fades), then a pitch-preserving atempo so the whole read lands on TARGET wpm.
# usage: <venv python> tighten.py <take dir> <out dir> [target_wpm=169]
import json, subprocess, sys
from pathlib import Path
import numpy as np
import soundfile as sf

src, out = Path(sys.argv[1]), Path(sys.argv[2])
TARGET = float(sys.argv[3]) if len(sys.argv) > 3 else 0.0   # 0 = keep the natural speed
MAXG, KEEP = 0.45, 0.40
IN_SENT, END_SENT = 0.10, 0.25   # max pause inside a sentence / between sentences
out.mkdir(parents=True, exist_ok=True)
y, sr = sf.read(src / "voice.wav")
W = json.load(open(src / "words.json"))
cuts = []  # (start, end) seconds of audio to remove
for a, b in zip(W, W[1:]):
    g = b["s"] - a["e"]
    end = a["w"].rstrip('"').endswith((".", "?", "!")) and not a["w"].endswith("...")
    beat = a["w"].endswith("...")
    keep = 0.30 if beat else (END_SENT if end else IN_SENT)
    if g > keep + 0.02:
        # BUILD_LESSONS #36: cut right after the previous word, never within 0.15 s of the next word's reported
        # start (alignment starts run late: a centred cut clipped the attack of "Inside")
        c0 = a["e"] + 0.04; c1 = min(c0 + (g - keep), b["s"] - 0.15)
        if c1 - c0 > 0.02: cuts.append((c0, c1))
fade = int(0.01 * sr)
parts, last = [], 0
for s0, s1 in cuts:
    i0, i1 = int(s0 * sr), int(s1 * sr)
    seg = y[last:i0].copy()
    if len(seg) > fade: seg[-fade:] *= np.linspace(1, 0, fade)
    parts.append(seg)
    last = i1
tail = y[last:].copy()
parts.append(tail)
for k in range(1, len(parts)):
    if len(parts[k]) > fade: parts[k][:fade] *= np.linspace(0, 1, fade)
z = np.concatenate(parts)
def shift(t):
    return t - sum(min(max(t - c0, 0), c1 - c0) for c0, c1 in cuts)
W2 = [{"w": w["w"], "s": shift(w["s"]), "e": shift(w["e"])} for w in W]
wpm = len(W2) / (W2[-1]["e"] - W2[0]["s"]) * 60
tempo = TARGET / wpm if TARGET else 1.0
tmp = out / "_tight.wav"
sf.write(tmp, z, sr)
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(tmp), "-filter:a", f"atempo={tempo:.4f}", "-ar", "48000", "-ac", "1", str(out / "voice.wav")], check=True)
tmp.unlink()
W3 = [{"w": w["w"], "s": round(w["s"] / tempo, 3), "e": round(w["e"] / tempo, 3)} for w in W2]
json.dump(W3, open(out / "words.json", "w"), indent=0)
print(f"cut {len(cuts)} pauses, {wpm:.0f} wpm after cuts -> {wpm*tempo:.0f} wpm (atempo {tempo:.3f}), length {W3[-1]['e']:.2f} s")
