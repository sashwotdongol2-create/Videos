# RicksClips composition guide: where to put things in the frame

> **Superseded in part (2026-11-20, user).** CAMERA_STUDY.md (31 Shorts, 690 frames) wins on **camera height / angles,
> shot-size mix and head size**: about 75 % eye level, 5 % low; medium ~30 %, ≥ 20 % no character; head 30-40 % of the
> width in a medium shot. The low-camera, 39 %-wide and 43 %-no-person targets below and in the §5 checklist no longer bind.
> This file still decides horizon height, head contrast, thirds and the script-word -> frame table.

Date 2026-11-18. Companion to `D:/resource/stickman/cam_study/CAMERA_REPORT.md`, which covers how the camera moves. This guide covers what sits
where in each frame.

**Source.** 10 RicksClips Shorts (5 best, 5 worst by views per day) plus our Double Survivor draft. One frame every
1.5 s, 406 frames in all. Each frame was logged for shot size, head position and size, camera height, horizon line,
depth layers, leading lines, foreground, contrast and look direction.

- Data (in `D:/resource/stickman/cam_study/comp/`): `log/<id>.json` (one row per frame)
- Contact sheets with thirds grid: `sheets/`
- Numbers: `comp_table.md`, `comp_stats.json`
- Tools: `tools/comp_sheet.py` (sheets) and `tools/comp_stats.py` (table)

## 1. The numbers that separate good from bad

| measure | best 5 (range per video) | worst 5 | ours |
|---|---|---|---|
| frames in the "middle" sizes (waist-up to full body) | 37 % (28-50) | 43 % | **70 %** |
| frames whose body fills more than half the frame height | body height median 0.45 | 0.45 | **0.60** |
| wide shots (place dominates, people small) | **39 %** (24-58) | 21 % | **12 %** |
| frames with no person (prop, place, event) | **43 %** (31-51) | 31 % | **18 %** |
| low or ground-level camera | **35 %** (14-51) | 7 % (0-12) | **12 %** |
| high or top-down camera | 16 % | 8 % | **3 %** |
| eye-level camera | 49 % | 85 % | **85 %** |
| horizon / floor line height (0 = top) | **0.42** (0.38-0.47) | 0.60 (0.55-0.70) | **0.70** |
| head clearly pops from the background (value or colour) | **72 %** (65-86) | 50 % | **4 %** |
| leading lines point at the subject | 32 % | 25 % | 15 % |
| 3 depth layers (foreground, subject, background) | 51 % | 47 % | 24 % |
| subject framed by a window, door or arch behind the subject | 12 % | 13 % | **48 %** |

Four measures cleanly split the best videos from the worst ones. Every best video beats every worst video on each,
and we sit at or below the worst on all four:

1. **Camera height.** The best videos shoot low 14-51 % of the time. The worst shoot low 0-12 %. Ours is 12 %.
2. **Horizon.** In the best videos the horizon or floor line sits at about 40 % of the frame height, so there is a lot of
   sky or wall behind the head. The worst sit at 55-70 %; ours is at 70 %. Our camera looks down at the floor.
3. **Shot size.** The best videos jump between extremes: wide places, prop inserts, and medium or close faces. We
   live in the middle, with a full body filling the frame 70 % of the time. *This is why our character "feels too
   much in front".*
4. **The head pops.** RC's white head sits against a darker or saturated, clean area: blue sky, a red wall, shadow.
   Ours sits against a mid-tone, busy wall with even light.

**Rule of thirds: what RC actually does.**

- A **single face that is reacting or speaking** is usually **centred horizontally** (71 % centre column). It sits
  just above the burnt-in caption: head centre at 40-47 % height, caption at about 65-70 %.
- **Thirds come in when there are two things.** The character goes on one vertical third, looking across at the thing
  the line is about (prop, rival, sign), which sits on the other third. This holds for two-person shots too: one head
  per third, often on a diagonal (one big and high, one small and low).
- **Mechanism and object inserts are centred and symmetric**, often top-down.

## 2. The RC frame recipe (vertical 9:16)

```
┌──────────────┐  0 %
│  sky / clean │  ← clean, saturated area behind the head (sky, coloured wall, shadow)
│     wall     │
│    (HEAD)    │  ~40-47 %: head centre. Single face = centre. With a prop = left/right third
│ ─ horizon ─  │  ~40-45 %: horizon or floor/wall line, at or just below the head
│   caption    │  ~65-70 %: caption zone (keep it clear of faces and the key prop)
│ ground/rails │  bottom third: ground, rails, road or carpet running INTO the frame toward the subject
│  fg object   │  sometimes: a cropped object at the lens (pot, plank, bars)
└──────────────┘ 100 %
```

- Camera **low**, around knee to waist height, looking slightly **up**. That lifts the horizon behind the head and
  puts sky behind it.
- The set is placed so its lines (rails, road, roof beams, carpet, wall base) run **diagonally** toward the subject.
  Never shoot flat-on to a wall (our office and street lineups).
- The head is **the brightest or most saturated spot** in the frame. Keep the background behind it darker, cooler or
  plain.

## 3. Picking the frame from the script word

