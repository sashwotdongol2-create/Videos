# Characters, movement, faces, clothes, lighting on characters

## How a character is built (never character sheets)
- No 3D character model and no pre-drawn poses. Every character has an invisible 3D skeleton (hips, chest, head,
  shoulders, elbows, hands, knees, feet) posed every frame: two-bone IK for arms and legs, spine bend, crouch, yaw,
  head look. The 2D drawing is rebuilt from that skeleton on a canvas every single frame (`toon2d.js`).
- Joints are projected along the camera ray onto camera-facing cards, so a drawn hand lands exactly on a 3D prop and
  size follows perspective. Body card ~0.12 m in front of the root; a front card ~0.55 m carries arms that hold things.
- Draw order: far arm/leg always behind the torso; a near limb comes in front only when its joint really is in front.
- Limbs are ink strokes of constant width curving through knee/elbow. Hands are ink balls, feet small ink ovals that
  point the way the foot faces.
- The card faces the camera; pitch toward the camera is clamped to 55 degrees so high/low angles never squash it.
- Back view (body facing away): draw the back of the head (hair, hat), no face.

## Movement
- Planted feet: footsteps are world positions; a foot stays exactly where it landed until its next step (no sliding).
- Normal strides (~0.5 s, 0.35-0.6 m). The body glides between footfalls on a monotone cubic with a slight bob.
  Turning on the spot uses real steps, never a foot swivel.
- No teleporting: every hand target blends in from the rest pose by a weight; feet never snap. Jumps only in a timelapse.
- Movement is creative and slightly exaggerated (bouncy, overshoot, anticipation) with a creative pose per action.
- Kneeling, sitting, crouching, picking up are real IK poses (kneePoles for the knee direction).
- Heavy things are held from below on both palms; hands slide from a side grip to underneath as it lifts.
- Holding a tool: grip points are Object3Ds on the prop (rear handle + top handle of a saw); both hands land on them.
- Anything that gets hit shakes (sign when hammered, guardrail and car in a crash, the camera too).
- A worker on a road stands outside the road on the shoulder, facing the road.

## Objects, hands and bodies must make physical sense (every scene)
These rules hold in every shot, not only in the scene where a problem was first seen. Check them on every still.

**What is in front of what (depth order)**
- Every prop near a character has a real 3D position. Whether it draws in front of or behind the 2D character is
  decided by real distance to the camera: anything between the camera and the body draws IN FRONT of the body.
  A controller held at the chest, a cup in the hands, a steering wheel, a seat belt, a table edge, a dropped object
  in the lap: all in front. The character's drawing must never cover something that is closer to the camera.
- Held objects stay attached to the hand that holds them (both hands for two-handed objects) and are drawn at the
  hand's depth.
- Worn things sit where they belong on the head and body: headphone cups on the ears, the band over the top of the
  head, a microphone in front of the mouth, a hat on the head, glasses on the eyes. They turn and tilt with the head.

- How, in this engine: a character is a depth-tested card placed at the body (`cardOff` pulls it toward the
  camera). A prop nearer the camera than the card hides it correctly only if the card stays behind the prop: keep
  `cardOff` smaller than the prop's distance in front of the body, or draw the prop as part of the 2D drawing
  (front layer) when it's in the hands or lap. The POV arm card (`setup.js`, `depthTest: false`) paints over
  everything: when a prop must be in front of POV arms, give the prop a higher `renderOrder` (above 100) or hide
  the arm there. Check with a still from the shot's camera every time.

**Released and dropped objects**
- When a character lets go of something (shock, surprise, a fall), it keeps moving the way real things do: it falls
  from where it was, lands on the nearest surface below it (lap, seat, table, floor), bounces or slides a little and
  settles. It never vanishes, teleports, floats, or passes behind or through the body.
- A sudden reaction makes things drop or fly naturally; plan where each one lands before animating.

**Hands**
- A hand that grabs or leans on something uses the support on ITS OWN side: the left hand takes the left armrest,
  rail, door or wheel side; the right hand the right one. Arms never cross the body to reach the far side unless the
  story needs it (reaching across for an object on the other side).
- Hands land on real contact points of the 3D object (armrest top, wheel rim, handle) and the fingers wrap it. A
  hand never hovers, sinks into the object, or grips air.
- In a shock reaction, hands either fly up open or clamp onto the nearest same-side support. Never a pose that
  looks tangled.

