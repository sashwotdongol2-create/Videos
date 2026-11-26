// Silhouette crowd (user 2026-11-20: "add NPCs to make the environment lively; they can be silhouette characters").
// Many background people drawn as flat-tinted stickman SILHOUETTES (big round head, pill torso, stick limbs, hat
// shapes), posed by Mixamo clips on one shared skeleton, deterministic in `seed`, a pure function of t.
// Cheap: every figure of a <Crowd/> is an instance of 5 instanced meshes (limbs, torso, head, hat crown, hat brim):
// 5 draw calls for any count; the pose is one clip evaluation per figure (CPU).
//
//   needs: [...needCrowd()]            (the clips: Walking_IP_F, Standing_Idle, Cheering by default)
//   <Crowd t={t} cam={cam.pos} seed={4} count={40} mode="walk" path={[[-30, 0, 4], [30, 0, 4]]} spread={2} />
//   <Crowd t={t} cam={cam.pos} seed={7} count={30} mode={{ stand: 2, cheer: 1 }} area={{ min: [-20, 6], max: [20, 9] }}
//     ground={(x, z) => groundY(set, x, z)} keepOut={[{ p: heroAt, r: 1.2 }, { p: carAt, r: 3 }]} protect={[heroHead]} />
//   <Crowd ... spots={[[2, 6.1, -8], [4, 6.1, -8]]} mode="cheer" />          (balconies: explicit points)
// Placement: `path` (polyline; walkers loop along it, both ways with twoWay) or `area` (xz rectangle; walkers go along
// its long side and wrap) or `spots`. A wrapping walker jumps from one end to the other: let paths / areas run past the
// frame edges. Stand / cheer figures face `face` (default the lens) with a little scatter.
// Background only: no drawn faces, no ink; colour fades toward the mood's haze with distance (fade [near, far] m).
// StageQA does not see them (they register no joints). keepOut circles push people out (the cast, a car: pass the car's
// position every frame and the crowd parts around it); `protect` hides anyone between the lens and those points (hero
// faces). Never put them nearer the lens than the cast: they are silhouettes, not characters.
// Hero clearance: give the hero >= 3 m (1.4 m reads as "standing next to him"), and pass the same circle to `spots`
// crowds too. The push is RADIAL from the circle's centre: when a walker path runs between the lens and the hero, a
// circle on the hero shoves walkers toward the lens. Centre a second circle ON the path line level with the hero
// (sarajevo s13: { p: [pathX, 0, hero.z], r: 4.5 }) so they slide along the path and bunch up off-frame.
import React from "react";
import * as THREE from "three";
import { evaluate, needClip, rigFor, clipSpeed, restPose } from "../char3d/rig";
import type { Rig } from "../char3d/rig";
import { useMood } from "../engine/core/View";
import { h01 } from "../engine/core/physics";
import type { V3 } from "../engine/types";
import type { Need } from "../world/assets";

export type CrowdClips = { walk: string; stand: string; cheer: string };
export const CROWD_CLIPS: CrowdClips = { walk: "Walking_IP_F", stand: "Standing_Idle", cheer: "Cheering" };
export const needCrowd = (clips: Partial<CrowdClips> = {}): Need[] => {
  const c = { ...CROWD_CLIPS, ...clips };
  return [...new Set([c.walk, c.stand, c.cheer])].map(needClip);
};
export type CrowdMode = "walk" | "stand" | "cheer" | { walk?: number; stand?: number; cheer?: number };
export type HatKind = "bowler" | "top" | "fez" | "picture" | "cap" | "none";
export type CrowdProps = {
  t: number;
  cam: V3;
  count: number;
  seed?: number;
  mode?: CrowdMode;
  path?: V3[];
  /** walkers / standers spread across the path (m, default 1.6) */
  spread?: number;
  area?: { min: [number, number]; max: [number, number] };
  spots?: V3[];
  /** walk speed m/s (default 1.25, +-15 % per figure) */
  speed?: number;
  /** walkers go both ways (default true) */
  twoWay?: boolean;
  ground?: (x: number, z: number) => number;
  /** stand / cheer figures look at this (default the lens) */
  face?: V3;
  tints?: string[];
  /** colour the far figures fade to (default the mood's fog colour) and over which distances (default [15, 90] m, up to 55 %) */
  haze?: string;
  fade?: [number, number];
  /** figure heights (m) */
  height?: [number, number];
  /** share of figures with a hat (default 0.75) and the hat kinds to draw from */
  hats?: number;
  hatKinds?: HatKind[];
  keepOut?: { p: V3; r: number }[];
  protect?: V3[];
  clips?: Partial<CrowdClips>;
};

