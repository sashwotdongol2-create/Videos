// ACTION EFFECTS measured on the Zack D. Films reference "The Assassination That Started World War I"
// (D:\resource\reference\pIZUyyun3eg, frame strips in fx_study/). Each one is rebuilt for the stickman look: procedural,
// deterministic (pure functions of t + seeds, randomness only from h01), no simulation caches, cheap in WebGL.
//
//   Explosion     grenade / bomb: flash + light, white-hot fireball that boils to red then black (palette "red" = the
//                 reference's crimson look, "fire" = orange), flame spikes, ember glow inside the cloud, rising smoke
//                 column, shock dust ring, debris + sparks, ground glow, scorch mark. ~3.5 s on screen.
//   GunShot       muzzle flash (2 frames) + light + gun smoke puff + a few sparks; recoil(t, t0) for the hand / prop.
//   BloodHit      pink-red mist puff at the impact + droplets that fall (the reference's hit read, no gore).
//   Wound         a stain that spreads on a body (billboard decal); `censor` swaps it for the reference's red
//                 pixel mosaic (CensorMosaic on its own works anywhere).
//   SlowBullet    the golden slow-motion bullet that flies past the lens: spinning toon bullet, air ripple rings,
//                 speed streaks. bulletAt() gives its position for the camera to follow.
//   Grenade       toon pineapple grenade mesh; throwArc() = the throw (ballistic arc) + bounces + roll on the ground.
//   shake()       decaying camera shake (trauma model) for blasts and shots; rackFocus() for the focus pulls.
//   MiniBlast     cartoon map explosion (toon puff cluster that pops and shrinks), ShellArc (a shell flying an arc
//                 with a smoke trail), WavingFlag (cloth flag on a pole) - the map finale.
// Rules: particles never sit on faces (place blasts beside / behind bodies); keep glow sprites <= 160 px (SoftPoints
// clamps); flicker < 12 Hz; every effect returns null outside its own life so idle shots cost nothing.
import { useThree } from "@react-three/fiber";
import React from "react";
import * as THREE from "three";
import { burst, h01 } from "../engine/core/physics";
import type { Cam } from "../engine/core/rig";
import { toonMaterial } from "../engine/mat/materials";
import type { V3 } from "../engine/types";
import { Debris, DensePuffs, Dust, SoftPoints } from "./fx";
import { Flag } from "./flags";
import type { FlagId } from "./flags";
import type { SP } from "./fx";
import { SHOT_JOINTS, ShotCtx } from "./registry";
import { useCurrentFrame } from "remotion";

/** a drawn joint of a Stickman in THIS shot at THIS frame (render the effect AFTER that <Stickman/>), e.g.
 *  useJoint("hero", "RightHandMiddle1") for a muzzle, "Neck" / "Hips" for a chest hit. null before it is drawn. */
export const useJoint = (who: string, bone: string): V3 | null => {
  const shot = React.useContext(ShotCtx);
  const frame = useCurrentFrame();
  const e = SHOT_JOINTS.get(`${who}#${shot}`);
  return e && e.frame === frame && e.J[bone] ? e.J[bone] : null;
};

const NO_INK = { outline: false };
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (a: number, b: number, v: number) => {
  const x = clamp01((v - a) / (b - a));
  return x * x * (3 - 2 * x);
};
type C3 = [number, number, number];
const mix3 = (a: C3, b: C3, k: number): C3 => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
/** colour ramp over stops [[u, colour], ...] (u ascending) */
const ramp = (stops: [number, C3][], u: number): C3 => {
  if (u <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    if (u <= stops[i][0]) return mix3(stops[i - 1][1], stops[i][1], (u - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]));
  }
  return stops[stops.length - 1][1];
};

const texs = new Map<string, THREE.CanvasTexture>();
const canvasTex = (key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, nearest = false) => {
  let t = texs.get(key);
  if (!t) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    draw(c.getContext("2d")!, w, h);
    t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    if (nearest) {
      t.magFilter = THREE.NearestFilter;
      t.minFilter = THREE.NearestFilter;
      t.generateMipmaps = false;
    }
    texs.set(key, t);
  }
  return t;
};
const geos = new Map<string, THREE.BufferGeometry>();
const geoOf = (key: string, make: () => THREE.BufferGeometry) => {
  let g = geos.get(key);
  if (!g) {
    g = make();
    geos.set(key, g);
  }
  return g;
};
const mats = new Map<string, THREE.Material>();
const matOf = (key: string, make: () => THREE.Material) => {
  let m = mats.get(key);
  if (!m) {
    m = make();
    mats.set(key, m);
  }
  return m;
};
/** a radial gradient disc texture (white, alpha from the stops) */
const radialTex = (key: string, stops: [number, number][]) =>
  canvasTex(`rad|${key}`, 128, 128, (g, W) => {
    const gr = g.createRadialGradient(W / 2, W / 2, 0, W / 2, W / 2, W / 2);
    for (const [o, a] of stops) gr.addColorStop(o, `rgba(255,255,255,${a})`);
    g.fillStyle = gr;
    g.fillRect(0, 0, W, W);
  });
