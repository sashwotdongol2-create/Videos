---
name: cartoon-shorts-complete
description: Everything needed to make vertical 2D-cartoon-characters-in-a-3D-world story shorts at "Rumble Strips" quality - a procedural three.js WebGPU world (roads, fields, towns, cars with interiors, damage), 2D characters redrawn every frame from an invisible 3D skeleton with emotion-driven faces and light-following shading, calm smooth cameras with a camera editor, a built-in CC0 sound library plus downloading more, a music picker, frame-exact rendering, subtitles and the full rule set. Use when the user asks for the cartoon-shorts / Bookshelf / "Rumble Strips" look (2D cartoon characters in a 3D world) or names this skill, and then for everything in that short - a script + voice to animate, a storyboard, a model, a scene, a camera, sound, music, subtitles, a render, a fix, the camera editor or the music picker.
---

# Cartoon shorts: the complete pipeline

This skill is a working engine, a sound library and every rule that produced the Rumble Strips short. It is the
entry point: everything else in the pack is linked from here. `<skill>` below means this skill's folder (the
"Base directory" shown when the skill loads, normally `~/.claude/skills/cartoon-shorts-complete`).

## Quick start: what the user says, what you do
| The user says | You do |
|---|---|
| "Make a short" + script (+ voice) | Steps 1-8 of "Order of work" below. Storyboard first, approval before animating. |
| "Make me a 5 s clip of X" (no voice) | Same order, without transcription: write the beats from the description. |
| "Model a <thing>" (or any new object you decide to add) | Search the web for real photos and sizes first (`rules/modeling.md`, "Research every object first"), then build it with an inspection page. |
| "Change the camera" / "open the camera editor" | Start the editor (see Tools), the user keys shots, render with `cameras.json`. |
| "Pick music" / "music picker" | Build the picker options from `<skill>/sfx_library/music/` (or new CC0 tracks) and start it. |
| "Add sound" / "fix the sound" | `rules/sound.md`: library first, then download, then the cue sheet and mix. |
| "Fix X" after a render | Fix it, then re-check the whole shot, not only X, against the checklists. |

## Rules (read before building; every rule applies in every scene)
- `rules/characters.md`: the skeleton-driven 2D characters, movement, faces, clothes and light. Also **objects,
  hands and bodies must make physical sense**: depth order of props, dropped objects, same-side hands, sitting
  pose, nothing crossed without a reason.
- `rules/world.md`: the procedural realistic world and objects, only what was asked for, real vehicle interiors.
- `rules/modeling.md`: how every object is modelled from code (surfaces, lathes, wheels, interiors, materials).
- `rules/camera_lighting.md`: calm smooth cameras, push-ins on what is said, sun, sky and night lighting.
- `rules/process.md`: the order of work, the quality bar and delivery.
- `rules/sound.md`: the sound library, downloading more CC0 sounds (BigSoundBank, Kenney, OpenGameArt), placing
  them, levels, music and subtitles.

## New project setup (once per short)
1. Check the tools: Node 18+, Python 3, ffmpeg/ffprobe on PATH, Google Chrome (WebGPU). Tell the user what's missing.
2. Make a project folder (e.g. `shorts/<name>/`) and copy `<skill>/engine/` into it (including the hidden `.claude/`).
3. In the project: `npm install` (Playwright, ffmpeg-static). For word timings: `pip install faster-whisper numpy`.
4. The user's voice goes to `audio/voice.mp3`, the script to `script.txt`.
5. Sound: copy what the short needs from `<skill>/sfx_library/` (see `sfx_library/CATALOG.md`) into the project's
   `sfx/`, and download anything missing (`rules/sound.md`, "Getting the sounds"). Credit every file in
   `sfx/CREDITS.txt`.

## Everything in this skill, and when to use it
**Engine (`engine/`)**
- `src/world.js`: the road world. Sky domes with shaded cumulus, moon, cloud shadows, miles of terrain with wheat
  strips and crop rows, grass to the horizon (`grass.js`), asphalt (`surfaces.js`), a damageable rumble strip
  (`cutGrooves`, `setStripWindow`), guardrails with dents (`rails[s].dents`, `rebuildRails`), power lines, a fence,
  and `setTime(k)` from day to night.
- `src/town.js`: a main street with shops, interiors behind glass, trees, lamps, parked cars.
- `src/props.js`: sign, thermos, spill, cones, rail parts, beacon, rack, toolbox, tank, ladder, hammer, DustTrail,
  Sparks, `crumple()` for dents. `src/saw.js`: a cut-off saw with grips. `src/geo.js`: rbox, I-beams.
- `src/cruiser.js`, `src/pickup.js`, `src/wheel.js`, `src/car.js`: cars from parametric surfaces, opening doors with
  thick trim, real wheels, full interiors (`CarInterior`, `attachDoorTrims`).
