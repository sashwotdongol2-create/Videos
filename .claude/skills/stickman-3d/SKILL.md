---
name: stickman-3d
description: EXPERIMENTAL hybrid of stickman-short — RicksClips-style Short with real 3D stickmen (bean head with drawn face, pill body, stick limbs) driven directly by Mixamo bones, detailed sets built in Blender and exported as GLB, rendered fast in three.js/Remotion with inkbeat ink, grade and motion blur. Use only when the user asks for the 3D stickman / hybrid / three.js version, or says /stickman-3d; the normal stickman request still goes to stickman-short.
---

# Stickman 3D (hybrid: Blender builds, three.js renders, 3D stickmen)

EXPERIMENTAL sibling of `stickman-short` (that skill stays the production pipeline until this one has shipped films).
Everything runs through `<skill>/package/stickman3d.py` (`--help` lists commands); `S = python <skill>/package/stickman3d.py`
below, run inside a project (or add `-p <dir>`). `S status` prints every step with [x] / [ ] and the NEXT one to do.
Tested on three projects, no film shipped yet: `D:\resource\stickman\_smoke3d` (parlour, push transition, cards, tag),
`_gb3d` (Grave Bell shots 24-25 with the real mix), `_night3d` (night + snow). Status and evidence:
[references/HYBRID_PLAN.md](references/HYBRID_PLAN.md).

> **START HERE: [references/MASTER_WORKFLOW.md](references/MASTER_WORKFLOW.md)** is the A-Z order for every Short: each
> stage lists the files and sections that apply, which file wins when two disagree, and the gate before each STOP.
> (Merged 2026-11-19 from the friend's stickman-3d-skill branch; the user's dated rules still win.)

| reference | open it when |
|---|---|
| [references/MASTER_WORKFLOW.md](references/MASTER_WORKFLOW.md) | always first: the A-Z order, precedence, conflicts resolved |
| [references/BUILD_LESSONS.md](references/BUILD_LESSONS.md) | before planning, and after every problem: dated finding / fix / rule rows (append one per problem) |
| [references/CAMERA_STUDY.md](references/CAMERA_STUDY.md) | every shot's camera, transitions and framing: the measured numbers that win every camera conflict, plus `camqa.py` |
| [references/RC_CAMERA_MOVEMENT.md](references/RC_CAMERA_MOVEMENT.md) | every shot's camera: measured RicksClips moves, written with `src/kit/beatCam.ts` |
| [references/ACTION_FX.md](references/ACTION_FX.md) | explosions, gunshots, blood + censor, slow-mo bullet, grenade throws, shake, map pops, and the spin / vwhip / flip transitions |
| [references/MOTION_EXPRESSION.md](references/MOTION_EXPRESSION.md) | animating: gestures, prop lag, object physics, symbols (faces: LOOK -> Acting wins) |
| [references/DESIGN_DETAIL.md](references/DESIGN_DETAIL.md) | cast, props, sets, light, captions: the RicksClips finish in detail |
| [references/RULES.md](references/RULES.md) | always: the user's hard rules (+ the hybrid rules at the top) |
| [references/PIPELINE.md](references/PIPELINE.md) | steps 3-10: files, commands, data formats, shot-module API, characters, props, cards, sets |
| [references/LOOK.md](references/LOOK.md) | look numbers: 3D stickman, moods (day / night / sunrise), camera, editing forms, depth |
| [references/RC_CHARACTER_STYLE.md](references/RC_CHARACTER_STYLE.md) | designing a cast or changing the character: the measured RicksClips style sheet (proportions, line, colour, face, headwear, movement in frames) |
| [references/FORMULA.md](references/FORMULA.md) | writing the script and directing shots (measured RicksClips formula) |
| [references/COMPOSITION.md](references/COMPOSITION.md) | step 3 and every shot: where things sit in the frame (camera height, horizon, shot-size mix, thirds, head contrast), the script-word -> frame table and the plan checklist (measured on 10 RicksClips videos) |
| [references/SCRIPT.md](references/SCRIPT.md) | step 2: story shape, format, push-back rule, voice files |
| [references/GOTCHAS.md](references/GOTCHAS.md) | anything slow, broken, flickering, dark or inked wrongly |
| [references/SETUP.md](references/SETUP.md) | step 0: programs, keys, MCP servers |
| [references/AGENT_BRIEF_TEMPLATE.md](references/AGENT_BRIEF_TEMPLATE.md) | briefing a set or shot agent (2-3 agents at most) |
| [references/SOUND_BRIEF_TEMPLATE.md](references/SOUND_BRIEF_TEMPLATE.md) | briefing the real-sound agent (step 9) |
| [references/WORLD.md](references/WORLD.md) | steps 3, 7, 8, 10: what the WORLD must look like (colour + accents, sky, ground + grass, 4 depth layers, dressing, light, hero props, inserts), measured on 10 RicksClips videos vs Survivor v2, and the look-dev gate |
| [references/SET_SHEET.md](references/SET_SHEET.md) | steps 3 + 7: the set-sheet format and the detail rules for every new set |