/** an irregular blotch (scorch / stain): overlapping blobs, deterministic in seed */
const blotchTex = (key: string, seed: number, splats: boolean) =>
  canvasTex(`blot|${key}|${seed}`, 256, 256, (g, W) => {
    let s = 1 + seed * 7919;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    g.clearRect(0, 0, W, W);
    for (let i = 0; i < 22; i++) {
      const a = r() * Math.PI * 2, d = r() * 0.2 * W, rr = (0.1 + r() * 0.14) * W;
      const x = W / 2 + Math.cos(a) * d, y = W / 2 + Math.sin(a) * d;
      const gr = g.createRadialGradient(x, y, 0, x, y, rr);
      gr.addColorStop(0, "rgba(255,255,255,0.9)");
      gr.addColorStop(0.7, "rgba(255,255,255,0.55)");
      gr.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = gr;
      g.fillRect(0, 0, W, W);
    }
    if (splats) {
      g.fillStyle = "rgba(255,255,255,0.95)";
      for (let i = 0; i < 16; i++) {
        const a = r() * Math.PI * 2, d = (0.3 + r() * 0.17) * W, rr = (0.008 + r() * 0.025) * W;
        g.beginPath();
        g.arc(W / 2 + Math.cos(a) * d, W / 2 + Math.sin(a) * d, rr, 0, Math.PI * 2);
        g.fill();
      }
    }
  });

/** decal material: texture alpha x uOp, colour uColor (a ShaderMaterial like the SoftPoints sprites: the plain
 *  MeshBasicMaterial path drew these decals as solid squares in this engine) */
const DECAL_VERT = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const DECAL_FRAG = /* glsl */ `uniform sampler2D uMap; uniform vec3 uColor; uniform float uOp; uniform float uTint; varying vec2 vUv;
void main() { vec4 tx = texture2D(uMap, vUv); float a = tx.a * uOp; if (a < 0.004) discard;
  gl_FragColor = vec4(mix(uColor, tx.rgb, uTint), a); }`;
const decalMat = (key: string, tex: THREE.Texture, additive = false, tint = 0) =>
  matOf(`decal|${key}`, () => new THREE.ShaderMaterial({
    vertexShader: DECAL_VERT, fragmentShader: DECAL_FRAG, transparent: true, depthWrite: false, toneMapped: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -4,
    uniforms: { uMap: { value: tex }, uColor: { value: new THREE.Color("#ffffff") }, uOp: { value: 1 }, uTint: { value: tint } },
  })) as THREE.ShaderMaterial;

/** a flat disc on the ground (y up), additive (glow) or alpha (scorch) */
const GroundDisc: React.FC<{ p: V3; r: number; color: string; op: number; tex: THREE.Texture; additive?: boolean; rot?: number; k: string }> = ({ p, r, color, op, tex, additive = false, rot = 0, k }) => {
  if (op <= 0.003) return null;
  const m = decalMat(`disc|${k}`, tex, additive);
  (m.uniforms.uColor.value as THREE.Color).set(color);
  m.uniforms.uOp.value = op;
  return <mesh geometry={geoOf("disc", () => new THREE.PlaneGeometry(1, 1))} material={m} position={[p[0], p[1] + 0.012, p[2]]} rotation={[-Math.PI / 2, 0, rot]} scale={[r * 2, r * 2, 1]} renderOrder={6} userData={NO_INK} />;
};

/** a camera-facing quad (decals that must face the lens: wounds, mosaics) */
const Billboard: React.FC<{ p: V3; w: number; h: number; mat: THREE.Material; order?: number; roll?: number }> = ({ p, w, h, mat, order = 8, roll = 0 }) => {
  const { camera } = useThree();
  const q = camera.quaternion.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), roll));
  return <mesh geometry={geoOf("bb", () => new THREE.PlaneGeometry(1, 1))} material={mat} position={p} quaternion={q} scale={[w, h, 1]} renderOrder={order} userData={NO_INK} />;
};

// =================================================================== EXPLOSION
export type BlastPalette = "red" | "fire";
const PAL: Record<BlastPalette, { hot: C3; mid: C3; dark: C3; soot: C3; light: string; glow: string; ember: C3 }> = {
  // the reference: everything crimson (white-hot core -> hot pink-red -> blood red -> near-black with red embers)
  red: { hot: [1, 0.93, 0.92], mid: [1, 0.32, 0.34], dark: [0.42, 0.03, 0.04], soot: [0.035, 0.008, 0.01], light: "#ff3a3a", glow: "#ff2a2a", ember: [1, 0.12, 0.1] },
  // a natural fireball: white -> yellow-orange -> rust -> grey-black
  fire: { hot: [1, 0.97, 0.85], mid: [1, 0.55, 0.16], dark: [0.38, 0.14, 0.05], soot: [0.12, 0.11, 0.1], light: "#ff9a40", glow: "#ff7a20", ember: [1, 0.42, 0.08] },
};
/** seconds the explosion stays on screen (for shot planning) */
export const BLAST_LIFE = 4.2;

/**
 * Explosion at ground point p, set off at t0. k = size (1 = hand grenade: fireball ~2.4 m wide, flame spikes ~3 m
 * tall); light = point-light gain (0 = none). Timeline (age a = t - t0, measured on the reference at 30 fps):
 *   0.00-0.10 flash (frame-wide bloom, ground lit) | 0.03-0.6 flame spikes shoot up | 0.0-0.45 fireball white-hot,
 *   swelling | 0.45-1.3 boils to red | 1.3-3.2 dark cloud with red embers inside, rising | 2.5-4.2 smoke fades.
 */
