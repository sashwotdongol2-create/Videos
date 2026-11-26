# SOUND BRIEF: "What the Grave Bell Really Meant" soundtrack from real recordings

The picture is word-locked to the narration: 2342 frames at 30 fps = 78.067 s, vertical 1080x1920. It is NOT cut to a
music grid, so the music plays at its own tempo (Kevin MacLeod "Marty Gots a Plan", 140.0 BPM, bar = 1.714 s) and is
edited at its own bar lines / phrase breaks. Cue events: `out/cues.json`, written by `audio/make_cues.py` from
`src/bell_words.json` (word start/end) and `SHOT_FRAMES.txt` (shot boundaries), plus the picture code where it decides
timing (rocking chair `parlour.ts rocking()`, coffin hand-bell `f % 16`). Never re-time cues by hand.

Voice: `public/voice.wav` (ElevenLabs narration, 77.2 s) is the lead and stays unchanged. Effects sit in word gaps
where possible; the music bed sits about 19.5 dB under the voice and is ducked under speech.

Only real, professionally recorded audio: one licensed music track, real foley, real field ambiences. Code only
selects, trims, places, levels, pans, EQs, pitches by resampling and masters. Nothing synthesized. Never any audio
from `ref/ref.mp4`.

## Sound concept
- **One bell.** THE grave bell is one small brass hand bell (Freesound 767307, crisp strikes, partials ~2.1 / 4.5 /
  6.3 kHz): every graveyard / signal / garden ring is a strike of it, a pool of 7 takes cycled with level jitter. Its
  "long" is the take with the free ring-out. The husband's own hand-bell in the coffin flashback is a different,
  drier hand bell being shaken (503134) - a different object.
- **Muffled by place.** Outside at night: full. Through the bedroom window: low-passed ~2.2 kHz, -8 dB. Heard from
  the parlour: low-passed ~5 kHz, a little down. The signal "Three short, one long" is clear and the loudest bell.
- **Music.** Sneaky pizzicato / marimba comedy-mystery (G minor). Plays from the top; its own near-silent bar
  (src 46.3-48.0) lands on "Hold on, rehearsed?" (46.97-48.03) where the sting sits; it re-enters on the flashback
  at 48.0 and lifts there; it phrase-ends at ~60.1 when we return to the night parlour, so the bell carries "fast,
  then slow, then once every few minutes" with no music; the coda re-enters at sunrise and its final button lands
  on "alone." (76.45), tail to silence by 78.07.
- **Restraint.** Foley only where the picture has a cause; small, dry, centred; ambience beds per place.

## Picture map (film seconds; cue ids from out/cues.json)
| t (s) | on screen | cue | sound need |
|---|---|---|---|
| 0.0-4.55 | dusk graveyard, gravedigger, grave, cord to brass bell | amb | light autumn wind bed |
| 0.03 | gravedigger's shovel | dig / dusk:shovel:dirt:0 | a shovel into dirt on frame 0 |
| 2.21 | "bell" (word 9) | bell / dusk:bell:ting:0 | one small brass ting |
| 2.64 | after "cord" | creak / dusk:cord:creak:0 | cord / rope creak |
| 4.55-14.5 | cross-section diorama | - | music only (comic, light) |
| 10.58, 10.91 | "small bell" | bell / dio:bell:ting:0-1 | two tiny tings (+5 st: miniature) |
| 14.5-36.9 | night snow (graveyard, street, porches, doctor, wife's house) | amb | winter wind + snow bed |
| 15.47-17.4 | "bell starts going" | bell / night:bell:start:n | the bell starts: 5 pulls ~0.5 s apart |
| 17.63-20.6 | attic bedroom, candle | bell / night:bell:muffled:n + amb | candle room tone; wind muffled; bell through the window every ~0.9 s |
| 21.16-27.75 | "Then it gets FASTER" through the porch argument | bell / night:bell:fast:n | pulls every ~0.27 s, low; strikes inside words 6 dB lower |
| 24.55, 26.0 | porch lanterns | creak / porch:lantern:0-1 | metal handle squeak |
| 24.4-27.8 | porches | amb | low exterior murmur |
| 27.8-29.6 | woman drags the doctor through snow | drag + step / street:* | body drag scrape + snow steps |
| 28.1-36.9 | street, doctor, wife's house | bell / night:bell:far:n | distant pulls ~1.1 s apart, gaps only |
| 32.86 | "paper" (word 108) | paper / doctor:paper:0 | paper rustle |
| 36.93-48.17 | parlour night | amb + creak / parlour:chair:n | quiet room tone; slow rocking-chair creaks on the picture's forward extremes |
| 39.66 | MCU with teacup | clink / parlour:teacup:0 | one teacup clink |
| 41.84, 42.06, 42.28, 43.62 | "Three short, one long" | bell / parlour:signal:* | three quick strikes, one long ring (~1.2 s) |
| 47.30 | "rehearsed?" (camera spike) | sting / parlour:rehearsed:0 | tiny comedic sting (real jaw-harp boing) in the music's own silent bar |
| 48.17-60.1 | sunny flashback (coffin in parlour, garden) | amb | summer birds / day; music lifts |
| 48.53, 49.07, 49.6 | his hand-bell (f % 16) | handbell / flash:handbell:* | dry shaken hand-bell |
| 49.1, 52.27 | IOUs, death certificate | paper / flash:* | paper |
| 55.66 | "that bell rang," | bell / flash:garden:ting:0 | one ring |
| 57.95, 58.37, 58.34 | "dig him out" | dig / burst | shovel digs, dirt burst |
| 60.1-67.53 | night parlour, rocking all night | bell / late:bell:* + amb | steady rings ~0.6 s, "fast" burst (5 x 0.13 s), "slow" (2 x 0.86 s), last ring 67.30; music out |
| 67.53-78.07 | sunrise graveyard, wife on the mound | amb | winter morning ambience; the bell is silent after "quiet" |
| 71.33 | bluebird | chirp / dawn:bird:0 | one bird chirp |
| 73.52 | "went under" | dig / dawn:snowshovel:0 | shovel into snow |
| 76.45 | "alone." | button / dawn:alone:0 | the music's final button; tail to silence |

## Licences
Allowed: CC0 1.0, CC BY 3.0/4.0 (credited), Mixkit free licences, Pixabay. Forbidden: NC, ND, SA, Sampling+, custom,
disputed, unverified. Every licence read on the item's own page in this session (`audio/assets/manifests/`).

## Quality bar
Real recordings only (earshot `realness` checked), clean trims (no cut attacks, no chopped decays), no clicks,
integrated -14 LUFS, true peak <= -1.5 dBTP, the bed ~19.5 dB under the voice, effects in word gaps where possible.

## Files
`audio/assets/<cat>/` recordings (do not publish), `audio/assets/manifests/` (sources + audit),
`audio/sounddesign.json` + `audio/design/*.json` (the design), `audio/make_cues.py` -> `out/cues.json`,
`audio/final_mix.py` (voice + bed + master -> `public/mix.wav`), stems in `audio/stems/`, `CREDITS.md`.
