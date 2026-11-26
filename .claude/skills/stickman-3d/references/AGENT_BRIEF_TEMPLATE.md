# <FILM TITLE> — <SET | SHOTS> agent brief (stickman-3d)

<!-- Copy to <project>/AGENT_BRIEF.md, fill every <...>, delete the role you are not briefing. At most 2-3 agents. -->

<One paragraph: the film, the story in two lines, the look (3D stickmen with the painter's faces in softly lit,
ink-outlined Blender sets, rendered by three.js in Remotion, 1080x1920, 30 fps). The reference `ref/ref.mp4` is the
STORYBOARD only (staging, set dressing, colours, beats); our narration is `voice/vo.txt`, word timings `src/words.json`,
shot frames `SHOT_FRAMES.txt`, plan `PLAN.md`.>

Project: `<project dir>`. CLI: `S = python <skill>/package/stickman3d.py -p <project dir>`.
Read first: `<skill>/references/RULES.md` (all of it), `PIPELINE.md`, `LOOK.md`, `GOTCHAS.md` (top section).

## Role A: set agent (Blender)
You own `blender/sets_<name>.py` (+ `blender/tex_<name>.py` if needed). Nothing else.
- Build: `build(state)` returns anchors (or `anchor_*` empties); `lights(state)` makes the sun / moon and point
  lights. States: <night, day, ...>. Set sheet: <ground, buildings, 10-15 props, materials, light states>.
- Assets: detailed models via the Blender MCP libraries (RULES.md -> Assets), saved as `blender/assets/<id>.blend`,
  one `ASSETS.md` line each. Never the local kit folders.
- Export: `S export <name> --state <states> [--bake]`. Fix every WARN (coplanar: move a part >= 1 cm proud, decals
  1.5 cm; open shell: SOLIDIFY wall before the ink modifier; node colour: `--bake`). Example set with 0 WARN:
  `<skill>/package/examples/grave_bell/sets_graveyard.py`.
- Check: look-dev stills from 3 angles (a test shot with only the set and the mood, `S still <frames>`), no gaps,
  three depth layers, mean L* per LOOK.md.
- Deliver: the set file, `public/sets/<name>_<state>.glb + .json`, stills, a report (assets + licences, anchors, open
  WARNs with the reason).

## Role B: shot agent (TypeScript)
You own `src/shots/sNN.tsx` for shots <ids> and their lines in `src/shots/index.ts`. Nothing else: never edit
src/engine, src/world, src/char3d, src/film, cast.ts or another agent's shots; report what you need instead.
- Pattern: copy `src/shots/s01.tsx`. Assets only through `needs` (needSet, needClip, needProp, needCards, needTag);
  draw the set with `<primitive object={useSetScene(set)} />`; every frame a pure function of t (no Math.random,
  Date, performance.now or carried state); `lensClear` every frame.
- Per shot: <beat, words, set + state, mood, characters + clips + expressions, props + modes, camera move, how it is
  entered (edit.json kind), sound-off tag text>.
- Edit form: <CUT FILM: dissolves (edit.json kinds for push / whip / cut)> or <ONE TAKE: each section ends pushing into
  a dark doorway at ~1 m/s (last >= 3 frames near-black) and the next starts inside one; LOOK.md -> Editing forms>.
- Depth (LOOK.md -> Depth): camera moves through space (arc / crane), three layers, hero always sharp.
- Composition (COMPOSITION.md): build each picture to its PLAN.md row (size, camera height, subject third, horizon
  ~40-45 %, head against a clean darker area, caption zone 65-70 % clear); put the stills through comp_sheet.py and
  compare with the RC sheets before reporting.
- Checking loop: `S still <frames>` (half size, ~10 s each, the CLI holds the GPU lock: never run Remotion directly)
  -> look at every still at full size -> fix -> repeat. `S grips <frames> --who <id> [--hand right|left|both]` for
  every held prop. Every run must end with "QA console clean"; fix each LENS BLOCKED / TAG OUTSIDE / GRIP: / REACH: / ARM FAST: line (REACH: = move the character or the prop, never stretch the arm).
  Rendering needs the Bash sandbox disabled. `npx tsc --noEmit` must pass (noUnusedLocals is on).
- Deliver: the shot files, a still sheet per shot (incl. both sides of each transition), grip sheets, a report (what
  each shot shows, compromises, open weak spots).