const BONES = ["Hips", "Neck", "LeftArm", "LeftForeArm", "LeftHandMiddle1", "RightArm", "RightForeArm", "RightHandMiddle1", "LeftUpLeg", "LeftLeg", "LeftFoot", "RightUpLeg", "RightLeg", "RightFoot"] as const;
const Y = new THREE.Vector3(0, 1, 0);
const G = {
  limb: new THREE.CylinderGeometry(1, 1, 1, 6, 1, true),
  torso: new THREE.CapsuleGeometry(1, 1, 3, 8),
  head: new THREE.SphereGeometry(1, 12, 8),
  crown: new THREE.CylinderGeometry(1, 1, 1, 10),
  brim: new THREE.CylinderGeometry(1, 1, 1, 14),
};
const MAT = new THREE.MeshBasicMaterial({ color: "#ffffff", fog: true });
const HATS: Record<Exclude<HatKind, "none">, { cr: number; ch: number; br: number; bh: number }> = {
  // x figure height: crown radius / height, brim radius / thickness
  bowler: { cr: 0.085, ch: 0.07, br: 0.125, bh: 0.008 },
  top: { cr: 0.08, ch: 0.15, br: 0.125, bh: 0.008 },
  fez: { cr: 0.065, ch: 0.085, br: 0, bh: 0 },
  picture: { cr: 0.075, ch: 0.05, br: 0.21, bh: 0.008 },
  cap: { cr: 0.1, ch: 0.035, br: 0.12, bh: 0.006 },
};

/** bind-pose hip height of the crowd skeleton (scale 1) */
let hipBind = 0;
const crowdRig = (c: CrowdClips): Rig => {
  const r = rigFor(`__crowd:${c.walk}|${c.stand}|${c.cheer}`, [c.stand, c.walk, c.cheer]);
  if (!hipBind) {
    restPose(r);
    hipBind = r.bone("Hips").getWorldPosition(new THREE.Vector3()).y;
  }
  return r;
};

type Fig = { kind: "walk" | "stand" | "cheer"; x: number; z: number; yaw: number; H: number; tint: THREE.Color; hat: HatKind; tc: number; clip: string };

const pathAt = (path: V3[], s: number) => {
  const seg: number[] = [];
  let L = 0;
  for (let i = 1; i < path.length; i++) {
    const d = Math.hypot(path[i][0] - path[i - 1][0], path[i][2] - path[i - 1][2]);
    seg.push(d);
    L += d;
  }
  let u = ((s % L) + L) % L;
  for (let i = 0; i < seg.length; i++) {
    if (u <= seg[i] || i === seg.length - 1) {
      const a = path[i], b = path[i + 1], k = seg[i] > 0 ? u / seg[i] : 0;
      return { p: [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k] as V3, dir: Math.atan2(b[0] - a[0], b[2] - a[2]), L };
    }
    u -= seg[i];
  }
  return { p: path[0], dir: 0, L };
};

