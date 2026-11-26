# The @RicksClips3000 Formula: Script, Visual Aesthetic, Camera, Direction

Measured from 28 videos (shorts), every frame at native 30.00 fps (~47,390 frames). Numbers come from the **21 strong videos** (the all-time most viewed plus the fastest-growing recent uploads; 3.8M-33.8M views). Ranges are the middle half (25th-75th percentile). Generated 2026-11-13.

**What the channel is:** ~60 s vertical "weird true story" explainers. Flat 2D **bean-head stickman** characters (white round head, dot eyes, pill body, stick limbs) are placed as cut-out cards inside **fully rendered, warmly lit 3D sets**, and a fast, deadpan narrator tells a story with a twist. **Scope:** only the channel's current format (its newest 28 uploads). Its older uploads are dubbed webcomics over Minecraft parkour and a re-cut live-action film. Those are a different product, so they are excluded. Sections kept: script, visual aesthetic, camera, direction (editing and staging), plus a Blender + three.js build sheet. Sound numbers are in `features.csv`.

---

## 1. Script

### Hook (first sentence)

| Rule | Number |
|---|---|
| Narration starts at | **0.00 s**: the first word is on frame 0 |
| First sentence | **14** (11-19) words |
| Words/s in the first 3 s | **4.00** (3.67-4.33), faster than the 3.68 body rate |
| Misconception set-up ("you might think") | 0 of 21 |

**Opening-line types** (first sentence, strong videos):

| Type | Count | Real first lines |
|---|---|---|
| in_medias_res | 15 | "He put a bronze ball in a dragon's mouth and told the Emperor if this ever falls out, run!" · "He sawed gaps into a railroad every 39 feet." · "They buried a man alive with a bell tied to his finger." |
| if_you_hypothetical | 3 | "If you fall asleep holding two steel balls, you might wake up a genius." · "If your ship got hit by a cannonball, you'd actually be one of the lucky ones." |
| paradox statement | 2 | "Gambling is illegal in Japan, yet there's a gambling hall on almost every street." · "There's a button in the middle of town, and nobody's allowed to press it." |
| command | 1 | "Look at these two scratch cards." |

**Hook templates (use in this order of preference):**
1. **"[He/They] [did an absurd, specific thing]."** This is 15 of 21, and 4 of the 6 newest winners. The line is past tense, has one concrete number or object, and gives no reason. Examples: "He sawed gaps into a railroad **every 39 feet**." "He drilled **82 holes** into the wood…" "He bet his life savings on the slowest horse in the race." "They painted the jail cell pink, and not just any pink."
2. **"[Rule/law] says X, yet [X is everywhere]."** A paradox. Examples: "Gambling is illegal in Japan, yet…", "It's impossible to get fired in Japan, but companies found something way worse."
3. **"If you [odd action], you'll [unexpected result]."** Used rarely (3 of 21).

The 2nd sentence is always **mockery or stakes**: "The whole court burst out laughing." "The whole betting room is laughing at him." "His commander asks, are we fighting them or grating cheese?"

### Body

| Rule | Number |
|---|---|
| Length (s) | **62.3** (56.1-64.6) |
| Words | **224** (200-237) |
| Speech rate | **3.68 w/s** (3.58-3.76) = **221 wpm** |
| Voice covers | **100%** of runtime (99-100); longest pause **0.46 s** |
| Sentences | **11** (9-15), **18.2** words each (14.9-21.5): long run-on sentences joined by "and", "but", "so" |
| Reading grade | **6.4** (5.5-8.9) |
| Questions in narration | **1** (0-1); never ends on a question (0 of 21) |
| Sentences with "you" | **2** (1-4). It is third-person storytelling, not lecturing |
| Title | **6** (5-7) words: "Why [X] [does Y]" / "The [noun] That [verb]" / "How a [object] [did Y]" |
| Ending loops to the first frame | 2 of 21 |

### Beat structure (start as % of runtime, from vision labels, n = 21)

| Beat | Starts at | What happens |
|---|---|---|
| hook | **0%** | The absurd act, already happening on screen |
| setup / turn | **~24%** (18-33%) | "**You see,**" + context (who, where, stakes), then the doubters laugh and a "**But…**" complication |
| mechanism / escalation | **~59%** (48-69%) | It escalates (night falls, a test fails, a rival wins), then a second "**You see,**" or "**That's because**" gives the real mechanism, often through an everyday comparison ("think about the last time your phone slid off a table") |
| payoff | **~80%** (74-87%) | The odd act pays off visually: the explosion, the earthquake, the derailment, the scam revealed |
| ending | **~94%** (92-96%) | One dry closing line: "…and that's how the dashcam was invented." "The buyer is him." |

