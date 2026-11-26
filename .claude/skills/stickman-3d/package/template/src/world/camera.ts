// Camera helpers in three.js coordinates (Y up), ported from the Blender toolkit (push / glide / spike / arc) plus the
// inkbeat beat rig. Every function is a pure function of time. Rules (LOOK.md -> Depth): move THROUGH space (arcs,
// cranes), never a long straight dolly; ~0.128 log-zoom/s default push; spikes 0.3 s on key words.
import type { Cam } from "../engine/core/View";
import type { V3 } from "../engine/types";
export { aim, poseAt, withShake } from "../engine/core/rig";
export type { Beat } from "../engine/core/rig";

const ease5 = (u: number) => {
  const x = Math.min(1, Math.max(0, u));
  return x * x * x * (x * (6 * x - 15) + 10);
};
const lerp3 = (a: V3, b: V3, k: number): V3 => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
export type Lens = [pos: V3, look: V3];

/** the channel's constant dolly-in toward `look` (rate in log-zoom per second) */
export const push = (pos: V3, look: V3, t: number, t0: number, rate = 0.128): Lens => {
  const k = Math.exp(-rate * Math.max(0, t - t0));
  return [lerp3(look, pos, k), look];
};
/** quintic glide between two lenses over [t0, t1] */
export const glide = (a: Lens, b: Lens, t: number, t0: number, t1: number): Lens => {
  const k = ease5((t - t0) / Math.max(1e-3, t1 - t0));
  return [lerp3(a[0], b[0], k), lerp3(a[1], b[1], k)];
};
/** a quick push (k > 0) or pull (k < 0) centred on tc, `dur` seconds long */
export const spike = (l: Lens, t: number, tc: number, k: number, dur = 0.3): Lens => {
  const s = Math.exp(-k * ease5((t - (tc - dur / 2)) / dur));
  return [lerp3(l[1], l[0], s), l[1]];
};
/** orbit `deg` degrees around `look` while closing in by `close` (0.2-0.35), over [t0, t1]: the depth-standard move */
export const arc = (pos: V3, look: V3, t: number, t0: number, t1: number, deg = 40, close = 0.25): Lens => {
  const k = ease5((t - t0) / Math.max(1e-3, t1 - t0));
  const dx = pos[0] - look[0];
  const dz = pos[2] - look[2];
  const a = (deg * Math.PI * k) / 180;
  const s = 1 - close * k;
  return [[look[0] + (dx * Math.cos(a) - dz * Math.sin(a)) * s, pos[1] + (look[1] - pos[1]) * close * k * 0.5, look[2] + (dx * Math.sin(a) + dz * Math.cos(a)) * s], look];
};
export const lens = (l: Lens, fov = 40, roll = 0): Cam => ({ pos: l[0], look: l[1], fov, roll });

// ------------------------------------------------------------------ QA: the lens never inside or behind geometry
import * as THREE from "three";
import type { LoadedSet } from "./set";
const qaRay = new THREE.Raycaster();
/** true when nothing of the set sits between the lens and `subject` (call it on every frame of a move, not only the
 *  keys; a wall between them means the camera went through it). Logs the first blocker. */
export const lensClear = (set: LoadedSet, cam: Cam, subject: V3, label = ""): boolean => {
  const o = new THREE.Vector3(...cam.pos);
  const d = new THREE.Vector3(...subject).sub(o);
  const L = d.length();
  qaRay.set(o, d.normalize());
  qaRay.near = 0.05;
  qaRay.far = Math.max(0.1, L - 0.3);
  const hit = qaRay.intersectObjects(set.ground, false)[0];
  // console.error: the CLI shows browser errors and greps "LENS BLOCKED" (warn is hidden at --log=error)
  if (hit) console.error(`LENS BLOCKED ${label}: ${hit.object.name} at ${hit.distance.toFixed(2)} m of ${L.toFixed(2)} m`);
  return !hit;
};

/** CAMERA_STUDY §4.6 QA: nothing of the WHOLE set (props, trees, lamps: not only the ground) between the lens and a
 *  face, unless a planned foreground wipe is running. Raycasts are heavy on big sets, so it samples every `every`th
 *  frame. Logs "FACE BLOCKED" (the still / render CLI greps console errors). */
