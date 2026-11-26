# Camera, transitions and framing: measured on 31 stickman Shorts (2026-11-19)

**Binding.** This file replaces guesswork about shot tightness, camera motion and transitions. MASTER_WORKFLOW
stage K (camera) and the pre-render QA read it. RC_CAMERA_MOVEMENT.md (the user's file) still sets the move vocabulary;
the numbers here set how much, how often and how big.

## Sample and method
| channel | Shorts | views of the sample | median length |
|---|---|---|---|
| RicksClips (@RicksClips3000) | 12 | 3.8M-35M (top hits) | 63.9 s |
| Celyx (@Celyxi) | 11 | 16K-7.2M | 68.5 s |
| Knox Clips (@KnoxClips7000) | 8 (whole channel) | 21K-6.3M | 70.8 s |
| ours: black-cat Short | 1 | - | 39.0 s |

- **Camera motion, every frame** (`research/camera_study/analyze_motion.py`): corners tracked between frames, a
  RANSAC similarity fit gives pan, tilt, zoom and roll per frame. Calibrated: a still image measures 0.000; a
  synthetic 3 %/s push measures 3.3 %/s.
- **Transitions** (`stats.py`):
  - a hard cut is a one-frame picture change;
  - a soft transition is a 3-24 frame window of strong change with no cut frame, typed by the motion inside it: whip
    (fast pan), zoom-through, roll, move (the camera travels into a new view) or dissolve (the middle frame is the
    average of the frames either side).
  - Classifier errors were checked by eye on 8 events and fixed: dissolves were first mis-typed as moves.
- **Framing**: 690 frames labelled by eye, one every 3 s (`labels_*.txt`): shot size, camera angle, body or head cut
  by an edge, foreground occluder. A person detector found 0 of 33 cartoon frames, so it was not used.
- **Word lock**: faster-whisper word onsets against transition times.

## 1. Transitions: how often and what kind
| metric (median per video) | RicksClips | Celyx | Knox | ours |
|---|---|---|---|---|
| shot changes per minute | **14.1** (6.7-20.3) | 21.0 | 18.3 | 15.4 |
| median shot length | **3.5 s** (1.9-8.6) | 2.2 s | 2.3 s | 3.8 s |
| soft (continuous) share of all changes | **76 %** (33-100) | 10 % | 50 % | 60 % |
| soft transition duration | **0.27 s ≈ 8 frames** | 0.43 s | 0.22 s | 0.22 s |
| changes within ±0.12 s of a spoken word | **78 %** (chance 58 %) | 50 % (chance 54) | 50 % (chance 56) | 60 % |
| hard cuts made while the camera moves on both sides | **100 %** | 87 % | 85 % | 75 % |

Mix of all shot changes (pooled):
| kind | RicksClips | Celyx | Knox | ours |
|---|---|---|---|---|
| hard cut | **28 %** | 86 % | 55 % | 40 % |
| camera travels into the next view ("move") | **26 %** | 5 % | 18 % | 10 % |
| dissolve / blend | **24 %** | 2 % | 19 % | 30 % |
| zoom-through (push or pull through the frame) | **13 %** | 1 % | 1 % | 0 % |
| whip pan | **9 %** | 6 % | 8 % | 20 % |

**What the frame strips show RicksClips doing** (10 fps strips, `closeups/strip.jpg`):
- **Foreground wipe:** the camera tracks laterally behind a big foreground object (the jar, a pillar, a train). The
  object fills and blurs the frame for 4-8 frames, and the camera comes out in a new composition (VS1Z 5.2 s,
  7xS8 2.4 s).
- **Surface dive:** a fast tilt or crane through a wall or cliff face into a new place (7xS8 8.4 s: canyon water to
  desert). It reads as one move, not a cut.
- **Push-and-dissolve:** a slow dolly into a dark area of the frame dissolves into the next room while still
  pushing (GM9 29.6 s).
- **Cut inside a move:** when they hard-cut, both shots are already moving (100 %), so the eye carries the motion
  across the cut.

**Celyx** is the opposite style: hard cuts every 2.2 s, nearly all straight cuts, and a constant slow push on every
shot. **Knox Clips** sits between them, with dissolves and moves half the time.

## 2. Camera motion inside shots
| metric (median per video) | RicksClips | Celyx | Knox | ours |
|---|---|---|---|---|
| time the camera is moving | **96 %** | 95 % | 98.5 % | 81 % |
| longest still holds (median) | 0.07 s | 0.03 s | 0.05 s | 0.10 s |
| pan / tilt speed, median | **0.19 % of frame per frame (≈ 6 %/s)** | 0.06 | 0.03 | 0.08 |
| pan / tilt speed, 90th percentile | 1.16 %/frame (≈ 35 %/s: the swoops) | 0.97 | 1.06 | 0.42 |
| push-in rate when pushing | **10.8 % scale per second** | 6.0 | 6.0 | 4.5 |

Share of moving frames by dominant component (median):
| component | RicksClips | Celyx | Knox | ours |
|---|---|---|---|---|
| push in | 46 % | 67 % | 62 % | 34 % |
| pull out | 16 % | 9 % | 7 % | 6 % |
| pan + tilt | 13 % | 8 % | 12 % | 8 % |
| roll / arc | 20 % | 10 % | 19 % | **52 %** |

**Reading:**
- **All three channels never let the camera stop**, at 95-98 % of frames moving. Ours stops more, at 81 %.
- **RicksClips' signature:** a strong slow push (about 11 % per second) with real pull-outs (16 %), and fast swoops
  (35 %/s) only inside transitions.
- **Our camera rolls far too much.** 52 % of our moving frames are dominated by roll (the beat `roll` values and the
  dizzy fade), against 20 % at RicksClips. This is one reason our shots felt "AI-like".
- **Our push is about half RicksClips' speed:** 4.5 against 10.8 %/s.

## 3. Framing: shot sizes and what is allowed out of frame
Share of all sampled frames (1 frame every 3 s):
| size | RicksClips | Celyx | Knox | ours |
|---|---|---|---|---|
| ECU face (X) | 0.4 % | 1.6 % | 0 % | 0 % |
| close (C, head ≥ 35 % of the width) | 6.8 % | 15.0 % | 4.2 % | 23 % |
| **medium (M, head + torso)** | **28.5 %** | 37.7 % | 24.8 % | 7.7 % |
| full body (F) | 16.9 % | 8.9 % | 30.9 % | 38.5 % |
| wide (W, character < ¼ height) | 16.9 % | 10.9 % | 12.1 % | 15.4 % |
| **establishing, no character (E)** | **12.4 %** | 7.7 % | 11.5 % | 0 % |
| **insert / object close-up (I)** | **11.6 %** | 16.6 % | 9.7 % | 7.7 % |
| mid-transition frame (T) | 6.4 % | 1.6 % | 6.7 % | 7.7 % |

| framing rule (frames with a character) | RicksClips | Celyx | Knox | ours |
|---|---|---|---|---|
| closer than full body (X + C + M) | 51 % | 73 % | 40 % | 36 % |
| body cut by a side edge | 15 % | 36 % | 24 % | 27 % |
| **head cut by an edge** | **4 %** (deliberate ECU only) | 9 % | 3 % | 9 % (a legs-only frame) |
| foreground object over the character | **1.7 %** | 17.5 % (deliberate) | 5 % | **27 %** (accidental: lamp post, branches) |
| eye-level camera | 77 % | 89 % | 82 % | 82 % |
| high angle / top-down / low / ground-level | 11 / 4 / 5 / 3 % | 8 / 2 / 0.5 / 0.5 | 16 / 1 / 2 / 0 | 18 / 0 / 0 / 0 |

**Reading:**
- **The medium shot is the workhorse:** head and torso, the head about a third of the frame width, sitting in the
  upper third. It is 28-38 % of frames at RicksClips and Celyx, and only 8 % of ours. After the "too tight" notes we
  over-corrected to full body (38 %), which is why shots felt distant or cut oddly.
- **A quarter of every Short has no character at all** (21-24 %): establishing shots of the set and object inserts
  (signs, notes, mechanisms, maps). Ours has 8 %.
- **A body cut by the side edge is normal** (15-36 %). **A head cut by an edge is not** (4 %), except a deliberate
  extreme close-up.
- **RicksClips never lets a random prop cover the character.** Foreground objects are used to wipe between shots,
  not to sit in front of a face.
- **RicksClips uses more camera angles than the others:** top-down, ground-level (rails converging to the lens),
  low-angle hero shots and an occasional dutch angle, each 3-5 %.

## 4. The camera formula (binding numbers for beatCam and the shot plan)
1. **Rhythm:** one shot change every **3.5 s on average** (14 per minute; never a single shot over 8.6 s). Put **≥ 75 %
   of shot changes on a spoken word onset (±4 frames)**.
2. **Transition mix per Short** (RicksClips style):
   - 25-30 % hard cuts, always with the camera already moving on both sides;
   - about 25 % travel-into-the-next-view moves (one continuous move that ends in the new composition);
   - about 20 % dissolves or blends, 8 frames, done while still pushing;
   - 10-15 % zoom-throughs (push through an object, door, window or the phone screen into the next set);
   - about 10 % whip pans, plus foreground wipes behind a set object.
   
   Transition length is **8 frames** (0.27 s), never longer than 0.45 s.
3. **The camera never stops.** Every beat has motion:
   - **Push:** the default push is **10 % scale per second** (dist × 0.90 per second); a calm beat uses 5 %/s.
   - **Pull-outs:** 15 % of beats, for reveals.
   - **Swoops** (≥ 30 % of frame per second) only inside transitions.
   - **Roll:** at most ±3° and on at most 1 beat in 5. A dutch angle is used once per Short at most, as a gag.
4. **Shot sizes across a Short:**
   - medium about 30 %, full 15-20 %, wide 15 %, close 7-15 %;
   - establishing (no character) 10-12 %, inserts 10-15 %;
   - at least 20 % of shots without a character.
   - Start each new location with an establishing or wide frame (≤ 1.5 s) or a move into it.
5. **Medium-shot geometry** (our 1080×1920 frame):
   - the head is 30-40 % of the frame width;
   - the top of the head sits 8-15 % below the top edge;
   - the eyes sit at about 33 % of the height;
   - the torso is cut by the bottom edge, never at the knees.
   
   For close shots the head is 45-60 % of the width, with the chin above the bottom quarter. In a full shot the feet
   sit at about 85 % of the height, with headroom ≥ 10 %.
6. **Out-of-frame rules:**
   - The head is never cut except in a planned ECU.
   - The body may be cut by the side edges.
   - Every listener or animal named in the beat is fully in frame.
   - No set prop between the lens and a face, unless it is a planned foreground wipe that clears within 8 frames.
7. **Angles:** about 75 % eye level, about 10 % high or top-down, 5 % low (power or hero), 3-5 % ground level (paths,
   rails, roads converging), 1 dutch angle.

## 5. Pre-render QA, run on one still per beat (in addition to the existing lens checks)
- [ ] Head inside the frame, and head-width % in the band for the shot size (§4.5).
- [ ] No set object between the lens and any face (ray test from camera to the head joints).
- [ ] The camera moves in every beat: dist or az changes ≥ 5 % per second, and roll ≤ 3°.
- [ ] Shot-size shares and the share of shots with no character within §4.4. Transition mix within §4.2.
- [ ] ≥ 75 % of beat changes within ±4 frames of a word onset (words.json).

## Built into the engine (2026-11-19)
- **`src/kit/beatCam.ts`:**
  - `CAM` defaults: push 0.10/s; a `hold` beat becomes a calm 5 %/s push with 0.5°/s orbit, so the camera never
    freezes; roll is clamped to ±3°.
  - `beatCam(beats, t, { dur, enter, exit })` carries a move across the boundary over 8 frames: `through` (fast push
    in), `dive` (downward swoop), `whip` (fast pan), `wipe` (lateral slide) or `move` (gentle drift, for cuts while
    moving).
  - `frameHead(head, headW, size, az, el, fov)` solves dist and the aim point, so the head lands at the measured width
    and eye line for X / C / M / F / W. `standingHead(at, height)` gives a standing character's head centre and
    width.
- **`src/film/transitions.ts`:**
  - new edit.json kinds `through`, `dive` and `wipe` (8 frames each; the default dissolve is xfade frames);
  - `Look` gains `y`, `vblur` and `mask` (the soft-edged foreground-wipe reveal);
  - `transOf(kind)` builds any transition.
  - Pair each edit.json kind with the same `enter` / `exit` in the shots' beatCam options.
- **`src/film/Film.tsx`:** exports `layerStyle` and `BlurDefs` (horizontal and vertical directional blur).
- **Example:** `package/examples/camera_sample/CamSample.tsx`, an 8 s test: establishing → dive → medium (frameHead
  "M") → through → insert → wipe → two-shot + reveal pull-out. Measured with the study's own analyser: camera moving
  99.5 % of frames, push 7.8 %/s, roll on 16 % of moving frames.
- **Round 2 (measured from the same data, installed):**
  - **Move shape:** RicksClips' 257 camera moves last a median **14 frames** and peak at **41 %** of the move.
    beatCam's ease is now smootherstep(u^0.85) (peak 41.8 %), and the default `move` is 14 frames.
  - **Speed through transitions:** RicksClips' camera speeds up through a transition (0.35 → 0.50 of peak); ours
    dipped to 0.06. Every shot now enters already moving (default `enter: "move"`).
  - **Real foreground wipe:** `src/kit/FgWipe.tsx` is a depth-of-field-blurred, bark-grained slab 0.3 m in front of
    the lens. It sweeps across and covers the frame at the boundary. Render it with `wipeU` in both shots (`exit` in
    the outgoing, `enter` in the incoming) and enter the second shot with a `cut` in edit.json, because the switch
    happens under the cover.
  - **Face QA:** `faceClear(scene, cam, heads, frame, label)` in `world/camera.ts` raycasts against the WHOLE set
    every 6th frame and logs `FACE BLOCKED`. Skip it during planned transitions and wipes (first / last 8 frames).
  - **Camera QA tool:** `package/tools/camera/camqa.py <project> [film.mp4]`. Run it before delivery; it must print
    `CAMQA PASS`.
    - Plan checks: shot changes per minute 10-20, median shot 2-5 s, ≥ 75 % of changes on a word onset (±4 frames),
      ≥ 60 % continuous transitions.
    - Video checks (the study's own analyser): camera moving ≥ 90 %, push 6-15 %/s, roll ≤ 25 % of moving frames,
      ≥ 80 % of cuts made while moving.
    - The old black-cat film FAILS 4 of 4 video checks; the camera sample PASSES 4 of 4.
- **Merged into our skill 2026-11-20:** `CAM.bank` = 0.006 (the code had 0.06) and the default `move` carry is push-only
  (its 3° az swing read as roll). Camera sample on our roadfield set: moving 100 %, push 10.9 %/s, roll 24 % (camqa pass).
- **Still to do:**
  - the shot planner that adds establishing and insert beats automatically (for now: plan them by hand; camqa
    counts the result);
  - real 3D dives through a surface (the dive is a camera swoop plus a smear).
