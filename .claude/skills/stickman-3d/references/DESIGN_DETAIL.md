# Design detail: the RicksClips finish (characters, props, objects, environments)

> **Merged 2026-11-19.** WORLD.md (measured colour / sky / grass / depth targets) and the RULES.md asset rules win:
> everything the cast touches or stands near is built in Blender in the film's style; ready-made only for the far
> background; game-ready budgets; no scanned vegetation.


Studied 2026-11-18 at full 1080p on RicksClips3000 frames:
- **Ancient Jar:** dragon close-up 1.0 s, throne hall 19.5 s, sunset hill 30 s
- **Perfect Railroads:** canyon beam 13 s, station newspaper 33 s
- **Job Nobody Wants:** clock insert 10 s

Binding with [MOTION_EXPRESSION.md](MOTION_EXPRESSION.md) and the POSTED_LESSONS checklist.

## The core recipe: two styles in one frame
- **Characters stay flat and graphic:** a white or skin bean head, thick black ink outline, drawn face.
- **Everything around them is fully detailed 3D:** PBR materials, real light, depth of field.

The contrast is the look. A cheap-looking frame comes from the opposite: flat or simple sets, or overly detailed
characters.

## D1. Characters
- **Head:**
  - large; head width ≈ 0.45-0.6 × body height above the hips
  - ink outline 3-4% of head width, even and clean
  - a slight hand-drawn wobble in the outline
- **Faces:**
  - the face sits low-centre on the head
  - eyes are big ovals with dot pupils, 18-25% of head width each
  - brows are thick tapered strokes
- **Skin detail on older or rough characters:** stubble dots on the jaw, grey beard texture, small cheek lines.
  The emperor at 19.5 s has stubble dots.
- **Bodies are clothes, not sticks:** a robe to the floor, a vest over a shirt, plaid flannel, overalls with straps,
  each with a real texture:
  - plaid checks, denim, stripes, knit
  - seams, belts, buttons, collars, neckerchiefs
  - only the forearms, hands and shins are thin ink sticks
- **Hats are 3D and shaded:** bowler, flat cap with striped fabric, crown, hair-pin with jade bead. They are lit like
  props, with a specular highlight, and are the strongest silhouette marker.
- **Small props on the body or in hand:** a coffee mug, a pocket knife, a cigarette, a hairpin. Every character
  holds or wears at least one story item.
- **Variety in one frame:** the railroad bench has 5 workers, each with a different hat, clothing colour, pattern,
  facial hair and action.

## D2. Props and objects
- **Hero props are fully modelled and lit,** real 3D close to photoreal:
  - the bronze dragon has scale texture, metal specular, teeth, eye detail and a reflection on the ball
- **Story inserts are full-frame and graphic:**
  - the newspaper has a real masthead, headline, sub-head, columns and an engraving
  - the clock has full numerals, minute ticks, a red second hand and a bevelled rim
  - all text is legible and in period
- **Dressing:**
  - every surface has objects: candelabras, banners, benches, goblets, crates, coffee cans
  - nothing important floats in empty space
- **Physical believability:** wheels have spokes and hubs, wagons have rope lashing, the jar sits on a cart with
  ropes, and the frog statues each have a pose.

## D3. Environments
- **Painterly 3D, hand-painted textures:** the Gothic hall has stone blocks with dark outlines, stained glass,
  carved capitals, a patterned carpet, red velvet drapes with fringe.
- **Two to three depth layers in every shot:** a blurred foreground object, the character in the mid-ground, and a
  detailed background.
- **Strong colour scripts per scene:**
  - throne room: blue, red and gold
  - canyon: orange and magenta against blue sky
  - sunset hill: pink and violet with sun rays
  - office: mint green

  Saturated, but controlled, with each scene built on 2-3 hues.
- **Atmosphere:** god-rays, glowing sun discs, cloud bands, floating dust, mist in the distance, grass blades in
  silhouette against the sun.
- **Scale:** sets are built big (vaults, canyons, station roofs) so wide shots feel epic.

## D3b. Outdoor environments (RicksClips "This Tree Hates You", "Why Drivers Started Filming The Road", 2026-11-19)
- **No empty horizon, ever.** Behind every character: a layered treeline (cartoon cone pines mixed with leafy
  trees), suburban houses with siding and porches peeking through, hedges, fences, lamp / power poles, road signs.
- **Three depth layers outdoors:** foreground clutter (a car, a bush, a plant, a lamp post), the character, then the
  treeline / houses softened by haze. Mid-ground props (benches, tables, flowerbeds) fill the lawn.
- **Lush ground:** bright, saturated grass with visible tufts and blade clumps, never one flat green.
- **Sky:** deep blue zenith fading to a pale hazy horizon, big white lit cumulus; sun-lit, crisp shadows.
- **User rules from the black-cat Short:** faces framed with head + shoulders + symbol (>= 1.9 m), listeners and
  animals fully in frame, crowds whole; collisions shown side-on with both bodies touching; knock-outs fade dizzily;
  symbols ride the head; no stray props on bodies.

## D4. Lighting and render
- **Light:**
  - one strong motivated key: sun, torch, window
  - warm key against cool fill, soft contact shadows under feet and props
  - rim light on the head in backlit scenes
- **Depth of field:** shallow on close-ups (the dragon insert), medium on mid shots; the background is always
  slightly soft.
- **Materials:** gold, glass, wet stone and lacquer get real reflections and specular highlights.
- **Ink outline on 3D:** sets carry a thin dark outline on major edges only (stone blocks, furniture), never on
  foliage or far distance.

## D5. Captions
White bold text with a thin dark outline and soft shadow, at mid-frame or lower-mid, one or two words, no box.

## What this means for our pipeline
1. **Character rebuild:**
   - bigger head ratio
   - clothed bodies (robe, vest, overalls) with textured fabrics and modelled collars, belts and buttons
   - 3D shaded hats
   - stubble and beard texture options
   - one held story prop per character
   - a cast sheet showing 6+ distinct silhouettes
2. **Prop library:** hero props from Sketchfab or Blender with PBR and close-up quality, plus graphic insert
   templates rendered as full-frame shots:
   - newspaper, letter, clock, sign, ticket, cheque, map
3. **Sets:**
   - every set gets a dressing pass with at least 25 props
   - 3 depth layers, a colour script of 2-3 hues, an atmosphere element and a motivated key light
   - reuse limits from POSTED_LESSONS L6
4. **Render:** depth of field on every shot, specular on metal and glass, contact shadows, rim light, and ink only
   on major set edges.
5. **QA:** put one still per scene next to a RicksClips frame of the same shot size and check, side by side:
   - detail density
   - depth layers
   - light direction
   - character size
   - outline weight
