// Effects ported from the blocky-shorts skill v1.2 (MIT, see engine/THIRD_PARTY_NOTICES.md), adapted to stickman-3d:
// all procedural, all deterministic (pure functions of t and fixed seeds), none of them inked (points are skipped by
// the ink pass, meshes carry userData.outline = false), solid debris uses the toon material so it matches the sets.
//   VolumeBeam  - a soft volumetric light shaft for one shot (set-wide shafts stay in the set: o["beam"] / post.shafts)
//   Motes       - dust motes floating in a light volume (LOOK.md: "no volumetric dust" was the gap)
//   SoftPoints  - one-draw-call camera-facing particles (smoke, dust, glows) with per-point size/alpha/colour/rotation
//   Dust        - a landing / launch / fall dust burst (closed-form physics, engine/core/physics.ts)
//   Debris      - small chips (stone, wood, soil): ballistic, they land and stay on the ground
//   RocketFire  - layered noise flames (white-hot core -> yellow -> orange -> red tips), flicker, heat light; points
//                 along local -y: wrap it in a group rotated [Math.PI, 0, 0] for a torch / campfire / burning roof
//   SmokeTrail  - smoke puffs emitted along a path (warm near the fire, grey and expanding later)
//   Sparks      - streaking sparks + slow embers from a nozzle (gunfire, a grinder, a forge, a burning beam)
//   Glints      - four-point star sparkles that twinkle and drift down
// Tears and sweat are drawn on the head layer instead: char3d/tears.tsx (<Stickman tears={[...]} sweat={[...]} />).
// Rules (blocky pitfalls round 3): every particle fades within 0.25-0.75 m of the lens, glow sprites <= 160 px; outer
// fire layers alpha-blended (additive washes out to white on a day sky); flicker < 12 Hz; check the shot sheet AND
// full frames for haze over faces; region strobing: tools/flicker.py.
import { useThree } from "@react-three/fiber";
import React from "react";
import * as THREE from "three";
import { burst, h01 } from "../engine/core/physics";
import { toonMaterial } from "../engine/mat/materials";
import type { V3 } from "../engine/types";

const geos = new Map<string, THREE.BufferGeometry>();
const geoOf = (key: string, make: () => THREE.BufferGeometry) => {
  let g = geos.get(key);
  if (!g) {
    if (geos.size > 200) geos.clear();
    g = make();
    geos.set(key, g);
  }
  return g;
};
const texs = new Map<string, THREE.CanvasTexture>();
const canvasTexture = (key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void) => {
  let t = texs.get(key);
  if (!t) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    draw(c.getContext("2d")!, w, h);
    t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    texs.set(key, t);
  }
  return t;
};
const NO_INK = { outline: false };

// ------------------------------------------------------------------ volumetric light
const BEAM_VERT = /* glsl */ `
varying vec3 vL; varying vec3 vN; varying vec3 vV; varying float vZ;
void main() {
  vL = position;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  vZ = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const BEAM_FRAG = /* glsl */ `
