// PROCEDURAL POSE ENGINE (test 2026-11-20): cartoon key poses written as numbers, no Mixamo download.
// A pose = limb DIRECTIONS in character space (x = character's left, y = up, z = forward) + hips offset, chest/head
// angles and foot targets. A timeline of poses is BAKED into an ordinary THREE.AnimationClip on the Mixamo skeleton,
// so the existing Stickman solver (rigid torso, short arms, toon meshes, grabs, QA) uses it like any downloaded clip:
//   needs:  needProc("Proc_demo", keys)       clips: [{ clip: "Proc_demo", from: 0, step: false, loop: false }]
// Timing: a pose is HELD (with breathing), then SNAPS to the next in `snap` frames: 1-2 frames anticipation, an
// easeOutBack overshoot, forearms trail the upper arm by ~1.5 frames (rubber-hose arc), hips sink on the settle (squash).
import * as THREE from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { has, got, loadGLB } from "../world/assets";
import type { Need } from "../world/assets";
import { codeSkeleton } from "./codeSkel";

type V = [number, number, number];
export type PoseDef = {
  hips?: V; // metres offset of the pelvis (y < 0 crouch, y > 0 jump)
  chest?: V; // degrees: x bend forward(+)/back(-), y twist to char's left(+), z lean to char's right(+)
  head?: V; // degrees on top of the chest: x nod down(+), y turn left(+), z tilt
  lArm?: V; lFore?: V; rArm?: V; rFore?: V; // directions in CHEST space (rotate with the chest)
  lFoot?: V; rFoot?: V; // foot offset in metres from its rest spot (jumps, steps)
};

// directions written for the LEFT arm (+x = out to his side); m() mirrors to the right arm
const m = (v: V): V => [-v[0], v[1], v[2]];
const DOWN: V = [0.18, -1, 0.02];
const both = (arm: V, fore: V, p: PoseDef = {}): PoseDef => ({ lArm: arm, lFore: fore, rArm: m(arm), rFore: m(fore), ...p });

/** the 15 cartoon poses. Arms: upper-arm then forearm direction. */
export const POSES: Record<string, PoseDef> = {
  neutral: both(DOWN, [0.12, -1, 0.15]),
  talk_shrug: both([0.75, -0.65, 0.15], [0.55, 0.35, 0.75], { chest: [-4, 0, 0], head: [-6, 0, 10], hips: [0, -0.02, 0] }),
  point_forward: { rArm: [-0.72, 0.12, 0.68], rFore: [-0.7, 0.15, 0.7], lArm: DOWN, lFore: [0.15, -1, 0.3], chest: [8, -14, 0], head: [6, -8, 0], hips: [0, -0.03, 0.03], rFoot: [0, 0, 0.12] },
  shock_jump: both([0.75, 0.6, 0.1], [0.5, 0.85, 0], { hips: [0, 0.26, -0.04], chest: [-14, 0, 0], head: [-14, 0, 0], lFoot: [0.05, 0.22, -0.06], rFoot: [-0.05, 0.3, -0.02] }),
  hands_on_hips: both([0.72, -0.62, -0.2], [-0.62, -0.72, 0.08], { chest: [-6, 0, 0], head: [-4, 0, 8] }),
  arms_crossed: { lArm: [0.35, -0.75, 0.55], lFore: [-1, 0.12, 0.18], rArm: [-0.35, -0.75, 0.55], rFore: [1, 0.2, 0.12], chest: [-5, 0, 0], head: [-6, 12, 0] },
  wave: { rArm: [-0.85, 0.35, 0.15], rFore: [-0.15, 1, 0.1], lArm: DOWN, lFore: [0.12, -1, 0.15], chest: [0, 0, 6], head: [-4, 0, -8] },
  think: { rArm: [-0.2, -0.9, 0.4], rFore: [0.35, 0.85, 0.4], lArm: [0.2, -0.9, 0.35], lFore: [-0.85, 0.05, 0.5], head: [-12, 15, 10], chest: [2, 0, 0] },
  facepalm: { rArm: [-0.15, -0.05, 1], rFore: [0.45, 0.75, -0.5], lArm: DOWN, lFore: [0.15, -1, 0.1], chest: [16, 0, 0], head: [28, 0, 0], hips: [0, -0.03, -0.02] },
  cheer: both([0.78, 0.62, 0.05], [0.4, 0.92, 0], { chest: [-12, 0, 0], head: [-18, 0, 0], hips: [0, 0.05, 0] }),
  lean_in: both([0.35, -0.6, 0.7], [0.2, 0.1, 1], { chest: [22, 0, 0], head: [-10, 0, 0], hips: [0, -0.04, 0.05], rFoot: [0, 0, 0.18] }),
  recoil: both([0.6, -0.1, 0.8], [0.3, 0.95, 0.1], { chest: [-20, 0, 0], head: [-6, 0, 0], hips: [0, -0.06, -0.08], lFoot: [0, 0, -0.16] }),
  sad_slump: both([0.08, -1, 0.15], [0.02, -1, 0.25], { chest: [24, 0, 0], head: [30, 0, 0], hips: [0, -0.05, 0] }),
  fist_pump: { rArm: [-0.65, -0.6, 0.45], rFore: [-0.2, 0.95, 0.2], lArm: DOWN, lFore: [0.15, -1, 0.2], chest: [6, -10, -6], head: [-6, 0, 0], hips: [0, -0.08, 0] },
  present: { lArm: [0.85, -0.3, 0.45], lFore: [0.75, 0.05, 0.65], rArm: DOWN, rFore: [-0.12, -1, 0.15], chest: [0, 18, 0], head: [-4, 22, 0] },
};