export const Explosion: React.FC<{ t: number; t0: number; p: V3; k?: number; palette?: BlastPalette; seed?: number; light?: number; debris?: string | null; scorch?: boolean }> = ({ t, t0, p, k = 1, palette = "red", seed = 1, light = 1, debris = "#2b2623", scorch = true }) => {
  const a = t - t0;
  if (a < 0) return null;
  const P = PAL[palette];
  const ground = p[1];
  const fire: SP[] = [];
  const glow: SP[] = [];
  const smoke: SP[] = [];
  const embers: SP[] = [];
  // ---- fireball: OPAQUE puffs ("dense": a translucent puff turned into pink haze on a bright day street, 2026-11-20)
  // thrown out on a hemisphere, stopped hard by drag, then buoyant. White-hot puffs are HDR (> 1) so they bloom.
  const N = 64;
  const hot: C3 = [P.hot[0] * 2.6, P.hot[1] * 2.4, P.hot[2] * 2.35];
  const mid: C3 = [P.mid[0] * 1.5, P.mid[1] * 0.75, P.mid[2] * 0.75];
  for (let i = 0; i < N; i++) {
    const s = seed * 1000 + i * 3.7;
    const th = h01(s) * Math.PI * 2;
    const el = 0.12 + 1.25 * Math.sqrt(h01(s + 1)); // elevation 0.12 .. ~1.37 rad (mostly up and out)
    const sp = k * (3.5 + 5 * h01(s + 2));
    const kd = 6.5, f = (1 - Math.exp(-kd * a)) / kd;
    const lift = k * (0.12 * a * a + 0.12 * a) * (0.6 + 0.8 * h01(s + 3)); // the cloud boils in place, rising slowly (reference: it stays on the street)
    const x = p[0] + Math.cos(th) * Math.cos(el) * sp * f + 0.12 * k * Math.sin(a * 1.7 + s);
    const y = Math.max(ground + 0.3 * k, ground + 0.3 * k + Math.sin(el) * sp * f * 1.2 + lift);
    const z = p[2] + Math.sin(th) * Math.cos(el) * sp * f + 0.12 * k * Math.cos(a * 1.3 + s);
    // per-puff phase so the cloud does not change colour all at once (outer puffs cool first)
    const out = Math.min(1, sp / (8.5 * k));
    const u = a / (0.75 + 0.45 * h01(s + 4)) + 0.15 * out;
    // reference timing: white 0-0.3 s, hot red by 0.5 s, blood red 0.8 s, near-black with embers from ~1.3 s
    const c = ramp([[0, hot], [0.3, hot], [0.55, mid], [0.85, P.dark], [1.25, P.soot]], u);
    const life = BLAST_LIFE * (0.85 + 0.15 * h01(s + 5));
    const shrink = 1 - smooth(life * 0.55, life, a); // the old cloud thins by shrinking, not by turning translucent
    const size = k * (0.75 + 0.75 * h01(s + 6)) * (0.3 + 1.0 * Math.pow(Math.min(a, 2.5) / 2.5, 0.3)) * (1 + 0.06 * a) * (0.35 + 0.65 * shrink);
    fire.push({ p: [x, y, z], size, a: a > 0.01 && a < life * 0.97 ? 1 : 0, c, rot: h01(s + 7) * 6 + a * (h01(s + 8) - 0.5) * 0.8 });
    // ---- embers glowing in the dark cloud (the reference: bright red glints all through the black smoke)
    if (a > 0.55) {
      const e = smooth(0.6, 1.0, a) * (1 - smooth(2.6, 3.8, a));
      for (let m = 0; m < 2; m++) {
        const sm = s + 11 * (m + 1);
        const fl = 0.35 + 0.65 * Math.sin(a * (5 + 4 * h01(sm)) + sm * 3);
        const off = size * 0.55;
        // on the front of the opaque puff (lens shift), so the glints sit in the smoke and still hide behind people / tags
        embers.push({ p: [x + (h01(sm + 1) - 0.5) * off, y + (h01(sm + 2) - 0.5) * off, z + (h01(sm + 3) - 0.5) * off], lens: 0.5 * size, size: size * (0.05 + 0.07 * h01(sm + 4)), a: e * Math.max(0, fl), c: [P.ember[0] * 2.4, P.ember[1] * 2.4, P.ember[2] * 2.4] });
      }
    }
  }
  // ---- flame spikes (0.03-0.6 s): chains of glow points that shoot up and out, tips cooler
  if (a < 0.75) {
    const J = 22;
    for (let j = 0; j < J; j++) {
      const s = seed * 2000 + j * 5.3;
      const th = h01(s) * Math.PI * 2, tilt = 0.08 + 0.55 * h01(s + 1);
      const L = k * (1.8 + 1.8 * h01(s + 2));
      const grow = smooth(0.03, 0.22, a), fade = 1 - smooth(0.3, 0.72, a);
      const dir: V3 = [Math.cos(th) * Math.sin(tilt), Math.cos(tilt), Math.sin(th) * Math.sin(tilt)];
      const M = 9;
      for (let m = 0; m < M; m++) {
        const q = (m + 1) / M;
        const d = L * grow * q;
        const c = ramp([[0, P.hot], [0.55, P.hot], [1, P.mid]], q);
        glow.push({ p: [p[0] + dir[0] * d, ground + 0.2 * k + dir[1] * d, p[2] + dir[2] * d], size: k * 0.42 * (1 - 0.65 * q), a: 0.9 * fade * (1 - 0.4 * q), c });
      }
    }
  }
  // ---- flash + core glow
  const flash = Math.exp(-a * 14);
  if (a < 0.35) glow.push({ p: [p[0], ground + 0.6 * k, p[2]], size: k * (1.6 + 2.4 * flash), a: 0.9 * flash, c: P.hot });
  // ---- smoke column: dark puffs emitted from the cloud top, rising and spreading (0.4 s on)
  const rate = 16, t1 = 2.4;
  const i1 = Math.floor(Math.min(a - 0.4, t1) * rate);
  for (let i = 0; i <= i1; i++) {
    const te = 0.4 + i / rate;
    const age = a - te;
    if (age < 0) continue;
    const life = 2.6;
    if (age > life) continue;
    const s = seed * 3000 + i * 2.9;
    const u = age / life;
    const x = p[0] + (h01(s) - 0.5) * 1.2 * k + (h01(s + 1) - 0.5) * 0.8 * age * k + 0.15 * age;
    const y = ground + k * (1.4 + 0.5 * te + 0.55 * age);
    const z = p[2] + (h01(s + 2) - 0.5) * 1.2 * k;
    const g = 0.6 + 0.4 * h01(s + 3);
    smoke.push({ p: [x, y, z], size: k * (0.9 + 1.3 * Math.sqrt(age)) * (1 - 0.85 * smooth(0.55, 1, u)), a: age > 0.03 && u < 0.97 ? 1 : 0, c: mix3(P.dark, P.soot, clamp01(0.4 + u)).map((v) => v * g) as C3, rot: h01(s + 4) * 6 });
  }
  const L = light > 0 ? light * k * (60 * flash + 9 * smooth(0, 0.1, a) * (1 - smooth(0.4, 2.6, a)) * (0.85 + 0.15 * Math.sin(a * 11 + seed))) : 0;
  const gOp = 0.95 * flash + 0.55 * (1 - smooth(0.3, 2.8, a));
  return (
    <group>
      {/* ground lit red under the blast + the scorch that stays */}
      <GroundDisc k={`glow${palette}`} p={p} r={k * (2.6 + 1.2 * flash)} color={P.glow} op={gOp} tex={radialTex("soft", [[0, 1], [0.35, 0.55], [1, 0]])} additive />
      {scorch ? <GroundDisc k="scorch" p={[p[0], ground - 0.004, p[2]]} r={k * 1.1} color="#140d0b" op={0.85 * smooth(0.1, 0.5, a)} tex={radialTex("scorch", [[0, 1], [0.5, 0.8], [1, 0]])} rot={seed} /> : null}
      <DensePuffs pts={smoke} order={7} />
      <DensePuffs pts={fire} order={8} />
      <SoftPoints pts={glow} kind="glow" additive order={9} />
      <SoftPoints pts={embers} kind="glow" additive order={10} />
      <Dust t={t} t0={t0} p={p} k={1.6 * k} seed={seed + 11} color={[0.7, 0.66, 0.62]} n={26} />
      {debris ? <Debris t={t} t0={t0} p={[p[0], ground + 0.1, p[2]]} n={Math.round(26 * Math.min(2, k))} seed={seed + 5} color={debris} k={2.4 * k} ground={ground} cone={1.1} /> : null}
      <BlastSparks t={t} t0={t0} p={[p[0], ground + 0.3 * k, p[2]]} k={k} seed={seed} />
      {L > 0.05 ? <pointLight position={[p[0], ground + 1.0 * k, p[2]]} color={P.light} intensity={L} distance={14 * k} decay={2} /> : null}
    </group>
  );
};
/** hot sparks thrown out by a blast (one burst, gravity, they die in ~1 s) */
const BlastSparks: React.FC<{ t: number; t0: number; p: V3; k: number; seed: number }> = ({ t, t0, p, k, seed }) => {
  const ps = burst(t, t0, p, { n: 40, seed: seed + 77, s0: 6 * k, s1: 14 * k, cone: 1.25, drag: 1.6, gk: 1, life: [0.4, 1.1], size: [0.03 * k, 0.06 * k], gy: p[1] - 0.3 * k });
  return <SoftPoints pts={ps.map((q) => ({ p: q.p, size: q.size * (1 - 0.5 * (q.age / q.life)), a: 1 - q.age / q.life, c: [1, 0.8, 0.5] as C3 }))} kind="glow" additive order={12} />;
};

