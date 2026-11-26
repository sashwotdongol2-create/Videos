#!/usr/bin/env python3
"""levels.py - measured levels of a finished mix against its narration (stickman-3d, Phase 5 levels report).

  python levels.py [project] [--voice public/voice.wav] [--mix public/mix.wav] [--stems DIR] [--cues out/cues.json]
                   [--cue-offset FRAMES] [--fps 30] [--json out/qa/levels.json] [--top 5]

Needs numpy, scipy, soundfile (the stickman config python). Paths are relative to the project (default: cwd).
What it measures, with the targets printed next to every value:
  mix         integrated loudness (BS.1770-4, gated) and true peak (4x oversampled)      -14 LUFS, <= -1 dBTP
  speech      where the voice speaks (voice envelope, gaps < 0.25 s bridged), the voice's RMS and sample peak IN THE
              MIX (the voice's level after the master, not voice.wav's)
  bed         everything that is not the voice, under the voice while it speaks (K-weighted, gated)     ~14 dB under
              + the duck: bed level in gaps vs the speech right next to them                          ~3 dB
  loudest     the loudest 100 ms windows outside speech, relative to speech RMS                       <= -6 dB
  cues        per cue of the real-sound cue list (out/cues.json): the effect peak in [t-50 ms, t+750 ms] relative
              to the voice peak (p99 of the voice's 10 ms peaks in the mix)                          ~ -8 dB
How the voice is taken out of the mix ("bed"):
  stems   (--stems DIR, or audio/stems / out/audio/stems when they have the mix's length): files named voice/vo/narr,
          music/score, sfx/fx/foley, amb/room/atmos (premaster/master/mix are skipped) are fitted into the mix with
          one gain each (least squares), so every level is on the mix's scale. Exact.
  separated (no stems): voice.wav is aligned to the mix, fitted with a 1024-tap filter (the master's EQ / crossover)
          plus a 10 ms gain track (its compressor) and subtracted. Checked on Grave Bell against its stems: the
          leftover voice sits ~12 dB under a bed 19.5 dB under the voice (bed numbers within ~1 dB).
Exit code 0 (it is a report); the summary line counts the WARN lines.
"""
import argparse, json, re, sys
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy import signal
from scipy.linalg import solve_toeplitz

SR = 48000
FPS = 30

TARGETS = {"lufs": -14.0, "tp": -1.0, "bed_under": 14.0, "duck": 3.0, "loud100": -6.0, "cue": -8.0}


