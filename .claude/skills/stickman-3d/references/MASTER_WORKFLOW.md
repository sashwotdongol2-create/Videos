# MASTER WORKFLOW: one Short from A to Z (stickman-3d)

This is the single entry point. Every instruction in `references/` (and the three binding master-script files it
points to) is placed at the stage where it applies. Follow the stages in order; each ends with a **gate** (the checks
that must pass) and, where marked **STOP**, the user's approval. The detailed numbers stay in the source files; each
step names the file + section to open. Coverage of every file and every lesson: §Z at the end.

`S = python <skill>/package/stickman3d.py` (run inside the project). `<skill>` = `~/.claude/skills/stickman-3d`.
master-script = `~/.claude/skills/master-script` (installed 2026-11-19 from the short-studio repo; SHORTS_FORMULA.md,
POSTED_LESSONS.md, SOUND_LAYER.md): binding for the script stage; its local notes (one-sentence hook, plain story) apply.
Merged 2026-11-19 from the stickman-3d-skill branch into the main skill: where this file and the user's own standing
rules (RULES.md user rules, WORLD.md, COMPOSITION.md, LOOK -> Acting) disagree, the user's rules win (§0 rank 1).

---

## 0. Precedence: which file wins when two disagree

1. **The user's words in chat** (this film), then their standing choices: narrator **Lip** (ElevenLabs
   `DGqQmo441r9TwJq0migX`, key file from the package config `elevenlabs_env`), and the dated user rules in RULES.md
   (character-near assets built in Blender; game-ready assets, no scanned vegetation; colourful world per WORLD.md;
   composition per COMPOSITION.md; calm, held acting per LOOK -> Acting).
2. **POSTED_LESSONS.md** L1-L7 (why posted Shorts lost views).
3. **BUILD_LESSONS.md** (newest first; every finding from building).
3b. **CAMERA_STUDY.md** (measured on 31 Shorts): its numbers win every camera, transition, shot-mix and angle conflict (user 2026-11-20).
4. The 2026-11-18/19 studies: **RC_CAMERA_MOVEMENT.md**, **MOTION_EXPRESSION.md**, **DESIGN_DETAIL.md**.
5. **SHORTS_FORMULA.md** (master-script) for the script: format, length, pace, hook, turn, reveal, loop, §8 checklist.
6. **RULES.md** (hard rules), then **SOUND_BRIEF_TEMPLATE.md** for sound rules.
7. **RC_CHARACTER_STYLE.md**, **LOOK.md**, **FORMULA.md**, **SCRIPT.md**, **SET_SHEET.md**.
8. How-to and fixes: **PIPELINE.md**, **GOTCHAS.md**, **SETUP.md**, **AGENT_BRIEF_TEMPLATE.md**.
9. History only: **HYBRID_PLAN.md** (why the pipeline is built this way; its open phases are not instructions).

### Known conflicts, resolved

