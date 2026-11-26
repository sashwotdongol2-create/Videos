// How a shot is ENTERED (src/edit.json "kinds": {"<shotId>": "dissolve" | "cut" | "push" | "whip" | "spin" | "vwhip" | "flip" | "through" | "dive" | "wipe"}; ids in "cuts" are
// hard cuts; default dissolve). Every transition is done on the two shots' DOM layers (CSS transform / filter /
// opacity), so it costs nothing in WebGL; every look is a pure function of u = frame position - boundary frame
// (fractional under motion blur sub-frames).
//
// Windows (frames around the boundary B = the incoming shot's first frame):
//   both shots are drawn only for u in [-pre, post); the outgoing shot is styled for u in [-outFrom, post),
//   the incoming one for u in [-pre, inTo). Measured with tools/analyze_pacing.py: push and whip give 0 hard cuts.
import { EDIT } from "./time";

export type Kind = "dissolve" | "cut" | "push" | "whip" | "spin" | "vwhip" | "flip" | "through" | "dive" | "wipe";
export const KINDS: Kind[] = ["dissolve", "cut", "push", "whip", "spin", "vwhip", "flip", "through", "dive", "wipe"];

/** look of one shot layer: opacity, scale (about the frame centre), x / y shift (px of the 1080x1920 frame), roll
 *  (deg, about the centre), ry (deg, a 3D swing about a vertical hinge at ox = 0 left edge .. 1 right edge), blur (px)
 *  and horizontal / vertical-only blur (px, an SVG filter) */
export type Look = { op: number; sx: number; sy: number; x: number; y: number; rot: number; ry: number; ox: number; blur: number; hblur: number; vblur: number; mask: number };
/** mask: < 1 = the layer is revealed left-to-right up to this fraction of the width (soft 15 % edge; foreground wipe) */
export const PLAIN: Look = { op: 1, sx: 1, sy: 1, x: 0, y: 0, rot: 0, ry: 0, ox: 0.5, blur: 0, hblur: 0, vblur: 0, mask: 1 };
export const mergeLook = (a: Look, b: Partial<Look>): Look => ({
  op: a.op * (b.op ?? 1),
  sx: a.sx * (b.sx ?? 1),
  sy: a.sy * (b.sy ?? 1),
  x: a.x + (b.x ?? 0),
  y: a.y + (b.y ?? 0),
  rot: a.rot + (b.rot ?? 0),
  ry: a.ry + (b.ry ?? 0),
  ox: b.ox ?? a.ox,
  blur: a.blur + (b.blur ?? 0),
  hblur: a.hblur + (b.hblur ?? 0),
  vblur: a.vblur + (b.vblur ?? 0),
  mask: Math.min(a.mask, b.mask ?? 1),
});

