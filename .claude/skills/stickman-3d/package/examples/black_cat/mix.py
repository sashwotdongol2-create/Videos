"""Black-cat Short soundtrack (MASTER_WORKFLOW N; SOUND_BRIEF rules; BUILD_LESSONS #40, #44, #47). VOICE FIRST.
Bed: park birds (one place ambience) + Mixkit 671 "mysterious" as mock-horror under his panic, ducked under speech,
out 0.35 s before BAM; silence + a tinnitus ring on "Lights out"; a kalimba button on the reveal.
Effects on the actions, on the word / contact frame: tree impacts, phone taps while texting, the cat's dash (wood
patter), his gasp, a thunder crack on "horror" (the B-movie gag), pacing steps, a ticking build to the oak, message
pings on the reveal. Whooshes only where the scene asks: the rewind (reversed whoosh) and the point (bamboo swish).
Real recordings: E:/shorts/_sfx_library (Freesound CC0/CC-BY, Mixkit); code-made accents: earshot sfx bank."""
import json, subprocess
from pathlib import Path
import numpy as np, soundfile as sf

P = Path(__file__).resolve().parent.parent; S = P / "audio" / "sfx"; SR = 48000
rng = np.random.default_rng(3)
W = json.load(open(P / "src" / "words.json"))
SH = {r["id"]: r for r in json.load(open(P / "src" / "shots.gen.json"))}
FR = json.load(open(P / "src" / "film.json"))["frames"]


def rd(path):
    a, sr = sf.read(path)
    if sr != SR:
        tmp = P / "audio" / f"_rs_{Path(path).name}"
        if not tmp.exists(): subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(path), "-ar", str(SR), str(tmp)], check=True)
        a, _ = sf.read(tmp)
    return np.stack([a, a], 1) if a.ndim == 1 else a[:, :2]


N = FR * 1600
v = rd(P / "public" / "voice.wav"); v = np.pad(v, ((0, max(0, N - len(v))), (0, 0)))[:N]
w = lambda i: W[i]["s"]; we = lambda i: W[i]["e"]; sh = lambda k: SH[k]["a"] / 30
load = lambda n: (lambda a: a / max(1e-6, np.abs(a).max()))(rd(S / n))
bus = {k: np.zeros((N, 2)) for k in ("music", "sfx", "amb")}