// =================================================================== GUN SHOT
/** recoil of a fired gun: 0 -> 1 in ~2 frames, springs back with a little overshoot in ~0.35 s. Multiply by the kick
 *  you want (e.g. wrist pitch 0.35 rad, hand back 0.05 m). Sum it over several shots. */
export const recoil = (t: number, t0: number) => {
  const a = t - t0;
  if (a < 0) return 0;
  const up = clamp01(a / 0.05);
  return up * Math.exp(-a * 9) * Math.cos(a * 14);
};
/**
 * A pistol / rifle shot from muzzle point `p` along `dir` (unit). Flash 2 frames (star + flame tongue + light),
 * smoke puff drifting forward and up for ~1.3 s, a few sparks. k = size (1 = pistol, 1.8 = rifle).
 */
export const GunShot: React.FC<{ t: number; t0: number; p: V3; dir: V3; k?: number; seed?: number; light?: number }> = ({ t, t0, p, dir, k = 1, seed = 1, light = 1 }) => {
  const a = t - t0;
  if (a < 0 || a > 1.6) return null;
  const glow: SP[] = [];
  const smoke: SP[] = [];
  const fl = a < 0.075 ? 1 - a / 0.075 : 0; // ~2 frames
  if (fl > 0) {
    glow.push({ p, size: 0.16 * k, a: fl, c: [1, 0.95, 0.8] });
    for (let m = 1; m <= 5; m++) {
      const d = 0.035 * m * k * (0.8 + 0.4 * h01(seed + m));
      glow.push({ p: [p[0] + dir[0] * d, p[1] + dir[1] * d, p[2] + dir[2] * d], size: 0.09 * k * (1 - m / 7), a: fl * 0.9, c: [1, 0.72, 0.3] });
    }
  }
  for (let i = 0; i < 9; i++) {
    const s = seed * 500 + i;
    const age = a - 0.01 * i;
    if (age < 0) continue;
    const kd = 5, f = (1 - Math.exp(-kd * age)) / kd, sp = (1.4 + 1.4 * h01(s)) * k;
    const x = p[0] + dir[0] * sp * f + (h01(s + 1) - 0.5) * 0.12 * k;
    const y = p[1] + dir[1] * sp * f + 0.12 * age + (h01(s + 2) - 0.5) * 0.08 * k;
    const z = p[2] + dir[2] * sp * f + (h01(s + 3) - 0.5) * 0.12 * k;
    const u = clamp01(age / 1.3);
    smoke.push({ p: [x, y, z], size: k * (0.05 + 0.32 * Math.sqrt(u)), a: 0.55 * (1 - u) * (1 - u) * Math.min(1, age * 25), c: [0.86, 0.85, 0.84], rot: h01(s + 4) * 6 });
  }
  const sparks = burst(t, t0, p, { n: 8, seed: seed + 9, s0: 3 * k, s1: 6 * k, cone: 0.35, dir, drag: 2, gk: 0.6, life: [0.08, 0.22], size: [0.012, 0.02] });
  sparks.forEach((q) => glow.push({ p: q.p, size: q.size, a: 1 - q.age / q.life, c: [1, 0.8, 0.45] }));
  return (
    <group>
      <SoftPoints pts={smoke} kind="smoke" order={8} />
      <SoftPoints pts={glow} kind="glow" additive order={12} />
      {fl > 0 && light > 0 ? <pointLight position={p} color="#ffc070" intensity={light * 6 * fl} distance={5} decay={2} /> : null}
    </group>
  );
};

