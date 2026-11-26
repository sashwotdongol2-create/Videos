// NightSky: a REAL night sky behind night exteriors (WORLD2, round 2; user note 12: "hyper-realistic night sky from a
// Poly Haven HDRI, not flat blue"). Source: Poly Haven "Rogland Moonlit Night" (Greg Zaal, CC0), 8k HDR baked by
// tools/night_sky.py into public/env/night_sky.jpg (8192 x 2276, elevation +90 .. -10 deg, sRGB, the desert ground
// replaced by the sky just above the skyline). Moon (bright disc + halo), real stars + Milky Way, thin moonlit clouds.
//
// Use (night exteriors: tarmac night, nightsky, woods):
//   needs: [..., needSet(...), needNightSky()]
//   <View mood={nightReal(sunDir(set))} ... sky={false}>        // sky={false}: the painted LookSky is replaced
//     <NightSky />                                              // first child; moon follows the mood's key light
//     <primitive object={useSetScene(set)} /> ...
// Props: gain (brightness, 1 = calibrated with nightReal), moonAz (deg, override where the moon sits: three azimuth,
//   0 = +X, 90 = +Z), clouds (0..1 extra moonlit cloud veil, procedural, drifts with t), stars (boost of the real stars).
// Like the engine SkyDome it is drawn at infinity (no depth write, no fog, never inked), deterministic in t.
import { useThree } from "@react-three/fiber";
import React from "react";
import { staticFile } from "remotion";
import * as THREE from "three";
import { useMood } from "../engine/core/View";
import type { V3 } from "../engine/types";
import { got } from "./assets";
import type { Need } from "./assets";

export const NIGHT_SKY_FILE = "env/night_sky.jpg";
/** azimuth of the moon in the baked image, three convention atan2(z, x) (tools/night_sky.py prints it) */
const MOON_AZ = 0.632;
const KEY = "nightsky:tex";

export const needNightSky = (): Need => [
  KEY,
  async () => {
    const tex = await new THREE.TextureLoader().loadAsync(staticFile(NIGHT_SKY_FILE));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = 8;
    return tex;
  },
];

const V = /* glsl */ `
varying vec3 vDir;
void main(){
  vDir = normalize(position);
  vec4 p = projectionMatrix * viewMatrix * vec4(cameraPosition + vDir * 100.0, 1.0);
  p.z = p.w * 0.99999;
  gl_Position = p;
}`;

const F = /* glsl */ `
uniform sampler2D uTex;
uniform float uRot; uniform float uGain; uniform float uStars; uniform float uClouds; uniform float uT;
uniform vec3 uTint; uniform vec3 uHaze; uniform float uHazeAmt;
varying vec3 vDir;
float h13(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float vn(vec3 p){ vec3 i = floor(p); vec3 f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(h13(i), h13(i+vec3(1,0,0)), f.x), mix(h13(i+vec3(0,1,0)), h13(i+vec3(1,1,0)), f.x), f.y),
             mix(mix(h13(i+vec3(0,0,1)), h13(i+vec3(1,0,1)), f.x), mix(h13(i+vec3(0,1,1)), h13(i+vec3(1,1,1)), f.x), f.y), f.z); }
float fbm(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++){ s += a * vn(p); p *= 2.07; a *= 0.5; } return s; }
void main(){
  vec3 d = normalize(vDir);
  float el = asin(clamp(d.y, -1.0, 1.0));
  float az = atan(d.z, d.x) - uRot;
  vec2 uv = vec2(fract(az / 6.2831853 + 0.5), clamp((degrees(el) + 10.0) / 100.0, 0.0005, 0.9995));
  // seam-safe gradients (fract jumps at the back): derivatives of the unwrapped azimuth
  vec2 du = vec2(dFdx(az), dFdy(az)) / 6.2831853;
  vec2 dv = vec2(dFdx(uv.y), dFdy(uv.y));
  vec3 c = textureGrad(uTex, uv, vec2(du.x, dv.x), vec2(du.y, dv.y)).rgb;
  // stars: the fine detail of the real sky (image minus its blurred self), boosted, kept crisp
  vec3 blur = textureLod(uTex, uv, 4.0).rgb;
  vec3 det = max(c - blur, 0.0);
  float lumB = dot(blur, vec3(0.2126, 0.7152, 0.0722));
  // a darker, deeper sky: the long-exposure photo is lifted; push the base down, keep moon / clouds / stars
  vec3 base = blur * pow(max(lumB, 1e-4), 0.35) * 1.25 + (c - blur) * 0.6;
  vec3 col = base * uTint * uGain + det * uStars * uGain * vec3(0.85, 0.92, 1.0);
  // extra moonlit cloud veil (procedural, drifts slowly): lit edges toward the moon, dark bodies elsewhere
  if (uClouds > 0.0 && d.y > -0.05) {
    vec3 q = vec3(d.x / (d.y + 0.25), 0.0, d.z / (d.y + 0.25)) * 1.6 + vec3(uT * 0.006, 0.0, uT * 0.002);
    float n = fbm(q * 1.3 + fbm(q * 2.7) * 0.6);
    float m = smoothstep(0.48, 0.72, n) * uClouds * smoothstep(-0.05, 0.12, d.y);
    vec3 moonD = vec3(cos(uRot + 0.632), 0.5, sin(uRot + 0.632));
    float lit = pow(max(dot(normalize(d), normalize(moonD)), 0.0), 6.0);
    vec3 cc = mix(uTint * 0.10, vec3(0.55, 0.62, 0.8), lit * 0.8 + 0.08) * uGain;
    col = mix(col, cc, m * 0.85);
  }
  // horizon: blend into the mood's fog / haze so fogged ground meets the sky without a seam
  float hz = 1.0 - smoothstep(-0.02, 0.09, d.y);
  col = mix(col, uHaze, clamp(hz * uHazeAmt, 0.0, 1.0));
  gl_FragColor = vec4(col, 1.0);
}`;