export const Crowd: React.FC<CrowdProps> = (p) => {
  const mood = useMood();
  const clips = { ...CROWD_CLIPS, ...(p.clips ?? {}) };
  const r = crowdRig(clips);
  const seed = p.seed ?? 1;
  const n = p.count;
  const H0 = p.height ?? [1.6, 1.82];
  const tints = (p.tints ?? ["#2a2433", "#3a2d45", "#33283a", "#45303a"]).map((c) => new THREE.Color(c));
  const haze = new THREE.Color(p.haze ?? ((mood as unknown as { fog?: { color: string } })?.fog?.color ?? "#c8d4e6"));
  const [fn, ff] = p.fade ?? [15, 90];
  const kinds = p.hatKinds ?? ["bowler", "bowler", "top", "fez", "picture", "picture", "cap"];
  const meshes = React.useMemo(() => {
    const mk = (g: THREE.BufferGeometry, cap: number) => {
      const m = new THREE.InstancedMesh(g, MAT, cap);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
      m.frustumCulled = false;
      m.castShadow = false;
      m.receiveShadow = false;
      return m;
    };
    return { limb: mk(G.limb, n * 8), torso: mk(G.torso, n), head: mk(G.head, n), crown: mk(G.crown, n), brim: mk(G.brim, n) };
  }, [n]);

  // ---- figures (deterministic placement)
  const mode = p.mode ?? "stand";
  const mix = typeof mode === "string" ? { [mode]: 1 } : mode;
  const tot = (mix.walk ?? 0) + (mix.stand ?? 0) + (mix.cheer ?? 0) || 1;
  const v0 = p.speed ?? 1.25;
  const cam = new THREE.Vector3(...p.cam);
  const vClip = clipSpeed(r, clips.walk); // m/s per clip second at scale 1
  const figs: Fig[] = [];
  for (let i = 0; i < n; i++) {
    const s = seed * 7919 + i * 13.37;
    const pick = h01(s) * tot;
    const kind: Fig["kind"] = pick < (mix.walk ?? 0) ? "walk" : pick < (mix.walk ?? 0) + (mix.stand ?? 0) ? "stand" : "cheer";
    const H = H0[0] + (H0[1] - H0[0]) * h01(s + 1);
    const sc = (0.43 * H) / hipBind;
    const dir = p.twoWay === false ? 1 : h01(s + 2) < 0.5 ? 1 : -1;
    const speed = v0 * (0.85 + 0.3 * h01(s + 3));
    let x = 0, z = 0, yaw = 0, y: number | null = null;
    if (p.spots && p.spots.length) {
      const q = p.spots[i % p.spots.length];
      x = q[0]; y = q[1]; z = q[2];
    } else if (p.path && p.path.length > 1) {
      const L = pathAt(p.path, 0).L;
      const s0 = h01(s + 4) * L + (kind === "walk" ? dir * speed * p.t : 0);
      const pa = pathAt(p.path, s0);
      const across = ((p.spread ?? 1.6) * (h01(s + 5) - 0.5));
      x = pa.p[0] + Math.cos(pa.dir) * across;
      z = pa.p[2] - Math.sin(pa.dir) * across;
      y = p.ground ? null : pa.p[1];
      yaw = pa.dir + (dir < 0 ? Math.PI : 0);
    } else if (p.area) {
      const [x0, z0] = p.area.min, [x1, z1] = p.area.max;
      const alongX = x1 - x0 >= z1 - z0;
      const L = alongX ? x1 - x0 : z1 - z0;
      let u = h01(s + 4) * L + (kind === "walk" ? dir * speed * p.t : 0);
      u = ((u % L) + L) % L;
      const w = h01(s + 5);
      x = alongX ? x0 + u : x0 + w * (x1 - x0);
      z = alongX ? z0 + w * (z1 - z0) : z0 + u;
      yaw = alongX ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : dir > 0 ? 0 : Math.PI;
    }
    // keep-out circles: pushed out radially (the crowd parts around the cast / a passing car)
    for (const k of p.keepOut ?? []) {
      const dx = x - k.p[0], dz = z - k.p[2], d = Math.hypot(dx, dz);
      if (d < k.r) {
        const a = d > 1e-4 ? Math.atan2(dz, dx) : h01(s + 9) * 6.283;
        x = k.p[0] + Math.cos(a) * k.r;
        z = k.p[2] + Math.sin(a) * k.r;
      }
    }
    if (kind !== "walk") {
      const f = p.face ?? p.cam;
      yaw = Math.atan2(f[0] - x, f[2] - z) + (h01(s + 6) - 0.5) * 0.9;
    }
    const gy = y ?? (p.ground ? p.ground(x, z) : 0);
    // protect: nobody between the lens and a hero face
    let hide = false;
    for (const hp of p.protect ?? []) {
      const P = new THREE.Vector3(...hp), F = new THREE.Vector3(x, gy + 0.6 * H, z);
      const seg = P.clone().sub(cam), L2 = seg.lengthSq();
      const k = THREE.MathUtils.clamp(F.clone().sub(cam).dot(seg) / L2, 0, 1);
      if (k < 1 && F.distanceTo(cam.clone().addScaledVector(seg, k)) < 0.7) hide = true;
    }
    if (hide) continue;
    const dist = cam.distanceTo(new THREE.Vector3(x, gy + H / 2, z));
    const tint = tints[Math.floor(h01(s + 7) * tints.length)].clone().lerp(haze, 0.55 * THREE.MathUtils.smoothstep(dist, fn, ff));
    const hat: HatKind = h01(s + 8) < (p.hats ?? 0.75) ? kinds[Math.floor(h01(s + 10) * kinds.length)] : "none";
    const clip = kind === "walk" ? clips.walk : kind === "cheer" ? clips.cheer : clips.stand;
    // clip time: walkers by distance walked (no foot slide), others by time with their own offset
    const tc = kind === "walk" ? (speed * p.t) / Math.max(1e-3, vClip * sc) + h01(s + 11) * 3 : p.t * (0.9 + 0.2 * h01(s + 12)) + h01(s + 11) * 5;
    figs.push({ kind, x, z: z, yaw, H, tint, hat, tc, clip });
    (figs[figs.length - 1] as Fig & { y: number }).y = gy;
  }

  // ---- pose + instances
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), T = new THREE.Vector3();
  let li = 0, fi = 0;
  const seg = (a: THREE.Vector3, b: THREE.Vector3, rad: number, c: THREE.Color) => {
    const d = b.clone().sub(a), L = d.length();
    if (L < 1e-5) return;
    Q.setFromUnitVectors(Y, d.divideScalar(L));
    M.compose(T.copy(a).add(b).multiplyScalar(0.5), Q, S.set(rad, L, rad));
    meshes.limb.setMatrixAt(li, M);
    meshes.limb.setColorAt(li++, c);
  };
  const tmp = new THREE.Vector3();
  for (const f of figs) {
    const gy = (f as Fig & { y: number }).y;
    const sc = (0.43 * f.H) / hipBind;
    r.root.position.set(0, 0, 0);
    r.root.rotation.set(0, 0, 0);
    r.root.scale.setScalar(1);
    evaluate(r, [{ clip: f.clip, from: 0, offset: f.tc, step: false }], 0);
    r.root.updateMatrixWorld(true);
    const c = Math.cos(f.yaw), s = Math.sin(f.yaw);
    const W: Record<string, THREE.Vector3> = {};
    for (const b of BONES) {
      r.bone(b).getWorldPosition(tmp);
      const lx = tmp.x * sc, ly = tmp.y * sc, lz = tmp.z * sc;
      W[b] = new THREE.Vector3(f.x + lx * c + lz * s, gy + ly, f.z - lx * s + lz * c);
    }
    const H = f.H;
    const ax = W.Neck.clone().sub(W.Hips).normalize();
    if (ax.y < 0.3) ax.lerp(Y, 0.5).normalize();
    const hip = W.Hips;
    const neck = hip.clone().addScaledVector(ax, 0.3 * H);
    const lat = W.RightArm.clone().sub(W.LeftArm);
    lat.addScaledVector(ax, -lat.dot(ax)).normalize();
    // torso: capsule from just below the hips to the neck
    const tr = 0.1 * H;
    const tc = hip.clone().addScaledVector(ax, 0.13 * H);
    Q.setFromUnitVectors(Y, ax);
    M.compose(tc, Q, S.set(tr, (0.32 * H - 2 * tr), tr));
    meshes.torso.setMatrixAt(fi, M);
    meshes.torso.setColorAt(fi, f.tint);
    // head: a slightly wide ellipsoid on top
    const hc = neck.clone().addScaledVector(ax, 0.11 * H);
    Q.setFromUnitVectors(Y, ax).multiply(new THREE.Quaternion().setFromAxisAngle(Y, f.yaw));
    M.compose(hc, Q, S.set(0.15 * H, 0.135 * H, 0.12 * H));
    meshes.head.setMatrixAt(fi, M);
    meshes.head.setColorAt(fi, f.tint);
    // hat
    const hk = f.hat !== "none" ? HATS[f.hat] : null;
    const top = hc.clone().addScaledVector(ax, 0.12 * H);
    if (hk) {
      M.compose(top.clone().addScaledVector(ax, 0.5 * hk.ch * H), Q, S.set(hk.cr * H, hk.ch * H, hk.cr * H));
      meshes.crown.setMatrixAt(fi, M);
      M.compose(top, Q, S.set(hk.br * H, Math.max(1e-4, hk.bh * H), hk.br * H));
      meshes.brim.setMatrixAt(fi, M);
    } else {
      M.makeScale(0, 0, 0);
      meshes.crown.setMatrixAt(fi, M);
      meshes.brim.setMatrixAt(fi, M);
    }
    meshes.crown.setColorAt(fi, f.tint);
    meshes.brim.setColorAt(fi, f.tint);
    fi++;
    // limbs: stick arms from the shoulders (short RC arms, the clip's directions), legs as the clip has them
    const lr = 0.016 * H;
    for (const [sd, sg] of [["Left", -1], ["Right", 1]] as const) {
      const sh = neck.clone().addScaledVector(ax, -0.05 * H).addScaledVector(lat, sg * 0.075 * H);
      const d1 = W[sd + "ForeArm"].clone().sub(W[sd + "Arm"]).normalize();
      const d2 = W[sd + "HandMiddle1"].clone().sub(W[sd + "ForeArm"]).normalize();
      const el = sh.clone().addScaledVector(d1, 0.14 * H);
      const hd = el.clone().addScaledVector(d2, 0.14 * H);
      seg(sh, el, lr, f.tint);
      seg(el, hd, lr, f.tint);
      const hp = hip.clone().addScaledVector(lat, sg * 0.045 * H);
      const kn = W[sd + "Leg"].clone().add(hp).sub(W[sd + "UpLeg"]);
      const ft = W[sd + "Foot"].clone().add(hp).sub(W[sd + "UpLeg"]);
      seg(hp, kn, lr * 1.1, f.tint);
      seg(kn, ft, lr * 1.1, f.tint);
    }
  }
  meshes.limb.count = li;
  for (const k of ["torso", "head", "crown", "brim"] as const) meshes[k].count = fi;
  for (const m of Object.values(meshes)) {
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }
  return (
    <group>
      <primitive object={meshes.limb} />
      <primitive object={meshes.torso} />
      <primitive object={meshes.head} />
      <primitive object={meshes.crown} />
      <primitive object={meshes.brim} />
    </group>
  );
};