**Story templates seen across the winners:**
- **The Mocked Genius** (8 of 21: Ancient Jar, Perfect Railroads, Storm Oil, One Cart, Mirror Horse Race, Second Draw, Roller Coaster, Spear vs Shield). A man does something absurd, everyone laughs, "You see" explains the stakes, the rivals win at first, the hidden physics/history plays out, and he is proven right in a big visual payoff.
- **The Clever Scam / Loophole** (5: Burglar Who Moved Furniture, Grave Bell, Cashier Lottery, Gambling Window, Knight Loophole). A strange act, people react, a "But…" complication, then the twist reveal re-reads the opening ("he'd sold them that house a year earlier and kept one key").
- **The Real-World Mechanism** (4: Idea Zone, Random Numbers, Pink Cell, Time Test). A claim, a demonstration with a named character, "That's because…", and a one-line science fact.

**Recurring phrases:** "You see," (in 15 of 21 strong transcripts, usually twice) · "But…" opening a sentence (14 of 21) · "The whole [room/court/town] laughed" · quoted taunts in a flat voice ("Hey, mirror man, maybe try wiping it.") · "Wait, what?"

**Don't (what the control group does; differences measured):**
- **Don't lecture in the second person.** Controls use **6** "you" sentences against **2** for the strong videos (p 0.013). "Would You Upload Your Brain?" and "This Tree Hates You" are "Imagine you…" essays.
- **Don't chop the sentences short.** Controls use **13.7** words per sentence against **18.2** (p 0.011). Long, breathless sentences keep the story flowing.
- **Don't end on a question to the viewer** ("So, would you still step inside?"). Both of the videos that did are in the control group.
- **Don't build the video on one metaphor with no protagonist.** Painkillers, the weakest video at 318k, spends its middle in body tunnels with no stickman. Every strong video has a named or recurring hero on screen at almost every beat.

---

## 2. Camera (phase correlation + dense optical flow on every frame pair)

| Rule | Number |
|---|---|
| Camera moving | **96%** of runtime (95-97); static hold only **4%** |
| Push-in / dolly in | **77%** (73-80) |
| Pull-out | **16%** (12-18) |
| Pan / tilt / sideways | **4%** (4-5) |
| Push speed | **0.128 log-zoom/s** (0.117-0.148) = **~14% closer every second** (0.43%/frame) |
| Sideways speed | **0.042 frame widths/s** (0.030-0.054) |
| Jerk (RMS, lower = smoother) | **35.4** (29.1-47.0): smooth, eased moves, no handheld |

**Camera logic in one line:** every shot is a **slow, steady push-in on the speaker or prop**. It is broken by a **fast push or pull spike** (±1-2.5 log-zoom/s for ~0.3 s) on a reveal word, and by **pull-outs that reveal the crowd or the scale** after a close-up.

**Worked example: "The Ancient Jar That Warned an Empire" (33.8M, `charts/camera_VS1Z_Q-Klt8.png`):**
- **0-1 s:** a medium shot of the inventor beside the jar, then a **fast push into the gold dragon head** (+0.8) as he says "dragon's mouth".
- **2.5 s:** a **pull-out** (-1.0) to the Emperor's throne room.
- **5-6 s:** a push-in (+1.2) to the laughing court.
- **6-20 s:** a gentle drift (±0.2) through the "You see" exposition.
- **20-21 s:** a **big push** (+2.4) into the wine bowl, the ripple, then a **pull-out** (-1.9) to the Emperor.
- **21-41 s:** slow drifts through the sunset exile and the night.
- **41.5 s and 47.5 s:** push spikes (+1.0, +2.4) on "the ball dropped" and "the next morning".
- **53 s:** the one **whip-sideways move** (4 frame widths/s), from the city ruins to the inside of the jar.
- **60 s:** a pull-out (-1.8) to the aerial earthquake fissure.

**Shot sizes** (vision estimate, % of screen time, strong videos): wide ~30, medium ~30, close-up ~22, extreme close-up ~8-10, inside-object/x-ray ~5. Recurring set-piece moves:
- **Push through** a window, door, CRT monitor, gun muzzle, eye pupil, or a head that opens like a hatch, into the next location. This is how the camera goes "inside" for the explanation beat.
- **Rise to aerial** for a time skip ("weeks later", "within a year").
- **Follow the object:** a bullet, an oil stream, a bell string, a cannonball.
- **Tilt down** a character to a prop in the hand.