// =================================================================== BLOOD + CENSOR
/** the hit: a pink-red mist puff at p + droplets that fall. ~0.8 s. dir = where the mist sprays: aim it at the lens
 *  side (back toward the shooter), never into the body, or the body hides it. */
export const BloodHit: React.FC<{ t: number; t0: number; p: V3; dir?: V3; k?: number; seed?: number }> = ({ t, t0, p, dir = [0, 0, -1], k = 1, seed = 1 }) => {
  const a = t - t0;
  if (a < 0 || a > 1.4) return null;
  const mist: SP[] = [];
  for (let i = 0; i < 10; i++) {
    const s = seed * 300 + i;
    const kd = 6, f = (1 - Math.exp(-kd * a)) / kd, sp = (0.6 + 0.9 * h01(s)) * k;
    const th = h01(s + 1) * Math.PI * 2;
    const x = p[0] + dir[0] * sp * f + Math.cos(th) * 0.35 * k * f;
    const y = p[1] + dir[1] * sp * f + Math.sin(th) * 0.35 * k * f;
    const z = p[2] + dir[2] * sp * f;
    const u = clamp01(a / 0.75);
    mist.push({ p: [x, y, z], size: k * (0.1 + 0.42 * Math.sqrt(u)), a: 0.85 * (1 - u) * Math.min(1, a * 40), c: [1, 0.55, 0.58], rot: h01(s + 2) * 6 });
  }
  const drops = burst(t, t0, p, { n: 16, seed: seed + 31, s0: 1.2 * k, s1: 3 * k, cone: 0.7, dir, drag: 1.2, gk: 1, life: [0.5, 1.2], size: [0.012 * k, 0.026 * k], gy: p[1] - 1.2 });
  const dp: SP[] = drops.map((q) => ({ p: q.p, size: q.size, a: 0.95 * (1 - q.age / q.life), c: [0.55, 0.04, 0.05] as C3 }));
  return (
    <group>
      <SoftPoints pts={mist} kind="smoke" order={9} />
      <SoftPoints pts={dp} kind="glow" order={10} />
    </group>
  );
};

/** a mosaic of red / dark-red / skin squares (the reference's censor block), facing the lens. n squares across. */
export const CensorMosaic: React.FC<{ p: V3; size: number; n?: number; seed?: number; op?: number; t?: number; hz?: number }> = ({ p, size, n = 7, seed = 1, op = 1, t = 0, hz = 0 }) => {
  const frame = hz > 0 ? Math.floor(t * hz) % 3 : 0; // optional slow re-shuffle (<= 4 Hz, never strobing)
  const tex = canvasTex(`mosaic|${n}|${seed}|${frame}`, n, n, (g) => {
    const pal = ["#7a0b10", "#a3121a", "#c42a2e", "#5b070b", "#d9726a", "#8f1d1f", "#e0a090"];
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        const cx = (x + 0.5) / n - 0.5, cy = (y + 0.5) / n - 0.5;
        const r = Math.hypot(cx, cy) * 2;
        const v = h01(seed * 97 + x * 13 + y * 71 + frame * 5);
        if (r > 0.95 + 0.25 * v) continue; // ragged round outline
        g.fillStyle = pal[Math.floor(v * (r > 0.6 ? pal.length : 4))];
        g.fillRect(x, y, 1, 1);
      }
  }, true);
  const m = decalMat(`mosaic|${n}|${seed}|${frame}`, tex, false, 1);
  m.uniforms.uOp.value = op;
  return <Billboard p={p} w={size} h={size} mat={m} order={11} />;
};

/**
 * A wound stain spreading on a body from t0 (billboard just in front of the body at p, so place p on the torso
 * surface toward the lens). Grows over `grow` s to `size`. censor = draw the CensorMosaic over it (the reference).
 */