export type ProcKey = { at: number; pose: string | PoseDef; snap?: number };

// ---------------------------------------------------------------- blending
const NUM = (p: PoseDef) => p; // poses are plain numbers; blended field by field
const lerpV = (a: V | undefined, b: V | undefined, u: number, def: V): V => {
  const x = a ?? def, y = b ?? def;
  return [x[0] + (y[0] - x[0]) * u, x[1] + (y[1] - x[1]) * u, x[2] + (y[2] - x[2]) * u];
};
const resolve = (p: string | PoseDef): PoseDef => (typeof p === "string" ? NUM(POSES[p] ?? POSES.neutral) : p);
const Z3: V = [0, 0, 0];
const blend = (a: PoseDef, b: PoseDef, u: number, uFore: number): Required<PoseDef> => {
  const n = POSES.neutral;
  return {
    hips: lerpV(a.hips, b.hips, u, Z3), chest: lerpV(a.chest, b.chest, u, Z3), head: lerpV(a.head, b.head, u, Z3),
    lArm: lerpV(a.lArm ?? n.lArm, b.lArm ?? n.lArm, u, DOWN), rArm: lerpV(a.rArm ?? n.rArm, b.rArm ?? n.rArm, u, m(DOWN)),
    lFore: lerpV(a.lFore ?? n.lFore, b.lFore ?? n.lFore, uFore, DOWN), rFore: lerpV(a.rFore ?? n.rFore, b.rFore ?? n.rFore, uFore, m(DOWN)),
    lFoot: lerpV(a.lFoot, b.lFoot, u, Z3), rFoot: lerpV(a.rFoot, b.rFoot, u, Z3),
  };
};

/** snap curve 0..1: small anticipation dip, then easeOutBack overshoot that settles */
const C1 = 1.70158, C3 = C1 + 1;
const easeOutBack = (x: number) => 1 + C3 * Math.pow(x - 1, 3) + C1 * Math.pow(x - 1, 2);
const snapCurve = (u: number) => {
  if (u <= 0) return 0;
  if (u >= 1) return 1;
  const A = 0.22; // share of the snap spent anticipating
  if (u < A) return -0.08 * Math.sin((Math.PI * u) / A);
  return easeOutBack((u - A) / (1 - A));
};

