# The user's hard rules (every film, no exceptions)

## Hybrid rules (stickman-3d only; added 2026-11-16 from the tests and Mr Miro's advice)
- **Blender builds, three.js renders.** Sets are built in Blender with detailed plugin assets and exported
  (`stickman3d.py export`); every frame is rendered by Remotion + three.js (inkbeat engine). (stickman-short keeps
  "Blender is the renderer".)
- **Characters are 3D stickmen** driven by Mixamo bones, with the painter's faces. Flat cards (`S cards`, `<Card/>`)
  only for crowds, background extras and poses Mixamo cannot do (lie, dead, chairless sit); never for someone acting.
- **Characters follow the RicksClips style sheet** (user rule 2026-11-17, `RC_CHARACTER_STYLE.md`, numbers in LOOK.md
  -> 3D stickman): flat cut-out look (head ~30 % of the height, slightly wide ellipse; narrow pill torso with drawn
  costume detail; thin ink limbs, noodle arms, dot hands, stroke feet; dark purple-brown ink, never black; unlit with
  a gentle scene tint; a real cast shadow) and puppet movement (held poses, 5-frame snaps, hop / head tip / hat lift on
  reactions, walks continuous and bouncy). We copy the STYLE, never one of their characters: every cast is our own
  design. Do not switch the pose-to-pose timing off for a whole film; `step: false` is for single clips that must
  read in full. Change a style number only with a new measurement, and write it into the style sheet.
- **Props sit on their grip point in the hand**; two-hand tools take their angle from both hands; carried props never
  cross the legs or body, and never cross another character (the solver only knows the holder: stage a carried long
  prop away from people, or switch to `plant` / `none` when the walk stops); whole actions are shown (reach, grab,
  lift >= 0.4 s, eased, the arm never turning faster than 4 rad/s). Props that stay in the world (cup on a table,
  drawer, button, mop) get grip points (`PROPS[id].grips`) and the hand is solved onto them with `grab` (reach.tsx);
  a two-hand world tool's angle comes from the two solved hands (`toolFromHands`, hands 0.25 h apart). **Never
  stretch an arm:** a `REACH:` line (hand > 0.03 m short) means move the character or the prop (or use a bending clip
  such as Taking_Item for a low target). `S grips <frames> --who <id>` close-up (540x960) of every hold is checked
  before the render.
- **WebGL set rules:** surfaces >= 1 cm apart, decals 1.5 cm proud, no open one-sided shells (SOLIDIFY wall),
  thin/striped/many-part decoration no-ink, node-built colours baked (`export --bake`), real scale. Fix every export
  WARN (or opt out per object with `open_ok` / `coplanar_ok` only when it can never be seen).
- **Ink on characters only; sets baked** (user-approved 2026-11-17, the RicksClips set look, LOOK.md -> Sets): no post
  ink on sets, props or vehicles (`setInk` stays false; the characters keep their drawn outline); every set state is
  exported with `--bake --light` (baked bounce + AO) and rendered with SSAO and light shafts on; rooms carry 35-50
  detailed props, big surfaces get PBR textures with normal + roughness, exteriors get real grass near the camera.
  Animated set nodes (doors, propellers) carry `o["no_bake"]`. Turning any of this off for a shot needs a reason in
  PLAN.md.
- **The world is colourful, deep and alive** (user rule 2026-11-19 after the Survivor v2 vs RicksClips study,
  WORLD.md): mean saturation >= 25 and grey seconds <= 20 % (`S qa`); every set state has a dominant hue + a saturated
  accent; a coloured sky with clouds / sun / moon behind every exterior and window; textured ground with grass areas
  covered by tufts; four coloured depth layers (no grey-box skylines); exteriors dressed with 20-40 props, extras and
  one moving element; hero props, signs and inserts in the cartoon style, sharp, text printed in the texture. A
  film-level style sheet may set the era palette, but never "flat colours, no textures" or an all-brown palette.
- **Camera never inside or behind geometry** along the whole move (`lensClear` every frame); **the hero is always
  sharp**; **all text inside the safe area** (clear of edges, captions, YouTube buttons): sound-off tags through
  `<Tag/>`, which checks it every frame.
- **QA console clean before the final:** no LENS BLOCKED, TAG OUTSIDE, GRIP:, REACH:, ARM FAST: or STAGE line (every shot
  ends with `<StageQA/>`: lens in a body, blocked view, bodies through each other or through furniture, heads out of frame) from `still` /
  `grips` / `render` (except a REACH: the shot wants on purpose, written in PLAN.md).
