# Gotchas (stickman-3d first; the Blender ones below still apply to set building)

## Blocky-shorts port (2026-11-17: StageQA, fx, physics, tears, critic; tested in D:\resource\stickman\_t_blocky)
- **Many Mixamo idles carry root motion or a hip offset**: a partner on `Looking_Around` drifted 0.7 m BACK from its
  `at` (it only looked like an overlap on screen), and `Sad_Idle` shifts the hips sideways (two people at x 0 stand
  apart). Stage and check from the drawn joints (`jointsAt`, `<StageQA/>`), never from `at` alone.
- **A test that "should" fire and does not usually means the test was wrong**: twice the check was right (the bodies
  were really 0.7 m apart; the lens line really ran between two people). Look at the frame before changing a check.
- **A VolumeBeam through a figure washes its legs into a milky blob** (additive + bloom); aim beams beside people.
- **INSIDE only sees closed meshes**: the parlour's wainscot box was caught, the back wall plane was not (a body walked
  through it). lensClear aimed at that body catches it.
- **STAGE lines repeat per frame** (one per frame and pair): the CLI keeps the first 40 on screen and every line in
  `out/logs/qa_console_<cmd>.txt`. The template's s01 example had a real FRAMING defect (its closing push cropped the
  hero's head): the push is now 0.05 log-zoom/s.
- **critic TIMING is a WARN**: shimada's shot 10 starts 9 frames before its word (moved by hand or stale); check which.

## Set look pass (2026-11-17: ink-free sets, lightmaps, SSAO, shafts, PBR, dressing)
- **No-ink set meshes were hidden from the whole depth pass**, not just from ink (`outline = false`): the big ground
  planes (`no_ink`) had no depth, so SSAO found nothing to occlude and DOF blurred them as sky. Set meshes marked no-ink
  are now `outline = "noink"` (depth-only unless setInk). Engine helpers (shadow blobs, beams) keep `false`.
- **One Cycles bake per object is slow**: 120 objects with their own images took 113 s light + 92 s AO even at 32 AO
  samples (per-object setup dominates). export.py joins every baked mesh into one temporary copy and bakes one atlas:
  11 s for the same room. Originals are hidden from render meanwhile (a coincident copy would shadow itself).
- **A per-object lightmap cap blows the pixel budget on exteriors** (ten 3 km ground / sea / hill layers at 1024 px
  each = 13.7 Mpx, 329 s bake): every map is now scaled down together until the atlas fits `--light-px`.
- **Sun direct light must stay out of the lightmap** (three.js draws it live with its shadow map, or it doubles): a
  Light Path "Ray Depth > 0" node on every SUN during the bake keeps its bounce but not its direct hit.
- **Lightmaps double up with live ambient** unless the shader takes the ambient down: baked materials keep hemi x 0.25
  and unshadowed fills x 0.35 (`BAKE_LOOK`); the shadowed key (three.js puts shadow-casting directional lights first:
  `UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS`) stays. Characters are unlit, so nothing changes on them.
- **Keeping the assets' normal + roughness maps tripled the GLB** (office 27 -> 134 MB, 1.1 M polygons: a 22 cm Poly
  Haven candlestick has 213 k polygons). export.py now slims by object size (decimate + texture downscale) and writes
  WEBP: 40 MB. Collapse decimation opens small seams (open-shell WARNs on tiny desk props): budget >= 6000 polygons,
  ratio >= 0.1, and `open_ok` on props smaller than a hand whose inside is never seen.
