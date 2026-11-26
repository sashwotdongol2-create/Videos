// One Mixamo skeleton per character, driven by any number of clips (public/clips/<Clip>.glb from `stickman3d.py clip`).
// All Mixamo clips share bone names, so every clip binds to every character's skeleton. Pure function of time:
// action times and weights are set absolutely every evaluation (never mixer deltas).
import * as THREE from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { got, loadGLB } from "../world/assets";
import type { Need } from "../world/assets";

export const needClip = (clip: string): Need => [`clip:${clip}`, () => loadGLB(`clips/${clip}.glb`)];

/** a clip on a character's timeline: starts at `from` (shot seconds), cross-fades in over `fade` s; `offset` = clip
 *  time at `from`; `loop` (default true) wraps, otherwise holds the last frame; `speed` scales clip time;
 *  `step` = the pose-to-pose time remap (RicksClips puppet timing, see STEP): default ON for gestures and idles, OFF
 *  for locomotion clips (CONTINUOUS); false / true force it, an object overrides the numbers for this key */
export type StepSpec = { every?: number; snap?: number; drift?: number };
export type ClipKey = { clip: string; from: number; fade?: number; offset?: number; loop?: boolean; speed?: number; step?: boolean | StepSpec };

/** pose-to-pose timing measured on the reference (30 fps frames): a pose is held, then snaps to the next one.
 *  every = frames from one pose to the next (hold + snap; the reference holds 12-25 frames, Mixamo gestures are busier
 *  so the default is the short end), snap = frames of the change (5-8 measured), drift = share of real clip time that
 *  leaks through a hold (the breathing drift), antic / over = anticipation dip and overshoot of the snap */
export const STEP = { every: 16, snap: 5, drift: 0.06, antic: 0.05, over: 1.70158 };
/** clips that keep their continuous motion by default (root motion must match the feet) */
export const CONTINUOUS = /walk|run|jog|march|sprint|crawl|climb|swim|push|pull|carry|ladder|treadmill|_IP|_RM/i;
export const stepOf = (k: ClipKey): Required<StepSpec> | null => {
  if (k.step === false) return null;
  if (k.step === undefined) return CONTINUOUS.test(k.clip) ? null : STEP;
  return k.step === true ? STEP : { ...STEP, ...k.step };
};
/** snap easing 0..1 -> 0..1 with a small anticipation dip first and an overshoot that settles (back-out) */
export const snapEase = (u: number) => {
  const a = u < 0.25 ? -STEP.antic * Math.sin((Math.PI * u) / 0.25) : 0;
  const v = Math.min(1, Math.max(0, (u - 0.2) / 0.8)) - 1;
  const m = u <= 0.2 ? 0 : 1 + (STEP.over + 1) * v * v * v + STEP.over * v * v;
  return a + m;
};
/** clip seconds (from the key's start) -> the held / snapping clip seconds */
export const stepTime = (x: number, st: Required<StepSpec>) => {
  const T = st.every / 30;
  const S = Math.min(st.snap / 30, T * 0.8);
  const n = Math.floor(x / T);
  const r = x - n * T;
  if (r < T - S) return n * T + st.drift * r;
  const a = n * T + st.drift * (T - S);
  return a + ((n + 1) * T - a) * snapEase((r - (T - S)) / S);
};
/** the key in charge at t and its cross-fade weight (and the key it fades from) */
export const keyAt = (keys: ClipKey[], t: number) => {
  const ks = [...keys].sort((a, b) => a.from - b.from);
  let i = 0;
  for (let k = 0; k < ks.length; k++) if (ks[k].from <= t) i = k;
  const cur = ks[i];
  const prev = i > 0 ? ks[i - 1] : null;
  let w = prev ? THREE.MathUtils.clamp((t - cur.from) / Math.max(1e-3, cur.fade ?? 0.3), 0, 1) : 1;
  if (prev && stepOf(cur)) w = 1 - (1 - w) * (1 - w) * (1 - w); // into a stepped clip: fast out, slow in
  return { cur, prev, w };
};
/** 0..1: how much of the pose at t comes from continuous locomotion clips (walk bob, quiet arms) */
export const walkWeight = (keys: ClipKey[], t: number) => {
  const { cur, prev, w } = keyAt(keys, t);
  const is = (k: ClipKey | null) => (k && /walk|run|jog|march/i.test(k.clip) && !stepOf(k) ? 1 : 0);
  return is(cur) * w + is(prev) * (1 - w);
};

export type Rig = {
  who: string;
  root: THREE.Group;
  skel: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  actions: Map<string, THREE.AnimationAction>;
  bone: (n: string) => THREE.Object3D;
  speeds: Map<string, number>;
  /** the skeleton's bind (rest) pose, captured before any clip touched it: a fixed reference for measuring */
  rest: [THREE.Object3D, THREE.Vector3, THREE.Quaternion, THREE.Vector3][];
};
const rigs = new Map<string, Rig>();

