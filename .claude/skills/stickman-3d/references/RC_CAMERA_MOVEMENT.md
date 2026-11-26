# RicksClips camera movement: what the best videos do

> **User camera rules (2026-11-21) win over everything below and over CAMERA_STUDY where they differ.** ONE smooth
> eased move per shot in one direction; no roll (drop the bank / 2-5 deg roll below); no jitter and no re-aims
> (several beats inside one shot only if they keep moving the same way); shake only on explosions and gunshots;
> RicksClips framing = character AND environment, head ~12-18 % of the frame width, no face-filling close-ups
> (replaces "faces 25-45 %" in section 5). Hero shots: author the move in Blender with `S cam <shot>` (spec
> blender/cams/<shot>.json, PIPELINE.md -> Blender cameras; `blenderCam("sNN", t)` in the shot); its check fails a
> roll, a move or pan reversal, or an eased start / stop under 0.4 s. beatCam stays available for the other shots.

> **Superseded in part (2026-11-20, user).** CAMERA_STUDY.md wins where they differ: the camera never stops (a punchline
> `hold` is a calm 5 %/s push, not rate 0), default push 10 %/s, 14-frame moves, roll on at most 1 beat in 5, 8-frame
> transitions, low camera only ~5 %. The noun-per-beat and travel / parallax ideas below still apply.
>
> **Merged 2026-11-19.** Write cameras with `src/kit/beatCam.ts`; COMPOSITION.md decides where things sit in the
> frame (camera height, horizon, shot-size mix) and LOOK.md -> Depth the layering; this file decides how the camera moves.


Study date 2026-11-18. Five best RicksClips Shorts (most views per day) were compared with the five worst and with
one of our own drafts. Every frame was measured at 30 fps (zoom, sideways motion, roll and parallax from a similarity
transform). Word timings came from faster-whisper (small.en). Then every script line was reviewed by eye on frame strips.

- Best: 7xS87iActkU (railroads), i4hYq1oSXTg (cart vs army), QlDPMzGmYac (roller-coaster loop),
  VS1Z_Q-Klt8 (ancient jar), Mz72MuPgnGY (storm oil)
- Worst: CJwgTrfrHL0 (slot machines), _sUAXTvJquk (painkillers), uRkLhDrKQeU (tree), t3OXkhlI6NQ (memory price),
  jpFJ8Z_F-qU (knight loophole)

## 1. The numbers

| | best (median) | worst | our draft |
|---|---|---|---|
| zoom speed, typical (log/s) | 0.090 | 0.084 | 0.033 |
| zoom speed, fast moments (p90) | 0.65 | 0.66 | 0.29 |
| sideways speed, typical (frame widths/s) | 0.094 | 0.080 | 0.026 |
| time with sideways motion | 70 % | 70 % | 48 % |
| time pulling out | 27 % | 20 % | 10 % |
| real 3D travel (parallax) | **0.22** | 0.09 | 0.06 |
| camera roll (deg/s) | **3.5** | 1.5 | 1.1 |
| speed changes (accel, median) | **0.41** | 0.30 | 0.12 |
| move-type changes per second | **2.5** | 1.7 | 1.7 |
| near-still time | 12 % | 13 % | 23 % |
| scene change | 0.1-0.25 s dissolve on a time word, or a camera flight | 0.1-0.3 s dissolves everywhere | 0.3 s dissolve at every shot |

Parallax, roll and how often the move changes are what separate the best from the worst. The best cameras really
travel through the 3D set: they move past things, so near and far slide apart. They tilt and bank, and they change
what they are doing about every 0.4 s. Copying the average (a slow, steady push-in with small spikes) gives a flat
curve with dissolves, which is the same shape as the weakest videos.

## 2. What the best videos do: the camera follows the words

1. **The picture changes on the noun, not the sentence.** One sentence gets 2-4 subjects, and each one arrives on the
   word that names it: "finger" → a face over the gap, "teeth" → a row of grins, "everything" → an empty wallet.
2. **The camera follows the cause, not the speaker.** In a process, it follows the moving object: the oil pot to the
   sea, the grappling hook from the pirate deck to the rail, the cart climbing the loop, the ball dropping.
3. **The camera acts out the verb.** It looks where the cook points, closes the gap on "so close", rises on "lifts"
   and sinks on "down". Moves peak on the meaning word ("black", "clangs", "board", "yards").
4. **Low and wide, with something at the lens.** The camera sits at ground level with rails, gravel, a pot, a banner or
   a jar lid a few cm from the lens. A wide lens makes the track or crowd run hard into depth. Height follows power:
   low on the Emperor, high on the army, top-down on a mechanism.
5. **Big faces, upper-middle.** Faces take 25-45 % of the frame width, with the eyes at 25-40 % of the height, above the
   captions. Money or emotion lines push in to 45-55 %.
6. **Jokes: push on the setup, hold on the punchline.** "Does he know...?" pushes in hard (+1.14 log), then "Not
   really." is held still. Facts and numbers get a locked frame with a prop doing the work (a coin dropped into the
   gap, a glowing track, a wave crest drawn above the mast for "taller than the mast").
7. **Pull-outs reveal something new**, such as the court, the Emperor, all eight dragons, or the 50 yards between the
   ships. A pull-out with no reveal is wasted.
