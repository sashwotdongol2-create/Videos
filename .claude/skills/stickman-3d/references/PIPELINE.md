# Pipeline (hybrid): files, commands, data formats, APIs

`<skill>/package/stickman3d.py` runs every stage (`--help`). Blender BUILDS sets; Remotion + three.js (the inkbeat
engine in `src/engine/`, MIT) RENDERS everything. A project made by `stickman3d.py new`:

```
stickman.json        machine paths          shots_plan.json   [{"id":1,"w":0,"note":".."}]  (w = first word index)
SHOT_FRAMES.txt      "<id> <a> <b> <words>" PLAN.md ASSETS.md CREDITS.md AGENT_BRIEF.md
voice/               vo.txt, vo_tags.txt, gen_v3.py, tighten_beats.py, take*/
audio/               make_cues.py build_design.py final_mix.py, SOUND_BRIEF.md (from references/SOUND_BRIEF_TEMPLATE.md), stems/
blender/             lib.py sets.py tex.py get_assets.py export.py cards_plan.json, sets_<name>.py, assets/<id>.blend,
                     tex/ (tex/baked/ = export --bake output, tex/ph/ = Poly Haven PBR sets from `assets tex:<id>`)
public/              sets/<set>_<state>.glb+.json (+ _lm.png lightmap atlas with --light), clips/<Clip>.glb, props/<id>.glb, vehicles/<id>.glb+.json,
                     cards/<id>.png + meta.json,
                     fonts/ (Poppins for captions and tags), voice.wav, mix.wav, film.mp4
src/                 engine/ (inkbeat: View + grip camera, post ink/grade/bloom/DOF, moods, frame/subFrame)
                     char/ (painter + cast.ts: the SAME cast spec as stickman-short's cards)
                     char3d/ (Stickman.tsx, rig.ts, art.ts, face.ts, props.ts)
                     world/ (assets, set, camera, moods, registry, weather, Card, Tag, vehicle)
                     film/ (Film.tsx, time.ts, transitions.ts)   shots/ (index.ts, types.ts, sNN.tsx)
                     Root.tsx Final.tsx Cast.tsx CardExport.tsx LookDev.tsx
                     words.json film.json shots.gen.json edit.json clips.gen.json cards.gen.json
out/                 stills/ (f_*.jpg, grip_*.jpg, sheet.jpg, grip_sheet.jpg, lookdev_<name>_<i>.jpg), logs/qa_console_<cmd>.txt,
                     lookdev_<name>.jpg + lookdev_<name>_cams.json, qa/levels.json,
                     castsheet.png, film_draft.mp4, film_sub.mp4, film_blur.mp4, draft.mp4, final.mp4, qa_sheet.jpg
build/               the Remotion bundle (rebuilt when src/ or public/ change; `tsc --noEmit` gate first)
```
Remotion compositions (src/Root.tsx): `Film` (the picture: stills, drafts), `FilmSub` (4 sub-frames per frame for motion
blur), `Final` (film.mp4 + captions + mix), `Cast` (cast lineup), `CardExport` (flat-card PNGs), `LookDev` (sets +
vehicles + a stand-in under a mood from one camera; input props, see LookDev below).

## Commands and what they make
| command | does | time (1660 Ti) |
|---|---|---|
| `doctor` / `config --set K V` / `install-skills` | checks tools + config; stores machine paths; copies the sister skills | - |
| `new <dir>` | template copy, stickman.json, painted textures, junctioned node_modules | seconds |
| `ref <url>` | ref/ref.mp4, 1 fps sheet, 2 fps frames, transcript | ~1 min |
| `voice --takes 2` | ElevenLabs takes -> 180 WPM -> most expressive -> public/voice.wav + src/words.json | ~1 min |
| `timing [--frames N \| --end-s S]` | shots_plan.json -> SHOT_FRAMES.txt, shots.gen.json, film.json; length = last word + 0.7 s, or N frames / S s (a segment cut from a finished mix; timing prints a NOTE when public/mix.wav differs) | <1 s |
| `clip Walking_IP ...` | Mixamo FBX (config `mixamo_downloads`) -> public/clips/<Clip>.glb + src/clips.gen.json | ~5 s each |
| `prop shovel rusted_spade_01` | blender/assets/<id>.blend, a .blend or a .glb -> public/props/shovel.glb | ~5 s |
| `export <set> --state night day [--bake] [--bake-res N]` | Blender builds `sets_<set>.py`, strips ink hulls/lights/camera, links textures past toonify's HUE_SAT, writes GLB + anchors/lights JSON, prints EXPORT / WARN / BAKED lines. `--bake` bakes node-built colours (kit recolours, procedural) and emission to PNGs in blender/tex/baked/ (Cycles CPU, ~2-5 s). WARNs: node colour without --bake, material without a Principled BSDF (Mix / Transparent shader: glTF makes it an opaque slab), open shell (hole + no wall), coplanar faces < 1 cm apart, > 1.5 M polygons. Opt-outs: `o["open_ok"]`, `o["coplanar_ok"]`, `o["beam"]` (light shaft). Ends with `export <set>: n/n state(s) exported, k WARN`; exits 1 when a state fails (missing `blender/assets/<id>.blend` -> `S assets <id>`). Always: a SLIM pass (polygons max(6000, 100000 x D^2) per object of largest size D m, DECIMATE >= 0.1; textures 256 px under 0.35 m, 512 under 1 m, else `--tex-max` 1024; `o["keep_poly"]` / `o["keep_tex"]` opt out, `--no-slim` off) and WEBP textures in the GLB (`--png` = old PNG/JPEG). `--light`: baked light, see Set look below (takes the GPU lock) | 3-13 s per state; with `--light` 2-3 min (office 155 s, airfield 124 s) |
| `assets tex:<polyhaven_id>[@2k]` | Poly Haven PBR texture set -> blender/tex/ph/<id>_diff/_nor/_rough.jpg (use with `sets.pbr_mat`) | seconds |
| `lookdev <set>:<state> [...] [--mood day] [--cams F] [--figure x,y,z\|auto\|none] [--vehicle SPEC] [--name N] [--props JSON]` | LookDev composition, one still per camera at half size (3 default views), tiled with labels -> out/lookdev_<set>_<state>.jpg (several sets: names joined by `_`) + out/lookdev_<name>_cams.json (the cameras used: edit, pass back with `--cams`); prints each view's render time and LENS BLOCKED lines | ~10 s per view (+ bundle) |
| `vehicle <id> [--from <asset>] [--yaw DEG] [--bake] [--no-wall] [--still [--steer R] [--crumple C] [--lights] [--mood M]]` | blender/assets/<asset>.blend (default `<id>`) -> public/vehicles/<id>.glb + .json through `export.py --module tools/vehicle_build.py` (origin, facing, wheel names, 1 cm wall, the export checks); `--still`: LookDev of it -> out/lookdev_vehicle_<id>.jpg | 2-4 s (+ ~30 s still) |
| `library list` / `save <set>` / `use <set>` | shared set library (config `set_library`; empty so far) | - |
| `castsheet` | 3D cast lineup (one row, any cast size) -> out/castsheet.png | ~15 s |
| `cards [--meta-only]` | flat-card fallback: blender/cards_plan.json -> public/cards/<id>.png + meta.json + src/cards.gen.json | - |
| `still 10 75 130 [--scale 0.5] [--props JSON] [--tag T]` | Film frames -> out/stills/f_<frame>[_T].jpg + sheet[_T].jpg; prints every QA console line (out/logs/qa_console_still.txt); `--props` = input props (inline JSON or a file), e.g. the old look `{"up": {"agx": false, "hdri": false, "soft": false}}` | ~10 s each (25-40 s with the bundle start) |
| `cam <shot> [--export-only] [--no-paths]` | camera authored in background Blender: `ShotDef.paths` -> public/cams/paths/<shot>.json (CamPaths still), spec blender/cams/<shot>.json -> one eased keyed move -> public/cams/<shot>.json (world/blenderCam.ts) + blender/cams/<shot>.blend + out/cams/<shot>_sheet.jpg; `CAM CHECK` / `CAM FAIL` / `CAM WARN` lines, exit 1 on a FAIL (see Blender cameras below) | ~2 min (25 s `--export-only`) |
| `grips 75 130 --who hero [--hand right\|left\|both] [--dist 0.9]` | Film with input props `{"grip":{...}}`: close-up on that hand -> out/stills/grip_<frame>.jpg + grip_sheet.jpg | ~13 s each |
| `render [--draft] [--frames A-B]` | Film -> public/film.mp4. Full = FilmSub (4 sub-frames, 180 deg shutter) + ffmpeg tmix; `--draft` = half size, sharp (out/film_draft.mp4, marked draft); `--frames A-B` (or `N`) = review clip of film frames A..B inclusive (blur: sub-frames 4A..4B+3), film.mp4 untouched | draft 240 f: 31 s; blur 240 f: 72 s, 316 f: 90 s |
| `final [--draft]` | film.mp4 + captions + mix.wav -> out/final.mp4 (+ loudness). `--draft`: voice (+ public/bed.wav) as a draft mix -> out/draft.mp4. The full final refuses a draft picture or a draft mix | 10.5 s film: 82 s |
| `levels [--stems DIR] [--cues F] [--cue-offset N] [--json F]` | tools/levels.py: mix vs voice -> out/qa/levels.json; `qa` runs it too | 4-15 s |
| `qa [video]` | flicker.py, analyze_pacing.py, 2 fps contact sheet, loudness, levels + the manual checklist | ~20 s |
| `status` | checklist of every step + `NEXT:` the step to do (a file existing is not an approval) | - |

QA console: still, grips and render run Remotion with `--log=verbose` (the only level that forwards the page's
console) and print only lines containing `LENS BLOCKED` (world/camera.ts lensClear), `TAG OUTSIDE` (world/Tag.tsx),
`REACH:` (a grabbing hand more than 0.03 m short of its target: move the character or the prop), `ARM FAST:` (an arm
turning > 4 rad/s during a grab: a slower reach / lift) or `GRIP:` (grip camera found no joints of that character in this shot at this frame; on a transition frame the shot
without the character logs it too, so take grips inside a shot); the full list goes to out/logs/qa_console_<still|grips|render>.txt and the run
ends with `QA console clean (...)` or a count. Fix every line before the final render.