/** the blended pose at time t (seconds) + the settle squash */
export const poseAt = (keys: ProcKey[], t: number): Required<PoseDef> => {
  const ks = [...keys].sort((a, b) => a.at - b.at);
  let i = 0;
  for (let k = 0; k < ks.length; k++) if (ks[k].at <= t) i = k;
  const cur = ks[i];
  const prev = i > 0 ? ks[i - 1] : cur;
  const S = (cur.snap ?? 5) / 30;
  const x = (t - cur.at) / S;
  const u = snapCurve(x);
  const uF = snapCurve(x - 1.5 / (cur.snap ?? 5)); // forearm trails: the arm arcs instead of hinging
  const p = blend(resolve(prev.pose), resolve(cur.pose), i === 0 ? 1 : u, i === 0 ? 1 : uF);
  // squash on the settle: hips sink a little after the snap lands, then recover
  const after = t - cur.at - S;
  if (i > 0 && after > 0 && after < 0.35) p.hips = [p.hips[0], p.hips[1] - 0.035 * Math.sin((Math.PI * after) / 0.35) * Math.exp(-after * 4), p.hips[2]];
  // life in the hold: breathing + a slow sway, so a held pose never freezes dead
  p.chest = [p.chest[0] + 1.6 * Math.sin(t * 2.1), p.chest[1] + 1.2 * Math.sin(t * 0.9), p.chest[2] + 0.8 * Math.sin(t * 1.3)];
  p.head = [p.head[0] + 1.5 * Math.sin(t * 1.7 + 1), p.head[1] + 2 * Math.sin(t * 0.7), p.head[2]];
  p.hips = [p.hips[0], p.hips[1] + 0.006 * Math.sin(t * 2.1), p.hips[2]];
  return p;
};

// ---------------------------------------------------------------- baking onto the Mixamo skeleton
const D2R = Math.PI / 180;
const eul = (v: V) => new THREE.Quaternion().setFromEuler(new THREE.Euler(v[0] * D2R, v[1] * D2R, v[2] * D2R, "YXZ"));
const dir = (v: V) => new THREE.Vector3(...v).normalize();

type Skel = {
  bones: THREE.Object3D[]; // depth-first order (parents first)
  restWQ: Map<THREE.Object3D, THREE.Quaternion>;
  restWP: Map<THREE.Object3D, THREE.Vector3>;
  by: (n: string) => THREE.Object3D;
  hipsParentInv: THREE.Matrix4;
  hipsRestLocal: THREE.Vector3;
};
const skelOf = (scene: THREE.Object3D): Skel => {
  scene.updateMatrixWorld(true);
  const bones: THREE.Object3D[] = [];
  const restWQ = new Map(), restWP = new Map();
  const by = (n: string) => (scene.getObjectByName("mixamorig" + n) ?? scene.getObjectByName("mixamorig:" + n))!;
  by("Hips").traverse((o) => {
    bones.push(o);
    restWQ.set(o, o.getWorldQuaternion(new THREE.Quaternion()));
    restWP.set(o, o.getWorldPosition(new THREE.Vector3()));
  });
  const hips = by("Hips");
  return { bones, restWQ, restWP, by, hipsParentInv: hips.parent!.matrixWorld.clone().invert(), hipsRestLocal: hips.position.clone() };
};

