// Image-based light from a Poly Haven sky HDRI (tested in _t_upgrade 2026-11-20; template default since 2026-11-21, switch UP().hdri).
// The engine's materials are MeshToonMaterial (sets, car, props: no envMap support) and unlit MeshBasicMaterial (the
// 3D toon figures), so the HDRI is used the way both can read it, as 2nd-order spherical harmonics (9 coefficients):
//   - lit toon materials: a THREE.LightProbe REPLACES the mood's hemisphere light (same energy at the zenith, the
//     HDRI's colour and direction instead of a 2-colour gradient). Baked sets keep their lightmap: materials.ts already
//     scales every ambient term (hemi or probe) by uHemiKeep x AO on lightmapped surfaces, so nothing is lit twice.
//   - unlit 3D toon figures (char3d/toon.tsx projMat / flatMat): a gentle IBL tint, irradiance(normal) divided by the
//     irradiance of a level normal, mixed in by IBL.amt (the front of a face stays ~1, tops pick up the sky, undersides
//     the ground bounce) - the flat RC look survives, the volume reads.
// The sun disc and the brightest clouds are clamped out of the projection (the set's key light is the sun), the HDRI is
// turned so its sun azimuth matches the set's key, and the lower hemisphere is replaced by the mood's ground colour.
import { staticFile } from "remotion";
import * as THREE from "three";
import { HDRLoader } from "three/examples/jsm/loaders/HDRLoader.js";
import type { V3 } from "../engine/types";
import { got, has } from "./assets";
import type { Need } from "./assets";

export const ENV_FILE = "env/sky_1k.hdr";
type Env = { W: number; H: number; lum: Float32Array; rgb: Float32Array; sunAz: number; cap: number };
const key = (f: string) => `env:${f}`;

export const needEnv = (file = ENV_FILE): Need => [
  key(file),
  async () => {
    const L = new HDRLoader();
    L.setDataType(THREE.FloatType);
    const tex = await L.loadAsync(staticFile(file));
    const img = tex.image as { data: Float32Array; width: number; height: number };
    const { width: W, height: H, data } = img;
    const rgb = new Float32Array(W * H * 3), lum = new Float32Array(W * H);
    let best = -1, bi = 0;
    for (let i = 0; i < W * H; i++) {
      const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
      rgb[i * 3] = r; rgb[i * 3 + 1] = g; rgb[i * 3 + 2] = b;
      lum[i] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      if (lum[i] > best) { best = lum[i]; bi = i; }
    }
    // sun azimuth (three's equirect convention: u = atan(z, x) / 2pi + 0.5)
    const sunAz = (((bi % W) + 0.5) / W - 0.5) * 2 * Math.PI;
    // cap = 3 x the median of the upper hemisphere (removes the sun disc + its glare, keeps the sky gradient)
    const up: number[] = [];
    for (let y = 0; y < H / 2; y += 2) for (let x = 0; x < W; x += 4) up.push(lum[y * W + x]);
    up.sort((a, b) => a - b);
    const cap = 3 * up[Math.floor(up.length / 2)];
    tex.dispose();
    return { W, H, lum, rgb, sunAz, cap } as Env;
  },
];
export const envReady = (file = ENV_FILE) => has(key(file));