> **CAMERA (binding, measured; merged 2026-11-20).** The numbers in [references/CAMERA_STUDY.md](references/CAMERA_STUDY.md) (31 RicksClips / Celyx / Knox Shorts, frame by frame) override every older camera, transition and shot-mix rule (RC_CAMERA_MOVEMENT, COMPOSITION camera height + shot mix, LOOK camera) where they differ. Write cameras with the word-keyed `beatCam`:
> - **Rhythm:** a shot change every ~3.5 s, at least 75 % of them on a word onset (±4 frames).
> - **Transitions:** about 75 % continuous (travel-into-view, 8-frame dissolve while pushing, zoom-through, whip, foreground wipe), hard cuts only while the camera moves on both sides.
> - **Motion:** the camera never stops (a `hold` beat is a calm 5 %/s push, not a freeze); push about 10 %/s, pull-outs on 15 % of beats. ~~roll at most 3° on at most 1 beat in 5~~ (user 2026-11-21: no roll, one eased move per shot, see LOOK + CAMERA below).
> - **Shot mix + angles:** medium about 30 %, at least 20 % of shots with no character (establishing + inserts); about 75 % eye level, 10 % high, 5 % low, 3-5 % ground level.
> - **Framing:** heads never cut by an edge; no set prop between the lens and a face. (Head 30-40 % of the width in a medium shot is superseded by the user's 2026-11-21 rule: head ~12-18 %, character AND environment, no face-filling close-ups.)
> - **Engine and QA:** use `frameHead` for faces, `enter` / `exit` carried moves and `FgWipe` for foreground wipes, and `faceClear` in every Stage. Before delivery, `python package/tools/camera/camqa.py <project> out/film.mp4` must print `CAMQA PASS`.

> **CHARACTERS (2026-11-20): real 3D meshes by default** (head / torso / hat / hair / skirt turn with the body, flat
> unlit drawing + hull outline, `src/char3d/toon.tsx`); `toon={false}` on a `<Stickman/>` brings back the old
> camera-facing cards. Details + known weak spots: [references/LOOK.md](references/LOOK.md) -> 3D stickman.

> **LOOK + CAMERA (2026-11-21, template default; tested in `_t_upgrade` + `_t_skillcheck`).** Every new project renders
> the Blender-like look: AgX + white point + 0.4 Punchy in the grade, the Poly Haven sky HDRI (`public/env/sky_1k.hdr`,
> CC0) as an SH light probe instead of the hemisphere light (loaded once by Film), soft sun shadows. Each part switches
> off from the input props (`src/upgrade.ts`: `{"up": {"agx": false, "hdri": false, "soft": false}}`; `S still --props`).
> **Hero shots get their camera authored in Blender:** `S cam sNN` (spec `blender/cams/sNN.json`, background Blender,
> stand-ins from `ShotDef.paths`) -> `public/cams/sNN.json` -> `blenderCam("sNN", t)`. beatCam stays for the rest.
> **User camera rules (2026-11-21, win over CAMERA_STUDY where they differ):** ONE smooth eased move per shot in one
> direction; no roll; no jitter or re-aims; shake only on explosions / gunshots; RicksClips framing = character AND
> environment, head ~12-18 % of the frame width, no face-filling close-ups. Details: PIPELINE.md -> Blender cameras,
> LOOK.md -> Engine look + Camera.

> **D.B. COOPER FILM UPGRADES (2026-11-21, template default; project `D:\resource\stickman\h67`).**
> - **Night:** `nightReal(sunDir(set))` (moonlit navy, RicksClips-bright: ~36-50 value, few blacks) + `<NightSky t={tg}/>`
>   + `needNightSky()` + View `sky={false}` (real Poly Haven "Rogland Moonlit Night" CC0 sky, `public/env/night_sky.jpg`,
>   rebuilt by `package/tools/night_sky.py`); `nightWoods` under canopies; `cabinNight` for dark interiors with
>   downlight pools (`<SetLights/>` now renders SPOT lights exported from Blender).
> - **Depth of field is always on** (user rule): View enforces a visible blur (`maxBlurPx >= 5`, tight focus range);
>   near-field blur is soft so camera-near `<Tag/>`s stay readable. Put `focus` on the subject in every shot.
> - **Palette:** dusk graded to the measured RicksClips palette (cobalt sky + sand/orange, no magenta);
>   `python -I package/tools/palette.py <outdir> '{"name": [videos]}'` measures sat / value / dark share / swatches.
> - **Worn props:** `wear={[{id, from?, to?}]}` on `<Stickman/>` + `needWorn(id)` (src/char3d/worn.tsx) for things on the
>   body (vests, strapped bags, parachutes): drawn inside the torso, nothing floats.
> - **Vehicles:** `nodes={{ part: { rot?, pos?, visible? } }}` on `<Vehicle/>` animates named parts (stairs, gear, rotors).
> - **Render:** long films render in retrying chunks: `python package/tools/chunk_render.py <project> [scale] [--final]`
>   then `S final [--draft]` (one 6-worker render crashed at 86 % and lost 26 min). Save every draft under its own name
>   (`draft2.mp4`, ...): `S final --draft` overwrites `out/draft.mp4` (draft 1 of this film was lost that way).
> - **GPU lock:** the CLI writes its PID into the lock and breaks a lock whose owner died (a killed agent once held it
>   for 4.5 h); bundling happens under the lock. Keep backups out of `src/` and `build/` (tsconfig excludes build/out).
> - **User picture rules from this film:** never a partial face/body, nothing floating, one action once (continuity), the
>   shot points at an object the script names, characters stay plain (no extra detail), aesthetic over accuracy.

> **ANIME REACTIONS ON THE WORDS (2026-11-24, workshop; the user's direction).** Faces `a_*` (sparkle, >_<, white-eyed
> shock, gloom, T_T, :3, -_-, ...), manpu symbols round the head (`char3d/manpu.tsx`: sweat drop, vein, ! ? ...,
> sparkles, gloom cloud, steam, shock, hearts) and `film/cues.ts` to put each one ON the word that causes it
> (`onWords`), with `TAG_ACT` mapping the voice lines' delivery tags to reactions. PIPELINE.md -> Anime reactions.
> **NO HAIR (user, 2026-11-24).** Everyone is drawn bald (`HAIR_DEFAULT = false` in src/char/drawCharacter.ts; a hair
> string only counts with " keep"). Tell people apart by torso colour, costume, glasses / tie / hat.
> **RESTRAINT (user, 2026-11-24): "overdone and oversized".** Marks are small accents (one per character per exchange,
> about one per 6 s), strong anime faces once or twice per film, pose changes only with a change of intention, singles
> with the head at a third of the width. PIPELINE.md -> Restraint.
> **DIALOGUE STAGING (2026-11-24, workshop).** `world/dialogueCam.ts` (twoShot / single for 9:16), SOLO singles,
> `char3d/act.ts` (`act` with `mirror` / `markSide`, `gestures`), hard cuts between dialogue shots. PIPELINE.md ->
> Dialogue staging in portrait. Read a 5 fps contact sheet of every draft before showing it.
> **EXPRESSIONS + LOOK KIT (2026-11-24, workshop).** 43 face expressions (15 new dialogue reactions + `blush`), seated
> `desk_*` poses and EMOTES (face + pose in one beat, `emoteTrack`), and code-built sets from a palette
> (`src/world/codeSet.tsx`, `SET_VIEW` turns on set ink). Details: PIPELINE.md -> Procedural poses and Code-built sets.

## Speed rules (user-approved 2026-11-19 after survivor3 lost hours to GPU contention)
- ONE render/bake job at a time on this machine: never run several render-heavy agents + Blender bakes together
  (parallel bundles crash ~1 run in 3, bakes block the GPU queue for 10+ min). At most one shot agent renders at a time.
- Drafts: `S export <set> ... --draft` (64 light samples, ~4x faster; full samples only for the final), `S render --draft
  --scale 0.25` for story/framing checks, and after the first full draft re-render ONLY changed shots:
  `S render --draft --shots 3,5` (renders those shot ranges, splices them into out/film_draft.mp4), then `S final --draft`.
- Review with short preview cuts (a 10 s `--frames` range + the mix) rather than many still rounds; get a first draft
  to the user early.

## Steps (stop for the user's OK where marked STOP)
0. **Ready.** `S doctor` until `ready`. Load the Blender + Mixamo MCP tools (ToolSearch) when sets or clips are needed.
1. **Project + reference.** `S new <dir>`; optional `S ref <url>` (storyboard only, never its words or audio).
2. **Script** per SCRIPT.md + FORMULA.md (through `master-script` + SHORTS_FORMULA.md when installed), including the
   push-back check against the script guide. Mark the 2-4 nouns per sentence that get their own picture (camera beats,
   RC_CAMERA_MOVEMENT §5.1) and add a sound-cue column. STOP for approval.
3. **Plan** `PLAN.md`: shot table (beat, set + light state, characters, Mixamo clips, props, camera move, how the shot
   is entered, words, sound-off tags), cast, sets, sound beats. **Composition per picture, not per sentence**
   (COMPOSITION.md §3 + §5): each row also gets frame type, size, camera height, subject position, second element,
   leading line, foreground and what is behind the head; run the §5 checklist over the whole table before the STOP. Sets: run `S library list` FIRST and use a saved set
   (or its base with a new era kit) wherever one fits; plan a new set only when none does, and write its sheet as
   `blender/SET_<set>.md` (SET_SHEET.md format). Each set state names its dominant hue + accent, sky, ground surfaces,
   mid-layer landmarks and moving element (WORLD.md). STOP.
4. **Voice** `voice/vo.txt` + `voice/vo_tags.txt` -> `S voice --takes 2`. This also writes `src/lip.json` (lip-sync). A character's mouth follows the voice only inside its `talk={[[a, b]]}` ranges (shot seconds): give them to on-screen speakers, never to listeners under narration. Swapped the voice by hand? Re-run `python voice/lip_track.py public/voice.wav src/words.json src/lip.json`.
5. **Timing** `shots_plan.json` (first word index per shot) -> `S timing` (`--frames N` when cut to a finished mix);
   `src/edit.json` transitions: `kinds` dissolve (default) / push / whip / spin / vwhip / flip / through / dive / wipe / cut (ACTION_FX.md, PIPELINE.md -> Data formats, LOOK.md -> Editing).
6. **Cast + motion + props.** `src/char/cast.ts` - design every role BY HAND (RC_CHARACTER_STYLE.md §9: one strong torso colour, a costume pattern, its own hat silhouette (workshop: no hair, see RESTRAINT note), never seeded defaults); speaking roles get a role costume (`outfit.costume`: banker / clerk / guard, or a new `drawCostume` branch with >= 5 layered pieces, BUILD_LESSONS #28-#29); standing gesture/reaction beats may use code-written poses instead of clips (`needProc`, PIPELINE.md -> Procedural poses; locomotion, sit/stand and prop contact stay Mixamo). **Workshop rule (2026-11-24): no Mixamo MCP. Write all motion as coded poses** (`needProc` bakes onto the code-built skeleton, no download), seat people behind a closed table block, and leave walks out of the plan; `S clip <Clip> ...` for every Mixamo clip (download with the Mixamo
   MCP first, in-place for walks); `S prop <id> <asset>` + a PROPS entry; `S castsheet` -> out/castsheet.png. STOP for
   the cast look. Flat-card fallback (crowds, extras, lie / dead / chairless sit): `blender/cards_plan.json` -> `S cards`
   -> `<Card/>` + `needCards()` in the shot (PIPELINE.md -> Flat cards).
7. **Sets.** Reuse first: `S library list` / `S library use <set>`. **Character-near assets are BUILT in Blender in the film's own style (user rule 2026-11-18, RULES.md): everything the cast touches or stands near is modelled for this film; ready-made library models only for the far background.** Not in the library (background): GET it, don't build it (user rule
   2026-11-17):** search ready-made scenes/models in the Blender MCP libraries (Sketchfab, Poly Haven, Poly Pizza),
   import into Blender, export to three.js, and `S library save` it once approved. Build by hand only what no library has. New sets: `blender/sets_<name>.py` (detailed plugin
   assets per RULES.md -> Assets; rooms 35-50 props, PBR big surfaces, grass outdoors: LOOK.md -> Sets), `S export <set> --state ... --bake --light` (baked bounce light + AO; fix every WARN), look-dev still per set from
   3 angles (`S lookdev <set>:<state> --mood <mood>`), then the WORLD.md look-dev gate on every still (colour via
   `python -I <skill>/package/tools/world_colour.py <stills>`, sky, grass, depth layers, dressing). Vehicles: `S vehicle <id>` + `<Vehicle/>` (PIPELINE.md). STOP.
   Every approved new set: `S library save <set>` (copies the GLBs, script, look-dev and `blender/SET_<set>.md`).
   A reused set that predates the current character style: check one still with the real cast before shooting.
   Every reused set: read its library `SET.md` first and fix its "Known issues" for the shots that hit them (e.g.
   airfield at eye level needs a foreground layer); the SET_SHEET.md detail rules apply to reused sets too.
   Interiors are closed rooms: the default look-dev cameras sit outside the walls (LENS BLOCKED), so pass the set's
   saved cameras (`--cams out/library/lookdev_<set>_<state>_cams.json`, copied there by `library use`).
8. **Shots** `src/shots/sNN.tsx` (copy `s01.tsx`; sets drawn with `useSetScene(set)`), registered in
   `src/shots/index.ts`. **Camera:** hero shots (the hero acting, the key reveal, anything the user will look at
   twice) are authored in Blender: give the shot `paths` (its moving characters / vehicles as functions of t), write
   `blender/cams/sNN.json` (set, lens, 2 keys: pos + look in three coords), `S cam sNN` (background Blender only, never
   the user's open one; ~1-2 min, GPU lock), look at `out/cams/sNN_sheet.jpg` and the `CAM CHECK` line (roll 0, no
   move / pan reversals, ease >= 0.4 s, head 12-18 %), then `cam = UP().bcam ? blenderCam("sNN", t) : <beatCam>` and
   `needCam("sNN")` in needs. Hand tweak: open `blender/cams/sNN.blend`, move the keys, save, `S cam sNN --export-only`.
   Other shots may keep beatCam if they obey the same one-move rule. Check with `S still <frames>` (~10 s each), grip close-ups for every held prop
   (`S grips <frames> --who <id> [--hand right|left|both]`), sound-off tags (`<Tag/>`, about one per 15 s), and a
   `<StageQA/>` last in every shot (PIPELINE.md -> Staging QA), clean QA console (no LENS BLOCKED / TAG OUTSIDE / GRIP: /
   REACH: / ARM FAST: / STAGE lines; hands on world props: PIPELINE.md -> Hands on world props). Effects, physics,
   tears: PIPELINE.md -> Effects / Physics / Tears. Then `S render --draft` -> `S final --draft` ->
   deliver the DRAFT with known weak spots. STOP for notes.
9. **Sound** (real-sound skill, in parallel from step 4): copy `references/SOUND_BRIEF_TEMPLATE.md` to
   `audio/SOUND_BRIEF.md` for the sound agent (effects on important actions on the exact word, never on camera moves or
   cuts, fuller sounds that ring out; deliver `audio/stems/` with `public/mix.wav`), then `S levels` (targets -14 LUFS /
   -1 dBTP, bed ~14 dB under with a ~3 dB duck, loudest 100 ms outside speech >= 6 dB under speech RMS, one-shots
   ~8 dB under the voice peak) and paste the report.
10. **Final.** `S render` (motion blur) -> `S qa public/film.mp4` (flicker + critic: hard-cut sync, static runs >= 2 s,
    caption edges, stale timing, world colour: fix every WORLD: line outside white-outs) -> `S final` -> `S qa` -> deliver with credits and an
    honest weak-spot list. Then write what this film fixed into the skill (GOTCHAS / LOOK / RULES).