## Set look (2026-11-17, the RicksClips set pass; defaults for new projects)
What changed and where (measured against RicksClips frames, proof: `D:\resource\stickman\charstudy\look\`):
- **Ink on characters only.** `post.outline.setInk` (PostFX; default false; `<View setInk />` overrides per shot):
  set geometry, vehicles and loose meshes write depth + normals with alpha 0.4 (under the edge gate 0.5), so DOF and
  SSAO still see them and they hide ink behind them, but get no ink. Inked: drawn figures (their own art line),
  `<Card/>` / `<Tag/>` ("occlude"), and any mesh with `userData.ink = true`. Held props are not inked (RicksClips draws
  them clean). Set meshes marked no-ink in Blender now get `userData.outline = "noink"`: depth-only with setInk false,
  hidden like before with setInk true. `setInk: true` = the old look.
- **Baked light** `S export <set> --state ... --light [--light-samples 256] [--light-density 64] [--light-px 3.5e6]
  [--light-res 1024]` (blender/export.py `light_bake`): Cycles (OptiX/CUDA, CPU fallback) bakes DIFFUSE irradiance
  (no albedo) of the state's lights + world into ONE atlas `public/sets/<set>_<state>_lm.png`: every bounce, the sky,
  emissive surfaces, area / point / spot lights, NOT the sun's direct light (a Light Path "Ray Depth > 0" node on each
  SUN keeps its bounce; three.js draws the sun live with shadows). AO (1 m) goes into the PNG alpha. How: each static
  mesh (modifiers applied, own data) gets a `lightmap` UV layer (smart project), squares shelf-packed into the atlas
  (density 64 px/m, shrunk to the pixel budget), all baked meshes JOINED into one temporary copy so Cycles bakes once
  (per-object bakes cost ~0.7 s each: 120 objects = 200 s), a 3x3 smoothing, sRGB(irradiance / k). Skipped:
  `o["no_bake"]` (doors, propellers, anything animated; also on a parent), beams, glow-only materials, < 0.01 m2.
  JSON `lightmap`: `{file, k, size, direct: [baked light names], entries: {<node>: {uv, rect}}}`.
  Trade-off: light is baked into a separate lightmap (not into the base colour), so the live sun / key, its shadows
  and the mood colours still work; but the bounce itself cannot move: moving the sun far, opening a baked door or
  relighting the state needs a re-export (one state = one lighting).
- **three.js side** (world/set.ts + engine/mat/materials.ts): meshes with an entry get a per-(material, uv) toon clone
  with `lightMap` (channel = the UV index, intensity k x pi). The patched toon shader then: hemisphere x `hemiKeep`
  (0.25) x AO, unshadowed directional fills (rim, fill, lens fill) x `fillKeep` (0.35) x AO, + lightmap x `lmGain`
  (0.6); the shadowed key stays. Knobs per shot: `forSet(mood, sun, { bake: { lmGain, hemiKeep, fillKeep, aoFill } })`
  (office day test: lmGain 1.1). Characters and unbaked meshes are untouched. `<SetLights/>` skips lights that are in
  the lightmap (`baked` prop to add them anyway).
- **PBR on sets**: `sets.pbr_mat(name, "<polyhaven_tex_id>", tint, normal, rough)` (diffuse x tint, roughness map,
  OpenGL normal map; get it with `S assets tex:<id>`), `lib.toonify(..., pbr=True)` keeps asset normal + roughness
  maps (pbr=False = old flat). toToon copies `normalMap` and puts the glTF roughness texture in the unused `aoMap` slot;
  `TOON_SPEC` adds a normalised Blinn-Phong highlight from the directional lights (strength `uSpec` 0.45, global
  `spec` in the mood toon).
- **Post passes** (engine/post/pipeline.ts; both pure functions of the frame, no history):
  `post.ao` SSAO (SAO-style, 16 spiral taps, fixed per-pixel rotation + 2 depth-aware blur passes; default on,
  radius 0.35 m, intensity 0.6, bias 0.015, maxPx 70; drawn figures receive none but occlude the floor);
  `post.shafts` light shafts (bright-pixel mask -> 40-tap radial blur toward the sun's screen point; default on,
  strength 0.35, threshold 1.1, colour #ffe6c0; off when the sun is behind the lens or > 2.6 screens away; View fills
  `dir` from the mood's key). Per shot: `<View ao={false | {radius, intensity}} shafts={false | {strength, ...}} />`.
- **A/B stills** without editing shots: Remotion input props `{"look": {"setInk": true, "ao": false, "shafts": false,
  "bake": false}}` (engine/core/View `lookSwitch`; bake false = lightmaps ignored, old hemi/fills).
- Measured cost (1660 Ti, 1080x1920, Film render, concurrency 6): see GOTCHAS -> Speed.

## Data formats
- `src/shots.gen.json` `[{"id","a","b","words"}]` (global frames, written by `timing`; a = 3 frames before the first
  word, last shot ends 0.7 s after the last word unless `--frames` / `--end-s`).
- `src/edit.json` `{"xfade": 9, "cuts": [ids], "kinds": {"<id>": "dissolve" | "cut" | "push" | "whip"}}` = how each shot
  is ENTERED (default dissolve over `xfade` frames centred on the boundary; ids in `cuts` stay hard cuts; an unknown kind
  throws). Transitions live in `src/film/transitions.ts`. They are CSS on the shot layers (transform / filter /
  opacity, no WebGL cost) and a pure function of the frame position, so they also motion-blur. Both shots are drawn only
  inside each kind's window: dissolve ±xfade/2; push -1.5..+1.5 (the outgoing shot punches in to 1.3 with blur from 4
  frames before, a 3-frame blurred cross-blend, the incoming lands from 1.15 over ~8 frames); whip -4..+4 (38-degree
  virtual pan, both shots slide LEFT side by side with horizontal blur proportional to speed, stretched just enough
  that no black gap opens); cut none. Tuning constants: `PUSH`, `WHIP` in transitions.ts. Film wraps each shot in
  `ShotCtx` (world/registry.ts), so per-shot clones (useSetScene, props) never share one THREE object while two
  canvases render.
- `public/sets/<set>_<state>.json`: `anchors` (empties named `anchor_*` + points the build returns), `lights`
  (`kind` SUN / POINT / ..., `dir` = toward the light, `pos`, `color`, `energy` W), `warnings`. Coordinates: three =
  (x, z, -y) of Blender; a Blender rotation about +Y is a three rotation about -Z.
- `blender/cards_plan.json` `{"static": [{"who", "exprs": [...], "poses": [...], "prop": null, "mouth": false}]}`.
- Grip request (`S grips` writes out/stills/grip_props.json): `{"grip": {"who": "hero", "hand": "right", "dist": 0.9}}`.
- Segment of a finished film: cut mix/voice sample-accurately (`atrim=start_sample=a*1600:end_sample=b*1600` at
  48 kHz), shift the words, then `S timing --frames <mix frames>` (no hand-patching of film.json); `S levels
  --cue-offset <first frame>` for a cue list of the whole film.

## LookDev (src/LookDev.tsx, `S lookdev`)
Look-dev stills of exported sets before any shot exists (SKILL.md step 7: every set from 3 angles before the STOP).
- `S lookdev road:day tree:tree --mood day` -> out/lookdev_road_day_tree_tree.jpg: the listed sets loaded together
  (`needSet`, drawn with `useSetScene`; at night each set's point lights via SetLights), the mood from the FIRST set's
  sun (`forSet(mood, sunDir)`, `nightSet(sunDir)` for night; moods: day dusk night sunrise golden lamp cold), a 1.7 m
  grey stand-in for scale, LENS BLOCKED checked per set and view. No set + `--vehicle` = a plain 60 m+ ground disc.
- Default views (no `--cams`) from the first set's content box (meshes under 60 m across, so ground, sky and road
  planes do not count; radius R clamped 2-22 m) centred on the anchor `look` / `focus` / `center` / `centre` / `hero` /
  `subject` if the set exports one, else the box centre: 0 = eye-level 3/4 (1.4 m high, 35 degrees off +Z), 1 = medium
  (-30 degrees, 3-16 m high), 2 = high wide (60 degrees, 6-50 m high). Sets fill the frame (fit 0.6 / 0.85 / 1.15 x R);
  vehicles alone are framed whole (1.0 / 1.3 / 1.7 x R). The default cameras look from the +Z side (Blender -Y), the
  side buildings face in the asset convention. Stand-in `auto`: half way toward view 0 and aside (beside a vehicle).
- `--cams cams.json` = `[{"pos": [x,y,z], "look": [x,y,z], "fov": 50, "roll": 0}]` in three coordinates (any count:
  one still each). The run writes the cameras it used to out/lookdev_<name>_cams.json, so edit that and pass it back.
- `--vehicle "car_sedan,at=0:0:4,yaw=0.6,steer=0.4,crumple=0.6,dist=1.2,lights=1,tint=#ffffff"` (repeatable) adds a
  `<Vehicle/>` (`at` x:y:z, three coords).
- Input props of the composition (for your own `npx remotion still build LookDev --props=F`): `{"sets": [["road",
  "day"]], "mood": "day", "cams": [...], "cam": 0, "figure": [x,y,z] | "auto" | null, "vehicles": [{id, at, yaw, dist,
  steer, crumple, bodyRoll, bodyPitch, lights, tint}], "exposure": 0, "blur": 0.6, "far": 250, "sky": true}`. Every
  render logs `LOOKDEV CAM i {kind,pos,look,fov}` for all cameras (console.error; the CLI reads it for the labels).
- Measured (1660 Ti, half size): ~10 s per view after the first (~27 s with a cold bundle), 3 views 31-48 s.

## Vehicles (src/world/vehicle.tsx, `S vehicle`)
- **Export** `S vehicle car_sedan` (or `S vehicle hero_car --from car_sedan`): builds `tools/vehicle_build.py` through
  `blender/export.py --module ... --out public/vehicles/<id>.glb` (same material checks, `--bake`, coplanar /
  open-shell WARNs as sets). The GLB convention:
  - metres; origin on the ground under the centre of the bounding box; FRONT toward Blender +Y = three -Z (the
    ASSETS.md asset convention), the car's left toward Blender -X; a source facing elsewhere: `--yaw DEG` (about Z);
    a model longer across X than along Y is reported.
  - wheels: objects named `<anything>wheel_FL/_FR/_RL/_RR` (the asset convention `<id>_wheel_FL`, F/R = front/rear,
    L/R = the car's own left/right) are used as they are; otherwise the 4 lowest ROUND parts (side view square within
    20 %, thinner than tall, 0.3-1.6 m, on the ground), one per quadrant, with rims / brake discs inside each tyre's box
    parented to it. Each wheel gets its origin at its box centre and is RENAMED `wheel_FL / wheel_FR / wheel_RL /
    wheel_RR` in the GLB. `WHEEL none found` = no spin / steer (one-mesh wreck). A vehicles builder should name the
    four wheel objects `<id>_wheel_FL/FR/RL/RR`, origin at the wheel centre, spinning on local X.
  - every mesh gets a 1 cm inward SOLIDIFY wall (applied on export): car models are open one-sided shells, and
    FrontSide culling otherwise opens holes into them (export WARNs disappear; `--no-wall` turns it off). Doubles the
    triangles (car_sedan 39.7 k polys -> 3.1 MB GLB).
  - materials kept; node-built colours WARN like sets -> `--bake`.
  - Tested 2026-11-16 on replica_aD73: car_sedan, cruiser, tow_truck, car_suv, pack_sedan (wheels by name) and car_wreck
    (none), 2-4 s each, 0 WARN except car_suv (4 coplanar body / wheel pairs, 0 mm).
- **Shot**: `needs: [needVehicle("car_sedan")]`, then inside `<View>`:
  `<Vehicle id="car_sedan" at={[x, groundY(set, x, z), z]} yaw={yaw} dist={d} steer={0.3} crumple={c} bodyRoll={0}
  bodyPitch={0} lights={night} tint="#2a6ad8" name="a" />`
  - `at` = ground contact centre; `yaw` = the Stickman convention: 0 drives toward +Z, heading = (sin yaw, 0, cos yaw)
    (`heading(yaw)`, `along(at, yaw, d)`); positive yaw and `steer` turn LEFT.
  - `dist` = metres travelled (the same pure function of t that moves `at`): wheel angle = -dist / r about the axle
    (`wheelAngle`). Never accumulate.
  - `steer` (rad) turns the front wheels about +Y. `bodyRoll` (rad, + lowers the car's right side: leaning out of a
    left turn) and `bodyPitch` (rad, + lifts the nose) tilt the body (not the wheels) about the point under the centre
    at axle height.
  - `crumple` 0..1: the front 35 % of the body squashes toward the centre along its length (up to 42 % of that zone at
    the bumper at 1), the centre goes in deepest (pole / tree hit), the bonnet folds up along one crease (up to 0.36 m),
    the front bulges sideways, deterministic wrinkles; front wheels and lamps move back with it. CPU vertex deformation
    of this instance's own geometry copy (ink and shadow passes see it), recomputed only when the value changes;
    `crumplePoint(dims, c, x, y, z)` is the pure function. car_sedan at 0.6 reads as a crashed front (bonnet ridge,
    wrinkled bumper).
  - `lights`: true or `{spot: 180 cd per lamp (0 = none), distance: 60, beams: 0.14 (visible additive cones, 0 = none),
    halo: 0.9 m (Glow sprites, 0 = none), tail: true}`. Lamp positions come from materials named like
    headlight / taillight (those materials then glow), else from a ray onto the front / rear at 42 % of the height,
    30 % of the width out (emissive discs, 1.5 cm proud). SpotLights cast no shadows. Night test: pools on the road
    + beams under nightSet.
  - `tint`: a colour recolours the auto-picked paint (the largest saturated body material that is not glass / tyre /
    trim: car_sedan `Material.071`), or `{color, material: "name" | /regex/}`.
  - `name`: one instance per (shot, name) like useSetScene (two of the same car in a shot need two names); `shadows`
    (default true).
  - `vehicleInfo(id)`: dims (length, width, height, front / rear z, wheelR, wheelbase), wheels (r, centre), how they
    were found, paint material, lamp positions (GLB frame: front = -Z).
- groundY / lensClear do not see vehicles (they ray-test the set only).

## Shot module API (`src/shots/sNN.tsx`, register in `src/shots/index.ts`)
```tsx
const Comp: React.FC<{ t: number; tg: number }> = ({ t, tg }) => {      // t = shot seconds, tg = film seconds
  const set = getSet("parlour", "night");                                // loaded because it is in `needs`
  const v = walkSpeed("hero", CLIPS, "Walking_IP");                     // m/s at the character's scale
  const x = X0 - walked(t, v, 0, stop, 0.4);                           // root motion; stop = distance / v
  const at: V3 = [x, groundY(set, x, z), z];                            // feet on the surface (ray from 1.6 m)
  const cam = lens(arc(pos, look, t, 0, 2.5, -20, 0.2), 56);           // or push/glide/spike/poseAt
  lensClear(set, cam, look, `sNN t=${t.toFixed(2)}`);                   // QA: nothing between lens and subject
  return (
    <View mood={forSet("lamp", sunDir(set))} cam={cam} t={tg} focus={look} blur={1.4} near={0.1} far={120}>
      <primitive object={useSetScene(set)} />                           {/* never set.scene */}
      <Stickman who="hero" t={t} tg={tg} at={at} yaw={-Math.PI / 2} cam={cam.pos} clips={CLIPS}
        expr={[{ at: 0, e: "happy" }, { at: Wl(12, 3), e: "shocked" }]} talk={[[4.0, 4.8]]}
        prop={{ id: "shovel", mode: [{ at: 0, mode: "carry" }, { at: 3, mode: "plant" }] }} />
      <Tag text="6 FEET" at={[0.4, 1.5, -1]} rot={[0, 0.3, 0]} size={0.22} t={t} show={[1.2, 3.5]} />
      <StageQA cam={cam} subject={look} who="hero" keep={["hero"]} set={set} label={`sNN t=${t.toFixed(2)}`} />  {/* LAST */}
    </View>
  );
};
export const s03: ShotDef = { id: 3, needs: [needSet("parlour", "night"), needClip("Walking_IP"), needProp("shovel"), needTag()], Comp };
```
Imports: `getSet, groundY, needSet, sunDir, useSetScene` (world/set), `arc, glide, lens, lensClear, push, spike`
(world/camera), `forSet, nightSet` (world/moods), `View` (engine/core/View), `Stickman, walkSpeed, jointsAt`
(char3d/Stickman), `needClip, walked` (char3d/rig), `needProp` (char3d/props), `Tag, needTag` (world/Tag),
`Card, needCards` (world/Card), `Snowfall, Puff, Glow, LightBeam, glowMeshes, poseNode, SetLights` (world/weather),
`Vehicle, needVehicle, vehicleInfo, heading, along, wheelAngle, crumplePoint` (world/vehicle),
`W, Wl` (film/time), `StageQA` (world/stage), `Dust, Debris, Motes, VolumeBeam, SoftPoints, RocketFire, SmokeTrail,
Sparks, Glints, flicker` (world/fx), `spring, lag, bounce, wobble, burst, h01` (engine/core/physics).
- `W(i)` / `Wl(i, shotId)` (film/time.ts): when word i lands on screen (2 frames early), film / shot seconds.
- **Assets only via `needs`** (world/assets.ts useNeeds blocks the frame until they load); never a loader in a shot.
- **Every frame is a pure function of t**: no Math.random / Date / performance.now, no state carried between frames
  (weather.tsx `rng(seed)` for seeded randomness; module caches only for loaded assets, bounded).
- **Sets: always `useSetScene(set)`**, never set.scene. During a dissolve two shots render in two canvases and a THREE
  object has one parent, so each shot gets its own clone (shared geometry and materials, LRU 12, keyed by ShotCtx).
  Animate set nodes in THAT clone: `const scene = useSetScene(set); poseNode(scene, "bellPivot", {axis: [0, 0, -1],
  rot}); const wins = glowMeshes(scene, /_w\d$/)`. Material fixes can go on the loaded set (materials are shared).
  groundY and lensClear ray-test the loaded set in its rest pose (a swung or moved node is not seen by them).
- **Moods**: day, dusk, night, cold, lamp, golden, sunrise through `forSet(id, sunDir(set))`; night exteriors through
  `nightSet(sunDir(set))` (never `forSet("night")`: its day multipliers clip). View provides its mood to children via
  `useMood()` (engine/core/View). Numbers: LOOK.md -> Engine look.
- **Clips**: `ClipKey {clip, from, fade=0.3, offset, loop=true, speed, step}`; consecutive keys cross-fade; gestures and
  idles play pose-to-pose by default (`step`, see 3D stickman), walks stay continuous. Root motion is
  yours: integrate `walkSpeed` with `walked(...)` using the SAME fade as the clip cross-fade (no foot slide).
- **Expressions**: any of the painter's 43 (`ALL_EXPRESSIONS` in src/char/drawCharacter.ts; 15 dialogue reactions added
  2026-11-24: eager, excited, awkward, embarrassed, relieved, deadpan, hopeful, proud, surprised, curious, annoyed,
  thinking, wince, shy, sheepish; `blush` is a new face extra), held >= 0.7 s; blinks are
  automatic (0.5-2.3 s, 3 frames); every change makes the body react (laugh / cheer hop twice, shocked / scared jump,
  others tilt the head: 3D stickman below); `talk` intervals flap the mouth (quoted lines only).
- **Hands**: `jointsAt(who, clips, t, at, yaw, prop?)` returns the drawn joints (pass the Stickman's `prop` when it
  holds one, or the hand is off by the contact solver's push). Attach papers, letters, dropped items to
  `P.RightHandMiddle1` / `P.LeftHandMiddle1`.
- **Sound-off tags**: `needTag()` in needs, then `<Tag text at rot size t show />` (world/Tag.tsx), about one per 15 s;
  long text splits on 2 lines (or "\n"). QA logs `TAG OUTSIDE SAFE AREA` when a plate corner leaves x 0.05-0.95 /
  y 0.05-0.85 or the plate touches the caption band y 0.62-0.78.
- **Point lights**: `<SetLights set={set} />` (world/weather) adds the set's exported POINT lights (intensity =
  W / (4 pi^2) x k, default k = pi; far window pools need more, _night3d used k = 10). `castShadow` is opt-in (at most
  `maxShadows` 2 lights, 512 px, about +9 % render time) and only works for lights outside closed meshes.
- **Night / weather** (world/weather.tsx): `Snowfall` (instanced flakes, pure function of t), `Puff`, `LightBeam`,
  `Glow` (halo sprite), `glowMeshes` (lit windows -> unlit HDR yellow that blooms), `poseNode` (pose a named set node
  from its rest pose every frame). Example: `D:\resource\stickman\_night3d\src\shots\s06.tsx`.
- **Grip close-ups**: Remotion input props `{"grip": {"who", "hand": "right"|"left"|"both", "dist"}}` (`S grips`) swap
  the lens for a vfov-35 close-up of that hand, read from world/registry `SHOT_JOINTS` (written by every Stickman each
  render with its shot id and frame, so a dissolve's other shot or an earlier frame of the tab is never used: all
  bones, Head = drawn head centre, HeadBone, PropEnd, PropTop; `JOINTS` keeps the by-cast-id view). Seen from the
  shot camera's side, or from the hand's outer side when that hand is behind its own body. Tag QA is off during grips.
- **Staging QA** (`<StageQA/>`, world/stage.tsx, from blocky-shorts planet_check): put it LAST inside the View, after
  every Stickman. Each frame it reads the shot's registered joints (SHOT_JOINTS, so the real drawn body, root motion
  included, not `at`) and logs `STAGE LENS_IN` (lens < 5 cm from or inside a body, or inside set geometry with `set`),
  `STAGE BLOCKED` (another character on the lens -> `subject` line; `who` = the subject's own body, exempt),
  `STAGE OVERLAP` (two bodies as capsules: head, torso, sticks, hands, held prop, > 1 cm into each other; `allow`
  pairs that really touch), `STAGE INSIDE` (with `set`: head / neck / hips / hands / knees inside a closed set mesh) and
  `STAGE FRAMING` (`keep` characters' head + hips inside the frame with a 2 % margin; a character entering from off
  screen is not in `keep` yet). No FACING check: the flat head always turns to the lens. A single-plane wall has no
  inside: a body walked through one is caught by lensClear aimed at that body, not by INSIDE. `every: 2` halves the
  cost on long shots. Tested in `D:\resource\stickman\_t_blocky` (s02 / s03 provoke every check).
- **Effects** (world/fx.tsx, ported from blocky-shorts v1.2; pure functions of t and seeds, never inked):
  `<Dust t t0 p k />` (landing / fall / launch puff ring, k ~0.35 for a cup, 1 for a body), `<Debris t t0 p n seed
  color ground />` (toon chips that land and stay), `<Motes c hs n t />` (dust in a light volume: 70-110 per set),
  `<VolumeBeam p dir len r r0 color op t />` (a shot's own shaft, op 0.3-0.7), `<RocketFire t len w light />` inside
  `<group rotation={[Math.PI, 0, 0]}>` for a torch / candle / fire (alpha-blended outer layers, < 12 Hz flicker, a
  heat point light), `<SmokeTrail t t0 pos dir />`, `<Sparks t t0 pos dir />` (gunfire, forge, grinder),
  `<Glints p t />`. Particles fade within 0.25-0.75 m of the lens; aim beams beside faces and bodies (a beam through
  a figure washes it out).
- **Action effects** (world/fx_action.tsx, from the Zack D. WWI reference; full table + timings in
  references/ACTION_FX.md): `<Explosion/>` (red or fire palette), `<GunShot/>` + `recoil()`, `<BloodHit/>`, `<Wound/>` /
  `<CensorMosaic/>`, `<SlowBullet/>` + `bulletAt()`, `<Grenade/>` + `throwArc()`, `shake()`, `rackFocus()`, `useJoint()`,
  map toys `<MiniBlast/>`, `<ShellArc/>`, `<WavingFlag/>`. Transitions `spin`, `vwhip`, `flip` (and the CAMERA_STUDY kinds `through`, `dive`, `wipe`) in src/edit.json kinds.
- **Physics** (engine/core/physics.ts, verbatim from blocky-shorts; re-simulated from a fixed start at 1/240 s every
  frame, never stepped): `bounce(tau, h0, {e})` -> {y, squash, impacts} for a dropped prop (dust on `impacts[0].t`),
  `spring(drive, t, hz, zeta)` / `lag(...)` for secondary motion (a hanging sign, a lantern, a bag strap, a flag:
  sample the driver from the same pose function), `wobble(t, t0, a)` after an impact, `burst(...)` for custom
  particles. Randomness only from `h01(seed)`.
- **Tears and sweat** (char3d/tears.tsx): `<Stickman tears={[2.4]} sweat={[5.1]} />` (shot seconds). Drawn drops in
  the painter's ink on the head layer (they follow tips, squash and the facing flip): 0.5 s forming at the lower lid,
  then run down with stick-slip leaving a wet streak, detach at the chin and fall; one drop per eye, 0.6 s apart.
  Sweat runs from the temple and drips at the jaw. Drop ~6 % of the head width (smaller does not read on a phone).
- **Portrait framing**: the horizontal view is only ~0.56 x the vertical fov; stage people within ~1 m of each other
  for two-shots, use vfov 50-60 in rooms, keep the camera inside the set (lensClear on every frame of a move).

## 3D stickman (src/char3d) = the RicksClips character (style sheet: RC_CHARACTER_STYLE.md, numbers: LOOK.md)
- Files: `Stickman.tsx` (STYLE, pose mapping, contact solver, puppet layer, the component), `rig.ts` (Mixamo skeleton,
  clip timeline, pose-to-pose time remap), `art.ts` (flat layers: canvas textures, materials, light tint, quads),
  `face.ts` (blinks; the old sphere decal is unused), `props.ts`. The drawings come from `src/char/drawCharacter.ts`
  (`drawHeadArt`, `drawHatArt`, `drawTorsoArt`, `drawSkirtArt`, `ART`): the SAME hats, hair, faces, torso patterns and
  accessories as the flat cards, so a new hat / pattern / accessory added to the painter appears on both. The art
  layers draw with `ART_MODE` on (inside `withArtPen`): the measured pen on head, torso AND hats, a larger face
  (`ART.face`, `ART.eyeR`), a curled handlebar moustache, crisp top hat / bowler / ranger / chef versions and hair as
  tufts under a covering hat; the flat cards keep their old drawings (LOOK.md -> 3D stickman has the numbers).
- One cloned Mixamo skeleton per cast id; all clips bind by bone name. Size from `spec.height` (default 1.7 m): the
  skeleton's bind pose is mapped so a standing idle is spec.height tall with a `STYLE.headFrac` 0.29 head (scale `s`
  and leg factor `legK` in `dimsFor`; legs are no longer squashed, legK ~1.0). The torso is a rigid cut-out along the
  spine (hips -> neck), arms leave it on its top cap and legs at its bottom; hands and feet stay where Mixamo put them.
- Drawn as: torso layer (cast pattern + tie / bowtie / scarf / badge / apron), head layer (skin, hair, face with
  glasses / beard / moustache), hat layer (lifts off on big reactions), skirt layer ('dress'), ink tubes for arms and
  legs (one curve through elbow / knee), dot hands, stroke feet. All unlit, tinted by the View's mood (`figureTint`),
  real cast shadows (invisible copies of the layers turned toward the mood's key light), `userData.outline =
  "silent"` (engine/post/pipeline.ts: the figure hides set ink behind it and gets none itself; cards and tags keep
  `"occlude"`).
- `<Stickman who t tg at yaw cam clips expr talk prop walking facing react shadow grab />` (`grab`: Hands on world props below). New, all optional:
  `facing` (1 = the drawing looks screen right, -1 = left; default = the side the body faces, so two people facing
  each other look at each other), `react` (0..1 scales the reaction to expression changes; 0 for a background
  figure that must not hop), `shadow` (false = no cast shadow).
- **Pose-to-pose timing** (`ClipKey.step`): every clip key is held and snapped (a pose every `STEP.every` 16 frames,
  5-frame snap with anticipation and overshoot, 6 % drift) EXCEPT locomotion (`CONTINUOUS` in rig.ts: walk, run, jog,
  march, climb, crawl, push, pull, carry, `_IP`, `_RM`), which stays continuous so root motion matches the feet.
  Per key: `step: false` (smooth mocap, e.g. a slow sit-down that must read in full), `step: true` (force it),
  `step: {every: 24, snap: 6, drift: 0.04}` (longer holds: closer to the reference's 12-25 frame holds; use it on
  idles). `jointsAt`, `poseQA` and held props see the same remapped pose. Fast repetitive clips (Waving,
  Clapping) alias at 16 frames: give them `step: {every: 8, snap: 3}` or `step: false`.
- **Procedural poses** (`char3d/poseEngine.ts`, added 2026-11-20): acting beats (talk, point, shrug, react) written
  as numbers instead of a Mixamo download. 15 poses in `POSES` (neutral, talk_shrug, point_forward, hands_on_hips,
  shock_jump, cheer, facepalm, think, wave, arms_crossed, lean_in, recoil, sad_slump, fist_pump, present); a pose =
  upper-arm / forearm DIRECTIONS in chest space (x = character's left, y up, z forward; `lArm`/`lFore`/`rArm`/`rFore`),
  `hips` offset (m), `chest` / `head` degrees (x bend forward, y turn left, z lean right), `lFoot`/`rFoot` offsets (legs
  solve by two-bone IK, knees forward). A key list `{at, pose, snap=5}` is BAKED (~60 ms per 15 s, once per tab) into an
  ordinary clip on the Mixamo skeleton, so the Stickman solver, toon meshes, grabs and QA all apply unchanged:
  `needs: needProc("Proc_s04", keys)` (since 2026-11-24 it bakes onto the skeleton built in code, `char3d/codeSkel.ts`,
  so no Mixamo file is needed; pass a third argument, a Mixamo clip name, to bake onto that clip's skeleton instead;
  one character's clips must all share one skeleton source), then
  `clips: [{ clip: "Proc_s04", from: 0, step: false, loop: false }]` (ALWAYS `step: false`: the bake already holds and
  snaps; a second remap double-times it). Built in: hold breathing/sway, 1-2 frame anticipation, easeOutBack overshoot,
  forearm trails 1.5 frames (arm arcs), hips sink on the settle. Mix freely with Mixamo keys on one timeline (they
  cross-fade like any two clips). USE for standing gesture/reaction beats; KEEP Mixamo for walks, runs, sit/stand,
  falls, climbs and anything holding or touching a prop. Custom pose: pass a `PoseDef` object instead of a name.
  **Seated + emotion poses and emotes (2026-11-24):** `desk_rest desk_read desk_lean_in desk_lean_back desk_explain
  desk_offer desk_slide desk_shrug desk_wave desk_arms_crossed desk_slump desk_hands_up desk_chin desk_point_self`
  (table staging: forearms folded in front of the chest) and standing `hands_clasped thumbs_up palm_out point_self
  hand_raise fidget exhale`. An EMOTE is a face + a pose that change together (`EMOTES`: neutral listen read talk happy
  eager excited awkward embarrassed shy sheepish relieved deadpan annoyed hopeful proud surprised shocked curious
  thinking confused wince sad laugh ask give me wave thumbs stop); write a character's acting as one beat list:
  `const J = emoteTrack([{ at: 0, emote: "eager" }, { at: 2.7, emote: "awkward", snap: 5 }, { at: 4.1, emote: "talk", e: "happy" }], true)`
  then `needProc("Proc_jay", J.keys)` and `<Stickman expr={J.expr} .../>` (`e` / `pose` on a beat override one half).
  Known weak (test `D:/resource/stickman/_t_proc`, examples/proc_poses): facepalm hand stops at the mouth (the drawn
  arms are shorter than the skeleton's), `present` turns the face too far off a 3/4 lens, fist_pump fist near the face,
  shock_jump wind-up too small to read. Only checked at a 25 deg body yaw: still-check poses at the shot's angle.
- **Expression changes move the body** (`reaction()` in Stickman.tsx): laugh / cheer = two hops with squash and
  stretch, head tipped back, hat off for 5 frames; shocked / scared = one jump and shake; any other change = a head
  tilt held ~0.5 s and a small hop. The first expression of a shot is simply there (no reaction). The hop lifts
  everything above the legs (feet stay planted); `jointsAt` does not include it (a paper in the hand lags a few cm for
  ~0.5 s: key the expression change away from such a moment or set `react={0}`).
- 'dress' torso -> the solver's skirt (hips to a hem 0.45 of the way from knee to ankle, `skirtHem`; axis half way
  between the thighs and straight down, `skirtHang` 0.5; hem widens to keep thighs and knees inside, cap `skirtMax`
  2.4 x body radius), drawn as a flat skirt layer facing the lens.
- Contact solver (pure, per frame): elbows, hands and forearms are pushed out of the skirt and the body capsule (1.5 cm
  gap, `STYLE.clear`). The held prop's shaft is swung clear of skirt, legs, feet and body (the holder's own body only,
  not other characters). `<Stickman/>`, `jointsAt` and `poseQA` all read the same solver.
- `poseQA(who, clips, t, at, yaw, prop?)` returns metres (negative = passes through): `arm` (arms vs skirt), `leg`
  (legs poking out of the skirt), `handBody`, `prop` (shaft vs body), `grip` (farthest holding hand from the shaft
  axis; > ~3 cm reads as a hand beside it), `hem`. Sweep the shot's whole time range with the shot's own yaw curve and
  prop keys (mode blends and clip cross-fades included), not one clip in one mode; it is not wired to a console tag.
  Example sweep (s25, 220 frames: grip 0.0 cm, prop >= 0.8 cm): `D:\resource\stickman\_t_fixgb\src\shots\s25.tsx` (BLENDQA).
- Test shots of the character (walk in / point / laugh / startled, and a 40-degree arc) with a 10-character test cast:
  `package/examples/rc_character/` (built project `D:\resource\stickman\_rc_char`, proof images `D:\resource\stickman\charstudy\proof`).
- Cast sheet (`S castsheet`, src/Cast.tsx): the whole cast in one row (the camera backs off to fit), posed by the first
  idle clip. Look checks through input props: `npx remotion still build Cast out.png --props=f.json` with
  `{"camYaw": 35, "expr": "laugh", "only": ["hero"], "clip": "Waving", "t": 1.2, "mood": "lamp"}`.
- Every render writes JOINTS / SHOT_JOINTS (world/registry.ts `putJoints`) for the grip camera. Prop clones, limb tubes
  and skirt geometry are kept per character and shot (ShotCtx).

## Props (src/char3d/props.ts)
GLB normalised on load: longest axis -> +Y, working end (blade/head/bottom) at y = 0, scaled to `PROPS[id].length`.
A new prop needs a PROPS entry `{length, carry, two}` (shovel, lantern, cup, book, rifle exist). Modes:
- `carry`: right hand at `carry`. The working end hangs forward and a little out, about 1.3 rad from straight down
  (`STYLE.carryTilt`) and at least 8 cm above the ground, swung clear of the legs. It reaches about 0.55 m ahead of the
  hand, so keep other people out of that space (or switch to `plant` / `none` when the walk stops).
- `two`: both hands on the shaft; the top hand (higher and further back) at `two`. The shaft swings clear of the body
  and the other hand goes onto it. When the hands come together or level out (the throw at the end of a dig stroke)
  the direction fades to a default (working end forward and low, handle up and back) instead of flipping. Digging clips push the blade up to 0.21 m below the ground (fine in snow or dirt, not on hard floors).
- `plant`: a long tool standing on its working end, at least 0.3 m right of and 0.14 m ahead of the right foot. The
  right hand moves out past the skirt/body outline and holds the shaft; the shaft's foot steps out until the whole
  shaft is clear.
- `palm`: small props in the right hand. `none`: not shown.
Mode keys cross-fade over 0.4 s by turning the shaft about the right hand where it is drawn (direction slerped, grip
distance blended, `plant` keeps its foot on the ground; the second hand of `two` takes hold / lets go over the fade).
The Mixamo Digging throw (lower hand at the blade neck, blade near level, top hand at the hip) is the clip, not a
blend: key `plant` at the last stroke if the throw should not show. Check every hold with `S grips` before rendering.

## Flat cards (fallback: src/world/Card.tsx)
Use the painter's flat cards only for crowds and background extras, and for poses Mixamo cannot do (lie, dead, sit
without a chair model). Everyone who acts is a 3D stickman. Static states only (no walking cards).
1. Plan: `blender/cards_plan.json` (Data formats). Each entry makes exprs x poses x blink 0/1 cards (x mouth
   0/0.5/0.9 when mouth is true), so keep the list small.
2. Render: `S cards` writes src/cards.gen.json, renders CardExport to public/cards/<id>.png (1200x1300, feet at
   600,1230, headW 300, the stickman-short numbers) and measures each card into public/cards/meta.json. `S cards
   --meta-only` only re-measures. Run it again whenever cast.ts or the plan changes.
3. Shot: `needs: [..., ...needCards("extra1"), ...needCards("partner", { poses: ["lie"] })]`, then inside <View>:
   `<Card who="extra1" expr={[{at: 0, e: "neutral"}, {at: 1.5, e: "happy"}]} pose="stand" at={[x, groundY(set, x, z), z]} cam={cam.pos} t={t} tg={tg} />`.
   - Optional props: blink (0/1 fixed; omit for automatic blinks), mouth, yaw, facing (-1 mirrors), height (default
     the cast's 1.7 m), tint, lay (0..1 lean back toward the camera; 1 by default for lie/dead), shadow.
   - `tint` defaults to "auto": light from the View's mood with the same model as the 3D head, the key dropped when the
     set shadows the card. Pass a colour only to override; "#ffffff" is the old full-bright card. Auto ignores
     SetLights point lights and practicals (a card in a lamp pool does not brighten).
   - Size: a 1.7 m card is as tall as a 1.7 m 3D stickman; feet on `at`. It turns only about Y toward the camera; ink
     stops at its alpha edge (userData.outline 'occlude'). `cardHead(who, expr, pose, at, cam)` = head centre (upright
     poses only).
4. Staging: a lying card is about 1.8 m wide (fills a portrait frame under 4 m). Put it in front of or behind the 3D
   people (camera 20-35 degrees above), never in a row beside them. Test shot: `D:\resource\stickman\_smoke3d\src\shots\s02.tsx`.

## Anime reactions on the words (2026-11-24: the user wants "expressions from anime" matched to the words)
- **Anime faces** (src/char/drawCharacter.ts, `a_*`): `a_sparkle` (starry eyes, the keen ask), `a_cringe` (>_<),
  `a_blank` (white empty eyes + pale: frozen shock), `a_gloom` (-_- + gloom lines + pale), `a_cry` (T_T tear streams +
  wail), `a_cat` (:3 teasing), `a_deadpan` (-_-), `a_heart`, `a_dizzy` (spirals), `a_rage` (shout + forehead vein),
  `a_joy` (^o^), `a_shy` (hatched blush), `a_nervous` (forced smile), `a_pout`, `a_smug`, `a_dead`. They are slider
  faces with an anime eye mode (`anime`: sparkle xx blank flat tt spiral heart) and mouth (`amouth`: cat shout tiny
  wobble pout); face marks `gloom`, `pale`, `vein`, `blushLines`. An anime mouth gives way to lip-sync while the
  character talks (a shout stays and opens wider).
- **Manpu** (char3d/manpu.tsx): symbols around the drawn head on lens-facing billboards: `sweat` (big drop, slides),
  `vein`, `exclaim`, `question`, `dots` ("..." one by one), `sparkles`, `gloom` (cloud above the head), `steam`, `shock`
  (burst behind the head), `hearts`. `<Manpu who clips t at yaw cam height marks={[{ at, kind, dur?, side? }]} />` after
  the character, in shot seconds. Pop in with an overshoot, fade out.
- **On the word** (film/cues.ts): `onWords([{ word: "sat", e: "confused", mark: "question" }, { word: "down", edge: "end",
  offset: 0.1, e: "a_blank", mark: "shock" }])` gives each beat its film time from src/words.json, in order (a repeated
  word finds the next one; `after` jumps ahead). A word that is not spoken throws. `TAG_ACT` / `actFromTags` map the
  voice lines' delivery tags ("[deadpan, flat]", "[confused, polite]", "[relieved, warm]") and their punctuation to a
  face + emote + mark, as a first pass to edit by hand.
- How to act a line: the reaction lands ON the word that causes it (the listener reacts at the word's end + 0.1 s),
  one strong mark per beat, the listener keeps acting while the other talks.

## Restraint (user, 2026-11-24: "certain things are being overdone and certain things are oversized")
The first anime pass had 14 marks and 43 acting beats in 31 s, sparkle eyes six times, a "!" as tall as a head and
close shots with the head at 44 % of the width. What the approved-for-now cut uses instead:
- **Marks are accents**: 0.3-0.45 of a head, at most x1.15 in wide shots. At most ONE mark per character per exchange,
  about one per 6 s of film (that film: 4 in 31 s). `act()` warns `ACT DENSE` when two marks of one character are
  under 3 s apart. No shock bursts or "!" on ordinary surprise: the face does it.
- **Strong anime faces once or twice per film** (sparkle, blank, gloom, T_T); the rest of the acting uses the plain
  faces (eager, hopeful, surprised, curious, happy, sheepish). One tear gag, not two.
- **A pose change only when the intention changes** (ask, give, shrug), not every few words; `react` 0.25 so an
  expression change does not hop the body.
- **Framing**: singles with the head 0.30-0.36 of the width, two-shots `fill` 0.70 with the heads at `yFrac` 0.6,
  people 0.9 m apart (at 0.8 the heads crowded). Pushes 0.03 (two-shot) / 0.06 (single): `frac_still` ~0.15.
- Captions 76 px. `TAG_ACT` gives a face for most delivery tags and a mark only for confused, deadpan, nervous, sad, angry.

## Dialogue staging in portrait (2026-11-24, from analysing the first film frame by frame)
- **Cameras** (world/dialogueCam.ts): in 9:16 the WIDTH decides the distance. `twoShot(headA, headB, { fill: 0.74,
  yFrac: 0.55 })` puts both heads across 74 % of the width with the heads a little under the middle (top third free
  for cards and marks, little dead table below); `single(head, { widthFrac: 0.30-0.36, az })` for a close shot (see Restraint). Head
  centres: seated = at.y + height x 0.855. A shot under an end card: `yFrac: 0.33` (the card covers the lower half).
  One slow push per shot (`push(pos, look, t, 0, rate)`: two-shots 0.03, singles 0.06; slower reads as a still).
- **Singles are SOLO**: draw only the subject and its marks. Two people at a table sit ~0.8 m apart, so a lens on one
  head always catches a slice of the other (and their marks). Pass `who` + `keep` = the subject to StageQA.
- **Seated**: feet sink 0.24 m behind a closed table block 0.6 m high (hips hidden, torso and arms act); 0.8 m apart,
  bodies yawed 0.8 rad toward each other.
- **Acting** (char3d/act.ts): `act(beats, { seated, mirror, markSide })` turns one word-keyed beat list into pose keys,
  expression keys and marks. The person on screen right who faces screen left takes `mirror: true` (poses gesture with
  the right arm; unmirrored, her gesture pointed at her partner as a thin line). `markSide` -1 for the left person, 1
  for the right: marks sit on the outer sides. `gestures(fromWord, toWord, poses, every)` changes the pose every few
  words of a long line (one held pose per line read as frozen). Explaining to the lens uses open eyes (`talk` = eager);
  closed-eye faces (happy, a_joy, a_cat) stay under ~1 s on a speaker.
- **Marks**: "..." rises diagonally from the outer shoulder; sizes and counts: see Restraint above.
- **Cuts**: a dissolve between two different framings of the same people is a double exposure: enter dialogue shots by
  a hard cut (edit.json `cuts`) or a whip. Captions are Poppins 800 like the cards, at y 0.76-0.78.
- **Check**: `S qa out/final.mp4` (frac_still <= ~0.12, mean saturation >= 25, 0 FAIL) and a 5 fps contact sheet read
  frame by frame (`ffmpeg -i final.mp4 -vf fps=5,scale=190:-1 f_%04d.jpg`, tiled 10 across).

## Meter-format films (2026-11-24, films 75-77)
- `src/MeterOverlay.tsx`: the title card, a labelled meter keyed to words (`keys: [{ word, edge, offset, v }]`, in order),
  TRICK chips (`tricks: [{ from, to, tag, text }]`, resolved in order) and the end card (`endLine`, `endWord`). A film
  writes `src/meter.ts` (`METER: MeterCfg`) and puts `<MeterOverlay cfg={METER} />` in Final.tsx; captions stop at
  `meterEnd(METER)`. Repeated words: give `after` (film seconds) on the key.
- Sets for work scenes in world/codeSet.tsx: palettes `elevator` (wood panels, brass rail), `meeting` (mint walls),
  `homeWarm`, `homeCool`; `Whiteboard` (marker lines + a strike that can change on a word) and `ElevatorCar` (with a
  floor display). A cream room measured saturation 12.5 / 100 % grey: walls carry the colour.
- A video call = two Views stacked in one shot (each `width={1080} height={956}` in its own div), both rooms in one
  world far apart, frontal webcams, name tags and an active-speaker ring drawn in HTML over the tiles. Captions at
  y 0.86 there, under the lower face.
- Before `warehouse.sh send`: delete the regenerable scratch (build/, out/film_sub.mp4, out/film_blur.mp4, out/final.mp4,
  out/film_draft.mp4, stills, public/film.mp4) and the node_modules link: the warehouse ignores none of it and a
  finished folder drops from ~220 MB to ~25 MB.
- A prop in a hand: place it at the drawn hand (in front of the chest, outer side, ~0.58 of the height), not at the
  skeleton's hand joint (the drawn arm is shorter; a cup there floated off).
- **Ten at once (2026-11-25, films 78-87).** A meter film is now three short files on a scaffold:
  1. voice it in the inkbeat kit (`films.py` entry, `python3 make_film.py <id>`; turn modes `shaky` / `rush` / `slow`
     put a wobble or a tempo on one plain take);
  2. `python package/tools/meter_film.py <id> <project dir> --shots 1,4,5,...` (the turn each shot starts on): makes the
     project, copies voice + mix, writes words / turns / lip, the shot plan, hard cuts with a whip into each aside,
     runs `timing`, and writes Final.tsx + shots/index.ts;
  3. write `src/char/cast.ts`, `src/meter.tsx` and `src/shots/scene.tsx`. The scene is `duo({ pal, hero, other?, Set,
     shots })` from `shots/duo.tsx`: sides come from x (the right person is mirrored), `seated`, `hold` + `carry` for a
     prop in the outer hand, cameras as `"two"`, `{ two: dx }`, `{ hero: az, w? }`, `{ other: az }`, `{ cam, show }`
     (an insert with nobody in it) and `"end"`. Singles: positive `az` for the person on the left, negative for the
     right.
  `MeterCfg` takes `readout` (the number beside the bar: "58K", "3/10", a name), `graphic` (drawn in place of the bar:
  a sound wave, a gift box, nothing) and `extra` (`<Pop/>` chips keyed to time: a silent count, arrows). One render +
  final is about 4 minutes for 30 s; queue the films with `python package/tools/queue_render.py <dir> <dir> ...`
  (one at a time, a time limit and a retry per step: a plain shell loop once stood still for 35 minutes behind a
  render that froze at frame 609, headless Chrome at 0 % CPU).
- Behind the heads: a light window right behind a white head merges with it, and wall text at the height of the TRICK
  chip (the top third in singles) reads as clutter. Keep windows and signs at the far edges; put words on a door or a
  board, not on a plate above the heads. Standing pairs at x = ±0.53 (at ±0.47 two "talk" forearms touched).
  A full wall of `Shelf` (6 rows) puts books behind the title card, the meter and the chip: use `rows={3}` so the top
  third is plain wall (films 91). Second batch of ten (88-97, same day): 40 minutes of rendering, no stalls.
- The voice performs a written "Ha" as a laugh, so the word is not in words.json: key that beat to the end of the
  line before it (`{ word: "too", edge: "end", offset: 0.45, emote: "laugh" }`), never to "Ha".
- Fourth batch (108-117, 2026-11-25). What the two-shot shows of the back wall is about x = -1.5 to 1.5: a sign, a
  rack or a car at x = 2.3 is only ever seen in a single. Put the one or two things that name the place between the
  heads (x near 0, y 2.1-2.2, under the TRICK chip) or low between the figures; edge pieces at x = ±1.5 at most.
  A person standing behind a `Counter` needs it at h <= 1.0 (at 1.2 only a head showed). Standing pairs that both
  gesture: x = ±0.68. The `headband` hat reads as a ring floating round the head: don't use it. A dark palette with the
  `lamp` mood warms a grey wall to pink-brown; use `day` when the wall has to stay steel grey (the vault).
  The speech check writes spoken numbers as digits ("500?", "30,000") when a turn's word count differs from the
  script: after `meter_film.py`, read src/words.json and put the words back (one token may hold two words: a beat
  then keys on "Five hundred"). Write a compound the way it is heard ("out-the-door" is one word to the check).
  A device that falls when things go well (HIS FUN in 110): keep `v` as "how well the hero is doing" and draw
  `1 - v` in `graphic` / `readout`, so the colours and the bar sounds keep their meaning.
  The `ask` and `thinking` emotes turn the standing figure towards the partner: in a hero single the speaker's face
  is then a profile at the edge of the head, on the very line the film is about. For a spoken question use
  `emote: "talk"` with `e: "curious"` (eight of the ten films were rendered twice for this). The first `clubdoor`
  palette (wall #3a2a52 with the lamp mood) was so dark that the stick limbs vanished: a night wall needs to be at
  least as light as #7658a8.
- Fifth batch (118-137, 2026-11-26: twenty films in one go, no script review). New in the template: thirteen
  palettes (`polygraph`, `cave`, `cockpit`, `cypher`, `pitch`, `casino`, `garage`, `beach`, `premiere`, `awards`,
  `cabin`, `ship`, `chalk`) and `world/props.tsx`: `HOLD_R` / `HOLD_L` for duo's `hold`, and hand props for `carry`
  (`Mic`, `Sheet`, `Phone`, `Trophy`, `RingBox`, `Ladle`, `Booklet`, `Stack`, `Board`, `CardProp`); a prop that only
  appears for one line is `carry: (hand, tg) => (tg > T ? <Stack p={hand} /> : null)`.
  Run `python package/tools/check_cues.py <dir> ...` after writing the three files and before the first still: it
  finds cue words that are not spoken, digits in words.json and unused imports (`tsc` stops on those; three still
  runs were lost to one unused `boxG`, one unused `t0` and one word the voice merged, "Flat line" -> "Flatline").
  Write the script so the speech check cannot turn words into digits or merge them: "Seven two?" was heard as "72"
  and failed four retakes ("A seven and a two?" passed), "Fourteen A" -> "Row fourteen", "Forty-one percent" ->
  "You got forty-one". Never key a beat on a hyphenated number or on "Ha" / "Hm". A film id with digits (`call911`)
  writes its generated caption file as `call___.ts`: ignore that name in the kit's .gitignore.
  Looks: `tex="stone"` draws courses of brick (a boulder became an igloo: leave `tex` off for rock); a `Flame` at
  s = 1 is about 0.9 m tall (a toaster fire is s 0.07-0.18, and an insert of it wants fov 22-24, not 34); the pale
  `classroom` palette came out grey again (use a coloured one, `meeting`); cones fanned round a trunk read as a
  windmill (palm fronds are flattened spheres that droop); a flag of three horizontal bands reads as a real
  country's (one plain colour); sky plus dark towers in a frame reads as a bar chart unless the sky is clearly blue.
  A solo film with a voice on the phone (120) gets one insert of the thing being talked about (`{ cam, show: "none" }`).
  Before scaffolding, check each new folder name against `video-review/<app>/README.md`: 133 was first called
  `tell-me-about-yourself`, the name of video 62, and `warehouse.sh send` failed three times on it (it would have
  written into the older video's folder). It is `tell-me-about-yourself-pirate` now.
- **Title lower (the owner, 2026-11-26: "from now on, we gotta move the title text etc a bit below"; the day before:
  "They're too much towards the top").** `STACK_TOP` in `src/MeterOverlay.tsx` is 228 (it was 138): the title card
  starts there, the meter 180 px under it, the TRICK chip under the meter (it ends near y 600), and `Pop` defaults to
  690. Heads in the singles start near y 820, so nothing touches. Wall pieces that name the place now want y <= 2.1
  in the set (at 2.3 the chip covers them in a single). Films 69-117 were rendered at 138. 118-137 were re-rendered at 228 the
  same day and replaced in the warehouse (the owner: "do it and replace the older height ones"). A project
  scaffolded before this date keeps its own copy of MeterOverlay.tsx, so copy the template's over it before a
  re-render. Sending a folder a second time replaces it in the warehouse (`warehouse.sh` could not do that until
  this date: the push needed the old versions of the changed files).
- Sixth batch (138-157, 2026-11-26: another twenty the same day). **Write the films as a spec, not by hand:**
  `python package/tools/meter_build.py <spec.py> [film id ...]` writes `cast.ts`, `meter.tsx` and `scene.tsx` of every
  scaffolded film from one record per film (turns, who reacts how at the end of each line, meter values per turn,
  cameras, the set as TSX). The beats come from `src/words.json`, so a cue word cannot be missing, and the imports
  are worked out from the code: twenty films type-checked with no cue errors. Format: the tool's docstring.
  **A film id must be new.** `call` and `upgrade` were already films (77-era and 104). A second key with the same
  name silently replaces the first in `FILMS`, and `make_film.py` reuses the takes cached in `vo/<id>/`, so the new
  film came out speaking the old film's lines. Before adding films: `grep -c '^ "<id>": {' films.py` must print 0.
  (The two became `pizza` and `flight`; the old two were re-voiced for the turns that had been replaced.)
  New voice modes in `make_film.py` for a film about pitch (140): `growl` (forced low, strained), `chip` (high and
  fast), `deep` (a little lower and slower); they shift a plain take and keep its length, so the cues stay right.
  New palettes: `booth`, `xmas`, `bowl`, `bootcamp`, `garden`, `precinct`, `quiz`, `paris`, `coffee`, `news`,
  `campfire`, `sunclass`, `talent`.
  Looks: with a pair at x = ±0.68 or wider the two-shot sees over a 4.6 m wall (a dark band along the top of the
  frame, above the title): write `<Room pal={PAL} d={2.5} h={6} />`. The `give` emote turns the figure to the
  partner like `ask` and `thinking` (a profile in a hero single). A wide hat (`cowboy`) is cut by the frame edge at
  the default fill: `fill: 0.58` in the duo config. Wheels or rings on the floor at the figures' x read as if they
  stand in them (the mechanic's car went on a lift with its wheels off). A `Flame` at s 0.6 is a metre-wide onion
  in the singles: a campfire is s 0.4. Wall text that must be read in the two-shot wants labels at least 0.6 wide
  (a quiz board at 0.44 was a smudge). The pale `school` palette came out beige-grey like `classroom`: `sunclass`.
  The speech check wrote "nine hundred." as `900.` and "four hundred" as `400`: put the words back in
  `src/words.json` before building. YouTube returned empty caption files for every reference this time, so no
  short was read; the script list says so.

## Code-built sets in one look (src/world/codeSet.tsx, 2026-11-24)
No Blender: a set drawn in code that belongs with the inked figures. `PALETTES` (library, classroom, cafe, dorm,
office) each give big-surface colours, a wood, ONE accent, a cream, three tones of the dominant hue for small things,
two cast colours and the light (`moodFor(pal)`). Pieces: `Room`, `Shelf` (books from the palette, never a rainbow),
`Table` (closed block for seated staging), `Window`, `Poster`, `Plant`, `Book`. Spread `SET_VIEW` into `<View>`: it turns
on set ink (the default moods leave sets un-inked, so code sets looked soft next to the figures) and keeps the
background blur low. Dress the cast from `pal.cast` (a teal sweater vanished into teal books). New place = a new
palette entry: one dominant hue, one accent, nothing else saturated.

## Sets (blender/sets_<name>.py)
Contract: `build(state)` (or `build_<name>`) returns anchors/objects; `lights(state)` (or `<name>_lights`) optional, for
the sun direction and point lights. Mark thin / striped / many-part decoration `o["no_ink"] = 1` (also caught by name
in world/set.ts NO_INK: cord, _snow, Snow, grass, flake, smoke, puff, iou, rope). Real scale, 1 unit = 1 m. Decimate
if the set passes ~1.5 M polygons (instanced grass counts every instance in the WARN).
- **Dressing density + PBR (LOOK.md -> Sets, 2026-11-17):** rooms 35-50 props, big surfaces on `sets.pbr_mat`
  (Poly Haven wood / plaster with normal + roughness), exteriors with real grass scattered on the grass ground near the
  camera zones, export `--bake --light`. Worked examples (scratch project `D:\resource\stickman\_look\blender`):
  `sets_office.py` `_dressing()` (`drop()` / `place()` put an asset on the first surface under (x, y) by ray cast,
  1.1 cm proud; `cord()` = a wire as a bevelled curve), `sets_airfield.py` `grass_scatter()` (Poly Haven grass_medium /
  bermuda clumps as linked instances, only where the ray hits `ground_grass*` / `ground_patches*`, `no_ink`,
  `no_bake`, `keep_poly`; base mesh decimated 0.5 once, shared) and `parts_dressing()`.
- The template parlour exports as `S export parlour --state night --bake --light` (blender/sets_parlour.py points at
  sets.build_parlour; export.py only imports `sets_<name>.py`, so the example shot's set could not be exported before).
- Kit recolours and procedural materials: export with `--bake`. UV-only colour is baked over the whole UV square, so
  atlases with collapsed UVs keep every swatch; position-dependent colour gets fresh "bake" UVs per mesh; lit windows
  keep an emissive texture and strength.
- Fix every coplanar WARN by moving one part >= 1 cm (decals 1.5 cm) proud. Fix open shells with a SOLIDIFY wall
  added before the ink modifier (example: `package/examples/grave_bell/sets_graveyard.py`). The template parlour
  (blender/sets.py) exports night / day / dusk with 0 WARN (`--bake`); `bell_mesh` itself has no wall, so add
  `sets.wall(o)` (SOLIDIFY before the ink hull) wherever you use it. Light shafts (`sets.light_beam`) are tagged
  `o["beam"]` and redrawn by world/set.ts as additive, unlit, ink-free, shadowless glow (`beamMaterial`, BEAM_GAIN 0.16):
  glTF cannot carry the Blender shaft shader and delivered an opaque cream slab over a quarter of the frame.
- Set sheet before building (ground, buildings, 10-15 props, materials, light states), look-dev from 3 angles
  (`S lookdev <set>:<state> --mood <mood>`), then `library save` (copies the lookdev tiles too). Legacy Blender shot modules and the shot-25 pilot: `package/examples/` (grave_bell, bunker,
  threejs_tests); the fixed graveyard set (night / sunrise / dusk, 0 WARN with --bake):
  `package/examples/grave_bell/sets_graveyard.py`.

## Blender cameras (`S cam`, world/blenderCam.ts; template since 2026-11-21)
The recommended camera for hero shots: ONE eased move keyed in background Blender with the set and stand-ins loaded,
exported every frame for three.js. Tested end to end in `D:\resource\stickman\_t_skillcheck` (s01, roadfield:day:
a 4.6 m truck along the road beside a walking partner; check roll 0, 0 reversals, ease 1.6 s, head 15 %; three.js
frame = the Blender preview). Origin: `_t_upgrade/blender/cam_test.py` (BUILD_LESSONS #105).
1. **Stand-ins.** Give the shot `paths` (shots/types.ts `CamPath`): every character / vehicle that moves (or that
   the framing depends on) as pure functions of shot seconds, the same functions the Comp uses:
   ```tsx
   const partnerAt = (t: number): V3 => { const s = walked(t, V, 0, STOP, 0.4); /* ... */ return [x, gy(x, z), z]; };
   export const s03: ShotDef = { id: 3, needs: [..., needCam("s03")], Comp,
     paths: { partner: { kind: "person", at: partnerAt, yaw: () => YAW }, car: { kind: "car", at: carAt, yaw: carYaw } } };
   ```
   `S cam` renders the `CamPaths` composition (src/CamPaths.tsx: loads the shot's needs except its own camera,
   logs `CAMPATH` lines) -> `public/cams/paths/<shot>.json`. Stand-ins: person = 0.44 m body + the 0.5 m RicksClips
   head + a red nose (facing), height 1.7 (or `height`); car = 1.75 x 1.3 x 4.4 box + red front marker; box = `size`.
2. **Spec** `blender/cams/<shot>.json` (three.js coordinates; shot-local frames; `S cam <shot>` writes a starter when
   missing; `frames` is filled from src/shots.gen.json):
   ```json
   {"set": "roadfield_day", "frames": 150, "fps": 30, "lens": 50,
    "keys": [{"f": 0,   "pos": [-5.07, 1.5, -4.5],  "look": [0.85, 1.1, -2.35]},
             {"f": 149, "pos": [-3.35, 1.6, -8.77], "look": [2.57, 1.1, -6.62]}],
    "subject": "partner", "standins": [{"name": "kid", "kind": "person", "at": [1, 0, 2], "yaw": 0.6, "height": 1.2}],
    "follow": {"name": "partner", "offset": [0, 1.3, 0], "mix": 0.3}, "previews": [0, 75, 149]}
   ```
   `lens` = vertical fov in degrees (or `"mm"` on a 24 mm vertical sensor); 2 keys = one move (Bezier auto-clamped:
   eased in and out); a key at `f < 0` or `f > frames-1` keeps that end moving (a hard cut while moving, CAMERA_STUDY);
   `follow` (optional) leans the look point toward a stand-in, baked per frame; `subject` = whose head % is reported.
   Pick the keys from the framing maths (portrait: frame width at distance d = 2 d tan(vfov/2) x 0.5625; head 0.5 m
   at 15 % -> d ~6.3 m at vfov 50) and put the lens on the sun side of the faces.
3. **`S cam <shot>`** (GPU lock; background `blender -b --factory-startup`, never the user's open Blender; ~1-2 min,
   `--export-only` ~25 s): builds the scene (set GLB + keyed stand-ins + `ShotCam` tracking `ShotCam_look`, world-Z up =
   no roll), saves `blender/cams/<shot>.blend`, exports `public/cams/<shot>.json`
   `{fps, frames: [{t, p, l, fov, roll}], check}` (three coords: x, z, -y), renders Workbench previews
   `out/cams/<shot>_fNNN.png` + `<shot>_sheet.jpg`, prints `CAM CHECK {...}` and `CAM FAIL` / `CAM WARN` lines (log
   out/logs/cam_<shot>.txt). FAIL (exit 1): roll > 0.01 deg, a move reversal, a pan reversal, an eased start / stop
   under 0.4 s (`ease_min` in the spec). WARN: tilt reversal (fine when trucking past a fixed look point), subject head
   outside 8-25 % of the frame width or out of frame, the set blocking the line to the subject's head.
4. **Hand tweak:** open `blender/cams/<shot>.blend` in Blender (the user's own session is fine for LOOKING; agents use
   the CLI only), move the `ShotCam` / `ShotCam_look` keys or the lens, save, `S cam <shot> --export-only`.
5. **In the shot:** `needCam("<shot>")` in needs and `const cam = UP().bcam ? blenderCam("<shot>", t) : <beatCam ...>;`
   blenderCam is frame-exact and interpolates the motion-blur sub-frames; past the ends it holds the end frame. Then
   `lensClear` / `<StageQA/>` / `S still` as usual: the still must match the Blender preview.
6. **Shake** is never authored in Blender: add it in three.js on explosions / gunshots only (ACTION_FX.md).
Limits: word-keyed timing has to be keyed by hand (frames of `Wl(...)` x 30); stand-ins are only as good as the
shot's `paths` (a character missing there is missing in Blender); a round 0.5 m head hides a short aimed arm from
behind unless the lens is ~50 deg off the aim line (BUILD_LESSONS #101); leave room for the lens (walls 2 m from the
hero leave no lens on that side, #105).

## Look switches (src/upgrade.ts, template since 2026-11-21)
`UP()` reads `{"up": {...}}` from the input props; every part defaults to ON:
| switch | ON (default) | OFF (the old look) | where |
|---|---|---|---|
| `agx` | AgX in the post grade + white point (unlit white lands at 0.96: heads 91-97 % white) + 0.4 "Punchy" | exposure + soft shoulder | engine/post/shaders.ts, pipeline.ts, View.tsx |
| `hdri` | Poly Haven sky HDRI (public/env/sky_1k.hdr, CC0) as a 2nd-order SH LightProbe replacing the hemisphere light (same zenith energy) + a 0.45 SH tint on the unlit 3D figures; loaded ONCE by Film / LookDev / Cast (`needEnv()`), never per shot; the plain day mood takes the HDRI's colour, every other mood keeps its hemisphere hue (`envInMood`) | hemisphere light | world/ibl.ts, View.tsx, char3d/toon.tsx |
| `soft` | sun shadows radius 5, 16-tap PCF, bias -0.0003, normalBias 0.03 | radius 1, 5 taps | engine/core/shadows.ts, LookRig.tsx |
| `toon` | 3D flat-toon figures | cards (a Stickman's own `toon` prop wins) | char3d/Stickman.tsx |
| `bcam` | shots use their Blender camera | the shot's fallback (`UP().bcam ? ... : ...`) | world/blenderCam.ts |
Old vs new: `S still 120 --tag old --props '{"up": {"agx": false, "hdri": false, "soft": false}}'` and `S still 120
--tag new`; `S lookdev <set>:<state> --name x_old --props '...'`. Re-tune knobs per set from one still with input props
`agxGain`, `agxWhite`, `agxPunch`, `iblTint` (View.tsx constants). Cost: ~+18 % per frame (16-tap shadows + probe).

## Kit (src/kit, merged 2026-11-19; all pure functions of t)
- `beatCam.ts`: the word-keyed camera (RC_CAMERA_MOVEMENT §6). Beats `{at: Wl(word, shot), subj, az, el, dist, fov?,
  roll?, move?, push?, orbit?, hold?}`; the lens travels on a sphere between beats (parallax), banks on fast moves,
  holds on punchlines. Check a still at every beat time (characters off the beat sphere, BUILD_LESSONS #32).
- `Symbol3D.tsx`: "!" "?" heart, steam, sparkle, anger vein over a head; pop-in overshoot; place from `jointOf(who, t)`.
- `Coins3D.tsx`: ballistic coins (g 9.8, restitution 0.35, spin, settle), one InstancedMesh.
- `Phone.tsx`: `PhoneInHand` (follows the right hand) + `PhoneInsert` (readable screen close to the lens).
- `Cat.tsx`: a flat ink animal card in the cast's style (sit / lick / run / stare). Example use: package/examples/black_cat.
- Mixamo clips play in place automatically (rig.ts pins the hips' ground-plane travel; height kept); move characters
  with `at` / walked().
- Lip-sync leads the sound by 2 frames (`LIP_LEAD`, faceAnim.ts).

## Parallel work
At most 2-3 agents (renders are short): one per new set (Blender) or per group of shots (TS). Each owns only its
files (`sets_<name>.py`, `sNN.tsx`) and adds its registry line; the lead reviews stills at full size. Renders and
stills go through the CLI only (it holds the shared GPU lock: one at a time).

## Hands on world props (char3d/reach.tsx; tested in D:\resource\stickman\_t_grab, examples in package/examples/grab)
- **Grip points:** `PROPS[id].grips = { name: [x, y, z] }` in the prop's normalised frame (metres; +Y = long axis,
  origin = working end / base). `keep: true` keeps the model's own axes (cups with a handle, drawers, cabinets: base at
  y = 0, centred, `length` = height). `gripAt(id, pose, name)` -> world point for a `PropPose {pos, yaw | quat}`.
- **`<WorldProp id pose name? />`** draws a prop that stays in the world (one clone per prop, shot, name).
- **`grab: Grab[]` on `<Stickman/>`** (pass the same list to `jointsAt` / `poseQA` as the 7th argument):
  `{hand: "right"|"left", target: V3 | (t) => V3, at, until?, reach?, release?}`. `at` = the contact moment (sync SFX
  to it); the hand reaches in before it and lets go after `until`. Default `reach` / `release`: >= 0.4 s and long
  enough that the arm (shoulder -> hand direction) turns <= 4 rad/s with a 25 % margin, measured from the clip pose
  where the move starts. In between, the hand swings ABOUT THE SHOULDER (direction slerped from that fixed start
  direction, distance blended, quintic ease), so neither a straight line past the shoulder nor the clip's own pose
  snaps whip it. `solveArm` (two-bone, the drawn arm lengths from the bind pose, elbow on the clip's bend side) never
  stretches: an unreachable target leaves the hand short and logs `REACH:`. Do not grab with the hand that holds `prop`.
- **Reach -> grab -> lift (pick up):** the prop sits at its rest pose until `at`, then `follow(id, rest, grip, hand)`
  carries it on the solved hand (`jointsAt(...).RightHandMiddle1`); the grab target after contact is
  `liftPath([[at + 0.1, grip], [at + 0.8, chest]])` (eased legs; keep each >= 0.4 s). Lift goal: ~0.62 h above the
  feet, 0.3 m in front. `follow` attaches even when the hand is short: a REACH: line means the prop jumped to the hand.
- **Two-hand world tool (mop, broom, shovel):** the shot defines the working end `W(t)` on the floor and a shaft
  direction; `twoHandTargets(id, W, dir, height)` -> `{lo, hi}` (lo at `grips.lo` or 0.55 L, hi 0.25 h above it);
  grab right -> lo, left -> hi; then `toolFromHands(id, P.RightHandMiddle1, P.LeftHandMiddle1, face)` from
  `jointsAt` places the tool along the line between the two REAL hands (before contact: between the two targets).
- **Low targets:** a standing idle reaches about 0.45 m from the shoulder; a table top (0.7 m) needs a bending clip
  (Mixamo `Taking_Item`, `step: false`, cross-faded in ~0.8 s before contact) and the character within ~0.4 m of the
  grip. Check with `still` + `grips` (540x960 = the default `--scale 0.5`).
