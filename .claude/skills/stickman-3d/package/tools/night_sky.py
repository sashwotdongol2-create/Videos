"""Bake the Poly Haven night HDRI (CC0) into the files the film uses.
  public/env/night_sky.jpg   8192 x 2276 equirect, elevation +90 .. -10 deg (upper hemisphere + 10 deg), sRGB,
                             value = (radiance / NORM) ** (1/2.2); the ground below the skyline is replaced by the
                             sky just above it (the sets bring their own ground), so it is a pure sky.
  public/env/night_1k.hdr    1024 x 512 linear HDR (same ground fill, lower hemisphere dark) for Blender bakes / IBL.
Usage: python -I tools/night_sky.py blender/assets_src/hdri/rogland_moonlit_night_8k.hdr
Source: https://polyhaven.com/a/rogland_moonlit_night (Greg Zaal, CC0)."""
import sys, os
import numpy as np
import cv2

NORM = 1.6          # radiance mapped to white in the jpg (sky 0.15-0.9, clouds near the moon ~1.4)
TOP, BOT = 90.0, -10.0

src = sys.argv[1]
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "env")
a = cv2.imread(src, cv2.IMREAD_ANYDEPTH | cv2.IMREAD_COLOR)[..., ::-1].astype(np.float32)  # RGB linear
H, W = a.shape[:2]
L = a @ np.array([0.2126, 0.7152, 0.0722], np.float32)
row = lambda el: int(round((90.0 - el) / 180.0 * H))

# skyline per column: the sky is blue (B/R > 1.2), the moonlit desert ground warm (B/R < 0.8). On a 2048 copy, scan
# down from 25 deg: the first row that is warm and stays warm (85 % of the rows down to -2 deg) is the skyline. The
# ground below is replaced by the sky band just above the skyline, blurred sideways (no streaks), darkening a little.
y25 = row(25.0)
sm = cv2.GaussianBlur(cv2.resize(a, (2048, 1024), interpolation=cv2.INTER_AREA), (0, 0), 2)
ratio = sm[..., 2] / (sm[..., 0] + 1e-4)
lsm = sm @ np.array([0.2126, 0.7152, 0.0722], np.float32)
skymed = np.array([np.median(lsm[y][ratio[y] > 1.3]) if (ratio[y] > 1.3).sum() > 50 else lsm[y].max() for y in range(1024)])
ground = (ratio < 1.05) | (lsm < 0.5 * skymed[:, None])       # warm sand, or dark sky-lit (bluish) rock faces
rs = lambda el: int(round((90.0 - el) / 180.0 * 1024))
line = np.full(2048, rs(-2.0), np.float32)
for x in range(2048):
    col = ground[rs(25.0):rs(-2.0), x]
    for i in np.where(col)[0]:
        if col[i:].mean() > 0.85:
            line[x] = rs(25.0) + i
            break
line = np.minimum.reduce([np.roll(line, k) for k in range(-8, 9)])       # take the highest ground nearby (rocks)
line = cv2.GaussianBlur(line[None, :], (0, 0), 2)[0]
sky_line = (np.interp(np.arange(W) / W * 2048, np.arange(2048), line) * H / 1024).astype(np.int32) - 22
band = np.zeros((W, 3), np.float32)
for x in range(W):
    s = sky_line[x]
    band[x] = np.median(a[s - 60:s - 10, x], axis=0)
band = np.clip(band, 0, 2.0)
band = cv2.GaussianBlur(band[None], (0, 0), 60)[0]
fill = a.copy()
for x in range(W):
    s = sky_line[x]; n = H - s
    fill[s:, x] = band[x] * np.linspace(0.92, 0.45, n)[:, None]
m = np.zeros((H, W), np.float32)
for x in range(W): m[sky_line[x]:, x] = 1.0
m = cv2.GaussianBlur(m, (0, 0), 10)[..., None]
sky = a * (1 - m) + fill * m

r0, r1 = row(TOP), row(BOT)
crop = sky[r0:r1]
ldr = np.clip(crop / NORM, 0, 1) ** (1 / 2.2)
cv2.imwrite(os.path.join(out, "night_sky.jpg"), (ldr[..., ::-1] * 255 + 0.5).astype(np.uint8), [cv2.IMWRITE_JPEG_QUALITY, 92])
small = cv2.resize(sky, (1024, 512), interpolation=cv2.INTER_AREA)
small[256:] *= 0.15                                         # dark ground for the light probe / bakes
cv2.imwrite(os.path.join(out, "night_1k.hdr"), small[..., ::-1].copy())
# moon direction (three equirect: u = atan(z, x) / 2pi + 0.5, v = elevation)
yb, xb = np.unravel_index(np.argmax(L), L.shape)
el = 90.0 - (yb + 0.5) / H * 180.0
az = ((xb + 0.5) / W - 0.5) * 2 * np.pi
print(f"moon el {el:.1f} deg, u {((xb + .5) / W):.4f}, az(rad, three u) {az:.3f}; skyline median el {90 - np.median(sky_line) / H * 180:.1f}")
print("wrote", os.path.abspath(out))
