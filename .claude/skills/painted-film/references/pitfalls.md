# Pitfalls (each one happened)

## Pictures
- **A zoom built on an ease that starts at 0 flips the frame.** The dolly ease goes 0 → 1.03 → 1; zoom must be
  `1 + amount * ease`, never `ease` itself. (three-ways, 23 s, upside down.)
- **Cover-fit paintings spill past their box.** Side-by-side scenes in a pan or tilt showed the next painting over the
  corridor. `P.cover` now clips; anything else drawing a big image beside another scene must clip too.
- **An iris on a fast-start ease is over before anyone sees it.** Use `camera` (in-out) over 0.7–0.9 s.
- **Snapshots used out of order.** A porthole or shatter that reuses a canvas drawn earlier in the film can be empty in
  a still rendered on its own. Render stills in order (the default; `--fast` skips it) and check those shots in the
  mp4.
- **Title over heads.** With three lines of wall type, heads go below y 560.
- **Captions of back-to-back lines overlap.** `P.captions` ends each where the next starts.
- **End card text over the phone.** Size the app screen so its bottom is above y 1480 when text sits under it.
- **A group cut-out's straight bottom edge hanging on the wall.** Stand it on a raised floor line.

## Cut-outs (macOS Vision)
- Vision drops furniture (the Syndics' table, Madame X's table, the parrot). Use `cutout.swift … box x y w h` to keep
  a box of the original, or accept the loss.
- Vision lifts one subject from a crowd painting. Crop single figures first; some lose heads or parasols: check each
  on a flat colour.
- Dark figures on dark grounds keep a faint halo; fine at video size, check at full size for close-ups.

## Downloads
- Wikimedia's image server answers 429 to non-standard thumbnail widths and to fast repeats. Ask for 1920 or 3840,
  wait 3–5 s between files, back off on 429. An interrupted download can leave a 0-byte file: check sizes.

## Sound
- A library ambience at a fixed volume vanished (-75 dB) and left the start and end silent. Set beds by mean, effects
  by peak.
- `tennis_bounce` at 0.5 gain was near clipping; always measure.

## Shell (zsh)
- `$c:r` in zsh is a filename modifier: write `${c}:refs/heads/main`.
- `[$n]` in an unquoted zsh string is a glob: build ffmpeg filter graphs in bash or Python.
- ffmpeg filter strings with `$2:gamma`-style text break in zsh: put them in a bash script.
