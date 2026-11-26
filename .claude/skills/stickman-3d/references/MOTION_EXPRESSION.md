# Motion and expression: how RicksClips and Dash's World make characters feel alive

> **Merged 2026-11-19. Read with LOOK.md -> Acting, which wins:** the user found per-word face changes and
> pupil darts "fidgeting" (2026-11-18). Keep from here: listeners react on reveals, symbols on the key word, gestures
> with anticipation / arc / overshoot, prop lag, object physics, a never-frozen frame (camera + environment). Faces hold
> 2-4 s and change on the character's own line or key word.


Measured 2026-11-18 from 6 Shorts (RicksClips3000: The Ancient Jar 35M, Perfect Railroads 30M, Job Nobody Wants
18M; DashsWorldd: Lifetime Plane Ticket, Sued for a Smell, Game Show Price). All are 30 fps, 608x1080, 52-65 s.
Method: per-frame difference over every frame, 1 fps contact sheets, and 16-frame strips at native fps.

## The main finding
Their bodies barely animate. A RicksClips character is a flat bean card on a stiff robe or tube body with ink-stick
arms, and the legs are often hidden. The "real movie" feeling comes from five things layered on every frame:
1. The face changes on almost every word.
2. Nothing on screen is ever still.
3. Arms and props move with weight: anticipation, arc, overshoot.
4. Objects obey physics: gravity arcs, speed trails, impacts.
5. The camera behaves like a hand-held film camera and cuts or whips on the word.

Copying Mixamo full-body realism is the wrong target. Copy these five layers.

## M1. The face is the actor (most important)
- **Expression rate:** in "The Ancient Jar" (3.5-4.6 s) the face changes 6 times in 1.07 s:
  - squint
  - eyes wide, pupils shrunk
  - flat bored lids
  - mouth open
  - side-eye
  - shocked wide eyes

  Peak rate is one new expression every 4-6 frames. The baseline is at least one change per spoken word or clause.
- **What changes:**
  - Eyebrows: angle and height carry most of the emotion.
  - Eyes: dot pupils, rings for shock, half-lids for bored or smug, closed arcs for happy, one eye closed for a wink.
  - Mouth: flat line, small "o", open shout with teeth, smirk tilted to one side.
  - Cheeks and lids are not used.
- **Faces react to other people.** Listeners don't freeze. On "the toy" / "Did your frogs" (41 s), the guard in the
  back goes neutral, then raised brow, then wink, then smug, while the foreground guard talks. Every visible face has
  its own reaction track.
- **Emotion symbols on the head, drawn in ink and popping in with a 2-4 frame scale overshoot:**
  - sweat drops (fear, pressure)
  - "!" (realisation)
  - "?" (confusion)
  - heart (affection)
  - "Z z" (sleep)
  - steam puffs from the head (anger)
  - streaming tears
  - sparkle stars (pride, gold)
- **Face colour swaps for extreme emotion:**
  - anger: the whole head turns purple, with gritted teeth and steam (Railroad)
  - nausea or shock: green with spirals (Plane Ticket)
  - fear: pale grey-blue with sweat
- **Head tilts:** the head card rolls 5-15° toward whoever it is speaking to. The full body leans 5-10° forward when
  talking hard and back when shocked.

## M2. Never a still frame
- **Measured:** the identical-frame ratio is 0.00-0.03 in all 6 Shorts. Median frame-to-frame motion is 1.7-8.3 (grey
  levels, out of 255), and the calm Dash's World videos sit at the low end.
- **Idle:** every character always has a slow sway, a breathing scale of 1-2%, small head bobs on stressed syllables
  and blinks every 2-4 s.
- **Cameras:** the camera always drifts, either a slow push-in or a lateral slide of 2-5% of the frame per second.
  It never locks off.
- **Environment:** flags flap, torches flicker, smoke rises, snow falls, dust floats and birds cross the sky.

## M3. Arms and props: weight and arcs
- **Arms are rubbery ink sticks.** A gesture swings out in an arc, not a straight line. It overshoots and settles in
  3-6 frames.