const shCache = new Map<string, { sh: THREE.SphericalHarmonics3; level: THREE.Vector3; up: THREE.Vector3 }>();
/** radiance SH of the HDRI turned to the key light's azimuth, ground = `ground` (linear) at 0.6 x the sky's mean */
export const envSH = (keyDir: V3, ground: THREE.Color, file = ENV_FILE) => {
  const k = `${file}|${keyDir.map((v) => v.toFixed(3))}|${ground.getHexString()}`;
  let e = shCache.get(k);
  if (e) return e;
  const env = got<Env>(key(file));
  const { W, H, rgb, lum, cap } = env;
  const rot = Math.atan2(keyDir[2], keyDir[0]) - env.sunAz;
  const sh = new THREE.SphericalHarmonics3();
  const basis: number[] = new Array(9).fill(0);
  const d = new THREE.Vector3(), c = new THREE.Color();
  // mean sky radiance (capped) for the ground level
  let skyMean = 0, skyW = 0;
  for (let y = 0; y < H / 2; y += 2) {
    const el = (0.5 - (y + 0.5) / H) * Math.PI, w = Math.cos(el);
    for (let x = 0; x < W; x += 2) { skyMean += Math.min(lum[y * W + x], cap) * w; skyW += w; }
  }
  skyMean /= skyW;
  const gl = 0.2126 * ground.r + 0.7152 * ground.g + 0.0722 * ground.b;
  const g = ground.clone().multiplyScalar((0.6 * skyMean) / Math.max(1e-4, gl));
  let wsum = 0;
  const S = 2; // every 2nd pixel each way (1k map -> 128k samples)
  for (let y = 0; y < H; y += S) {
    const el = (0.5 - (y + 0.5) / H) * Math.PI, ce = Math.cos(el), se = Math.sin(el);
    const dw = ((2 * Math.PI) / W) * (Math.PI / H) * ce * S * S;
    for (let x = 0; x < W; x += S) {
      const th = (((x + 0.5) / W) - 0.5) * 2 * Math.PI + rot;
      d.set(ce * Math.cos(th), se, ce * Math.sin(th));
      const i = y * W + x;
      if (el < 0) c.copy(g);
      else { const s = lum[i] > cap ? cap / lum[i] : 1; c.setRGB(rgb[i * 3] * s, rgb[i * 3 + 1] * s, rgb[i * 3 + 2] * s); }
      THREE.SphericalHarmonics3.getBasisAt(d, basis as unknown as number[]);
      for (let j = 0; j < 9; j++) {
        sh.coefficients[j].x += c.r * basis[j] * dw;
        sh.coefficients[j].y += c.g * basis[j] * dw;
        sh.coefficients[j].z += c.b * basis[j] * dw;
      }
      wsum += dw;
    }
  }
  sh.scale((4 * Math.PI) / wsum);
  const up = sh.getIrradianceAt(new THREE.Vector3(0, 1, 0), new THREE.Vector3());
  // the average irradiance of level normals (8 directions): the figure tint's neutral point
  const level = new THREE.Vector3();
  for (let a = 0; a < 8; a++) level.add(sh.getIrradianceAt(new THREE.Vector3(Math.cos(a * 0.785), 0, Math.sin(a * 0.785)), new THREE.Vector3()));
  level.multiplyScalar(1 / 8);
  e = { sh, level, up: up as unknown as THREE.Vector3 };
  shCache.set(k, e);
  return e;
};

/** the HDRI's light in the MOOD's colours: every SH channel scaled so the zenith irradiance equals `sky` (the mood's
 *  hemisphere sky colour x intensity, linear). Keeps the HDRI's direction (sun side, horizon, darker ground) and the
 *  mood's hue: used for every mood except the plain day preset (night stays ultramarine, lamp warm, golden gold). */
export const envInMood = (e: ReturnType<typeof envSH>, sky: THREE.Color) => {
  const k = new THREE.Vector3(sky.r / Math.max(1e-5, e.up.x), sky.g / Math.max(1e-5, e.up.y), sky.b / Math.max(1e-5, e.up.z));
  const sh = e.sh.clone();
  sh.coefficients.forEach((v) => v.multiply(k));
  return { sh, level: e.level.clone().multiply(k), up: e.up.clone().multiply(k) };
};

/** shared uniforms of the unlit 3D toon figures' IBL tint (amt 0 = off = the old flat look) */
export const IBL = {
  uIblSH: { value: Array.from({ length: 9 }, () => new THREE.Vector3()) },
  uIblLevel: { value: new THREE.Vector3(1, 1, 1) },
  uIblAmt: { value: 0 },
};
/** GLSL: the IBL tint factor for a world normal (three's shGetIrradianceAt constants) */
export const IBL_GLSL = /* glsl */ `
uniform vec3 uIblSH[9];
uniform vec3 uIblLevel;
uniform float uIblAmt;
vec3 iblIrr(vec3 n) {
  float x = n.x, y = n.y, z = n.z;
  vec3 r = uIblSH[0] * 0.886227;
  r += uIblSH[1] * 2.0 * 0.511664 * y;
  r += uIblSH[2] * 2.0 * 0.511664 * z;
  r += uIblSH[3] * 2.0 * 0.511664 * x;
  r += uIblSH[4] * 2.0 * 0.429043 * x * y;
  r += uIblSH[5] * 2.0 * 0.429043 * y * z;
  r += uIblSH[6] * (0.743125 * z * z - 0.247708);
  r += uIblSH[7] * 2.0 * 0.429043 * x * z;
  r += uIblSH[8] * 0.429043 * (x * x - y * y);
  return r;
}
vec3 iblTint(vec3 n) {
  if (uIblAmt <= 0.0) return vec3(1.0);
  vec3 k = clamp(iblIrr(normalize(n)) / max(uIblLevel, vec3(1e-4)), vec3(0.55), vec3(1.25));
  return mix(vec3(1.0), k, uIblAmt);
}
`;
/** set the figure tint uniforms from an envSH result (amt 0 = off) */
export const setIblTint = (e: ReturnType<typeof envSH> | null, amt: number) => {
  IBL.uIblAmt.value = e ? amt : 0;
  if (!e) return;
  e.sh.coefficients.forEach((v, j) => IBL.uIblSH.value[j].copy(v));
  IBL.uIblLevel.value.copy(e.level);
};
