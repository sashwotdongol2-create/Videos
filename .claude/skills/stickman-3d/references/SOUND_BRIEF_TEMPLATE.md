# SOUND BRIEF: {{FILM}} (stickman-3d, for the real-sound agent)

<!-- Copy to <project>/audio/SOUND_BRIEF.md, fill every {{FIELD}}, delete the example rows. The sound agent gets this
file verbatim together with the real-sound skill (its own templates/SOUND_BRIEF.md rules still apply: real recordings
only, licence audit, deterministic mixer). Worked example: package/examples/grave_bell/SOUND_BRIEF.md. -->

The picture is word-locked to the narration, not cut to a music grid: `{{VIDEO}}` (public/film.mp4; the draft is fine
for sync), {{FRAMES}} frames at 30 fps = {{SECONDS}} s, vertical 1080x1920. Narration: `public/voice.wav` with word
times in `src/words.json`; shots in `SHOT_FRAMES.txt` (`<id> <first frame> <end frame> <words>`).
Cue events: `out/cues.json` (real-sound format), written by `audio/make_cues.py` from word start/end times, shot
boundaries and the shot code where the picture decides timing (a contact frame, a hand reaching a prop). Re-run it
after any re-timing; never re-time a cue by hand.

## Deliverables
- `public/mix.wav`: 48 kHz stereo, exactly {{FRAMES}} frames long ({{FRAMES}} x 1600 samples), the voice unchanged
  inside it, mastered to -14 LUFS / <= -1 dBTP.
- `audio/stems/voice.wav, music.wav, sfx.wav, amb.wav` on the same time line and length as the mix (pre-master is
  fine): `stickman3d.py levels` fits them into the mix and measures exactly. Without stems it separates the voice
  itself (bed numbers within ~1 dB), but per-cue peaks then include the music.
- `CREDITS.md` + `out/CREDITS_description.txt` (real-sound `credits.py`), every source also in `ASSETS.md`.
- The levels report (below), pasted into the final message.

## The rules (the user's, every film)
1. **An effect on every important action and object, on the exact word.** The cue sits on the word that names the
   action (`W(i)` start, or the frame the picture shows the contact) - not "near" it. Important = what the story turns
   on (the bell, the shovel into dirt, the door that locks him in, the paper that proves it). Background business gets
   ambience, not one-shots.
2. **Camera moves: silent by default, scene by scene (merged 2026-11-19).** No automatic whoosh on camera moves or
   cuts, nothing on dissolves. A whoosh only where the shot asks for it (a whip pan, a fast fly-through into a new
   space, a big reveal flight, a punchline whip), planned per shot in PLAN.md's sound column with its reason, short,
   ducked under the voice, at most about one per 5 s.
2b. **Voice first (BUILD_LESSONS #40, #44).** Music ~14 dB and SFX ~12 dB under the voice with a 60 ms look-ahead; loud
   hits in the gaps between words; the music's biggest hit on the reveal word with ~0.3 s of silence before it;
   action sounds synced to the animation curves (wheel clicks from the angle curve), not just to words.
3. **Fuller sounds that ring out.** Real recordings with their natural tail: a bell that rings out, a door with its
   room, a shovel with the dirt settling. No 50 ms cheap clicks, no trims that chop the tail; fade the tail, do not cut
   it. One sound per object for the whole film (one bell, one door: a pool of takes of the SAME object, level jitter).
4. **Restraint.** About 3-5 designed effects per 10 s, more only in a busy action beat. Effects sit in word gaps
   where possible; an effect inside a word is 6 dB lower.
5. **Places.** One ambience bed per location (exterior wind, room tone, street), changing with the shot's place,
   crossfaded over the dissolve, never a loud single event inside a bed.
6. **Music.** One licensed instrumental track, edited at its own bar lines (the film is not on its grid), ducked under
   speech, a button / final chord on the last word, tail into silence by the last frame.
7. **The voice is the lead and stays unchanged** (no EQ, no compression, no re-timing). Never any audio from
   `ref/ref.mp4`.

## Levels against the voice (measured, not guessed)
| what | target | measured by `stickman3d.py levels` |
|---|---|---|
| mix integrated loudness | -14 LUFS (+-1) | BS.1770 gated |
| mix true peak | <= -1 dBTP | 4x oversampled |
| music / bed under the voice while it speaks | ~14 dB under (11-20) | K-weighted, gated, speech spans only |
| duck under speech | ~3 dB | bed in gaps vs the speech right next to them |
| loudest 100 ms outside speech | >= 6 dB under speech RMS | every 100 ms window outside speech |
| one-shots (per cue) | ~8 dB under the voice peak (-12..-4) | effect peak in [t-50 ms, t+750 ms] vs the voice's p99 10 ms peak |

Run `python <stickman-3d>/package/stickman3d.py levels` after every mix (it writes `out/qa/levels.json`;
`qa` runs it too). Fix every WARN or write why it is deliberate next to it ("buried on purpose: the bell is heard
through a window"). Paste the report here and in the final message:

```
{{LEVELS_REPORT}}
```

## Sound concept
<!-- 3-6 bullets: the one object sounds of the film, how place changes them (muffled through a window, -8 dB), the
music's character and where it rests, the ambience per place. -->
- **{{OBJECT}}.** {{one recording family, what it sounds like, its long/short takes}}
- **Places.** {{place -> ambience bed, frames}}
- **Music.** {{track character}}: enters {{t}}, rests on {{beat}}, button on "{{last word}}" ({{t}} s), tail to {{SECONDS}} s.

## Picture map (film seconds; cue ids from out/cues.json)
| t (s) | frame | word (index) | on screen | cue (kind / id) | sound need |
|---|---|---|---|---|---|
| 0.00-4.55 | 0-136 | - | dusk graveyard, gravedigger at the grave | amb | light autumn wind bed |
| 0.03 | 1 | (frame 0, hook) | the shovel bites the dirt | dig / dusk:shovel:dirt:0 | a real shovel into dirt, full tail |
| 2.21 | 66 | "bell" (9) | the brass bell on its cord | bell / dusk:bell:ting:0 | THE bell, one strike that rings out |
| 3.10 | 93 | - | camera arcs round the grave | (none) | nothing: camera move |
| 4.55 | 136 | - | dissolve to the diorama | (none) | nothing: the music carries the cut |

## Licences and credits
Allowed (read on the item's own page, recorded in the manifest): CC0 / public domain; CC BY 3.0 / 4.0 (credit in
CREDITS.md and the video description); Mixkit free licences; Pixabay Content License. Not allowed: NC, ND, SA,
Sampling+, personal-use, unclear or disputed licences, YouTube rips, AI-generated or synthesized audio, anything
behind a login. `audit.py` exit 0 for every file the mix uses; `credits.py` writes CREDITS.md and
out/CREDITS_description.txt; add each source to the project's ASSETS.md.

## What the sound agent returns
- public/mix.wav + audio/stems/ (same length as the film), the design files, CREDITS.md, out/CREDITS_description.txt;
- the `stickman3d.py levels` report with every WARN fixed or explained;
- real-sound `qa.py` result and an earshot `timeline` of the mix against out/cues.json (every cue heard on its word);
- a list of cues it left silent on purpose and why, and any cue it thinks the picture is missing.
