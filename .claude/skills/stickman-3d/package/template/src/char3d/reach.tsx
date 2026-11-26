// Hands on things in the world (RULES.md -> props): grip points on props, a two-bone arm solver, eased reach / grab /
// lift / release, and world props that stay in the scene (drawer, button, cup on a table, a two-hand mop).
//   - Grip points live in PropSpec.grips (props.ts), in the prop's normalised frame (metres; see needProp).
//   - <Stickman grab={[...]}/>: each Grab puts one hand on a target from `at` (the contact moment) to `until`. The hand
//     reaches in over `reach` seconds (default: >= 0.4 s and slow enough that the arm turns <= REACH.maxSpeed rad/s),
//     eased (quintic), and lets go the same way. solveArm keeps the arm's drawn lengths: an out-of-reach target leaves
//     the hand short and logs `REACH:` (err > REACH.maxErr m): move the character or the prop, never stretch the arm.
//   - <WorldProp/> draws a prop at a PropPose; gripAt() gives a grip point's world position for that pose.
//   - Two-hand tools in the world (mop, broom, shovel): twoHandTargets() -> grab both hands -> jointsAt() ->
//     toolFromHands(): the tool's angle comes from where the two hands actually are.
//   - Picking something up: the prop stays at its rest pose until the hand arrives, then follow() moves it with the
//     hand (lift with liftPath(): eased, >= 0.4 s).
import React from "react";
import * as THREE from "three";
import type { V3 } from "../engine/types";
import { ShotCtx } from "../world/registry";
import { getProp } from "./props";

export const REACH = {
  minTime: 0.4, // s: no reach, lift or release is faster than this
  maxSpeed: 4, // rad/s: the upper arm (shoulder -> hand direction) never turns faster than this during a grab
  maxErr: 0.03, // m: hand left short of its target by more than this = REACH: line (move the character or the prop)
};

export type Target = V3 | ((t: number) => V3);
export type Hand = "right" | "left";
/** one hand on a target: contact at `at` (shot s), held until `until` (default: to the end of the shot). `reach` /
 *  `release` = seconds in / out (default auto: >= REACH.minTime and within REACH.maxSpeed). */
export type Grab = { hand: Hand; target: Target; at: number; until?: number; reach?: number; release?: number };

export const targetAt = (g: { target: Target }, t: number): THREE.Vector3 =>
  new THREE.Vector3(...(typeof g.target === "function" ? g.target(t) : g.target));

/** quintic ease 0..1 (zero speed and acceleration at both ends); peak speed 1.875 x the average */
export const smoother = (u: number) => {
  const x = THREE.MathUtils.clamp(u, 0, 1);
  return x * x * x * (x * (6 * x - 15) + 10);
};
const PEAK = 1.875;
/** seconds a move of `angle` radians needs under the quintic ease to stay within REACH.maxSpeed (and >= minTime) */
export const timeFor = (angle: number) => Math.max(REACH.minTime, (1.25 * PEAK * angle) / REACH.maxSpeed); // 25 % margin: the body and the clip move too

/** two-bone arm: shoulder S, elbow hint E (bend side), target T, upper / lower lengths. The arm never stretches: an
 *  unreachable target leaves the hand on the line to it at full reach and err = how far it is short (m). */
export const solveArm = (S: THREE.Vector3, E: THREE.Vector3, T: THREE.Vector3, up: number, lo: number) => {
  const d = T.clone().sub(S);
  const dist = d.length();
  const max = (up + lo) * 0.999;
  const min = Math.abs(up - lo) + 1e-4;
  const D = THREE.MathUtils.clamp(dist, min, max);
  const err = dist > max ? dist - max : dist < min ? min - dist : 0;
  const dir = dist > 1e-6 ? d.divideScalar(dist) : new THREE.Vector3(0, -1, 0);
  const a = (up * up + D * D - lo * lo) / (2 * D);
  const h = Math.sqrt(Math.max(0, up * up - a * a));
  let bend = E.clone().sub(S);
  bend.addScaledVector(dir, -bend.dot(dir));
  if (bend.lengthSq() < 1e-8) {
    bend = new THREE.Vector3(0, -1, 0).addScaledVector(dir, dir.y);
    if (bend.lengthSq() < 1e-8) bend.set(1, 0, 0);
  }
  bend.normalize();
  return { E: S.clone().addScaledVector(dir, a).addScaledVector(bend, h), H: S.clone().addScaledVector(dir, D), err };
};

/** the angle (rad) between the directions shoulder -> a and shoulder -> b */
export const armAngle = (S: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3) =>
  a.clone().sub(S).angleTo(b.clone().sub(S));

/** grab weight at t (0 = the clip's own hand, 1 = on the target), given the resolved reach / release times */
export const grabWeight = (g: Grab, t: number, reach: number, release: number) => {
  if (t < g.at - reach) return 0;
  if (t < g.at) return smoother((t - (g.at - reach)) / reach);
  const u = g.until ?? Infinity;
  if (t <= u) return 1;
  return 1 - smoother((t - u) / release);
};