export type Trans = {
  pre: number;
  post: number;
  outFrom: number;
  inTo: number;
  out: (u: number, W: number) => Partial<Look>;
  in: (u: number, W: number) => Partial<Look>;
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

const NONE: Trans = { pre: 0, post: 0, outFrom: 0, inTo: 0, out: () => ({}), in: () => ({}) };

/** cross-dissolve centred on the boundary: the incoming shot sits on top and fades in over EDIT.xfade frames */
const dissolve = (xfade: number): Trans => {
  const half = xfade / 2;
  return { pre: half, post: half, outFrom: half, inTo: half, out: () => ({}), in: (u) => ({ op: clamp01((u + half) / xfade) }) };
};

// PUSH-THROUGH: the outgoing shot punches in (scale 1 -> 1.3, blur 0 -> 12 px, ease-in over 4 frames, still
// accelerating under the blend), a 3-frame blurred cross-blend centred on the boundary, then the incoming shot lands
// from 1.15 (ease-out over ~8 frames) while its blur clears in ~4.5 frames.
export const PUSH = { punchFrames: 4, punch: 0.3, punchBlur: 12, blend: 3, land: 0.15, landFrames: 9.5, landBlur: 10, clearFrames: 4.5 };
const push: Trans = (() => {
  const P = PUSH;
  const half = P.blend / 2;
  return {
    pre: half,
    post: half,
    outFrom: P.punchFrames,
    inTo: P.landFrames - half,
    out: (u) => {
      const k = (u + P.punchFrames) / P.punchFrames; // 0 at the start of the punch, 1 at the boundary
      const e = k <= 1 ? k * k : 1 + 2 * (k - 1); // ease-in, then keeps its speed through the blend
      return { sx: 1 + P.punch * e, sy: 1 + P.punch * e, blur: P.punchBlur * e };
    },
    in: (u) => {
      const m = clamp01((u + half) / P.landFrames);
      const s = 1 + P.land * (1 - m) ** 2;
      const c = 1 - clamp01((u + half) / P.clearFrames);
      return { op: clamp01((u + half) / P.blend), sx: s, sy: s, blur: P.landBlur * c * c };
    },
  };
})();

// WHIP PAN: a virtual pan of WHIP.deg degrees (converted to pixels at a reference vertical fov of 50 deg in the 9:16
// frame) over 4 frames each side of the boundary, accelerating out of the old shot and decelerating into the new one
// (peak speed at the boundary). Both shots slide left side by side, blurred horizontally in proportion to the speed.
// The pan is wider than the frame, so the layers are stretched horizontally just enough that no black gap ever opens
// between them or at the frame edges (the stretch hides inside the smear).
export const WHIP = { deg: 38, refVfov: 50, frames: 4, blurPerSpeed: 0.25 };
const whipPan = (u: number, W: number) => {
  const hfov = (2 * Math.atan(Math.tan((WHIP.refVfov * Math.PI) / 360) * (9 / 16)) * 180) / Math.PI;
  const D = (WHIP.deg / hfov) * W; // pan travel, px
  const a = Math.min(1, Math.abs(u) / WHIP.frames);
  const p = D * (0.5 + 0.5 * Math.sign(u) * (1 - (1 - a) ** 3)); // eased travel 0 .. D
  const v = 0.375 * D * (1 - a) ** 2 * (4 / WHIP.frames); // px per frame
  const hb = WHIP.blurPerSpeed * v;
  const m = 2 * hb; // overlap kept between blurred edges
  // one horizontal stretch for both layers: the smallest that keeps both outer edges past the frame and the seam
  // between the layers closed (or off-screen)
  const gap = Math.min((D + 2 * m) / W, 1 + (2 * (p + m)) / W, 1 + (2 * (D - p + m)) / W);
  const s = Math.max(1, gap, 1 - (2 * p) / W + (2 * m) / W, 1 + (2 * (p - D)) / W + (2 * m) / W);
  return { p, D, hb, s };
};
const whip: Trans = {
  pre: WHIP.frames,
  post: WHIP.frames,
  outFrom: WHIP.frames,
  inTo: WHIP.frames,
  out: (u, W) => {
    const w = whipPan(u, W);
    return { x: -w.p, sx: w.s, hblur: w.hb };
  },
  in: (u, W) => {
    const w = whipPan(u, W);
    return { x: w.D - w.p, sx: w.s, hblur: w.hb };
  },
};

// SPIN (Zack D. reference 0:06 "But he wasn't"): the outgoing shot spins away (roll 0 -> +SPIN.deg, punch-in, blur
// rising, ease-in over SPIN.frames), a 2-frame blend at the boundary, the incoming shot spins in from -SPIN.deg and
// settles with a small overshoot. The motion-blur sub-frames of `render` turn the roll into a true rotational smear.
export const SPIN = { deg: 75, frames: 6, punch: 0.35, blur: 16, blend: 2 };
const spin: Trans = (() => {
  const S = SPIN;
  const half = S.blend / 2;
  return {
    pre: half,
    post: half,
    outFrom: S.frames,
    inTo: S.frames,
    out: (u) => {
      const k = clamp01((u + S.frames) / S.frames);
      const e = k * k * k;
      return { rot: S.deg * e, sx: 1 + S.punch * e, sy: 1 + S.punch * e, blur: S.blur * e };
    },
    in: (u) => {
      const k = clamp01((u + half) / S.frames);
      const e = 1 - (1 - k) ** 3;
      const over = 6 * Math.sin(Math.PI * k) * k; // a few degrees past zero, then settle
      const z = 1 + S.punch * (1 - e);
      return { op: clamp01((u + half) / S.blend), rot: -S.deg * (1 - e) + over * (1 - k), sx: z, sy: z, blur: S.blur * (1 - k) ** 2 };
    },
  };
})();

// VERTICAL WHIP (reference 0:09 "Earlier"): a tilt; both shots slide UP side by side (the old one leaves through the
// top, the new one rises from below), smeared vertically in proportion to the speed. Same easing as the whip pan.
export const VWHIP = { frames: 4, blurPerSpeed: 0.22 };
const vwhipAt = (u: number, H: number) => {
  const a = Math.min(1, Math.abs(u) / VWHIP.frames);
  const p = H * (0.5 + 0.5 * Math.sign(u) * (1 - (1 - a) ** 3)); // 0 .. H
  const v = 0.375 * H * (1 - a) ** 2 * (4 / VWHIP.frames);
  return { p, vb: VWHIP.blurPerSpeed * v };
};
const vwhip: Trans = {
  pre: VWHIP.frames,
  post: VWHIP.frames,
  outFrom: VWHIP.frames,
  inTo: VWHIP.frames,
  out: (u, W) => {
    const H = (W * 16) / 9;
    const w = vwhipAt(u, H);
    return { y: -w.p, vblur: w.vb, sy: 1 + Math.min(0.08, (2 * w.vb) / H) };
  },
  in: (u, W) => {
    const H = (W * 16) / 9;
    const w = vwhipAt(u, H);
    return { y: H - w.p, vblur: w.vb, sy: 1 + Math.min(0.08, (2 * w.vb) / H) };
  },
};

// FLIP / DOOR SWING (reference 0:11 "and when"): the outgoing shot swings away on its left hinge into black
// (0 -> 90 deg, ease-in, FLIP.out frames), then the incoming shot swings in on its right hinge (-90 -> 0, ease-out,
// FLIP.in frames). Black shows between them for FLIP.gap frames, like the reference.
export const FLIP = { out: 4, in: 5, gap: 1 };
const flip: Trans = {
  pre: FLIP.out,
  post: FLIP.in + FLIP.gap,
  outFrom: FLIP.out,
  inTo: FLIP.in + FLIP.gap,
  out: (u) => {
    const k = clamp01((u + FLIP.out) / FLIP.out);
    return { ry: 89 * k * k, ox: 0, op: k >= 1 ? 0 : 1, blur: 3 * k };
  },
  in: (u) => {
    if (u < FLIP.gap) return { op: 0 };
    const k = clamp01((u - FLIP.gap) / FLIP.in);
    const e = 1 - (1 - k) ** 2;
    return { ry: -89 * (1 - e), ox: 1, blur: 3 * (1 - k) };
  },
};

// ---- CAMERA_STUDY.md transitions (8 frames, made while the camera keeps moving; pair with beatCam enter / exit)
const T8 = 8, H8 = 4;
/** THROUGH (zoom-through, 13 % of RicksClips changes): the outgoing shot keeps pushing (scale 1 -> 1.22, blur), a
 *  blended hand-over, the incoming lands from 1.12 while its blur clears */
const through: Trans = {
  pre: H8, post: H8, outFrom: H8, inTo: H8,
  out: (u) => { const k = clamp01((u + H8) / T8); return { sx: 1 + 0.22 * k * k, sy: 1 + 0.22 * k * k, blur: 9 * k }; },
  in: (u) => { const k = clamp01((u + H8) / T8); const s = 1 + 0.12 * (1 - k) ** 2; return { op: clamp01((u + H8) / 5), sx: s, sy: s, blur: 9 * (1 - k) }; },
};
/** DIVE (surface dive / crane): both layers slide up (the camera tilts down through the frame), vertical smear */
const dive: Trans = {
  pre: H8, post: H8, outFrom: H8, inTo: H8,
  out: (u) => { const k = clamp01((u + H8) / T8); return { y: -1920 * 0.55 * k * k, vblur: 26 * Math.sin(Math.PI * k) }; },
  in: (u) => { const k = clamp01((u + H8) / T8); const r = 1 - k; return { y: 1920 * 0.45 * r * r, vblur: 26 * Math.sin(Math.PI * k), op: clamp01((u + H8) / 3) }; },
};
/** WIPE (foreground wipe): the incoming shot is revealed left-to-right behind a soft edge while both layers slide
 *  (the camera tracks behind a set object; give the edge a real occluder in the shot when one is near, kit/FgWipe.tsx) */
const wipe: Trans = {
  pre: H8, post: H8, outFrom: H8, inTo: H8,
  // the slide (<= 60 px of 1080) stays inside the 12 % overscale, so no black edge ever opens
  out: (u) => { const k = clamp01((u + H8) / T8); return { x: -60 * k, sx: 1.12, sy: 1.12, hblur: 10 * Math.sin(Math.PI * k) }; },
  in: (u) => { const k = clamp01((u + H8) / T8); const s = 1 + 0.12 * (1 - k); return { x: 60 * (1 - k), sx: s, sy: s, hblur: 10 * Math.sin(Math.PI * k), mask: -0.15 + 1.3 * k }; },
};
const BY_KIND: Record<Exclude<Kind, "dissolve" | "cut">, Trans> = { push, whip, spin, vwhip, flip, through, dive, wipe };
/** any transition by kind (dissolve uses xfade frames) */
export const transOf = (k: Kind, xfade = T8): Trans => (k === "cut" ? NONE : k === "dissolve" ? dissolve(xfade) : BY_KIND[k]);

export const kindOf = (id: number): Kind =>
  EDIT.cuts.includes(id) ? "cut" : ((EDIT.kinds?.[String(id)] ?? "dissolve") as Kind);

/** the transition that enters shot `id` (null = the film's first shot) */
export const transIn = (id: number | null): Trans => {
  if (id === null) return NONE;
  const k = kindOf(id);
  if (!KINDS.includes(k)) throw new Error(`edit.json kinds: shot ${id} has unknown kind "${k}" (${KINDS.join(" | ")})`);
  return transOf(k, EDIT.xfade);
};
