# Look bible (stickman-3d)

## 3D stickman = the RicksClips character (rebuilt 2026-11-17 from measurements: [RC_CHARACTER_STYLE.md](RC_CHARACTER_STYLE.md))

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
A flat 2D drawing that lives in 3D. Head, hat, torso and skirt are flat painted layers (the painter's own art) on quads
that always face the lens, placed on the Mixamo joints; limbs are thin unlit ink tubes. Tested against a flattened 3D
build: at a 35-degree arc the flattened head narrows and its hat turns into a line, the layers keep the drawn shape.

| what | number (measured -> used) | where it lives |
|---|---|---|
| head / torso / legs | 30 / 30 / 40 % of the height (12 figures, 5 videos) -> 29 / 32 / 39 | `STYLE.headFrac` (src/char3d/Stickman.tsx); torso = the painter's capsule (`TORSO_W` 340, `TORSO_H` 560 at head width 512, src/char/drawCharacter.ts) |
| head W/H | 1.10 (0.88-1.47) | `ART.headRatio` (drawCharacter.ts) |
| torso W / head W | 0.69 (0.48-0.83) -> 0.66 | `TORSO_W` / `REF_HW` |
| outline (head, torso, hat) | 3.8-6.9 % of the head height (big_a ~5 %), near-uniform, the SAME pen on hats | `ART.thin` 26 / `ART.thick` 31 px at head width 512 (nominal ~6 %: texture filtering at film size makes it read ~4-5 %; 19 / 25 read as ~3 %); hats use the full pen in the art layers (`HP()`, the cards 0.8) |
| ink | #2a1c24 dark purple-brown, never black | `ART.ink` |
| limb width | 1.9 % of the height (1.6-2.1) | `STYLE.limb` (= painter `LIMB` 30 px / 2) |
| hand dot | 1.65 x the limb width, no fingers | `STYLE.hand` |
| foot | a 4-5 % stroke, 20-35 deg below level, outward when facing the lens | 5.7 % (`ART_REF.FOOT` 92 px; reads ~5 % after the drop), 28 deg; `STYLE.foot`, `footDown`, `footSplay` |
| arms / legs | one smooth curve through the elbow / knee (quadratic through the joint) | `curveAt` / `tubeGeo` (Stickman.tsx) |
| arms leave the torso | on its top cap, 30 deg above the widest point; legs 0.42 half widths either side | `STYLE.shoulderAt`, `hipSpread` |
| light on the figure | unlit; brightest channel never under 0.92, 45 % of the scene light's hue (head 82-98 % of white in every reference light) | `TINT.floor`, `TINT.hue` (src/char3d/art.ts `figureTint`) |
| shadow | a real cast shadow of the whole cut-out: in the shadow pass each layer is an invisible copy turned toward the mood's key light (a lens-facing layer is edge-on to a side light and casts a sliver) + a faint contact blob | `shadow` prop, `shadowMat` (art.ts), `faceSun` (Stickman.tsx), `M.shadow` |
| ink through the grade | the mood grade lifts near-blacks to plum; the figure's ink keeps its measured dark value | scene alpha 0.4 marker on ink texels and limbs (`darkFloor`, art.ts) |
| torso lean | the cut-out stays near upright | `STYLE.lean` 0.5 of the Mixamo spine lean |
| hanging arms | a gentle outward bow (noodle arms, never a ruler) | `STYLE.armBow` 3 % of the height at the elbow |
| face size | eyes 9-11 % of the head width, 40-48 % down; brows 16-20 % long; mouth 62-72 % down | the art layers draw the face group `ART.face` 1.12 x about 55 % down the head, dot eyes `ART.eyeR` 21 px (~9 %), eyes ~40 %, brows 0.13 head heights above them, mouth ~72 %, happy arcs 30 px pen (`drawHeadArt`, `drawFace` when `ART_MODE`) |
| moustache | a handlebar right under the nose, wider than the mouth, tips curled up; the mouth opens below it | two plump lobes ~55 % of the head width with a dip in the middle, curled hook tips (down when sad), a highlight stroke on ink-dark ones; a closed mouth hides under it, an open mouth sits 24 px lower (`drawFace`, `ART_MODE` branch) |
| headwear | crisp flat shapes, same pen, inner detail at half pen | art-layer versions of tophat (flared crown, wide band with light edge lines, curled brim 1.18 x the head), bowler (band + highlight, curled brim), cowboy / ranger (dark band, crease, gold badge), chef (pleats, folds); the other hats use the full pen. Hair under a covering hat = tufts beside the head under the brim (`drawHair`, `ART_MODE`), the full cap only without a hat or under headband / veil / crown |
| layer order | legs -4.5 cm, skirt -2, torso 0, head +2, hat +2.6, arms +4.5 cm toward the lens along the view ray | `STYLE.zLeg` ... `zArm` |
| ink pass | the figure occludes set ink and gets none itself (it has its own drawn outline) | `userData.outline = "silent"` (engine/post/pipeline.ts `occMatFor`) |
| art resolution | 300 px per head width; at most 56 textures / 256 materials cached | `ART_PX`, `MAX_TEX`, `MAX_MAT` (art.ts) |

- The drawing looks toward the screen side the body faces (`facing` prop overrides); crossing the lens axis is a flip,
  as in the reference. Faces: the cards' 24 expressions, held >= 0.7 s; glasses / beard / moustache come with the face;
  hats (all 17) and hair (6 styles, tufts beside the head under a hat) are the painter's drawings on their own layer,
  with crisper art-layer versions (`ART_MODE` in drawCharacter.ts: the flat cards keep the old drawings).
- 'dress' = a flat skirt layer on the solver's skirt (hips to 0.45 of the way from knee to ankle, hem level when she
  bends); the 3D cone still does the contact solving.
