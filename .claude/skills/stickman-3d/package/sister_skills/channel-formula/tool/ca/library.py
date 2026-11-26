"""Formula library: `publish` copies an approved formula into <library>/<handle>/ with rules.json (production targets),
style/ transcripts and approved.json; `clean` deletes the whole channel workspace once the formula is published.
Schema of rules.json: D:/resource/short-studio/studio/CONTRACT.md (version 1)."""
from __future__ import annotations

import json
import os
import re
import shutil
from datetime import date
from pathlib import Path

import numpy as np
import pandas as pd

from .config import load_config, load_library
from .formula import BEATS, _beat_starts, _transitions
from .util import DATA, REPORT, WS, log, read_json, sample_path, write_json



def _R(s: pd.Series, scale=1.0):
    v = pd.to_numeric(s, errors="coerce").dropna() * scale
    if v.empty:
        return None
    return {"median": round(float(v.median()), 4), "p25": round(float(v.quantile(.25)), 4), "p75": round(float(v.quantile(.75)), 4)}


def _share(s: pd.Series):
    v = pd.to_numeric(s, errors="coerce").dropna()
    return round(float((v == 1).mean()), 3) if len(v) else None


def approved_beats(formula_md: Path) -> list[dict] | None:
    """Beat starts from the approved FORMULA.md's beat table: rows like `| Setup / turn | **~14%** (12–21%) | ...`.
    The approved document is the authority, so these replace the measured beats in rules.json."""
    if not formula_md.exists():
        return None
    text = formula_md.read_text(encoding="utf-8")
    m = re.search(r"#+[^\n]*beat structure[^\n]*\n(.*?)(?:\n#|\n---|\Z)", text, re.I | re.S)
    if not m:
        return None
    out = []
    for line in m.group(1).splitlines():
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if len(cells) < 2 or not re.search(r"\d", cells[1]):
            continue
        pct = re.search(r"~?\s*(\d+(?:\.\d+)?)\s*%", cells[1])
        rng = re.search(r"\(\s*(\d+(?:\.\d+)?)\s*%?\s*[-–]\s*(\d+(?:\.\d+)?)\s*%", cells[1])
        label = re.sub(r"[*_`]", "", cells[0]).strip().lower()
        canon = next((c for c, pats in BEATS if any(re.search(p, label) for p in pats)), label)
        if pct:
            b = {"name": canon, "start_pct": float(pct.group(1)), "source": "FORMULA.md"}
            if rng:
                b["p25"], b["p75"] = float(rng.group(1)), float(rng.group(2))
            elif float(pct.group(1)) == 0:
                b["p25"] = b["p75"] = 0.0
            out.append(b)
    return out or None


def build_rules(fmt=None) -> dict:
    sample = read_json(sample_path(fmt))
    df = pd.read_csv(REPORT / "features.csv")
    win = df[df.group.isin(["hit", "recent"])]
    g = lambda c, scale=1.0: _R(win[c], scale) if c in win else None  # noqa: E731
    fps = float(pd.to_numeric(df["fps"], errors="coerce").median())
    beats = _beat_starts(win)
    real, _rej = _transitions(win)
    tot = sum(real.values())
    mix = {k: round(v / tot, 3) for k, v in sorted(real.items(), key=lambda kv: -kv[1])} if tot else {}
    hooks = []
    if "hook_type" in win:
        for ht, cnt in win["hook_type"].value_counts().items():
            hooks.append({"type": ht, "count": int(cnt),
                          "examples": win[win.hook_type == ht]["first_sentence"].dropna().astype(str).str.strip().tolist()[:3]})
    push = g("cam_zoom_speed_med")
    styles = []
    if "v_art_style" in win:
        ex = win["v_art_style"].dropna().astype(str).str.split(r" \(|;", n=1, regex=True).str[0].str.strip().value_counts()
        styles = [f"{k} ({v})" for k, v in ex.head(4).items()]
    return {
        "version": 1, "handle": WS.name, "channel_url": sample.get("channel_url"), "fmt": sample.get("fmt", fmt or "shorts"),
        "n_videos": int(len(df)), "n_strong": int(len(win)), "fps": round(fps, 3),
        "script": {
            "duration_s": g("duration_s"), "words": g("n_words"), "wps": g("wps"), "wps_first3": g("wps_first3"),
            "first_word_s": g("first_word_t"), "first_sentence_words": g("first_sentence_words"),
            "words_per_sentence": g("words_per_sentence"), "sentences": g("n_sentences"),
            "longest_pause_s": g("longest_pause_s"), "fk_grade": g("fk_grade"), "questions": g("questions"),
            "you_sentences": g("sentences_with_you"),
            "ends_on_question_share": _share(win.get("ends_question", pd.Series(dtype=float))),
            "loops_to_start_share": _share(win.get("loops_to_start", pd.Series(dtype=float))),
            "misconception_share": _share(win.get("misconception_setup", pd.Series(dtype=float))),
            "cta": False,
            "beats": [{"name": b, "start_pct": round(float(m), 1), "p25": round(float(lo), 1), "p75": round(float(hi), 1), "n": int(n)}
                      for b, (m, lo, hi, n) in beats.items()],
            "hook_types": hooks, "title_words": g("title_words"),
        },
        "camera": {
            "moving_pct": g("cam_moving_pct"), "push_in_pct": g("cam_dolly_in_pct"), "pull_out_pct": g("cam_dolly_out_pct"),
            "pan_pct": g("cam_pan_pct"), "static_pct": g("cam_static_pct"), "push_log_per_s": push,
            "creep_per_frame": round(float(np.exp(push["median"] / fps) - 1), 5) if push else None,
            "lateral_share": g("cam_lateral_share"),
        },
        "editing": {
            "scenes": g("shots"), "scene_len_s": g("shot_len_med"), "first_transition_s": g("first_transition_s"),
            "transitions_per_min": g("transitions_per_min"), "hard_cut_share": mix.get("hard_cut") if tot else None,
            "transition_mix": mix,
            "captions": {"on_pct": g("caption_pct"), "words": g("caption_words"), "y": g("caption_y"),
                         "height": g("caption_height")},
        },
        "sound": {
            "lufs": g("lufs"), "lra": g("lra"), "true_peak": g("true_peak"), "voice_lufs": g("voice_lufs"),
            "bed_minus_voice_db": g("bed_minus_voice_db"), "bed_active_pct": g("bed_active_pct"),
            "sfx_per_min": g("sfx_onsets_per_min"), "transitions_with_hit": g("cuts_with_sfx_hit"), "pitch_sd_st": g("pitch_sd_st"),
        },
        "visuals": {"luma_mean": g("luma_mean"), "contrast": g("contrast"), "sat_mean": g("sat_mean"),
                    "bg_constant_pct": g("bg_constant_pct"), "art_styles": styles},
    }


