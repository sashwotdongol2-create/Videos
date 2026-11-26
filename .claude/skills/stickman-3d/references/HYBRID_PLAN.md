# Stickman hybrid plan: Blender builds, three.js renders, 3D stickmen

Status: phases 1-7 are implemented in the stickman-3d template and CLI and tested on `D:\resource\stickman\_smoke3d`,
`_gb3d` and `_night3d` (2026-11-16); no film has shipped yet. stickman-short is unchanged. A **Status (2026-11-16)**
table under each phase says done / partial / not done with the evidence path.
Test code lives in `D:\resource\inkbeat-test`. Items marked **[Skool]** come from Mr Miro's replies in the
skool.com/mrmiro community (read 2026-11-16).

---

## 1. Evidence: tests run on 2026-11-16

| # | Test | Files | Result |
|---|---|---|---|
| 1 | inkbeat demo, 5 s | `src/demo/Test5.tsx`, `out/test5_blur.mp4` | Clean look from the template. 24 s sharp, 51 s with blur. Generic style, stiff hand-posed acting, sparse set. |
| 2 | Grave Bell shot 25 re-rendered in three.js | `pilot/export_s25.py`, `src/pilot/Pilot25.tsx`, `out/pilot25_compare.mp4` | Identical staging. ~1 min vs Blender 7 min 08 s (232 frames). Flicker 0 after 4 fixes. Kenney recolours lost; snow flatter. |
| 3 | 3D stickman walk | `src/pilot/Stick3D.tsx`, `out/stick3d_test.mp4` | Mixamo bones drive a real 3D stickman; reads 2D from the front, has volume in orbit. 31 s / 48 s. |
| 4 | 3D stickman + expressions + props | `src/pilot/StickDig.tsx`, `out/stickdig_test.mp4` | Cap, Poly Haven spade (1 hand walking, 2 hands digging), walk->dig blend, 5 expressions, blinks, talk flaps. 33 s / 65 s. Spade clips legs while walking. |

Lessons already learned (go into GOTCHAS):
- Remotion asset loading must block the frame **synchronously during render**; release `continueRender` only after
  the re-render has committed (+1 animation frame). Effect-based loading captured fallback frames.
- WebGL depth: planes 2 mm apart flicker; keep decals >= 1 cm proud; camera near/far 0.15 / 250, not 0.02 / 600.
- Striped objects made of many meshes (candy cord) get inked at every stripe: mark them no-ink.
- Blender exports every material double-sided: force FrontSide or inkbeat inks it as cloth.
- Saturated colours clip to cream at inkbeat's default light levels on Blender albedos: key ~1.7, hemi ~0.55.
- Cards in the ink pass need an "occlude" mode (alpha cut-out writes depth, no ink inside).
- Big cartoon heads take only ~25% of the Mixamo head-bone tilt, or they roll over when the body bends.
- Glb names: three strips `:` from bone names (`mixamorig:Hips` -> `mixamorigHips`); multi-material meshes become a
  Group whose children carry suffixed names, so name filters must also check the parent.

---

## 2. Feature verdicts

### Same in both (keep as is)
Plan -> look-dev -> pilot -> final with stops; word-timed visuals; one-word white captions at 70 %; -14 LUFS; one
GPU render at a time; camera always moving; toon + ink; warm key vs cool fill; contact rules; honest weak-spot list.

### Different: what the hybrid takes from each
| Area | Keep from | Notes |
|---|---|---|
| Renderer | **inkbeat (three.js)** | 6x faster finals, 5-10x faster previews |
| Set building + assets | **stickman (Blender + MCP asset libraries)** | user's detailed-asset rule stays |
| Characters | **new 3D stickman**; flat cards as fallback | look ported from our painter |
| Motion | **Mixamo, bones direct** | no card PNG export |
| Held props | **3D props on hand bones** | grip points (see Phase 3) |
| Script, voice, sound | **stickman** | + Skool script method, + inkbeat level rules |
| Ink, grade, moods, motion blur | **inkbeat** | tuned to our sets |
| Haze / volumes | inkbeat fog for now | night haze still untested |
| Flicker + pacing QA | **inkbeat scripts** | targets from our FORMULA.md |
| Edit forms | **both** | our dissolves / one-take + inkbeat push-through / whip |
| Sound-off tags | **inkbeat** | unlit labels on key objects |
| CLI | **stickman.py** | new commands below |