uniform vec3 uColor; uniform float uOp; uniform float uT; uniform float uLen;
varying vec3 vL; varying vec3 vN; varying vec3 vV; varying float vZ;
float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float noise(vec3 p) {
  vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
void main() {
  float along = clamp(0.5 - vL.y / uLen, 0.0, 1.0); // 0 at the source (top), 1 at the far end
  float edge = pow(abs(dot(normalize(vN), normalize(vV))), 1.6);
  float dens = 0.65 + 0.35 * noise(vL * 3.0 + vec3(0.0, -uT * 0.15, uT * 0.07));
  float a = uOp * edge * dens * pow(1.0 - along, 1.4) * smoothstep(0.0, 0.08, along) * smoothstep(0.35, 1.4, vZ);
  gl_FragColor = vec4(uColor * a, 1.0);
}`;
const beamMats = new Map<string, THREE.ShaderMaterial>();
/** a cone of light from p (apex) pointing along dir, length len, end radius r */
export const VolumeBeam: React.FC<{ p: V3; dir?: V3; len: number; r: number; r0?: number; color: string; op?: number; t: number }> = ({ p, dir = [0, -1, 0], len, r, r0 = 0.02, color, op = 0.5, t }) => {
  const key = `${color}|${op}|${len}`;
  let m = beamMats.get(key);
  if (!m) {
    m = new THREE.ShaderMaterial({
      vertexShader: BEAM_VERT, fragmentShader: BEAM_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uColor: { value: new THREE.Color(color) }, uOp: { value: op }, uT: { value: 0 }, uLen: { value: len } },
    });
    beamMats.set(key, m);
  }
  m.uniforms.uT.value = t;
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), new THREE.Vector3(...dir).normalize());
  const e = new THREE.Euler().setFromQuaternion(q);
  const d = new THREE.Vector3(...dir).normalize().multiplyScalar(len / 2);
  return (
    <mesh
      geometry={geoOf(`beam${r}|${r0}|${len}`, () => new THREE.CylinderGeometry(r0, r, len, 40, 8, true))}
      material={m}
      position={[p[0] + d.x, p[1] + d.y, p[2] + d.z]}
      rotation={[e.x, e.y, e.z]}
      renderOrder={8}
      userData={NO_INK}
    />
  );
};

// ------------------------------------------------------------------ soft points (one draw call per group)
const PT_VERT = /* glsl */ `
attribute float aSize; attribute float aAlpha; attribute vec3 aColor; attribute float aRot;
uniform float uScale; uniform float uMaxPx; uniform float uNear;
varying float vA; varying vec3 vC; varying float vR;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(aSize * uScale / max(0.05, -mv.z), 0.0, uMaxPx);
  vA = aAlpha * smoothstep(uNear, uNear * 3.0, -mv.z); vC = aColor; vR = aRot;
}`;
const PT_FRAG = /* glsl */ `
uniform sampler2D uMap;
varying float vA; varying vec3 vC; varying float vR;
void main() {
  vec2 p = gl_PointCoord - 0.5;
  float c = cos(vR), s = sin(vR);
  p = vec2(c * p.x - s * p.y, s * p.x + c * p.y) + 0.5;
  vec4 tx = texture2D(uMap, p);
  float a = tx.a * vA;
  if (a < 0.003) discard;
  gl_FragColor = vec4(vC * tx.rgb, a);
}`;
/** a soft round puff with a cauliflower edge (smoke / dust); additive glows use the same with a smooth falloff */
const puffTex = (kind: "smoke" | "glow" | "star" | "dense") =>
  canvasTexture(`puff|${kind}`, 128, 128, (g, W) => {
    g.clearRect(0, 0, W, W);
    if (kind === "glow") {
      const gr = g.createRadialGradient(W / 2, W / 2, 0, W / 2, W / 2, W / 2);
      gr.addColorStop(0, "rgba(255,255,255,1)");
      gr.addColorStop(0.25, "rgba(255,255,255,0.55)");
      gr.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = gr;
      g.fillRect(0, 0, W, W);
      return;
    }
    if (kind === "star") {
      g.fillStyle = "#ffffff";
      for (const [w, h] of [[0.06, 0.5], [0.5, 0.06]]) {
        const gr = g.createRadialGradient(W / 2, W / 2, 0, W / 2, W / 2, W / 2);
        gr.addColorStop(0, "rgba(255,255,255,1)");
        gr.addColorStop(1, "rgba(255,255,255,0)");
        g.fillStyle = gr;
        g.beginPath();
        g.ellipse(W / 2, W / 2, w * W, h * W, 0, 0, Math.PI * 2);
        g.fill();
      }
      const c = g.createRadialGradient(W / 2, W / 2, 0, W / 2, W / 2, W * 0.16);
      c.addColorStop(0, "rgba(255,255,255,1)");
      c.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = c;
      g.fillRect(0, 0, W, W);
      return;
    }
    if (kind === "dense") {
      // an OPAQUE cauliflower puff (fireball / thick smoke on a bright day: a translucent puff turned into pink haze):
      // solid blobs with a ~3 px soft rim, lit from the top (lighter) and shaded underneath, a dark rim line inside
      let q = 11;
      const rq = () => ((q = (q * 16807) % 2147483647) / 2147483647);
      const blobs: [number, number, number][] = [[W / 2, W / 2, 0.3 * W]];
      for (let i = 0; i < 12; i++) {
        const a = rq() * Math.PI * 2, d = (0.12 + rq() * 0.1) * W;
        blobs.push([W / 2 + Math.cos(a) * d, W / 2 + Math.sin(a) * d, (0.13 + rq() * 0.09) * W]);
      }
      for (const [x, y, rr] of blobs) {
        const gr = g.createRadialGradient(x, y, 0, x, y, rr);
        gr.addColorStop(0, "rgba(200,200,200,1)");
        gr.addColorStop(0.9, "rgba(200,200,200,1)");
        gr.addColorStop(1, "rgba(200,200,200,0)");
        g.fillStyle = gr;
        g.beginPath();
        g.arc(x, y, rr, 0, Math.PI * 2);
        g.fill();
      }
      // light from the top: each blob gets a highlight toward its upper side (source-atop keeps the alpha)
      g.globalCompositeOperation = "source-atop";
      for (const [x, y, rr] of blobs) {
        const gr = g.createRadialGradient(x - 0.25 * rr, y - 0.35 * rr, 0, x, y, rr);
        gr.addColorStop(0, "rgba(255,255,255,0.95)");
        gr.addColorStop(0.6, "rgba(235,235,235,0.5)");
        gr.addColorStop(1, "rgba(120,120,120,0)");
        g.fillStyle = gr;
        g.fillRect(0, 0, W, W);
      }
      const sh = g.createLinearGradient(0, W * 0.35, 0, W);
      sh.addColorStop(0, "rgba(60,60,60,0)");
      sh.addColorStop(1, "rgba(60,60,60,0.35)");
      g.fillStyle = sh;
      g.fillRect(0, 0, W, W);
      g.globalCompositeOperation = "source-over";
      return;
    }
    // smoke: many overlapping soft blobs (deterministic), shaded lighter on top
    let s = 7;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 26; i++) {
      const a = r() * Math.PI * 2, d = r() * 0.24 * W, rr = (0.1 + r() * 0.16) * W;
      const x = W / 2 + Math.cos(a) * d, y = W / 2 + Math.sin(a) * d;
      const gr = g.createRadialGradient(x, y, 0, x, y, rr);
      const l = Math.round(205 + 50 * (1 - y / W));
      gr.addColorStop(0, `rgba(${l},${l},${l},0.32)`);
      gr.addColorStop(1, `rgba(${l},${l},${l},0)`);
      g.fillStyle = gr;
      g.fillRect(0, 0, W, W);
    }
  });
/** lens: move the point this many metres toward the lens (sit glints on the front of an opaque puff) */
export type SP = { p: V3; size: number; a: number; c: [number, number, number]; rot?: number; lens?: number };
const ptMats = new Map<string, THREE.ShaderMaterial>();
/** noDepth: drawn over everything (embers glowing through an opaque smoke cloud) */
export const SoftPoints: React.FC<{ pts: SP[]; kind?: "smoke" | "glow" | "star" | "dense"; additive?: boolean; order?: number; noDepth?: boolean }> = ({ pts, kind = "smoke", additive = false, order = 9, noDepth = false }) => {
  const { gl, camera } = useThree();
  const key = `${kind}|${additive}|${noDepth}`;
  let m = ptMats.get(key);
  if (!m) {
    m = new THREE.ShaderMaterial({
      vertexShader: PT_VERT, fragmentShader: PT_FRAG, transparent: true, depthWrite: false, depthTest: !noDepth,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      // glows (motes, sparks, stars) fade within 0.25-0.75 m of the lens and stay <= 160 px; smoke within 0.4-1.2 m
      uniforms: { uMap: { value: puffTex(kind) }, uScale: { value: 1000 }, uMaxPx: { value: kind === "smoke" || kind === "dense" ? 900 : 160 }, uNear: { value: kind === "smoke" || kind === "dense" ? 0.4 : 0.25 } },
    });
    ptMats.set(key, m);
  }
  const hpx = gl.getDrawingBufferSize(new THREE.Vector2()).y;
  m.uniforms.uScale.value = hpx / (2 * Math.tan(((camera as THREE.PerspectiveCamera).fov * Math.PI) / 360));
  const geo = React.useMemo(() => new THREE.BufferGeometry(), []);
  const n = pts.length;
  // back to front (alpha-blended smoke needs it); additive does not care
  const order_ = additive ? pts : [...pts].sort((a, b) => camera.position.distanceToSquared(new THREE.Vector3(...b.p)) - camera.position.distanceToSquared(new THREE.Vector3(...a.p)));
  const P = new Float32Array(n * 3), S = new Float32Array(n), A = new Float32Array(n), C = new Float32Array(n * 3), R = new Float32Array(n);
  const cp = camera.position;
  order_.forEach((q, i) => {
    if (q.lens) {
      const dx = cp.x - q.p[0], dy = cp.y - q.p[1], dz = cp.z - q.p[2], dl = Math.hypot(dx, dy, dz) || 1;
      const k = Math.min(q.lens, dl * 0.5) / dl;
      P.set([q.p[0] + dx * k, q.p[1] + dy * k, q.p[2] + dz * k], i * 3);
    } else P.set(q.p, i * 3);
    S[i] = q.size;
    A[i] = q.a;
    C.set(q.c, i * 3);
    R[i] = q.rot ?? 0;
  });
  geo.setAttribute("position", new THREE.BufferAttribute(P, 3));
  geo.setAttribute("aSize", new THREE.BufferAttribute(S, 1));
  geo.setAttribute("aAlpha", new THREE.BufferAttribute(A, 1));
  geo.setAttribute("aColor", new THREE.BufferAttribute(C, 3));
  geo.setAttribute("aRot", new THREE.BufferAttribute(R, 1));
  geo.computeBoundingSphere();
  if (!n) return null;
  return <points geometry={geo} material={m} renderOrder={order} frustumCulled={false} userData={NO_INK} />;
};

/** OPAQUE billboard puffs (fireball, thick smoke) as real meshes: the cauliflower "dense" texture, alpha-tested (hard
 *  toon edge), depth-writing, per-puff colour (HDR > 1 blooms). Unlike SoftPoints (points are hidden from the post
 *  depth pass) they occlude the set in the depth / normal pass, so SSAO, light shafts and DOF see the cloud instead of
 *  printing the wall behind it onto the smoke (the s10 "pink haze", 2026-11-20). A puff's `a` < 0.5 hides it: thin a
 *  cloud by shrinking `size`. userData.outline "silent": no ink, no SSAO on it. */
const denseMat = () => {
  let m = ptMats.get("densemesh") as unknown as THREE.MeshBasicMaterial | undefined;
  if (!m) {
    m = new THREE.MeshBasicMaterial({ map: puffTex("dense"), vertexColors: true, alphaTest: 0.5, transparent: false, toneMapped: false, side: THREE.DoubleSide });
    ptMats.set("densemesh", m as unknown as THREE.ShaderMaterial);
  }
  return m;
};
const QUAD_UV = new Float32Array([0, 1, 1, 1, 0, 0, 1, 0]);
export const DensePuffs: React.FC<{ pts: SP[]; order?: number }> = ({ pts, order = 8 }) => {
  const { camera } = useThree();
  const pool = React.useMemo(() => [] as THREE.Mesh[], []);
  const mat = denseMat();
  const live = pts.filter((q) => q.a >= 0.5 && q.size > 1e-3);
  while (pool.length < live.length) {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-0.5, 0.5, 0, 0.5, 0.5, 0, -0.5, -0.5, 0, 0.5, -0.5, 0]), 3));
    g.setAttribute("uv", new THREE.BufferAttribute(QUAD_UV, 2));
    g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(12), 3));
    g.setIndex([0, 2, 1, 2, 3, 1]);
    const me = new THREE.Mesh(g, mat);
    me.userData.outline = "silent";
    me.frustumCulled = false;
    pool.push(me);
  }
  return (
    <group>
      {live.map((q, i) => {
        const me = pool[i];
        const col = me.geometry.attributes.color as THREE.BufferAttribute;
        for (let v = 0; v < 4; v++) col.setXYZ(v, q.c[0], q.c[1], q.c[2]);
        col.needsUpdate = true;
        const qt = camera.quaternion.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), q.rot ?? 0));
        return <primitive key={i} object={me} position={q.p} quaternion={qt} scale={[q.size, q.size, 1]} renderOrder={order} />;
      })}
    </group>
  );
};

/** dust motes drifting in a box (centre c, half sizes hs), lit by `color` */
export const Motes: React.FC<{ c: V3; hs: V3; n: number; t: number; color?: [number, number, number]; size?: number; seed?: number; a?: number }> = ({ c, hs, n, t, color = [1, 0.95, 0.8], size = 0.012, seed = 1, a = 0.7 }) => {
  const pts: SP[] = [];
  for (let i = 0; i < n; i++) {
    const s = seed * 100 + i;
    const x = c[0] + hs[0] * (2 * h01(s) - 1) + 0.05 * Math.sin(t * 0.3 + s);
    const y = c[1] + hs[1] * (2 * ((h01(s + 1) - t * 0.012 * (0.5 + h01(s + 4))) % 1 + 1) % 1 - 1);
    const z = c[2] + hs[2] * (2 * h01(s + 2) - 1) + 0.05 * Math.cos(t * 0.27 + s);
    const tw = 0.55 + 0.45 * Math.sin(t * (1 + 2 * h01(s + 3)) + s);
    pts.push({ p: [x, y, z], size: size * (0.6 + 0.8 * h01(s + 5)), a: a * tw, c: color });
  }
  return <SoftPoints pts={pts} kind="glow" additive />;
};

// ------------------------------------------------------------------ impacts
/** a dust burst at time t0 (a landing or a launch): a low ring of puffs that spread, rise a little and fade */
export const Dust: React.FC<{ t: number; t0: number; p: V3; k?: number; seed?: number; color?: [number, number, number]; n?: number }> = ({ t, t0, p, k = 1, seed = 1, color = [0.86, 0.78, 0.66], n = 18 }) => {
  const ps = burst(t, t0, p, { n, seed, s0: 1.2 * k, s1: 3.2 * k, cone: 1.35, drag: 3.2, gk: -0.04, life: [0.9, 1.8], r: 0.25 * k, size: [0.18 * k, 0.4 * k] });
  return (
    <SoftPoints
      pts={ps.map((q) => {
        const u = q.age / q.life;
        return { p: [q.p[0], Math.max(p[1] + 0.03, q.p[1]), q.p[2]], size: q.size * (0.6 + 1.6 * Math.sqrt(u)), a: 0.75 * (1 - u) * Math.min(1, q.age * 12), c: color, rot: h01(q.seed) * 6 };
      })}
    />
  );
};
/** chips / crumbs: little solid pieces thrown at t0; they fly, land and stay (spin stops on landing) */
export const Debris: React.FC<{ t: number; t0: number; p: V3; n: number; seed: number; color: string; k?: number; ground?: number; dir?: V3; cone?: number }> = ({ t, t0, p, n, seed, color, k = 1, ground = 0, dir, cone = 0.9 }) => {
  const ps = burst(t, t0, p, { n, seed, s0: 0.8 * k, s1: 2.4 * k, cone, dir, drag: 0.6, gk: 1, life: [30, 30], gy: ground, size: [0.012 * k, 0.03 * k] });
  const mat = toonMaterial({ color });
  return (
    <>
      {ps.map((q, i) => {
        const spin = q.grounded ? 0 : q.age;
        return (
          <mesh key={i} geometry={geoOf("chip", () => new THREE.DodecahedronGeometry(1, 0))} material={mat} position={[q.p[0], q.p[1] + q.size * 0.5, q.p[2]]} rotation={[h01(q.seed) * 6 + spin * 9, h01(q.seed + 1) * 6 + spin * 7, 0]} scale={[q.size, q.size * 0.7, q.size * 0.9]} castShadow />
        );
      })}
    </>
  );
};

// ------------------------------------------------------------------ fire
const FIRE_VERT = /* glsl */ `
varying vec2 vUv; varying vec3 vN; varying vec3 vV;
void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;
const FIRE_FRAG = /* glsl */ `
uniform float uT; uniform vec3 uC0; uniform vec3 uC1; uniform vec3 uC2; uniform float uI; uniform float uSeed;
varying vec2 vUv; varying vec3 vN; varying vec3 vV;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7)) + uSeed) * 43758.5453); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; } return s; }
void main() {
  // cone uv: x around, y from the tip (0) to the nozzle (1)
  float along = 1.0 - vUv.y; // 0 at the nozzle, 1 at the tip
  float n = fbm(vec2(vUv.x * 6.0, along * 3.0 - uT * 9.0));
  float body = smoothstep(0.0, 0.25, (1.0 - along) - 0.55 * n + 0.15);
  float edge = pow(abs(dot(normalize(vN), normalize(vV))), 0.8);
  vec3 c = mix(uC0, uC1, smoothstep(0.05, 0.45, along + 0.25 * n));
  c = mix(c, uC2, smoothstep(0.45, 0.95, along + 0.2 * n));
  // over a bright day sky an additive flame washes out to white: the outer layers blend by alpha (saturated
  // orange that reads on any background, HDR so bloom still glows), the core is added on top (white-hot)
  float a = clamp(body * mix(0.35, 1.0, edge), 0.0, 1.0);
  gl_FragColor = vec4(c * uI * (0.7 + 0.6 * edge), a * min(1.0, uI));
}`;
const fireMats = new Map<string, THREE.ShaderMaterial>();
const fireMat = (k: string, c0: string, c1: string, c2: string, seed: number, additive = false) => {
  let m = fireMats.get(k);
  if (!m) {
    m = new THREE.ShaderMaterial({
      vertexShader: FIRE_VERT, fragmentShader: FIRE_FRAG, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, side: THREE.DoubleSide,
      uniforms: { uT: { value: 0 }, uC0: { value: new THREE.Color(c0) }, uC1: { value: new THREE.Color(c1) }, uC2: { value: new THREE.Color(c2) }, uI: { value: 1 }, uSeed: { value: seed } },
    });
    fireMats.set(k, m);
  }
  return m;
};
/** flicker 0.8..1.2, smooth noise in t (no frame-to-frame strobing: < 12 Hz content) */
export const flicker = (t: number, seed = 0) => 1 + 0.1 * Math.sin(t * 23 + seed) * Math.sin(t * 7.3 + seed * 2) + 0.07 * Math.sin(t * 13.7 + seed * 3);
/** rocket fire pointing along local -y from the origin (the nozzle). len = flame length (m), w = nozzle radius */
export const RocketFire: React.FC<{ t: number; len: number; w: number; k?: number; light?: number; seed?: number }> = ({ t, len, w, k = 1, light = 1, seed = 0 }) => {
  if (k <= 0) return null;
  const f = flicker(t, seed);
  const L = len * k * f;
  const layers: [string, number, number, number, string, string, string][] = [
    // key, radius scale, length scale, intensity, core, mid, tip
    ["fireO", 1.3, 1.0, 1.6, "#ffb040", "#ff5a10", "#b01a05"],
    ["fireM", 0.85, 0.72, 2.2, "#ffe070", "#ff9a20", "#ff4a0a"],
    ["fireC", 0.42, 0.4, 1.6, "#e8f0ff", "#fff0b0", "#ffa030"],
  ];
  return (
    <group>
      {layers.map(([key, rs, ls, I, c0, c1, c2], i) => {
        const m = fireMat(key, c0, c1, c2, seed + i * 3.1, key === "fireC");
        m.uniforms.uT.value = t + i * 0.37;
        m.uniforms.uI.value = I * Math.min(1, k * 1.5);
        return (
          <mesh key={key} geometry={geoOf(`fireCone${key}`, () => new THREE.CylinderGeometry(1, 0.0, 1, 32, 12, true))} material={m} position={[0, -(L * ls) / 2, 0]} scale={[w * rs * (1 + 0.06 * Math.sin(t * 31 + i)), L * ls, w * rs]} renderOrder={10} userData={NO_INK} />
        );
      })}
      {/* the hot glow at the nozzle (bloom picks it up) */}
      <SoftPoints pts={[{ p: [0, -w * 0.6, 0], size: w * 6 * f, a: 0.7, c: [1, 0.7, 0.35] }, { p: [0, -L * 0.35, 0], size: w * 9 * f, a: 0.3, c: [1, 0.4, 0.1] }]} kind="glow" additive order={11} />
      {light > 0 ? <pointLight position={[0, -w * 3, 0]} color="#ff8a30" intensity={light * f * 4} distance={6 * Math.max(0.3, light)} decay={2} /> : null}
    </group>
  );
};