- **Every gesture has anticipation:** a small pull back before the motion forward.
- **Pointing and presenting hold for at least 8 frames** so the gesture reads on a phone.
- **A held prop lags the hand by 1-2 frames.** This is drag or follow-through: the dragon jaw, the paper, the
  ticket card.
- **Walks:**
  - a bouncy bob of 3-5% of body height per step
  - the body tilts into the direction of travel
  - the legs are thin sticks swinging in arcs
  - feet often fall outside the frame, so the bob carries the walk

## M4. Object physics
- **Falling things:** they follow a true parabola under gravity, accelerating on the way down. In "The Ancient Jar"
  (3.9-4.4 s) the ball falls from the dragon's mouth into the frog's mouth.
  - a faint trail of 3-4 ghost copies (smear frames)
  - squash on impact
  - a small bounce or settle
- **Vehicles:**
  - the train body lags its wheels on curves and leans out of turns
  - steam puffs rise and spread and lag behind the train
  - "sideways" reveals use a snake-like S-curve in the rails, a deliberately exaggerated path
  - speed shows as long colour streak lines on the walls (the Railroad canyon) and motion blur, not as distance travelled
- **Big events:**
  - debris flies in parabolic arcs and smoke billows upward slowly
  - explosions fill the frame for 3-6 frames, then cut
  - birds scatter in arcs, flapping
- **Small objects:**
  - a coin hits, bounces 2-3 times and settles
  - papers slide with friction
  - a lid swings on a hinge and overshoots

## M5. Camera and cut on the word
- **Cut rate:** shots last 0.5-1.0 s on average. Dash's World is slower (0.95 s mean) and RicksClips faster.
  Transitions:
  - RicksClips Railroad has 335 detected frame-jumps in 65 s
  - many are whip-pans with heavy directional motion blur (2-4 smeared frames) used as transitions between scenes
- **Word cuts:** the cut or push lands on the key word, which appears as a one-word caption at centre frame.
- **Shot types:**
  - inserts are full-frame and close: the letter, the jar's dragon head, the $250,000 cheque
  - the camera tilts or rolls 5-15° for drama (the railroad deck)
  - low angles for authority (the emperor on the throne)
- **Depth of field:** shallow, so the background blurs behind close faces. This also keeps phone readability.

## What this means for stickman-3d (rules from the next Short)
1. **Face track per word (required).** Every speaking or visible character gets an expression keyed to the
   narration words:
   - an expression set of at least 12 faces: neutral, smug, squint, shock, fear, angry, happy, sad, bored, wink,
     shout, side-eye
   - eyebrows as separate animated strokes
   - blinks every 2-4 s
   - listeners react, never freeze
2. **Emotion props:** sweat, !, ?, heart, Z, steam and tears as ink sprites on the head, with a pop-in scale
   overshoot of 1.0 → 1.25 → 1.0 over 4 frames, plus face-colour swaps for extreme emotion.
3. **Secondary motion layer on every character:**
   - breathing scale
   - idle sway
   - head roll toward the listener
   - body lean with emotion
   - prop lag of 1-2 frames
   - overshoot on every gesture end

   Mixamo stays the base motion. These layers are added on top in three.js.
4. **No locked frame:** every shot has a camera drift or push. Run a frame-difference QA. No run of 3 or more
   identical frames is allowed outside a deliberate freeze.
5. **Physics helpers for props:**
   - gravity arc with squash and bounce (`g = 9.8`, restitution 0.3-0.4)
   - spring settle for hinges and lids (overshoot 10-20%, settle in 6-10 frames)
   - vehicle lag and lean on curves
   - smoke and steam puffs that rise, grow and drift
   - smear trails of 3-4 ghosts for fast objects
6. **Transitions:**
   - whip-pans with directional motion blur of 2-4 frames between scenes
   - cuts and pushes land on the caption word
   - average shot length 0.5-1.0 s
7. **QA:** check the strip at native fps on one action per scene (16 frames, every 2nd frame). Look for:
   - an expression change per word
   - an arc on every gesture
   - nothing frozen

Source clips and sheets were kept in the session scratchpad. Re-measure on new reference Shorts with
`motion.py` (frame-difference stats) when updating this file.