### Drop or reduce
Blender final render + compositor + EEVEE tuning; card PNG export per Mixamo frame; the separate `post` step; most
render GOTCHAS; inkbeat's 3D character family and procedural paint; inkbeat's 56 beats/min target; big parallel
agent fan-outs (2-3 agents max).

---

## 3. Pipeline after the change

```
script (guide + push-back) -> voice (ElevenLabs Brian) -> words.json -> shot timing
Blender: set sheet -> asset pass -> build set -> S export -> scene.glb + track.json  (set library)
cast3d.ts + Mixamo GLBs + face atlas -> TS shot modules
Remotion + three.js: S still (~15 s) -> look-dev / grip stills (STOP) -> S render (motion blur)
real-sound mix (levels report) -> S final -> S qa -> deliver -> session learnings into the skill
```

---

## 4. Phases

### Phase 0: script quality [Skool]
0.1 **Hits-vs-flops guide.** Extend `channel-formula` / `viral-history-script`: for the target channel collect 10-15
    hits and 5-10 flops with view counts, transcribe (Whisper, local), compare hook (first 2 s), structure, sentence
    length, words/s, twist position, ending, with numbers. Our FORMULA.md already contrasts 21 strong vs control
    videos; add **per-rule backing counts** ("based on N hits / M flops") and mark rules from <= 3 clips as WEAK.
0.2 **Push-back rule** in SCRIPT.md / viral-history-script: before writing or applying any edit, check it against the
    guide; if the request goes against what worked in the hits, say so, ask "are you sure?", and offer an own option
    with which-is-stronger-and-why. Never silently obey.
0.3 **Fresh-chat test** of the script skill after changes (does it load the guide?).
0.4 **Fact check every claim** before voice (already a rule; make it an explicit step with a "not sure" list).
0.5 **Hook rule reinforced** [Skool, 3 reviews]: first frame AND first sentence = the strangest/most interesting
    moment; never an empty establishing frame; explain after. Tell the core mechanism ONCE (no repeated explanation).
0.6 Rule kept from Skool: learn structure and rhythm, never copy stories or lines; downloaded clips stay local.

**Status (2026-11-16)**

| item | status | evidence |
|---|---|---|
| 0.1 hits-vs-flops backing | done (code); partial (library) | `D:\resource\short-studio\skills\channel-formula\tool\ca\formula.py` (Backing column, WEAK at <= 3 clips, rules.json `backing`); formulas published before this change (zackdfilms, lowpolyshorts, ricksclips3000, theartofwarrr, fg-the-explainer) not re-published |
| 0.2 push-back rule | done | `C:\Users\<you>\.claude\skills\viral-history-script\SKILL.md` (push back; one-off exceptions in state.md); SCRIPT.md |
| 0.3 fresh-chat test | not done | written as a step in `C:\Users\<you>\.claude\skills\viral-history-script\SKILL.md`, never run |
| 0.4 fact check before voice | done | `C:\Users\<you>\.claude\skills\viral-history-script\SKILL.md` step 5; `C:\Users\<you>\.claude\agents\history-researcher.md` Fact-check mode -> review/factcheck_vN.md |
| 0.5 hook rule | done | `C:\Users\<you>\.claude\skills\viral-history-script\BRIEF.md` (frame 0 = strangest moment; mechanism once) |
| 0.6 structure not stories | done | SCRIPT.md, RULES.md -> Rights |

### Phase 1: engine into the skill
1.1 Copy the inkbeat engine into `package/template/src/engine/` (post ink, grade, bloom, DOF, motion blur, moods,
    toon material + exported `patch`, rig, shadows), keep its MIT notice, include the test fixes (card occlude mode,
    camera near/far option).
1.2 Add `flicker.py`, `analyze_pacing.py`, `gpu_lock.py` to `package/tools/`.

**Status (2026-11-16)**

| item | status | evidence |
|---|---|---|
| 1.1 engine in the template | done | `C:\Users\<you>\.claude\skills\stickman-3d\package\template\src\engine` (LICENSE-inkbeat.txt, THIRD_PARTY_NOTICES.md) |
| 1.2 QA tools | done | `C:\Users\<you>\.claude\skills\stickman-3d\package\tools\flicker.py`, `analyze_pacing.py`, `gpu_lock.py` (+ `levels.py`) |

### Phase 2: Blender -> three.js bridge + set library
2.1 `S export <shot>` (generalised `pilot/export_s25.py`): run the shot builder, strip hulls/cards/lights/camera,
    write `scene.glb` + `track.json`.
