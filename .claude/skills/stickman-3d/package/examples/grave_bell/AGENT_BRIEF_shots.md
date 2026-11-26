# Set-builder brief — BLENDER (shared by every set agent)

We are making our own version of the short "What the Grave Bell Really Meant" (RicksClips3000): flat 2D bean-head
stickman CARDS inside softly lit, ink-outlined, stylised 3D sets, 1080x1920, 30 fps. Built and rendered in
**Blender 5.3 headless**, the same process as the user's lowpoly shorts (lib → sets → shots → post). The look is NOT
low-poly/PSX: it is the reference's look (warm practicals vs deep blue night, bloom, haze, heavy vignette, DOF, ink).
Reference video `ref/ref.mp4` (59.5 s). Our narration is slower (77 s): OUR frames are in `SHOT_FRAMES.txt`
(shot id, first global frame, end frame, words); what each shot shows + reference times: `PLAN.md` §2.

## Code (read first)
- `blender/lib.py` — reset/world/compositor, `mat`, `emissive`, `box`, `add_mesh`, `outline`/`toonify` (inverted-hull
  ink + matte saturated materials), `import_glb`, `append_blend`, `Card` (flat character; states from
  `blender/cards_manifest.json`, measured heads in `cards_meta.json`; `card.head(loc, who, expr, pose, prop)` gives the
  head centre for aiming), camera helpers `push` (the channel's dolly-in, 0.128 log-zoom/s), `glide`, `spike`,
  `bake_camera`, `light`, `gate` (feet-on-ground check), `render`.
- `blender/sets.py` — `asset(id, loc, yaw, height)` appends a Poly Haven model from `blender/assets/<id>.blend`
  (already downloaded: Rockingchair_01 coffee_table_round_01 tea_set_01 barrel_stove rusted_spade_01 Lantern_01
  wooden_lantern_01 wooden_candlestick old_bed_frame painted_wooden_nightstand fancy_picture_frame_01 fir_tree_01
  pine_tree_01 street_lamp_01 wooden_bucket_01 mantel_clock_01 wooden_crate_01 brass_candleholders vintage_oil_lamp
  WoodenChair_01 wooden_stool_01 tree_stump_01 boulder_01 hanging_picture_frame_01). More CC0 Poly Haven models:
  `blender -b -P blender/get_assets.py -- <id> ...` (ids from `blender/ph_models.json`). Kenney CC0 GLBs (toon,
  good for houses/fences/trees/food): `D:\resource\lowpoly\assets\kenney\city-kit-suburban\*.glb` (building-type-a..u,
  fence*, tree-large/small, planter, path*), `food-kit\cabbage.glb` etc. via `lib.import_glb` (recolour materials to
  the reference palette). Shared props already in sets.py: `bell_mesh`, `candy_cord`, `coffin`, `image_mat`,
  `plane`, `tiled`. Textures in `blender/tex/` (made by `blender/tex.py`: snow, soil, grass, grass_autumn, dirt,
  siding_*, plaque, physician, west, certificate, iou0-5, win_night/day, planks...). Add new texture functions to a
  NEW file `blender/tex_<set>.py` (do not edit tex.py).
- `blender/shotlib.py` — `Shot` (frames, `s.card(...)`, `s.key_card(card, fn(g) -> (who, expr, pose, kwargs))`,
  `s.L(g)` global→local frame), `W(i)` = global frame of word i (see `src/bell_words.json`), `blink(g, seed)`.
- `blender/shots_parlour.py` — a WORKING example (set + cast + rocking + cameras + DOF). Copy its pattern.
- `blender/shots.py` — the runner; it auto-imports `shots_<set>.py` modules that define `BUILD = {shot id: fn}`.

## Your files (create only these; do NOT edit lib.py, shotlib.py, sets.py, shots.py, tex.py, shots_parlour.py, or
another agent's files)
- `blender/sets_<set>.py` (set builder(s) + light setups), `blender/shots_<set>.py` (BUILD for your shots),
  optional `blender/tex_<set>.py`. If lib.py truly lacks something, implement it locally in your file.

## Cards (characters)
Existing states: see `cards_manifest.json` (who/expr/pose/blink/mouth/prop). Cast: husband (ginger, moustache, black
suit), wife (plum dress, streaked bun), nightcap, redcoat (+shovel, mouth flaps), shawl (+lantern, mouth flaps),
doctor (glasses, striped nightshirt, mouth flaps, prop book), digger (+shovel), yellow (+lantern), corpse (lie),
creditor0..9 (+ticket). If you need a state that is not in the manifest, tell the lead in your report instead of
faking it (or use the nearest existing one). Missing poses solved in 3D: buried = sink the card into the ground;
dragged = `lie` card tilted (`c.at(f, loc, tilt=deg)`); digging = shovel card + bob/tilt; sitting = sink the card into
the seat (`exempt = True` for the gate); giant face = a big `scale`.
Every card keyframe: position each frame (`c.at`), state each frame (`key_card`). Blinks via `blink(g, seed)`; mouth
flaps on quoted dialogue only (mouth 0 / 0.5 / 0.9 every 3 frames).

## Look rules (channel formula)
- Camera moves ~96 % of the time: `push` 0.08–0.14 rate; `spike` on key words; `glide` for pans/rises.
- Heads ~25–35 % of frame width in CUs (cards are big: head ≈ 0.45–0.5 m) → CU camera ~4–5 m away at 34–38° vfov.
- DOF via `bake_camera(..., dof=...)`: CU f/1.2–1.6, MS f/2–3, wide f/4+.
- Night: deep blue/violet world + volume haze, warm practicals (POINT lights + `emissive` windows/lanterns ≥ 3 so the
  compositor glare blooms them). Snow: white ground (tex snow), falling flakes (particles or small emissive spheres
  animated deterministically from the frame).
- Signs/papers: image planes with our own text (tex). Sets must look like the reference set dressing at the same
  beats (study `ref/frames/f_###.jpg` — f_n is t = (n-1)*0.5 s — and full-size frames via ffmpeg).

## Checking
- `scripts/bstill.sh <shot> <global frame>...` renders half-size stills into `blender/renders/sNN/stills/still_<local>.png`
  (local = g - (a - 6) + 1). It takes a global render lock (one Blender render at a time on this GPU), so keep
  batches to ≤ 3 frames and expect to wait.
- `scripts/sbs.sh out/stills/<name>.jpg <our.png> <ref_seconds> [...]` → side-by-side vs reference. LOOK at it (Read)
  and iterate until each shot reads like the reference: same dressing, framing, light colours, character placement and
  expressions. Several iterations is normal. The gate prints `GATE` lines for cards whose feet are off the ground.
- Rendering commands need the Bash sandbox disabled.

## Deliver
All your shots implemented; final sbs sheets `out/stills/final_<set>_*.jpg`; report what you built, asset sources
(add CC0 credits to `ASSETS.md` lines: name, source, licence), compromises, missing card states.

## UPDATE (lead): Mixamo motion cards are available
Real Mixamo clips now drive the stickman limbs (pose 'rig', exported on twos):
- `wife` + prop `shovel`, expr `effort` or `smug`, clip `Digging` (cf 0..144, 4.9 s loop)
- `digger` + `shovel`, expr `neutral`, clip `Digging`
- `shawl` + `lantern` (or prop None), expr `angry`, clip `Pull_Heavy_Object` (cf 0..32, 1.1 s loop — loop it for the drag)
Use: `s.key_card(c, lambda g: ("wife", "effort", "rig", dict(prop="shovel", clip="Digging", cf=(g - start) % 146)))`
(card_index picks the nearest exported frame). Garden shot 21 + graveyard shot 25 (shovelling) + street shot 11 (drag)
should use these instead of bob/tilt fakes.