---

## 3. Direction: editing and staging

| Rule | Number |
|---|---|
| Scenes per video | **13** (10-15) |
| Scene length | **3.5 s** (3.2-3.9); longest **12.1 s** (10.1-13.4) |
| Transitions per minute | **12.1** (11.0-13.5) |
| First transition at | **3.6 s** (1.7-7.2) |
| Hard cuts | **0%** measured; **2%** (6 of 243) when labelled by eye |
| True render frame rate | **30.0** fps; duplicated frames 0.1% |

**How scenes change** (243 real transitions labelled from 9-frame strips; 181 more candidates were camera moves):

| Transition | Share |
|---|---|
| Cross-dissolve, ~0.3 s (9-10 frames) | **78%** (189) |
| Zoom-through / continuous fly to the next scene | **13%** (32) |
| Wipe (foreground object passes, smoke fills frame, iris, scan-line) | **4%** (9) |
| Whip pan | **3%** (7) |
| Hard cut | **2%** (6) |

**Editing rule in one line:** change scene about every 3.5 s, and **dissolve, don't cut**. The dissolve often keeps the same framing and swaps the location, time of day or character underneath, so the picture never "jumps". A hard cut is kept for a **sudden impact or reveal**: the cannonball hitting the hull, cutting inside the forge, the dashcam reveal.

**Strong vs control** (the clearest direction signal, p ≤ 0.005): strong videos hold scenes **longer**, with a median of **3.5 s** against **2.0 s**, **13.3** scenes/min against **20.9**, and **12.1** transitions/min against **19.2**. Fast gag-per-line cutting is the weaker version of this channel. **Let each scene breathe for 3-4 s while the camera keeps moving.**

**Captions:** on screen **98%** of the runtime. **1 word** at a time (1-2), karaoke-synced. White bold sans, thin black outline, sentence case with punctuation kept. Centre at **y = 0.70** of the frame, just under the character's face.

