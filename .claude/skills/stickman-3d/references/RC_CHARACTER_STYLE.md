# RicksClips-style character: measured style sheet (2026-11-17)

Style only (proportions, line, flatness, costume vocabulary, movement). Our cast stays our own designs.
Sources (local, never re-published): `charstudy/rc_TRUkQ1wbV2E.mp4` (TRU, mine), `rc_i4hYq1oSXTg.mp4` (i4h, fort),
`rc_5WMQhPObNqQ.mp4` (5WM, race), `grave_bell/ref/ref.mp4` (gb), `replica_aD73/ref/ref.mp4` (aD73). TRU / i4h / 5WM are
720x1280, gb / aD73 1080x1920, all 30 fps. Frame names = `<video>_<seconds>` (`charstudy/frames/`), ruler crops in
`charstudy/rul/`, dense strips in `charstudy/strips/`, tools in `charstudy/tools/` (`mt.py` rulers / montage,
`measure.py` line widths + colours, `motion.py` per-frame motion energy + head track).

## 1. Proportions (pixels, outer edge of the outline; figure height = head top without headwear -> feet)
| frame, figure | head W | head H | torso W | torso H | legs | total | head % | torso % | legs % | head W/H | torso W / head W |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TRU_38 rich man (top hat) | 270* | 185 | 155* | 232 | 330 | 745 | 24.8 | 31.1 | 44.3 | 1.35-1.45 | 0.57 |
| TRU_47 rich man | 235 | 160 | 115 | 220 | 285 | 665 | 24.1 | 33.1 | 42.9 | 1.47 | 0.49 |
| TRU_38 expert (bowler) | 113 | 87 | 78 | 116 | 154 | 354 | 24.6 | 32.8 | 43.5 | 1.30 | 0.69 |
| TRU_23 ranger (no hat) | 130 | 133 | 90 | 112 | 157 | 401 | 33.2 | 27.9 | 39.2 | 0.98 | 0.69 |
| TRU_13 ranger (hat, leaning) | 145 | ~135 | 120 | 142 | 198 | 475 | 28.4 | 29.9 | 41.7 | ~1.07 | 0.83 |
| TRU_0 ranger (rifle, spot) | 223 | - | 160 | 218 | 295 | - | - | - | - | - | 0.72 |
| i4h_50 engineer (headband) | 150 | 170 | 80 | 120 | 160 | 450 | 37.8 | 26.7 | 35.6 | 0.88 | 0.53 |
| i4h_7.5 soldier (blue, CU) | 240 | 225 | 145 | (tunic 265) | cut | - | - | - | - | 1.07 | 0.60 |
| 5WM_4 tall man (cap, moving) | 172 | ~150 | 83 | 163 | 205 | 515 | 28.5 | 31.6 | 39.8 | ~1.15 | 0.48 |
| 5WM_16 buddy (no hat) | ~190 | 178 | - | 170 | 240 | 588 | 30.3 | 28.9 | 40.8 | ~1.07 | - |
| 5WM_23 big man (no hat) | 210 | 187 | 167 | 178 | 250 | 615 | 30.4 | 28.9 | 40.7 | 1.12 | 0.80 |
| 5WM_38 hero (boater) | 153 | 143 | 100 | 147 | 190 | 480 | 29.8 | 30.6 | 39.6 | 1.07 | 0.65 |
| aD73_30 sheriff (wide stance) | 312 | ~240 | 240 | 272 | 260 | 768 | 31.3 | 35.4 | 33.9 | 1.25 | 0.77 |
| aD73_14 flagger (helmet) | 133 | ~120 | 102 | 125 | cut | - | - | - | - | 1.11 | 0.77 |
| gb_19 husband (no hat) | 287 | 270 | 235 | 250 | 345 | 865 | 31.2 | 28.9 | 39.9 | 1.06 | 0.82 |
(* from `big_a.jpg`, the same shot one second later. `~` = top of the head hidden by a hat, estimated.)

- **Median (12 full figures, 5 videos): head 30 % (range 24-38), torso 30 % (27-35), legs 40 % (34-44).** The lead's
  first numbers (26 / 32 / 42) were the tall "rich man" of one video: he is the slim extreme, not the norm.
- **Head W/H median 1.10 (0.88-1.47):** a slightly flattened ellipse, flat-bottomed bean; the rich man's is a wide bean.
- **Torso W / head W median 0.69 (0.48-0.83).** Slim characters 0.5-0.57, stocky ones 0.8. Torso = upright pill with
  full round ends; W/H of the pill 0.45-0.9 (median 0.62). The head overlaps the torso top by ~5-8 % of the head height.
