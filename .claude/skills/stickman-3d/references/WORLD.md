# World look standard: colour, sky, ground, depth, dressing, light, hero props (2026-11-19)

Measured on 10 RicksClips Shorts (`D:\resource\stickman\cam_study\videos`) against Double Survivor v2
(`survivor2/out/final_v4.mp4`). Full study with frames: `D:\resource\stickman\analysis\rc_vs_ours\REPORT.md`
(`det/ours_out.jpg` vs `det/rc_out.jpg` show the gap in one look). Camera and framing: COMPOSITION.md. Sets'
build rules: RULES.md + SET_SHEET.md. This file says what the WORLD must look like on screen.

| measure (ffmpeg signalstats, 1 fps) | RicksClips (10 videos) | Survivor v2 | target |
|---|---|---|---|
| mean saturation (SATAVG) | 21-42, mean 29 | 18.8 | **>= 25** film mean; no set state under 20 |
| grey seconds (SATAVG < 15) | 0-34 %, median ~10 % | 36 % | **<= 20 %** of the film |

7 of the 10 RicksClips videos pass both targets; Survivor v2 fails both. The tool measures saturation only: a
lavender night scores ~30 like a blue one, so hue (purple vs ultramarine, brown mush) is still checked by eye.

`S qa` prints both (tools/world_colour.py); run it on look-dev stills too: `python -I <skill>/package/tools/world_colour.py <png|mp4>...`.

Why Survivor v2 failed: an all-brown style sheet with "plain colours, no textures"; `forSet` grade saturation x1.08;
`exposure` lifts and fog that washed skies to white; `nightSet` with no moon, stars or clouds; exteriors built only for
the story nouns; grass as a few big cards; inserts out of focus. Tone is NOT a reason to desaturate: RicksClips does
dark and sad stories (hospital night, storm at sea) in saturated ultramarine with hot warm lamps, never grey or lavender.

## 1. Colour
- Every set state has **one dominant hue + one complementary accent** written in its SET sheet (`Materials + colours`):
  blue night + orange lamps; green field + red / yellow props; brown wood office + blue / teal blueprint + red stamps.
- A film style sheet (project STYLE.md) lists the accents next to the base palette: at least 3 saturated accents
  (S >= 55 %, mid value) that appear in most frames (signs, crates, cloth, flags, doors, costume).
- Grade: `forSet` default saturation x1.25 (template since 2026-11-19; it was 1.08). Do not lift `exposure` above
  +0.2 except on white-out beats; brighten with the key / lightmap gain instead (exposure lifts wash the sky first).
- Night = deep ultramarine (`nightSet`), never purple-grey; warm practicals carry the second colour.
- White-outs (flash, memory) are the only frames allowed to go grey / white, and they are short.

## 2. Sky (never a white or flat gradient sky outside a white-out)
- The engine sky is a `SkyDome` with clouds, sun, moon and stars (engine/core/moods.ts `sky(...)`): keep `sky` on in
  every exterior and every window view. Day: deep blue top to pale horizon, `clouds` 0.3-0.5, `cloudStyle: "puffy"`
  (cumulus; the default "mixed" draws flat lens streaks that read as a stray blue band), `sunOn` where the sun is in
  frame. Dusk / golden: warm horizon, lit cloud edges, `rays`.