const faceRay = new THREE.Raycaster();
export const faceClear = (scene: THREE.Object3D, cam: Cam, heads: V3[], frame: number, label = "", every = 6): boolean => {
  if (frame % every !== 0) return true;
  let ok = true;
  const o = new THREE.Vector3(...cam.pos);
  for (const h of heads) {
    const d = new THREE.Vector3(...h).sub(o); const L = d.length();
    faceRay.set(o, d.normalize()); faceRay.near = 0.05; faceRay.far = Math.max(0.1, L - 0.35);
    const hit = faceRay.intersectObject(scene, true)[0];
    if (hit) { ok = false; console.error(`FACE BLOCKED ${label}: ${hit.object.name} at ${hit.distance.toFixed(2)} m of ${L.toFixed(2)} m`); }
  }
  return ok;
};

// ------------------------------------------------------------------ depth of field: a filmic preset per framing
/** the post DOF's circle of confusion (px at 1080 wide) of a point at distance z when focused at f with max blur
 *  `blur` (engine/post/shaders.ts ink pass: thin lens |1 - f/z| normalised so focus + 2.2 f = full blur, 6 % dead zone,
 *  foreground up to 1.6 x) */
export const cocPx = (f: number, z: number, blur: number) => {
  const norm = 1 - f / (f + 2.2 * f);
  const c = (1 - f / Math.max(z, 1e-3)) / norm;
  const s = (Math.sign(c) * Math.max(Math.abs(c) - 0.06, 0)) / 0.94;
  return Math.max(-1.6, Math.min(1, s)) * blur;
};
/** max blur px at 1080 wide per framing: background clearly soft in close-ups and mediums, mild in wides */
export const DOF_PX = { ecu: 12, cu: 10, mcu: 8, ms: 6, mws: 4, wide: 2.5, xwide: 1.2 } as const;
export type DofSize = keyof typeof DOF_PX;
/**
 * Filmic depth of field for <View focus blur>: `<View {...dof(cam, heroHead, "mcu")} ... />`.
 * subject: one point (the hero's head) or several (two heroes, a tag that must stay readable): focus goes to the
 * nearest-to-average depth and the blur is lowered until EVERY listed point stays sharp (|CoC| <= `sharpPx`, default
 * 1 px at 1080; each point +-0.15 m of depth), so the hero is always sharp. Everything else blurs by depth (background up to DOF_PX[size] px,
 * foreground up to 1.6x that: an over-the-shoulder shoulder or a gun arm toward the lens goes soft, as in a film).
 * Tags are 3D plates: list their positions in `subject` or keep them at the hero's depth. Captions are an overlay
 * (Final) and never blur.
 */
export const dof = (cam: { pos: V3 }, subject: V3 | V3[], size: DofSize = "ms", sharpPx = 1): { focus: V3; blur: number } => {
  const pts = (Array.isArray(subject[0]) ? subject : [subject]) as V3[];
  const d = (q: V3) => Math.hypot(q[0] - cam.pos[0], q[1] - cam.pos[1], q[2] - cam.pos[2]);
  const ds = pts.map(d);
  // focus distance between the nearest and farthest subject: thin-lens harmonic mean keeps both ends equally soft
  const lo = Math.min(...ds), hi = Math.max(...ds);
  const f = (2 * lo * hi) / (lo + hi);
  // the focus point: on the ray to the subject nearest that distance, at distance f
  const k = ds.reduce((b, x, i) => (Math.abs(x - f) < Math.abs(ds[b] - f) ? i : b), 0);
  const q = pts[k], dq = ds[k] || 1;
  const focus: V3 = [cam.pos[0] + ((q[0] - cam.pos[0]) * f) / dq, cam.pos[1] + ((q[1] - cam.pos[1]) * f) / dq, cam.pos[2] + ((q[2] - cam.pos[2]) * f) / dq];
  let blur: number = DOF_PX[size];
  // the hero (every listed point, +-0.15 m: the flat layers are thin) stays sharp
  for (const x of ds) for (const z of [x - 0.15, x + 0.15]) {
    const c = Math.abs(cocPx(f, z, 1));
    if (c * blur > sharpPx) blur = sharpPx / c;
  }
  return { focus, blur };
};