2.2 Bake step for node-based materials (recoloured kits) before export.
2.3 Export gate for WebGL set rules: surfaces >= 1 cm apart, striped/multi-mesh decoration marked no-ink,
    single-sided materials, real scale (1 unit = 1 m).
2.4 **Set sheet before building** [Skool]: ground, buildings, 10-15 props, materials and colours, light presets
    (day / night / golden); test pictures from 3 angles; STOP for approval. Depth in three layers (foreground near
    the lens, action in the middle, hazy background) per our depth standard.
2.5 **Set library** [Skool]: every approved set is saved as `library/sets/<name>/` (scene.glb, light presets, set
    sheet, preview stills) and reused by later films instead of rebuilding. Assets keep their ASSETS.md credits.

**Status (2026-11-16)**

| item | status | evidence |
|---|---|---|
| 2.1 export | done (per set + state, not per shot; cameras stay in TS, no track.json) | `stickman3d.py export`, `C:\Users\<you>\.claude\skills\stickman-3d\package\template\blender\export.py`; `D:\resource\stickman\_night3d\public\sets\graveyard_night.json` |
| 2.2 bake node materials | done | `export --bake` (Cycles CPU, blender/tex/baked/); _night3d night 0 WARN, 6 textures; example graveyard night / sunrise / dusk 0 WARN |
| 2.3 WebGL export gate | done (real scale not checked automatically) | export.py WARNs: node colour, material without a Principled BSDF (added in the fix round: the parlour moonbeam had passed silently as an opaque slab), open shell, coplanar < 1 cm, > 1.5 M polygons; FrontSide forced in world/assets.ts toToon; `export` exits 1 when a state fails. Template parlour night / day / dusk and example graveyard night / sunrise / dusk: 0 WARN with --bake (fix round, `D:\resource\stickman\_t_fix`) |
| 2.4 set sheet + 3-angle look-dev | partial (a documented STOP, no tool; not yet run on a new set) | SKILL.md step 7, AGENT_BRIEF_TEMPLATE.md role A |
| 2.5 set library | partial (commands exist, library empty) | `stickman3d.py library list / save / use`; `D:\resource\stickman\library\sets` (empty) |

### Phase 3: 3D stickman character system
3.1 `src/char3d/`: rig loader for any Mixamo clip with weight blends; head/body/limb builder; proportion rules
    (legs 0.7, head ~40 % of height, head takes 25 % of bone tilt, 3/4 head turn toward the lens); wobble
    (squash/stretch, head lag, jiggle, shock jolt).
3.2 Face atlas ported from `drawCharacter.ts` (all 24 expressions), deterministic blinks (0.5-2.3 s), mouth flaps on
    spoken lines.
3.3 `cast3d.ts`: body colour, hat, hair, moustache, glasses, default prop per character.
3.4 **Props** [Skool + test 4]:
    - carried props are children of the hand bone with the origin at the **grip point** (handle, not centre),
      oriented along the forearm, held at chest height, never over the face;
    - world props (mop, drawer, button) get grip points and the hands are solved onto them every frame;
    - two-hand tools take their angle from the two hand positions (done in the spade test);
    - if a grip is out of reach, move the character or prop, never stretch the arm;
    - show the whole action: reach, grab, lift, >= 0.4 s, eased;
    - fix the walking carry so the prop never crosses the legs (out to the side or on the shoulder).
3.5 **Grip close-up stills** [Skool]: one close-up still per hold, checked before the full render.
3.6 Flat cards stay as a fallback (`<Card>` with occlude mode) for crowds or failed poses.
3.7 `S clip <Clip>` (FBX -> GLB, `pilot/fbx2glb.py`) replaces `S mixamo` + `S cards` for 3D characters.

**Status (2026-11-16)**