// ------------------------------------------------------------------ world props
/** where a prop sits: position of its origin (the normalised frame's origin: the working end / base) and rotation */
export type PropPose = { pos: V3; quat?: THREE.Quaternion; yaw?: number };
const quatOf = (p: PropPose) => p.quat ?? new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.yaw ?? 0);

/** world position of grip `name` (PROPS[id].grips) on a prop at `pose` */
export const gripAt = (id: string, pose: PropPose, name: string): V3 => {
  const g = getProp(id).spec.grips?.[name];
  if (!g) throw new Error(`prop "${id}" has no grip "${name}" (props.ts PROPS.${id}.grips)`);
  const w = new THREE.Vector3(...g).applyQuaternion(quatOf(pose)).add(new THREE.Vector3(...pose.pos));
  return [w.x, w.y, w.z];
};

/** the pose that puts grip `name` of a prop (rest orientation kept) on `hand`: a picked-up prop follows the hand */
export const follow = (id: string, rest: PropPose, name: string, hand: V3 | THREE.Vector3): PropPose => {
  const g = new THREE.Vector3(...gripAt(id, rest, name));
  const h = hand instanceof THREE.Vector3 ? hand : new THREE.Vector3(...hand);
  const p = new THREE.Vector3(...rest.pos).add(h.clone().sub(g));
  return { ...rest, pos: [p.x, p.y, p.z] };
};

/** eased path between way points [[t, V3], ...] (each leg quintic, legs shorter than REACH.minTime are stretched in
 *  QA only: keep them >= 0.4 s). Use it as a grab target: reach -> grab -> lift. */
export const liftPath = (pts: [number, V3][]) => (t: number): V3 => {
  if (t <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    const [t1, b] = pts[i];
    const [t0, a] = pts[i - 1];
    if (t <= t1) {
      const w = smoother((t - t0) / Math.max(1e-3, t1 - t0));
      return [a[0] + (b[0] - a[0]) * w, a[1] + (b[1] - a[1]) * w, a[2] + (b[2] - a[2]) * w];
    }
  }
  return pts[pts.length - 1][1];
};

/** a long tool whose working end W sits in the world and whose shaft points along `dir`: the two hand targets on its
 *  shaft, the low one at grips.lo (or 0.55 L) and the high one `gap` x the holder's height above it (default 0.25 h) */
export const twoHandTargets = (id: string, W: V3, dir: V3, height: number, gap = 0.25): { lo: V3; hi: V3 } => {
  const { spec } = getProp(id);
  const y = new THREE.Vector3(...dir).normalize();
  const loF = spec.grips?.lo ? spec.grips.lo[1] : 0.55 * spec.length;
  const lo = new THREE.Vector3(...W).addScaledVector(y, loF);
  const hi = lo.clone().addScaledVector(y, Math.min(gap * height, spec.length - loF - 0.02));
  return { lo: [lo.x, lo.y, lo.z], hi: [hi.x, hi.y, hi.z] };
};

/** the tool's pose from where the two hands really are (after solveArm): angle = the line from the low to the high
 *  hand, the low hand at its grip; `face` = a horizontal direction the tool's front (+z) turns toward */
export const toolFromHands = (id: string, lo: THREE.Vector3, hi: THREE.Vector3, face: V3 = [0, 0, 1]): PropPose => {
  const { spec } = getProp(id);
  const y = hi.clone().sub(lo).normalize();
  const loF = spec.grips?.lo ? spec.grips.lo[1] : 0.55 * spec.length;
  const W = lo.clone().addScaledVector(y, -loF);
  let z = new THREE.Vector3(...face);
  z.addScaledVector(y, -z.dot(y));
  if (z.lengthSq() < 1e-6) z = new THREE.Vector3(1, 0, 0).cross(y);
  z.normalize();
  const x = new THREE.Vector3().crossVectors(y, z).normalize();
  return { pos: [W.x, W.y, W.z], quat: new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z)) };
};

const worldClones = new Map<string, THREE.Object3D>();
/** a prop that stays in the world (one clone per prop, shot and `name`) */
export const WorldProp: React.FC<{ id: string; pose: PropPose; name?: string }> = ({ id, pose, name = "" }) => {
  const shot = React.useContext(ShotCtx);
  const key = `${id}|${name}|${shot}`;
  let obj = worldClones.get(key);
  if (!obj) {
    obj = getProp(id).obj.clone(true);
    worldClones.set(key, obj);
    while (worldClones.size > 64) worldClones.delete(worldClones.keys().next().value as string);
  }
  return (
    <group position={pose.pos} quaternion={quatOf(pose)}>
      <primitive object={obj} />
    </group>
  );
};