- **glTF puts the roughness in the metallicRoughness G channel and MeshToonMaterial has no roughnessMap**: toToon parks
  it in the unused `aoMap` slot (three's UV plumbing for free) and the patched shader reads `.g`; `aomap_fragment` is
  removed from patched materials (AO comes from the lightmap alpha and SSAO).
- **The magnifying glass / standing assets keep their scan pose** (a magnifier stands upright on its rim): lay such
  props down with a rotation or pick another asset; check every new desk prop in a still.
- **`drop()` onto an open crate lands inside it** (coplanar WARN with the crate's inner floor): put boxes on closed
  lids or on the floor.
- **Grass clumps with a modifier export one mesh per instance**: apply the decimate on the base object before
  `copy()`, so all instances share one mesh in the GLB (150 clumps of grass_medium / bermuda ~1 M polygons; the WARN
  counts instances).
- **SSAO from the normal pass blackened rugs and rails**: MeshNormalMaterial writes the SMOOTHED vertex normals, and a
  smooth-shaded cylinder cap (the parlour rug) or bevelled trim tilts them up to 45 degrees, so flat surfaces occluded
  themselves (a black disc under the characters). The SSAO pass now rebuilds the normal from the depth buffer (smallest
  step each way) and has a soft response with a floor (AO >= 0.35): a contact shadow, never a hole. Debug it by writing
  the AO target straight to the screen in INK_FRAG (`gl_FragColor = vec4(texture2D(tAO, vUv).rrr, 1.0)`).
- **Python `write_text` on Windows writes CRLF**: TS template files are LF, Blender scripts CRLF; patching with
  `write_text` turned whole files into one big diff. Keep each file's own line endings when editing by script.
- **Other agents share the GPU lock**: stills that take ~10 s took 3-6 min while other projects rendered. Plan the
  number of look iterations; `look_still.py` (scratch project) takes the lock once for several stills.

## three.js / Remotion (learned 2026-11-16)
Loading and determinism
- **Asset loading must block the frame synchronously** (delayRender during render) and release only after the re-render
  with the assets has committed (+1 rAF): `world/assets.ts useNeeds`. Effect-based loading captured whole loading
  frames (flicker score ~180). Never hand-roll a loader in a shot: list it in `needs`.
- **Dissolves, pushes and whips render two canvases at once:** a THREE object has one parent, so two shots sharing
  `set.scene` (or one prop object) fight over it. Draw sets with `useSetScene(set)` and animate nodes in that clone;
  Stickman keeps prop clones per shot already.
- **Object3D.clone() JSON-copies userData:** a Quaternion stored there becomes an array. poseNode keeps rest poses in a
  WeakMap; do the same for any per-node state.
- **groundY and lensClear see the set in its rest pose**, not the shot's animated clone: a swung bell or moved node is
  invisible to them.
- `npx tsc --noEmit` runs before every bundle (one syntax error breaks every render); noUnusedLocals is on.

Depth, ink and set geometry
- **Depth precision:** camera near/far 0.1-0.15 / 120-250, not 0.02 / 600.
- **Coplanar parts = black ink blobs, not just z-fighting:** object-id edges fire across the whole fighting area.
  Seen: plaque on its board (2 mm), headstone slab vs round top, cross bar vs post, window frame corners and muntin
  crosses, pit walls vs ground. `export` WARNs on same-facing faces of different objects < 1 cm apart that overlap;
  keep parts >= 1 cm apart (decals 1.5 cm proud). The check samples the 300 largest faces per object plus quad centres
  (a tiny overlap can slip through) and also flags down-facing faces hidden under the ground (`o["coplanar_ok"] = 1`).
- **Open one-sided shells lose their inside** (FrontSide culls it: bells, frames, stove backs): `export` WARNs; give
  them a SOLIDIFY wall before the ink modifier, or `o["open_ok"] = 1` if the inside is never seen.
- **Striped / many-part meshes get inked at every part boundary** (object-id edges): mark no-ink. Multi-material meshes
  arrive as a Group with suffixed child names: name filters must check the parent too (world/set.ts does).
- **Double-sided materials** from Blender get inked as cloth: toToon forces FrontSide.
- **glTF reads only a Principled BSDF (or a bare Emission):** a Mix / Transparent / Add shader (the parlour moonbeam)
  arrives as an opaque, double-sided emissive slab that blooms to cream over the frame, and the old gate skipped it
  silently. `export` now WARNs; light shafts carry `o["beam"]` and are redrawn in world/set.ts (additive, no ink).
- **Node-built colours do not survive glTF** (kit HSV recolours, procedural): `export --bake`. Kenney/glTF atlas UVs
  collapse to points, so a mesh bake writes almost no pixels; export.py bakes UV-only colour on the full UV square
  instead (pixel-identical to the old numpy recolour). Arrayed copies share UVs: position-dependent colour on an Array
  modifier bakes the last copy's colour.
- **toToon halves emissiveIntensity:** baked window glow reads weaker and peachier than Blender's bloomed yellow. For
  lit windows at night use `glowMeshes(scene, /<name pattern>/)` (unlit HDR yellow that blooms).
- **groundY from high up hits the ceiling indoors:** the ray starts at 1.6 m (raise `from` on hills / roofs).

Light and grade
- **Night: `nightSet(sunDir(set))`**, never `forSet("night")` (its day multipliers clip). The grade *burns* anything
  above ~1.0 after exposure toward cream: lit windows read cream until the unlit colour is about 1.25 x #ffe040
  (`glowMeshes` default).
- **grade.exposure is in stops and goes through a highlight shoulder:** on snow, lowering it barely moves L* until the
  total is below about +0.2 (+1.15 -> L* 68.5, +0.15 -> 59.3, -0.20 -> 55.0).
- **Unlit cards in dim sets** sat ~1.7x brighter than the lit surfaces (lamp parlour). Card tint "auto" (default)
  matches a 3D head beside it within ~1-5 sRGB levels after calibration (parlour, graveyard night, sunrise). It ignores point lights.
- **Point-light shadows:** cube maps, at most 2 lights at 512 px, about +45 ms per frame at 1080x1920. A light inside a
  lamp shade, stove or closed house lights nothing once shadows are on (move it out of its shell in Blender).
- **Moon shadows fall behind objects** when the exported moon shines from the camera side; foreground shadows then
  have to come from point lights.

Characters and props (the 2026-11-17 RicksClips rebuild: flat layers on 3D joints)
- **Engine ink on a drawn figure doubles its outline** (the ink pass inks every depth silhouette; limbs came out
  twice as fat). The figure's meshes carry `userData.outline = "silent"`: an occluder that writes alpha 0.3 into the
  normal buffer, under the edge shader's 0.5 gate. `false` would let set ink draw across the white head.
- **The mood grade lifts near-black to plum** (ink #2a1c24 rendered as ~#5a3a55): unlit ink must write scene alpha
  0.4 (the liquid marker; `darkFloor` in char3d/art.ts) so the grade skips the lift. Fog is off on the figure too.
- **A layer that faces the lens is edge-on to a side light:** its shadow is a sliver. The shadow pass uses invisible
  copies turned toward the mood's key light (`faceSun`); they follow the key only, not SetLights point lights.
- **Legs must stay behind the skirt layer however far a knee swings forward:** each leg point is pushed back past the
  skirt's plane along its view ray (a fixed offset let walking legs draw over the skirt).
- **A trapezoid of two triangles kinks its texture along the diagonal** (the skirt's fold lines zig-zagged): the skirt
  strip has 8 x 6 cells.
- **A thin crescent moustache above a line mouth reads as a smile.** The moustache is two arches (the opposite of a
  smile's curve), wider than the mouth, and hides a closed mouth; check every new face accessory at cast-sheet size.
- **The art layers' pen reads thinner on film than on the canvas** (texture filtering at ~100 px heads): 19 / 25 px
  (4.6 % nominal) measured ~3 % of the head height in a cast sheet. `ART.thin` / `thick` are set nominally ~6 % so
  they read as the reference's 4-5 %; measure rendered pixels, not canvas numbers, when you change them.
- **Art-layer drawing changes go through `ART_MODE`** (drawCharacter.ts): hats, hair tufts and the face size differ
  from the flat cards on purpose. A change meant for both must be made outside the `ART_MODE` branches.
- **A fresh project's `S castsheet` fails with a 404 on public/clips/Walking_IP.glb** until the cast's clips exist
  (`S clip ...`, step 6); the template ships no clips.
- **A killed render leaves `<lock_dir>/blender.lock`** and every later command waits "for the GPU lock" forever:
  check no node / blender render is running, then remove the folder.
- **Pose-to-pose sampling aliases fast repetitive clips** (Waving, Clapping at a pose every 16 frames): give those
  keys `step: {every: 8, snap: 3}` or `step: false`. Walks stay continuous on their own (`CONTINUOUS` in rig.ts); a
  locomotion clip with an unusual name needs `step: false` or its feet slide against the root motion.
- **The reaction hop is not in `jointsAt`:** something attached to a hand lags a few cm for ~0.5 s after an
  expression change (`react={0}` on that character, or key the expression elsewhere).
- **Facing flips when the body's forward crosses the lens axis** (the drawing looks toward the screen side the body
  faces). A character turned straight at a camera that drifts across that axis flips: give it a small yaw, or pass
  `facing`.
- **Old shot cameras were framed for the 38 % head and fat body:** the new figure is slimmer with a wider head
  (0.54 m at 1.7 m); close two-shots crop heads sideways. Re-check framings of ported shots (template s01 moved back).
- **Cast sheet with more than 5 characters:** the Cast camera backs off to fit the row; look checks at other angles /
  expressions through input props (PIPELINE.md -> 3D stickman).
- **Big heads roll over** at full Mixamo head tilt when bending: STYLE.headTilt 0.25.
- **Mixamo walks are ~1.1 m/s at the stickman's scale:** compute the stop time from the distance (`walkSpeed`).
- **Mixamo hands sit inside the fat cartoon body** (Digging pulls the upper hand 5 cm into the pill). The contact
  solver pushes hands and elbows out: do not undo that with offsets in shots. Pushed radially, a hand hanging in front
  of the hip can end up in front of the skirt; check idles other than Sad_Idle / Walking in a still.
- **A skirt that follows the thighs looks like a tilted barrel when the figure bends:** its axis is blended toward
  vertical (`skirtHang` 0.5).
- **Prop mode cross-fades used to lerp the two holds' working ends and directions separately**: the shaft swung level
  beside the body with the hand at the blade neck for 0.4 s (plant -> carry). It now turns about the drawn right hand.
  A 'two' grip whose hands come level flipped its top hand; it now fades to a default direction. poseQA sweeps must
  cover the shot's own mode keys and clip cross-fades, not one clip in one mode.
- **A carried long prop reaches ~0.55 m ahead of the hand** and the solver only avoids the holder's own body: a hero
  who stops 0.75 m from someone puts the shovel across their skirt. Stage carried props away from people, or key
  `plant` / `none` when the walk stops (template s01 does).
- **`jointsAt` without the prop** gives the hand before the solver moved it: pass the Stickman's `prop` as 6th argument.
- **Glb bone names:** three strips `:` (`mixamorig:Hips` -> `mixamorigHips`); rig.ts tries both.
- **Porting Blender card shots:** cameras aimed at a card's head (`HD.x - 0.35`) compensate for the card's offset
  head; aim at the 3D stickman's real head and check framing against the approved film frame by frame.
- **Painter 'lie' / 'dead' cards:** the painter's feet line is the torso's back edge and the head hangs ~18 cm below
  it. CardExport rests these poses on their lowest drawn pixel; keep that, or the head sinks into the floor.
- **Hat brims fool head measuring:** upright cards use the head centre from the card constants, not the widest row.

QA tools
- **ffmpeg drawtext segfaults here** (no fontconfig): label contact sheets with PIL (`charstudy/tools/mt.py`), and
  `-pattern_type glob` is not in this Windows build (list the files).
- **Browser console lines reach the terminal only at `--log=verbose`** (Remotion 4.0.540; error / warn / info show
  nothing). They arrive as Chrome `INFO:CONSOLE` lines, each printed twice per still. still, grips and render run
  verbose and print only LENS BLOCKED / TAG OUTSIDE / GRIP: / REACH: / ARM FAST: lines (full list: out/logs/qa_console_<cmd>.txt). The
  first progress estimate of a verbose render is meaningless ("33m remaining").
- **Grip close-ups read SHOT_JOINTS (cast id + shot + frame):** each canvas of a transition uses its own shot's
  joints and a character drawn in an earlier frame of the tab is never reused; the shot without the character logs
  `GRIP:` on a transition frame, so take grips inside a shot. Another character between the lens and the hand still
  blocks the view (the hidden-hand test only checks the holder's own hips, radius 0.22 m).
- **flicker.py on transitions:** a whip shows 1-2 clustered spikes at its centre frame (score ~16) and a push
  cross-blend one small spike (score ~3.4); both legitimate, stride verdict None.
- **levels.py:** without stems, per-cue peaks are measured on mix minus voice (music counts); the duck reads n/a on
  short or tightly cut narration (needs >= 8 bed blocks of 400 ms in gaps >= 0.4 s). Ask the sound agent for
  audio/stems/.
- **`status` NEXT is strict pipeline order:** a project that skipped steps (no vo.txt or PLAN.md) is pointed back at
  the script even when later steps are done.

Machine
- Remotion renders, Blender and ffmpeg need the Bash sandbox disabled (browser timeouts); TEMP/TMP on a big drive
  (config lock_dir). One GPU job at a time: render and still only through the CLI (shared lock).
- **Portrait framing:** the horizontal view is only ~0.56 x the vertical fov; two-shots need people within ~1 m.
- The painter's code needed one dead `case 'none'` removed for TypeScript 5.9 (done in the template).

## Speed (measured, GTX 1660 Ti)
- Render workers default to min(6, CPU cores); `STICK_CONC=<n>` overrides (merged 2026-11-19).
- Far assets: decimate with `lod()` (0.06-0.3); the friend's park set went 124 MB -> 53 MB. Coins <= 2000 or instanced.
- 720p tests: `--scale=0.66666666666666666` (exact 2/3), 2-frame test first (BUILD_LESSONS #35).
- Still at half size ~10 s; grip still ~13 s; draft render 240 frames 31 s; motion-blur render ~0.3 s/frame
  (316 frames 92 s, 105 frames 32 s); final of a 10.5 s film 82 s; set export 3-13 s per state (--bake adds
  ~2-5 s); clip convert ~5 s. Most film time is staging and review, not rendering: plan framings on paper before
  iterating stills. Answer "how long?" with frames x s/frame from these numbers.
- Set look pass (2026-11-17, `_look` test bed, full size 1080x1920 Film, concurrency 6, wall time incl. ~15 s
  startup): office shot 84 frames 41 s before -> 58-65 s after (dressed set 40 MB GLB + lightmap + SSAO + shafts);
  with SSAO + shafts off 57 s, so the two passes cost < 0.1 s per frame; airfield 42 frames 60 s -> 56-59 s. Runs
  overlapping other agents' renders were 1.5-2x slower: measure on a quiet GPU. Export with `--light`: office 150-171
  s, airfield 124-134 s, template parlour 44 s (bake 27 s); Cycles OptiX ~15-25 M samples/s on this card.

The legacy section below is from stickman-short (Blender renders, card PNG exports). Its Blender 5.x, voice, painter
and agent notes still apply; its render-speed and Blender-render notes do not.

---
# Gotchas (each one cost time on the first two films)

## Speed (the user asks about it every film)
- GTX 1660 Ti: EEVEE 1080x1920, 12 samples ≈ 2.5–7 s/frame (heavier: haze close-ups, portal sets, crowds). A 75 s
  film ≈ 2–3 h. 720x1280 saves only ~25 % (per-frame costs are shadows/volumes/setup, not pixels). 32 → 12 samples
  looks identical and is 2.5× faster.
- Every `still` rebuilds the scene (assets + thousands of card images): 1–3 min before the first pixel; four agents
  queue on one GPU. Faster next time: save each built section with `--save-blend` and preview from the .blend,
  use Workbench for blocking, load only the cards a shot uses, and offer a RunPod GPU (quote the hourly price first).
- Draft mode (`render/post/final --draft`, SKILL.md) is the first pass: 360x640, 4 samples, no DOF, every 2nd frame
  held twice → ~4.5× faster render (Norfolks s3: 128 s vs 575 s). The bigger win is the build rules (reuse assets,
  one still per shot, few clips, no sound agent); render was only ~2 h of a 15 h film.
- Answer "how long?" with: frames left × s/frame + ~5 min for post/final. Recount long shots; don't guess.

## Blender 5.x
- Glare node: `glare_type`/`quality` are now menu **inputs** ("Type" = "Fog Glow"); otherwise bloom renders as streaks.
- Compositor node tree lives in `scene.compositing_node_group` (lib.compositor handles both APIs).
- Card alpha: DITHERED + a GREATER_THAN 0.5 clip; plain dithered alpha leaves see-through specks (the user saw gaps).
- `image.save` with relative paths writes nowhere useful: pass absolute paths.
- Poly Haven `fir_tree_01` / `pine_tree_01`: 7–17 M polygons; appending them hangs builds — build cone pines.
- The MCP add-on's library toggles are SCENE properties: they reset after `read_homefile`.
- Kill only your own Blender PID; killing every blender.exe destroyed another agent's render once.

## Remotion
- Render with the Bash sandbox disabled (browser timeouts otherwise); set TEMP/TMP to a big drive.
- CardExport: `--timeout=120000 --concurrency=2..3`; a Node crash / "Target closed" under load → rerun with lower
  concurrency. Remotion pads sequence names to 3 or 4 digits by count: `cards_digits.txt` tells lib which.
- Static JSON imports are bundled: motion clips must be imported via the generated `src/clips.gen.ts`.

## Painter / cards
- `sit` keeps the head at standing height: build furniture to the card instead of sinking it (user rule).
- Front-facing cards draw a raised hand behind the torso: handshakes need the SIDE-view clip on two facing cards.
- Front→profile clip switches (seated front → Sit_To_Stand side) pop; plan staging to hide or avoid them.
- New hats/props/accessories: add to the switch in drawCharacter.ts AND the unions/lists (types.ts, ALL_* arrays,
  WIDE_PROPS for long props) or the card silently draws nothing.

## Voice
- vo.txt and vo_tags.txt must hold identical words (CAPS allowed) or the word count assert fires.
- ElevenLabs v3 reads ~160–167 WPM natively; `tighten_beats.py` cuts long pauses then atempo to 180.
- Pick takes by pitch SD (expressiveness); the user can't be asked to listen to every take.

## Assembly
- Shots render with 6-frame handles; post.py resizes mixed 720/1080 renders. Preview frames left in `frames/`
  (half size) make `render` skip a shot — delete them before the full render.
- Sound agents work from word timings; after the picture exists, check door slams/footsteps/handshakes against frames.

## Agents
- Background agents report "waiting for the render" many times: that is the GPU lock, not a hang.
- Give agents explicit ownership (their files only) and the shared rules file path; they otherwise patch shared code.
- **Grabs (reach.tsx), measured on _t_grab 2026-11-17:** a linear hand -> target blend whipped an arm at 6.7 rad/s when
  the line passed near the shoulder, and a stepped idle's pose snap mid-reach added more (4.4 rad/s): the blend now
  swings about the shoulder from the FIXED start direction. Set props are bigger than they look: the parlour's round
  table is 1.86 m across (asset scaled to 0.7 m high), so a character "at the table" stood inside its footprint and was
  0.42 m short. One still run printed no REACH: line for a frame whose picture showed the cup jumped to a short hand:
  trust the picture, re-run `still` on that frame.

## Ready-made library scenes (Sketchfab via the Blender MCP), 2026-11-17 (double-survivor train)
- **Sketchfab glTF is Y-up.** Its root carries a 90-degree X rotation as a quaternion; `prop()`/`asset()` set an euler
  yaw and wipe it, so the scene loads lying on its side (walls under the camera, floor overhead). After `prop()` set
  `root.rotation_mode = "XYZ"; root.rotation_euler = (-pi/2, 0, yaw)` and check a known height (a table top ~0.65-0.75 m)
  in a headless bounds print before exporting; the sign of the 90 degrees depends on the file.
- **import_asset's `target_size` scales the WHOLE file**, including any backdrop card the author shipped (the train's
  15 m moving-landscape card made the cabin come in at 0.8 m tall). Measure the bounds without the backdrop and rescale
  to a real dimension (ceiling 2.4 m) before saving the asset.
- `asset()` resets the root location: centre the scene inside the set script (bounds without the backdrop), not in
  the live Blender before saving.
- Save the import from the live Blender with `bpy.data.libraries.write(path, set(objs))` after packing its images, then
  remove the objects from the live scene; never leave the user's open file changed. Importing in a NEW scene fails
  (the MCP library toggles are per scene): import in the open scene and clean up.
- Third-party scenes come with coplanar skins (export WARNs): lift decals/papers 1.5 cm in world z, move inner wall
  skins 1.2 cm toward the room centre (write `o.matrix_world = m` with a COPY; `o.matrix_world.translation += v`
  edits a temporary and does nothing).
- **Save the user's open Blender file before any MCP import or code run** (user tip, 2026-11-18): `execute_blender_code`
  and `import_asset` act on the live file. If it is unsaved (`bpy.data.filepath == ""`), ask the user to save it first,
  or save a copy with `bpy.ops.wm.save_as_mainfile(filepath=..., copy=True)` to a backup path they agree to.
- **Look before saving an import:** `look` (angles, material shading) on every imported scene before writing it to
  `blender/assets/`, not only the look-dev after export.
- **Poly budget per set:** aim <= ~300k polygons / ~40 MB GLB; decimate scans and scatter plants with `ready.scatter`
  (shared meshes). A single heavy tree (jacaranda) pushed one set to 1M polygons / 115 MB.
- **Distant giants (mushroom cloud, mountains) vanish:** the engine clips at 600 m (View `far`) and the mood's FogExp2
  leaves ~8% at 400 m. Scale the object down and bring it in (a 350 m cloud at ~450 m reads like a 1.2 km cloud at
  1.5 km), and in the shot set `material.fog = false` on its meshes (as Card / Tag do). (double-survivor, 2026-11-18)
- **Diorama models sit on a plinth:** measure the street level (the road mesh top) and `place(..., sink=<height>)`;
  remove modern props and Maya camera transforms (huge bounds) before saving.
- **Blender Y vs three.js -Z:** dressing placed at negative Blender Y is BEHIND a lens looking toward three.js -Z.
  Put the dressing where the cameras look (Blender +Y = three.js -Z) or turn the cameras.
- **Photo sky domes (ready.sky_dome, world/set.ts `sky`)**: (1) a black disc in the sky = the dome's far side beyond the
  camera far plane (LookDev sized `far` from the set; now 600 m when a dome is present); keep lenses < ~370 m from the
  dome centre. (2) a flat blue band at the horizon = a long, fogged ground plane meeting the unfogged photo: end the
  ground ~60 m out so the photo's own ground takes over. (3) the engine's cartoon sky + clouds draw over a dome unless
  `sky={false}` (LookDev does it automatically via hasSkyDome; shots must do the same). (2026-11-18)
- **Pale lavender day sky = the sky's sun in front of the lens** (2026-11-19): `forSet` used to aim the key light along
  the set's sun but left the SkyDome's sun at the mood default, so its halo + horizon glow washed the sky the camera
  looked at. `forSet(mood, sun)` now moves the sky's sun and moon too (WORLD.md 2). Projects made before that date:
  copy `sky: sun ? { ...b.sky, sun: { ...b.sky.sun, dir: sun }, moon: { ...b.sky.moon, dir: sun } } : b.sky` into
  their `src/world/moods.ts` forSet.
