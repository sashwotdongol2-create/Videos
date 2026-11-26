"""Aggregate per-video measurements into features.csv, run the statistics, draw charts, write formula.json."""
from __future__ import annotations

import colorsys
import re
from pathlib import Path

import numpy as np
import pandas as pd
from scipy import stats
from scipy.signal import savgol_filter

from .config import load_library
from .util import DATA, REPORT, WS, log, read_json, rgb_hex, sample_path, write_json

# camera thresholds (per second, after smoothing)
ZOOM_MOVE = 0.03     # |d log scale / dt| above this = dolly / zoom
LAT_MOVE = 0.03      # lateral speed (frame widths / s) above this = pan / tilt / drift
EXCL = 3             # frames excluded either side of a shot boundary (a cut fakes huge motion)


def _is_sky_blue(r, g, b):
    h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    return 0.53 <= h <= 0.62 and s >= 0.30 and v >= 0.45


BG_MATCH = 40.0  # RGB distance under which a frame's border colour counts as "the same background"


def camera_features(df: pd.DataFrame, bounds: list[dict], fps: float) -> tuple[dict, pd.DataFrame]:
    n = len(df)
    z = np.log(df["ds_scale"].fillna(1).clip(0.5, 2)).to_numpy().copy()
    x = df["dx"].fillna(0).to_numpy().copy()
    y = df["dy"].fillna(0).to_numpy().copy()
    mask = np.ones(n, bool)
    mask[0] = False
    for b in bounds:
        mask[max(0, b["frame"] - EXCL):b["frame"] + EXCL + 1] = False
    for arr in (z, x, y):
        arr[~mask] = 0.0
    win = min(11, (n // 2) * 2 - 1)
    zs, xs, ys = (savgol_filter(a, win, 3) if win >= 5 else a for a in (z, x, y))
    zv, xv, yv = zs * fps, xs * fps, ys * fps                 # per-second velocities
    lat = np.hypot(xv, yv)
    za, xa, ya = (np.gradient(v) * fps for v in (zv, xv, yv))
    zj, xj, yj = (np.gradient(a) * fps for a in (za, xa, ya))
    jerk = np.sqrt(zj ** 2 + xj ** 2 + yj ** 2)
    m = mask
    tot = max(m.sum(), 1)
    move_in = m & (zv > ZOOM_MOVE)
    move_out = m & (zv < -ZOOM_MOVE)
    pan = m & (lat > LAT_MOVE) & (np.abs(zv) <= ZOOM_MOVE)
    static = m & (np.abs(zv) <= ZOOM_MOVE) & (lat <= LAT_MOVE)
    f = {
        "cam_static_pct": static.sum() / tot * 100,
        "cam_dolly_in_pct": move_in.sum() / tot * 100,
        "cam_dolly_out_pct": move_out.sum() / tot * 100,
        "cam_pan_pct": pan.sum() / tot * 100,
        "cam_moving_pct": (1 - static.sum() / tot) * 100,
        "cam_zoom_speed_med": float(np.median(np.abs(zv[m]))) if m.any() else np.nan,
        "cam_lat_speed_med": float(np.median(lat[m])) if m.any() else np.nan,
        "cam_lateral_share": float(np.abs(lat[m]).sum() / max(np.abs(lat[m]).sum() + np.abs(zv[m]).sum(), 1e-9)),
        "cam_jerk_rms": float(np.sqrt(np.mean(jerk[m] ** 2))) if m.any() else np.nan,
        "cam_jerk_med": float(np.median(jerk[m])) if m.any() else np.nan,
        "cam_net_zoom_in": float(np.exp(zs[m & (zv > 0)].sum())),  # total push-in factor across the video
        "cam_rot_med": float(np.median(np.abs(df["ds_rot"].fillna(0).to_numpy()[m]) * fps)) if m.any() else np.nan,
    }
    series = pd.DataFrame({"t": df["t"], "zoom_v": zv, "lat_v": lat, "jerk": jerk, "valid": m})
    return f, series


def video_features(vid: str, sample_row: dict, vdir: Path | None = None) -> tuple[dict, pd.DataFrame | None]:
    vdir = vdir or DATA / vid
    meta = read_json(vdir / "meta.json")
    fps = meta["probe"]["fps"]
    dur = meta["probe"]["duration"]
    yt = meta.get("youtube") or {}
    f = {"id": vid, "group": sample_row.get("group", "mine"), "title": yt.get("title") or sample_row.get("title"),
         "views": sample_row.get("views"), "vpd": sample_row.get("vpd"), "age_days": sample_row.get("age_days"),
         "upload_date": sample_row.get("upload_date"), "duration_s": dur, "fps": fps,
         "frames": meta["probe"]["n_frames"]}
    if sample_row.get("views"):
        f["like_rate"] = (sample_row.get("likes") or 0) / sample_row["views"] * 1000
        f["comment_rate"] = (sample_row.get("comments") or 0) / sample_row["views"] * 1000
        f["log_vpd"] = np.log10(sample_row["vpd"])
    title = f["title"] or ""
    f["title_words"] = len(re.sub(r"[^\w\s']", " ", title).split())
    f["title_question"] = int("?" in title)
    f["title_emoji"] = int(bool(re.search(r"[\U0001F300-\U0001FAFF]", title)))
    series = None
    if (vdir / "frames.parquet").exists():
        df = pd.read_parquet(vdir / "frames.parquet")
        f.update({
            "luma_mean": df.luma_mean.mean(), "contrast": df.contrast.mean(), "sat_mean": df.sat_mean.mean(),
            "sharp_med": df.sharp.median(), "luma_p5": df.luma_p5.median(), "luma_p95": df.luma_p95.median(),
        })
        blue = [_is_sky_blue(r, g, b) for r, g, b in zip(df.bord_r, df.bord_g, df.bord_b)]
        f["blue_bg_pct"] = float(np.mean(blue) * 100)
        if any(blue):
            bb = df.loc[blue, ["bord_r", "bord_g", "bord_b"]].median()
            f["blue_bg_hex"] = rgb_hex(bb.values)
        # channel-agnostic background: the median border colour and how much of the runtime stays on it
        bord = df[["bord_r", "bord_g", "bord_b"]].to_numpy(float)
        bmed = np.nanmedian(bord, axis=0)
        f["bg_hex"] = rgb_hex(bmed)
        f["bg_constant_pct"] = float(np.mean(np.linalg.norm(bord - bmed, axis=1) < BG_MATCH) * 100)
        dom = df[["dom_r", "dom_g", "dom_b"]].median()
        f["dominant_hex"] = rgb_hex(dom.values)
        # duplicated frames reveal a lower render frame rate padded up to the upload rate
        dup = (df["diff"].fillna(99) < 0.2).to_numpy()
        f["dup_frame_pct"] = float(dup[1:].mean() * 100)
        f["render_fps_est"] = float(fps * (1 - dup[1:].mean()))
        sh = read_json(vdir / "shots.json")
        if sh:
            bounds = sh["boundaries"]
            vis = read_json(vdir / "vision.json")
            if vis is not None:  # Claude's visual labels are ground truth for which candidates are real transitions
                lab = {c["n"]: c["label"] for c in vis.get("candidates", [])}
                real = [dict(b, kind=lab.get(n, b["kind"])) for n, b in enumerate(bounds)
                        if lab.get(n, b["kind"]) != "not_a_transition"]
                f["labelled"] = 1
            else:
                real = bounds
                f["labelled"] = 0
            kinds = [b["kind"] for b in real]
            nb = len(kinds)
            edges = [0.0] + [b["t"] for b in real] + [dur]
            lens = np.diff(edges)
            share = lambda *ks: sum(kinds.count(k) for k in ks) / nb if nb else np.nan  # noqa: E731
            f.update({
                "shots": len(lens), "shots_per_min": len(lens) / dur * 60, "shot_len_med": float(np.median(lens)),
                "shot_len_mean": float(lens.mean()), "shot_len_max": float(lens.max()),
                "transitions": nb, "transitions_per_min": nb / dur * 60,
                "hard_cut_share": share("hard_cut"), "whip_share": share("whip_pan"),
                "zoom_through_share": share("zoom_through", "fly_to_new_scene"),
                "dissolve_share": share("dissolve_or_morph", "morph_or_dissolve", "fade"),
                "flip_share": share("rotate_or_flip"), "wipe_share": share("wipe"),
                "motion_transition_share": share("whip_pan", "zoom_through", "fly_to_new_scene", "rotate_or_flip", "wipe"),
                "first_transition_s": real[0]["t"] if nb else dur,
            })
            cf, series = camera_features(df, bounds, fps)
            f.update(cf)
            if vis is not None:
                f["human_present"] = int(bool(vis.get("human_present")))
                f["face_visible"] = int(bool(vis.get("face_visible")))
                f["loops_to_start"] = int(bool(vis.get("loops_to_start")))
                for k, v in (vis.get("shot_types_pct") or {}).items():
                    f[f"shot_{k}_pct"] = v
                for k in ("art_style", "background", "hook_visual", "first_frame", "subject", "caption_style", "ending_visual"):
                    f[f"v_{k}"] = vis.get(k)
    au = read_json(vdir / "audio.json")
    if au:
        L = au["loudness"]
        f.update({"lufs": L.get("I"), "lra": L.get("LRA"), "true_peak": L.get("true_peak"),
                  "voice_lufs": au.get("voice_lufs"), "bed_lufs": au.get("bed_lufs"),
                  "bed_minus_voice_db": au.get("bed_minus_voice_db"), "bed_active_pct": (au.get("bed_active_frac") or np.nan) * 100,
                  "voice_active_pct": (au.get("voice_active_frac") or np.nan) * 100,
                  "sfx_onsets_per_min": au.get("onsets_per_min"), "cuts_with_sfx_hit": au.get("cuts_with_hit"),
                  "pitch_hz": au.get("pitch_hz_median"), "pitch_sd_st": au.get("pitch_semitone_sd"),
                  "bed_tempo": au.get("bed_tempo")})
    tr = read_json(vdir / "transcript.json")
    if tr and tr.get("n_words"):
        f.update({k: tr.get(k) for k in ["n_words", "wps", "wps_first3", "wps_last5", "first_word_t", "pauses_gt_300ms",
                                          "longest_pause_s", "n_sentences", "words_per_sentence", "you_rate", "number_count",
                                          "questions", "fk_grade", "hook_type", "first_sentence", "last_sentence", "words_first3s"]})
        f["wpm"] = tr["wps"] * 60
        from .script import hook_type
        f["hook_type"] = hook_type(tr.get("first_sentence") or "")
        opening = " ".join((tr.get("sentences") or [])[:2]).lower()
        f["misconception_setup"] = int(bool(re.search(
            r"you might think|you'd probably think|most people|some people think|people think|obviously|you'd think|you may think", opening)))
        f["sentences_with_you"] = sum(1 for s in (tr.get("sentences") or []) if re.search(r"\byou(r|'re)?\b", s.lower()))
        f["first_sentence_words"] = len((tr.get("first_sentence") or "").split())
        f["speech_coverage"] = tr["speech_span"] / dur
        f["ends_question"] = int((tr.get("last_sentence") or "").strip().endswith("?"))
    oc = read_json(vdir / "ocr.json")
    if oc:
        f.update({"caption_pct": oc["text_frac"] * 100, "caption_words": oc["words_on_screen_median"],
                  "caption_height": oc.get("text_height_median"), "caption_y": oc.get("text_y_median")})
    return f, series


NUMERIC_SKIP = {"views", "vpd", "age_days", "frames", "fps", "log_vpd"}
# not style: bookkeeping and YouTube-only columns a local video cannot have
COMPARE_SKIP = {"labelled", "title_words", "title_question", "title_emoji", "like_rate", "comment_rate"}


def build(fmt: str | None = None):
    sample = read_json(sample_path(fmt))
    REPORT.mkdir(exist_ok=True)
    (REPORT / "charts").mkdir(exist_ok=True)
    rows, series = [], {}
    for v in sample["videos"]:
        if not (DATA / v["id"] / "meta.json").exists():
            continue
        f, s = video_features(v["id"], v)
        rows.append(f)
        if s is not None:
            series[v["id"]] = s
    df = pd.DataFrame(rows)
    df.to_csv(REPORT / "features.csv", index=False, encoding="utf-8")
    log.info("features.csv: %d videos x %d columns", *df.shape)

    num = [c for c in df.columns if pd.api.types.is_numeric_dtype(df[c]) and c not in NUMERIC_SKIP]
    win = df[df.group.isin(["hit", "recent"])]
    ctrl = df[df.group == "control"]
    out = []
    for c in num:
        a, b = win[c].dropna(), ctrl[c].dropna()
        allv = df[c].dropna()
        r = {"feature": c, "n": len(allv), "median_winners": a.median(), "p25_winners": a.quantile(.25), "p75_winners": a.quantile(.75),
             "min": allv.min(), "max": allv.max(), "median_control": b.median() if len(b) else np.nan,
             "median_hits": df[df.group == "hit"][c].median(), "median_recent": df[df.group == "recent"][c].median()}
        mu = allv.mean()
        r["cv"] = allv.std() / abs(mu) if mu else np.nan
        if len(a) >= 5 and len(b) >= 4 and allv.nunique() > 1:
            U, p = stats.mannwhitneyu(a, b, alternative="two-sided")
            r["mw_p"] = p
            r["rank_biserial"] = 2 * U / (len(a) * len(b)) - 1  # U counts winner>control pairs, so >0: winners higher
        ok = df[[c, "log_vpd"]].dropna()
        if len(ok) >= 8 and ok[c].nunique() > 1:
            rho, p = stats.spearmanr(ok[c], ok["log_vpd"])
            r["spearman_vpd"] = rho
            r["spearman_p"] = p
        out.append(r)
    st = pd.DataFrame(out)
    st.to_csv(REPORT / "stats.csv", index=False)

    # categorical
    cats = {}
    for c in ["hook_type", "bg_hex", "blue_bg_hex", "dominant_hex"]:
        if c in df:
            cats[c] = {g: df[df.group == g][c].value_counts().to_dict() for g in df.group.unique()}
    write_json(REPORT / "categorical.json", cats)
    formula = {r["feature"]: {"median": r["median_winners"], "p25": r["p25_winners"], "p75": r["p75_winners"]}
               for r in out if pd.notna(r["median_winners"])}
    write_json(REPORT / "formula.json", {"channel": sample["channel_url"], "n_winners": len(win), "n_control": len(ctrl),
                                         "targets": formula})
    charts(df, series)
    return df, st


def charts(df, series):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    C = {"hit": "#2a6fdb", "recent": "#1aa179", "control": "#d9822b"}
    out = REPORT / "charts"
    # camera profile of the two biggest videos
    for vid in df.sort_values("views", ascending=False).id.head(2):
        s = series.get(vid)
        if s is None:
            continue
        fig, ax = plt.subplots(2, 1, figsize=(10, 5), sharex=True)
        ax[0].plot(s.t, s.zoom_v, color="#2a6fdb"); ax[0].axhline(0, color="#999", lw=.5)
        ax[0].set_ylabel("zoom speed\n(log-scale / s)"); ax[0].set_title(df[df.id == vid].title.iloc[0])
        ax[1].plot(s.t, s.lat_v, color="#d9822b"); ax[1].set_ylabel("lateral speed\n(frame / s)"); ax[1].set_xlabel("seconds")
        fig.tight_layout(); fig.savefig(out / f"camera_{vid}.png", dpi=110); plt.close(fig)
    keys = ["wps", "shots_per_min", "shot_len_med", "hard_cut_share", "cam_static_pct", "cam_lateral_share", "cam_jerk_rms",
            "lufs", "bed_minus_voice_db", "sat_mean", "duration_s", "first_transition_s"]
    keys = [k for k in keys if k in df]
    fig, axes = plt.subplots(3, 4, figsize=(14, 9))
    for ax, k in zip(axes.flat, keys):
        for j, g in enumerate(["hit", "recent", "control"]):
            v = df[df.group == g][k].dropna()
            ax.scatter(np.full(len(v), j) + np.random.uniform(-.12, .12, len(v)), v, color=C[g], s=18, alpha=.8)
            if len(v):
                ax.hlines(v.median(), j - .25, j + .25, color=C[g], lw=2)
        ax.set_xticks([0, 1, 2], ["hits", "recent", "control"]); ax.set_title(k, fontsize=10)
    fig.tight_layout(); fig.savefig(out / "distributions.png", dpi=100); plt.close(fig)
    if "hook_type" in df:
        ct = pd.crosstab(df.hook_type, df.group)
        ax = ct.plot.barh(figsize=(8, 4), color=[C.get(c, "#888") for c in ct.columns])
        ax.set_title("Hook (first sentence) type by group"); plt.tight_layout(); plt.savefig(out / "hooks.png", dpi=100); plt.close()


def compare(vdir: Path):
    f, _ = video_features(vdir.name, {"group": "mine"}, vdir)
    lib = load_library() / WS.name / "formula.json"
    fj = read_json(lib if lib.exists() else REPORT / "formula.json")   # library once published, workspace while analysing
    if not fj:
        raise SystemExit(f"No formula for {WS.name}: neither {lib} nor {REPORT / 'formula.json'} exists.")
    rows = []
    for k, t in fj["targets"].items():
        v = f.get(k)
        if k in COMPARE_SKIP or v is None or not isinstance(v, (int, float)) or not np.isfinite(v):
            continue
        iqr = t["p75"] - t["p25"]
        if iqr <= 0:   # every strong video had the same value: a match or a plain miss, never "1e9 IQR"
            dist = 0.0 if v == t["median"] else 1.0
        else:
            dist = 0.0 if t["p25"] <= v <= t["p75"] else min(abs(v - t["p25"]), abs(v - t["p75"])) / iqr
        rows.append((dist, k, v, t["median"], t["p25"], t["p75"]))
    rows.sort(reverse=True)
    lines = ["| metric | mine | channel median | channel IQR | status |", "|---|---|---|---|---|"]
    for dist, k, v, med, lo, hi in rows:
        flag = "OK" if dist == 0 else ("WARN" if dist < 1 else "OFF")
        lines.append(f"| {k} | {v:.3g} | {med:.3g} | {lo:.3g}-{hi:.3g} | {flag} ({dist:.1f} IQR) |")
    txt = "\n".join(lines)
    (vdir / "delta.md").write_text(txt, encoding="utf-8")
    print(txt)