/** smoke puffs along an emitter path pos(te) (te = emission time), emitted every 1/rate s from t0, exhaust direction dir */
export const SmokeTrail: React.FC<{ t: number; t0: number; pos: (te: number) => V3; dir: V3; rate?: number; life?: number; k?: number; seed?: number; ground?: number }> = ({ t, t0, pos, dir, rate = 36, life = 2.6, k = 1, seed = 3, ground = 0 }) => {
  const pts: SP[] = [];
  const i0 = Math.max(0, Math.floor((t - life - t0) * rate)), i1 = Math.floor((t - t0) * rate);
  for (let i = i0; i <= i1; i++) {
    const te = t0 + i / rate;
    const age = t - te;
    if (age < 0 || age > life) continue;
    const s = seed * 1000 + i;
    const e = pos(te);
    // exhaust speed out of the nozzle, quickly slowed by drag, then a slow rise + a little wind
    const v = 6 * k, kd = 3.0, f = (1 - Math.exp(-kd * age)) / kd;
    let x = e[0] + dir[0] * v * f + (h01(s) - 0.5) * 0.9 * age * k + 0.25 * age;
    let y = e[1] + dir[1] * v * f + 0.35 * age * age + (h01(s + 1) - 0.5) * 0.4 * age;
    let z = e[2] + dir[2] * v * f + (h01(s + 2) - 0.5) * 0.9 * age * k;
    if (y < ground + 0.25 * k) {
      // it hits the ground: spreads sideways instead (a billowing ground cloud)
      const spread = (ground + 0.25 * k - y) * 1.2;
      const a = h01(s + 3) * Math.PI * 2;
      x += Math.cos(a) * spread;
      z += Math.sin(a) * spread;
      y = ground + 0.25 * k + 0.1 * age;
    }
    const u = age / life;
    const hot = Math.exp(-age * 9); // lit by the fire when young
    const grey = 0.36 + 0.2 * h01(s + 4);
    pts.push({
      p: [x, y, z],
      size: k * (0.35 + 2.2 * Math.pow(age, 0.6)),
      a: 0.8 * Math.min(1, age * 14) * (1 - u) * (1 - u),
      c: [grey + hot * 0.9, grey + hot * 0.45, grey + hot * 0.1],
      rot: h01(s + 5) * 6 + age * (h01(s + 6) - 0.5),
    });
  }
  return <SoftPoints pts={pts} kind="smoke" order={7} />;
};

