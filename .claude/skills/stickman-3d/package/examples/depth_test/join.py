"""Join shot A (g 0-83) and B (g 74-149) with a 9-frame cross-dissolve (g 75-83) -> depth_test.mp4 (540x960, 30 fps)."""
import subprocess
from pathlib import Path
import numpy as np
from PIL import Image
D = Path(__file__).resolve().parent / "renders"
L = lambda g: g + 7                                       # Shot(99) local frame
def fr(sh, g): return np.asarray(Image.open(D / sh / f"f_{L(g):04d}.png").convert("RGB"), np.float32)
ff = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", "540x960", "-r", "30", "-i", "-",
                       "-c:v", "libx264", "-crf", "16", "-pix_fmt", "yuv420p", str(D.parent / "depth_test.mp4")], stdin=subprocess.PIPE)
for g in range(150):
    if g < 75: im = fr("A", g)
    elif g > 83: im = fr("B", g)
    else: k = (g - 74) / 10; im = (1 - k) * fr("A", g) + k * fr("B", g)
    ff.stdin.write(np.clip(im, 0, 255).astype(np.uint8).tobytes())
ff.stdin.close(); ff.wait(); print("depth_test.mp4")
