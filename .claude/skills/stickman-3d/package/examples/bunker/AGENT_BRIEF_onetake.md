# Bunker one-take — section builder brief (BLENDER)

Our own short about Hitler's last days in the Führerbunker (April 1945), in the RicksClips stickman look: flat
bean-head stickman CARDS in softly lit, ink-outlined, stylised 3D sets, 1080x1920, 30 fps, built and rendered in
**Blender 5.3 headless** (same pipeline as `D:\resource\stickman\grave_bell`). The reference video `ref/ref.mp4`
(49 s, frames sheet `ref/sheet_1s.jpg` = 1 frame/s) is our STORYBOARD: copy its staging, set dressing, colours and
beats, but everything is our own 3D build. Narration is ours (`voice/vo.txt`, word timings `src/bell_words.json`).

## THE FILM IS ONE CONTINUOUS TAKE — no cuts, no dissolves
The camera never cuts. It flies, glides, cranes and pushes through doors/doorways from place to place. The film is
built in 4 SECTIONS (`SHOT_FRAMES.txt`: id, first frame, end frame, words). Sections are joined INSIDE A BLACK
DOORWAY: every section (except the very first frame of section 1) STARTS with the camera inside darkness (≥3 frames
of black: inside a dark doorway / door gap / unlit passage) moving forward out into the space, and ENDS by moving
forward into a dark doorway until the frame is black for ≥3 frames (section 4 ends by a slow fade to black). The
motion speed into/out of the black must match (~1 m/s forward) so the join reads as one move.
Rendering: each section renders `[a-6, b+6)`; post.py joins at the section boundary frames with no blending.

## Hard rules from the user (non-negotiable)
1. **No gaps**: never any white/grey/transparent patch. Every set fully enclosed in what the camera can see (walls
   meet, floors under everything, backdrops/sky behind every exterior and every window). Check stills for holes.
2. **Contact feels like touch, nothing passes through anything**: feet ON the floor (gate), hands on what they hold
   (handshake hands meet, Eva's hand holding Hitler's hand), sitting characters ON chairs (build/scale furniture to
   the card: seat height = card's sit-pose hip height), cards never cross walls/tables/each other, props never
   intersect. Do NOT sink cards into furniture/ground to fake sitting. Check every staging from the camera's view
   AND from a top view.
3. **Smooth movement**: camera on smooth eased curves (`glide`, `push`), never jumps. Character motion from Mixamo
   cards at FULL 30 fps (card frame advances 1 clip frame per film frame; loop clips seamlessly).
4. **Mixamo for all body actions + realistic expressions**: use the motion cards below for walking, firing,
   handshakes, standing up, sitting, the phone/headset, sad idle; expressions chosen from what the line means
   (grim, sad, worried, stern; happy only at the wedding), held long enough to read (≥ 0.7 s), blinks via `blink()`.
Respect: no Nazi insignia anywhere (no swastikas, no armbands, no flags). The ending is NON-GRAPHIC: no weapon aimed
at anyone, no bodies, no blood; the capsule is just held; the gunshot is off-screen (light flicker under a closed door).

## Code
- `blender/lib.py` (scene/world/compositor/materials/outline/toonify/Card/camera/gate/render), `blender/sets.py`
  (`asset()` for Poly Haven models in `blender/assets/`, `bell_mesh`, `image_mat`, `plane`, `tiled`, `light_beam`),
  `blender/shotlib.py` (`Shot`, `W(i)` = frame of word i, `blink`), runner `blender/shots.py` (imports
  `sec1_berlin`, `sec2_wedding`, `sec3_radio`, `sec4_farewell`, each defines `BUILD = {section id: fn}`).
  Read `D:\resource\stickman\grave_bell\blender\shots_parlour.py` + `sets_street.py` as worked examples.
- More CC0 models: `blender -b -P blender/get_assets.py -- <polyhaven id> ...` (ids in
  `D:\resource\stickman\grave_bell\blender\ph_models.json`; AVOID huge trees fir_tree_01/pine_tree_01 — build trees).
  Kenney CC0 GLBs: `D:\resource\lowpoly\assets\kenney\*` via `lib.import_glb`.
- Textures: write your own in `blender/tex_secN.py` (PIL) → `blender/tex/`.
- Cards: `blender/cards_manifest.json` (2721 states), `cards_meta.json`. Cast: `hitler` (grey-green coat, toothbrush
  moustache), `hitlerWed` (black suit), `eva` (blue dress, blonde), `evaWed` (white dress + veil), `staff1..3`
  (bunker staff, officer caps / grey dress), `soviet1/2` (helmet, rifle), `duce` (Mussolini), `crowd1/2`.
  Static: expressions sad/stern/neutral/worried/sleepy/happy/angry/scared/shocked × stand/sit/hold (blink 0/1).
  Mixamo motion (pose `rig`, clip frame `cf`, full fps): `Walking_IP` (32-frame loop: hitler sad|neutral, eva
  neutral, hitlerWed neutral, evaWed happy, staff1-3 sad), `Firing_Rifle` (9: soviet1/2 angry +rifle),
  `Shaking_Hands_front` (132: hitler sad, staff1 sad, staff2 sad), `Sad_Idle_front` (85: hitler sad, eva sad
  +capsule), `Sit_To_Stand` (69: staff1-3 sad), `Talking_On_Phone_front` (240: hitler worried|sad),
  `Seated_Idle_front` (150: hitlerWed neutral|sad, evaWed neutral|sad, staff1-3 sad).
  Use: `s.key_card(c, lambda g: ("hitler", "sad", "rig", dict(clip="Walking_IP", cf=(g - g0) % 32)))`; translate the
  card's root at the walk speed so feet don't slide (≈ 1.2 m per 32-frame cycle at height 1.75).
  If a state you need is missing, report it; don't fake it with a wrong pose.

## Checking
- `scripts/bstill.sh <section> <global frame>...` → half-size stills in `blender/renders/sNN/stills/` (global render
  lock; ≤ 3 frames per call). `scripts/sbs.sh out/stills/<name>.jpg <our.png> <ref_seconds> ...` → side-by-side vs
  the reference. Look at them and iterate. Also render a top/side debug view when checking contact.
- Rendering needs the Bash sandbox disabled.

## Deliver
Your section file(s) only (`blender/secN_*.py`, optional `blender/sets_secN.py`, `blender/tex_secN.py`; never edit
lib.py / sets.py / shotlib.py / shots.py / post.py or another section's files). Final sbs sheets
`out/stills/final_secN_*.jpg` incl. the first and last 6 frames of your section (black join) and a contact check
view. Report what you built, assets (add CC0 credits to `ASSETS.md`), compromises, missing card states.