export const rigFor = (who: string, clips: string[]): Rig => {
  let r = rigs.get(who);
  if (!r) {
    const base = got<GLTF>(`clip:${clips[0]}`);
    const skel = base.scene.clone(true);
    const root = new THREE.Group();
    root.add(skel);
    const mixer = new THREE.AnimationMixer(skel);
    const bones = new Map<string, THREE.Object3D>();
    const bone = (n: string) => {
      let b = bones.get(n);
      if (!b) {
        b = skel.getObjectByName("mixamorig" + n) ?? skel.getObjectByName("mixamorig:" + n);
        if (!b) throw new Error(`bone ${n} missing in clip ${clips[0]}`);
        bones.set(n, b);
      }
      return b;
    };
    const rest: Rig["rest"] = [];
    skel.traverse((o) => rest.push([o, o.position.clone(), o.quaternion.clone(), o.scale.clone()]));
    r = { who, root, skel, mixer, actions: new Map(), bone, speeds: new Map(), rest };
    rigs.set(who, r);
  }
  for (const c of clips) {
    if (r.actions.has(c)) continue;
    const clip = got<GLTF>(`clip:${c}`).animations[0];
    // BUILD_LESSONS #48/#56: clips downloaded without "in place" carry root travel in the hips track; the engine moves
    // characters itself (`at`, walked()), so the ground-plane travel is pinned to the first frame (height kept). The
    // armature's axes differ per clip export: the HEIGHT axis is the one whose first value is largest in magnitude.
    if (!(clip as any).userData?.inPlace) {
      for (const tr of clip.tracks) {
        if (!/Hips\.position$/.test(tr.name)) continue;
        const v = tr.values, f = [v[0], v[1], v[2]];
        const up = [0, 1, 2].reduce((m, k) => (Math.abs(f[k]) > Math.abs(f[m]) ? k : m), 0);
        for (let i = 0; i < v.length; i += 3) for (let k = 0; k < 3; k++) if (k !== up) v[i + k] = f[k];
      }
      (clip as any).userData = { ...((clip as any).userData ?? {}), inPlace: true };
    }
    const a = r.mixer.clipAction(clip);
    a.play();
    a.setEffectiveWeight(0);
    r.actions.set(c, a);
  }
  return r;
};

const clipTime = (k: ClipKey, a: THREE.AnimationAction, t: number) => {
  const d = a.getClip().duration;
  const st = stepOf(k);
  const raw = (t - k.from) * (k.speed ?? 1);
  const x = (st ? stepTime(raw, st) : raw) + (k.offset ?? 0);
  return k.loop === false ? THREE.MathUtils.clamp(x, 0, d - 1e-3) : ((x % d) + d) % d;
};

/** pose the rig's skeleton for time t (shot seconds) from a clip timeline */
export const evaluate = (r: Rig, keys: ClipKey[], t: number) => {
  const { cur, prev, w } = keyAt(keys, t);
  r.actions.forEach((a) => a.setEffectiveWeight(0));
  const ca = r.actions.get(cur.clip)!;
  ca.time = clipTime(cur, ca, t);
  ca.setEffectiveWeight(w);
  if (prev && w < 1) {
    const pa = r.actions.get(prev.clip)!;
    if (pa === ca) ca.setEffectiveWeight(1);
    else {
      pa.time = clipTime(prev, pa, t);
      pa.setEffectiveWeight(1 - w);
    }
  }
  r.mixer.update(0);
};

/** put the skeleton in its bind (rest) pose at the origin, scale 1 (the next evaluate() poses it again) */
export const restPose = (r: Rig) => {
  for (const [o, p, q, s] of r.rest) {
    o.position.copy(p);
    o.quaternion.copy(q);
    o.scale.copy(s);
  }
  r.root.position.set(0, 0, 0);
  r.root.rotation.set(0, 0, 0);
  r.root.scale.setScalar(1);
  r.root.updateMatrixWorld(true);
};

/** walking speed of an in-place clip (m/s at skeleton scale 1): the planted foot slides back at walk speed in stance */
export const clipSpeed = (r: Rig, clip: string): number => {
  const hit = r.speeds.get(clip);
  if (hit !== undefined) return hit;
  const a = r.actions.get(clip);
  if (!a) throw new Error(`clip ${clip} not on ${r.who}'s timeline`);
  const d = a.getClip().duration;
  const foot = r.bone("LeftFoot");
  const v = new THREE.Vector3();
  let lo = 1e9;
  let hi = -1e9;
  r.actions.forEach((x) => x.setEffectiveWeight(0));
  a.setEffectiveWeight(1);
  r.root.position.set(0, 0, 0);
  r.root.rotation.set(0, 0, 0);
  r.root.scale.setScalar(1);
  for (let k = 0; k < 32; k++) {
    a.time = (k / 32) * d;
    r.mixer.update(0);
    r.root.updateMatrixWorld(true);
    foot.getWorldPosition(v);
    lo = Math.min(lo, v.z);
    hi = Math.max(hi, v.z);
  }
  const s = (hi - lo) / (d * 0.5);
  r.speeds.set(clip, s);
  return s;
};

/** distance walked by time t when walking at `v` m/s from tStart, easing to a stop over `fade` s after tStop
 *  (use the same fade as the clip cross-fade: no foot slide) */
export const walked = (t: number, v: number, tStart: number, tStop = Infinity, fade = 0.4) => {
  const a = Math.max(0, Math.min(t, tStop) - tStart);
  const u = THREE.MathUtils.clamp(t - tStop, 0, fade);
  return v * (a + u - (u * u) / (2 * fade));
};
