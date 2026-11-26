# Film grammar: from a script to a painted film

## The bar ("enough" for the owner)

"Too basic" (2026-11-19) was a film of two figures in a room with a few transitions. The level that answered it,
`tell-me-painted`, had in 40 s:
- ten paintings, five of them cut out, one crowd of nine figures;
- a new place for every beat of the script (an answer happens *inside* a painting, not in front of a wall);
- nine different transitions, each on a turn of the script;
- at least two moving elements per scene (a counter + a crowd; a curtain + a stamp; a porthole + type);
- a callback (the café comes back in a porthole) and an ending that ties everything together (the gallery wall).

Check a plan against that list before building.

## Planning table

Write this first (in the script's file or a scratch file), one row per beat:

| t | line (exact words) | who says it | picture (painting / room, who is in it) | elements | transition into the next | sound |
|---|---|---|---|---|---|---|

Rules for filling it:
1. **One beat per sentence.** A new sentence that starts a new point gets a new picture.
2. **Literal first, then a twist.** The painting should show the words (a café for the café, a tower for "bigger
   brand") and add a joke or a feeling the words don't say (Seurat's whole park turning up = 2,000 followers).
3. **People in places.** Put the hero cut-out inside the painting of the place she talks about; scale her to the
   painting's perspective (small in front of Babel, full height in Athens).
4. **Plant, then use.** Show an object before it becomes a transition (covered frames on the wall → dive into frame
   1; a ball rolls in → iris from the ball; the café → porthole later).
5. **Hide what's coming.** Numbered covers, "1 2 3" frames, an empty counter. Never show all three points first.
6. **One big move per turn.** Shatter, curtain and gallery are big; whip, wipe and cut are small. Big ones on the
   script's turns only.
7. **End on the app.** The last 3–4 s: the download line, the app's real screen, ideally reached by a move that
   gathers the film (gallery pull-back, iris close on the icon, shrink into a frame).

## Timing

- Place lines from the measured durations (`vo/lines.json`), with 0.15–0.25 s gaps; one character's answer can run
  under a transition's end.
- Stop motion everywhere: `f = floor(t * 12)`, `t = f / 12` at the top of `renderAt`; never animate on raw t.
- Transitions start on the word they belong to (the shatter as "Two:" lands), not after the line ends.
- Hold a final picture at least 1.5 s after the last word.
- 15 s: one place, one or two transitions. 30 s: three places. 40 s: five or six places, eight to ten transitions.

## Composition (1080 x 1920)

- Wall type y 200–560 (keep heads below it); captions y about 1700 on a paper strip; TikTok's own UI covers the
  bottom 250 px and the right edge, so nothing important there.
- Figure heights: 820–900 px for the hero in a room, 550–600 px when a big painting should dominate, 300–450 px for
  crowd figures; feet at about y 1560–1600.
- Wide shot with a group behind a table: raise the floor line (about 980) and stand the table's straight bottom edge
  on it; never leave a cut edge hanging on the wall.