- The sky's sun follows the set's light (`forSet` since 2026-11-19 points `sky.sun.dir` / `sky.moon.dir` along the
  `sun` it is given). Before, the sky kept the mood's default sun: a front-lit set showed the sun halo + horizon glow
  (up to ~55 % cream) right in front of the lens and the day sky read pale lavender (pre-grade #606c84 for an authored
  #0e2f8e). Fixed on roadfield s05: sky saturation 25 -> 42, cobalt like RicksClips. If a sky still looks pale, look
  for a sun halo in frame before touching the grade (the grade itself keeps a strong blue: emulated, #0e2f8e -> (15,63,220)).
- Deeper per-shot skies are optional now; roadfield s05 uses `{ ...m0, sky: { ...m0.sky, top: "#0e2f8e", mid:
  "#2a62c8", bottom: "#78aee8", clouds: 0.5, cloudLit: "#ffffff", cloudColor: "#c8dcf6", cloudStyle: "puffy" }, fog:
  { ...m0.fog, color: "#a6c6ec" } }` (m0 = forSet("day", sunDir(set), ...)).
- Night: `nightSet` now shows the moon (`moonOn` 0.9), stars (0.35) and lit clouds (0.2) by default (template
  2026-11-19; before that the night sky was empty). A window at night shows that sky, not a flat blue.
- Add life: 3-6 bird sprites in day exteriors (slow arcs), smoke from a chimney, a flag. One moving thing per sky.
- Fog / haze tints toward the SKY colour (blue / warm), never white. `fog` > 1.5 only for a smoke beat, and then the
  sky colour still shows above the smoke.
- A photo sky dome (`ready.sky_dome`) only when it is saturated and matches; see GOTCHAS (sky domes).

## 3. Ground and grass
- Ground is TEXTURED (painted / PBR: Poly Haven soil, grass, cobbles, planks), never a flat colour or one noise
  texture reused on every surface. Different surfaces read different: road (packed earth, ruts), field (grass), street
  (stone / gravel), yard (packed earth + stones). Same texture on the road and the night street = mud everywhere.
- Grass fields are COVERED, not dotted: instanced low-poly tufts (3-5 blades, two greens, darker at the root,
  0.15-0.4 m tall) over every grass area the lens sees within ~25 m: 1500-4000 instances of ONE shared mesh
  (~20-60 faces each, so 2-4k tufts stay under 250k polygons), plus a painted grass ground texture with colour patches
  for the far part. Big blades at the lens only as a soft foreground layer, never paper-flat spikes the size of a post.
  Sources: game-ready Sketchfab grass cards (CC0/CC-BY) or tufts built in Blender; never photo-scanned grass (RULES.md).
  Proven recipe: `_tufts()` in `D:\resource\stickman\survivor2\blender\sets_roadfield.py` (~3800 tufts of 5 tetra
  blades, 3 greens with short dark blades at the root, 11 / m2 on verges and 2.5 / m2 on margins, + 3.5 % wildflowers,
  merged per 15 m chunk; the whole set incl. 3 farmhouses, 20 trees and a city came to 240k polygons, 24 MB).
  Keep tufts out of the 1-2 m in front of an insert camera (a 0.3 m blade 0.2 m from the lens fills the frame).
- Paths and dirt patches with soft edges break up the green; scatter small rocks, flowers, fallen leaves near paths.
- Trees: round-canopy game-ready trees (5-30k faces) in clusters along field edges and the far tree line.

## 4. Depth: four coloured layers in every exterior
1. Foreground at the lens (grass tufts, fence post, crate, branch) - soft.
2. The action (cast + hero prop) - sharp.
3. Mid layer of PLACE landmarks 15-80 m out, in colour: for a city - tiled roofs, a temple roof, chimneys, power
   lines, cranes, a harbour, laundry, signs; for the country - farm houses, a cart, a bridge, rice paddies, poles.
4. Far: hills / tree lines / skyline with real silhouette and colour, hazed toward the sky colour, then the sky.
- Reusable builders (survivor2 `sets_roadfield.py`): `_minka` (farmhouse: plaster, cedar skirt + posts, Poly Haven
  `grey_roof_tiles` tinted #9ab0e0, shoji openings, chimney anchor for shot smoke), `_city` + `_prism` (a whole
  skyline of gable-roofed blocks in ONE mesh, 4 wall + 3 roof colours), `_trees` (round-canopy blob trees in one
  mesh), `_farm` (laundry, cart, sunflowers, barrels, firewood), `_jizo` (red-bib roadside statue = accent).
  Roadfield s05 wide frame went from saturation 20 to 32 with them (`analysis/rc_vs_ours/verify/roadfield_before_after2.jpg`).
- Untextured grey boxes are BLOCKOUT and never reach a render. A skyline is a textured or painted model with windows,
  roofs and colour variation, or a painted backdrop card.

## 5. Dressing (life)
- Exteriors get the same density rule as rooms: **20-40 small props** across the camera zones, in clusters, plus
  **background extras** (flat cards are fine far away) and **one moving element** per set (smoke, birds, laundry,
  a flag, a cart, steam, leaves).
- Every frame should show >= 5 things to look at besides the hero, and >= 3 saturated accents.
- Rooms keep the 35-50 prop rule (LOOK.md -> Sets) and must not repeat one desk / chair model across the whole room:
  vary at least 3 furniture models or colours.

## 6. Light
- One strong key with crisp, readable character shadows (sun 30-45 deg up, or a lamp), against a coloured fill; rim
  light on heads in night and interior shots.
- Practicals glow (bloom) and throw a warm pool on the floor/wall (`SetLights`, `glowMeshes`); windows in a dark room
  throw a shaft (`post.shafts` or `VolumeBeam`).
- Interiors are not one even brown: a bright warm pool + a cooler darker surround (RicksClips hospital, mine, shop).

## 7. Hero props, signs and inserts
- A hero prop (the one the line is about) is drawn in the CHARACTER style: bold flat colours, 2-3 readable details
  (dial, label, stripes), and it carries ink (`userData.ink = true` on its meshes, or the Blender custom property
  `ink` = true; sets stay ink-free) so it reads as part of the cartoon. Plain untextured boxes are not hero props.
- In-world text is printed INTO the object's texture in perspective (banner, sign, calendar, label), with an era font;
  never a sticker plane with a soft blurred halo floating on the object. `<Tag/>` stays for sound-off key facts only.
- Inserts (a button, a document, a map, a photo): the object fills 40-70 % of the frame, SHARP (DOF only behind it),
  lit by a key, on a contrasting background; a hand in the insert is a proper stickman hand (dot + limb) or none.
  Never a soft blob, never an insert that is all one colour.

## 8. Characters' colour (with RC_CHARACTER_STYLE.md)
- Every speaking character has one signature costume colour + one accessory, different from the others; no cast of
  identical white shirts. Era-correct is fine (khaki kokumin-fuku, dark kimono, red-trimmed cap): just saturated
  enough to read against the set.

## 9. FX and finish
- Debris = flat scraps (paper, ash flakes, splinters) that tumble; never spheres (they read as popcorn / snow).
- Weather and particles on mood beats: rain streaks, steam, dust motes in shafts, embers, smoke trails.
- Motion blur and DOF never smear the hero: check the frames of fast moves (`S still`) for a blurred / blocky face;
  `blur` (View DOF) <= 1.4 on character shots, more only on inserts' backgrounds.

## Look-dev gate (before `S library save` and before shots)
Per set state, one look-dev still with the real cast, then check:
- [ ] `world_colour.py` on the still: saturation >= 24 (night >= 22); not under 20.
- [ ] Sky visible in exteriors and windows: coloured, with clouds / sun / moon; no white or flat sky.
- [ ] Ground textured; grass areas covered by tufts; road / street / field read as different surfaces.
- [ ] Four depth layers; mid layer of coloured place landmarks; no grey boxes.
- [ ] >= 20 dressing props outdoors (35-50 in rooms), extras, one moving element, >= 3 accents in frame.
- [ ] Strong key + readable shadows; practicals glow with a pool; head pops (COMPOSITION.md §1.4).
- [ ] Hero props and signs in the cartoon style, text printed in the texture.