| Topic | Says A | Says B | Use |
|---|---|---|---|
| Narrator | RULES/SCRIPT: Brian | user 2026-11-19: Lip | **Lip** |
| Length / words | FORMULA: 62 s, 224 words | SHORTS_FORMULA: FACT 20-32 s / STORY 35-50 s; user: 30-40 s | **STORY band, 30-40 s** (~95-120 words) |
| Pace | FORMULA: 221 wpm | RULES/SCRIPT: house 180 wpm | **180 wpm** (`voice` tightens to it) unless SHORTS_FORMULA §7 band says otherwise |
| Camera | FORMULA §5/6, LOOK: one steady 14 %/s push per shot; RC_CAMERA_MOVEMENT: word-keyed beats, hold still on punchlines | CAMERA_STUDY (measured, 31 Shorts): ~10 %/s push, never still (hold = calm 5 %/s push), roll ≤ 3° on ≤ 1 beat in 5 | **beatCam with CAMERA_STUDY §4 numbers** (user 2026-11-20: his study wins) |
| Camera move per shot | beatCam: several word-keyed beats per shot, roll on fast moves (RC_CAMERA, CAMERA_STUDY) | user 2026-11-21: ONE smooth eased move per shot in one direction, no roll, no jitter / re-aims, shake only on explosions / gunshots, head ~12-18 % of the width (character AND environment, no face-filling close-ups) | **User 2026-11-21**: hero shots authored in Blender (`S cam`, PIPELINE -> Blender cameras); beatCam only where it keeps one direction; CAMERA_STUDY still decides rhythm, transitions and shot mix |
| Transitions | FORMULA/RULES: 0.3 s dissolve default; RC_CAMERA §5.8: 0.1-0.2 s dissolves, ≤ 1 hard cut | CAMERA_STUDY §4.2: 8-frame transitions, ~75 % continuous (move / dissolve / through / whip / wipe), 25-30 % hard cuts while moving, a change every ~3.5 s, ≥ 75 % on a word onset | **CAMERA_STUDY** (spin / vwhip / flip stay available for gags, ACTION_FX) |
| Head size | FORMULA §4: 40-45 % of height | RC_CHARACTER_STYLE (measured): ~30 % | **~30 %** (style sheet) |
| Expression hold | LOOK -> Acting (user, 2026-11-18: "why are they fidgeting so much"): hold 2-4 s, 1-2 changes per character per shot | MOTION_EXPRESSION M1: a change per word, eyes every 4-6 frames | **LOOK -> Acting (calm, held)**: change on that character's own line or key word; eye keys only where the eyes tell the story; listeners react on reveals |
| Assets near the cast | Sketchfab / Poly Haven models | RULES user rule 2026-11-18 | **Built in Blender** in the film's style; ready-made only for the far background; Poly Haven props OK; no scanned vegetation; < 50k polys/asset, set < 300k / 40 MB |
| World look | DESIGN_DETAIL D3 / D3b | WORLD.md (measured, with `world_colour.py`) | **WORLD.md** (D3/D3b add detail on top) |
| Framing | RC_CAMERA / BUILD_LESSONS distances; COMPOSITION.md: low ≥ 30 %, wide 39 %, no person 43 % | CAMERA_STUDY §4.4-4.7: medium ~30 %, ≥ 20 % no character, ~75 % eye level / 5 % low, head 30-40 % width in M | **CAMERA_STUDY** for shot mix and angles; head size: **user 2026-11-21, ~12-18 % of the width**; COMPOSITION still for horizon, head contrast, thirds, word -> frame; BUILD_LESSONS #38/#53 for minimum distances |
| Props per set | SET_SHEET: 10-15 | RULES/LOOK: rooms 35-50; DESIGN_DETAIL: ≥ 25 | **Rooms 35-50, exteriors ≥ 25** |
| Lightmaps | RULES: export `--bake --light` | this machine (4 cores): `--light` > 25 min | **`--bake` only**; `--light` only on a faster machine |
| Whoosh on camera moves | SOUND_BRIEF (old): never | user 2026-11-19: scene-sensitive | **Per scene**: silent by default; a whoosh only where the shot asks (whip, fast fly-through, reveal flight), decided in PLAN.md's sound column, ≤ ~1 per 5 s, ducked under the voice |
| Captions | RULES: 1 word (2 short paired), y = 0.70 | SHORTS_FORMULA §7a: 1-3 words, 55-70 % | **1-2 words at y = 0.70** (`Captions.tsx` pairs short words) |

---

## A. Ready the machine (once per session)

Sources: SETUP.md (all), GOTCHAS.md -> Speed, memory `stickman-production-lessons`.
1. `S doctor` until `ready` (SETUP -> Programs, Accounts / keys, MCP servers, Sister skills).
2. **Blender** open with the BlenderMCP add-on connected (port 9876) and Sketchfab ticked (key in the add-on prefs; never
   typed by Claude). Drive it over the socket (`bm.py`).