export const Wound: React.FC<{ t: number; t0: number; p: V3; size?: number; grow?: number; seed?: number; censor?: boolean }> = ({ t, t0, p, size = 0.16, grow = 1.2, seed = 1, censor = true }) => {
  const a = t - t0;
  if (a < 0) return null;
  const g = 0.35 + 0.65 * (1 - Math.exp(-3 * a / grow));
  const m = decalMat(`wound|${seed}`, blotchTex("wound", seed, true));
  (m.uniforms.uColor.value as THREE.Color).set("#8a0a10");
  return (
    <group>
      <Billboard p={p} w={size * g} h={size * g * 1.15} mat={m} order={10} roll={h01(seed) * 6} />
      {censor ? <CensorMosaic p={p} size={size * 0.55 * Math.min(1, g * 1.3)} seed={seed} n={6} /> : null}
    </group>
  );
};

// =================================================================== SLOW-MOTION BULLET
/** position of a bullet flying from -> to over [t0, t0 + dur] (eased slightly so it enters and leaves the frame fast
 *  while it crosses the subject slowly: ease = 0 linear, 0.6 strong slow-mo in the middle) */
export const bulletAt = (t: number, t0: number, dur: number, from: V3, to: V3, ease = 0.45): V3 => {
  const u = clamp01((t - t0) / dur);
  // speed 1 + ease*cos(2 pi u): fast at both ends, slowest mid-way (monotonic while ease < 1)
  const v = clamp01(u + (ease * Math.sin(2 * Math.PI * u)) / (2 * Math.PI));
  return [from[0] + (to[0] - from[0]) * v, from[1] + (to[1] - from[1]) * v, from[2] + (to[2] - from[2]) * v];
};
/**
 * The golden slow-mo bullet (reference opening: a huge brass round drifting past the Archduke's face). Toon brass
 * round, length 0.06 m x scale k (k 1 = a real 9 mm round; the reference uses ~k 3-4 so it reads), spinning on its
 * axis, with expanding air ripples left behind and a few speed streaks. Inked like the props.
 */
export const SlowBullet: React.FC<{ t: number; t0: number; dur: number; from: V3; to: V3; k?: number; ease?: number; spin?: number; ripples?: boolean }> = ({ t, t0, dur, from, to, k = 3, ease = 0.45, spin = 6, ripples = true }) => {
  if (t < t0 || t > t0 + dur + 0.8) return null;
  const pos = bulletAt(t, t0, dur, from, to, ease);
  const d = new THREE.Vector3(to[0] - from[0], to[1] - from[1], to[2] - from[2]).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
  const roll = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (t - t0) * spin);
  q.multiply(roll);
  const brass = toonMaterial({ color: "#d6a63a", emissive: "#3a2600", emissiveIntensity: 0.4 });
  const lead = toonMaterial({ color: "#b98a2e" });
  const L = 0.06 * k, R = 0.0095 * k * 1.6;
  const inFlight = t <= t0 + dur;
  const rings: React.ReactNode[] = [];
  const streak: SP[] = [];
  if (ripples) {
    const every = 0.09;
    const n = Math.floor((Math.min(t, t0 + dur) - t0) / every);
    for (let i = Math.max(0, n - 10); i <= n; i++) {
      const te = t0 + i * every;
      const age = t - te;
      if (age < 0 || age > 0.8) continue;
      const pe = bulletAt(te, t0, dur, from, to, ease);
      const u = age / 0.8;
      const rm = matOf(`ring|${i % 12}`, () => new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, depthWrite: false, side: THREE.DoubleSide })) as THREE.MeshBasicMaterial;
      rm.opacity = 0.16 * (1 - u) * (1 - u);
      const rq = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), d);
      rings.push(<mesh key={i} geometry={geoOf("ring", () => new THREE.TorusGeometry(1, 0.06, 6, 40))} material={rm} position={pe} quaternion={rq} scale={[R * (1.3 + 3.2 * Math.sqrt(u)), R * (1.3 + 3.2 * Math.sqrt(u)), R * 2]} renderOrder={9} userData={NO_INK} />);
    }
    for (let m = 0; m < 14; m++) {
      const s = m * 7.7;
      const back = L * (0.6 + 2.4 * (m / 14));
      const off = R * 1.6 * (h01(s) - 0.5);
      const off2 = R * 1.6 * (h01(s + 1) - 0.5);
      if (!inFlight) continue;
      streak.push({ p: [pos[0] - d.x * back + off, pos[1] - d.y * back + off2, pos[2] - d.z * back + off * 0.5], size: R * 0.9, a: 0.35 * (1 - m / 14), c: [1, 0.96, 0.85] });
    }
  }
  return (
    <group>
      {inFlight ? (
        <group position={pos} quaternion={q}>
          {/* case body, rim, ogive nose */}
          <mesh geometry={geoOf("bCase", () => new THREE.CylinderGeometry(1, 1, 1, 28))} material={brass} scale={[R, L * 0.55, R]} position={[0, -L * 0.2, 0]} />
          <mesh geometry={geoOf("bRim", () => new THREE.CylinderGeometry(1, 1, 1, 28))} material={lead} scale={[R * 1.05, L * 0.05, R * 1.05]} position={[0, -L * 0.48, 0]} />
          <mesh geometry={geoOf("bNose", () => new THREE.SphereGeometry(1, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2))} material={brass} scale={[R * 0.98, L * 0.45, R * 0.98]} position={[0, L * 0.075, 0]} />
        </group>
      ) : null}
      {rings}
      <SoftPoints pts={streak} kind="glow" additive order={10} />
    </group>
  );
};

