"""Channel listing, age-normalised sample selection (top + age-matched control group), download."""
from __future__ import annotations

import json
import os
import shutil
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime
from pathlib import Path

import numpy as np

from .util import CHANNEL_DIR, DATA, Status, ffprobe, log, read_json, run, write_json

TODAY = date.today()
META_KEYS = ["id", "title", "description", "upload_date", "timestamp", "duration", "view_count", "like_count",
             "comment_count", "channel", "channel_id", "channel_follower_count", "tags", "categories",
             "webpage_url", "thumbnail", "fps", "width", "height", "aspect_ratio", "language"]


def _tab(fmt: str) -> str:
    return "shorts" if fmt == "shorts" else "videos"


def listing(channel_url: str, fmt: str, refresh: bool = False) -> list[dict]:
    """Full flat video list (title, views, order) for one format tab. Cached in channel/listing_<fmt>.json."""
    path = CHANNEL_DIR / f"listing_{fmt}.json"
    if path.exists() and not refresh:
        d = read_json(path)
        if d.get("channel_url") == channel_url:
            return d["entries"]
    url = channel_url.rstrip("/") + "/" + _tab(fmt)
    log.info("Listing %s (yt-dlp --flat-playlist) ...", url)
    out = run(["yt-dlp", "--flat-playlist", "-J", "--no-warnings", url], timeout=1800).stdout
    d = json.loads(out)
    entries = []
    for i, e in enumerate(d.get("entries") or []):
        entries.append({"idx": i, "id": e["id"], "title": e.get("title"), "view_count": e.get("view_count"),
                        "duration": e.get("duration"), "upload_date": e.get("upload_date")})
    write_json(path, {"channel_url": channel_url, "channel": d.get("channel"), "channel_id": d.get("channel_id"),
                      "fmt": fmt, "fetched": datetime.now().isoformat(timespec="seconds"), "entries": entries})
    log.info("Listing: %d %s", len(entries), fmt)
    return entries


def video_meta(vid: str) -> dict | None:
    """Exact public metadata for one video, cached in channel/meta_cache/<id>.json."""
    cache = CHANNEL_DIR / "meta_cache" / f"{vid}.json"
    if cache.exists():
        return read_json(cache)
    for attempt in range(3):
        try:
            out = run(["yt-dlp", "-J", "--skip-download", "--no-warnings", f"https://www.youtube.com/watch?v={vid}"],
                      timeout=180).stdout
            d = json.loads(out)
            m = {k: d.get(k) for k in META_KEYS}
            m["fetched"] = datetime.now().isoformat(timespec="seconds")
            write_json(cache, m)
            return m
        except Exception as ex:  # noqa: BLE001
            log.warning("meta %s attempt %d failed: %s", vid, attempt + 1, str(ex)[:200])
            time.sleep(3 * (attempt + 1))
    return None


def _import_legacy_meta() -> None:
    """Reuse metadata records an earlier run saved in metadata/ (full yt-dlp dumps)."""
    legacy = CHANNEL_DIR.parent / "metadata"   # full yt-dlp dumps an older run may have left in the workspace
    if not legacy.exists():
        return
    for p in legacy.glob("*.json"):
        dst = CHANNEL_DIR / "meta_cache" / p.name
        if dst.exists():
            continue
        try:
            d = read_json(p)
            m = {k: d.get(k) for k in META_KEYS}
            m["fetched"] = "legacy"
            write_json(dst, m)
        except Exception:  # noqa: BLE001
            pass


def _age_days(upload_date: str) -> int:
    d = datetime.strptime(upload_date, "%Y%m%d").date()
    return max((TODAY - d).days, 1)


