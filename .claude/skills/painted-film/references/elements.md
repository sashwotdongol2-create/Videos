# Elements, set pieces, type and camera

All in `kit/painted.js`. Coordinates are the 1080 x 1920 frame. `f` is the frame step (`Math.floor(t * 12)`); pass it
through so every boil and jitter changes once per step.

## Set pieces

| Call | Does | Notes |
|---|---|---|
| `P.room(wall, floor, f, floorY = 1190)` | Flat wall, floor, baseboard, floor shade, painted wash | Colours in `P.COLORS`: cobalt/beige (the site's), green/pink, rust, cream/umber. Raise `floorY` to stand a group cut-out's straight bottom edge on the floor. |
| `P.painting(img, t, f, {fx, fy, z0, z1, span})` | A whole painting as the scene, slowly pushing in | `fx`/`fy` choose the focus (0.36 centres Bruegel's tower). |
| `P.cover(img, x, y, w, h, fx, fy, zoom)` | Cover-fit an image into a box, clipped to it | Never spills, so scenes can sit side by side in pans. |
| `P.figure(key, cx, feet, h, f, opts)` | A cut-out standing on the floor, with boil and contact shadow | `talk: P.talking(LINES, who, t)` bobs it; `rot` leans; `sx: -1` mirrors; `sx: P.turn(t, t0)` turns in 5 frames; `sc` pops; `dy` drops; `shadow: false` for groups behind a table. |
| `P.gilt(x, y, w, h, m)` | A gold picture frame | |
| `P.framed(imgOrFn, x, y, w, h, {cover, label})` | A framed picture; `cover` 1 → 0 lifts a velvet cover in steps; `label` shows on the cover | A function draws a live scene inside the frame. |
| `P.snap(name, fn)` | Draws a scene into a reusable canvas | For portholes, shards, frames that show another scene. |

## Type

| Call | Does |
|---|---|
| `P.drop(lines, y, t, t0, f, {align, x, stagger})` | Each word drops in on a spring with a squash. Lines: `{text, font: 'InterBlack' or 'OldItalic', size, color, gap, strike, shadow}`. Mix a heavy line with an italic one, the human.md wordmark way. `strike: true` draws an orange strike after it lands. |
| `P.captions(LINES, t, f, {y, size})` | Typed captions on a paper strip; each ends where the next begins. `kind: 'q'` italic quote (a character asking), `'a'` underlined quote (the line to copy). |
| `P.talking(LINES, who, t)` | True while `who` speaks: feed it to `figure`'s `talk`. |

Fonts: Inter Black and Old Standard Italic (both in `kit/fonts`, OFL). Captions use the system American Typewriter.

## Elements

| Call | What it is | Used in |
|---|---|---|
| `P.el.stamp(text, x, y, t, t0, {size, color, rot})` | A rubber stamp that slams (scale 1.9, 1.2, 1.0) | STOP. on the curtain |
| `P.el.counter(x, y, a, b, t, tShow, tA, tB, {label, prefix, suffix})` | A paper card that pops in and rolls a number; turns orange and pops when done | 200 → 2,000 followers |
| `P.el.crowd(list, t, t0, t1, f)` | Cut-outs dropping in one by one on springs. `list: [{key, x, feet, h}]` | Seurat's people filling the café |
| `P.el.ball(x, y, r, f)` + `P.el.hopAt(points, t, span, height)` | A painted-looking ball and a hop path through points | The ball that the camera dives into |
| `P.el.bubble(text, x, y, t, t0, {tail: [x, y], maxW})` | A parchment speech bubble with typed text and a tail | A character's line when there is no voice |
| `P.el.spotlight(x, y, r, a)` | Darkens all but a soft circle | Picking someone out of a crowd |
| `P.el.tag(text, x, y, t, t0, {size, rot, bg})` | A paper label that pops in | Naming things; the sampler labels |
| `P.el.porthole(canvas, x, y, r, t, span)` | A round window onto another scene, opening in steps, gold rim | The café callback beside the candidate |
| `P.el.flip(seq, t, t0)` | Which item of a flipbook shows now (one per step) | Vermeer's reader → the candidate |

Ideas worth building next (more elements = richer film): a painted hand pointing (cut from Michelangelo or
Caravaggio) that moves in, a clock from a still life whose hand ticks round, paper scraps or petals falling, thought
clouds made from a painted sky, a vintage film-title card, a projector beam, a podium cut from a painting.

## Camera

| Call | Does |
|---|---|
| `P.camera(t, fn, {z, cx, cy, drift})` | Runs a scene inside a camera with idle drift (a few px float) and zoom |
| `P.dolly(t, a, b, amt)` | The push-in zoom for a key line: 1 → 1 + amt with the site's overshoot, back out after b. Use as `z`. |
| `P.gallery(cells, cam, t, f)` | A wall of gilt frames. `cells` rows of images or scene functions. Cameras: `P.galleryAll(cells)`, `P.galleryFocus(col, row)`, blend with `P.camLerp(a, b, e)` (zoom blended in log space, so the pull-back feels even). |

## Eases (`P.ease`)

`camera` (in-out, pans, tilts, irises) · `dive` (slow start, fast end: zooming into something) · `out` (fast start:
reveals) · `exit` (a small pull back before leaving) · `spring` / `bouncy` / `snappy` / `wobble` / `settle` (overshoot
families, from the site's code) · `dolly` (to 1.03 and settle) · `hop` (0 → -1 → 0, multiply by a height).
`P.step(k, n)` quantises any progress into n hard steps.