- Legs: straight or one gentle bend, hips ~0.45 torso widths apart, feet ~0.9-1.3 torso widths apart when standing.
- Arms: shoulder -> hand 0.85-1.0 x torso height (rich man 215 px vs torso 232; expert 105 vs 116). They leave the
  torso at its upper edge (10-15 % down), one smooth curve through the elbow, never two straight segments.
- Built into the skill as: head 0.29 H, head W/H 1.10 (x seeded +-2 %), torso W 0.66 head W (the painter's capsule,
  between the slim hero type and the median), torso 0.32 H visible, legs 0.39 H.

## 2. Line (tools/measure.py: horizontal ink runs inside hand-picked boxes)
| what | measured | used |
|---|---|---|
| limb (leg / arm) width | 1.6-2.1 % of H (TRU_38 15 px / 745, TRU_47 14 / 665, TRU_23 8 / 401, 5WM_16 11 / 588, 5WM_23 10 / 615, gb_19 16 / 865) | 1.9 % of H |
| head outline | 3.8 % of head H (TRU_38), 5.6 (gb_19), 5.9 (i4h_50), 6.9 (TRU_0 CU); thicker lower right than upper left in the older videos (gb), near-uniform in the 2026 ones | `ART.thin` 26 / `thick` 31 px at head W 512 (nominal ~6 % of head H; reads ~4-5 % at film size after texture filtering; the first build's 19 / 25 read as ~3 %) |
| torso outline | 3.2-5.0 % of head H (same pen or slightly thinner than the head's) | same as the head |
| headwear outline | same pen as the head | same (art layers; the flat cards keep 0.8) |
| hand dot | 24 px on a 745 px figure = 3.2 % of H = 1.6-1.7 x the limb width; a plain filled circle, no fingers | 1.65 x limb |
| foot | a stroke of the limb pen, 30-38 px on a 745 px figure (4-5 % of H), round cap, pointing outward and 20-35 deg below level (TRU_38, TRU_0); from the side both point forward | 5.7 % of H (reads ~5 % after the drop), 28 deg down |
| inner costume lines | about half the outline pen | 0.5 x |

## 3. Colour (sRGB, median of sampled pixels)
- **Ink (outline, limbs, hands, brows, eyes): dark purple-brown, never pure black.** [42,29,35] (TRU_0), [37,25,29]
  (TRU_38), [43,31,29] (TRU_23), [41,30,38] (i4h_50, daylight), [46,27,42] (5WM_16) -> **#2a1c24**. At night it lifts
  toward the haze colour: [89,72,112] (gb_19 legs).
- **Head: #fdfaf4 in daylight; it never goes dark.** Sampled cheek: daylight [253,252,247] (i4h_50), [253,250,241]
  (5WM_16); warm lamp mine [251,246,239] (TRU_38); candle attic [241,224,216] (gb_14); lamp porch at night
  [244,197,177] (gb_19); rainy night [246,237,230] / [246,225,204] (i4h_35); blue moonlit room [233,194,238] (gb_32);
  dusk interior [211,217,249] (5WM_64). Luminance stays 82-98 % of white; only the hue takes the light: the two
  channels away from the light's colour drop by 2-27 %. => **Unlit figure, multiplied by a light tint whose
  brightest channel never falls under 0.92** (`TINT.floor`: the measured brightest channel is >= 233/255 in every
  light) and which carries 45 % of the scene light's hue (`TINT.hue`).
- A soft violet shade hugs the lower right inside of the head outline (~6 % darker, ~7 % of the head width).
- Torso colours (flat, one colour + detail): white suit #f1eee6, wine #6a2f52, teal #2fa58c, red plaid #c8402e on
  #a8321f, mint #7fe0c0, mustard check #d9a52e, sky blue #5b8fd0, sage #9fc48a, khaki #b9a06a, hi-vis #c8e04a,
  violet #9a7ad0, navy armour #2e3f7a. Costume detail is drawn in ink at half pen: two button columns, lapels, pockets,
  braces, belts with a buckle, plaid lines, a flower, badges.
- **Shadow: a real cast shadow** of the whole cut-out on the ground (TRU_38: silhouettes of hat, head, torso and limbs
  under the lamp; i4h_50 daylight: a thin slanted shadow). No blob under the feet.

## 4. Face (drawn flat on the head, facing the camera; fractions of the head)
- Eyes: solid ink dots, diameter 9-11 % of the head width (TRU_0: 22 px of 223; TRU_23 13 of 130), centres 28-34 % of
  the head width apart, 40-48 % down from the head top. Ring eyes (shock) 2.2 x the dot. Happy eyes = upward arcs.
- Brows: heavy strokes, 16-20 % of the head width long, 5-6 % thick, 8-12 % of the head height above the eyes.
- Mouth: 62-72 % down the head; small (10-20 % of the head width) when closed, up to 38 % wide and 22 % tall in a
  laugh (tongue visible). A moustache sits between eyes and mouth (the mouth opens below it).
- The face group shifts toward the side the character looks (3/4 feel) by up to 10-15 % of the head width.
- The art layers draw the painter's faces 1.12 x larger (`ART.face`) about 55 % down the head, with dot eyes of
  `ART.eyeR` 21 px (~9 % of the head width), eyes ~40 % and the mouth ~72 % down, and a handlebar moustache with
  curled tips under the nose (the mouth opens below it). The first build's faces read smaller than the reference's.

## 5. Headwear and hair
- Hats sit ON the head overlapping its top 15-25 %; brims are wider than the head for sun hats (ranger 1.55 x), about
  the head width for bowler / top hat (1.0-1.1 x). Same pen as the head, flat fill, inner detail at half pen: a band
  with a highlight line (top hat, bowler), a badge (ranger), ribs (beanie), stripes (nightcap), rivets (kettle helmet),
  a plume (helmet).
- Hair shows as a cap with a fringe when there is no hat (TRU_23) and as **tufts beside and behind the head under a
  hat** (TRU_38 both men, i4h soldiers: sideburn tufts 8-12 % of the head width outside the outline).

## 6. Movement (30 fps; strips in charstudy/strips, motion.py on TRU 36.0-40.0)
- **2D puppet animation: poses are held, changes are snaps.** Motion energy (mean abs frame difference in the figure's
  box) on TRU 36.0-40.0: hold f0-8, laugh f9-42, hold f43 + gesture f44-51, hold f52-76 (25 f), change f77-92, hold
  f93-104 (12 f), change f105-109 (5 f), hold f110-114, change f115+.
  - **Holds: 12-25 frames (0.4-0.85 s), median ~18.** During a hold only the mouth changes (1-frame bumps every 3-7
    frames while talking), eyes blink, and the camera drifts.
  - **Pose changes: 5-8 frames for an arm gesture** (f44-51, f105-109), up to 15 for a whole-body shift (f77-92):
    fast out, slow in, with a small overshoot (the hand passes its target by ~3-5 % of the arm length and settles in
    2-3 frames).
- **Laugh / big reaction (TRU 36.3-37.4, strip laugh_TRU_36.0 f11-42):** 1 frame of anticipation, then the whole body
  jumps: head centre rises 65 px on a 745 px figure (8.7 % of H) within 2 frames, the body and head tip back ~15 deg,
  **the hat lifts off the head and tilts for 3-5 frames**, one leg kicks up, the mouth opens wide; two bounces of 8-9
  frames each (f11-19, f20-27), then the figure sinks back over ~8 frames and holds the laughing pose.
- **Expression change:** the face swaps in 1 frame, with a head tilt of 6-10 deg and a small hop (blink_TRU_38
  f42-43: tilt in 2 frames, held 13 frames, back in 2).
- **Blink (blink_TRU_38):** half-closed 1 frame + closed 2 frames (3-4 frames in all); blinks 14-17 frames apart in a
  lively moment, 1-2.5 s apart otherwise.
- **Talk:** the mouth alternates closed / open-O / open-wide every 3-7 frames (strip talk; energy bumps at f57, f60,
  f67), the head nods 1-3 px with it.
- **Walk (walk_aD73_24.4, walk_TRU_21.5; read off the strips, not tracked: the camera moves):** the torso stays
  front-on to the camera and upright, legs scissor with a soft knee, ~10-12 frames per step, step length about 0.6-0.8
  of the leg length, the body bobs ~2-3 % of H twice per stride, arms hang or are held on the hips with very little
  swing; the head does not turn. A figure that changes direction flips (mirror) in one frame.
- **Head:** always faces the camera; tilts with the body lean (the rich man's lean into the mine: head and hat tip
  20 deg with the torso), never rolls over.
- **Idle:** the held pose; a breathing drift under 1 % of H; blinks.

## 7. What the skill does with it (src/char3d; every constant and where it lives: LOOK.md -> 3D stickman)

> **REAL 3D MESHES (default since 2026-11-20, user pick after the `D:\resource\stickman\_t_toon3d` test):** head,
> torso, hat, hair and 'dress' skirt are 3D solids that turn with the body (`src/char3d/toon.tsx`); the look stays the
> flat cut-out: unlit flat colour x the mood tint, the painter's own drawings projected front-to-back (back drawings for
> the back of the head / jacket / hair), one ink outline per part from an inverted hull (0.85 painter's pen, world
> units), meshes half a pen inside the painted outline so the front matches the old card. All geometry is generated
> from the cast spec (no per-character build): hats spun from the hat drawing, hair = the head inflated to the hair
> drawing, both carved by the drawing from the front. Same pose solver, faces, lip-sync, props and puppet layers.
> `<Stickman toon={false}/>` = the old camera-facing cards (always show the front, mirror-flip); `toon="lit"` =
> experimental lit 3D (2-5x slower, greys the white head: not the RC look). Flat crowd `<Card/>`s are unchanged.
> Known weak spots: profile (90 deg) head is a white egg with the face on its edge (no profile drawing yet); costume
> detail streaks at 60-90 deg; hats with plumes / feathers / flowers get the decoration mirrored at the back and spun
> into a ring from the side; generic jacket backs. Report + stills: `_t_toon3d/TOON3D_REPORT.md`, `out/toon/`.
- Head, hat, torso and skirt are flat painted layers that always face the lens (quads on the 3D Mixamo joints, so
  placement, occlusion, props and shadows stay true 3D). Tested against flattened 3D shapes at 0 and 35 degrees
  (`charstudy/proof/flattened3d_vs_layers_0_35deg.jpg`): the flattened head narrows, shades and its hat becomes a line;
  the layers keep the drawing. The drawings are the painter's own (`draw*Art` in src/char/drawCharacter.ts), in the
  measured pen (`ART`).
- Limbs are thin unlit ink tubes with one smooth curve through the elbow / knee, dot hands, stroke feet.
- The figure is unlit and takes a gentle tint from the mood (`figureTint`); its ink keeps its dark value through the
  grade; it casts a whole-silhouette shadow.
- Mixamo clips run through a pose-to-pose time remap (`ClipKey.step`, rig.ts) and a puppet layer reacts to expression
  changes (`reaction()` in Stickman.tsx); walks stay continuous with an exaggerated bob and quiet arms.

## 8. Where ours still differs from the reference (honest list, 2026-11-17)
- **Key poses.** The reference is hand-posed: a few strong asymmetric poses per line (hand on hip, a leg kicked up in
  a laugh, a lean). Ours samples Mixamo mocap every 16 frames: the timing matches (holds and snaps), the poses are
  mocap poses, more symmetric and less designed. A laugh hops, tips the head and lifts the hat but kicks no leg.
- **Head variety.** One head shape (W/H 1.10 +-2 %) and one build for every character; the reference varies the build
  per character (wide bean heads up to 1.45, stocky torsos 0.8 head widths, tall slim figures with a 24 % head).
- **Face drawing.** Sized to the reference now, but the expressions are the older card set: no blush marks, no half-closed blink frame, simpler
  mouths (no tongue-and-teeth laugh shapes per phoneme), brows often hidden under hair or a hat brim.
- **Costume detail** is the painter's 9 patterns + 5 torso accessories: no double button columns, flowers, armour
  scales, braces, per-character pockets. Top hat, bowler, ranger hat and chef hat have crisp art-layer versions (bands, curled brims, badge, pleats);
  the other hats are the card drawings at full pen, and caps / police / helmet visors are drawn 3/4 (to one side), the
  reference's mostly front-on. Hat colours are seeded per hat (no white top hat unless the palette changes).
- **Light.** The reference's figures sit in rendered sets with soft contact shading and their shadows come from the
  scene's own lights; ours tint from the mood only (point lights do not tint them) and the shadow follows the key.
- **Walk.** Ours is a Mixamo walk with quieter arms and more bob; the reference's legs are simple scissor swings.
- **Turns.** Both flip; the reference sometimes draws a true profile head, ours always the same 3/4 drawing mirrored.
- **Flat cards** (`<Card/>`, crowds) still use the older card look (bigger head, thin-thick black-violet outline).

## 9. Cast design rules (Double Survivor v2 review vs RicksClips, 2026-11-19)

The skeleton matched RC but the cast did not: white shirts with three dots, the same black hair cap on everyone, faces
stuck on "worried". What RC does and the cast must do:

- **One strong torso colour per role** (teal, rust, mustard, plum...), never white/beige on the hero: a white shirt
  under a white head reads as one blob. Name every character from a 100 px thumbnail, or redesign.
- **A drawn costume layer**: patterns `jacket` (open jacket + shirt strip + lapels + pockets), `cardigan`, `wrap`
  (kimono crossover + sash), `buttons` (now collar wings + placket + pocket), `vest`, `lapels`, `stripes`, `dress`.
  Add a tie / bowtie / scarf / glasses where the role allows.
- **Its own head silhouette**: a hat with a hand-picked colour (`hat: "cap #d39a3c"`), or a distinct hair shape.
  Seeded hat colours are only for extras.
- **Faces that act**: the face group is drawn `ART.face` 1.24 x, `faceDrop` 22 below, hats `hatLift` 20 higher, the
  hairline sits at 55 % of the old depth and brows carry a skin halo, so brows always show (they do most of the acting).
  worried = sad brows + grimace teeth, shocked = open oval mouth, scared = grimace wide. Plan a different face per beat:
  one expression held across a film is a bug.
- **Brow sign bug fixed 2026-11-19**: before that date `angry`/`stern` drew sad brows and `sad`/`worried` drew angry
  brows. Older projects that copy the new painter will show the faces their shots actually asked for: re-check them.

## 10. Slider face: how RC's expressions change smoothly (2026-11-19)

Measured frame by frame (TRU 36-40 s at 30 fps): RC never swaps a whole face. Brows, eyes and mouth are separate
parts on separate clocks; the mouth passes through in-between sizes (closed -> gap -> open -> wide with tongue over
3-6 frames); the head tilts / bobs with the change and the hat settles 1-2 frames later; held faces keep drifting.

What the engine does now (`src/char3d/faceAnim.ts`, `drawFaceRig` in `src/char/drawCharacter.ts`):
- An expression = slider values (`faceParamsOf`): brow y / tilt / arch per side, eye open / big / happy / pupil,
  mouth open / width / curve / teeth / tongue, head tilt. The 24 named expressions still work in shots.
- A change eases every feature with an overshoot (`FACE_T`): brows at once (0.17 s), eyes +1 frame (0.13 s), mouth
  +2 frames (0.2 s), head tilt 0.3 s; eyes blink on frames 1-3 after the change. A change during a change starts
  from where the face is.
- Idle drift on brows, mouth curve and head tilt; `talk` ranges open the mouth by a continuous syllable envelope.
- The head tilt is a 3D roll of head + hat; the hat lags it (`hatLag`).
- The head texture is redrawn when a slider moves a visible step (`faceKey`).
- Test: `npx remotion render build CastAnim out/facetest.mp4 --props=F` with
  `{"only":["hero"],"dist":2,"lookY":1.45,"seq":[{"at":0,"e":"neutral"},{"at":0.5,"e":"shocked"}],"talk":[[1,1.6]]}`.
Direction: change the expression ON the word it reacts to, 2-4 changes per sentence for a speaking/close character;
the transitions do the rest.

## 11. Lids, gaze, asymmetry, sizes (second face pass, 2026-11-19)

RC close-ups vs ours: their attitude comes from (1) upper eyelids cutting the dot eyes (half-lidded = smug, bored,
suspicious, tired; slanted down to the nose = angry, droopy = sad), (2) gaze: eyes on the other character or the
thing, never dead into the lens, (3) asymmetry: lopsided mouths, mouth off-centre, one brow cocked, (4) small
features. The slider face now has:
- `lid` / `lidTilt` per eye (+ tilt = inner end up), `lidB` (lower lid, ring eyes only). Behind glasses only lids
  above 0.2 show (softened), drawn as a chord of the lens.
- `gX` / `gY` gaze: `<Stickman look={...}>` takes a world point, "cam", or keys `[{at, to}]` (eyes dart in 0.1 s);
  default = a little toward the facing side (`GAZE_AHEAD`). The face group shifts with the gaze (3/4 feel).
- `mTwist` (front corner up, back corner down) and `mShift` (mouth sideways).
- Sizes back to §4: `ART.face` 1.1, `eyeR` 22, brows 84 x 27 ref px, closed mouths 24-40 half-width, ring eyes
  R 52, grimace teeth with 3 gaps (not a grill).
- Per-expression extras in `FACE_OVER` (drawCharacter.ts): neutral has a light lid (no blank stare); smug, bored,
  stern, angry, sad, worried, confused, grin, sleepy got lids / twists. New expressions: `suspicious`, `smirk`,
  `unimpressed`, `tired`.
Direction: give every speaking character a `look` target (the person they talk to, the thing they react to), and
use the lidded attitudes for resting faces instead of `neutral`.