**Sitting**
- Default seated pose: hips on the cushion, back near the backrest, knees bent about 90 degrees, shins down, feet flat
  on the floor about hip-width apart, legs parallel. Same in cars, chairs, sofas, buses and planes.
- Never cross the legs or ankles, and never cross the arms, unless the story asks for it (a relaxed boss leaning
  back, a nervous fidget). If it is not in the script or the brief, keep them uncrossed.
- Legs and feet never go through the seat, the floor or the seat in front.

**Check before sending (each still and each shot's start, middle and end)**
- every prop: correct side of the body, correct depth, held or resting on something;
- every hand: same-side support, real contact;
- every seated character: feet flat and apart, nothing crossed without a reason;
- anything dropped: where it lands, and that it got there by falling.

## Sitting in vehicles
- Hips on the right seat cushion, feet on the floor by the pedals, knees bent (thigh forward, shin down), leaning
  slightly toward the wheel. Hands visibly grip the rim (fingers wrap it).
- Scale the character to the cabin (~0.68 for a car) so the head clears the roof and sits just above the headrest.
- Pull the card toward the camera (`cardOff` ~0.2-0.3) so seats never cut through the drawing.
- Nothing dark on the face: seats, headrests and frame parts between the camera and the character must not cut
  shapes into the face. Clip the drawing to the window openings and never put frame blocks inside a window opening.
- Seen from behind, draw the back of the head (hair, hat) with no face.
- POV arms: ink arms with ball fists wrapped round the rim, no outline.
- Check from outside through the glass at full size.

## Faces (from emotions, never presets)
- Every frame the face is computed from emotion levels: surprise, fear, anger, joy, sadness, effort, doubt,
  tiredness (+ blowing). Any mix gives a face, so new expressions appear that are in no reference.
- Reference faces are references only; never pick a preset face.
- Proportions in head radii R: neutral eyes = solid black dot ovals ~0.08 x 0.12 R at x=+-0.27 R; wide eyes = white
  circles ~0.19 R, thick outline, pupil ~0.075 R; half-lidded = thick flat lid line ~0.075 R wider than the eye;
  strain = thick > < chevrons; blink = short arc.
- Both eyes always the same type. Change eye type outright (never a fade), hidden inside a blink.
- Brows lead, the mouth follows last; the head squashes and bounces on every change of feeling, then a still hold.
- Brows: short thick rounded bars, never level. Default mouth: small imperfect dark bean. Shock: big round mouth with
  red tongue (never the happy D). Teeth: white row with lines (grin / gritted / grimace). Moustache: chunky lobes,
  curled tips, ink outline, soft shine. Sweat drops on the face.
- Characters blink, breathe, glance; each has a temperament (tempo, amplitude).

## Clothes and accessories
- Torso: skinny egg (narrow top under the head, widest 2/3 down, round bottom). Arms attach just below the neck.
- The body outline always faces the camera, but clothes are drawn as if wrapped round a round invisible form: on a
  turn stripes, buttons, tie, pockets slide toward the side and compress at the edge; back views hide front details.
- Hats and hair are 2D and redrawn every frame for the head tilt and look direction: the brim swings to the look side,
  tips forward when looking down (never over the eyes), bounces on a spring driven by head acceleration.
- Hair hugs the head shape (short, slight fringe), never big. Some characters wear hats, some only hair.
- No perfect shapes: every outline point carries a fixed wobble. Base accessories on a real reference.
- New cast for every story; never re-dress an old cast. Never name characters on screen.

## Lighting on characters (the style rule)
- Faces pure white (#ffffff), even at night. Cards use the un-tone-mapped material (`unTone.js` inverts ACES);
  otherwise white renders ~226 grey. Measure a face pixel: ~253.
- Face: cel shaded - one light main tone plus a hard-edged slightly darker crescent on one side, following the
  scene's light direction (so it moves when the light moves or the character turns), plus a thin shine line along
  the edge.
- Body, hat, hair: lighter on one side, darker toward the other, thin white shine lines (~50% opacity) inside the
  outline following the shape's curve, a soft blurred sheen on cloth, subtle fold lines.
- Scene shadows: where a real occluder (tree canopy, roof) blocks the sun, multiply a low-opacity blue-grey layer over
  only the drawn pixels there (rays from the character's real position to the sun). Leaf shade is dappled.
