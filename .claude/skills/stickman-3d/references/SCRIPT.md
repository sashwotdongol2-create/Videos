# Script: writing, format, voice files

The user's scriptwriting standard ("Viral Shorts Scriptwriter & Visual Director") merged with the measured RicksClips
formula (`FORMULA.md` §1). Output the script in the format below and **wait for the user's approval** before voice.

## Story shape (formula, measured on 21 strong videos)
- **Hook** at 0 % — the absurd/high-stakes act already happening, 8–14 words, frame 0 mid-action. Templates:
  "[He/They] [did an absurd specific thing with a number]." · "[Rule] says X, yet [X everywhere]." ·
  second person "You're still [doing X] / [years] after…" (RicksClips "Imagine…" mode — the user likes it).
- **Setup / turn** ~24 % — "You see," + stakes, a doubter's quoted taunt, a "But…" complication.
- **Mechanism / escalation** ~59 % — it escalates, then the real reason ("You see / That's because…", everyday comparison).
- **Payoff** ~80 % — the big visual result. **Ending** ~94 % — one dry line; or a **loop bridge** into the first line.
- Long run-on sentences (~18 words, joined by and/but/so), reading grade ~6, at most one question, never end on a question.

## The user's archetype rules (Archetype B, "High-Stakes Drama", RicksClips)
- 3-layer hook in 0:00–0:03: spoken (no greeting, in medias res), visual (extreme close-up or motion on frame 1),
  on-screen text (3–5 words; optional — the channel normally shows only one-word captions, ask).
- Retention pulses at ~15 s and ~30 s (a pivot "But one by one…" or a curiosity loop "looking for three things: …").
- Pattern interrupt every 1.5–2.5 s: in a one-take film that is a camera move, reveal, light change or spike, not a cut.
- No filler words, no "like and subscribe"; the last line bridges into the first for a seamless loop.
- 35–50 s target; at the house pace of **180 WPM** that is ~105–150 words.
- Fact-check every claim; list the facts and their basis under the table.

## Output format (show this to the user)
```
### 1. CHANNEL ARCHETYPE & AUDIO SPECIFICATION
- Selected Archetype / Target WPM & Cadence / Vocal Tone / Est. Duration & Word Count
### 2. SCRIPT ANALYSIS & RETENTION MAP
- Opening Hook Type / 15s Retention Device / 30s device / Seamless Loop Bridge
### 3. PRODUCTION-READY 2-COLUMN AV SCRIPT
| TIMESTAMP & VISUAL DIRECTION (Shot, Motion, Text) | AUDIO / VOICE-OVER (TAVOC) & SE/BGM |
```
TAVOC marks: `/` 0.3 s micro-pause, `//` 0.6 s transition pause, `**CAPS**` vocal emphasis, `[Cue]` delivery at sentence start.

## Turning the approved script into voice files
- `voice/vo.txt` — plain narration, exactly the spoken words.
- `voice/vo_tags.txt` — the **same words in the same order**, plus eleven_v3 audio tags at sentence starts
  (`[energetic] [storytelling] [serious] [somber] [deadpan] [mocking] [surprised] [quiet] [slow]`) and key words in CAPS.
  Drop TAVOC slashes (pauses come from punctuation; `tighten_beats.py` keeps 0.25 s at sentence ends, 0.30 s after "…").
- `stickman3d.py voice --takes 2` generates both takes, tightens to 180 WPM, keeps the most expressive (pitch SD), writes
  `public/voice.wav` and `src/words.json` (captions use vo.txt spelling, so CAPS never reach the screen).
- Word counts must match between vo.txt and the take, or `voice` stops: fix the text, never the timings.

## Script guide discipline (Mr Miro, 2026-11-16)
- The guide is built from a channel's **hits AND flops** (10-15 hits, 5-10 flops, with views): every rule says how many
  hits / flops back it; rules from <= 3 clips are marked WEAK (FORMULA.md already contrasts 21 strong vs control videos).
- **Push back:** before writing or applying any change, check it against the guide. If the change goes against what
  worked in the hits, say so, ask whether the user is sure, and offer your own stronger option with the reason. Never
  just obey.
- Hook: frame 0 and the first sentence show the strangest moment; explain after. Tell the core mechanism ONCE.
- Fact-check every claim before voice: list what is wrong or uncertain and how to fix it.
- Learn structure and rhythm from references, never their stories or lines; downloaded clips stay local.

Implemented in the script skills (use them; this section only summarises them). channel-formula's FORMULA_draft.md
gives every rule a Backing column: "N hits / M flops" and a result. driver = hits differ from flops (p < 0.1,
|r| >= 0.3). "no measured difference (N hits / M flops; low power)" = no difference was found, which is not proof that
hits and flops are the same. constant = only a value identical in every hit and flop. "hits only" = no flop data.
WEAK = 3 clips or fewer. A flop-only pattern on 3 clips or fewer is a hint; one clip never makes a Don't. Beat starts
and art/backdrop rows are compared with the flops too, and the draft states how many rule rows are WEAK. rules.json
carries the same results (backing.kind driver / constant / no_difference / untested + low_power, beats[].flops / kind /
p, hook_types_flops_only); schema in `D:\resource\short-studio\studio\CONTRACT.md`. Formulas published before
2026-11-16 (zackdfilms, lowpolyshorts, ricksclips3000, theartofwarrr, fg-the-explainer) have no backing yet.
In viral-history-script, a user-confirmed change that breaks a BRIEF rule is a one-off exception for that script,
logged in the project's state.md; the rule itself changes only when the user explicitly says so. The fact check runs
in the history-researcher agent's "Fact-check mode" and writes review/factcheck_vN.md (claim table + Wrong / Not sure /
How to fix). The fresh-chat test of viral-history-script has not been run yet.