- **Every frame is a pure function of the frame number** (no Math.random / Date / performance.now, no state carried
  between frames); assets only through shot `needs`; sets drawn with `useSetScene(set)` (one clone per shot).
- **Edit forms:** dissolves by default; push-through on a reveal or a "but"; at most one whip per ~5 s; hard cuts only
  on an impact or inside black frames of a one-take join (LOOK.md -> Editing forms).
- **Shadows under objects**, never drawn over them; a contact shadow under every character and prop.
- **Sound:** effects on important actions and objects on the exact word, never on camera moves or every cut; brief the
  sound agent with `references/SOUND_BRIEF_TEMPLATE.md`; print the measured levels (`S levels`) with every mix.
- **Show the event, follow the user's reference** (user 2026-11-19, survivor3): the story's event is on screen (plane, bomb,
  fireball + mushroom cloud, blast), never only a white-out; a reference video the user gave (even in another session)
  is downloaded to `ref/` and storyboarded before planning; camera behind / over the shoulder or wide, heads <= 25 %
  of the frame in wides, <= 35 % in mediums, face close-ups only for 1-2 detail beats; a character seen from behind
  uses `<Stickman back/>` (no face). Photo skies: `sky_dome` (o["sky"]) in the set + `sky={!hasSkyDome(set)}`.
- **Speed** (SKILL.md -> Speed rules): one render job at a time, draft bakes, per-shot re-renders, early drafts.
- **Learning loop:** after every film, write what was fixed into this skill so it stays fixed.

## Picture
1. **No gaps.** Never a white, grey or transparent patch: every set fully enclosed from every camera position (walls
   meet, floor under everything, a sky dome / backdrop behind every exterior and every window). Cards cut out with a
   hard alpha edge (lib.Card does `alpha > 0.5`). Check stills for holes before the full render.