8. **Scene changes are short and mean something.** Dissolves of 0.1-0.25 s land on time words ("That night",
   "Meanwhile", "The next morning"), often on a shape match (porthole → porthole, soup → oily sea). Big jumps are one
   camera flight (over the train, canyon and desert into the station; up the fort wall and over the battlement).
   There is at most one hard cut, after a punchline.
9. **Opening:** the hero does the strange act in a low medium shot, then within 1-2 s the camera pushes onto the
   object or pulls out to show the result.

## 3. What the worst videos do wrong

The weak videos use the same moves (push-throughs, flights, dissolves). The difference is **what the camera points at
and which word the move lands on**:

- **No person on screen for long stretches**, for example 23 s of a pill and empty corridors, or 10 of 31 s with no
  face. The hero is a nameless "you" or a crash-test dummy.
- **Moves land on filler words** ("with", "the", "and", "starting", "time"). Only about a third of the fast moves land
  on a meaningful word.
- **Punchlines get no camera beat.** "It's just warming up", "Big mistake" and "Lesson learned" are static.
- **Payoffs are not shown close.** "Rips the batteries out" is shown as small alarms at the edge of the frame.
- **Too many worlds, one picture per clause:** about 12 sets in 78 s, or 8 picture worlds in 15 s, so nothing builds.
- **Endings are a locked wide shot** (face about 5 % of the frame) or a cramped face.
- Much of this comes from the script and topic (metaphors, no conflict), not only the camera.

## 4. Common mistakes when copying the style (found in our own draft)

| Mistake | What RicksClips does instead |
|---|---|
| One subject per sentence, one shot held 4-5 s | 2-4 subject changes per sentence, on the nouns |
| The noun in the script is never shown | Every story noun is shown close at least once |
| Watching the people while the cause happens behind them in a window | Follow the cause (ball, crack, oil, blast) |
| Faces 12-25 % of the width, sometimes on the edge | Faces 25-45 % of the width, eyes in the upper third |
| Always chest height, level, no roll | Low for power or the hero, high or top-down for crowds and mechanisms, 2-5° roll on fast moves |
| Empty floor or road in the bottom half | A prop, rail or doorframe within ~0.5 m of the lens |
| The camera only shrinks the distance to one point (parallax 0.06) | Orbit, crane and fly past things (parallax ≥ 0.2) |
| Word spikes too small to see (0.15-0.6 log) | 0.4-1.5 log moves, together with a subject change |
| Pull-outs that show nothing new | Pull out only to reveal |
| Slow constant creep everywhere, holds on instructions | Hold still (rate 0) on punchlines and reveal words, push on the setup |
| The same 0.3 s dissolve at every shot change | Short dissolves on time words, a flight or shape match for location jumps |
| One camera set-up reused for 9-10 s | Never repeat a framing |
| A move that starts on the wrong word (a pan 2 s early, so the payoff plays over an empty frame) | The move peaks on the meaning word |

## 5. Rules for the camera

1. **Plan shots per noun, not per sentence.** Mark the 2-4 words in each line that get their own picture (a face, a
   prop, the cause). The camera changes subject on those words with 0.3-0.5 s eased moves of 0.4-1.5 log zoom.
2. **Travel.** The path moves *past* things (orbit, crane, fly-through) instead of only closing the distance. Aim for a
   parallax of 0.2 or more.
3. **Height and roll.** Low for power or the hero, high or top-down for mechanisms and crowds, 2-5° of roll on fast
   moves.
4. **A foreground object** within about 0.5 m of the lens in most shots (rail, prop, doorframe, plant).
5. **Faces 25-45 % of the frame width** (camera about 1.2-2.0 m away at a 56° vertical fov), eyes in the upper third.
6. **Hold** still on punchlines and reveal words. Push on the setup.
7. **Pull out only to reveal** something new.
8. **Transitions:** 0.1-0.2 s dissolves on time words, a camera flight or shape match for location jumps, and at most
   one hard cut, after a punchline.
9. **Show every story noun close** at least once.

## 6. Implementation: a word-keyed camera ("beatCam")

This is how we built the rules into our three.js / Remotion engine. It replaced a single "push toward one subject"
camera per shot.

- The camera is a list of **beats keyed on words** (word timings from whisper). Each beat can set: `subj` (what to
  aim at), `az` / `el` (orbit angle and height around the subject), `dist`, `fov`, `roll`, `move` (the move's
  length), `push`, `orbit` and `hold`.
- Between beats the camera travels on a sphere around the subject (az / el / dist), so it naturally moves past
  things and gets parallax, with a small bank on fast moves.
- Every frame is a pure function of time (no randomness or carried state), so renders repeat exactly.

Tuning that worked:

- **3-4 beats per sentence at most.** Five beats in 5 s felt frantic.
- Default slow orbit between beats: **1.5°/s**.
- Bank (roll) factor **0.006**, capped at **3°**.
- Scene changes: short dissolves (about 5 frames) plus push / whip / hard-cut kinds where they fit.

Result on our draft after the change: static time went from 25 % to 10 %, and zoom, roll and acceleration came
close to RicksClips. Parallax only went from 0.06 to 0.10 (RicksClips 0.22), so more real travel through the set is
still the main gap.
