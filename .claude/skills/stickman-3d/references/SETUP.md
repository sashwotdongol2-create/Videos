# Setup: tools, links, MCP servers, sister skills, asset packs

Run `python <skill>/package/stickman3d.py doctor` first; it names every missing piece. Then
`python <skill>/package/stickman3d.py config --set KEY VALUE ...` stores machine paths in `package/config.json`, which
`new` copies into each project as `stickman.json` (the only place paths live). Config keys: `blender`, `python`
(numpy + pillow + scipy + soundfile), `node_modules_source_3d`, `mixamo_downloads`, `elevenlabs_env`,
`elevenlabs_voice_id`, `whisper_models`, `lock_dir` (GPU lock + Remotion TEMP, on a big drive), `set_library`, `wpm`.

## Programs

| what | why | get it |
|---|---|---|
| Blender 5.3+ | builds and exports sets (`export`, bakes with Cycles CPU), converts clips and props, headless (`blender -b -P`) | https://www.blender.org/download/ — config key `blender` |
| Node.js LTS + npx | Remotion + three.js: every still, render, cast sheet, flat cards, captions + final mux | https://nodejs.org — `stickman3d.py new` junctions `node_modules_source_3d` (or runs `npm ci`) |
| Remotion 4.0.540 + three 0.186 + React 19 (npm) | pinned in `template/package.json` + package-lock.json | https://github.com/remotion-dev/remotion |
| ffmpeg + ffprobe | frames, sheets, joins, loudness | https://ffmpeg.org/download.html |
| Python 3.11 + pillow, numpy, scipy, soundfile | stickman3d.py, textures, card measuring, tools/flicker.py + analyze_pacing.py, tools/levels.py (scipy + soundfile) | `pip install pillow numpy scipy soundfile` into the config `python` (doctor checks only numpy + pillow) |
| librosa (optional) | picks the most expressive voice take (pitch SD) | `pip install librosa` |
| faster-whisper (optional) | transcript of the reference video | https://github.com/SYSTRAN/faster-whisper — `pip install faster-whisper` |
| yt-dlp | downloads the reference video | https://github.com/yt-dlp/yt-dlp — needs Node or Deno for YouTube's JS challenge |
| curl | ElevenLabs API calls | ships with Windows 10+ |

## Accounts / keys (never type them for the user; they paste them into files themselves)