// =================================================================== GRENADE + THROW
/** toon pineapple grenade (green body with grooves, lever, ring), radius r. Origin = centre. */
export const Grenade: React.FC<{ p: V3; rot?: V3; r?: number; color?: string }> = ({ p, rot = [0, 0, 0], r = 0.045, color = "#4f7f2e" }) => {
  const body = toonMaterial({ color });
  const dark = toonMaterial({ color: "#2e4a1c" });
  const metal = toonMaterial({ color: "#8a8f94" });
  return (
    <group position={p} rotation={rot}>
      <mesh geometry={geoOf("gBody", () => new THREE.SphereGeometry(1, 24, 18))} material={body} scale={[r, r * 1.18, r]} castShadow />
      {[0, 1, 2, 3].map((i) => (
        <mesh key={`h${i}`} geometry={geoOf("gHoop", () => new THREE.TorusGeometry(1, 0.06, 6, 32))} material={dark} position={[0, r * (-0.6 + 0.4 * i), 0]} rotation={[Math.PI / 2, 0, 0]} scale={[r * Math.sqrt(1 - (-0.6 + 0.4 * i) ** 2 / 1.39) * 1.01, r * Math.sqrt(1 - (-0.6 + 0.4 * i) ** 2 / 1.39) * 1.01, r]} />
      ))}
      {[0, 1, 2, 3].map((i) => (
        <mesh key={`v${i}`} geometry={geoOf("gHoop", () => new THREE.TorusGeometry(1, 0.06, 6, 32))} material={dark} rotation={[0, (i * Math.PI) / 4, 0]} scale={[r * 1.01, r * 1.19, r]} />
      ))}
      <mesh geometry={geoOf("gTop", () => new THREE.CylinderGeometry(1, 1, 1, 14))} material={metal} position={[0, r * 1.25, 0]} scale={[r * 0.32, r * 0.3, r * 0.32]} />
      <mesh geometry={geoOf("gLever", () => new THREE.BoxGeometry(1, 1, 1))} material={metal} position={[r * 0.38, r * 0.7, 0]} rotation={[0, 0, -0.25]} scale={[r * 0.14, r * 1.2, r * 0.3]} />
      <mesh geometry={geoOf("gRing", () => new THREE.TorusGeometry(1, 0.12, 6, 20))} material={metal} position={[-r * 0.36, r * 1.3, 0]} rotation={[0, Math.PI / 2, 0]} scale={[r * 0.3, r * 0.3, r * 0.3]} />
    </group>
  );
};
/**
 * A thrown object: ballistic arc from -> land (apex `h` m above the higher end) over `fly` s from t0, then bounces
 * (restitution e) and rolls on along the throw direction until `rest` s after landing. Returns position, a tumbling
 * rotation and the impact times (for dust / sound / a bounce off a car: chain two throwArc calls).
 */
export const throwArc = (t: number, t0: number, from: V3, land: V3, o: { fly?: number; h?: number; e?: number; roll?: number; r?: number } = {}) => {
  const fly = o.fly ?? 0.8, h = o.h ?? 1.2, e = o.e ?? 0.35, rollD = o.roll ?? 0.6, r = o.r ?? 0.05;
  const a = Math.max(0, t - t0);
  const dx = land[0] - from[0], dz = land[2] - from[2];
  const hl = Math.hypot(dx, dz) || 1;
  const ux = dx / hl, uz = dz / hl;
  const impacts: number[] = [t0 + fly];
  if (a <= fly) {
    const u = a / fly;
    const top = Math.max(from[1], land[1]) + h;
    // quadratic through from (u=0), top (peak), land (u=1): y = A u^2 + B u + C
    const y0 = from[1], y1 = land[1];
    const m = Math.sqrt(top - y0) / (Math.sqrt(top - y0) + Math.sqrt(top - y1)); // peak position in u
    const y = u < m ? top - (top - y0) * ((m - u) / m) ** 2 : top - (top - y1) * ((u - m) / (1 - m)) ** 2;
    return { p: [from[0] + dx * u, y + r * 0, from[2] + dz * u] as V3, rot: [a * 11, a * 4, a * 7] as V3, landed: false, impacts };
  }
  // after landing: decaying hops along the throw direction
  let tt = a - fly, vy = (2 * (Math.max(from[1], land[1]) + h - land[1]) * 9.81) ** 0.5 * e, x = 0, tb = 0;
  let y = 0;
  const vx = (hl / fly) * 0.45;
  for (let i = 0; i < 6 && vy > 0.25; i++) {
    const T = (2 * vy) / 9.81;
    if (tt < T) {
      y = vy * tt - 0.5 * 9.81 * tt * tt;
      x += vx * Math.exp(-tb * 1.5) * tt;
      tt = -1;
      break;
    }
    x += vx * Math.exp(-tb * 1.5) * T;
    tb += T;
    tt -= T;
    impacts.push(t0 + fly + tb);
    vy *= e;
  }
  if (tt >= 0) x += rollD * (1 - Math.exp(-tt * 3)) * Math.min(1, vx);
  const ang = (x / r) * 0.5;
  return { p: [land[0] + ux * x, land[1] + r + Math.max(0, y), land[2] + uz * x] as V3, rot: [ang, 0, 0] as V3, landed: tt >= 0, impacts };
};

// =================================================================== CAMERA
/** decaying camera shake from hits {t0, amp (m of jolt; 0.06 = gunshot near, 0.25 = blast near), dur}. Smooth
 *  multi-sine noise (no frame-to-frame jitter; the motion-blur sub-frames turn it into a real smear). */
