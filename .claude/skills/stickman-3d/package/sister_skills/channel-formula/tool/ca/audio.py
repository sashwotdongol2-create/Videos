"""Audio: loudness (EBU R128), voice vs bed (music+SFX) split with Demucs, onsets, voice pitch."""
from __future__ import annotations

import re

import numpy as np
import soundfile as sf

from .util import log, read_json, write_json
from .util import run as sh


def _ebur128(wav):
    """Integrated LUFS, LRA, true peak and a 10 Hz momentary/short-term curve from ffmpeg's ebur128 filter."""
    p = sh(["ffmpeg", "-hide_banner", "-nostats", "-i", wav, "-af", "ebur128=peak=true", "-f", "null", "-"], check=False)
    err = p.stderr
    curve = []
    for m in re.finditer(r"t:\s*([\d.]+)\s+TARGET:.*?M:\s*(-?[\d.inf]+)\s+S:\s*(-?[\d.inf]+)", err):
        t, mm, ss = m.groups()
        curve.append((float(t), float(mm) if "inf" not in mm else -70.0, float(ss) if "inf" not in ss else -70.0))
    summ = err[err.rfind("Summary:"):]
    g = lambda pat: float(re.search(pat, summ, re.S).group(1)) if re.search(pat, summ, re.S) else None  # noqa: E731
    return {"I": g(r"I:\s*(-?[\d.]+) LUFS"), "LRA": g(r"LRA:\s*([\d.]+) LU"), "true_peak": g(r"Peak:\s*(-?[\d.]+) dBFS")}, curve


def _lufs(x, sr):
    import pyloudnorm as pyln
    try:
        v = pyln.Meter(sr).integrated_loudness(x)
        return float(v) if np.isfinite(v) else -70.0
    except Exception:  # noqa: BLE001
        return None


def _demucs(wav, outdir):
    """htdemucs two-stem split (vocals / no_vocals). Returns paths or None."""
    stem_dir = outdir / "htdemucs" / "audio"
    voc, bed = stem_dir / "vocals.wav", stem_dir / "no_vocals.wav"
    if voc.exists() and bed.exists():
        return voc, bed
    import sys
    p = sh([sys.executable, "-m", "demucs", "-n", "htdemucs", "--two-stems", "vocals", "-o", outdir, wav], check=False, timeout=1800)
    if not voc.exists():
        log.warning("demucs failed: %s", p.stderr[-400:])
        return None
    return voc, bed


def _active(x, sr, hop=0.05, floor_db=-45):
    n = int(sr * hop)
    if x.ndim > 1:
        x = x.mean(axis=1)
    frames = len(x) // n
    rms = np.sqrt(np.mean(x[: frames * n].reshape(frames, n) ** 2, axis=1) + 1e-12)
    db = 20 * np.log10(rms + 1e-12)
    return db, db > floor_db


def run_(vdir):
    wav = vdir / "audio.wav"
    if not wav.exists():
        sh(["ffmpeg", "-y", "-v", "error", "-i", vdir / "video.mp4", "-vn", "-ac", "2", "-ar", "44100", wav])
    x, sr = sf.read(str(wav))
    summ, curve = _ebur128(str(wav))
    out = {"loudness": summ, "duration": len(x) / sr}
    out["curve_short_term"] = [c[2] for c in curve[::5]]  # 2 Hz
    stems = _demucs(wav, vdir / "stems")
    shots = read_json(vdir / "shots.json", {})
    cut_t = np.array([b["t"] for b in shots.get("boundaries", [])])
    import librosa
    if stems:
        v, _ = sf.read(str(stems[0]))
        b, _ = sf.read(str(stems[1]))
        out["voice_lufs"] = _lufs(v, sr)
        out["bed_lufs"] = _lufs(b, sr)
        vdb, vact = _active(v, sr)
        bdb, bact = _active(b, sr)
        out["voice_active_frac"] = float(vact.mean())
        out["bed_active_frac"] = float(bact.mean())
        out["bed_db_curve"] = bdb[::10].round(1).tolist()  # 2 Hz
        # bed relative to voice while the voice is speaking
        both = vact & bact
        out["bed_minus_voice_db"] = float(np.median(bdb[both] - vdb[both])) if both.any() else None
        bed_mono = b.mean(axis=1) if b.ndim > 1 else b
        voice_mono = v.mean(axis=1) if v.ndim > 1 else v
    else:
        bed_mono = x.mean(axis=1)
        voice_mono = None
    # SFX hits: strong onsets in the bed
    y = librosa.resample(bed_mono.astype(np.float32), orig_sr=sr, target_sr=22050)
    env = librosa.onset.onset_strength(y=y, sr=22050)
    on = librosa.onset.onset_detect(onset_envelope=env, sr=22050, units="time", backtrack=False,
                                    pre_max=5, post_max=5, pre_avg=20, post_avg=20, delta=0.25, wait=8)
    strong = [float(t) for t in on]
    out["onsets"] = strong
    out["onsets_per_min"] = len(strong) / max(out["duration"], 1) * 60
    fps = shots.get("fps", 30)
    if len(cut_t):
        tol = 2.5 / fps
        out["cuts_with_hit"] = float(np.mean([np.any(np.abs(np.array(strong) - t) <= max(tol, 0.1)) for t in cut_t])) if strong else 0.0
    # tempo of bed (music presence proxy)
    try:
        tempo, beats = librosa.beat.beat_track(y=y, sr=22050)
        out["bed_tempo"] = float(np.atleast_1d(tempo)[0])
    except Exception:  # noqa: BLE001
        pass
    if voice_mono is not None:
        yv = librosa.resample(voice_mono.astype(np.float32), orig_sr=sr, target_sr=16000)
        f0, vflag, _ = librosa.pyin(yv, fmin=65, fmax=400, sr=16000, frame_length=1024)
        f0 = f0[np.isfinite(f0)]
        if len(f0):
            out["pitch_hz_median"] = float(np.median(f0))
            out["pitch_semitone_sd"] = float(np.std(12 * np.log2(f0 / np.median(f0))))
    write_json(vdir / "audio.json", out)
    log.info("  %.1f LUFS, LRA %s, voice %s / bed %s LUFS", summ["I"] or 0, summ["LRA"], out.get("voice_lufs"), out.get("bed_lufs"))
    return {"lufs": summ["I"]}


run = run_
