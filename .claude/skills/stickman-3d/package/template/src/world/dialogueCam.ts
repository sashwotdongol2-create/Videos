// CAMERAS FOR A PORTRAIT DIALOGUE (2026-11-24, from reviewing the first film: the pair was small and the lower 45 %
// of the frame was table and floor; singles showed a slice of the partner's face at the edge).
// The frame is 9:16, so WIDTH decides the distance: these builders take what must fit across the frame and where the
// heads sit vertically, and return the lens. Heads are head CENTRES (seated: at.y + height * 0.855).
//   twoShot(a, b)  : both heads across `fill` of the width, heads at `yFrac` of the height (0.55 = a little under the
//                    middle, leaving the top third for cards / marks and little dead table below)
//   single(h)      : one head `widthFrac` of the width (0.30-0.36; 0.40+ was too tight, user 2026-11-24), from `az` degrees round
// SINGLES ARE SOLO: draw only the subject in a single (no partner, none of the partner's marks). At a table two people
// sit ~0.8 m apart, so any lens that frames one head also catches a slice of the other: cheat it, as animation does.
import type { V3 } from "../engine/types";

export type DCam = { pos: V3; look: V3; fov: number };
const ASPECT = 9 / 16;
const viewH = (d: number, fov: number) => 2 * d * Math.tan((fov * Math.PI) / 360);

export const twoShot = (a: V3, b: V3, o: { headW?: number; fill?: number; yFrac?: number; fov?: number; dx?: number; camUp?: number } = {}): DCam => {
  const fov = o.fov ?? 34;
  const span = Math.abs(a[0] - b[0]) + (o.headW ?? 0.55);
  const d = span / (o.fill ?? 0.7) / (ASPECT * 2 * Math.tan((fov * Math.PI) / 360));
  const mid: V3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
  const lookY = mid[1] + ((o.yFrac ?? 0.55) - 0.5) * viewH(d, fov);
  return { pos: [mid[0] + (o.dx ?? 0), lookY + (o.camUp ?? 0.05), mid[2] + d], look: [mid[0], lookY, mid[2]], fov };
};

export const single = (h: V3, o: { headW?: number; widthFrac?: number; yFrac?: number; fov?: number; az?: number; camUp?: number } = {}): DCam => {
  const fov = o.fov ?? 34;
  const d = (o.headW ?? 0.55) / (o.widthFrac ?? 0.33) / (ASPECT * 2 * Math.tan((fov * Math.PI) / 360));
  const az = ((o.az ?? 0) * Math.PI) / 180;
  const lookY = h[1] + ((o.yFrac ?? 0.53) - 0.5) * viewH(d, fov);
  return { pos: [h[0] + Math.sin(az) * d, lookY + (o.camUp ?? 0.03), h[2] + Math.cos(az) * d], look: [h[0], lookY, h[2]], fov };
};
