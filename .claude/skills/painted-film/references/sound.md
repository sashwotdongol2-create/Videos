# Sound

No background music (the owner has removed it every time). A room tone from frame 0, voices, and a handful of effects.
Everything is mixed by measurement in `render.mjs` from `window.MIX`, then normalised to -14 LUFS.

## Voices (ElevenLabs eleven_v4, `make_vo.py`)

| Voice | ID | Used as |
|---|---|---|
| Brad | `Dslrhjl3ZpzrctukrQSN` | Narrator, all `[matter-of-fact]` |
| Will | `bIHbv24MWmeRgasZH58o` | Relaxed young man (Pablo) |
| Siren | `eXpIbVcVbLo8ZJQDlDnl` | Natural woman with personality (Madame X) |
| Laura | `FGY2WhTYpPnrIDTdsKH5` | Quirky, warm woman |
| Brielle | `6u6JbqKdaQy89ENzLSju` | Young, natural woman (the candidate) |
| Bill | `pqHfZKP75CvOlQylNhV4` | Older man (the interview panel) |
| Mark, Nate, Juniper, Kayley, Jawhny | in `cold-call-good-news/films.py` | more casual voices |

- Light tags only: `[casual]`, `[curious]`, `[matter-of-fact]`, `[laughs]`, `[flatly]`. No acted fear or excitement.
- Stability 0.4–0.5 for characters, 0.5 for narration; speed 1.05.
- Reuse an approved narrator take with `cut` entries (start/end from that film's `words.json`) rather than
  re-voicing: the owner already heard it.
- `make_vo.py` prints what speech-to-text heard for every line: read it. A take that drops a word is redone with
  `RETAKE=<id>`.

## Levels (dBFS)

| What | Level | How |
|---|---|---|
| Voice lines | -21 mean | `make_vo.py` |
| Room tone (`amb_office`, `amb_cafe`, `amb_restaurant`) | -44 to -47 mean | `beds` in MIX: `{file, from, to, mean}` |
| Effects | -18 (stamp) to -30 (slides) peak | `cues` in MIX: `{file, t, peak}` |

Never set an effect by a guessed multiplier: files differ by 50 dB (the library's `amb_restaurant` has a mean of
-55 dB, `tennis_bounce` peaks at -1 dB). The render measures each file and sets the gain.

## Effects

Shared library `sfx-library/`: `amb_cafe`, `amb_interview`, `amb_office`,
`amb_restaurant`, `coffee_machine`, `cricket` (the dead silence), `glass_clink`, `paper_slide`, `pen_tap`,
`tennis_bounce`, `tennis_hit`, `typing`.

Generated with `make_sfx.py` (prompts in `template/sfx.json`): whoosh, shatter, stamp, curtain, tear, flip. The API's
minimum is 0.5 s; very soft prompts ("a soft knock") come back near silent: check the printed peak and re-prompt.

Keep effects to the moments that matter (about one per transition, fewer is fine): the owner asked for fewer effects
before. Sound must start on frame 0.