def publish(fmt=None, allow_draft=False) -> Path:
    if not (REPORT / "FORMULA.md").exists():
        if not allow_draft:
            raise SystemExit(f"No {REPORT / 'FORMULA.md'}: write and get it approved first (or --allow-draft to publish the draft).")
        shutil.copy2(REPORT / "FORMULA_draft.md", REPORT / "FORMULA.md")
    lib = load_library() / WS.name
    lib.mkdir(parents=True, exist_ok=True)
    for name in ("FORMULA.md", "formula.json", "stats.csv", "features.csv", "categorical.json"):
        if (REPORT / name).exists():
            shutil.copy2(REPORT / name, lib / name)
    if (REPORT / "charts").exists():
        shutil.copytree(REPORT / "charts", lib / "charts", dirs_exist_ok=True)
    rules = build_rules(fmt)
    ab = approved_beats(REPORT / "FORMULA.md")
    if ab:   # the approved document wins over the measured beat starts
        rules["script"]["beats_measured"] = rules["script"]["beats"]
        rules["script"]["beats"] = ab
        log.info("beats taken from the approved FORMULA.md: %s", ", ".join(f"{b['name']} {b['start_pct']:g}%" for b in ab))
    write_json(lib / "rules.json", rules)
    style = lib / "style"
    style.mkdir(exist_ok=True)
    df = pd.read_csv(REPORT / "features.csv")
    n_style = 0
    for _, r in df[df.group.isin(["hit", "recent"])].iterrows():
        tr = read_json(DATA / r["id"] / "transcript.json") or {}
        if tr.get("text"):
            (style / f"{r['id']}.txt").write_text(f"{r.get('title') or ''}\n\n{tr['text'].strip()}\n", encoding="utf-8")
            n_style += 1
    write_json(lib / "approved.json", {"approved": date.today().isoformat(), "handle": WS.name,
                                       "channel_url": rules["channel_url"], "fmt": rules["fmt"],
                                       "n_videos": rules["n_videos"], "n_strong": rules["n_strong"]})
    log.info("published %s (rules.json, %d style transcripts)", lib, n_style)
    return lib


def _links(root: Path):
    """Every symlink or Windows junction under root (Path.resolve() misses junctions on Python 3.11)."""
    for dirpath, dirnames, filenames in os.walk(root):
        for n in dirnames + filenames:
            p = Path(dirpath) / n
            if p.is_symlink() or getattr(p.lstat(), "st_file_attributes", 0) & 0x400:   # 0x400 = REPARSE_POINT
                yield p


def clean(yes=False) -> None:
    lib = load_library() / WS.name
    if not (lib / "approved.json").exists():
        raise SystemExit(f"{WS.name} is not published ({lib / 'approved.json'} missing): run `publish` after approval first.")
    if WS.resolve().parent != load_config()["home"].resolve():   # only ever a direct child of <home>
        raise SystemExit(f"{WS} is not a channel workspace under {load_config()['home']}: clean refuses.")
    if not WS.exists():
        print(f"{WS} is already gone.")
        return
    link = next(_links(WS), None)   # a workspace wired to data elsewhere must never delete through the link
    if link:
        raise SystemExit(f"{link} is a link or junction: clean refuses to delete through it.")
    size = sum(q.stat().st_size for q in WS.rglob("*") if q.is_file())
    print(f"Whole workspace {WS}: {size / 1e9:.2f} GB (videos, per-frame data, transcripts, labels, report copy). "
          f"The formula stays in {lib}.")
    if not yes:
        print("Dry run. Re-run with --yes to delete.")
        return
    shutil.rmtree(WS)
    print(f"deleted {size / 1e9:.2f} GB")