3. **Mixamo**: if downloads time out, the session logged out: run `mx_login.py` and the user signs in (BUILD_LESSONS #45).
4. **ElevenLabs**: `elevenlabs_env` + `elevenlabs_voice_id` set in the package config AND the project's `stickman.json`
   (BUILD_LESSONS #34).
5. Machine limits: render workers default to min(6, CPU cores); `STICK_CONC=<n>` overrides; one heavy job at a time
   (GOTCHAS -> Speed).
   Quote times from measured seconds per frame (RULES -> Process).
**Gate:** doctor ready; Blender, Mixamo and ElevenLabs reachable.

## B. Idea and facts

Sources: SHORTS_FORMULA §1-§3, POSTED_LESSONS L1-L2, FORMULA §1 (story templates, Don'ts), SCRIPT -> Script guide
discipline, RULES -> Rights and respect.
1. The idea passes SHORTS_FORMULA §2's four tests; pick FACT or STORY (§3).
2. Find the **strangest picture** in the story; it is frame 1 (L1: never an everyday act; L2: the best moment first,
   the backstory after, the *why* saved for the end).
3. Pick a story template (FORMULA §1: Mocked Genius / Clever Scam / Real-World Mechanism) and one recurring hero
   with an identity prop (FORMULA §3 staging).
4. Fact-check every claim; list sources (SCRIPT, RULES -> Rights). Sensitive history: RULES -> Rights limits.
**Gate:** the user's idea or script restated with its strangest image, template, hero and fact list.

## C. Script (master-script)  -> STOP

Sources: master-script SKILL.md + SHORTS_FORMULA §4-§8, FORMULA §1, SCRIPT.md (format, voice files, push-back),
POSTED_LESSONS L1-L3 + L7, RC_CAMERA §2.1 + §5.1.
1. Rewrite the user's script through **master-script** when installed (archetype B, RicksClips; else SCRIPT.md + FORMULA.md): act line (8-16 words, past tense,
   concrete detail) + mockery/stakes line; "You see," turn by 4 s; climb; reveal in the last 10 s as a statement;
   loop line into line 1; long run-on sentences (~18 words), ≤ 1 question, never ending on one (FORMULA Don'ts).
2. Every VO line has a named, showable shot (SHORTS_FORMULA §5); ≤ 2 proper names.
3. **Mark the nouns:** 2-4 words per sentence that get their own picture (RC_CAMERA §5.1). These become camera beats.
4. **Sound cue column** per shot: ambience, music state, the SFX on the word, silences, the reveal hit (L7).
5. **Title**: 5-9 words, picturable act, hides the ending (L3, SHORTS_FORMULA §6).
6. Output in SCRIPT.md's 3-part format (archetype + audio spec; retention map; 2-column AV table with TAVOC).
7. **Push-back:** if the user's change goes against what worked, say so with the stronger option (SCRIPT.md).
**Gate:** SHORTS_FORMULA §8 checklist + POSTED_LESSONS checklist (script part) all pass. **STOP for approval.**

## D. Plan (PLAN.md)  -> STOP

Sources: SKILL.md step 3, PIPELINE -> Data formats, SET_SHEET.md, POSTED_LESSONS L4-L6, RC_CAMERA §5, MOTION_EXPRESSION
"What this means", DESIGN_DETAIL "What this means", FORMULA §3 + §5, LOOK -> Editing forms, BUILD_LESSONS #1-#11.
One row per shot:
- beat + words + the marked nouns (each noun = one camera beat);
- **location** (5-7 distinct for 25-40 s; a set in at most 2-3 consecutive shots; L6) + light state + mood;
- **composition per picture** (COMPOSITION.md §3 + §5): frame type, size, camera height, subject position, second
  element, leading line, foreground, what is behind the head;
- characters, **acting clip per beat** (one readable whole-body action on the key word, BL #45), expressions per
  LOOK -> Acting (held; change on the character's own line / key word), eye keys only where the eyes tell the story, talk intervals (quoted lines only), one symbol
  max on the key word (BL #7), face-colour swap at most once per Short (BL #8);
- props + insert shots (story props big and front-on, L4; hero valuables built procedurally, BL #14);
- the **key moment** (L5): centred, whole, biggest and brightest, set tells the situation, dramatic light;
- camera beats (subject, height: low for power / high for mechanisms; foreground object; push on setup, HOLD on
  reveal/punchline; pull out only to reveal; RC_CAMERA §5);
- how the shot is entered (dissolve on time words, flight / shape match for location jumps, ≤ 1 hard cut after a
  punchline; RC_CAMERA §5.8);
- sound cue (from the script's column); sound-off tag (about one per 15 s, `<Tag/>`).
Sets: `S library list` first; a new set gets `blender/SET_<set>.md` (SET_SHEET format). Cast list with roles.
**Gate:** every row filled; locations, faces and props pass L4-L6 on paper. **STOP for approval.**

## E. Voice

Sources: SCRIPT -> Turning the approved script into voice files, RULES -> Process (pace), BUILD_LESSONS #34, #36.
1. `voice/vo.txt` (plain) + `voice/vo_tags.txt` (same words + eleven_v3 tags + CAPS); `S voice --takes 2` (Lip).
2. Check every word after a sentence pause keeps its attack (plot the waveform around it; BL #36: `tighten_beats.py`
   cuts right after the previous word, ≥ 0.15 s before the next).
**Gate:** word counts match; length inside the band; no clipped onsets.

## F. Timing and edit

Sources: SKILL.md step 5, PIPELINE -> Data formats, LOOK -> Editing forms, RC_CAMERA §5.8.
`shots_plan.json` (first word index per shot) -> `S timing`; `src/edit.json` kinds: dissolve (short, on time words),
push/whip only where planned, ≤ 1 cut. Camera beats and expressions read `Wl(word, shot)` so they follow the voice.
**Gate:** SHOT_FRAMES.txt matches the plan; no shot over ~4 s without a subject change.

## G. Cast design  -> STOP

Sources: RC_CHARACTER_STYLE.md (all), LOOK -> 3D stickman, DESIGN_DETAIL D1, RULES -> Hybrid (characters), POSTED L6,
BUILD_LESSONS #22, #28, #29, PIPELINE -> 3D stickman / Flat cards.
1. `src/char/cast.ts`: our own designs in the RicksClips style (head ~30 %, ink #purple-brown, noodle arms, dot hands).
2. Every speaking character: a **role costume** (`outfit.costume`, `drawCostume`): ≥ 5 layered, ink-outlined garment
   pieces with fabric texture and form shading, from job / rank / era (BL #28); neckwear ≥ 80 px below the torso top
   (BL #29). New roles get a new `drawCostume` branch.
3. Distinct skin tones true to the story, distinct silhouettes (hat, build, hair, accessory) (L6).
4. Flat cards only for crowds / extras / impossible poses (RULES).
5. `S castsheet` AND one still in the film's final light (L6: the grade must not wash skin tones together).
**Gate:** cast sheet + final-light still. **STOP for the cast look.**

## H. Motion library

Sources: RULES -> Picture 4, MOTION_EXPRESSION M3, BUILD_LESSONS #45, #46, PIPELINE -> 3D stickman, SKILL step 6.
1. Download one Mixamo clip per planned acting beat (pointing, reacting, surprised, laughing, walking...), then
   `S clip <names>`.
2. Root-motion clips (CONTINUOUS regex: push, pull, walk, carry...) never under a fixed grab target (BL #46).
3. In shots: `act(idle, [clip, word time, offset])` (idle + one acting clip per beat, faded in on the word).
**Gate:** every planned action has a clip in `src/clips.gen.json`.

## I. Props

Sources: PIPELINE -> Props + Hands on world props, RULES -> Hybrid (props) + Assets, BUILD_LESSONS #13-#15, #31.
1. Held props: modelled in Blender in the film's style (RULES user rule 2026-11-18; Poly Haven props OK when they
   match the style sheet), `S prop`, PROPS entry with grips.
2. World props the hands touch: grip points + `grab` (targets within ~0.6 m of the shoulder; never stretch: REACH:).
3. Hero valuables / repeated small objects: procedural (metallic, bevelled) when downloads look flat (BL #13-#14).
4. Insert-shot props (letter, sign, clock, cheque, map, newspaper): painted textures, legible period text
   (DESIGN_DETAIL D2).
**Gate:** `S grips` close-ups clean.

## J. Sets  -> STOP (design pictures)

Sources: SKILL step 7, SET_SHEET.md, DESIGN_DETAIL D3 + D4, LOOK -> Sets + Depth, RULES -> Hybrid (WebGL, ink) + Picture 1 +
Assets, PIPELINE -> Sets / LookDev / Vehicles, GOTCHAS -> Set look pass + Blender 5.x, BUILD_LESSONS #12-#27, #30, #43.
1. Library first (`S library list/use`); read a reused set's SET.md and fix its known issues.
2. New set script `blender/sets_<name>.py`: everything the cast touches or stands near is BUILT in Blender in the
   film's style; ready-made (Sketchfab / Poly Haven via the Blender MCP) only for the far background, checked in a
   look-dev still (BL #13); game-ready budgets (RULES); 35-50 props in rooms; three depth layers; a colour script of 2-3 hues; atmosphere (dust,
   rays); motivated key light; real-scale patterns (BL #18).
3. **Detail pass** (BL #43): painted fronts on slabs (labels, keyholes, hinges, wear) instead of many plain boxes;
   grime at wall feet; clutter on every surface in a close shot; inside rooms behind doors are built too.
4. Blender pitfalls: primitive sizes are half-extents (BL #26); `view_layer.update()` after creating/moving an
   object before parenting to it (BL #30); check ring/array sizes against the asset's real dims (BL #17).
5. Animatable nodes (doors, wheels) as named pivots, `o["no_bake"]` (RULES).
6. `S export <set> --state ... --bake`; fix every WARN (RULES -> WebGL). Run exports in the background (BL #16).
7. Look-dev: cameras in three coords (`z = -blender_y`, BL #12), 3 angles + the stand-in, per mood; interiors get
   their own mood from the colour script, never the outdoor golden/lamp preset (BL #20). Never a gap (Picture 1).
8. WORLD.md look-dev gate on every still: `python -I <skill>/package/tools/world_colour.py <stills>` (mean saturation
   >= 25, grey seconds <= 20 %), coloured sky, grass covered, four coloured depth layers, dressing.
9. **Design pictures for the user:** wide, two-shot, close-up, insert, cast sheet, rendered in the real pipeline.
**Gate:** design pictures approved (**STOP**); then `S library save <set>`.

## K. Shots

Sources: PIPELINE -> Shot module API + Staging QA + Effects/Physics/Tears, RC_CAMERA_MOVEMENT (all), MOTION_EXPRESSION
(all), DESIGN_DETAIL, RULES -> Hybrid + Picture, LOOK -> Camera/Editing/Depth, FORMULA §3, AGENT_BRIEF_TEMPLATE (if agents),
BUILD_LESSONS #1-#11, #23, #25, #31-#33, #37-#39, #41, #42.
Per shot module (`src/shots/<film>.tsx`, registered in `index.ts`):
0. **Camera rules (user 2026-11-21, win):** one smooth eased move per shot in one direction, no roll, no jitter /
   re-aims, shake only on explosions / gunshots, head ~12-18 % width with the environment. **Hero shots: `S cam sNN`**
   (ShotDef.paths + blender/cams/sNN.json -> background Blender -> public/cams/sNN.json, `blenderCam("sNN", t)`;
   PIPELINE -> Blender cameras); look at out/cams/sNN_sheet.jpg and the CAM CHECK line before the still.
1. **Other shots: beatCam beats on the marked nouns** (`Wl(word, shot)`), within the rules above: 0.3-0.5 s eased moves, travel past things
   (parallax), low/high by meaning, no roll (user 2026-11-21), foreground object chosen on purpose, HOLD on reveal and
   punchline words. Default distances: MCU ≥ 1.7 m, MS ≥ 2.5 m, wide ≥ 4.5 m at fov 44-56 (BL #38); head ~12-18 %
   width with the environment (user 2026-11-21), eyes in the upper third; phone-readable (L4).
2. **Faces** (LOOK -> Acting wins over M1): held expressions that change on the character's own line or key word;
   `look` keys where the eyes tell the story (BL #42); lip-sync from `src/lip.json` inside `talk` ranges, leading the
   sound by 2 frames (LIP_LEAD, BL #37); listeners gasp on reveals; one symbol (`Symbol3D`) on the key word; sweat/tears props.
3. **Bodies** (M2-M3): idle + acting clip per beat, run pose-to-pose (LOOK -> Acting: `step: { every: 28-45 }`);
   gestures arc and overshoot; held props lag 1-2 frames; the frame is never frozen (camera drift, environment
   motion), but bodies hold.
4. **Physics** (M4): `Coins3D`, spring hinges (doors/lids), Dust, Debris, Glints, Motes, smoke; vehicles lean.
5. **Light**: characters get the motivated side key + rim (BL #25); practicals tuned at the closest camera (BL #33).
6. Purity: every frame a pure function of t; assets via `needs`; `useSetScene(set)`; `<StageQA/>` last (RULES).
7. Lens: no geometry within ~1.5 m unless chosen; check each shot's first frame (it shows during the transition in,
   BL #39, #41); characters off the beat sphere (BL #32).
**Gate:** `npx tsc --noEmit` clean.

## L. Checks on stills

Sources: SKILL step 8, RULES -> QA console + Picture, POSTED L4-L6, PIPELINE -> Staging QA, BUILD_LESSONS #31.
1. `S still <a frame at every beat>` (sheet), `S grips` for held props.
2. QA console clean: no LENS BLOCKED / TAG OUTSIDE / GRIP: / REACH: / ARM FAST: / STAGE (fix, never stretch).
3. COMPOSITION.md §5 checklist over the stills; `S qa` world-colour line clean.
4. Phone check (L4: every still at ~360x640, subject ≥ 1/3 of the frame height), key moment (L5), skin tones in final
   light + no repeated background (L6), no gaps (Picture 1), contacts (Picture 2).
**Gate:** all of the above on the sheet.

## M. Test render  -> STOP (notes)

Sources: SKILL step 8, BUILD_LESSONS #35, GOTCHAS -> Speed.
720p test: `remotion render ... Film --scale=0.66666666666666666` (exact 2/3; 2-frame test first), no motion blur,
voice as the mix -> `Final` at the same scale. Report known weak spots honestly. Never render a frame range into
`public/film.mp4` (it overwrites the film).
**STOP for the user's notes;** fix, re-check stills (L), repeat.

## N. Sound

Sources: SOUND_BRIEF_TEMPLATE.md (all), master-script SOUND_LAYER.md, POSTED L7, real-sound skill, RULES -> Sound,
BUILD_LESSONS #40, #44.
1. Brief (`audio/SOUND_BRIEF.md`) from the script's cue column; run the **real-sound** skill for the final (L7).
2. Rules: an effect on every important action on the exact word / contact frame; camera-move whooshes only where the shot asks for one (decided per shot in PLAN.md), never on dissolves; full
   recordings with their tails, one sound per object; 3-5 designed effects per 10 s; one ambience per location,
   crossfaded; one licensed music track edited at bar lines, its biggest hit placed on the reveal word with ~0.3 s of
   silence before it; action sounds synced to the animation curves (wheel clicks from the angle curve, BL #44).
3. **Voice first**: music ~14 dB under (duck), SFX dipped under speech with a 60 ms look-ahead, loud hits in word gaps
   (BL #40); the voice itself unchanged.
4. `S levels` (-14 LUFS, ≤ -1 dBTP, bed ~14 dB under, one-shots ~8 dB under the voice peak); paste the report.
**Gate:** levels clean; listened through on every line with an effect under it.

## O. Final render and QA

Sources: SKILL step 10, GOTCHAS -> Speed, RULES -> QA.
1. `S render` (motion blur, the default) or the user's chosen trade-off (quote measured times: 720p no-blur ≈ 3.2 s/frame
   here; 1080p ≈ 1.5x; blur x SUB). 
2. `S qa public/film.mp4` (flicker, hard-cut sync, static runs, caption edges) -> `S final` -> `S qa`.
**Gate:** QA clean.

## P. Deliver

Sources: RULES -> Process + Rights, POSTED L3, SHORTS_FORMULA §6, SOUND_BRIEF -> Licences.
The video, title (5-9 words, hides the ending), thumbnail from our own render (no text unless asked), `CREDITS.md` +
`out/CREDITS_description.txt` (CC-BY lines), and an honest weak-spot list.

## Q. Learn

Sources: SKILL step 10, BUILD_LESSONS (header), POSTED_LESSONS (header), SHORTS_FORMULA §9.
1. Every problem found while building -> a dated BUILD_LESSONS row (what went wrong / fix / rule) the same day.
2. After posting: the user's numbers -> POSTED_LESSONS post-mortem; SHORTS_FORMULA §9 diagnosis.
3. Kit code that worked -> copy into `package/template` so the next project starts with it.

---

## Z. Coverage: every source file and where it is used

| File | Stages |
|---|---|
| SKILL.md (steps 0-10, binding notes) | A-Q (this file follows its order) |
| master-script SHORTS_FORMULA.md | B, C (§8 gate), P, Q |
| master-script POSTED_LESSONS.md | B (L1-L2), C (L3, L7), D (L4-L6), G (L6), L (L4-L6), N (L7), P (L3), Q |
| master-script SOUND_LAYER.md | N |
| BUILD_LESSONS.md | #1-#11 D/K · #12 J · #13-#15 I/J · #16-#18 J · #19 all commands (run from the project root) · #20 J · #21 J · #22 G · #23 K · #24 J/K · #25 K · #26-#27 J · #28-#29 G · #30 J · #31 I/L · #32-#33 K · #34 A/E · #35 M · #36 E · #37-#39 K · #40 N · #41 K · #42 K · #43 J · #44 N · #45 D/H · #46 H |
| CAMERA_STUDY.md | D (shot mix), F, K (beatCam numbers), M (framing QA, camqa) |
| RC_CAMERA_MOVEMENT.md | C (nouns), D, F, K (beatCam), M |
| MOTION_EXPRESSION.md | D, H, K |
| DESIGN_DETAIL.md | G (D1), I (D2), J (D3-D4), K, captions (D5) -> F/O |
| RULES.md | A-Q (Hybrid -> G-L; Picture -> K-L; Assets -> I-J; Process -> A, E, P; Rights -> B, P) |
| RC_CHARACTER_STYLE.md | G |
| WORLD.md | D (set states), J (look-dev gate), L, O (`S qa` world colour) |
| COMPOSITION.md | D (per-picture composition), K, L |
| LOOK.md | G (3D stickman), J (sets, depth), K (camera, editing forms) |
| FORMULA.md | B (§1 templates), C (§1), D (§3, §5), K (§3 staging), §4 aesthetic -> J; §2/§6 camera superseded by RC_CAMERA (§0) |
| SCRIPT.md | B, C, E |
| SET_SHEET.md | D, J |
| SOUND_BRIEF_TEMPLATE.md | N, P |
| PIPELINE.md | F-O (commands, formats, shot API, char3d, props, cards, sets, look-dev, vehicles, hands, parallel work) |
| GOTCHAS.md | A (speed), J (Blender, set look), K-O (three.js/Remotion, painter, voice, assembly, agents) |
| SETUP.md | A |
| AGENT_BRIEF_TEMPLATE.md | K (only when splitting sets/shots across 2-3 agents) |
| HYBRID_PLAN.md | background only (§0 rank 9) |