/** world-space delta rotation per bone for one pose (unlisted bones inherit their parent's delta) */
const deltas = (sk: Skel, p: Required<PoseDef>) => {
  const D = new Map<THREE.Object3D, THREE.Quaternion>();
  const by = sk.by;
  const chest = eul(p.chest);
  const I = new THREE.Quaternion();
  D.set(by("Hips"), I.clone().slerp(chest, 0.25));
  D.set(by("Spine"), I.clone().slerp(chest, 0.5));
  D.set(by("Spine1"), I.clone().slerp(chest, 0.8));
  D.set(by("Spine2"), chest);
  const head = chest.clone().multiply(eul(p.head));
  D.set(by("Neck"), chest.clone().slerp(head, 0.4));
  D.set(by("Head"), head);
  const limb = (a: string, b: string, target: THREE.Vector3) => {
    const rest = sk.restWP.get(by(b))!.clone().sub(sk.restWP.get(by(a))!).normalize();
    return new THREE.Quaternion().setFromUnitVectors(rest, target.clone().normalize());
  };
  // arms in chest space
  D.set(by("LeftArm"), limb("LeftArm", "LeftForeArm", dir(p.lArm).applyQuaternion(chest)));
  D.set(by("LeftForeArm"), limb("LeftForeArm", "LeftHandMiddle1", dir(p.lFore).applyQuaternion(chest)));
  D.set(by("RightArm"), limb("RightArm", "RightForeArm", dir(p.rArm).applyQuaternion(chest)));
  D.set(by("RightForeArm"), limb("RightForeArm", "RightHandMiddle1", dir(p.rFore).applyQuaternion(chest)));
  // legs: two-bone IK from the moved hip joint to the foot target, knee bends forward
  const hipsOff = new THREE.Vector3(...p.hips);
  for (const s of ["Left", "Right"] as const) {
    const up = by(s + "UpLeg"), kn = by(s + "Leg"), ft = by(s + "Foot");
    const H = sk.restWP.get(up)!.clone().add(hipsOff);
    const F = sk.restWP.get(ft)!.clone().add(new THREE.Vector3(...(s === "Left" ? p.lFoot : p.rFoot)));
    const a = sk.restWP.get(kn)!.distanceTo(sk.restWP.get(up)!), b = sk.restWP.get(ft)!.distanceTo(sk.restWP.get(kn)!);
    const hf = F.clone().sub(H);
    const c = Math.min(hf.length(), (a + b) * 0.999);
    const uDir = hf.normalize();
    const fwd = new THREE.Vector3(0, 0, 1);
    const w = fwd.addScaledVector(uDir, -fwd.dot(uDir)).normalize();
    const alpha = Math.acos(THREE.MathUtils.clamp((a * a + c * c - b * b) / (2 * a * c), -1, 1));
    const K = H.clone().addScaledVector(uDir, a * Math.cos(alpha)).addScaledVector(w, a * Math.sin(alpha));
    const Fr = H.clone().addScaledVector(uDir, c);
    D.set(up, limb(s + "UpLeg", s + "Leg", K.clone().sub(H)));
    D.set(kn, limb(s + "Leg", s + "Foot", Fr.clone().sub(K)));
    D.set(ft, I.clone()); // foot stays flat
  }
  // fill the rest by inheritance
  for (const o of sk.bones) if (!D.has(o)) D.set(o, D.get(o.parent!) ?? I.clone());
  return D;
};

/** bake a pose timeline into an AnimationClip (30 fps) */
export const bakeProc = (name: string, scene: THREE.Object3D, keys: ProcKey[], tail = 1.0): THREE.AnimationClip => {
  const sk = skelOf(scene);
  const end = Math.max(...keys.map((k) => k.at + (k.snap ?? 5) / 30)) + tail;
  const n = Math.ceil(end * 30) + 1;
  const times = new Float32Array(n);
  const q = new Map(sk.bones.map((o) => [o, new Float32Array(n * 4)] as const));
  const hp = new Float32Array(n * 3);
  const wq = new THREE.Quaternion(), pq = new THREE.Quaternion(), lq = new THREE.Quaternion();
  for (let f = 0; f < n; f++) {
    const t = f / 30;
    times[f] = t;
    const p = poseAt(keys, t);
    const D = deltas(sk, p);
    for (const o of sk.bones) {
      // local = inv(parent new world) * (D * rest world)
      wq.copy(D.get(o)!).multiply(sk.restWQ.get(o)!);
      const par = o.parent!;
      if (sk.restWQ.has(par)) pq.copy(D.get(par)!).multiply(sk.restWQ.get(par)!);
      else par.getWorldQuaternion(pq);
      lq.copy(pq).invert().multiply(wq);
      lq.toArray(q.get(o)!, f * 4);
    }
    // hips translation: world offset -> the armature's local space
    const wp = sk.restWP.get(sk.by("Hips"))!.clone().add(new THREE.Vector3(...p.hips)).applyMatrix4(sk.hipsParentInv);
    wp.toArray(hp, f * 3);
  }
  const tracks: THREE.KeyframeTrack[] = sk.bones.map((o) => new THREE.QuaternionKeyframeTrack(`${o.name}.quaternion`, times, q.get(o)!));
  tracks.push(new THREE.VectorKeyframeTrack(`${sk.by("Hips").name}.position`, times, hp));
  const clip = new THREE.AnimationClip(name, end, tracks);
  (clip as any).userData = { inPlace: true }; // rig.ts: keep our own hips x/z
  return clip;
};

