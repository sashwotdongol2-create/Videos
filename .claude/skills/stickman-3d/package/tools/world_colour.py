"""World colour check (WORLD.md): mean saturation and grey share of a film or of look-dev stills.

usage: python -I world_colour.py <video|image> [...] [--fps 1]
Targets (measured on 10 RicksClips Shorts, mean SATAVG 29, range 21-42):
  film mean saturation >= 25, grey seconds (SATAVG < 15) <= 20 % (7 of the 10 RC videos pass both); a look-dev still >= 24 (night >= 22), never < 20.
Saturation only: hue (purple vs blue night, brown mush) is checked by eye.
Exit 0 always (a report, not a gate); lines starting with WORLD: are the misses.
"""
import re
import subprocess
import sys
from pathlib import Path

IMG = {".png", ".jpg", ".jpeg", ".webp", ".bmp"}


def sats(path: Path, fps: float):
    vf = "scale=270:-2,signalstats,metadata=print:file=-"
    if path.suffix.lower() not in IMG:
        vf = f"fps={fps}," + vf
    r = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-vf", vf, "-f", "null", "-"],
                       capture_output=True, text=True)
    return [float(m[1]) for m in re.finditer(r"lavfi\.signalstats\.SATAVG=([\d.]+)", r.stdout)]


def main(argv):
    fps = 1.0
    if "--fps" in argv:
        i = argv.index("--fps"); fps = float(argv[i + 1]); del argv[i:i + 2]
    if not argv:
        sys.exit(__doc__)
    for a in argv:
        p = Path(a)
        s = sats(p, fps)
        if not s:
            print(f"{p.name}: no frames read"); continue
        mean = sum(s) / len(s)
        if p.suffix.lower() in IMG:
            ok = mean >= 24
            print(f"{p.name}: saturation {mean:.1f} (target >= 24, night >= 22, RicksClips mean 29)")
            if mean < 20 or not ok:
                print(f"WORLD: {p.name} saturation {mean:.1f} - {'below the floor 20' if mean < 20 else 'under 24 (ok only for night >= 22)'}: "
                      "add accents, coloured sky, raise forSet sat (WORLD.md 1)")
            continue
        grey = [i for i, v in enumerate(s) if v < 15]
        share = 100 * len(grey) / len(s)
        print(f"{p.name}: mean saturation {mean:.1f} (target >= 25, RicksClips 21-42 mean 29), "
              f"grey seconds {share:.0f} % (target <= 20 %, RicksClips 0-34 %), {len(s)} samples at {fps:g} fps")
        if mean < 25:
            print(f"WORLD: mean saturation {mean:.1f} < 25 (WORLD.md 1-2)")
        if share > 20:
            runs, start = [], None
            for i in range(len(s) + 1):
                g = i < len(s) and s[i] < 15
                if g and start is None: start = i
                if not g and start is not None: runs.append((start, i - 1)); start = None
            where = ", ".join(f"{a / fps:.0f}-{(b + 1) / fps:.0f} s" for a, b in runs[:12])
            print(f"WORLD: grey {share:.0f} % > 20 % at {where} (white-outs are fine; anything else needs colour)")


if __name__ == "__main__":
    main(sys.argv[1:])