- `src/toon2d.js`, `face2d.js`, `refface.js`, `unTone.js`, `cast.js`: the character rig, emotion faces, the card
  material that keeps faces white, the cast. `faceboard.html` and `<skill>/face_board.jpg` show every face.
- `src/setup.js`: builds the scene once, with helpers (`seat`, `stand`, `makeCar`, `look`, `finish`, `resetRoad`).
- `src/board.js` (`board.html`): the storyboard, one still per beat. `src/anim.js` (`anim.html`): the animation, with
  shots `{id, keys, a, b, fade, set(t)}`, cameras through `track()` (even speed), `shakeAt`, `rumble` and dissolves.
  These two hold the Rumble Strips episode as a worked example: replace the beats and shots for a new story and
  keep the rest.
- Inspection pages (check every model at full size before using it): `carview.html` (cars, `?pickup`, `&fill`),
  `ptest.html` (props), `wtest.html` (world), `ttest.html` (town).

**Tools (`engine/tools/`, run from the project folder)**
| Tool | Command | Use it for |
|---|---|---|
| Stills | `PAGE=board.html node tools/capture.js 0 1 2` | Storyboard stills and checks of any page |
| Render | `PAGE=anim.html node tools/render.js out/part.mp4 --range 0,300` | Frame-exact video of frames 0-299 |
| Full render | `FRAMES=<total frames> bash out/render_all.sh` | 300-frame chunks, verified counts, joined into `out/anim_clean.mp4` |
| Storyboard sheet | `node tools/shot.js cook/sheet.html "?a=0&b=15&title=Name" cook/storyboard_1.jpg` | The approval sheet |
| Word timings | `python -I tools/transcribe.py audio/voice.mp3 words.json` | Beats, subtitles and sound timing |
| Subtitles | `node tools/subs_overlay.js words.json out/subs.mov <frames> 30` | Word-by-word overlay |
| Mix (cue sheet) | `python -I tools/mix_cues.py cues.json out/clean.mp4 out/final.mp4` | Voice -14 LUFS, effects, beds, music |
| Mix (worked example) | `out/mix.py` (same file as `mix_rumble_example.py` in toon-sound-finish) | The real Rumble Strips mix, about 60 cues: a model for layering |
| Camera editor | `node tools/editor_server.js 5179`, then http://localhost:5179 | The user keys camera moves; saves `cameras.json`. Needs `src/anim.js` (shots exposed as `window.ANIM`). Sound is optional: make `out/editor_audio.m4a` with `mix_cues.py` and put `words.json` in the project to see the waveform and words. |
| Music picker | 1) `python -I tools/mix_cues.py cues.json out/anim_clean.mp4 out/editor_audio.m4a` (writes the stems) 2) `ffmpeg -i out/anim_clean.mp4 -vf scale=540:-2 -an out/preview_540.mp4` 3) copy 3-9 candidate tracks into one folder, e.g. `music_opts/` 4) `python -I tools/music_options.py music_opts <seconds>` 5) `node tools/editor_server.js 5179`, open http://localhost:5179/music.html | The user picks the music and volume and presses Save as final (`music_choice.json`); `mix_cues.py` then uses it |
| Code checks | `python -I tools/brackets.py <file>` and `tools/swallow.py` | After every patch (a stray `//` can eat code) |
| Eval | `PAGE=anim.html node tools/eval.js "<js>"` | Read values from a page (e.g. `window.BEATS`) |

**Shell:** the commands are written for bash. On Windows use Git Bash (the Bash tool), not PowerShell. The renderer
uses the installed Google Chrome.

**Sound library (`<skill>/sfx_library/`, all CC0; shipped as a second zip, `Bookshelf_Sound_Library_v1.1.zip`. If
`sfx_library/` only has `CATALOG.md` and `GET_THE_LIBRARY.md`, ask the user for that zip or download sounds instead)**: Kenney packs (footsteps, impacts, cloth, doors, UI clicks,
sci-fi), 28 real BigSoundBank recordings (cars, car doors, saws, rain, sea, water, street, wind), 9 western music
tracks and a Chopin nocturne. `CATALOG.md` lists every file, what it's good for, and its source.

**Companion skills (installed with the pack; use them when the task calls for them)**
| Skill | Use it for |
|---|---|
| `toon-characters-style` | Characters only (also has a 10 s demo scene to start from) |
| `toon-world-objects` | Backgrounds, vehicles and props |
| `toon-camera-lighting` | The camera engine and lighting code (`camera.js`) |
| `toon-sound-finish` | Sound, music, subtitles, finishing |
| `toon-storyboard-review` | Brief and storyboard templates, the review checklists |
| `cook` | Long build-and-review loops against references |
| `img2threejs` | Turning a reference photo into a procedural three.js model |
| `threejs-*` (13 skills) | three.js reference: geometry, materials, lighting, shaders, performance... |
| `watch` / `watching-videos` | Studying reference videos frame by frame (needs the Watch Skill tool installed) |
| `ia` (Internet Archive) | Searching and downloading public-domain or CC0 music and sounds from archive.org |
| `chisle` | Shorter messages and simpler code, to save usage. Never skips a pipeline step or check |