/** a Need that registers `clip:<name>` (same shape as a downloaded clip GLB) baked from `keys`. By default (base
 *  "@code", 2026-11-24) it bakes onto the skeleton built in code (char3d/codeSkel.ts): no Mixamo file needed. Pass a
 *  clip name to use the skeleton of public/clips/<base>.glb instead. Every clip of one character must share one
 *  skeleton source: all "@code", or all Mixamo. */
export const needProc = (name: string, keys: ProcKey[], base = "@code"): Need => [
  `clip:${name}`,
  async () => {
    if (base === "@code") {
      const scene = codeSkeleton();
      const clip = bakeProc(name, scene, keys);
      return { scene, scenes: [scene], animations: [clip], cameras: [], asset: {}, parser: null, userData: {} } as unknown as GLTF;
    }
    const g = has(`proc-base:${base}`) ? got<GLTF>(`proc-base:${base}`) : await loadGLB(`clips/${base}.glb`);
    const scene = g.scene.clone(true);
    const t0 = performance.now();
    const clip = bakeProc(name, scene, keys);
    console.log(`PROC bake ${name}: ${clip.tracks.length} tracks, ${clip.duration.toFixed(2)} s, ${(performance.now() - t0).toFixed(1)} ms`);
    return { ...g, scene, animations: [clip] } as GLTF;
  },
];