**Staging rules (from vision labels, 24 stickman videos):**
- **Frame 0 is mid-action:** the absurd act is already happening (sawing, painting, pouring, a hand at the dragon's mouth). Never open on a title or an empty set.
- **One hero per video.** Give him an identity prop: a hat, hair tuft, or name badge (flat cap engineer, bowler boss, lanyard cashier). He is on screen in nearly every beat.
- **The crowd laughs as a group shot.** Several identical guards or courtiers with squint eyes and open grins: a repeated "mockery" beat (shown up to 3x in the Jar video).
- **Information lives in the world, never in overlays.** Banners, newspapers ("THE CLICKETY CLACK LINE"), calendars, paint chips ("P-618"), price tags, ticket designs ("REEL BIG CASH"). Labelled 2D diagrams appear only in the science explainers (the sleep-depth gauge in Idea Zone), and heavy overlays are a control-group trait ("This Tree Hates You").
- **Relight one set to move time or mood.** The same shot goes day → deep-blue night → golden dawn. Emotion grades are a red alarm wash for fear, a green tint for envy, and a purple dream wash.
- **End on a payoff image + deadpan face:** a fireball, the earthquake fissure, the dashcam on the windshield, then a cut to the hero's flat expression.

---

## 4. Visual aesthetic

| Measure | Number |
|---|---|
| Brightness (luma mean, 0-255) | **113.7** (105.1-130.6) |
| Contrast | **51.3** (49.4-54.9) |
| Saturation | **114.8** (109.9-122.3): rich, not neon |
| Background stays one colour | **31%** of frames (23-42): full environments, not studio colour |
| Median border colour | #706875: dusky violet-grey from vignetting |

**Character (a flat 2D card, not a 3D model):**
- **Head:** a big **circle, ~40-45% of total figure height**, about 3x the body width. Usually white; skin-tone or grey-lavender in some videos.
- **Body and limbs:** a short **pill/bean torso** in one saturated flat colour (royal blue, red, mustard, navy uniform). **Thin black stick limbs** with dot hands and no fingers.
- **Outline:** thick dark ink on the head and body.
- **Face:** **two dot eyes** (ring eyes when shocked), short heavy brows, and a line mouth. Hair is one shape: a brown helmet or tuft.
- **Expressions are instant swaps of eyes, brows and mouth, never tweened:**
  - smug half-lid squint (the hero's default)
  - deadpan
  - ring-eyes with a wavy mouth for shock
  - big toothy grin
  - squint and open mouth for laughing
  - angry brows; a purple face with steam puffs for rage
  - a sweat drop
  - closed eyes for sleep, with "Z"s
- **Props get faces** sometimes, for example a gunpowder bag.

**Sets (fully rendered 3D, stylised Pixar/toon):**
- **One strong key light:** a warm practical (bare bulb, candle, lantern, furnace, ~2700-3500 K) or golden-hour sun, against **cool blue fill/night**. The warm-against-cool contrast is the grade.
- **Atmosphere:** volumetric **god-rays and haze**, **bloom** on light sources, and a **heavy vignette**.
- **Depth:** shallow depth of field on the background so the flat character card reads in front.
- **Two finish variants exist.** Most videos use a painterly/toon finish with soft materials. About 3 of 24 use a game-engine-realistic world (grass, highway, fort). The character stays identical in both.
- **Palette per video:** one dominant environment hue (red canyon, pink cell, turquoise sea, neon-purple Tokyo), the hero in a contrasting saturated colour, warm amber highlights, and blue-violet shadows.

---

## 5. Blueprint for a new video (62 s @ 30 fps = 1868 frames)

| Time | Frames | Narration | Camera | Editing / staging |
|---|---|---|---|---|
| 0 s (0%) | 0-90 | **Hook:** "He [did absurd specific thing with a number]." Then: "The whole [room] laughed." | Open medium on the hero mid-action, **fast push into the key prop** on its noun (+1 log-zoom/s for ~0.3 s), then pull-out to the laughing crowd | Frame 0 mid-action; first dissolve at ~2-4 s to the crowd group shot |
| ~15 s (24%) | ~449 | **Setup/turn:** "You see, [who/where/stakes]…" then "But [complication]." | Slow push-ins at ~14%/s on each speaker; rise to aerial for any time skip | A 0.3 s dissolve every ~3.5 s; relight the same set for day → night |
| ~37 s (59%) | ~1104 | **Mechanism:** the rival seems to win, then "You see / That's because [real mechanism] + everyday comparison" | **Push through** a window, eye or object into an inside/cutaway set; follow-the-object moves | One zoom-through as the gateway to the explanation; in-world signage carries the numbers |
| ~50 s (80%) | ~1500 | **Payoff:** the absurd act works ("the pendulum swung…", "the rails buckled") | The biggest push or pull spike of the video (±2 log-zoom/s); one whip if there's a projectile | The only hard cut, if any, lands on the impact |
| ~58 s (94%) | ~1746 | **Ending:** one dry line: "…and that's how [X] was invented." / "The buyer is him." | Pull-out to a wide or aerial payoff image, then a slow push on the deadpan hero | Last dissolve; no loop and no question |

---

## 6. Build sheet: Blender + three.js

The measurements above turn into these settings.

**Characters: 2D cards in 3D space**
- Build each character as a **flat card**: a textured plane, or a Grease Pencil object in Blender. Keep separate layers for head, body and limbs (2-bone limbs on a simple rig), plus a **face atlas** (eyes, brows and mouth sprites) that swaps on a frame for each expression.
- **Billboard toward the camera** (three.js: `lookAt(camera.position)` on the Y axis only).
- Render the character **unlit** (`MeshBasicMaterial`, or Emission in Blender), so the ink stays flat while the set gets the lighting. Add a soft contact shadow under the feet only.
- Outline: bake it into the texture (~2.5% of the head diameter).

**Sets**
- Use stylised low-to-mid-poly 3D sets with toon or principled shading. Use **one key light** (warm point or spot at 2700-3500 K, or a sun at golden hour), cool blue world/fill, and volumetric haze (Blender: volume scatter; three.js: fog + fake god-ray cones).
- Post: bloom (three.js `UnrealBloomPass`, strength ~0.6), a strong vignette, and background depth of field (`BokehPass`).

**Camera** (one keyframed camera per scene)
- **Default move:** a linear-eased **dolly-in of ~14% of subject distance per second** (scale = e^(0.128·t)). It holds still only ~4% of the time.
- **Reveal spikes:** a 0.25-0.35 s push or pull at 1-2.5 log-zoom/s with ease-in-out, timed to the stressed noun.
- **Sideways drift:** ≤0.04 frame widths/s. No camera shake except on impacts (2-4 frames).

**Editing**
- **13 scenes per minute**, ~3.5 s each.
- **Transitions:** a **0.3 s (9-frame) cross-dissolve** by default. About 1 in 8 transitions is a zoom-through (the camera flies into an object, and the next scene starts already moving). No more than one hard cut, on the payoff impact.

**Render**
- 1080x1920, **30 fps**.
- Captions burned in last: one word at a time, white bold sans with a thin black stroke, centred at y = 0.70.