export type NightSkyProps = {
  /** brightness (1 = calibrated with nightReal) */
  gain?: number;
  /** moon azimuth override in degrees (three: 0 = +X, 90 = +Z, -90 = -Z); default = the mood's key light azimuth */
  moonAz?: number;
  /** boost of the photographed stars (default 2.2) */
  stars?: number;
  /** extra procedural moonlit cloud veil 0..1 (default 0.35; 0 = the clear HDRI sky) */
  clouds?: number;
  /** sky tint (linear multiplier; default a cold moonlit blue) */
  tint?: V3;
  /** horizon haze amount toward the mood's fog colour (default 1) */
  haze?: number;
  t?: number;
};

export const NightSky: React.FC<NightSkyProps> = ({ gain = 1, moonAz, stars = 2.2, clouds = 0.35, tint = [0.42, 0.56, 1.0], haze = 1, t = 0 }) => {
  const mood = useMood();
  const { gl } = useThree();
  const tex = got<THREE.Texture>(KEY);
  tex.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
  const key = (mood?.lights.key.dir ?? [0.4, 0.6, -0.5]) as V3;
  const want = moonAz !== undefined ? (moonAz * Math.PI) / 180 : Math.atan2(key[2], key[0]);
  const haze3 = new THREE.Color(mood?.fog.color ?? "#0e1630");
  const mat = React.useMemo(
    () => new THREE.ShaderMaterial({
      vertexShader: V, fragmentShader: F, side: THREE.BackSide, depthWrite: false, depthTest: true, fog: false,
      uniforms: {
        uTex: { value: tex }, uRot: { value: 0 }, uGain: { value: 1 }, uStars: { value: 2 }, uClouds: { value: 0 }, uT: { value: 0 },
        uTint: { value: new THREE.Vector3() }, uHaze: { value: new THREE.Color() }, uHazeAmt: { value: 1 },
      },
    }),
    [tex],
  );
  const U = mat.uniforms;
  U.uRot.value = want - MOON_AZ;
  U.uGain.value = gain;
  U.uStars.value = stars;
  U.uClouds.value = clouds;
  U.uT.value = t;
  (U.uTint.value as THREE.Vector3).set(...tint);
  (U.uHaze.value as THREE.Color).copy(haze3);
  U.uHazeAmt.value = haze;
  return (
    <mesh frustumCulled={false} renderOrder={-1000} material={mat} userData={{ sky: true, noInk: true }}>
      <sphereGeometry args={[1, 64, 32]} />
    </mesh>
  );
};
