"""report/FORMULA_draft.md: every measured number of the formula, laid out in the final document's sections.

Numbers come from report/features.csv (one row per video) and the per-video vision.json labels. "Winners" are the hit +
recent groups; ranges are their 25th-75th percentile. Sections that need judgement (opening-line templates written
as rules, story templates, don'ts, the blueprint's wording) are left as <!-- WRITE: ... --> markers for Claude.
"""
from __future__ import annotations

import re
from collections import Counter
from datetime import date

import numpy as np
import pandas as pd

from .util import DATA, REPORT, read_json, sample_path

# Canonical beats and, for each, label patterns in PRIORITY order: the first pattern that matches any of a video's beat
# labels sets that beat's start. Labels follow VISION_REVIEW.md's fixed names (hook, turn, setup, mechanism, payoff,
# ending); the other words cover older free-text labels (Zack D. Films used "misconception", "complication", "promise").
BEATS = [("hook", [r"^hook|cold open"]),
         ("setup / turn", [r"^turn|misconception|complication|promise|^but", r"setup|context|premise"]),
         ("mechanism / escalation", [r"^mechanism|mechan", r"escalat|explain|process|build|rising"]),
         ("payoff", [r"^payoff|payoff|reveal|twist|answer|climax|result"]),
         ("ending", [r"^ending|ending|outro|loop|cta|close"])]
TRANS = [("morph_or_dissolve", "Morph / dissolve (one image transforms into the next)"),
         ("whip_pan", "Whip pan (directional motion blur)"),
         ("zoom_through", "Zoom-through / fly to the next scene"),
         ("rotate_or_flip", "Card flip / rotate"), ("hard_cut", "Hard cut"), ("wipe", "Wipe")]


def _q(df, col, scale=1.0, fmt="{:.1f}"):
    """'median (p25-p75)' over the winners, or 'n/a'."""
    if col not in df:
        return "n/a"
    v = pd.to_numeric(df[col], errors="coerce").dropna() * scale
    if v.empty:
        return "n/a"
    return f"**{fmt.format(v.median())}** ({fmt.format(v.quantile(.25))}-{fmt.format(v.quantile(.75))})"


def _count(df, col, val=1):
    return int((pd.to_numeric(df.get(col, pd.Series(dtype=float)), errors="coerce") == val).sum())


def _beat_starts(win):
    """Median start (% of runtime) of each canonical beat, from vision.json beats."""
    starts = {b: [] for b, _ in BEATS}
    for _, r in win.iterrows():
        vis = read_json(DATA / r["id"] / "vision.json") or {}
        dur = r.get("duration_s") or 0
        beats = [(str(bt.get("beat", "")).lower().strip(), float(bt.get("t", 0))) for bt in vis.get("beats") or []]
        if not dur or not beats:
            continue
        for canon, pats in BEATS:
            for pat in pats:
                hit = [t for name, t in beats if re.search(pat, name)]
                if hit:
                    starts[canon].append(hit[0] / dur * 100)
                    break
    return {b: (np.nanmedian(v), np.nanpercentile(v, 25), np.nanpercentile(v, 75), len(v)) for b, v in starts.items() if v}


def _transitions(win):
    real, rejected = Counter(), 0
    for vid in win["id"]:
        vis = read_json(DATA / vid / "vision.json") or {}
        for c in vis.get("candidates") or []:
            lab = c.get("label", "")
            if lab == "not_a_transition":
                rejected += 1
            else:
                real["zoom_through" if lab == "fly_to_new_scene" else lab] += 1
    return real, rejected