- **ElevenLabs** (https://elevenlabs.io): `.env` file with `ELEVENLABS_API_KEY=...`, path in config `elevenlabs_env`.
  House voice: **Brian**, voice id `nPczCjzI2devNBz1zQrb`, model `eleven_v3` (audio tags), config `elevenlabs_voice_id`.
- **Adobe account for Mixamo** (https://www.mixamo.com): signed in once in the Mixamo MCP's Chrome profile.
- **Freesound API key** (https://freesound.org/apiv2/apply) for the real-sound skill's sourcing.
- Optional: Poly Pizza / Sketchfab API keys (pasted into the Blender MCP add-on preferences by the user).

## MCP servers

| server | used for | install / notes |
|---|---|---|
| **blender** — `mcp-for-blender` (PyPI, run with `uvx`) | live look-dev, `search_assets` / `import_asset` (Poly Haven CC0 needs no key), `look` | `uvx mcp-for-blender install-addon --addons-dir "<Blender>/5.3/scripts/addons"`, restart Blender, add-on serves port 9876. If it reports an old protocol, re-run install-addon. Turn libraries on per scene: `bpy.context.scene.blendermcp_use_polyhaven = True`. The Blender Lab "MCP" extension also listens on 9876 with another protocol — keep it disabled. Final renders never use the MCP (headless scripts). |
| **mixamo** — https://github.com/V1xel/mixamo-mcp | `list_animations`, `select_animation`, `set_param inplace`, `download_animation` (fbx, 30 fps) into the downloads folder (config `mixamo_downloads`) | Pin `mcp<2`. Google sign-in refuses automated browsers: sign in once with plain Chrome on the MCP's `browser_profile`, then close it. Chrome exit 21 = that profile is still open. |
| ccd/terminal tools of Claude Code | background renders, monitors | built in |

## Sister skills (bundled in `package/sister_skills/`)

All of them ship inside this package. `stickman3d.py install-skills --earshot-dir <folder>` copies any that are missing into
`~/.claude/skills`, copies the earshot package to `<folder>`, creates its venv and `pip install -e`s it (then restart
Claude Code). Upstream sources: earshot + real-sound https://github.com/Leonxlnx/earshot (MIT), youtube-downloader from
the daymade-skills marketplace (MIT), cartoon-3d-short (MIT; its private reference frames are deliberately NOT bundled),
channel-formula and writing-for-agents (the user's own). channel-formula needs its `config.json` paths set and
`python setup.py` run once (see its SKILL.md).

| skill | stage |
|---|---|
| **channel-formula** | measure a channel (RicksClips3000 is already done: `references/FORMULA.md`); `compare` a finished video against a formula |
| **real-sound** (+ the **earshot** Python package it calls for listening/realness checks) | the whole soundtrack: cue list from the words file, CC0/CC-BY sourcing (Freesound, incompetech, Mixkit), licence audit, mix to −14 LUFS, credits. Brief: `references/SOUND_BRIEF_TEMPLATE.md`; scripts from a finished film: `package/template/audio/`; check with `stickman3d.py levels` |
| **writing-for-agents** | before writing an `AGENT_BRIEF.md` or editing this skill |
| **cartoon-3d-short** | sibling three.js-in-Remotion style (flat cards in a painted world); not used by this pipeline |
| **youtube-downloader** | if yt-dlp needs cookies / HLS help |

## Asset sources (RULES.md → Assets wins: detailed assets via the Blender MCP plugins only)

Required: Blender MCP add-on with Sketchfab + Poly Pizza API keys (the user pastes them into the add-on preferences)
and libraries switched on per scene (`blendermcp_use_sketchfab / _polypizza / _polyhaven = True`). Workflow per asset:
`search_assets(source, query, previews=3)` → pick the most detailed fitting result → `import_asset(source, id,
target_size=...)` into the live Blender → toon-check with `look` → save as `blender/assets/<id>.blend` (packed) →
`ASSETS.md` line (name, author, URL, licence). The table below is legacy reference from the first films: the local
kits in it (Kenney on disk, lowpoly assets) are no longer allowed for stickman videos.

## Legacy asset packs (first two films)

| source | licence | how |
|---|---|---|
| **Poly Haven** models — https://polyhaven.com/models, API https://api.polyhaven.com/assets?t=models | CC0 | `stickman3d.py assets <id> ...` downloads the 1k glTF and saves `blender/assets/<id>.blend`. Proven ids: `Rockingchair_01 coffee_table_round_01 tea_set_01 barrel_stove rusted_spade_01 Lantern_01 wooden_lantern_01 wooden_candlestick old_bed_frame painted_wooden_nightstand fancy_picture_frame_01 street_lamp_01 wooden_bucket_01 mantel_clock_01 wooden_crate_01 brass_candleholders vintage_oil_lamp WoodenChair_01 wooden_stool_01 tree_stump_01 boulder_01 hanging_picture_frame_01`. Avoid `fir_tree_01` / `pine_tree_01` (7–17 M polygons, hang builds): build stylised cone pines instead. |
| **Kenney** kits — https://kenney.nl/assets/city-kit-suburban, https://kenney.nl/assets/food-kit, https://kenney.nl/assets/furniture-kit (mirror ZIPs on https://opengameart.org) | CC0 | unzip GLBs under one folder = config `kenney_dir`; `lib.import_glb(path)` + recolour. Good: suburban `building-type-a..u` (background houses), `food-kit/cabbage.glb`, croissant, cake, cup-saucer. Kenney fences are rails/walls: build pickets yourself. |
| **Quaternius** — https://quaternius.com | CC0 | animals/props when Poly Haven has none |
| Poly Pizza / Sketchfab | CC0 / CC-BY (check) | only with the user's API key; never sign in for them |
| Our own builds | — | bells, coffins, signposts, picket fences, pines, houses, dioramas: `blender/sets.py` helpers (`bell_mesh`, `coffin`, `candy_cord`, `light_beam`, `box`, `plane`, `image_mat`) and painted PIL textures (`blender/tex.py`) |

Characters are never asset models: every character is our own 3D stickman (src/char3d) built from the cast spec in
`src/char/cast.ts`, with faces from `src/char/drawCharacter.ts`.

## Review gate (optional, needs quota)

Antigravity CLI (`agy`, Gemini) can watch + listen to the final next to the reference
(`D:\resource\lowpoly\tools\review.py --replica` on the original machine). When its quota is out, review stills and
sheets yourself and tell the user the listen pass is pending.

## stickman-3d extras
- `node_modules_source_3d`: one shared React 19 / three 0.186 / Remotion 4.0.540 install (D:/resource/stickman/_shared3d,
  `npm ci` from the template's package-lock.json); `new` junctions it into each project.
- `set_library`: folder for reusable exported sets (D:/resource/stickman/library/sets; empty so far: no set approved yet).
- `lock_dir` (D:/remotion-tmp here): the GPU lock and Remotion's TEMP/TMP. Remotion, Blender and ffmpeg commands need
  the Bash sandbox disabled; run stills and renders only through the CLI (it holds the lock: one GPU job at a time).
- Engine licence: src/engine is inkbeat-shorts (MIT, LICENSE-inkbeat.txt); Remotion's own licence applies.