// ---------------------------------------------------------------- seated + emotion poses, emotes (2026-11-24)
// Seated poses assume the workshop's table staging: the character's feet sink below the floor behind a closed table
// block, so only the arms, chest and head act. Forearms rest folded in front of the chest (two people turned toward
// each other otherwise touch hands in the middle of the table: StageQA OVERLAP). Arms are short in this style (hand
// to shoulder ~ torso height): poses keep hands at chest height and away from the face.
const ARM_REST: V = [0.2, -0.95, 0.2]; // hands come down to the table top (they floated 14 cm over it)
const FORE_REST: V = [-0.3, -0.45, 0.85];
const seat = (p: PoseDef = {}): PoseDef => ({ lArm: ARM_REST, lFore: FORE_REST, rArm: m(ARM_REST), rFore: m(FORE_REST), ...p });
Object.assign(POSES, {
  // seated, at a table
  desk_rest: seat(),
  desk_read: seat({ chest: [10, 0, 0], head: [24, 0, 0] }),
  desk_lean_in: seat({ chest: [16, 0, 0], head: [-8, 0, 0], hips: [0, 0, 0.04] }),
  desk_lean_back: seat({ chest: [-10, 0, 0], head: [-4, 0, 4], hips: [0, 0, -0.03] }),
  desk_explain: seat({ rArm: [-0.55, -0.5, 0.65], rFore: [-0.2, 0.55, 0.8], chest: [2, 0, 0], head: [-4, 0, 6] }),
  desk_offer: seat({ chest: [10, 0, 0], rArm: [-0.3, -0.45, 0.85], rFore: [-0.15, 0.15, 1] }), // asking, palm out
  desk_slide: seat({ chest: [12, 0, 0], rArm: [-0.15, -0.45, 0.9], rFore: [0.15, -0.05, 1] }), // pushing a thing across
  desk_shrug: { lArm: [0.75, -0.62, 0.2], lFore: [0.5, 0.4, 0.75], rArm: [-0.75, -0.62, 0.2], rFore: [-0.5, 0.4, 0.75], chest: [-4, 0, 0], head: [-6, 0, 9] },
  desk_wave: seat({ rArm: [-0.85, 0.3, 0.2], rFore: [-0.15, 1, 0.1], head: [-4, 0, -8] }),
  desk_arms_crossed: { lArm: [0.35, -0.75, 0.55], lFore: [-1, 0.12, 0.18], rArm: [-0.35, -0.75, 0.55], rFore: [1, 0.2, 0.12], chest: [-6, 0, 0], head: [-4, 0, -10] },
  desk_slump: seat({ chest: [22, 0, 0], head: [26, 0, 0] }),
  desk_hands_up: both([0.6, -0.2, 0.6], [0.2, 0.95, 0.2], { chest: [-12, 0, 0], head: [-8, 0, 0] }), // surprise / excitement
  desk_chin: seat({ rArm: [-0.12, -0.6, 0.8], rFore: [0.1, 0.9, 0.35], head: [-6, 0, 8], chest: [8, 0, 0] }), // thinking
  desk_point_self: seat({ rArm: [-0.35, -0.7, 0.6], rFore: [0.95, 0.1, 0.25] }), // "me?"
  // standing, emotion
  hands_clasped: both([0.25, -0.85, 0.45], [-0.75, 0.2, 0.6], { chest: [-4, 0, 0], head: [-6, 0, 6] }), // hopeful / excited
  thumbs_up: { rArm: [-0.6, -0.45, 0.65], rFore: [-0.1, 0.95, 0.2], lArm: DOWN, lFore: [0.12, -1, 0.15], chest: [-4, -6, 0], head: [-4, 0, -6] },
  palm_out: { rArm: [-0.35, -0.2, 0.9], rFore: [-0.1, 0.6, 0.8], lArm: DOWN, lFore: [0.12, -1, 0.15], chest: [-6, 0, 0], head: [-6, 0, 0] }, // "stop" / "wait"
  point_self: { rArm: [-0.35, -0.7, 0.6], rFore: [0.95, 0.1, 0.25], lArm: DOWN, lFore: [0.12, -1, 0.15], head: [-4, 0, 8] },
  hand_raise: { rArm: [-0.3, 0.95, 0.1], rFore: [-0.05, 1, 0], lArm: DOWN, lFore: [0.12, -1, 0.15], head: [-6, 0, -4] },
  fidget: both([0.3, -0.9, 0.3], [-0.8, -0.1, 0.55], { chest: [6, 0, 0], head: [8, -10, -6] }), // awkward, hands together low
  exhale: both([0.2, -1, 0.05], [0.15, -1, 0.1], { chest: [-8, 0, 0], head: [-14, 0, 0], hips: [0, -0.02, 0] }), // relief
});

/** an emote = a face (src/char/drawCharacter.ts expression) + a body pose, standing or seated. Key them with emoteTrack
 *  so the face and the body always change together. */