2. **Contact feels like touch; nothing passes through anything.** Feet ON the surface (`lib.gate`), hands ON what
   they hold (handshake hands meet within ~2 cm from the camera, held hands meet), seated characters ON chairs built
   to fit the seated card (seat height = card's sit hip height), cards never cross walls, tables, props or each other.
   Verify from the camera AND from a top view. Never fake sitting by sinking a card into furniture or the ground.
3. **Smooth movement.** Camera on eased curves (`push`, `glide`, `spike`), never a jump. Character motion from
   Mixamo cards at full 30 fps (one clip frame per film frame, seamless loops). Avoid pose pops (front→profile switches,
   clips cut short).
4. **Mixamo for every body action** (walk, sit, stand up, handshake, dig, pull, fire, gesture, idle) and **realistic
   expressions**: chosen from what the line means, held ≥ 0.7 s, blinks every 0.5–2.3 s.

## Character-near assets: BUILT in Blender, ours (user rule, 2026-11-18, overrides "get, don't build" below)
- Every asset a character TOUCHES or stands NEAR (desks, chairs, benches, tables, doors, windows they look through,
  the ground / track / road surface under them, props in hand, the room walls around them) is MODELLED in Blender
  for this film, in the film's own aesthetic (one style sheet: shapes, palette, ink, texture), then exported to
  three.js. Ready-made Sketchfab / Poly Pizza models next to the cast made the film look "ripped off, not ours".
- Ready-made library assets are only for the far background (distant buildings, tree lines, skies, horizon), and
  only if they match the style sheet. Write each film's split (built vs background) in PLAN.md before building.
- Build in Blender (Blender MCP / blender/sets_<set>.py), check with `look`, export with `S export`, look-dev, then
  `S library save`.

## Sets: get, don't build (user rule, 2026-11-17; now for the FAR background only, see above)
- A set or asset the set library lacks is taken READY-MADE from the Blender MCP libraries (Sketchfab, Poly Haven,
  Poly Pizza: all three allowed), imported in Blender, exported to three.js (`S export`), and saved to the library
  (`S library save`) after the user approves its look-dev. Never spend agents building a set from scratch when a
  library scene exists; hand-building is the last resort and needs a line in PLAN.md saying what nothing offered.
- If a library is switched off in the MCP for Blender sidebar (N panel), ask the user to tick it (and add the
  Sketchfab key themselves); never type keys.

## Assets (user rule, 2026-11-14)
- **Game-ready assets (user rule 2026-11-18, replaces the earlier mid-tier and "every asset is detailed" rules):**
  good textures on modest geometry. Under ~50k polygons per asset, 1-2k textures; a set under ~300k polygons and
  ~40 MB GLB. Poly Haven PROPS are fine (1-5k polygons, high quality). NO photo-scanned vegetation (Poly Haven
  jacaranda / grass / shrubs and other scans made sets 700k-1M polygons and crashed the machine): trees, bushes,
  grass and crops come from Sketchfab game-ready models (5-50k faces, preview first) or Poly Haven trees at a low LOD.
  Grass = a good ground texture PLUS low-poly instanced tufts covering every grass area the lens sees within ~25 m
  (1500-4000 instances of one shared 20-60-face mesh, WORLD.md 3); never a few big cards. Low-poly kits (Quaternius) read too
  simple next to the library sets (user, 2026-11-18). One Blender at a time; only imports under ~50 MB into the user's
  saved live file; one export/render at a time; temp on D: (C: is nearly full).
- **Asset sources (user rule, 2026-11-16):** **free Sketchfab** (CC0 or CC-BY only; never NonCommercial or
  NoDerivatives) and **Poly Haven** are both allowed for every asset, including those near characters or carrying the
  plot; search both and take the more detailed, better-fitting one (Blender MCP `search_assets` / `import_asset`,
  credit CC-BY). No store purchases, no paid generators. Heavy scans: decimate with a baked normal map; kit-bashing and
  repainting are fine.
  `generate_3d` for a one-off hero prop nothing else has, only after the user agrees (credits).
- **Do not use the local asset folders** (`D:\resource\lowpoly\assets`, Kenney kits on disk, other projects' assets).
- **Any plugin that fits the stickman look better is welcome** — pick per asset whichever gives the most detailed,
  best-matching result: Blender MCP libraries (free Sketchfab, Poly Haven, Poly Pizza), Blender MCP generators (Meshy,
  Tripo, Hyper3D, Hunyuan3D: user key + credits), the **Meshy** plugin (Anthropic directory: text/image → textured 3D
  model, textures), image generation (Antigravity/agy, Flow) for signs, posters, painted textures. Search the plugin
  catalog (`SearchPlugins`) when a need is not covered; offer installs with `SuggestPluginInstall`.
- **Held props are 3D models too** (rifle, sword, camera, book, shovel, lantern): source them like any asset and attach
  them to the card's hand (the card is drawn with an empty hand; the prop is parented at the exported hand anchor so it
  touches the hand from the camera's view, contact rule). Drawing the prop on the card is the fallback only.
- Sketchfab, Poly Pizza and the generators need the user's API keys in the add-on preferences: if missing, ask the user
  to add them (never type keys). Characters stay our own stickman cards.
- Look check before building: one look-dev still per set (asset + lighting + AO + depth haze) approved by the user.

## Process
- **Renderer (this skill): three.js in Remotion**; Blender builds and exports sets (see Hybrid rules above).
- **Plan before building** when asked (the user once asked for a Fable-model plan first, then execution on Opus).
- **Script approval gate:** show the script (formatted per `SCRIPT.md`) and wait for approval before voice/production.
- **Keep the user posted** with short progress lines; answer "how long / why so slow" with frame counts and per-frame
  seconds (see `GOTCHAS.md` → speed).
- **Voice:** ElevenLabs Brian, eleven_v3 with audio tags; **house pace 180 WPM** (tighten pauses, atempo to 180) even
  when a channel formula is faster — the video runs longer instead.
- **Captions:** one word (two short words paired), white bold, black outline, centred at y = 0.70, sentence case.
- **Thumbnail:** a frame from our own render; no text unless the user asks (they rejected text once).

## Rights and respect
- **Narration is always our own wording.** A reference video's script is copyrighted: copy its story, beats, staging
  and visuals as a storyboard, never its sentences. Facts are free; check them (state sources in `SCRIPT.md`).
- **All characters are new** stickman cards (never another project's character models). Historical people are drawn as
  our own stickman designs.
- **Every third-party file** gets a line in `ASSETS.md` / `CREDITS.md`; CC-BY credits go into the video description
  (`out/CREDITS_description.txt`). Never use audio from the reference video.
- **Sensitive history** (wars, deaths, suicides): no hate symbols or insignia, non-graphic deaths (off-screen sound,
  light flicker, closed doors), no weapon aimed at anyone, no bodies or blood, peaceful animals.