def place(b, a, t, db=0.0, fi=0.005, fo=0.12, pan=0.0, rate=1.0):
    if rate != 1.0:
        idx = np.arange(0, len(a) - 1, rate); a = np.stack([np.interp(idx, np.arange(len(a)), a[:, c]) for c in range(2)], 1)
    a = a.copy(); i0, i1 = min(int(fi * SR), len(a) // 2), min(int(fo * SR), len(a) // 2)
    if i0: a[:i0] *= np.linspace(0, 1, i0)[:, None]
    if i1: a[-i1:] *= np.linspace(1, 0, i1)[:, None]
    a *= 10 ** (db / 20) * np.array([1 - max(0, pan), 1 + min(0, pan)])
    i = max(0, int(t * SR)); j = min(N, i + len(a))
    if j > i: bus[b][i:j] += a[:j - i]


def put(b, n, t, db=0.0, start=0.0, dur=None, **k):
    a = load(n)[int(start * SR):]
    if dur: a = a[:int(dur * SR)]
    place(b, a, t, db, **k)


BAM = w(88)
# ---- beds
put("amb", "birds.wav", 0.0, -6, dur=BAM - 0.35, fi=0.05, fo=0.3)
put("amb", "birds.wav", we(90) + 0.6, -10, start=8.0, dur=N / SR - we(90) - 0.6, fi=1.2, fo=1.0)
put("music", "mk_671.wav", sh(3), -2, start=6.0, dur=BAM - 0.35 - sh(3), fi=0.6, fo=0.12)      # mock suspense from the turn
put("music", "eb_pluck_kalimba.wav", w(103) - 0.05, -4, fo=0.8)                                    # reveal button
put("music", "eb_pluck_kalimba.wav", w(116), -8, rate=0.9, fo=1.0)                                  # loop tag on the cat

# ---- shot 1: the impact on frame 1, leaves, a second bonk as he staggers
put("sfx", "impact.wav", 0.0, -2, dur=1.1, fo=0.4)
put("sfx", "sub_drop.wav", 0.0, -9, dur=1.0, fo=0.4)
put("sfx", "paper.wav", 0.15, -12, dur=1.0, fo=0.5)                                                 # leaves rattle
put("sfx", "eb_knock_wood.wav", w(7) - 0.1, -6, rate=0.8)
# ---- shot 2: the cat looks up into the lens
put("sfx", "eb_pro_pop_tink.wav", w(13), -10)
# ---- shot 3 -> 4: the rewind (scene asks for it: whip back in time) = a reversed whoosh
wh = load("whoosh.wav")[: int(0.9 * SR)][::-1]
place("sfx", wh, sh(4) - 0.55, -6, fi=0.2, fo=0.05)
# ---- shot 4: thumbs tapping while he walks, his steps, the cat's dash
for k in range(12): put("sfx", "eb_pro_pop_tink.wav", sh(4) + 0.15 + k * 0.13 + rng.uniform(-0.02, 0.02), -18, rate=rng.uniform(0.9, 1.15))
for k in range(4): put("sfx", "boots_gravel.wav", sh(4) + 0.2 + k * 0.5, -16, start=0.5 + k * 0.4, dur=0.25, fo=0.1)
for k in range(8): put("sfx", "eb_knock_wood.wav", w(27) + k * 0.07, -12 + k * 0.5, rate=1.6, pan=-0.6 + k * 0.15)
# ---- shot 5: the freeze (gasp), the point (swish), the scream gets the music's tension
put("sfx", "gasp.wav", w(33) - 0.05, -8)
put("sfx", "eb_fit_whoosh.short_bamboo_swish.wav", w(34), -10)
# ---- shot 6: the B-movie gag: a thunder crack on "horror" + braam
put("sfx", "thunder.wav", w(46) - 0.05, -5, dur=2.0, fo=0.8)
put("sfx", "braam.wav", w(45), -9, dur=1.5, fo=0.6)
# ---- shot 7: backward steps on the plaza
for k in range(7): put("sfx", "boots_gravel.wav", sh(7) + 0.3 + k * 0.55, -15, start=1.0 + k * 0.3, dur=0.22, fo=0.08)
# ---- shot 9: ticking build to the oak, riser into the step
tk = load("clock_tick.wav")[int(1.0 * SR): int(1.08 * SR)]
t = sh(9); gap = 0.42
while t < BAM - 0.45: place("sfx", tk, t, -10, fo=0.02); t += gap; gap = max(0.14, gap * 0.9)
put("sfx", "riser.wav", w(83) - 0.4, -12, dur=BAM - 0.35 - (w(83) - 0.4), fi=0.3, fo=0.05)
# ---- shot 10: SILENCE 0.35 s, then BAM (wood + sub), then "Lights out": a ring in the black
put("sfx", "impact.wav", BAM, 0, dur=1.6, fo=0.6)
put("sfx", "sub_drop.wav", BAM, -6, dur=1.6, fo=0.6)
put("sfx", "paper.wav", BAM + 0.1, -10, dur=1.2, fo=0.6)
put("sfx", "tinnitus.wav", w(90) - 0.1, -14, dur=1.4, fi=0.2, fo=0.6)
# ---- shot 11: the exhale, the phone sliding on grass
put("sfx", "breath.wav", w(92), -12, dur=0.7, fo=0.3)
put("sfx", "paper.wav", w(98) - 0.1, -11, start=0.4, dur=0.9, fo=0.4)
# ---- shot 12: message pings as the friend's texts land
for i in (108, 110): put("sfx", "eb_pro_notify_ding_2045.wav", w(i), -8)

# ---- VOICE FIRST: music -14 dB under speech, SFX dipped, 60 ms look-ahead (BUILD_LESSONS #40)
env = np.abs(v).max(1); k = int(0.08 * SR); env = np.convolve(env, np.ones(k) / k, mode="same")
ah = int(0.06 * SR); env = np.concatenate([env[ah:], np.zeros(ah)]); on = np.clip(env / 0.08, 0, 1)
mix = v + bus["music"] * 10 ** (-5 / 20) * (1 - 0.7 * on)[:, None] + bus["sfx"] * 10 ** (-5 / 20) * (1 - 0.7 * on)[:, None] + bus["amb"] * 10 ** (-16 / 20)
mix /= max(1.0, np.abs(mix).max() / 0.95)
stems = P / "audio" / "stems"; stems.mkdir(exist_ok=True)
sf.write(stems / "voice.wav", v, SR); sf.write(stems / "music.wav", bus["music"] * 10 ** (-5 / 20), SR)
sf.write(stems / "sfx.wav", bus["sfx"] * 10 ** (-5 / 20), SR); sf.write(stems / "amb.wav", bus["amb"] * 10 ** (-16 / 20), SR)
sf.write(P / "audio" / "mix_raw.wav", mix, SR)
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(P / "audio" / "mix_raw.wav"), "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-ar", str(SR), "-ac", "2", str(P / "public" / "mix.wav")], check=True)
print("mix.wav", round(N / SR, 2), "s")