def census_sizes(n: int, n_recent: int) -> tuple[int, int, int]:
    """(hits, recent, control) when a channel has too few videos to sample: every video is used, at least 2 hits."""
    if n < 5:
        raise SystemExit(f"Only {n} eligible videos (older than --min-age days): too few to find a formula.")
    n_ctrl = min(max(3, round(n * 0.25)), n - 3)
    n_rec = min(n_recent, max(1, (n - n_ctrl) // 4))
    return n - n_ctrl - n_rec, n_rec, n_ctrl


def select_sample(channel_url: str, fmt: str = "shorts", n_hits: int = 20, n_recent: int = 6, n_ctrl: int = 8,
                  min_age_days: int = 30, n_anchors: int = 60, refresh: bool = False, keep: set | None = None) -> list[dict]:
    """Three groups:
      hits    - all-time most viewed (raw views). This is the proven formula and matches the reference cohort.
      recent  - best views/day among videos NOT in hits (catches format drift in newer uploads).
      control - bottom quartile of views/day, nearest log-age match to each hit/recent video.
    The listing has views but no dates; dates are interpolated between ~60 anchors with exact metadata
    (the Shorts tab is newest-first). Every picked video then gets exact metadata.
    """
    out_path = CHANNEL_DIR / f"sample_{fmt}.json"
    if out_path.exists() and not refresh:
        d = read_json(out_path)
        if d.get("channel_url") == channel_url:
            return d["videos"]
    _import_legacy_meta()
    entries = [e for e in listing(channel_url, fmt, refresh) if e.get("view_count")]
    for i, e in enumerate(entries):
        e["idx"] = i   # position in the full newest-first listing (date interpolation uses it)
    if keep:   # topic subset (e.g. only history videos): anchors still come from the full listing
        all_entries, entries = entries, [e for e in entries if e["id"] in keep]
        log.info("Topic filter: %d of %d videos kept", len(entries), len(all_entries))
    else:
        all_entries = entries
    N = len(all_entries)
    anchor_idx = sorted(set(np.linspace(0, N - 1, n_anchors).round().astype(int).tolist()))
    log.info("Fetching %d anchor metadata records for upload-date interpolation ...", len(anchor_idx))
    with ThreadPoolExecutor(4) as ex:
        metas = list(ex.map(lambda i: video_meta(all_entries[i]["id"]), anchor_idx))
    xs, ys = [], []
    for i, m in zip(anchor_idx, metas):
        if m and m.get("upload_date"):
            xs.append(i)
            ys.append(_age_days(m["upload_date"]))
    if len(xs) < 5:
        raise SystemExit("Could not fetch enough anchor metadata to estimate upload dates.")
    ys_mono = np.maximum.accumulate(np.array(ys, dtype=float))
    for e in entries:
        e["age_est"] = float(np.interp(e["idx"], xs, ys_mono))
        e["vpd_est"] = e["view_count"] / e["age_est"]
    elig = [e for e in entries if e["age_est"] >= min_age_days]

    def exact(e):
        m = video_meta(e["id"])
        if not m or not m.get("upload_date"):
            return None
        return {**e, **_exact(m, _age_days(m["upload_date"]))}

    census_ctrl = None
    if len(elig) <= n_hits + n_recent + n_ctrl:
        # Small channel: measure every eligible video. Bottom quarter by views/day = control; of the rest, the best
        # views/day outside the top by views = recent; everything else = hits.
        n_hits, n_recent, n_ctrl = census_sizes(len(elig), n_recent)
        census_ctrl = sorted(elig, key=lambda e: e["vpd_est"])[:n_ctrl]
        cids = {e["id"] for e in census_ctrl}
        elig_top = [e for e in elig if e["id"] not in cids]
        log.info("Small channel (%d eligible): census, %d hits / %d recent / %d control", len(elig), n_hits, n_recent, n_ctrl)
        elig = elig_top
    hits_c = sorted(elig, key=lambda e: -e["view_count"])[:n_hits]
    with ThreadPoolExecutor(4) as ex:
        hits = [r for r in ex.map(exact, hits_c) if r]
    hit_ids = {h["id"] for h in hits}
    rec_c = sorted([e for e in elig if e["id"] not in hit_ids], key=lambda e: -e["vpd_est"])[: n_recent * 2 + 4]
    with ThreadPoolExecutor(4) as ex:
        rec = [r for r in ex.map(exact, rec_c) if r and r["age_days"] >= min_age_days]
    rec = sorted(rec, key=lambda r: -r["vpd"])[:n_recent]
    chosen = hits + rec
    if census_ctrl is not None:
        with ThreadPoolExecutor(4) as ex:
            ctrl = [r for r in ex.map(exact, census_ctrl) if r]
        n_ctrl = 0   # skip the age-matched pick below
    q25 = float(np.percentile([e["vpd_est"] for e in elig], 25))
    bottom = [e for e in elig if e["vpd_est"] <= q25]
    if census_ctrl is None:
        ctrl = []
    used = set()
    targets = sorted(chosen, key=lambda r: r["age_days"])
    step = max(1, len(targets) // max(n_ctrl, 1))
    for t in targets[::step] if n_ctrl else []:
        if len(ctrl) >= n_ctrl:
            break
        pool = [b for b in bottom if b["id"] not in used and b["id"] not in {c["id"] for c in chosen}]
        if not pool:
            break
        b = min(pool, key=lambda b: abs(np.log(b["age_est"]) - np.log(t["age_days"])))
        used.add(b["id"])
        r = exact(b)
        if r:
            ctrl.append(r)
    vids = []
    for g, rows in (("hit", sorted(hits, key=lambda r: -r["views"])), ("recent", rec), ("control", sorted(ctrl, key=lambda r: r["vpd"]))):
        for rank, r in enumerate(rows, 1):
            vids.append({**_slim(r), "group": g, "rank": rank})
    write_json(out_path, {"channel_url": channel_url, "fmt": fmt, "created": datetime.now().isoformat(timespec="seconds"),
                          "method": {"hit": f"top {n_hits} by raw views", "recent": f"top {n_recent} by exact views/day, not in hits",
                                     "control": f"{n_ctrl} from bottom quartile of est. views/day, log-age matched",
                                     "min_age_days": min_age_days, "anchors": len(xs), "listing_n": N, "bottom_quartile_vpd": q25,
                                     "topic_filter_n": len(entries) if keep else None},
                          "videos": vids})
    return vids


def _exact(m: dict, age: int) -> dict:
    v = m.get("view_count") or 0
    return {"title": m.get("title"), "upload_date": m["upload_date"], "age_days": age, "views": v, "vpd": v / age,
            "likes": m.get("like_count"), "comments": m.get("comment_count"), "duration": m.get("duration")}


def _slim(r: dict) -> dict:
    keys = ["id", "title", "upload_date", "age_days", "views", "vpd", "likes", "comments", "duration", "idx"]
    return {k: r.get(k) for k in keys}


def download(v: dict) -> Path:
    """Best-quality original streams (remux only, no re-encode), subtitles, thumbnail, meta.json."""
    vid = v["id"]
    vdir = DATA / vid
    vdir.mkdir(parents=True, exist_ok=True)
    st = Status(vdir)
    video = vdir / "video.mp4"
    if st.done("download") and video.exists():
        return vdir
    t0 = time.time()
    url = f"https://www.youtube.com/watch?v={vid}"
    if not video.exists():
        log.info("[%s] downloading best quality ...", vid)
        tmpl = str(vdir / "video.%(ext)s")
        run(["yt-dlp", "-f", "bv*+ba/b", "-S", "vcodec:h264,res,fps", "--merge-output-format", "mp4", "--no-warnings", "--no-playlist",
             "-o", tmpl, url], timeout=3600)
        if not video.exists():  # some merges keep another extension; remux without re-encoding
            other = next((p for p in vdir.glob("video.*") if p.suffix in (".mkv", ".webm")), None)
            if other:
                tmp = video.with_suffix(".tmp.mp4")
                run(["ffmpeg", "-y", "-v", "error", "-i", other, "-c", "copy", tmp])
                os.replace(tmp, video)
                other.unlink()
    try:
        run(["yt-dlp", "--skip-download", "--write-subs", "--write-auto-subs", "--sub-langs", "en.*,en",
             "--sub-format", "json3", "--write-thumbnail", "--convert-thumbnails", "jpg", "--no-warnings",
             "-o", str(vdir / "yt"), url], timeout=300, check=False)
    except Exception as ex:  # noqa: BLE001
        log.warning("[%s] subtitles/thumbnail: %s", vid, ex)
    probe = ffprobe(video)
    exact = read_json(CHANNEL_DIR / "meta_cache" / f"{vid}.json") or video_meta(vid) or {}
    write_json(vdir / "meta.json", {"id": vid, "url": url, "sample": v, "youtube": exact, "probe": probe})
    st.mark("download", time.time() - t0, bytes=probe["size_bytes"])
    log.info("[%s] %dx%d %.3f fps %s, %d frames, %.1fs", vid, probe["width"], probe["height"], probe["fps"],
             probe["vcodec"], probe["n_frames"], probe["duration"])
    return vdir


def prepare_local(video_path: Path, name: str | None = None) -> Path:
    """Set up a data folder for a local video (compare mode)."""
    import hashlib
    video_path = Path(video_path).resolve()
    h = hashlib.sha1(f"{video_path}:{video_path.stat().st_size}:{video_path.stat().st_mtime}".encode()).hexdigest()[:8]
    vdir = video_path.parent / "_compare" / f"{name or video_path.stem}-{h}"   # beside the video: works after clean
    vdir.mkdir(parents=True, exist_ok=True)
    dst = vdir / "video.mp4"
    if not dst.exists():
        if video_path.suffix.lower() == ".mp4":
            try:
                dst.hardlink_to(video_path)
            except OSError:
                shutil.copy2(video_path, dst)
        else:
            tmp = dst.with_suffix(".tmp.mp4")
            run(["ffmpeg", "-y", "-v", "error", "-i", video_path, "-c", "copy", tmp])
            os.replace(tmp, dst)
    st = Status(vdir)
    if not st.done("download"):
        probe = ffprobe(dst)
        write_json(vdir / "meta.json", {"id": vdir.name, "url": str(video_path), "sample": {"group": "mine"},
                                        "youtube": {"title": video_path.stem}, "probe": probe})
        st.mark("download", 0)
    return vdir
