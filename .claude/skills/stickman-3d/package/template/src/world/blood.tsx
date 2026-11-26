// Cartoon blood (user request for the Sarajevo film, notes E): flat crimson #B3121E with a darker edge, no gore.
//   TorsoStain - drawn ON the 3D stickman's torso layer (clipped to the costume's own alpha), spreading from hit points;
//                used by <Stickman bleed={{ at, spots, spread, dur }} /> (char3d/Stickman.tsx)
//   BloodSplat - a decal on a surface (seat leather, inside of a door, running board) with satellite drops and drips
//                running "down" the surface; grows in over `grow` s and stays. `car={{ at, yaw }}` = p / normal / down
//                given in the vehicle's GLB frame (front = -Z), so the stain rides with the car.
// Both are small ShaderMaterials (a MeshBasicMaterial + canvas alpha map drew decals as solid squares in this engine,
// ACTION_FX.md), procedural (no textures), pure functions of t; hidden from the ink / depth pass (userData.outline false).
import React from "react";
import * as THREE from "three";
import type { V3 } from "../engine/types";

export const BLOOD = { fill: "#B3121E", edge: "#6E0710" };
const smooth = (a: number, b: number, x: number) => {
  const u = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return u * u * (3 - 2 * u);
};

const NOISE = /* glsl */ `
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
// a wobbly disc: distance field (negative inside) of a circle of radius r at c with a noisy rim
float blob(vec2 uv, vec2 c, float r, float seed) {
  vec2 d = uv - c; float a = atan(d.y, d.x);
  float wob = 0.18 * (vn(vec2(a * 1.6 + seed, seed)) - 0.5) + 0.1 * (vn(vec2(a * 4.0 - seed, seed * 2.0)) - 0.5);
  return length(d) - r * (1.0 + wob);
}`;

// ------------------------------------------------------------------ torso stain
const STAIN_FRAG = /* glsl */ `
uniform sampler2D uMap; uniform vec3 uSpots[4]; uniform int uN; uniform vec3 uFill; uniform vec3 uEdge; uniform vec3 uTint;
varying vec2 vUv;
${NOISE}
void main() {
  if (texture2D(uMap, vUv).a < 0.5) discard; // only on the drawn costume
  float d = 1e3;
  for (int i = 0; i < 4; i++) { if (i >= uN) break; d = min(d, blob(vUv, uSpots[i].xy, uSpots[i].z, float(i) * 3.7 + 1.3)); }
  if (d > 0.0) discard;
  float edge = smoothstep(-0.035, -0.012, d); // darker rim (soaking edge)
  gl_FragColor = vec4(mix(uFill, uEdge, edge) * uTint, 1.0);
}`;
const VERT = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const stainMats = new Map<number, THREE.ShaderMaterial>();
/** one material per torso texture (bounded) */
export const stainMat = (map: THREE.Texture, spots: [number, number, number][], tint: string) => {
  let m = stainMats.get(map.id);
  if (!m) {
    m = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: STAIN_FRAG, side: THREE.DoubleSide, toneMapped: false,
      polygonOffset: true, polygonOffsetFactor: -2,
      uniforms: { uMap: { value: map }, uSpots: { value: [0, 1, 2, 3].map(() => new THREE.Vector3()) }, uN: { value: 0 },
        uFill: { value: new THREE.Color(BLOOD.fill) }, uEdge: { value: new THREE.Color(BLOOD.edge) }, uTint: { value: new THREE.Color("#ffffff") } },
    });
    stainMats.set(map.id, m);
    while (stainMats.size > 48) stainMats.delete(stainMats.keys().next().value as number);
  }
  m.uniforms.uMap.value = map;
  (m.uniforms.uSpots.value as THREE.Vector3[]).forEach((v, i) => (spots[i] ? v.set(...spots[i]) : v.set(0, 0, 0)));
  m.uniforms.uN.value = Math.min(4, spots.length);
  (m.uniforms.uTint.value as THREE.Color).set(tint);
  return m;
};
/** the bleed spec of a <Stickman/>: hit `at` (shot s); spots = hit points in the torso drawing's uv (u 0..1 across,
 *  v 0 = hips .. 1 = neck; default one on the chest), each spreading to `spread` x 0.22 uv radius over `dur` s (eased,
 *  fast first). Several hits: several Bleed entries. */
export type Bleed = { at: number; spots?: [number, number][]; spread?: number; dur?: number };
/** stain discs [u, v, r] at shot time t */
export const stainSpots = (b: Bleed | Bleed[] | undefined, t: number): [number, number, number][] => {
  const out: [number, number, number][] = [];
  for (const x of b ? (Array.isArray(b) ? b : [b]) : []) {
    const u = (t - x.at) / (x.dur ?? 1.2);
    if (u <= 0) continue;
    const g = 1 - Math.pow(1 - Math.min(1, u), 2.2); // spreads fast, then slows (soaks)
    for (const s of x.spots ?? [[0.56, 0.58]]) out.push([s[0], s[1], 0.22 * (x.spread ?? 1.2) * (0.12 + 0.88 * g)]);
  }
  return out.slice(0, 4);
};

