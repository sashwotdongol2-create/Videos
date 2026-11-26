// Numeric staging checks for one shot ("numbers before eyes"), adapted from blocky-shorts v1.2 planet_check.ts (MIT,
// engine/THIRD_PARTY_NOTICES.md). Put <StageQA/> LAST inside the shot's <View>, after every <Stickman/>: each frame it
// reads the joints every Stickman registered for THIS shot and THIS frame (world/registry.ts) and logs, as console
// errors that `still` / `grips` / `render` collect (QA tag "STAGE "):
//   STAGE LENS_IN  - the lens inside a character (or, with `set`, inside the set's geometry)
//   STAGE BLOCKED  - another character between the lens and the subject (the set is lensClear's job, world/camera.ts)
//   STAGE OVERLAP  - two characters pass through each other (stick limbs, torso, head, held prop); `allow` pairs that
//                    really touch (a hug, a handshake, a fight)
//   STAGE INSIDE   - with `set`: a head, neck, hip, hand or knee inside set geometry (a body in a wall, a desk, a bed)
//   STAGE FRAMING  - a `keep` character's head (or hips) leaves the 1080x1920 frame (2 % margin)
// There is no FACING check: the head and torso are flat layers that always turn to the lens, so the face always shows.
//   <StageQA cam={cam} subject={look} who="hero" keep={["hero", "partner"]} set={set} label="s03" />
import React from "react";
import * as THREE from "three";
import { useCurrentFrame } from "remotion";
import { CAST } from "../char/cast";
import { ART_REF } from "../char/drawCharacter";
import { STYLE } from "../char3d/Stickman";
import type { Cam } from "../engine/core/View";
import type { V3 } from "../engine/types";
import { SHOT_JOINTS, ShotCtx } from "./registry";
import type { Joints } from "./registry";
import type { LoadedSet } from "./set";

type Part = { n: string; a: THREE.Vector3; b: THREE.Vector3; r: number };
const v = (p: [number, number, number]) => new THREE.Vector3(p[0], p[1], p[2]);

/** the body of one drawn character as capsules (metres), from its registered joints */
export const partsOf = (who: string, J: Joints): Part[] => {
  const H = CAST[who]?.height ?? 1.7;
  const headW = STYLE.headFrac * H * STYLE.headRatio;
  const u = headW / ART_REF.HW;
  const limb = (ART_REF.LIMB / 2) * u;
  const P: Part[] = [];
  const add = (n: string, a: string, b: string, r: number) => {
    if (J[a] && J[b]) P.push({ n, a: v(J[a]), b: v(J[b]), r });
  };
  if (J.Head) P.push({ n: "head", a: v(J.Head), b: v(J.Head), r: 0.42 * headW });
  add("torso", "Neck", "Hips", 0.8 * (ART_REF.TORSO_W / 2) * u);
  for (const sd of ["Left", "Right"]) {
    const s = sd === "Left" ? "left" : "right";
    add(`${s} upper arm`, sd + "Arm", sd + "ForeArm", limb);
    add(`${s} forearm`, sd + "ForeArm", sd + "HandMiddle1", limb);
    add(`${s} hand`, sd + "HandMiddle1", sd + "HandMiddle1", ART_REF.HAND_R * u);
    add(`${s} thigh`, sd + "UpLeg", sd + "Leg", limb);
    add(`${s} shin`, sd + "Leg", sd + "Foot", limb);
  }
  add("held prop", "PropEnd", "PropTop", 0.02);
  return P;
};