- Movement (frames at 30 fps, all pure functions of time):
  | what | measured | used | where |
  |---|---|---|---|
  | pose holds | 12-25 frames | a pose every 16 frames (gestures are busier than the reference's key poses) | `STEP.every` (src/char3d/rig.ts), per key `step: {every}` |
  | pose change | 5-8 frames, small overshoot, 1 frame of anticipation | 5 frames, back-out 10 % overshoot, 5 % dip | `STEP.snap`, `over`, `antic`, `snapEase` |
  | drift in a hold | under 1 % | 6 % of clip time leaks through + torso breathing +-0.7 %, 3.4 s | `STEP.drift`, `STYLE.breath` |
  | laugh / cheer | body up 8.7 % of the height in 2 frames, two bounces of 8-9 frames, head tips ~15 deg, hat lifts 3-5 frames | hop 7 % x2 (0.28 s each), tip 0.24 rad, hat lift 16 % of the head for 5 frames | `STYLE.hop`, `hopT`, `tipBig`, `hatLift`, `reaction()` |
  | shocked / scared | one jump + shake | hop 4.5 %, the old head jolt, hat lift | `STYLE.jolt` |
  | any other expression change | face swaps in 1 frame, head tilt 6-10 deg in 2 frames held 13 | tilt 0.11 rad (seeded side), hop 1.2 % | `STYLE.tip`, `nod` |
  | blink | 1 half + 2 closed frames, 0.5-2.5 s apart | 3 closed frames, 0.5-2.3 s | `blinkAt` (src/char3d/face.ts) |
  | talk | a new mouth shape every 3-7 frames | lip-sync from the real voice: jaw = voice loudness, lips = the letter spoken (o/u/w round, e/i/y wide, f/v teeth, m/b/p shut), closed between words; only inside the character's `talk` ranges | `lipAt` + `src/lip.json` (faceAnim.ts, voice/lip_track.py); seeded `talkEnv` only if lip.json is empty |
  | walk | torso front-on and upright, ~10-12 frames per step, bob 2-3 % of the height, arms nearly still | continuous Mixamo walk, its own bob x1.6, arm swing x0.45 (not when a prop is held) | `STYLE.bob`, `walkArm`, `CONTINUOUS` (rig.ts) |
  | squash / stretch | on every bounce | +-10-12 % from vertical speed, the head counter-squashes | `STYLE.squash` |
- Flat cards (`<Card/>`) still use the older card pen (thin-thick #1C1620 outline, bigger head): keep them in the
  background, never beside a 3D figure in a close shot.

## Sets — see WORLD.md first (2026-11-19: colour, sky, grass, depth, dressing, hero props); below = the 2026-11-17 set-look pass
## Sets — the RicksClips set look (2026-11-17; proof `D:\resource\stickman\charstudy\look\compare.jpg`)
Measured against RicksClips frames (mine interiors, castle exteriors): their characters carry the only outline; sets
are clean, game-engine lit (soft bounce, dark contact shadows in corners and under objects, warm practicals, light
shafts) and densely dressed with worn, textured materials. Ours read as cheap cel-shading mostly because ink was on
every wall and crate. Targets, in order of impact:
| what | target | how (defaults) |
|---|---|---|
| ink | on characters only (their drawn line), cards, tags; sets / props / vehicles clean | `post.outline.setInk` false (PIPELINE.md -> Set look) |
| bounce + AO | soft warm bounce, dark corners, under-desk and under-crate shadows | `S export --light` lightmap + `post.ao` SSAO (radius 0.35 m, intensity 0.6; 0.45 / 0.9 left dark smears under desks and crates) |
| light shafts | from a bright window / the sun when it is in front of the lens | `post.shafts` (strength 0.35) + the old `sets.light_beam` planes where a shaft must stay put |
| dressing | rooms 35-50 props (books, files, crates, a cabinet, lamps, maps, papers, bottles, frames, wiring, floor papers, clothes on pegs); clutter in every corner the camera sees; exteriors with real grass blades near the camera zones and more props in the foreground layer | Poly Haven / free Sketchfab CC0 / CC-BY only (RULES.md -> Assets); `place()` / `drop()` on surfaces |
| materials | wear, roughness variation, small highlights on big surfaces (walls, floor, desk) | `sets.pbr_mat` (Poly Haven PBR, normal + roughness), asset maps kept (`toonify(pbr=True)`), `TOON_SPEC` highlight |
| brightness | warm interiors around RicksClips' levels (their mine: L* ~45-55, bright floor pools, dark surround) | per shot `forSet(..., { bake: { lmGain } })`: office day 1.1 |
- Not photorealism: the toon ramp, painted grade and the flat characters stay; the set just gets light and detail.
- Remaining gaps (2026-11-17 test): our rooms still read cooler / flatter than their warm lamp-lit mines (mood choice:
  try `golden` / `lamp` plus practical point lights baked with `--light`); volumetric dust now exists but is not yet
  used in a film (world/fx.tsx `Motes` + `VolumeBeam`, 2026-11-17); grass is sparse next to
  their meadows (budget: ~150 clumps per set keeps it under 1.5 M polygons).

## Engine look (inkbeat, src/engine) on Blender sets
- **Blender-like look (template default since 2026-11-21, switches in src/upgrade.ts, PIPELINE.md -> Look switches).**
  AgX view transform inside the post grade (three's AgX cut from its chunk; `renderer.toneMapping` would change
  nothing, the pipeline grades in its own shader) with a white point (the unlit white x exposure lands at 0.96: plain
  AgX made the heads ~80 % grey, BUILD_LESSONS #103) + 0.4 of Blender's "Punchy" look; the Poly Haven CC0 sky HDRI
  Kloofendal 48d Partly Cloudy Pure Sky (1k) as a spherical-harmonics light probe replacing the hemisphere light
  (MeshToonMaterial has no envMap: IBL here = SH, #104), loaded once per film; soft sun shadows (radius 5, 16 samples,
  bias -0.0003, normalBias 0.03). Measured: _t_upgrade corner day mean luma +4 %, saturation +8 %, heads 91-93 %
  white; _t_skillcheck roadfield day luma +3 %, saturation +1 %, heads 94-97 % white, no grey / magenta cast (R-G-B
  within 2-3 %); nightstreet night (nightSet hue kept): luma +16 %, saturation 0.71 -> 0.81 (a stronger electric
  blue: judge each night film, `agxPunch` 0-0.2 / `agxGain` < 1 if it reads too hot). Known limits: the HDRI effect
  is subtle (luma < 1 % at equal zenith energy, less on lightmapped sets); the SH tint can give heads a faint
  magenta (G 3-4 % under R/B on the corner set); no reflections on car paint (toon materials have no env term);
  ~18 % slower per frame. Re-tune AGX_GAIN / AGX_PUNCH / AGX_WHITE per set from one still (input props).
- Post ink (depth + normal + object id, colour per mood; sets ink-free by default since 2026-11-17), SSAO, light
  shafts, grade, bloom on cores only, DOF on the hero, vignette, motion blur on every final (4 sub-frames, 180 deg).
- Moods: use `forSet(mood, sunDir(set))` (world/moods.ts: day, dusk, night, cold, lamp, golden, sunrise), never a raw
  inkbeat mood: Blender albedos clip to cream at inkbeat's light levels (key x0.39, hemi x0.6, rim x0.45, fill x1.1,
  lens fill x0.55, fog x0.5, exposure +0.15 matched the Blender render; saturation x1.25 since 2026-11-19 - the
  matched x1.08 left Survivor v2 at mean saturation 19 against RicksClips' 29, WORLD.md).
- Targets: mean L* 50-54 for day frames, ink >= 2.5 % of the frame, warm key vs cool fill, coloured shadows, coloured
  haze only in the distance. Measured exceptions (`S qa` prints mean L*):
  | scene | mood | mean L* | note |
  |---|---|---|---|
  | night exterior (graveyard, _night3d) | `nightSet(sunDir(set))` | ~38 | luminous blue, nothing big below L* 15 (Blender's own frame: 25, murky) |
  | sunrise over snow (_gb3d) | `forSet("sunrise", sunDir(set))` | ~55 | approved Blender look was 61-69: at ~55 snow reads lavender-grey, brass olive; decide per film |
  | lamp-lit parlour (_smoke3d) | `forSet("lamp", sunDir(set))` | ~41 | raise exposure / fill for bright beats |
- **Night on a Blender set**: `nightSet(sunDir(set))` (NIGHT_SET values are final; adjust with `{exposure, fog, key,
  ...}`) + world/weather.tsx: `Snowfall` (1500 flakes, 0.5 m/s), `glowMeshes(scene, re)` for lit windows (unlit
  #ffe040 x 1.25, blooms above threshold 0.9), `Glow` halos, `SetLights` for warm window pools (far pools: k ~10),
  `Puff`. Haze = FogExp2 0.035 in #1a2680 matched to the sky horizon (~22 % at 14 m, ~50 % at 25 m). Example:
  `D:\resource\stickman\_night3d\src\shots\s06.tsx`. A 3D stickman under nightSet (one test shot, _t_integ): face
  L* 64-66 lit, >= 57 on its unlit side; a blue torso L* 30-32 lit but 16-17 unlit, below the 25-35 target for unlit
  surfaces (open: more fill / rim on characters or a lift for dark torso colours).
- **Sunrise over snow**: `forSet("sunrise", sunDir(set))` (hemi #e0c0f4 / #8a6a9a, key #ffd6b8, pink fill #ff9ad4,
  grade exposure -0.35 / contrast 1.18 / saturation 1.35): mean L* 55.4 on the graveyard.
- **Cards** take their light from the mood automatically (`tint` "auto": same model as the 3D head, key dropped when the
  set shadows the card): measured within ~1-5 sRGB levels of a 3D head beside it (after calibration). Point lights are not included.
- **Sound-off tags** (world/Tag.tsx): cream #f6ecd4 plate, #1a1424 Poppins ExtraBold text with a frame, unlit, no fog,
  inside the safe area (x 0.05-0.95, y 0.05-0.85, clear of the caption band y 0.62-0.78), about one per 15 s.

## Camera and framing in three.js
- **User camera rules (2026-11-21; win over CAMERA_STUDY / RC_CAMERA_MOVEMENT where they differ):** ONE smooth eased
  move per shot, in one direction (no back-and-forth, no stop-and-go); no roll; no jitter, no re-aims (the aim never
  swings back); shake only on explosions and gunshots; RicksClips framing = the character AND the environment, head
  ~12-18 % of the frame width (0.5 m head: ~6 m at vfov 50), no face-filling close-ups. Hero shots: author the move in
  Blender (`S cam`, PIPELINE.md -> Blender cameras): its check enforces roll 0, no move / pan reversals, ease >= 0.4 s
  and reports the head %. Known limits: from behind, the round head hides a short arm unless the lens is ~50 deg off
  the aim line (BUILD_LESSONS #101); leave room for the lens (a wall 2 m from the hero leaves no lens on that side).
- **Composition = [COMPOSITION.md](COMPOSITION.md)** (measured 2026-11-18). Defaults: camera knee-to-waist height tilted
  up 5-10° (>= 30 % of frames low, >= 10 % high/top-down, eye level < 50 %); horizon / floor line at 40-45 % of the
  height; shot mix ~10 % close / 35 % medium / 40 % wide / 15 % insert, the full-body standing frame < 20 %; the head
  brighter than a clean, darker area behind it; interiors shot 30-45° to the walls, never flat-on.
- Portrait: horizontal view = ~0.56 x vertical fov. Rooms: vfov 50-60 from inside the set; exteriors 40-46.
- Moves THROUGH space (arc, crane), the channel's push 0.128 log-zoom/s between beats, spikes 0.3 s on key words;
  lensClear on every frame; never sweep a foreground object across a face.
- Grip close-ups (`S grips`): vfov 35 at `--dist` 0.9 m from the hand; QA only, never in the film.

## Editing forms in the hybrid (src/edit.json `kinds`, film/transitions.ts)
- `dissolve` is the default (78 % of changes); `push` (push-through) stands in for the measured zoom-throughs (13 %),
  on a reveal or a "but"; `whip` is a fast change of place or time, at most one every ~5 s (it always pans left);
  `cut` only on an impact. Measured on _t_film: push and whip give 0 hard cuts in analyze_pacing (max scene score
  0.08 / 0.11 against the 0.3 threshold), a cut gives 1 (0.62).
- One-take film: list every section's first shot in `cuts` (or kinds "cut"). Each section's shot module ends by pushing
  the camera into a dark doorway (or past a dark foreground pillar or door frame) at about 1 m/s, so the last >= 3
  frames are near-black; the next section starts inside a dark doorway at the same speed and direction, so its first
  >= 3 frames are near-black too. The hard cut falls in the middle of those black frames (stage it so the boundary
  frame is the darkest). Check the join with `S still` on the 3 frames each side of the boundary (all near-black,
  matched lens speed and fov) and with `S qa` (a cut between two black frames scores below 0.3: hard cuts stay 0).
  Never use push or whip inside a one-take: they read as edits.

---
(Below: the RicksClips look bible from stickman-short. Its Blender render knobs no longer apply, but the measured
numbers - colours, depth layers, camera rates, editing - still do.)

# Look bible (RicksClips stickman) and how each knob is set in Blender

Measured numbers come from `FORMULA.md`; the Blender settings are the ones that matched the reference in two films.

## Characters — flat 2D cards in a 3D world
(The old CARD numbers. The 3D figure's measured proportions, pen and face are in "3D stickman" at the top of this
file and override these: head 29 %, not 40-45 %.)
- Painter: `src/char/drawCharacter.ts` (cast specs in `src/char/cast.ts`). White bean head ≈ 40–45 % of figure height,
  pill/bean torso in one saturated colour, thin black stick limbs, dot hands, thick ink outline, dot eyes (ring eyes for
  shock), heavy brows, line mouth. Expressions swap instantly: neutral happy grin laugh sad angry shocked worried smug
  sleepy confused scared evil whistle stern nervous cry effort bored talkO cheer dizzy tongue teethGrit.
- Poses: stand walk run sit lie pointR pointL armsUp wave hold crouch dead, plus `rig` (Mixamo joints).
- Costume vocabulary and how to extend it (new hats, props, hair styles, accessories): edit the switch blocks in
  drawCharacter.ts (`drawHat`, `drawProp`, `drawHair`, `drawFace` accessories, `drawTorso` patterns) and the unions in
  `types.ts`; check with `stickman3d.py castsheet` (3D) or `cards` (flat).
- In Blender: `lib.Card` plane, LOCKED_TRACK to the camera (yaw only), image sequence per frame, ~20 % lit by the
  scene, 80 % emission × light tint (night `#eceaff`/`#dfe4ff`, warm `#fff0dc`), hard alpha edge, no shadows cast.
- Size: height 1.6–1.75 m → head ≈ 0.45–0.5 m. CUs need the camera 4–5 m away at 32–38° vfov (head 25–35 % of width).

## Sets — stylised, soft-lit, ink-outlined
- Matte saturated materials (`lib.toonify`: roughness 0.9, low specular, saturation ×1.15) + inverted-hull ink
  (`lib.outline`, 1.2 cm). Painted PIL textures for wallpaper, planks, siding, snow, soil, signs (our own designs).
- Light: one strong warm practical/sun (2700–3500 K) against cool blue/violet fill. Night = deep blue world + warm
  windows/lanterns (`emissive` ≥ 3 so the glare blooms) + POINT lights. Moon/window shafts: `sets.light_beam` (soft
  additive plane tagged `o["beam"]`; three.js draws it as additive unlit glow, peak ~+0.26 x its colour at strength
  1.6, soft at both ends; it is not ground, not a lens blocker, casts no shadow and gets no ink).
- Haze: world volume scatter 0.02–0.04 (more washes close-ups grey). Snow: tex + flakes animated from the frame number.
- Compositor (`lib.compositor`): Fog-Glow glare (threshold 1, strength 0.5–0.7), hue/sat ×1.05, coloured oval
  vignette 0.4–0.55 (night `#3a3570`, warm `#5a4030`). Blender 5.x: glare Type/Quality are menu INPUTS (set by lib).
- Engine: EEVEE, Standard view transform, 12 render samples (32 looks identical, 2.5× slower), shadows on, no raytracing.

## Depth — the STANDARD (user-approved 2026-11-15, `package/examples/depth_test/`)
Our earlier films read flat/2D: straight push-ins (no parallax), cameras locked front-on to the cards, characters in
one row before a sky HDRI, muted documentary grade, hard cuts, many top-down paper shots. Every shot now follows:
1. **Move THROUGH space, not along the lens axis.** Pushes always carry a sideways/arc component: `lib.arc(...)`
   (orbit 30–60° around the subject while closing in 20–35 %), cranes (low near the grass → up and back), fly-throughs.
   A pure straight dolly is allowed only for an ECU spike on a key word.
2. **Three layers in every frame:** foreground 0.5–3 m from the lens (bush, grass, table edge, lamp; DOF-blurred,
   sliding past faster than the subject), the characters in the middle, and a lit background receding into haze
   (trees/props at 7–35 m, far ridge/buildings at 100 m+). Never characters alone in front of a bare HDRI.
3. **Cards billboard to the camera** (lib.Card LOCKED_TRACK yaw): orbit freely; when one shot uses two cameras,
   retarget every card's constraint before rendering each (`c.root.constraints[0].target = cam`).
4. **Colour:** saturated toon grade (`compositor` sat 1.25–1.35, bloom 0.6–0.7, coloured vignette), one warm low key
   sun (#ffc07a, 15–30° elevation, shadows on) against a cool blue fill (#6f8dff area light from the camera side),
   a coloured sky (dusk/golden/blue, never grey) and **coloured distance haze** (`mist_fog` lavender/pink/blue
   #c8a8dc at 0.35–0.45, mist start 8–10 m, depth 45–50 m), never brown/grey.
5. **Transitions:** 0.3 s dissolves by default (edit.json `xfade` 9); hard cuts only when the user's script asks.
6. **Limit flat subjects:** papers/maps/screens get an angled camera with the desk, lamp and objects in the foreground,
   a slow arc over them, never a straight top-down hold for more than ~2 s.
Measured: the depth test (4 walkers, ~450 instances, 540x960, 10 samples) ≈ 5 s/frame on the 1660 Ti.

## Camera (measured)
- Moving 96 % of the time: default `push` = dolly-in at 0.128 log-zoom/s (~14 %/s closer; use 0.08–0.14).
- Reveal **spikes** on key words: 0.3 s push or pull (`spike`, k 0.3–0.5). Pull-outs 16 %, pans 4 %, static 4 %.
- Smooth: `glide` (quintic) for pans/rises, jerk low, no handheld; impact shakes decay in ~7 frames.
- DOF (`bake_camera(..., dof=...)`): CU f/1.2–1.6, MS f/2–3, wide f/4+; focus distance = camera→subject.

## Editing
- Cut film: ~13 scenes/min, ~3.5 s each; **0.3 s (9-frame) cross-dissolves** for 78 % of changes, zoom-throughs
  13 %, at most one hard cut on an impact. Hybrid: `src/edit.json` (Editing forms above).
- **One-take film** (the user's preference for the latest videos): no cuts at all. The camera travels through doors,
  doorways, photos. Sections join inside ≥ 3 black frames of a dark doorway at matched speed (~1 m/s); edit.json lists
  every section in `cuts`. Tricks: costume swap hidden behind a foreground pillar the camera passes; **photo portal**
  (push into a framed photo whose texture is a still render of the destination set's first frame, built far away,
  same fov, matched speed, then reverse to come back).
- Captions on 98 % of runtime, one word at a time, y = 0.70 (Remotion `Captions.tsx`).

## Acting (measured on RicksClips grave_bell, 2026-11-18; user: "why are they fidgeting so much")
RicksClips is CALM and HELD: things move only when the story moves.
- Bodies hold a pose: 1-2 pose changes per character in 4 s; feet planted unless walking. Gesture clips run
  pose-to-pose slow: `step: { every: 28-45, drift: 0.02 }` (the default every 16 reads as fidgeting on busy clips).
  Listeners: a near-still idle (Sad_Idle every 45). Never swap to a clip with root motion mid-shot (Looking_Around walks).
- Faces hold an expression 2-4 s and change only on that character's own line or a key word: 1-2 changes per
  character per shot. Between changes only blinks (+ mouth flaps on the talker).
- No pupil darts, no head sway by default (Stickman `micro` default 0.3 = anticipation blink only; `micro >= 0.8`
  only for one nervous character). Look beats (`act: {look}`) only where the eyes tell the story (a glance at the window).
- Marks (`act: {mark}`, char3d/acting.tsx) are rare: at most ONE pop-in on the shot's biggest beat; a sweat drop
  just sits there (expression extra), it does not pop.
- Two people talking: in profile, facing each other (yaw +-pi/2, facing 1 / -1), but staged on a DIAGONAL (one near
  and big on one third, one further and smaller on the other) with the camera 30-45° off square; the composition study
  (COMPOSITION.md §4, 2026-11-18) found the square-on side-by-side two-shot reads as a flat lineup. The big event
  gets its own frame (event in the top third, witness small at the bottom); a window behind them is only for a glimpse. Keep the
  payoff clear: no punch-in that lets their heads cover it; ease back instead.
- A bomb / big blast seen through a window: the white flash is a 2-frame peak gone in ~0.4 s (never a long white-out
  that swallows the explosion); the fireball glow fades as the cloud rises; the cloud's CAP must clear the
  characters' heads in the window (scale it up / lower its base). Then the blast HITS the room (compress the real
  delay to ~1 s): big decaying shake, glass blown inward (Debris from the window toward the lens), wood and plaster
  chips falling from the beams, dust pouring down (SoftPoints), papers lifting off the desk; both react scared.
