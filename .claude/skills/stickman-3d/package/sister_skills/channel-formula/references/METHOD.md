# How the analyzer measures (what each stage does and why)

Modelled on the "every frame at native frame rate" breakdown of Zack D. Films (Mr omi, 0:59-3:13 of
https://www.youtube.com/watch?v=_fIoJ_ywGfY), then corrected where that method failed on real footage.

## Sample (`fetch`)
- Full flat listing of the format tab (`/shorts` or `/videos`) with yt-dlp; upload dates are interpolated between ~60
  exact-metadata anchors (the tab is newest-first), then every picked video gets exact metadata.
- **hit**: top N by raw views (the proven formula). **recent**: best views/day among the rest (format drift in new uploads).
  **control**: bottom quartile of views/day, matched by log-age to the hits. Videos younger than `--min-age` days are skipped.
- Download prefers h264 at the native frame rate (`-S vcodec:h264,res,fps`), remux only, plus subtitles and thumbnail.

## frames (every frame)
Per frame in `frames.parquet`: luma mean/p5/p95, contrast, saturation, sharpness (Laplacian variance), dominant and
border colour, mean abs diff and histogram distance to the previous frame.
Camera per frame pair:
- `cv2.phaseCorrelate` for translation (pan/tilt);
- Fourier-Mellin (log-polar FFT magnitude) for zoom/rotation;
- dense Farneback flow with an IRLS Huber-weighted similarity fit (`ds_scale`, `ds_dx`, `ds_dy`, `ds_rot`) as the zoom
  signal of record. Sparse Lucas-Kanade tracking was dropped: on smooth CGI it found 7-20 features and got zoom
  direction backwards.

## shots
Histogram-spike detector (spike > 0.20 and > 3x the local level) plus a window detector (W=6) for motion transitions.
Every candidate becomes a 9-frame strip in `bounds_sheet.jpg`. The detector over-fires on continuous camera flights
(about 60% of candidates on Zack D. Films were not transitions), so **Claude's labels in `vision.json` decide** which
candidates are real and what kind (VISION_REVIEW.md). Contact sheets taken every 2 s mislead about cuts: judge cuts from
the strips only.

## audio
EBU R128 via ffmpeg `ebur128` (integrated, LRA, true peak); Demucs htdemucs two-stem split (voice vs bed) for voice
LUFS, bed level under the voice and bed activity; librosa onsets on the bed stem (SFX hits/min, hits within 2 frames of a
transition); pyin pitch on the voice stem.

## script
faster-whisper `small.en` on the voice stem, word timestamps. Words/s overall, first 3 s, last 5 s; pauses; sentences;
Flesch-Kincaid grade; "you" usage; questions; first and last sentence. `hook_type` is rule-based on the first sentence
(if_you_hypothetical, in_medias_res, when_a_explainer, have_you_ever, imagine, what_if, question, command, ...).

## ocr
EasyOCR at 1 fps: share of runtime with on-screen text, words per caption, caption height and vertical position.

## report and statistics
`features.csv` (one row per video, ~90 columns). `stats.csv` per numeric feature: winners' median and 25-75th
percentile, control median, coefficient of variation, Mann-Whitney U with rank-biserial effect size (winners vs control),
Spearman rho against log views/day. With n of 20-35 these are **indicative, not proof**. `formula.json` = the winners'
median and IQR for every feature (what `compare` checks a new video against).

## Cost (16-core CPU, 34 Shorts of ~35 s)
Download ~10 min; frames+shots+audio+script ~45 min with 4 workers; OCR ~1 h at 1 fps; vision labelling ~20 min with
4-5 subagents in parallel. Long-form videos cost proportionally more per minute of footage: sample fewer of them.