const ptSeg = (p: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3) => {
  const ab = b.clone().sub(a);
  const L2 = ab.lengthSq();
  const k = L2 < 1e-12 ? 0 : THREE.MathUtils.clamp(p.clone().sub(a).dot(ab) / L2, 0, 1);
  return p.distanceTo(a.clone().addScaledVector(ab, k));
};
/** closest distance between segments p1-q1 and p2-q2 (Ericson, Real-Time Collision Detection 5.1.9) */
const segSeg = (p1: THREE.Vector3, q1: THREE.Vector3, p2: THREE.Vector3, q2: THREE.Vector3) => {
  const d1 = q1.clone().sub(p1);
  const d2 = q2.clone().sub(p2);
  const r = p1.clone().sub(p2);
  const a = d1.dot(d1);
  const e = d2.dot(d2);
  const f = d2.dot(r);
  let s: number;
  let t: number;
  if (a <= 1e-12 && e <= 1e-12) return p1.distanceTo(p2);
  if (a <= 1e-12) {
    s = 0;
    t = THREE.MathUtils.clamp(f / e, 0, 1);
  } else {
    const c = d1.dot(r);
    if (e <= 1e-12) {
      t = 0;
      s = THREE.MathUtils.clamp(-c / a, 0, 1);
    } else {
      const b = d1.dot(d2);
      const den = a * e - b * b;
      s = den > 1e-12 ? THREE.MathUtils.clamp((b * f - c * e) / den, 0, 1) : 0;
      t = (b * s + f) / e;
      if (t < 0) {
        t = 0;
        s = THREE.MathUtils.clamp(-c / a, 0, 1);
      } else if (t > 1) {
        t = 1;
        s = THREE.MathUtils.clamp((b - c) / a, 0, 1);
      }
    }
  }
  return p1.clone().addScaledVector(d1, s).distanceTo(p2.clone().addScaledVector(d2, t));
};

const ray = new THREE.Raycaster();
const DIRS = [new THREE.Vector3(0, 1, 0), new THREE.Vector3(0.6, 0.05, 0.8).normalize()];
/** true when p is inside closed set geometry: two rays both leave through a back face first */
export const insideSet = (set: LoadedSet, p: THREE.Vector3): string | null => {
  const keep = set.ground.map((m) => {
    const mat = m.material as THREE.Material;
    const side = mat.side;
    mat.side = THREE.DoubleSide;
    return [mat, side] as const;
  });
  let name: string | null = null;
  try {
    let all = true;
    for (const d of DIRS) {
      ray.set(p, d);
      ray.near = 0;
      ray.far = 60;
      const h = ray.intersectObjects(set.ground, false)[0];
      if (!h || !h.face) {
        all = false;
        break;
      }
      const n = h.face.normal.clone().transformDirection(h.object.matrixWorld);
      if (n.dot(d) <= 0) {
        all = false;
        break;
      }
      name = h.object.name;
    }
    if (!all) name = null;
  } finally {
    for (const [mat, side] of keep) mat.side = side;
  }
  return name;
};

export type StageQAProps = {
  cam: Cam;
  /** the point the shot is about (usually the lens's look point or a face) */
  subject?: V3;
  /** whose body the subject is (exempt from BLOCKED) */
  who?: string;
  /** characters whose head and hips must stay in frame */
  keep?: string[];
  /** pairs allowed to touch */
  allow?: [string, string][];
  /** the shot's set: adds LENS_IN for the set and the INSIDE check */
  set?: LoadedSet;
  label?: string;
  /** check every Nth frame (default 1; the set checks cost a few ray casts per character) */
  every?: number;
  width?: number;
  height?: number;
};

