---
name: channel-formula
description: Analyse a YouTube channel scientifically (20-35 videos measured frame by frame at native fps, voice/bed/SFX split, word-level transcripts, statistics) and write its formula for script, camera, editing, sound and visuals as report/FORMULA.md. Use when the user gives a channel URL to analyse, asks for a channel's "formula", wants to reverse-engineer how a channel makes its videos, or wants their own video measured against a channel (compare / delta).
argument-hint: "<channel_url> [shorts|videos]"
---

# Channel formula

Reusable tool, nothing to write from scratch: every stage is a command of `<skill>/tool/analyze.py` (`<skill>` = this
skill's folder). The tool re-runs itself inside the skill's venv, so any `python` can launch it. One workspace per
channel: `<home>/<handle>/` (`data/<id>/` per video, `channel/`, `report/`); `<home>` is in `<skill>/config.json`.
How each stage measures: [references/METHOD.md](references/METHOD.md). A finished formula to match:
[references/examples/zackdfilms/FORMULA.md](references/examples/zackdfilms/FORMULA.md).

`$ARGUMENTS` = channel URL, optionally a format (`shorts` default, `videos` for long-form). If the URL is empty, ask for it.
`A = python <skill>/tool/analyze.py` below; `<handle>` is the channel's @name, lower-case (fetch prints the workspace).

## User rules
- The deliverable is the formula itself. Leave out comparisons with other channels and "how my video differs" sections
  unless asked.
- The user wants it fast: run long stages in the background, label vision with parallel subagents while analysis runs,
  and post progress with numbers (`A --ch <handle> status`) during long waits.

## Steps
1. **Ready.** `A doctor`. If it is not `ready`, run `python <skill>/setup.py` (add `--home <dir>` for where workspaces
   go, `--venv <dir>` to reuse an existing venv) and re-run doctor. Done when doctor prints `ready`.
2. **Sample and download.** `A fetch <url> [--fmt videos]` in the background (default 20 hits, 6 recent, 8 control;
   long-form: `--hits 12 --recent 4 --control 6`). Done when the sample table is printed and `status` shows
   `download n/n` (re-run fetch for failures; it skips finished videos).
3. **Pilot.** `A --ch <handle> analyze --only <id1> <id2>` on the two biggest hits (an ID starting with `-` goes in a
   file: `--ids-file`). Read `data/<id>/contact_sheet.jpg` and `bounds_sheet.jpg`. Check that the camera direction in
   `frames.parquet` (`ds_scale` > 1 = pushing in) and the cut candidates match what is on screen. Done when both pilots
   match; a mismatch is a pipeline problem: fix it before the full run.
4. **Measure everything.** `A --ch <handle> analyze --workers 4` in the background (resumable; `--stages` to re-run one
   stage). Done when `status` shows every stage at n/n.
5. **Vision labels (in parallel with step 4).** `A --ch <handle> vision-todo` lists the folders whose shots stage is
   done. Give subagents 5-7 folders each with the brief "Follow <skill>/references/VISION_REVIEW.md for each folder:
   read its contact_sheet.jpg, bounds_sheet.jpg, transcript.json and meta.json, write vision.json there". Repeat as more
   videos finish. Done when `vision-todo` prints 0.
6. **Statistics.** `A --ch <handle> report`, then `A --ch <handle> formula`. Done when `report/FORMULA_draft.md` exists
   with every table filled.
7. **Write the formula.** Copy the draft to `report/FORMULA.md` and fill every `<!-- WRITE: ... -->` marker from the
   evidence: `data/<id>/transcript.json` (real opening lines, story shapes), `vision.json` (beats, transitions,
   notes), `stats.csv` (what the strong videos do differently from the control group), `charts/`. Write rules as
   templates with real examples, the way the Zack D. Films example does. Keep only sections the user asked for. Done when
   no `WRITE` marker remains and every rule carries a number or a counted example.
8. **Deliver for approval.** Link `report/FORMULA.md`, list the supporting files (`features.csv`, `stats.csv`,
   `formula.json`, `charts/`), give the 5-8 rules that define the channel in a few lines, and ask the user to approve
   it. Done when the user approves or asks for changes (apply them and ask again).
9. **Publish and clean.** On approval: `A --ch <handle> publish`. This copies the formula to the library (`library` in
   config.json, e.g. `D:\resource\short-studio\studio\formulas\<handle>\`), adding `rules.json`, the strong videos' transcripts in
   `style/`, and `approved.json`. Then `A --ch <handle> clean` shows the size of the whole workspace it would delete
   (`<home>/<handle>/`: videos, per-frame data, labels; the formula stays in the library). Tell the user that figure and run `clean --yes` only after they confirm. Done when
   `approved.json` exists in the library.

A formula that is already in the library (`<library>/<handle>/approved.json`) is ready: skip steps 2-9 and use it.
The library's `rules.json` is what the script and video skills read (schema: `D:\resource\short-studio\studio\CONTRACT.md`).

## Compare a video against the formula
`A --ch <handle> compare <video.mp4>` runs the same pipeline on a local video and writes `delta.md` in
`<video dir>/_compare/<name>-<hash>/`: each metric against the library formula's IQR (the workspace report while the channel
is still unpublished), sorted by how far off it is. It works after `clean`. Fix the furthest metrics first, re-render, compare again.

## Gotchas
- IDs that start with `-` break argparse: pass them with `--ids-file`.
- More than 3 workers without thread caps grind to a halt; `--workers` caps threads per worker for you.
  Run one analysis at a time on the machine.
- yt-dlp needs Node (or Deno) for YouTube's JS challenge; a 403 or "nsig" error means updating yt-dlp in the venv.
- Captions in the reference video can be wrong: one claimed −5 LUFS for Zack D. Films, and the measured value was −11.
  Trust the measurement.
- Hook types are rule-based English patterns; for other languages, classify the opening lines yourself from the
  transcripts.