/** sparks (fast streaks, gravity) + embers (slow, floating, flickering) from a moving nozzle */
export const Sparks: React.FC<{ t: number; t0: number; pos: (te: number) => V3; dir: V3; rate?: number; k?: number; seed?: number; ground?: number }> = ({ t, t0, pos, dir, rate = 40, k = 1, seed = 5, ground = 0 }) => {
  const pts: SP[] = [];
  const LIFE = 0.9;
  const i0 = Math.max(0, Math.floor((t - LIFE - t0) * rate)), i1 = Math.floor((t - t0) * rate);
  for (let i = i0; i <= i1; i++) {
    const te = t0 + i / rate;
    const age = t - te;
    if (age < 0) continue;
    const s = seed * 1000 + i;
    const ember = h01(s) < 0.4;
    const life = ember ? LIFE : 0.35 + 0.3 * h01(s + 1);
    if (age > life) continue;
    const e = pos(te);
    const sp = (ember ? 1.5 : 7) * k * (0.6 + 0.8 * h01(s + 2));
    const a = h01(s + 3) * Math.PI * 2, c = (ember ? 0.9 : 0.45) * Math.sqrt(h01(s + 4));
    const vx = dir[0] * Math.cos(c) + Math.cos(a) * Math.sin(c), vy = dir[1] * Math.cos(c), vz = dir[2] * Math.cos(c) + Math.sin(a) * Math.sin(c);
    const kd = ember ? 2.5 : 1.2, f = (1 - Math.exp(-kd * age)) / kd;
    const gk = ember ? -0.4 : 1.0;
    let y = e[1] + vy * sp * f - 9.81 * gk * (age / kd - f / kd);
    if (y < ground) y = ground + 0.01;
    const x = e[0] + vx * sp * f + (ember ? 0.2 * Math.sin(age * 9 + s) : 0), z = e[2] + vz * sp * f;
    const u = age / life;
    const tw = ember ? 0.6 + 0.4 * Math.sin(age * 30 + s) : 1;
    pts.push({ p: [x, y, z], size: (ember ? 0.035 : 0.05) * k * (1 - 0.5 * u), a: (1 - u) * tw, c: ember ? [1, 0.45, 0.12] : [1, 0.85, 0.5] });
  }
  return <SoftPoints pts={pts} kind="glow" additive order={12} />;
};

/** star sparkles around p (radius r): twinkle and drift down slowly */
export const Glints: React.FC<{ p: V3; t: number; r?: number; n?: number; seed?: number; color?: [number, number, number] }> = ({ p, t, r = 0.18, n = 14, seed = 9, color = [1, 0.95, 0.6] }) => {
  const pts: SP[] = [];
  for (let i = 0; i < n; i++) {
    const s = seed * 100 + i;
    const per = 1.1 + 0.6 * h01(s);
    const ph = ((t / per + h01(s + 1)) % 1);
    const a = h01(s + 2) * Math.PI * 2 + t * 0.6;
    const rr = r * (0.4 + 0.6 * h01(s + 3));
    pts.push({ p: [p[0] + Math.cos(a) * rr, p[1] + 0.06 + r * 0.6 * (h01(s + 4) - 0.5) - 0.08 * ph, p[2] + Math.sin(a) * rr * 0.5], size: 0.05 + 0.04 * h01(s + 5), a: Math.sin(Math.PI * ph), c: color, rot: h01(s + 6) * 0.8 });
  }
  return <SoftPoints pts={pts} kind="star" additive order={12} />;
};