# ------------------------------------------------------------------ io
def read(path):
    x, sr = sf.read(str(path), always_2d=True, dtype="float64")
    if sr != SR:
        from math import gcd
        g = gcd(SR, sr); x = signal.resample_poly(x, SR // g, sr // g, axis=0)
    return x


def fit_len(x, n):
    return np.concatenate([x, np.zeros((n - len(x),) + x.shape[1:])]) if len(x) < n else x[:n]


def db(x, floor=-120.0):
    return float(max(floor, 10 * np.log10(max(float(x), 1e-30))))


# ------------------------------------------------------------------ loudness (BS.1770-4)
def kweight(x):
    b1, a1 = [1.53512485958697, -2.69169618940638, 1.19839281085285], [1.0, -1.69065929318241, 0.73248077421585]
    b2, a2 = [1.0, -2.0, 1.0], [1.0, -1.99004745483398, 0.99007225036621]
    return signal.lfilter(b2, a2, signal.lfilter(b1, a1, x, axis=0), axis=0)


def block_power(x, win=0.4, hop=0.1):
    """mean-square (summed over channels) of K-weighted 400 ms blocks; returns (block start samples, power)."""
    y = kweight(x if x.ndim == 2 else x[:, None])
    p = np.concatenate([np.zeros((1, y.shape[1])), np.cumsum(y ** 2, axis=0)])
    w, h = int(win * SR), int(hop * SR)
    if len(y) < w: return np.array([0]), np.array([(y ** 2).mean(0).sum()])
    s = np.arange(0, len(y) - w + 1, h)
    return s, ((p[s + w] - p[s]) / w).sum(axis=1)


def gated(z):
    """integrated loudness of block powers z (absolute -70 LUFS gate, then relative -10 LU)."""
    L = -0.691 + 10 * np.log10(np.maximum(z, 1e-30))
    z = z[L > -70]
    if not len(z): return -70.0
    rel = -0.691 + 10 * np.log10(z.mean()) - 10
    z = z[-0.691 + 10 * np.log10(z) > rel]
    return float(-0.691 + 10 * np.log10(z.mean())) if len(z) else -70.0


def loud_where(x, mask):
    """gated loudness of x over the 400 ms blocks that lie >= 80 % inside mask (per-sample bool)."""
    s, z = block_power(x)
    w = int(0.4 * SR); c = np.concatenate([[0], np.cumsum(mask.astype(np.float64))])
    inside = (c[np.minimum(s + w, len(mask))] - c[s]) / w >= 0.8
    return gated(z[inside]) if inside.any() else -70.0


def true_peak(x):
    return 20 * np.log10(np.max(np.abs(signal.resample_poly(x, 4, 1, axis=0))) + 1e-12)


# ------------------------------------------------------------------ speech mask
def speech_mask(v, n):
    """per-sample bool: where the narration speaks (10 ms RMS above max(p99 - 40 dB, -60 dBFS)), spans padded
    80 ms before / 150 ms after, gaps < 0.25 s bridged, spans < 0.1 s dropped (same rule as final_mix.py)."""
    h = int(0.01 * SR); nb = len(v) // h
    e = 10 * np.log10((v[:nb * h].reshape(nb, h) ** 2).mean(1) + 1e-30)
    on = e > max(np.percentile(e, 99) - 40, -60)
    spans, a = [], None
    for i, o in enumerate(np.append(on, False)):
        if o and a is None: a = i
        if not o and a is not None: spans.append([a * h / SR - 0.08, i * h / SR + 0.15]); a = None
    merged = []
    for s in spans:
        if merged and s[0] - merged[-1][1] < 0.25: merged[-1][1] = max(merged[-1][1], s[1])
        else: merged.append(s)
    merged = [s for s in merged if s[1] - s[0] >= 0.1]
    m = np.zeros(n, bool)
    for a0, b0 in merged: m[max(0, int(a0 * SR)):min(n, int(b0 * SR))] = True
    return m, merged


# ------------------------------------------------------------------ separation
def align(mix_m, v, max_lag=1.0):
    k = min(len(mix_m), len(v), 60 * SR)
    c = signal.correlate(mix_m[:k], v[:k], mode="full", method="fft")
    lags = np.arange(-k + 1, k); ok = np.abs(lags) <= int(max_lag * SR)
    lag = int(lags[ok][np.argmax(np.abs(c[ok]))])
    return (np.concatenate([np.zeros(lag), v])[:len(v)] if lag > 0 else np.concatenate([v[-lag:], np.zeros(-lag)])) if lag else v, lag


def separate(mix_m, v, taps=1024, pre=128, gain_win=0.01):
    """voice as it sits in the mix: Wiener FIR (master EQ / crossover phase) + a short gain track (compressor)."""
    n = len(mix_m); N = 1 << int(np.ceil(np.log2(2 * n)))
    Fv = np.fft.rfft(v, N); Fm = np.fft.rfft(mix_m, N)
    acf = np.fft.irfft(Fv * np.conj(Fv), N)[:taps]
    acf[0] *= 1.0 + 1e-6
    xc = np.fft.irfft(Fm * np.conj(Fv), N)
    h = solve_toeplitz(acf, xc[np.arange(-pre, taps - pre) % N])
    est = signal.fftconvolve(v, h)[pre:pre + n]
    w = int(gain_win * SR); nb = n // w
    M = mix_m[:nb * w].reshape(nb, w); E = est[:nb * w].reshape(nb, w)
    k3 = np.ones(3) / 3
    num = np.convolve((M * E).sum(1), k3, "same"); den = np.convolve((E * E).sum(1), k3, "same")
    g = np.clip(np.where(den > den.max() * 1e-4, num / np.maximum(den, 1e-30), 1.0), 0.33, 3.0)
    return est * np.interp(np.arange(n), (np.arange(nb) + 0.5) * w, g)


KINDS = [("skip", r"premaster|master|^mix|full"), ("voice", r"voice|^vo|narr"), ("music", r"music|score|song"),
         ("fx", r"sfx|^fx|foley|effect"), ("amb", r"amb|room|atmos")]


def load_stems(d, n):
    out, notes = {}, []
    for f in sorted(Path(d).glob("*.wav")):
        kind = next((k for k, rx in KINDS if re.search(rx, f.stem, re.I)), "other")
        if kind == "skip": continue
        x = read(f)
        if abs(len(x) - n) > 0.05 * SR: notes.append(f"{f.name}: {len(x) / SR:.2f} s vs mix {n / SR:.2f} s (skipped)"); continue
        out.setdefault(kind, []).append((f.name, fit_len(x, n).mean(1)))
    return out, notes


# ------------------------------------------------------------------ cues
def load_cues(path, fps, offset):
    d = json.loads(Path(path).read_text(encoding="utf-8"))
    if isinstance(d, list) and d and isinstance(d[0], dict) and "events" in d[0]: d = d[0]
    ev = d.get("events", []) if isinstance(d, dict) else [e for e in d if isinstance(e, dict) and "f" in e]
    fps = (d.get("fps") if isinstance(d, dict) else None) or fps
    return [dict(e, t=(float(e["f"]) - offset) / fps) for e in ev], fps


# ------------------------------------------------------------------ report
def mark(ok):
    return "OK  " if ok else "WARN"


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("project", nargs="?", default=".")
    ap.add_argument("--voice", default="public/voice.wav")
    ap.add_argument("--mix", default="public/mix.wav")
    ap.add_argument("--stems", help="folder of stems on one time line with the mix (default: audio/stems or out/audio/stems if they fit)")
    ap.add_argument("--no-stems", action="store_true", help="ignore stems even if found (separate the voice instead)")
    ap.add_argument("--cues", help="real-sound cue list (default out/cues.json, then audio/cues.json)")
    ap.add_argument("--cue-offset", type=float, default=0, help="frames to subtract from cue frames (a segment cut from a longer film)")
    ap.add_argument("--fps", type=float, default=FPS)
    ap.add_argument("--json", help="report file (default <project>/out/qa/levels.json)")
    ap.add_argument("--top", type=int, default=5)
    a = ap.parse_args(argv)
    P = Path(a.project).resolve(); R = lambda f: f if Path(f).is_absolute() else P / f
    vp, mp = R(a.voice), R(a.mix)
    for f in (vp, mp):
        if not f.exists(): sys.exit(f"levels: missing {f}")
    mix = read(mp); n = len(mix); mix_m = mix.mean(1)
    v = fit_len(read(vp).mean(1), n)
    warns = 0; rep = {"mix": str(mp), "voice": str(vp), "seconds": round(n / SR, 3)}

    # ---- components on the mix's scale
    sd = None if a.no_stems else (R(a.stems) if a.stems else next((R(x) for x in ("audio/stems", "out/audio/stems") if R(x).is_dir()), None))
    stems, notes = load_stems(sd, n) if sd and Path(sd).is_dir() else ({}, [])
    if stems and any(k != "voice" for k in stems):
        cols = [(k, nm, x) for k, L in stems.items() for nm, x in L]
        if "voice" not in stems: cols.insert(0, ("voice", vp.name, align(mix_m, v)[0]))
        X = np.stack([c[2] for c in cols], 1)
        k, *_ = np.linalg.lstsq(X, mix_m, rcond=None)
        comp = {}
        for (kind, nm, x), g in zip(cols, k): comp[kind] = comp.get(kind, 0) + g * x
        voice_in = comp.pop("voice"); bed = sum(comp.values())
        fx = comp.get("fx"); music = comp.get("music")
        method = f"stems ({sd}: " + ", ".join(f"{nm} {20 * np.log10(abs(g) + 1e-12):+.1f} dB" for (kind, nm, x), g in zip(cols, k)) + ")"
        lag = 0
    else:
        va, lag = align(mix_m, v)
        voice_in = separate(mix_m, va); bed = mix_m - voice_in; fx = None; music = None
        method = f"separated (voice.wav aligned {lag / SR * 1000:+.1f} ms, filter + gain fit, subtracted)"
        v = va
    rep["method"] = method; rep["stem_notes"] = notes

    mask, spans = speech_mask(voice_in if stems else v, n)
    gaps = ~mask
    sp_s = mask.sum() / SR
    out = [f"LEVELS  {mp.name} ({n / SR:.2f} s) vs {vp.name}   bed: {method}"]
    out += [f"  note: {x}" for x in notes]

    # ---- mix
    I = gated(block_power(mix)[1]); TP = true_peak(mix)
    ok_i, ok_tp = abs(I - TARGETS['lufs']) <= 1.0, TP <= TARGETS["tp"]
    warns += (not ok_i) + (not ok_tp)
    out.append(f"  mix integrated       {I:7.1f} LUFS   target {TARGETS['lufs']:.0f} LUFS (+-1)     {mark(ok_i)}")
    out.append(f"  mix true peak        {TP:7.1f} dBTP   target <= {TARGETS['tp']:.0f} dBTP          {mark(ok_tp)}")
    rep.update(lufs=round(I, 2), true_peak_db=round(TP, 2))

    if sp_s < 0.5:
        out.append("  no speech found in the voice: nothing else to measure")
        return finish(out, rep, warns, a, P)
    sp_rms = db(np.mean(voice_in[mask] ** 2))
    pw = int(0.01 * SR); vb = np.abs(voice_in[:n // pw * pw]).reshape(-1, pw).max(1)[mask[:n // pw * pw:pw]]
    v_peak = 20 * np.log10(np.percentile(vb, 99) + 1e-12)     # robust voice peak: p99 of 10 ms peaks (one plosive is not the voice's level)
    v_lu = loud_where(voice_in, mask)
    out.append(f"  speech               {sp_s:7.1f} s      {len(spans)} spans; voice in the mix: RMS {sp_rms:.1f} dBFS, peak (p99 of 10 ms) {v_peak:.1f} dBFS, {v_lu:.1f} LUFS")
    rep.update(speech_s=round(sp_s, 2), speech_spans=[[round(x, 3) for x in s] for s in spans], speech_rms_db=round(sp_rms, 2),
               voice_peak_db=round(v_peak, 2), voice_lufs_speech=round(v_lu, 2))

    # ---- bed under the voice + duck
    def under(x, name):
        nonlocal warns
        L = loud_where(x, mask)
        if L <= -69: out.append(f"  {name:20s}    silent under the speech"); return None
        u = v_lu - L; ok = 11 <= u <= 20; warns += not ok
        hint = "" if ok else ("  (too loud: words get masked)" if u < 11 else "  (very low: fine if wanted, the bed barely reads)")
        out.append(f"  {name:20s} {u:7.1f} dB     target ~{TARGETS['bed_under']:.0f} dB under (11-20)  {mark(ok)}{hint}")
        return round(u, 2)
    rep["bed_under_db"] = under(bed, "bed under voice")
    if music is not None: rep["music_under_db"] = under(music, "music under voice")
    duck_src = music if music is not None else bed
    s, z = block_power(duck_src, 0.4, 0.1)
    w = int(0.4 * SR); c = np.concatenate([[0], np.cumsum(mask.astype(float))]); frac = (c[np.minimum(s + w, n)] - c[s]) / w
    L = -0.691 + 10 * np.log10(np.maximum(z, 1e-30)); tmid = (s + w / 2) / SR
    pairs = []
    for i in np.nonzero((frac <= 0.05) & (L > -60))[0]:
        near = (frac >= 0.95) & (np.abs(tmid - tmid[i]) <= 1.5) & (L > -60)
        if near.any(): pairs.append(L[i] - np.median(L[near]))
    if len(pairs) >= 8:
        d = float(np.median(pairs)); ok = 1.5 <= d <= 6; warns += not ok
        out.append(f"  duck under speech    {d:7.1f} dB     target ~{TARGETS['duck']:.0f} dB (1.5-6)            {mark(ok)}   ({len(pairs)} gap blocks"
                   + ("" if music is not None else "; bed incl. effects, median") + ")")
        rep["duck_db"] = round(d, 2)
    else:
        out.append(f"  duck under speech        n/a     (only {len(pairs)} bed blocks in gaps >= 0.4 s next to speech; needs 8)"); rep["duck_db"] = None

    # ---- cues
    cue_path = R(a.cues) if a.cues else next((R(x) for x in ("out/cues.json", "audio/cues.json") if R(x).exists()), None)
    cues = []
    if cue_path and Path(cue_path).exists():
        cues, cfps = load_cues(cue_path, a.fps, a.cue_offset)
        cues = [e for e in cues if 0 <= e["t"] < n / SR]

    # ---- loudest 100 ms outside speech
    hw = int(0.1 * SR); hop = int(0.01 * SR)
    p = np.concatenate([[0], np.cumsum(mix_m ** 2)]); g = np.concatenate([[0], np.cumsum(mask.astype(float))])
    st = np.arange(0, n - hw, hop)
    rms = 10 * np.log10((p[st + hw] - p[st]) / hw + 1e-30); outside = (g[st + hw] - g[st]) == 0
    order = np.argsort(-np.where(outside, rms, -999)); picked = []
    for i in order:
        if not outside[i] or len(picked) >= a.top: break
        if all(abs(st[i] - st[j]) > 0.25 * SR for j in picked): picked.append(i)
    out.append(f"  loudest 100 ms outside speech (re speech RMS {sp_rms:.1f} dBFS; target <= {TARGETS['loud100']:.0f} dB):")
    rep["loudest_100ms"] = []
    for i in picked:
        t = (st[i] + hw / 2) / SR; rel = rms[i] - sp_rms; ok = rel <= TARGETS["loud100"]; warns += not ok
        near = min(cues, key=lambda e: abs(e["t"] - t)) if cues else None
        tag = f"  near cue {near.get('id', near.get('kind'))} ({near['t']:.2f} s)" if near and abs(near["t"] - t) < 0.8 else ""
        out.append(f"     {t:7.2f} s  f{int(t * FPS):<5d} {rel:6.1f} dB  {mark(ok)}{tag}")
        rep["loudest_100ms"].append({"t": round(t, 3), "rel_db": round(float(rel), 2), "ok": bool(ok)})
    if not picked: out.append("     (no gap of 100 ms outside speech)")

    # ---- cues: effect peak vs voice peak
    if cues:
        src = fx if fx is not None else bed
        lab = "the sfx stem" if fx is not None else "the bed (mix minus voice: music and ambience included)"
        out.append(f"  cues ({Path(cue_path).name}, {len(cues)} in range): peak of {lab} in [t-50, t+750 ms] re voice peak {v_peak:.1f} dBFS;"
                   f" target ~{TARGETS['cue']:.0f} dB (-12..-4)")
        rep["cues"] = []
        for e in sorted(cues, key=lambda e: e["t"]):
            a0, b0 = max(0, int((e["t"] - 0.05) * SR)), min(n, int((e["t"] + 0.75) * SR))
            pk = 20 * np.log10(np.max(np.abs(src[a0:b0])) + 1e-12) if b0 > a0 else -120
            rel = pk - v_peak; insp = bool(mask[min(n - 1, int(e["t"] * SR))])
            if pk < -60: verdict, ok = "silent: no sound on this cue?", False
            else:
                ok = -12 <= rel <= -4; verdict = "" if ok else ("too loud" if rel > -4 else "buried")
            warns += not ok
            out.append(f"     {e['t']:7.2f} s  {str(e.get('kind', '')):8s} {str(e.get('id', '')):32s} {rel:6.1f} dB  {mark(ok)} {verdict}"
                       + ("  (under speech)" if insp else ""))
            rep["cues"].append({"id": e.get("id"), "kind": e.get("kind"), "t": round(e["t"], 3), "rel_db": round(float(rel), 2), "under_speech": insp, "ok": bool(ok)})
    else:
        out.append("  cues: no cue list (out/cues.json); per-cue peaks skipped")
    return finish(out, rep, warns, a, P)


def finish(out, rep, warns, a, P):
    rep["warnings"] = warns
    out.append(f"  => {warns} WARN" + ("" if warns else "  (all levels on target)"))
    print("\n".join(out))
    j = Path(a.json) if a.json else P / "out" / "qa" / "levels.json"
    j.parent.mkdir(parents=True, exist_ok=True); j.write_text(json.dumps(rep, indent=1), encoding="utf-8")
    print("  report:", j)
    return 0


if __name__ == "__main__":
    sys.exit(main())
