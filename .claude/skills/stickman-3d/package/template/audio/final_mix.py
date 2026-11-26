"""Final mix: the unchanged narration (public/voice.wav) + the real-sound bed (mix.py stems: music, sfx, amb),
music ducked under speech from the word timings, music set ~19.5 dB under the voice, mastered with the real-sound
skill's master.py chain (-14 LUFS, true-peak limiter, ceiling 0.77). Writes public/mix.wav (48 kHz stereo 24-bit,
exactly 1588 frames @ 30 fps = 2540800 samples), stems in audio/stems/, a report in out/qa/final_mix.json.
Run from the project root after mix.py:
  <py> -I <skill>/scripts/mix.py --root . --design audio/sounddesign.json --cues out/cues.json --no-master \
        --out out/audio/premaster_bed.wav --trace out/qa/adds.json
  <py> audio/final_mix.py [--skill <skill>/scripts]"""
import argparse, json, os, sys
import numpy as np
import soundfile as sf

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ap = argparse.ArgumentParser()
ap.add_argument("--skill", default=os.path.expanduser("~/.claude/skills/real-sound/scripts"))
ap.add_argument("--under", type=float, default=19.5, help="music under the voice while speaking (LU)")
ap.add_argument("--duck", type=float, default=4.0, help="extra dip of the music under speech (dB)")
ap.add_argument("--fx", type=float, default=0.0, help="sfx + amb trim (dB)")
args = ap.parse_args()
sys.path.insert(0, args.skill)
import master as M  # noqa: E402

SR = 48000
N = int(round(1588 / 30 * SR))            # 2540800
P = lambda *a: os.path.join(ROOT, *a)


def fit(x):
    x = M._stereo(x)
    return np.concatenate([x, np.zeros((N - len(x), 2))]) if len(x) < N else x[:N]


voice = fit(M._read(P("public/voice.wav")))
music = fit(M._read(P("out/audio/stems/music.wav")))
sfx = fit(M._read(P("out/audio/stems/sfx.wav")))
amb = fit(M._read(P("out/audio/stems/amb.wav")))
W = json.load(open(P("src/bell_words.json"), encoding="utf-8"))

# speech mask from the word timings: (s - 80 ms, e + 150 ms), gaps under 0.25 s bridged
spans = []
for w in W:
    a, b = w["s"] - 0.08, w["e"] + 0.15
    if spans and a - spans[-1][1] < 0.25:
        spans[-1][1] = max(spans[-1][1], b)
    else:
        spans.append([a, b])
mask = np.zeros(N)
for a, b in spans:
    mask[max(0, int(a * SR)):min(N, int(b * SR))] = 1.0
# smooth: 80 ms raised-cosine ramps
k = int(0.08 * SR)
ker = np.hanning(2 * k + 1); ker /= ker.sum()
mask = np.clip(np.convolve(mask, ker, mode="same"), 0, 1)


def loud_where(x, m):
    """integrated loudness of x over the samples where m > 0.5 (gated like BS.1770)."""
    idx = m > 0.5
    return M.integrated(x[idx]) if idx.sum() > SR else -70.0


Lv = loud_where(voice, mask)
music_on = (np.abs(music).max(axis=1) > 1e-4).astype(float)
Lm_speech = loud_where(music, mask * music_on)
g_db = (Lv - args.under) - (Lm_speech - args.duck)
duck = 10 ** (-args.duck * mask / 20)
music_out = music * (10 ** (g_db / 20)) * duck[:, None]
fx = 10 ** (args.fx / 20)
sfx_out, amb_out = sfx * fx, amb * fx
pre = voice + music_out + sfx_out + amb_out

mcfg = json.load(open(P("audio/sounddesign.json")))["master"]
x, info = M.finish(pre, lufs=mcfg.get("lufs", -14), ceiling=mcfg.get("ceiling", 0.77), mono_hz=mcfg.get("mono_hz", 120),
                   comp=not mcfg.get("no_comp", False), drive=0 if mcfg.get("no_glue", True) else 1.15)
assert len(x) == N
rep = M.measure(x)
fails = M.gate(rep, mcfg.get("lufs", -14), 0.5, -1.5)
sf.write(P("public/mix.wav"), x, SR, subtype="PCM_24")
os.makedirs(P("audio/stems"), exist_ok=True)
for name, s in (("voice", voice), ("music", music_out), ("sfx", sfx_out), ("amb", amb_out), ("premaster", pre)):
    sf.write(P(f"audio/stems/{name}.wav"), s.astype(np.float32), SR, subtype="FLOAT")
under = Lv - (loud_where(music_out, mask * music_on))
gaps = loud_where(music_out, (1 - mask) * music_on)
out = {"samples": N, "seconds": N / SR, "voice_lufs_speech": round(Lv, 2), "music_gain_db": round(g_db, 2),
       "music_under_voice_in_speech_lu": round(under, 2), "music_lufs_in_gaps": round(gaps, 2),
       "duck_db": args.duck, "master": {k2: v for k2, v in rep.items() if not isinstance(v, (list, dict))},
       "limiter_gr_max_db": round(float(info["limiter_gr_db"].max()), 2),
       "comp_gr_max_db": round(float(np.max(info["comp_gr_db"])) if len(info["comp_gr_db"]) else 0.0, 2),
       "gate_fails": fails}
os.makedirs(P("out/qa"), exist_ok=True)
json.dump(out, open(P("out/qa/final_mix.json"), "w"), indent=1)
print(json.dumps(out, indent=1))