Decide shot by shot, by what the word is about. One sentence usually gets 2-4 frames (see CAMERA_REPORT.md §2).

| the words are about... | frame | composition | example |
|---|---|---|---|
| **the hero doing the strange act** (hook) | low medium shot (MS) | head centre-upper, prop in the other third, low camera | rail worker sawing the rail (7xS #0), coaster builder with a hammer (Ql #0) |
| **a feeling or reaction** ("furious", "laughed", "terrified") | close-up (CU/MCU), head 45-75 % of the width | centred, clean or dark background, strong contrast | purple angry face on red rock (7xS #12) |
| **a thing / prop / number** ("the ball", "every 39 days", "a pendulum") | INSERT, no face | centred and symmetric. Top-down for mechanisms, macro low for small objects | pendulum from above (VS1Z #33), reel strip (CJwg #12-19) |
| **power / status** ("the Emperor", "his boss") | low angle, looking up | figure framed by throne, arch or gate; lines converge on them | Emperor on the throne (VS1Z #4, #14) |
| **scale / crowds / armies / distance** ("biggest army", "far away") | high wide shot or EWS | people small, the place dominates, a leading line runs to them | army from the balcony (VS1Z), carpet to the gate |
| **being alone, lost, small** | wide, one small figure on a third, empty space around | horizon low, lots of sky | inventor alone on the hill (VS1Z) |
| **two people in conflict / talking** | two-shot on a diagonal | one head big and near on one third, the other smaller and further on the opposite third, looking at each other | engineer + boss on the rails (7xS #13), rival vs hero (Ql) |
| **a place / setting change** ("That night", "In the city") | wide establishing shot with a leading line | horizon at about 40 %, small figure where the line ends | rails into the canyon (7xS #3-6) |
| **danger / chaos / action** | dutch tilt 5-15°, closer, foreground debris | only here; never in calm dialogue | rough sea (Mz72 #21-25) |
| **the payoff / disaster** | stacked vertically: event in the top third (explosion, wave), witness head in the lower half | the head is small against the huge event | ending of 7xS, i4hY and Ql |

**Balance over a whole video** (best-video averages): about **10 % close faces, 37 % medium, 39 % wide, 14 % inserts**.
More than 40 % of frames have no person, because props and places tell the story. Avoid 3+ frames in a row at the
same size.

## 4. What we do wrong (Survivor draft) and the fix

| # | problem | where | fix |
|---|---|---|---|
| 1 | Full body fills the middle of the frame (MFS/FS 63 %) | #5-6, #8-9, #19-20 | Pick a side: either close (head 45 %+ width for emotion) or wide (body under 25 % height for place). Cut the "standing full figure" framing to under 20 % of frames. |
| 2 | Eye-level camera at chest height, horizon at 70 % | almost every frame | Default camera at knee to waist height, tilted up 5-10°. Horizon at 40-45 %. |
| 3 | Shot flat-on to a wall; people stand in a row like a police lineup | office #0-2, #22-25; street #15-18 | Turn the camera 30-45° to the wall so floor, beams and the wall base become diagonals. Stage people on a diagonal (one near and big, one far and small). |
| 4 | Heads do not pop (strong contrast 4 % vs 72 %) | blue night street, office | Put a darker, plainer or saturated area behind the head (sky, shadowed wall). Add a key or rim light on the head. Keep the background 1-2 stops darker. Don't grade the whole frame one blue. |
| 5 | A window behind the subject in half the frames, with the event (bomb) inside the window | #0-4 | Show the event as its own frame (event in the top third, witness head small at the bottom), not as a picture on the wall behind people. |
| 6 | Few prop and place frames (18 % vs 43 %) | "3 DAYS" is a sign, no prop close-ups | Every story noun gets an INSERT (name stamp, white cloth, the train ticket). |
| 7 | The same setup repeated for 6 s | street lineup #15-18 | Every 1.5-2 s, change at least one of: size, height or side. |
| 8 | Leading lines point away from the hero | rails #11 | Put the hero where the lines meet. |

## 5. How to direct a line (process for our scripts)

For each script line in the shot plan, write one row per picture:

```
word(s) | frame type (from §3) | size | camera height + angle | subject position (C/L3/R3, head height %) |
second element + its third | leading line | foreground object | what is behind the head (clean/dark?) | move into next
```

Then check the whole plan:

- [ ] Shot sizes over the video come to roughly 10 % close, 35 % medium, 40 % wide, 15 % insert, with no full-body
  standing frame repeated.
- [ ] At least 30 % of frames are low camera, at least 10 % high or top-down, and eye level is under 50 %.
- [ ] Horizon at 40-45 % in exterior shots. Interiors are shot at an angle to the walls.
- [ ] Every head has a clean or darker area directly behind it.
- [ ] Every story noun has an INSERT.
- [ ] Two-character shots are on a diagonal, never a flat lineup.
- [ ] The caption zone (about 65-70 % height) is clear of faces and key props.
- [ ] Render stills of each frame and put them through `python D:/resource/stickman/cam_study/comp/tools/comp_sheet.py <video.mp4> <out_prefix> 1.5` before animating. Compare the sheet against
  the RC sheets in `D:/resource/stickman/cam_study/comp/sheets/`.
