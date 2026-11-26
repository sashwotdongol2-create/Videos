# Transitions

Every one is `P.tr.<name>(t, [start, end], A, B, opts)`, where A and B are scene functions `(t, f)`. Before `start`
it draws A, after `end` it draws B, so you can call it for the whole shot. All of them step at 12 fps because the
page feeds them stepped time. See them all in the `painted-sampler` film (labelled).

Pick a transition for what it says, not for variety alone. The meaning column is the point.

| Call | What you see | Means / use it for | Length | Options | Sound |
|---|---|---|---|---|---|
| `wipe` | The next scene is revealed in 6 hard steps | A plain "next", the opening reveal | 0.5–0.9 s | `dir` down/up/left/right, `steps` | paper slide |
| `blinds` | Strips open one after another, each in steps | Next item in a list; a light, quick change | 0.8–1 s | `n`, `dir: 'v'` | paper slide |
| `whip` | A fast slide with two ghost copies trailing | Cutting from one speaker to the other (question → answer) | 0.3–0.4 s | `dir` | whoosh |
| `pan` | The camera slides sideways, through a corridor if given | Walking to the next place; a sequence of rooms | 1.2–1.5 s | `gap: (t,f)=>…`, `gapW`, `dir` | paper slide / footsteps |
| `tilt` | The camera moves up (or down) into a scene stacked above | Aspiration, "bigger", the sky, the future; down = landing back | 1–1.3 s | `dir` -1 up, 1 down | whoosh (soft) |
| `iris` | A circle opens from a point onto the next scene | Going into something small that becomes everything (a ball, a word, an eye) | 0.7–0.9 s | `x, y, r0`, `rim` | soft whoosh |
| `irisOutIn` | Closes to a point on dark, opens on the next | A clear chapter break, "meanwhile", the old-film feel | 1–1.2 s | `x, y, color` | none or a pop |
| `keyhole` | The next scene appears through a growing keyhole | A peek, a secret, "what they're really thinking" | 1–1.2 s | `x, y` | creak |
| `dive` | Camera zooms into a framed picture (cover lifting) until it becomes the scene | Going into detail: point 1 of 3, "inside this", a memory | 0.7–1.1 s | `rect {x,y,w,h}`, `cover`, `label` | whoosh |
| `shrink` | The scene shrinks into a gilt frame on the next scene's wall | Stepping back: "that was one example", putting a story on the wall | 0.8–1 s | `rect` | thunk / slide |
| `shatter` | The scene cracks, then falls in shards onto the next | Breaking from the old way, a myth busted, "but then…" | 1–1.2 s | `seed` | shatter |
| `curtain` | Velvet drops in steps, something happens on it, rises on the next | "Stop", "the end of that", a verdict; o.mid draws a stamp | 1.4–1.8 s | `mid`, `down`, `up`, `light`, `dark` | curtain + stamp |
| `tear` | A ragged paper edge sweeps down revealing the next | Revealing the truth under the surface; ripping up the script | 0.8–1 s | `seed` | paper rip |
| `ink` | The next scene seeps in through spreading blots | A feeling spreading (nerves, confidence), a dream | 1–1.3 s | `n`, `seed` | none / soft hiss |
| `mosaic` | Tiles flip over in a scattered order | Many small things adding up; practice, reps, versions | 1.2–1.4 s | `cols`, `rows`, `order: 'diagonal'` | rapid card flicks |
| `flipCard` | The whole picture turns over like a card | Before / after, the other side, a reversal | 0.8–1 s | `bg` | card flip |
| `pageTurn` | The scene peels off from the right like a page | The next chapter, reading vs speaking, a script | 0.9–1.1 s | | page turn |
| `slideOver` | The next scene slides in over the old one (which darkens) | An add-on, "and also", a phone or card arriving | 0.6–0.9 s | `dir` | slide |
| `drop` | The old scene falls away as the new one drops in on a spring | A sudden change of place, a fall, "then reality" | 0.6–0.8 s | | thud |
| `pop` | The old picture shrinks and tips away, the new pops up | A punchline, a comic reset | 0.8–1 s | `bg` | pop |
| `cut` | Straight cut at the midpoint | Most changes within a scene; speed | 0 | | none |
| gallery | Pull back to a wall of every painting, push into one | The ending: everything was one exhibition; into the app | 2.5–3.5 s | see elements.md | whoosh out, slide in |

Rules of thumb (from the reference films and the owner's verdicts):
- A 40 s film carries 8–10 transitions; never the same one twice, except `cut`.
- Big transitions sit on the turns of the script (new point, the "stop" moment, the ending), not on every sentence.
- Match the move to the line: the dive into frame 1 when the voice says "One:", the shatter when moving on from a
  first example, the curtain on "Then stop talking", the gallery for the download line.
- Keep transitions under about 1.2 s except the curtain and the gallery; the voice keeps going under them.
- An object in A that becomes B (the ball in `three-ways`, the framed painting in `tell-me-painted`) reads better than a
  transition that comes from nowhere. Plant the object a beat before.

## Writing a new transition

Follow the shape in `kit/painted.js`: start with `if (before(t, s, A, B)) return;`, compute progress with an ease,
quantise with `P.step(k, n)` if it should feel stop-motion, draw with `A(t, f)` / `B(t, f)` (or `P.snap(name, …)` when
you need the picture as an image, e.g. to slice it). Add it to the sampler and check it mid-way before using it in a
film. Ideas not built yet: a match cut on a shape (a round ball → the moon), a page of a book opening onto the scene,
smoke clearing, a camera shutter, a spinning wall (theatre flat) turning round, a split screen that slides apart.
