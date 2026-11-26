# channel-formula

A Claude Code skill that reverse-engineers a YouTube channel. It measures 20-35 of the channel's videos frame by frame at
their native frame rate, splits voice from music and SFX, transcribes every word with timestamps, runs the statistics,
and writes the channel's formula for script, camera, editing, sound and visuals as `FORMULA.md`.

## Install

```bash
git clone <this repo> ~/.claude/skills/channel-formula
python ~/.claude/skills/channel-formula/setup.py --home ~/channel-formula
```

- Needs Python 3.11 (or `uv`), ffmpeg on PATH and Node.js. The venv is about 3 GB (CPU torch, Demucs, faster-whisper,
  EasyOCR).
- `--home` is where each channel's videos, measurements and reports go. Use `--venv <dir>` to put the venv elsewhere.
- Check the install with `python ~/.claude/skills/channel-formula/tool/analyze.py doctor`.

## Use

In Claude Code:

```text
/channel-formula https://www.youtube.com/@somechannel
```

Claude runs the pipeline described in `SKILL.md`. You can also run it by hand:

```bash
A="python ~/.claude/skills/channel-formula/tool/analyze.py"
$A fetch https://www.youtube.com/@somechannel           # sample: 20 hits, 6 recent, 8 control; downloads
$A --ch somechannel analyze --workers 4                  # every frame, camera, shots, audio, transcript, OCR
$A --ch somechannel vision-todo                          # folders that need Claude's transition/beat labels
$A --ch somechannel report && $A --ch somechannel formula  # stats + FORMULA_draft.md with every number filled in
$A --ch somechannel compare my_video.mp4                 # my video vs the channel's ranges
```

## Layout

| Path | What |
|---|---|
| `SKILL.md` | the procedure Claude follows |
| `setup.py`, `requirements.txt` | one-time install (venv, models, `config.json`) |
| `tool/analyze.py`, `tool/ca/` | the analyzer: fetch, frames, shots, audio, script, ocr, report, formula |
| `references/METHOD.md` | how each stage measures, and why |
| `references/VISION_REVIEW.md` | the labelling brief for Claude subagents (transitions, beats, style) |
| `references/examples/zackdfilms/` | a finished formula (Zack D. Films, 34 Shorts) |
