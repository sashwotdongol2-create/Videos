---
name: painted-film
description: Make a short vertical film acted out by real public-domain paintings (Velázquez, Rembrandt, Van Gogh, Vermeer, Manet, Seurat...) cut out and set in flat human.md-style rooms, moving as 12 fps stop motion, with a kit of 23 transitions (shatter, dive into a frame, curtain + stamp, iris, whip pan, ink, mosaic, page turn, gallery pull-back...) and elements (crowds, counters, stamps, speech bubbles, portholes). Use when asked for the human.md / painted / old-master look, "creative transitions", a more artistic or richer version of an existing script, or a video "with multiple elements". Covers casting paintings, cutting them out with macOS Vision, voices, sound, the edit, rendering and checking.
---

# painted-film: old-master paintings acting out a script

A film where every character and every place is a real painting. The look comes from Briana May's human.md
(https://www.human-md.ai: flat cobalt wall, beige floor, painted figures in modern clothes, stepped stop motion, eased
transitions). We can't repaint poses, so the paintings move as cut-outs: they boil, bob when they talk, lean, turn in
five frames, swap like a flipbook, and the camera and transitions do the rest.

Why this skill exists: the owner's rule is that art must come from real material, never from figures drawn in code,
and "too basic" was the verdict on films with two figures in a room. The bar is the reference film below: a new
painting for each beat, several elements per scene, a different transition at every turn.

Reference films (not included in this copy):
- `tell-me-painted/` (40 s) **the standard to beat.** Script 62 played through ten paintings and nine transitions:
  the Syndics interview Manet's Young Lady, each answer happens inside a painting, Seurat's crowd fills Van Gogh's
  café while a follower counter rolls, a curtain + STOP stamp, a porthole callback, Vermeer flipping into the
  candidate, a gallery wall pull-back into the app screen.
- `painted-sampler/` (about 50 s) every transition and element in the kit, each labelled with its call name. Watch it
  before planning a film.
- `three-ways/`, `go-deeper/` earlier and simpler (rated "too basic").

References: [transitions.md](references/transitions.md) (all 23, what each means, when to use it, how to call it) ·
[elements.md](references/elements.md) (set pieces, type, elements, camera) · [paintings.md](references/paintings.md)
(casting list: what's been cut out and how well, and what to try next, by role) · [film-grammar.md](references/film-grammar.md)
(how to turn a script into a painted film; the bar for "enough") · [sound.md](references/sound.md) (voices, levels,
effects) · [pitfalls.md](references/pitfalls.md) (every bug found so far and its fix).

## Workflow

1. **Script first.** Use an approved or proven script (the write-script skill; `script-review/<app>/`). Keep the
   owner's words exactly; the film may add a line for a character (an interviewer's question) but never rewrites theirs.
2. **Plan on paper** (film-grammar.md): one beat per sentence, a painting or room per beat, one transition per change
   of beat chosen for what it means, and at least two elements per scene. Write the plan as a table (time, line,
   picture, transition, elements) before fetching anything. Aim for 8–10 transitions in 40 s, no transition twice.
3. **Start the project:** `bash .claude/skills/painted-film/kit/new.sh video-review/<app>/<slug>`. It copies the
   kit (`painted.js`, `render.mjs`, tools, fonts) and the template. To start from a film that already works, copy
   `tell-me-painted/` instead and replace its scenes.
4. **Cast and fetch:** `python3 fetch.py --search "<painting>"`, then `python3 fetch.py src/<name>.jpg "File:<title>" 1920`
   (3840 when you will crop figures out of it). Put web copies of whole paintings in `assets/p_<name>.jpg`.
5. **Cut out:** `swift cutout.swift src/x.jpg assets/x.png` (`each` for one PNG per subject; `box x y w h` to keep
   furniture Vision drops). For one figure out of a crowd painting, crop it first. Check every cut-out over a flat
   colour before using it.
6. **Voice:** fill `voice.json` (new lines and `cut` pieces of an existing take), `python3 make_vo.py`. It levels every
   line to -21 dB and runs speech-to-text so you can see each take says the right words. Effects: `sfx.json` +
   `python3 make_sfx.py`, or the shared `../sfx-library`.
7. **Build** `index.html`: scenes are `(t, f) =>` functions; `SHOTS` (or explicit `if` blocks) is the edit; each change of
   scene is a `P.tr.<name>(t, [a, b], A, B, opts)`; captions with `P.captions(LINES, t, f)`; `window.MIX` holds the
   sound; `P.finish(f)` last.
8. **Check stills before the full render:** `node render.mjs --stills 0.5,3,6.2,...` (in order, so snapshots are built
   as in the film; add `--fast` when nothing uses state). Look at every transition mid-way and every scene with its
   caption. Fix, re-check. Only then `node render.mjs` (about 2–4 min for 40 s).
9. **Check the mp4:** duration, `ffmpeg ... ebur128` (about -14 LUFS, sound from frame 0, no silent stretch), a few
   frames pulled from the file. Then `bash compress.sh <folder>` (repo root), send the mp4 into the chat with
   SendUserFile, note it in the script's file in `script-review/`, commit.

## House rules that apply here

- No background music (the owner removes it). Room tone from frame 0, a few effects, voices.
- Voices plain and natural; characters may be played lightly ([casual], [curious], [laughs]); never acted panic.
- Captions on a paper strip low in the frame (y about 1700), typed on; the line the viewer should copy underlined.
- The app only at the end: "Download <your app> and ..." tied to the script, over the app's real screen.
- Real material only: paintings, real app screenshots. Code draws only frames, cards, stamps, curtains, simple shapes.
- Every film gets its own structure; don't reuse the same sequence of transitions twice in a row.

## The kit in one screen (details in elements.md and transitions.md)

```js
P.init(canvas); await P.loadAll({ a: 'assets/p_a.jpg', hero: 'assets/hero.png' }); P.textures();
P.room(wall, floor, f, floorY)            P.painting(img, t, f, {fx, fy, z0, z1, span})
P.figure(key, cx, feet, height, f, {talk, rot, sx, sc, dy, shadow})   P.turn(t, t0) → sx for a 5-frame turn
P.framed(imgOrFn, x, y, w, h, {cover, label})   P.gilt(x, y, w, h)    P.cover(img, x, y, w, h, fx, fy, zoom)
P.drop(lines, y, t, t0, f)                P.captions(LINES, t, f)     P.talking(LINES, who, t)
P.el.stamp / counter / crowd / ball + hopAt / bubble / spotlight / tag / porthole / flip
P.camera(t, fn, {z: P.dolly(t, a, b)})    P.snap(name, fn) → canvas   P.gallery(cells, cam, t, f) + galleryAll / galleryFocus / camLerp
P.tr.wipe blinds whip pan tilt iris irisOutIn keyhole dive shrink shatter curtain tear ink mosaic flipCard pageTurn slideOver drop pop cut
P.finish(f)
```