// ------------------------------------------------------------------ surface splat
const SPLAT_FRAG = /* glsl */ `
uniform float uG; uniform float uDrip; uniform float uSeed; uniform vec3 uFill; uniform vec3 uEdge; uniform vec3 uTint;
varying vec2 vUv;
${NOISE}
void main() {
  vec2 uv = vUv; // 0..1, +v = "up" on the surface, centre 0.5, 0.5
  float d = blob(uv, vec2(0.5, 0.62), 0.2 * uG, uSeed);
  // satellite drops thrown out around the main splat
  for (int i = 0; i < 7; i++) {
    float fi = float(i);
    float a = h21(vec2(uSeed, fi)) * 6.2832, rr = 0.24 + 0.16 * h21(vec2(fi, uSeed));
    vec2 c = vec2(0.5, 0.62) + vec2(cos(a), sin(a)) * rr * (0.4 + 0.6 * uG);
    d = min(d, length(uv - c) - (0.012 + 0.022 * h21(vec2(fi + 7.0, uSeed))) * smoothstep(0.1, 0.6, uG));
  }
  // drips running down from the splat's lower rim
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float x = 0.5 + (h21(vec2(fi * 3.1, uSeed)) - 0.5) * 0.26;
    float len = uDrip * (0.18 + 0.3 * h21(vec2(uSeed, fi * 5.0)));
    float top = 0.55, bot = top - len;
    float w = 0.014 + 0.008 * h21(vec2(fi, uSeed * 2.0));
    float inStreak = max(abs(uv.x - x) - w, max(uv.y - top, bot - uv.y));
    d = min(d, inStreak);
    d = min(d, length(uv - vec2(x, bot)) - w * 1.6); // the bead at the end
  }
  if (d > 0.0) discard;
  float edge = smoothstep(-0.02, -0.006, d);
  gl_FragColor = vec4(mix(uFill, uEdge, edge) * uTint, 1.0);
}`;
const splatGeo = new THREE.PlaneGeometry(1, 1);
const splatMats = new Map<string, THREE.ShaderMaterial>();

/** GLB-frame point / direction of a vehicle at {at, yaw} -> world (the <Vehicle/> GLB is turned by yaw + PI) */
export const carToWorld = (car: { at: V3; yaw: number }, p: V3, dir = false): V3 => {
  const a = car.yaw + Math.PI, c = Math.cos(a), s = Math.sin(a);
  const x = p[0] * c + p[2] * s, z = -p[0] * s + p[2] * c;
  return dir ? [x, p[1], z] : [car.at[0] + x, car.at[1] + p[1], car.at[2] + z];
};

/**
 * A blood splat decal on a surface: grows in over `grow` s from t0 (eased), drips lengthen over `dripT` s after it.
 * p = centre on the surface, normal = the surface normal (toward the viewer side), down = the surface's "down" for drips
 * (default world -Y projected onto the surface), size = width in m (the splat with its drops fills ~0.8 of it).
 * car = {at, yaw}: p / normal / down are GLB-frame values of that vehicle (front = -Z, the car's left = -X).
 */
export const BloodSplat: React.FC<{ t: number; t0: number; p: V3; normal: V3; down?: V3; size?: number; grow?: number; drips?: number; dripT?: number; seed?: number; car?: { at: V3; yaw: number }; tint?: string; name?: string }> =
  ({ t, t0, p, normal, down, size = 0.35, grow = 0.5, drips = 1, dripT = 1.6, seed = 1, car, tint = "#ffffff", name = "" }) => {
    const a = t - t0;
    if (a <= 0) return null;
    const P = car ? carToWorld(car, p) : p;
    const N = new THREE.Vector3(...(car ? carToWorld(car, normal, true) : normal)).normalize();
    let D = new THREE.Vector3(...(down ? (car ? carToWorld(car, down, true) : down) : [0, -1, 0]));
    D.addScaledVector(N, -D.dot(N));
    if (D.lengthSq() < 1e-6) D = new THREE.Vector3(0, 0, 1).cross(N);
    D.normalize();
    const up = D.clone().negate(); // plane +Y = up the surface
    const x = new THREE.Vector3().crossVectors(up, N).normalize();
    const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, up, N));
    const k = `${name}|${seed}|${p.join(",")}`;
    let m = splatMats.get(k);
    if (!m) {
      m = new THREE.ShaderMaterial({
        vertexShader: VERT, fragmentShader: SPLAT_FRAG, side: THREE.DoubleSide, toneMapped: false, transparent: false,
        polygonOffset: true, polygonOffsetFactor: -4,
        uniforms: { uG: { value: 0 }, uDrip: { value: 0 }, uSeed: { value: seed * 1.37 }, uFill: { value: new THREE.Color(BLOOD.fill) }, uEdge: { value: new THREE.Color(BLOOD.edge) }, uTint: { value: new THREE.Color(tint) } },
      });
      splatMats.set(k, m);
      while (splatMats.size > 64) splatMats.delete(splatMats.keys().next().value as string);
    }
    m.uniforms.uG.value = 1 - Math.pow(1 - smooth(0, grow, a), 2);
    m.uniforms.uDrip.value = drips * smooth(grow * 0.6, grow + dripT, a);
    (m.uniforms.uTint.value as THREE.Color).set(tint);
    const pos = new THREE.Vector3(...P).addScaledVector(N, 0.004);
    return <mesh geometry={splatGeo} material={m} position={pos} quaternion={q} scale={[size, size, 1]} renderOrder={5} userData={{ outline: false }} />;
  };
