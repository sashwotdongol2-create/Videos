# Frame-to-frame motion of regions in a clip (phase correlation), to measure camera shake.
# python -I shake.py video start dur
import sys, subprocess, numpy as np
src, t0, dur = sys.argv[1], sys.argv[2], sys.argv[3]
W, H = 540, 960
raw = subprocess.run(['ffmpeg', '-v', 'error', '-ss', t0, '-t', dur, '-i', src, '-vf', f'fps=30,scale={W}:{H},format=gray', '-f', 'rawvideo', '-'], capture_output=True).stdout
F = np.frombuffer(raw, np.uint8).reshape(-1, H, W).astype(np.float32)
def shift(a, b):
    A = np.fft.fft2(a - a.mean()); B = np.fft.fft2(b - b.mean()); R = A * np.conj(B); R /= np.abs(R) + 1e-6
    r = np.fft.ifft2(R).real; y, x = np.unravel_index(np.argmax(r), r.shape)
    # sub-pixel parabola
    def sub(v, i, n):
        l, c, rr = v[(i - 1) % n], v[i], v[(i + 1) % n]; d = (l - rr) / (2 * (l - 2 * c + rr) + 1e-9); return i + d
    xs = sub(r[y, :], x, r.shape[1]); ys = sub(r[:, x], y, r.shape[0])
    if xs > r.shape[1] / 2: xs -= r.shape[1]
    if ys > r.shape[0] / 2: ys -= r.shape[0]
    return xs, ys
regions = {'interior': (100, 640, 440, 900), 'far_road': (150, 360, 390, 520), 'windshield_top': (60, 80, 480, 300)}
for name, (x0, y0, x1, y1) in regions.items():
    d = np.array([shift(F[i + 1][y0:y1, x0:x1], F[i][y0:y1, x0:x1]) for i in range(len(F) - 1)])
    print(f'{name:15s} frames {len(F)}  dx mean {d[:,0].mean():+.2f} sd {d[:,0].std():.2f} max {np.abs(d[:,0]).max():.2f} | dy mean {d[:,1].mean():+.2f} sd {d[:,1].std():.2f} max {np.abs(d[:,1]).max():.2f}  (px at 540 wide)')
    print('   dy series', ' '.join(f'{v:+.1f}' for v in d[:40, 1]))