## Starting a new story (read before planning)
- **Reusable as is:** the road world with fields, day/dusk/night, the town main street, cars (cruiser, pickup,
  sports-car method), props in `props.js`, the saw, the character rig and faces, cameras, tools, sound library.
- **A new place or object** (an office, a kitchen, a plane cabin, a keyboard...) has to be modelled first, the same way
  (`rules/modeling.md`): reference photos and real sizes, built part by part from code, checked on an inspection page.
  Tell the user up front that a new location adds build time (often hours), and plan the models before the storyboard.
- **The episode files:** `src/board.js` and `src/anim.js` hold the Rumble Strips episode. For a new story, write a new
  `board.js` and `anim.js` (keep the imports you need from `setup.js`; drop the road-only objects). In `anim.js` set
  `DUR` to the new length. Then render with `FRAMES = DUR x 30`.
- **Seating:** `seat()` in `setup.js` is made for car cabins (scale ~0.68). For chairs, sofas and plane or bus seats,
  pose with `stand()`-style inputs (hips on the cushion, knees ~90 degrees, feet flat and apart) at full scale.
- **No narration?** That's fine: skip transcription, write the beats from the user's description, leave `voice`
  out of `cues.json` (the mixer makes a silent voice track), and the camera editor works without `words.json`.

## Order of work (always)
1. Transcribe the voice (if there is one) and fix the words against the script. Write `cook/BRIEF.md` (template in
   `toon-storyboard-review`): the must-haves and one beat per voice line, with times.
2. Study every reference at full size; measure, don't guess.
3. Build or extend the models and world; inspect every part on the inspection pages at full size.
4. Storyboard (`board.html`): one still per beat, then the sheet, then **get approval before animating**.
5. Animate (`anim.html`): a calm, smooth camera per shot; creative, slightly exaggerated motion; impacts shake;
   no teleporting; push in on what the voice names. Test frames across every shot and every dissolve.
6. Check every still against the checklists in `rules/characters.md` (props, hands, sitting) and
   `toon-storyboard-review/GUIDE.md`.
7. Render in chunks and check the frame counts. Add the subtitle overlay. Sound: library, downloads, cue sheet,
   mix. Music: build the picker and let the user choose.
8. Before sending: contact sheet, close-ups, loudness. Say what was not checked (audio is measured, not heard).

## Hard rules (summary; the full text is in rules/)
- **Characters:**
  - never character sheets; a skeleton with the 2D drawing redrawn every frame;
  - feet planted; hands truly grip, each on its own side; knees bend when seated; feet flat and apart; nothing
    crossed without a reason;
  - props between the camera and the body draw in front of it; dropped things fall and land somewhere real;
  - faces from emotions: both eyes the same type, eye changes inside a blink, brows lead, mouth last, head bounce;
  - clothes wrap a round invisible form; hats and hair redrawn every frame;
  - faces stay white (un-tone-mapped cards); cel shading follows the scene light; scene shadows fall on them;
  - a new cast for every story; never name characters on screen.
- **World:**
  - every new object, background props included, starts from a web image search for real photos and sizes (no
    brand logos copied); then procedural and part-addressable; no slabs or boxes; textures everywhere;
  - grass to the horizon; long wheat strips; real damage geometry; real wheels and interiors; dust behind cars;
  - many objects (except on the open road); only the cars and characters asked for.
- **Camera** (full rules: `rules/camera_lighting.md`):
  - the user's camera directions win, word for word; plan a camera line for every beat before animating;
  - push in on whatever the voice names or the story centres on, arriving on the word, then ease out; no random zooms;
  - one calm, even-speed move per shot or a hold; no snaps; nothing blocks the lens;
  - a continuous move links two beats only when it's the same place and moment, short and with a clear path;
    otherwise dissolve or cut;
  - continuity: nobody teleports and nothing disappears; changes stay changed;
  - respect camera-editor keys.
- **Lighting:** real sun, sky fill and cloud shadows; dark blue nights; headlights as a soft wash; tail-light glare;
  purple-blue dusk and night horizon; the moon never under clouds.
- **Sound:** real recordings only (library first, then CC0 downloads after asking once), on the exact moments;
  music under the voice; final about -14 LUFS.
- **Always:** never send known defects; storyboard first; every frame a pure function of the frame number.
