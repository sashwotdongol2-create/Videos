# PLAN — "What the Grave Bell Really Meant" replica (planned by Fable, executed by Opus)

Root: `D:\resource\stickman\grave_bell\`. 1080x1920, 30 fps, own narration, one-word captions.

## Amendments by the executor (house rules from memory)
- **Voice:** ElevenLabs **Brian** (house voice), eleven_v3 energetic recipe (`short-studio/work/voice/titanic-lifeboat-1/v3/gen_v3.py`), not edge-tts.
- **Pace:** house rule is **~180 WPM** (user found 222 too fast, 2026-11-05). The video runs ~73 s instead of 59.5 s; every shot is word-locked, so the reference shot ORDER and relative proportions are kept and durations scale.
- Captions ON (replica of the reference; the cartoon-3d-short "no captions" rule was project-specific).

## 0. Found on disk
- Base project: `D:\resource\rail-gap-short\` (src\videos\rail: Rail.tsx, story.ts, cast.ts, toon.ts, sets.ts, fx.ts, kit.ts, ink.ts, lensblur.ts, grade.ts; scripts: rail-stills.mjs, sbs_sheet.py, short_qa.py).
- Character painter: `D:\resource\ricks-toon-lab\src\engine\characters\drawCharacter.ts` (24 expressions, 12 poses, bun hair, glasses, moustache, stripes, shovel/lantern/bell props, blink, mouthOpen, walkPhase). Also reuse `captions\Captions.tsx`, `camera\rig.ts`.
- Assets: `D:\resource\lowpoly\assets\kenney\furniture-kit`, `city-kit-suburban` (only non-PSX ones fit).
- SFX helper `D:\resource\eylau-short\audio\sfx_lib.py`; review `D:\resource\lowpoly\tools\review.py --replica`.

## 1. Architecture
Blender 5.3 builds + bakes sets (Cycles diffuse lightmaps per time-of-day state) → GLB + lightmap PNG → three.js in Remotion renders everything (MeshBasic + baked map; cards unlit + per-shot tint, NOINK layer). Post: ink → lensblur → bloom (thr 1.0, str ~0.6) → grade (saturation, violet vignette #706875). Snow = THREE.Points. Dissolves = two render targets mixed over 9 frames. Captions = Remotion DOM overlay. Fallback if bakes fail: three.js two-tone shade.ts + point lights.

## 2. Shot list (reference times; ours are word-locked)
| # | Ref s | Set / light | Picture | Camera / transition | Words |
|---|---|---|---|---|---|
| 1 | 0.0–0.7 | Graveyard dusk | Husband grinning standing in open grave, gravedigger right, bell post, teal A-frame house, fence | frame 0 mid-action, medium | A living man |
| 2 | 0.7–2.5 | same | top-down into grave: open coffin lilac lining, husband smug, candy-stripe cord | spike crane down, push CU | went into the ground … bell cord |
| 3 | 2.5–4.0 | same | follow cord up to brass bell on post, plaque S. HOLT | tilt-up follow; X starts | around his finger. You see, |
| 4 | 4.0–8.5 | cross-section diorama | teal theatre frame, 6 bell posts, soil layers, coffin w/ pyjama corpse, water band, giant nightcap face peeking | X; slow push; corpse expr swaps | people were so terrified … small bell above it, |
| 5 | 8.5–10.0 | same | down cord to finger knot | push spike down | cord … dead man's finger. |
| 6 | 10.0–13.0 | graveyard night snow | match-dissolve post; bell swings, snow cap falls; lit teal house | X same framing, push, drift right | But when this bell starts going at two in the morning, |
| 7 | 13.0–16.0 | attic bedroom candle | nightcap neighbour sits up annoyed, shrugs, lies back | X through window; push | the neighbour rolls over and blames the wind. |
| 8 | 16.0–17.0 | same | CU eye pops open; window shows bell | spike in | Then it gets faster, |
| 9 | 17.0–18.5 | snow street night | two rows coloured houses, mansion, pines; lights switch on | X; high wide slow push | the whole street … porches |
| 10 | 18.5–22.0 | porch lanterns | red-coat man (shovel, sweat), green-shawl woman (lantern); nightcap neighbour next porch | X; MS push; mouth flaps; ring-eyes end | saying, you go look. No, you go look. |
| 11 | 22.0–23.7 | street, A. HALE PHYSICIAN | woman drags doctor by leg through snow | X; wide slow push | Somebody hauls the doctor out of bed, |
| 12 | 23.7–27.7 | snow, cream facade, lanterns in snow | doctor sits in snow eyes shut; holds certificate + $20 | X; push MCU; spike on cert | bodies twitch, he's dead, I signed that paper myself. |
| 13 | 27.7–29.5 | wife's purple house night | dark bay window; lantern neighbours at edge | X; fast push to window | But one porch is empty: his wife's. |
| 14 | 29.5–31.3 | parlour night moon | wide: wife in rocking chair, tea table, rug; pan right to shovel by door | zoom-through window; pan right | She's sitting in the dark with a shovel by the door, |
| 15 | 31.3–34.5 | same | MCU→CU wife half-lid, moon stripe, teacup | push | because she knows that ring. Three short, one long, |
| 16 | 34.5–37.0 | same wall | practice bell, note "• • • — = Dig" w/ heart, tally dots on door frame | pan right, push; spike on 2nd "rehearsed" | the exact signal they rehearsed. Hold on, rehearsed? Well, |
| 17 | 37.0–39.0 | same room sunny flashback | husband in coffin on sawhorses ringing handbell, grinning; tossing IOUs | X relight same framing; push | he never died at all. |
| 18 | 39.0–40.0 | sunny garden | queue of creditors down path, veg bed, sunflowers | X; high wide | Half the town had lent him money, |
| 19 | 40.0–41.2 | insert | death certificate S. HOLT held by smug husband, $20 clipped | X; pull-out | so he faked his own death, |
| 20 | 41.2–42.0 | garden bed | CU husband buried to nose among cabbages | HARD CUT (only one) | and the moment that bell rang, |
| 21 | 42.0–45.5 | garden by purple house | rehearsal: wife digs, he bursts out, clods; pan left to shovel + WEST sign | glide, pan left | she was supposed to grab the shovel, dig him out and leave town with him. |
| 22 | 45.5–47.0 | parlour night | CU unused shovel by door | X | Instead, she just |
| 23 | 47.0–52.7 | same | wide rocking → CU → MS sipping, one eye opens → rise to high wide, fade to dawn pink | push, push, pull-out+rise | sits there all night … once every few minutes, |
| 24 | 52.7–54.0 | graveyard sunrise | CU still bell, snow cap, peach sky | X; slow push | until sunrise, when it finally goes quiet. |
| 25 | 54.0–59.5 | same | wife on snowy mound w/ shovel, bluebird; drops IOUs, shovels snow over them, smug half-lid, house + chimney smoke | pull-out, slow push on face | You see, with him under the ground, every debt went under with him, and the house belonged to her alone. |

DOF cInf (px @1080): CU 14, MS 10, wide 0.

## 3. Cast (all new cards; port drawCharacter.ts → src\videos\bell\char.ts)
- Husband S. Holt: ginger side-part hair #E0662B, ginger handlebar moustache, black suit + lapels, white shirt, tie. smug/grin/evil/sleepy; stand, lie, hold(bell, cert), buried head, burst.
- Wife: black-grey striped hair + top bun, plum high-collar long dress w/ buttons (new dress torso). bored half-lid default, sleepy, one-eye-open, smug; sit-rock, stand, hold shovel, dig, sip.
- Nightcap neighbour: white/red-stripe nightcap w/ pom, striped nightshirt; angry, neutral, sleepy, shocked, scared.
- Red-coat man: bald, black side tufts, black moustache, red buttoned coat, shovel; nervous+sweat, talkO, shocked.
- Green-shawl woman: brown braided crown, teal shawl, salmon dress, lantern; angry, shouting, shocked; walk-drag.
- Doctor A. Hale: round glasses, comb-over, blue-striped nightshirt; stern eyes shut, talkO; dragged, sit in snow, hold cert.
- Extras: gravedigger (brown hat, blue coat), yellow-coat man, diagram corpse (striped pyjamas), giant nightcap face, ~10 seeded creditors.

## 4. Sets & props
Graveyard (dusk/night/sunrise), cross-section diorama (canvas-painted card in teal frame), attic bedroom, snow street + porches + doctor's office, wife's house exterior + garden (night/day), parlour (night/day/dawn). Kenney/Poly Pizza/Quaternius CC0 first (≤3 searches each), otherwise build in Blender. Paper props canvas-painted with our own layout (certificate, Dig note, tally, IOUs, $20, plaque, physician sign). Log every model in ASSETS.md.

## 5. Animation
Pose-to-pose 2D rig, instant expression swaps 0–3 frames before the word, blinks every 0.5–2.3 s, mouth flaps only on quoted dialogue (shots 10, 12), 1–2% idle bob, no hold frozen ≥12 frames. Mixamo "Digging" projected to 2D → `public\motion\dig.json` for shots 21/25 (fallback hand cycle). Bell = damped pendulum driven by the sound event table. Rocking chair ±6°, 2.4 s → 4 s period. Drag walk, shiver/sweat fx, burst-out pop + 12 clod cards.

## 6. Narration (our wording)
> A living man went into the ground with a bell cord looped around his finger. You see, back then people were so terrified of waking up inside a coffin that a grave could come with a small bell above it, and a cord running down to the dead man's finger. But when this bell starts going at two in the morning, the neighbour rolls over and blames the wind. Then it gets faster, and soon the whole street is standing on their porches saying, you go look. No, you go look. Somebody hauls the doctor out of bed, and he says, bodies twitch, he's dead, I signed that paper myself. But one porch is empty: his wife's. She's sitting in the dark with a shovel by the door, because she knows that ring. Three short, one long, the exact signal they rehearsed. Hold on, rehearsed? Well, he never died at all. Half the town had lent him money, so he faked his own death, and the moment that bell rang, she was supposed to grab the shovel, dig him out and leave town with him. Instead, she just sits there all night, listening to it ring, fast, then slow, then once every few minutes, until sunrise, when it finally goes quiet. You see, with him under the ground, every debt went under with him, and the house belonged to her alone.

Captions: one word (pair short adjacent words), white bold, thin black stroke, y=0.70, sentence case w/ punctuation, shrink >14 chars.

## 7. Sound
events.json from words.json drives bell anim too. CC0 brass bell: 3 strikes 0.22 s apart + 1 long ring; fast repeats under voice 16–28 s (ref time), exact on "Three short, one long", dry handbell in flashback, gaps stretch 1→3→6 s in shot 23, silence after "quiet". Ambience: wind/snow, room tone, porch murmur, snow steps, drag scrape, paper, chair creak, teacup, day birds, shovel dirt/snow, bluebird chirp. Own music bed (sneaky pizzicato/celesta minor; major lift in flashback) −19.5 dB under voice. Master −14 LUFS, ≤ −1.5 dBTP.

## 8. Execution order
1. Scaffold from rail-gap-short (rename rail→bell, composition GraveBell); node_modules junctions.
2. Voice first → words.json → SHOTS from atWord().
3. Character kit + cast sheet vs ref crops (f_001, f_028, f_040, f_052, f_066, f_119).
4. PILOT gate: shots 15 + 6 end to end; side-by-side vs f_066 / f_024; iterate to ≥7/10 on colour, light, ink, character, depth.
5. Remaining sets. 6. Camera blocking (Blender cams.json). 7. Animate all shots; 1 fps 10x6 sheet vs ref sheet.
8. Lock picture → sound. 9. Draft render (gl=angle, concurrency 1, sandbox off, TEMP on D:). 10. QA (short_qa.py, side-by-side every 0.5 s, ebur128). 11. agy review once (fallback Opus verifier if quota out). 12. Deliver out\final.mp4.

## 9. Risks
Bake failures → three.js two-tone lighting. drawCharacter.ts unproven → fall back to rail toon.ts Pen. CC0 gaps → primitives. Mixamo login → hand cycle. Remotion: sandbox off, one render, TEMP on D:. Buried-head shot must read comic. Copyright: narration, music, prop layouts are ours; never use reference audio.
