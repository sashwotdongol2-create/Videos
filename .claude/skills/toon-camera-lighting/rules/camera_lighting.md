# Camera work and lighting

## Camera
The camera tells the story: at every moment it shows what the voice or the story is about. Plan it from the words,
not from what looks cool.

### 1. Plan every shot before animating
- For each beat in `cook/BRIEF.md`, write one camera line: **the subject** (what this line is about), the **start
  framing**, the **end framing**, the **move** (hold, push in, pull out, pan, rise, fly-down) and **how it connects**
  to the next beat (continuous move, dissolve or cut; see section 5).
- **The user's camera directions win.** When the prompt says where to zoom, what angle to use, or where NOT to move,
  do exactly that, word by word, at that exact line. Don't add moves where they asked for a hold, and don't drop a
  move they asked for. Only the beats they left open are yours to decide.
- Put the camera line on the storyboard sheet (the transition tag), so the user approves the cameras with the stills.

### 2. Push in on what the story is about
- When the voice **names an object or an action**, or an object becomes **the centre of the story** at that moment
  (a new tool, a sign, a crash, a spill, a reaction), the camera pushes in on it during that line:
  - start moving about 0.3-0.6 s before the word;
  - arrive on the word or just after it, with the object filling about a third to a half of the frame;
  - hold about 0.5-1 s so it reads;
  - then ease back out to show the context, or dissolve to the next beat.
- Example (Rumble Strips): "Then he shows up **with a machine** and starts grinding". The camera pushed in on the saw,
  a glint ran along the blade, a slight slow motion showed it off, then the camera eased back as he bent down to cut.
  The same happened for the warning sign, the thermos on the seat and the ruined road edge.
- **A new character** gets a medium shot where the face reads. **A new place** opens wide (establishing shot) before
  moving in. **A reaction** (shock, grin, sleepiness) moves closer on the face.
- **No random zooms.** Don't push in on things the story doesn't mention. Between named moments, hold or drift
  slowly; let the action play.
- Aim at the object's centre. Keep the subject on a third of the frame, facing into the open space. The path must
  never pass through objects, walls or people (check every frame of the path, not only the keys).
- Sizes: **wide** = the place, subject under a quarter of the frame height; **medium** = the character full-length,
  about two thirds of the frame; **close** = a face or an object filling about half the frame. Characters are mostly
  full-length; never crop the head or hat by accident, and never zoom in so far that the viewer loses what's going on.

### 3. Move calmly
- One smooth move per shot, or a hold. No handheld drift, no tilt, no orbits, unless asked.
- Even speed along the path (arc-length timing) with speed changes blurred over about 0.6 s. Never a sharp turn, a
  snap, or a left-right sway on a push-in. The look-at point never passes the camera.
- The field of view changes with the move: about 34-50 degrees, narrower for push-ins, wider for establishing shots.
- Impacts shake the camera (a short decaying shake); rumble strips get a continuous fast jitter. Nothing else shakes.

### 4. Angles
- Never a flat, level, straight-on angle unless asked; prefer slightly from below or above.
- Use creative angles where they help the story: at ground level next to the action, a high aerial straight down a
  road (centred, symmetric, wide lens), through a side window, the character's own point of view.
- Vary height and side between consecutive shots so cuts and dissolves read as new information.
- Nothing blocks the lens: open doors, poles, props, the car frame. Check the whole path.

### 5. Getting from one beat to the next
- **One continuous camera move** links two beats ONLY when all of these are true:
  1. the same place, or places physically connected so the camera can travel between them (road to an aerial of the
     same road; a street into a car through its window);
  2. the same moment, with no time jump;
  3. the travel is short and calm (about 3 s or less at an even speed);
  4. the path is clear, never through walls, roofs or people.
- If any of those is false, use a **cross-dissolve** (a new place, a time jump, day to night) or a **cut** (a
  point-of-view switch, a reaction, the same moment from another side). Never fade through black; no wipes.
- When dissolving between two times of the same place, match the framing (same angle, different time), the way
  Rumble Strips dissolved from day to night on the same stretch of road.
- The last frame of one shot and the first frame of the next must make sense together: same lighting state, same
  damage, same positions unless time has passed.

### 6. Continuity: no teleporting, nothing disappears
- Inside one continuous shot the world runs on one timeline. Every character and object keeps existing and only
  moves by real motion (walking, driving, falling, being carried). Nobody teleports; nothing pops in or vanishes.
- Something that leaves the frame is still there when the camera comes back, where it would be by now.
- Changes stay changed: open doors stay open, dropped things stay where they landed, damage stays, spilled coffee
  stays spilled, across shots too, unless time has passed and the story says otherwise.
- If someone needs to be somewhere new and the walk would take longer than the shot, don't move them during the
  shot: dissolve to a later time instead.
- Timelapses are the only place things may jump, and they must read as a timelapse (light changes, speed-up).
- Check: for every continuous move, take stills at its start, middle and end and compare the position of every
  character and prop. Across every cut or dissolve, compare the last and first frames for the same things.

### 7. Before rendering
- Every beat has a camera line, and every user camera direction is followed exactly.
- Every named object or action gets its push-in on the word; no push-in on things the story doesn't name.
- Every link between beats follows section 5; every continuous move passes the continuity check in section 6.
- Nothing blocks the lens and nothing is too zoomed in.

### 8. The camera editor
- The user can key cameras in the camera editor (per shot: time, position, target, fov). Respect the keys exactly
  and only smooth them. Offer the editor when the user wants to fine-tune camera moves themselves.

## Lighting
- A real sun (directional light with shadows) plus a blue sky fill (hemisphere) and the same sky as the environment
  map for reflections. Everything gets its light from it; objects cast real shadows; clouds cast soft shadows.
- Shiny objects (car paint with clearcoat, metal, hard hats) catch small highlights.
- Time of day blends day -> dusk -> night (domes, clouds, moon, fog, light colours, env maps).
- Night is dark and blue; a light in view (headlights, lamp, fire) makes its pool bright and the surroundings darker;
  with no light in view the moonlight reads clearer. Headlights are a soft wash that fades out (several wide spots at
  increasing distance, intensity ~ d^3), never a ray. Tail lights get a red glare sprite, a short flare and a red
  spot on the road. Never add cars that were not asked for.
- Characters are lit by the same sun (shading direction follows it) but faces stay white and clean at night (see
  characters.md, un-tone-mapped cards).

## Indoor scenes (offices, homes, shops, vehicles)
- Light comes from what is really there: windows (a soft daylight key with sky fill), ceiling lights, lamps and
  screens. Each visible lamp or screen gives light (point or rect area light, distance and decay 2) and glows.
- Corners and under furniture go darker (low ambient); light pools under lamps. No flat, even lighting.
- Characters follow the same character lighting rule: faces stay white, their shading follows the main light, and
  shadows of real objects fall on them.