def draft(fmt=None) -> str:
    sample = read_json(sample_path(fmt))
    df = pd.read_csv(REPORT / "features.csv")
    win = df[df.group.isin(["hit", "recent"])]
    n_w, n_all = len(win), len(df)
    st = pd.read_csv(REPORT / "stats.csv") if (REPORT / "stats.csv").exists() else pd.DataFrame()
    frames = int(pd.to_numeric(df.get("frames"), errors="coerce").fillna(0).sum())
    fps = pd.to_numeric(df.get("fps"), errors="coerce").median()
    views = pd.to_numeric(win.get("views"), errors="coerce")
    L = []
    w = L.append

    w(f"# The {sample.get('channel_url', '').rstrip('/').split('/')[-1]} Formula: Script, Camera, Editing, Sound, Visuals\n")
    w(f"Measured from {n_all} videos ({sample.get('fmt', fmt or 'shorts')}), every frame at native {fps:.2f} fps "
      f"(~{frames:,} frames). Numbers come from the **{n_w} strong videos** (the all-time most viewed plus the fastest-growing "
      f"recent uploads; {views.min():,.0f}-{views.max():,.0f} views). Ranges are the middle half (25th-75th percentile). "
      f"Generated {date.today().isoformat()}.\n")
    w("<!-- WRITE: one line on what this channel's videos are, and which sections the user wants kept. -->\n\n---\n")

    # ---------- script
    w("## 1. Script\n\n### Hook (first sentence)\n\n| Rule | Number |\n|---|---|")
    w(f"| Narration starts at | {_q(win, 'first_word_t', fmt='{:.2f}')} s (first word) |")
    w(f"| First sentence | {_q(win, 'first_sentence_words', fmt='{:.0f}')} words |")
    w(f"| Words/s in the first 3 s | {_q(win, 'wps_first3', fmt='{:.2f}')} (vs {_q(win, 'wps', fmt='{:.2f}')} overall) |")
    w(f"| Misconception set-up (\"you might think\", \"most people\") | {_count(win, 'misconception_setup')} of {n_w} |\n")
    w("**Opening-line types** (first sentence, strong videos):\n\n| Type | Count | Real first lines |\n|---|---|---|")
    if "hook_type" in win:
        for ht, cnt in win["hook_type"].value_counts().items():
            ex = [s for s in win[win.hook_type == ht]["first_sentence"].dropna().tolist()][:3]
            w(f"| {ht} | {cnt} | " + " · ".join(f"\"{e.strip()}\"" for e in ex) + " |")
    w("\n<!-- WRITE: turn the top types into templates (\"If you [situation], ...\"), note which the NEWEST winners use "
      "(group=recent in features.csv), and any recurring phrase. -->\n")
    w("### Body\n\n| Rule | Number |\n|---|---|")
    for lab, col, kw in [("Length (s)", "duration_s", {}), ("Words", "n_words", {"fmt": "{:.0f}"}),
                         ("Speech rate (words/s)", "wps", {"fmt": "{:.2f}"}), ("Speech rate (wpm)", "wpm", {"fmt": "{:.0f}"}),
                         ("Voice covers (% of runtime)", "speech_coverage", {"scale": 100, "fmt": "{:.0f}"}),
                         ("Pauses > 0.3 s", "pauses_gt_300ms", {"fmt": "{:.0f}"}), ("Longest pause (s)", "longest_pause_s", {"fmt": "{:.2f}"}),
                         ("Sentences", "n_sentences", {"fmt": "{:.0f}"}), ("Words per sentence", "words_per_sentence", {}),
                         ("Reading grade (Flesch-Kincaid)", "fk_grade", {}), ("Questions in the narration", "questions", {"fmt": "{:.0f}"}),
                         ("Sentences with \"you\"", "sentences_with_you", {"fmt": "{:.0f}"}), ("Title words", "title_words", {"fmt": "{:.0f}"})]:
        w(f"| {lab} | {_q(win, col, **kw)} |")
    w(f"| Ends on a question | {_count(win, 'ends_question')} of {n_w} |")
    w(f"| Last 2 s loop back to the first frame | {_count(win, 'loops_to_start')} of {n_w} |\n")
    beats = _beat_starts(win)
    if beats:
        w("### Beat structure (start as % of runtime, from the vision labels)\n\n| Beat | Starts at | Videos |\n|---|---|---|")
        for b, (m, lo, hi, n) in beats.items():
            w(f"| {b} | **~{m:.0f}%** ({lo:.0f}-{hi:.0f}%) | {n} |")
        w("")
    w("<!-- WRITE: 2-3 story templates seen across the winners (with titles as examples), extra script rules, and a short "
      "Don't list taken from what the control group does differently. Read transcripts: data/<id>/transcript.json. -->\n\n---\n")

    # ---------- camera
    w("## 2. Camera (phase correlation + dense optical flow on every frame pair)\n\n| Rule | Number |\n|---|---|")
    for lab, col, kw in [("Camera moving (% of runtime)", "cam_moving_pct", {"fmt": "{:.0f}"}),
                         ("Push-in / dolly in", "cam_dolly_in_pct", {"fmt": "{:.0f}"}), ("Pull-out", "cam_dolly_out_pct", {"fmt": "{:.0f}"}),
                         ("Pan / tilt / sideways", "cam_pan_pct", {"fmt": "{:.0f}"}), ("Static hold", "cam_static_pct", {"fmt": "{:.0f}"}),
                         ("Push speed (log-zoom / s)", "cam_zoom_speed_med", {"fmt": "{:.3f}"}),
                         ("Sideways speed (frame widths / s)", "cam_lat_speed_med", {"fmt": "{:.3f}"}),
                         ("Share of motion that is sideways", "cam_lateral_share", {"scale": 100, "fmt": "{:.0f}"}),
                         ("Jerk (RMS, lower = smoother)", "cam_jerk_rms", {"fmt": "{:.2f}"})]:
        w(f"| {lab} | {_q(win, col, **kw)}{' %' if 'pct' in col or 'share' in col else ''} |")
    zs = pd.to_numeric(win.get("cam_zoom_speed_med"), errors="coerce").median()
    if pd.notna(zs):
        w(f"\nPush speed {zs:.3f} log-zoom/s = about **{(np.exp(zs) - 1) * 100:.0f}% closer every second** "
          f"({zs / (fps or 30) * 100:.2f}%/frame).\n")
    w("<!-- WRITE: the camera logic in one line, plus one worked example from the biggest video "
      "(charts/camera_<id>.png): where it pushes, holds, pulls out. -->\n\n---\n")

    # ---------- editing
    w("## 3. Editing\n\n| Rule | Number |\n|---|---|")
    for lab, col, kw in [("Scenes (shots) per video", "shots", {"fmt": "{:.0f}"}), ("Scene length (s)", "shot_len_med", {}),
                         ("Longest scene (s)", "shot_len_max", {}), ("Transitions per minute", "transitions_per_min", {}),
                         ("First transition at (s)", "first_transition_s", {}),
                         ("Hard cuts (% of transitions)", "hard_cut_share", {"scale": 100, "fmt": "{:.0f}"}),
                         ("Duplicated frames (%)", "dup_frame_pct", {}), ("True render frame rate", "render_fps_est", {})]:
        w(f"| {lab} | {_q(win, col, **kw)} |")
    real, rejected = _transitions(win)
    tot = sum(real.values())
    if tot:
        w(f"\n**How scenes change** ({tot} real transitions labelled by Claude from 9-frame strips; {rejected} more "
          f"candidates were the camera moving, not a transition):\n\n| Transition | Share |\n|---|---|")
        for k, lab in TRANS:
            w(f"| {lab} | **{real.get(k, 0) / tot * 100:.0f}%** ({real.get(k, 0)}) |")
        other = tot - sum(real.get(k, 0) for k, _ in TRANS)
        if other:
            w(f"| Other | {other / tot * 100:.0f}% ({other}) |")
    w(f"\n**Captions:** on screen {_q(win, 'caption_pct', fmt='{:.0f}')} % of the runtime, "
      f"{_q(win, 'caption_words', fmt='{:.0f}')} words at a time, centre at y {_q(win, 'caption_y', fmt='{:.2f}')} of the frame.\n")
    w("<!-- WRITE: when this channel uses a hard cut (what kind of moment), and the editing rule in one line. -->\n\n---\n")

    # ---------- sound
    w("## 4. Sound\n\n| Rule | Number |\n|---|---|")
    for lab, col, kw in [("Integrated loudness (LUFS)", "lufs", {}), ("Loudness range (LU)", "lra", {}),
                         ("True peak (dBTP)", "true_peak", {}), ("Voice (LUFS)", "voice_lufs", {}),
                         ("Music/ambience bed vs voice (dB)", "bed_minus_voice_db", {}), ("Bed playing (% of runtime)", "bed_active_pct", {"fmt": "{:.0f}"}),
                         ("SFX hits per minute", "sfx_onsets_per_min", {"fmt": "{:.0f}"}),
                         ("Transitions with a hit within 2 frames", "cuts_with_sfx_hit", {"scale": 100, "fmt": "{:.0f}"}),
                         ("Narrator pitch (Hz)", "pitch_hz", {"fmt": "{:.0f}"}), ("Pitch variation (semitones SD)", "pitch_sd_st", {})]:
        w(f"| {lab} | {_q(win, col, **kw)} |")
    w("\n<!-- WRITE: the voice (gender, tone, pace) from listening notes or vision.json notes, and the mix rule in one line. -->\n\n---\n")

    # ---------- visuals
    w("## 5. Visuals (measured; drop this section if the user brings their own look)\n\n| Measure | Number |\n|---|---|")
    for lab, col in [("Brightness (luma mean)", "luma_mean"), ("Contrast", "contrast"), ("Saturation", "sat_mean"),
                     ("Background stays on one colour (% of frames)", "bg_constant_pct")]:
        w(f"| {lab} | {_q(win, col, fmt='{:.0f}' if 'pct' in col else '{:.1f}')} |")
    if "bg_hex" in win:
        hexes = win["bg_hex"].dropna()
        if len(hexes):
            rgb = np.array([[int(h[i:i + 2], 16) for i in (1, 3, 5)] for h in hexes])
            med = np.median(rgb, axis=0).round().astype(int)
            w(f"| Background colour (median of the videos' border colours) | #{med[0]:02x}{med[1]:02x}{med[2]:02x} |")
    for col, lab in (("v_art_style", "Art style (examples)"), ("v_background", "Backdrop (examples)")):
        if col in win:
            ex = win[col].dropna().astype(str).str.split(r" \(|;", n=1, regex=True).str[0].str.strip().value_counts()
            w(f"| {lab} | " + "; ".join(f"{k} ({v})" for k, v in ex.head(4).items()) + " |")
    w("")

    # ---------- drivers
    if not st.empty and "mw_p" in st:
        d = st[(st.mw_p < 0.1) & (st.rank_biserial.abs() >= 0.3)].sort_values("mw_p")
        w("## 6. Strong vs control videos (indicative only: small samples)\n")
        if d.empty:
            w("No feature separates the strong videos from the control group at p < 0.1. The formula is what the channel always does.\n")
        else:
            w("| Feature | Strong median | Control median | Effect (rank-biserial) | p |\n|---|---|---|---|---|")
            for _, r in d.head(12).iterrows():
                w(f"| {r.feature} | {r.median_winners:.3g} | {r.median_control:.3g} | {r.rank_biserial:+.2f} | {r.mw_p:.3f} |")
            w("")
    # ---------- blueprint
    dur = pd.to_numeric(win.get("duration_s"), errors="coerce").median()
    w(f"---\n\n## 7. Blueprint for a new video ({dur:.0f} s @ {fps:.0f} fps = {dur * fps:.0f} frames)\n")
    w("| Time | Frames | Narration | Camera | Editing | Sound |\n|---|---|---|---|---|---|")
    for b, (m, *_r) in beats.items():
        t = m / 100 * dur
        w(f"| ~{t:.0f} s ({m:.0f}%) | ~{t * fps:.0f} | {b}: <!-- WRITE --> | <!-- WRITE --> | <!-- WRITE --> | <!-- WRITE --> |")
    w("\nRaw data: `features.csv`, `stats.csv`, `categorical.json`, `formula.json`, `charts/`.\n")
    out = REPORT / "FORMULA_draft.md"
    out.write_text("\n".join(L), encoding="utf-8")
    return str(out)