export const StageQA: React.FC<StageQAProps> = (p) => {
  const shot = React.useContext(ShotCtx);
  const frame = useCurrentFrame();
  React.useLayoutEffect(() => {
    if (frame % (p.every ?? 1)) return;
    const where = `${p.label ?? `shot ${shot}`} f${frame}`;
    const err = (kind: string, msg: string) => console.error(`STAGE ${kind} ${where}: ${msg}`);
    const chars: { who: string; P: Part[]; J: Joints }[] = [];
    for (const [k, e] of SHOT_JOINTS) {
      const [who, s] = k.split("#");
      if (Number(s) === shot && e.frame === frame) chars.push({ who, P: partsOf(who, e.J), J: e.J });
    }
    const cam = v(p.cam.pos);
    // LENS_IN
    for (const c of chars)
      for (const q of c.P) {
        const d = ptSeg(cam, q.a, q.b) - q.r;
        if (d < 0.05) err("LENS_IN", `the lens is ${d < 0 ? "inside" : `${(d * 100).toFixed(0)} cm from`} the ${q.n} of ${c.who}`);
      }
    if (p.set) {
      const hit = insideSet(p.set, cam);
      if (hit) err("LENS_IN", `the lens is inside set mesh ${hit}`);
    }
    // BLOCKED
    if (p.subject) {
      const s = v(p.subject);
      const seg = s.clone().sub(cam);
      const end = cam.clone().addScaledVector(seg.normalize(), Math.max(0, cam.distanceTo(s) - 0.3));
      for (const c of chars) {
        if (c.who === p.who) continue;
        for (const q of c.P)
          if (segSeg(cam, end, q.a, q.b) < q.r * 0.8) {
            err("BLOCKED", `the ${q.n} of ${c.who} is between the lens and the subject`);
            break;
          }
      }
    }
    // OVERLAP
    const ok = new Set((p.allow ?? []).flatMap(([a, b]) => [`${a}|${b}`, `${b}|${a}`]));
    for (let i = 0; i < chars.length; i++)
      for (let j = i + 1; j < chars.length; j++) {
        const A = chars[i];
        const B = chars[j];
        if (ok.has(`${A.who}|${B.who}`)) continue;
        let worst = { d: Infinity, a: "", b: "" };
        for (const qa of A.P)
          for (const qb of B.P) {
            const d = segSeg(qa.a, qa.b, qb.a, qb.b) - qa.r - qb.r;
            if (d < worst.d) worst = { d, a: qa.n, b: qb.n };
          }
        if (worst.d < -0.01) err("OVERLAP", `the ${worst.a} of ${A.who} is ${(-worst.d * 100).toFixed(0)} cm into the ${worst.b} of ${B.who}`);
      }
    // INSIDE
    if (p.set)
      for (const c of chars)
        for (const n of ["Head", "Neck", "Hips", "LeftHandMiddle1", "RightHandMiddle1", "LeftLeg", "RightLeg"]) {
          if (!c.J[n]) continue;
          const hit = insideSet(p.set, v(c.J[n]));
          if (hit) err("INSIDE", `${c.who} ${n.replace("HandMiddle1", " hand").replace("Leg", " knee").toLowerCase()} is inside set mesh ${hit}`);
        }
    // FRAMING
    if (p.keep?.length) {
      const W = p.width ?? 1080;
      const Hh = p.height ?? 1920;
      const c = new THREE.PerspectiveCamera(p.cam.fov, W / Hh, 0.02, 600);
      c.position.copy(cam);
      const dir = v(p.cam.look).sub(cam).normalize();
      c.up.copy(new THREE.Vector3(0, 1, 0).applyAxisAngle(dir, ((p.cam.roll ?? 0) * Math.PI) / 180));
      c.lookAt(...p.cam.look);
      c.updateMatrixWorld();
      c.updateProjectionMatrix();
      const tanY = Math.tan((p.cam.fov * Math.PI) / 360);
      const M = 0.04; // 2 % of the frame on each side, in NDC
      for (const who of p.keep) {
        const ch = chars.find((x) => x.who === who);
        if (!ch) {
          err("FRAMING", `${who} is not drawn in this frame`);
          continue;
        }
        for (const q of ch.P.filter((x) => x.n === "head" || x.n === "torso")) {
          const pt = q.n === "head" ? q.a : q.b; // head centre / hips
          const rr = q.n === "head" ? q.r : 0;
          const camSpace = pt.clone().applyMatrix4(c.matrixWorldInverse);
          if (camSpace.z > -0.05) {
            err("FRAMING", `the ${q.n === "head" ? "head" : "hips"} of ${who} is behind the lens`);
            continue;
          }
          const n = pt.clone().project(c);
          const ry = rr / (-camSpace.z * tanY);
          const rx = ry / c.aspect;
          if (Math.abs(n.x) + rx > 1 - M || Math.abs(n.y) + ry > 1 - M)
            err("FRAMING", `the ${q.n === "head" ? "head" : "hips"} of ${who} leaves the frame (x ${n.x.toFixed(2)}, y ${n.y.toFixed(2)})`);
        }
      }
    }
  });
  return null;
};
