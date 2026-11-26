"""Script: word-level transcript (faster-whisper on the isolated voice), speech rate, hook type, structure stats."""
from __future__ import annotations

import re

import numpy as np

from .util import MODELS, log, read_json, write_json
from .util import run as sh
from .hooks import hook_type  # noqa: F401  (re-exported: report.py and older callers)

_MODEL = None
NUM_WORDS = set("zero one two three four five six seven eight nine ten eleven twelve hundred thousand million billion trillion percent".split())


def _model():
    global _MODEL
    if _MODEL is None:
        from faster_whisper import WhisperModel
        _MODEL = WhisperModel("small.en", device="cpu", compute_type="int8", download_root=str(MODELS / "whisper"))
    return _MODEL


def run_(vdir):
    stems = vdir / "stems" / "htdemucs" / "audio" / "vocals.wav"
    src = stems if stems.exists() else vdir / "audio.wav"
    wav16 = vdir / "voice16k.wav"
    sh(["ffmpeg", "-y", "-v", "error", "-i", src, "-ac", "1", "-ar", "16000", wav16])
    segs, info = _model().transcribe(str(wav16), language="en", word_timestamps=True, vad_filter=False, beam_size=5,
                                     condition_on_previous_text=False)
    words = []
    for s in segs:
        for w in s.words or []:
            words.append({"w": w.word.strip(), "s": float(w.start), "e": float(w.end), "p": float(w.probability)})
    text = " ".join(w["w"] for w in words).strip()
    out = {"text": text, "words": words, "n_words": len(words)}
    if words:
        t0, t1 = words[0]["s"], words[-1]["e"]
        out["first_word_t"] = t0
        out["speech_span"] = t1 - t0
        out["wps"] = len(words) / max(t1 - t0, 1e-3)
        out["wps_first3"] = sum(1 for w in words if w["s"] < t0 + 3) / 3.0
        out["wps_last5"] = sum(1 for w in words if w["e"] > t1 - 5) / 5.0
        gaps = np.array([b["s"] - a["e"] for a, b in zip(words, words[1:])])
        out["pauses_gt_300ms"] = int((gaps > 0.3).sum())
        out["pause_median_s"] = float(np.median(gaps[gaps > 0.3])) if (gaps > 0.3).any() else 0.0
        out["longest_pause_s"] = float(gaps.max()) if len(gaps) else 0.0
        sents = [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if s.strip()]
        out["sentences"] = sents
        out["n_sentences"] = len(sents)
        out["words_per_sentence"] = len(words) / max(len(sents), 1)
        out["first_sentence"] = sents[0] if sents else ""
        out["last_sentence"] = sents[-1] if sents else ""
        out["hook_type"] = hook_type(sents[0] if sents else text)
        out["words_first3s"] = " ".join(w["w"] for w in words if w["s"] < 3.0)
        low = [re.sub(r"[^a-z0-9']", "", w["w"].lower()) for w in words]
        out["you_rate"] = sum(1 for w in low if w in ("you", "your", "you're", "yourself")) / len(low)
        out["number_count"] = sum(1 for w in low if w.isdigit() or w in NUM_WORDS or re.match(r"^\d", w))
        out["questions"] = sum(1 for s in sents if s.endswith("?"))
        try:
            import textstat
            out["fk_grade"] = float(textstat.flesch_kincaid_grade(text))
        except Exception:  # noqa: BLE001
            pass
    write_json(vdir / "transcript.json", out)
    log.info("  %d words, %.2f w/s, hook=%s: %s", len(words), out.get("wps", 0), out.get("hook_type"), out.get("first_sentence", "")[:80])
    return {"words": len(words)}


run = run_