export const EMOTES: Record<string, { e: string; stand: string; sit: string }> = {
  neutral: { e: "neutral", stand: "neutral", sit: "desk_rest" },
  listen: { e: "neutral", stand: "neutral", sit: "desk_rest" },
  read: { e: "neutral", stand: "think", sit: "desk_read" },
  talk: { e: "eager", stand: "talk_shrug", sit: "desk_explain" }, // open eyes: a speaker explaining never has shut eyes
  happy: { e: "happy", stand: "neutral", sit: "desk_rest" },
  eager: { e: "eager", stand: "lean_in", sit: "desk_lean_in" },
  excited: { e: "excited", stand: "hands_clasped", sit: "desk_hands_up" },
  awkward: { e: "awkward", stand: "fidget", sit: "desk_lean_back" },
  embarrassed: { e: "embarrassed", stand: "fidget", sit: "desk_slump" },
  shy: { e: "shy", stand: "fidget", sit: "desk_rest" },
  sheepish: { e: "sheepish", stand: "talk_shrug", sit: "desk_shrug" },
  relieved: { e: "relieved", stand: "exhale", sit: "desk_lean_back" },
  deadpan: { e: "deadpan", stand: "arms_crossed", sit: "desk_arms_crossed" },
  annoyed: { e: "annoyed", stand: "hands_on_hips", sit: "desk_arms_crossed" },
  hopeful: { e: "hopeful", stand: "hands_clasped", sit: "desk_lean_in" },
  proud: { e: "proud", stand: "hands_on_hips", sit: "desk_lean_back" },
  surprised: { e: "surprised", stand: "recoil", sit: "desk_hands_up" },
  shocked: { e: "shocked", stand: "shock_jump", sit: "desk_hands_up" },
  curious: { e: "curious", stand: "lean_in", sit: "desk_lean_in" },
  thinking: { e: "thinking", stand: "think", sit: "desk_chin" },
  confused: { e: "confused", stand: "talk_shrug", sit: "desk_shrug" },
  wince: { e: "wince", stand: "recoil", sit: "desk_lean_back" },
  sad: { e: "sad", stand: "sad_slump", sit: "desk_slump" },
  laugh: { e: "laugh", stand: "cheer", sit: "desk_lean_back" },
  ask: { e: "hopeful", stand: "present", sit: "desk_offer" },
  give: { e: "happy", stand: "present", sit: "desk_slide" },
  me: { e: "surprised", stand: "point_self", sit: "desk_point_self" },
  wave: { e: "grin", stand: "wave", sit: "desk_wave" },
  thumbs: { e: "grin", stand: "thumbs_up", sit: "desk_wave" },
  stop: { e: "stern", stand: "palm_out", sit: "desk_offer" },
};
/** the same pose for a character who faces the other way: left and right arms and feet swap, twists and leans flip.
 *  A pose gestures with the RIGHT arm; someone on screen right who faces screen left must use the mirrored pose, or the
 *  gesture points away from the lens (2026-11-24 review: her arm showed as a thin line poking at her partner). */
export const mirrorPose = (p: string | PoseDef): PoseDef => {
  const q = typeof p === "string" ? POSES[p] ?? POSES.neutral : p;
  const f = (v?: V): V | undefined => (v ? [-v[0], v[1], v[2]] : undefined);
  const r = (v?: V): V | undefined => (v ? [v[0], -v[1], -v[2]] : undefined);
  const out: PoseDef = { lArm: f(q.rArm), lFore: f(q.rFore), rArm: f(q.lArm), rFore: f(q.lFore), lFoot: f(q.rFoot), rFoot: f(q.lFoot), hips: f(q.hips), chest: r(q.chest), head: r(q.head) };
  for (const k of Object.keys(out) as (keyof PoseDef)[]) if (out[k] === undefined) delete out[k];
  return out;
};
export type EmoteBeat = { at: number; emote: string; snap?: number; e?: string; pose?: string | PoseDef };
/** turn one list of emote beats (seconds) into the pose keys for needProc and the expression keys for <Stickman expr>.
 *  `e` / `pose` on a beat override the emote's face / body (e.g. a face change with the body held). */
export const emoteTrack = (beats: EmoteBeat[], seated = false) => {
  const keys: ProcKey[] = [];
  const expr: { at: number; e: string }[] = [];
  for (const b of beats) {
    const em = EMOTES[b.emote];
    if (!em) throw new Error(`unknown emote "${b.emote}" (EMOTES in char3d/poseEngine.ts)`);
    keys.push({ at: Math.max(0, b.at), pose: b.pose ?? (seated ? em.sit : em.stand), snap: b.snap ?? 6 });
    expr.push({ at: Math.max(0, b.at), e: b.e ?? em.e });
  }
  return { keys, expr };
};