export const shake = (cam: Cam, t: number, hits: { t0: number; amp: number; dur?: number }[], seed = 3): Cam => {
  let tr = 0;
  for (const h of hits) {
    const a = t - h.t0;
    if (a < 0) continue;
    tr += h.amp * Math.exp((-a * 4.2) / (h.dur ?? 0.8)) * clamp01(a / 0.03);
  }
  if (tr < 1e-4) return cam;
  const n = (f: number, s: number) => Math.sin(t * f + s) * 0.6 + Math.sin(t * f * 1.73 + s * 2.1) * 0.4;
  const o: V3 = [tr * n(31, seed), tr * n(27, seed + 1), tr * 0.5 * n(23, seed + 2)];
  return { ...cam, pos: [cam.pos[0] + o[0], cam.pos[1] + o[1], cam.pos[2] + o[2]], look: [cam.look[0] + o[0] * 0.6, cam.look[1] + o[1] * 0.6, cam.look[2] + o[2] * 0.6], roll: (cam.roll ?? 0) + tr * 0.35 * n(19, seed + 3) };
};
/** focus pull for <View focus>: from point A to point B between t0 and t1 (eased) */
export const rackFocus = (t: number, t0: number, t1: number, A: V3, B: V3): V3 => {
  const u = smooth(t0, t1, t);
  return [A[0] + (B[0] - A[0]) * u, A[1] + (B[1] - A[1]) * u, A[2] + (B[2] - A[2]) * u];
};

// =================================================================== MAP FINALE
/** cartoon blast for maps / far views: a cluster of inked toon puffs (white core, yellow, orange) that pops with
 *  overshoot, holds and shrinks away in `life` s. r = final radius (m). */
export const MiniBlast: React.FC<{ t: number; t0: number; p: V3; r?: number; life?: number; seed?: number }> = ({ t, t0, p, r = 0.25, life = 1.1, seed = 1 }) => {
  const a = t - t0;
  if (a < 0 || a > life) return null;
  const pop = a < 0.12 ? (a / 0.12) * 1.25 : 1.25 - 0.25 * smooth(0.12, 0.25, a);
  const shrink = 1 - smooth(life * 0.55, life, a);
  const s = r * pop * shrink;
  const cols = ["#fff6d8", "#ffd34a", "#ff9a2a", "#f06a1e"];
  return (
    <group position={p}>
      {Array.from({ length: 9 }, (_, i) => {
        const q = seed * 50 + i;
        const th = h01(q) * Math.PI * 2, d = i === 0 ? 0 : 0.55 + 0.35 * h01(q + 1);
        const rr = (i === 0 ? 0.75 : 0.42 + 0.25 * h01(q + 2)) * s;
        const col = cols[i === 0 ? 0 : 1 + Math.floor(h01(q + 3) * 3)];
        return <mesh key={i} geometry={geoOf("mbSph", () => new THREE.IcosahedronGeometry(1, 2))} material={toonMaterial({ color: col, emissive: col, emissiveIntensity: 0.35 })} position={[Math.cos(th) * d * s, (0.4 + 0.5 * h01(q + 4)) * d * s * 0.8 + s * 0.3, Math.sin(th) * d * s * 0.6]} scale={[rr, rr, rr]} />;
      })}
    </group>
  );
};
/** an artillery shell flying an arc from -> to over dur s (toon shell + grey smoke trail); impact at t0 + dur */
export const ShellArc: React.FC<{ t: number; t0: number; dur: number; from: V3; to: V3; h?: number; k?: number; seed?: number }> = ({ t, t0, dur, from, to, h = 1, k = 1, seed = 1 }) => {
  const a = t - t0;
  if (a < 0 || a > dur + 1.2) return null;
  const at = (u: number): V3 => [from[0] + (to[0] - from[0]) * u, from[1] + (to[1] - from[1]) * u + 4 * h * u * (1 - u), from[2] + (to[2] - from[2]) * u];
  const u = clamp01(a / dur);
  const p = at(u), p2 = at(Math.min(1, u + 0.01));
  const d = new THREE.Vector3(p2[0] - p[0], p2[1] - p[1], p2[2] - p[2]).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.lengthSq() > 0 ? d : new THREE.Vector3(0, 1, 0));
  const trail: SP[] = [];
  for (let i = 0; i < 24; i++) {
    const ue = u - i * 0.02;
    if (ue < 0) break;
    const age = a - ue * dur;
    const pe = at(ue);
    trail.push({ p: pe, size: k * (0.04 + 0.08 * Math.sqrt(age)), a: 0.55 * Math.max(0, 1 - age / 1.1), c: [0.8, 0.8, 0.8], rot: h01(seed + i) * 6 });
  }
  const shell = toonMaterial({ color: "#6b6f5a" });
  return (
    <group>
      {a <= dur ? (
        <group position={p} quaternion={q} scale={[k, k, k]}>
          <mesh geometry={geoOf("shBody", () => new THREE.CylinderGeometry(0.03, 0.03, 0.1, 14))} material={shell} />
          <mesh geometry={geoOf("shNose", () => new THREE.ConeGeometry(0.03, 0.06, 14))} material={shell} position={[0, 0.08, 0]} />
        </group>
      ) : null}
      <SoftPoints pts={trail} kind="smoke" order={8} />
    </group>
  );
};
/** a cloth flag on a pole (kept for old shots; the detailed cloth lives in world/flags.tsx <Flag/>): stripes from
 *  `colors` (top -> bottom, or vertical) or a period flag via `flag`. Origin = pole foot. */
export const WavingFlag: React.FC<{ t: number; p: V3; colors?: string[]; flag?: FlagId; vertical?: boolean; w?: number; h?: number; pole?: number; yaw?: number; wind?: number; seed?: number }> = ({ t, p, colors, flag, vertical = false, w, h = 0.4, pole, yaw = 0, wind = 1, seed = 1 }) => (
  <Flag t={t} p={p} flag={flag} colors={colors} vertical={vertical} w={w} h={h} pole={pole ?? 1.2} yaw={yaw} wind={wind} seed={seed} />
);