| item | status | evidence |
|---|---|---|
| 3.1 rig + body + proportions + wobble | done | `C:\Users\<you>\.claude\skills\stickman-3d\package\template\src\char3d\Stickman.tsx` (STYLE, restFit, skirt, contact solver), `rig.ts` |
| 3.2 faces, blinks, talk | done | `C:\Users\<you>\.claude\skills\stickman-3d\package\template\src\char3d\face.ts` |
| 3.3 cast spec | done differently (no cast3d.ts: the 3D stickman reads src/char/cast.ts; props are set per shot) | `C:\Users\<you>\.claude\skills\stickman-3d\package\template\src\char\cast.ts`, `D:\resource\stickman\_gb3d\out\stills\sheet.jpg` (wife's dress as a 3D skirt) |
| 3.4 props | partial | carry / two / plant / palm / none + solver clear of the holder's own body (`props.ts`, `Stickman.tsx`). Done 2026-11-17 (`reach.tsx`): world props with grip points, `grab` + `solveArm` (no stretch, REACH: QA), reach-grab-lift (eased, >= 0.4 s, <= 4 rad/s, ARM FAST: QA), two-hand world tool angled from both hands; evidence `D:\resource\stickman\_t_grab\out\stills\grip_sheet_cup.jpg`, `grip_sheet_mop.jpg`, `grip_185.jpg` (unreachable bell, arm unstretched). Not done: real mop / drawer / button assets (the test used the shovel and a teacup), clearance against other characters, a ground-clamped `two` |
| 3.5 grip close-up stills | done | `S grips` + engine View grip camera; `D:\resource\stickman\_smoke3d\out\stills\grip_sheet.jpg`, `D:\resource\stickman\_gb3d\out\stills\grip_sheet_dig.jpg`, `grip_sheet_plant.jpg`. Joints keyed by shot + frame (SHOT_JOINTS): a transition frame logs GRIP: from the shot without the character |
| 3.6 flat-card fallback | done | `C:\Users\<you>\.claude\skills\stickman-3d\package\template\src\world\Card.tsx` (tint auto), `S cards`; `D:\resource\stickman\_smoke3d\out\stills\f_00230.jpg` (re-rendered in the fix round: before it, a solid cream moonbeam slab covered the left quarter of this still) |
| 3.7 S clip | done | `stickman3d.py clip` (tools/fbx2glb.py) |

### Phase 4: shots and editing
4.1 Shot modules in TypeScript (`src/shots/sNN.tsx`): set from the library GLB, camera from track.json or the inkbeat
    rig, characters with expression/prop/clip timelines keyed to word indexes.
4.2 Edit forms in Remotion: 0.3 s dissolves (default), one-take doorway joins; push-through and whip optional.
4.3 Sound-off tags: unlit label helper for key facts (about one per 15 s).
4.4 **Focus rule** [Skool]: the main character is always sharp; DOF focus follows the hero, never blurs the
    foreground people.
4.5 **Text safe area** [Skool]: all lettering fully in frame, clear of edges, captions and the YouTube buttons;
    long text on 2 lines.

**Status (2026-11-16)**

| item | status | evidence |
|---|---|---|
| 4.1 TS shot modules | done | `C:\Users\<you>\.claude\skills\stickman-3d\package\template\src\shots\s01.tsx`; `D:\resource\stickman\_gb3d\src\shots\s24.tsx`, `s25.tsx`; `D:\resource\stickman\_night3d\src\shots\s06.tsx` |
| 4.2 edit forms | partial (dissolve / push / whip / cut done; one-take doorway join documented, not yet tested) | `C:\Users\<you>\.claude\skills\stickman-3d\package\template\src\film\transitions.ts`; `D:\resource\stickman\_smoke3d\out\push_strip.jpg` (push, 0 hard cuts) |
| 4.3 sound-off tags | done | `C:\Users\<you>\.claude\skills\stickman-3d\package\template\src\world\Tag.tsx`; `D:\resource\stickman\_smoke3d\src\shots\s02.tsx` tag "1889" (f_00230.jpg) |
| 4.4 focus on the hero | partial (per-shot `focus` prop; no automatic check) | View `focus` / `blur`; `S qa` manual checklist |
| 4.5 text safe area | done (tags) | Tag.tsx `TAG OUTSIDE SAFE AREA` QA line, printed by still / render; captions are fixed at y 0.70 |

### Phase 5: sound [Skool + inkbeat]
5.1 Real-sound brief: an effect on every important action and object, on the exact word; **no effect on camera
    moves or every cut**; fuller sounds with a natural tail instead of short cheap clicks.
5.2 Levels against the voice: one-shots ~8 dB under the voice peak, loudest 100 ms >= 6 dB under speech RMS, music
    ~14 dB under with a -3 dB duck, -14 LUFS / -1 dBTP; **print a measured levels report** with every mix.

**Status (2026-11-16)**

| item | status | evidence |
|---|---|---|
| 5.1 real-sound brief | done | `C:\Users\<you>\.claude\skills\stickman-3d\references\SOUND_BRIEF_TEMPLATE.md` |
| 5.2 levels report | done | `tools/levels.py`, `S levels`, run by `S qa`; `D:\resource\stickman\_gb3d\out\qa\levels.json` from `S levels --cues D:\resource\stickman\grave_bell\out\cues.json --cue-offset 2026`: -14.8 LUFS, -2.3 dBTP, **2 WARN**: cues dawn:bird:0 and dawn:alone:0 buried at -16.7 dB re the voice peak (target ~-8); the mix is not fixed. `S qa` alone finds no cue list in _gb3d and reports 0 WARN, so pass the cues |

### Phase 6: render, QA, CLI
6.1 `S still <shot> <frame>` (~15 s), `S render` (motion blur on every shot), `S final` unchanged, `--draft` = half
    resolution without blur.
6.2 `S qa`: flicker check; pacing vs FORMULA targets; look numbers (L*, ink %); 2 fps contact sheet; loudness; plus
    the Skool checks:
    - interpenetration / floating objects (check every frame, contact sheet of fixed parts);
    - shadows under objects on a surface, never drawn over them; contact shadow under every character and prop;
    - hero in focus; all text inside the safe area.
6.3 **One command** [Skool]: `/stickman-short new <topic>` runs script -> voice -> plan -> look-dev -> render -> QA,
    reusing library sets, **with the approval stops kept**.

**Status (2026-11-16)**

| item | status | evidence |
|---|---|---|
| 6.1 still / render / final / draft | done | `stickman3d.py still`, `render [--draft]`, `final [--draft]`; `D:\resource\stickman\_gb3d\public\film.mp4` (motion blur, 92 s), `D:\resource\stickman\_gb3d\out\final.mp4` |
| 6.2 qa | partial | flicker, pacing + mean L*, contact sheet, loudness, levels and QA console tags (LENS BLOCKED / TAG OUTSIDE / GRIP:) done; ink % not measured; interpenetration, shadow placement and focus are manual checklist items (poseQA exists but is not wired to a console tag) |
| 6.3 one command | replaced by `S status` (prints NEXT); no one-shot run command, approval stops stay manual | `stickman3d.py status` |

### Phase 7: docs + learning loop
7.1 RULES.md: "Blender builds, three.js renders" (user decision); WebGL set rules; 3D stickman proportion rules.
7.2 LOOK.md: inkbeat mood / ink / grade numbers mapped onto our depth standard.
7.3 PIPELINE.md / SKILL.md: new steps; GOTCHAS.md: the lessons in section 1.
7.4 **End-of-film learning step** [Skool]: after every film, write what was fixed into the skill so it stays fixed
    ("improve one element per Short").

---

**Status (2026-11-16)**

| item | status | evidence |
|---|---|---|
| 7.1 RULES.md | done | references/RULES.md -> Hybrid rules |
| 7.2 LOOK.md | done | references/LOOK.md -> Engine look (night, sunrise, cards, tags), Editing forms |
| 7.3 PIPELINE / SKILL / GOTCHAS | done | references/PIPELINE.md, SKILL.md, references/GOTCHAS.md (top) |
| 7.4 end-of-film learning step | done (as a step; no film finished yet) | SKILL.md step 10, RULES.md learning loop |

## 5. Order and open questions
1. Do Phase 0 (script) and Phases 1-2 first, plus a **night-haze test** (Grave Bell shot 6, snow) before trusting
   three.js for finals.
2. Then Phase 3 (3D stickman), starting with a two-character contact test (handshake).
3. Open: face visibility when the camera goes behind a character; whether to change the "Blender is the renderer"
   rule (user's call).

**Status (2026-11-16)**

| item | status | evidence |
|---|---|---|
| night-haze test | done | `D:\resource\stickman\_night3d` (mean L* 38; `out\stills\sheet.jpg`, `public\film.mp4`) |
| two-character contact test (handshake) | not done | - |
| face visibility when the camera goes behind a character | open | - |
| 'Blender is the renderer' rule | decided: Blender builds, three.js renders (stickman-3d only) | RULES.md -> Hybrid rules |
| night stickman legibility | partial (face reads; dark torso's unlit side L* 16-17, below 25-35) | `D:\resource\stickman\_t_integ\out\stills\sheet.jpg` |

Not adopted from Skool (not relevant): Facebook posting advice; long-form Premiere re-export (only if long-form is
made); low-poly-only exports (conflicts with the detailed-asset rule; glTF carries PBR textures).
