// One world through one camera: LookLights (hemisphere + shadowed key + rim + fill + fog + toon tint) for the mood,
// a lens-side fill, an optional sky dome, your scene, and the post chain (ink, grade, bloom, DOF, vignette).
// A pure function of its props: the camera is set every render, the shadow box is snapped (core/shadows.ts).
// The mood it renders with is provided to its children through MoodCtx (useMood): unlit things (cards) read it to
// match the light. QA grip camera: Remotion input props {"grip": {"who", "hand": "right"|"left"|"both", "dist"}}
// replace the lens (useFrame priority -1, before the post chain renders) by a vfov-35 close-up of that hand, read from
// world/registry SHOT_JOINTS (this shot, this frame; written by Stickman during render), seen from the shot camera's
// side (from the hand's outer side instead when that hand is behind its own body as seen from the camera).
import { useFrame, useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import React from "react";
import { getInputProps, useCurrentFrame } from "remotion";
import * as THREE from "three";
import { UP } from "../../upgrade";
import { envInMood, envReady, envSH, setIblTint } from "../../world/ibl";
import { SHOT_JOINTS, ShotCtx } from "../../world/registry";
import { applyToon, LookLights, LookSky } from "../lookdev/LookRig";
import { PostFX } from "../post/PostFX";
import type { V3 } from "../types";
import { moodOf } from "./moods";
import type { MoodPreset } from "./moods";
import { shotLight } from "./shadows"; // also patches three's screen-locked PCF dither
import type { Cam } from "./shadows";

export type { Cam };

const CamSet: React.FC<{ cam: Cam; far: number; near?: number }> = ({ cam, far, near = 0.02 }) => {
  const { camera } = useThree();
  const c = camera as THREE.PerspectiveCamera;
  c.fov = cam.fov;
  c.near = near;
  c.far = far;
  c.position.set(...cam.pos);
  const dir = new THREE.Vector3(...cam.look).sub(c.position).normalize();
  c.up.copy(new THREE.Vector3(0, 1, 0).applyAxisAngle(dir, ((cam.roll ?? 0) * Math.PI) / 180));
  c.lookAt(...cam.look);
  c.updateProjectionMatrix();
  return null;
};
/** the mood the enclosing View renders with (null outside a View) */
export const MoodCtx = React.createContext<MoodPreset | null>(null);
export const useMood = () => React.useContext(MoodCtx);

export type Grip = { who: string; hand?: "right" | "left" | "both"; dist?: number };
/** the QA grip request from the Remotion input props (--props '{"grip": {...}}'), or null */
export const gripRequest = (): Grip | null => {
  const g = (getInputProps() as { grip?: Grip }).grip;
  return g && typeof g.who === "string" ? g : null;
};
const GRIP_FOV = 35;
const BODY_R = 0.22; // body pill / skirt radius used to tell whether a hand is hidden behind its own body
type PostLike = { dof: { enabled: boolean; focusDistance: number; focusRange: number; maxBlurPx: number } };
/** replaces the camera by a close-up of a hand (runs after the scene graph is rendered, before the post chain draws) */
const GripCam: React.FC<{ grip: Grip; cam: Cam; post: PostLike }> = ({ grip, cam, post }) => {
  const shot = React.useContext(ShotCtx);
  const frame = useCurrentFrame();
  useFrame(({ camera }) => {
    // only joints drawn in THIS shot at THIS frame (not the other shot of a dissolve, not an earlier frame of the tab)
    const e = SHOT_JOINTS.get(`${grip.who}#${shot}`);
    const J = e && e.frame === frame ? e.J : undefined;
    const c = camera as THREE.PerspectiveCamera;
    if (!J) {
      const here = [...SHOT_JOINTS.entries()].filter(([k, v]) => k.endsWith(`#${shot}`) && v.frame === frame).map(([k]) => k.split("#")[0]);
      console.error(`GRIP: no joints for "${grip.who}" in shot ${shot} at frame ${frame} (is it drawn in this shot?) drawn: ${here.join(", ") || "none"}`);
      return;
    }
    const L = J.LeftHandMiddle1;
    const R = J.RightHandMiddle1;
    if (!L || !R) return;
    const h = grip.hand === "left" ? new THREE.Vector3(...L) : grip.hand === "both" ? new THREE.Vector3(...L).add(new THREE.Vector3(...R)).multiplyScalar(0.5) : new THREE.Vector3(...R);
    const dist = grip.dist ?? 0.9;
    // from the shot camera's side, a little above the hand (both hands: back off to fit both)
    const span = grip.hand === "both" ? new THREE.Vector3(...L).distanceTo(new THREE.Vector3(...R)) : 0;
    const d = new THREE.Vector3(...cam.pos).sub(h);
    // a single hand on the far side of its own body (e.g. the right hand of someone walking left past the lens) is
    // hidden by the body from the camera side: when the level line from the hand toward the lens passes within
    // BODY_R of the hips, look from the hand's outer side instead (hips -> hand, level, a little toward the lens)
    if (grip.hand !== "both" && J.Hips) {
      const hp = new THREE.Vector2(J.Hips[0], J.Hips[2]);
      const h2 = new THREE.Vector2(h.x, h.z);
      const side = new THREE.Vector2(d.x, d.z);
      const flat = side.length();
      const reach = Math.min(flat, Math.max(dist, 1.2));
      if (flat > 1e-6) {
        side.divideScalar(flat);
        const u = hp.clone().sub(h2).dot(side); // > 0: the hips are nearer the lens than the hand
        const out = h2.clone().sub(hp);
        if (u > 0 && h2.clone().addScaledVector(side, Math.min(u, reach)).distanceTo(hp) < BODY_R && out.lengthSq() > 1e-6) {
          out.normalize().addScaledVector(side, 0.35).normalize().multiplyScalar(flat);
          d.set(out.x, d.y, out.y);
        }
      }
    }
    d.y = Math.max(d.y, 0.15 * Math.hypot(d.x, d.z));
    d.normalize();
    // portrait: the horizontal view is only aspect x the vertical one; "both" backs off until both hands fit (+25 %)
    const hHalf = Math.tan((GRIP_FOV * Math.PI) / 360) * Math.min(1, c.aspect || 1);
    const D = Math.max(dist, (span * 0.5 * 1.25) / hHalf);
    c.position.copy(h).addScaledVector(d, D);
    c.up.set(0, 1, 0);
    c.fov = GRIP_FOV;
    c.near = Math.min(c.near, 0.05);
    c.lookAt(h);
    c.updateProjectionMatrix();
    c.updateMatrixWorld();
    post.dof.focusDistance = D;
    post.dof.focusRange = D * 2.2;
  }, -1);
  return null;
};

const ToonSync: React.FC<{ look: MoodPreset }> = ({ look }) => {
  useFrame(() => applyToon(look), 0);
  return null;
};
const CamFill: React.FC<{ cam: Cam; color: string; intensity: number }> = ({ cam, color, intensity }) => {
  const target = React.useMemo(() => new THREE.Object3D(), []);
  target.position.set(...cam.look);
  target.updateMatrixWorld();
  const d = new THREE.Vector3(...cam.pos).sub(new THREE.Vector3(...cam.look));
  const side = new THREE.Vector3(0, 1, 0).cross(d).normalize();
  const p = new THREE.Vector3(...cam.pos).addScaledVector(side, d.length() * 0.3).add(new THREE.Vector3(0, d.length() * 0.35, 0));
  return (
    <>
      <primitive object={target} />
      <directionalLight position={[p.x, p.y, p.z]} target={target} color={color} intensity={intensity} />
    </>
  );
};

export type ViewProps = {
  mood: string | MoodPreset;
  cam: Cam;
  t: number;
  /** subject point for depth of field */
  focus?: V3;
  /** max DOF blur px at 1080 wide: wide 0.6, medium 1.4, close 2.4, macro 3.0 */
  blur?: number;
  /** extra exposure (stops) */
  exposure?: number;
  /** draw the sky dome (exteriors) */
  sky?: boolean;
  /** camera clip range (depth precision: keep far / near small; default 0.02 / 600) */
  near?: number;
  far?: number;
  /** post ink on set geometry (default: the mood's post.outline.setInk, false = ink only on characters, cards, tags
   *  and meshes marked userData.ink = true; true = the old look, every edge of the set inked) */
  setInk?: boolean;
  /** screen-space AO (merged over the mood's post.ao; false = off) */
  ao?: false | { radius?: number; intensity?: number; bias?: number };
  /** light shafts toward the mood's key light (merged over post.shafts; false = off) */
  shafts?: false | { strength?: number; threshold?: number; length?: number; decay?: number; color?: string; dir?: V3 };
  width?: number;
  height?: number;
  children?: React.ReactNode;
  style?: React.CSSProperties;
};

/** look A/B switches from the Remotion input props ({"look": {"setInk": true, "ao": false, "shafts": false, "bake":
 *  false}}): comparison stills of the 2026-11-17 set look against the old one without editing shots. bake false = the
 *  lightmaps are ignored (hemisphere and fills at full strength, as before the bake). */
export type LookSwitch = { setInk?: boolean; ao?: boolean; shafts?: boolean; bake?: boolean };
export const lookSwitch = (): LookSwitch => ((getInputProps() as { look?: LookSwitch }).look ?? {});

/** Blender-like look knobs (src/upgrade.ts switches agx / hdri / soft; tested in _t_upgrade 2026-11-20, BUILD_LESSONS
 *  #102-104): probe energy vs the old hemisphere (1 = same irradiance at the zenith), the unlit figures' IBL tint
 *  amount, AgX pre-gain + Punchy look amount + white point (unlit white x AGX_WHITE lands at 0.96: heads 91-93 % white;
 *  mean luma +4 %, saturation +8 % vs the old grade), soft sun. Input props iblTint / agxGain / agxWhite / agxPunch
 *  override them for a re-tune still. */
export const IBL_GAIN = 1.0;
export const IBL_TINT = Number((getInputProps() as { iblTint?: number }).iblTint ?? 0.45);
export const AGX_GAIN = Number((getInputProps() as { agxGain?: number }).agxGain ?? 1.0);
export const AGX_WHITE = Number((getInputProps() as { agxWhite?: number }).agxWhite ?? 1);
export const AGX_PUNCH = Number((getInputProps() as { agxPunch?: number }).agxPunch ?? 0.4);
export const SOFT_SUN = { shadowRadius: 5, shadowBias: -0.0003, shadowNormalBias: 0.03 };

export const View: React.FC<ViewProps> = ({ mood: m0, cam, t, focus, blur = 1.4, exposure = 0, sky = true, near = 0.02, far = 600, setInk: setInk0, ao: ao0, shafts: shafts0, width = 1080, height = 1920, children, style }) => {
  const sw = lookSwitch();
  const m1 = typeof m0 === "string" ? moodOf(m0) : m0;
  const m = sw.bake === false ? { ...m1, toon: { ...m1.toon, lmGain: 0, hemiKeep: 1, fillKeep: 1, aoFill: 0 } } : m1;
  const setInk = sw.setInk ?? setInk0;
  const ao = sw.ao === false ? false : ao0;
  const shafts = sw.shafts === false ? false : shafts0;
  // sky HDRI (SH light probe) replaces the hemisphere light (world/ibl.ts; needEnv() is loaded once by Film / LookDev,
  // without it the View quietly keeps the hemisphere light); soft sun shadows (core/shadows.ts)
  const up = UP();
  // the plain day preset takes the HDRI's own colour (tested 2026-11-20); every other mood (night, lamp, golden, dusk,
  // cold...) keeps its hemisphere hue and only borrows the HDRI's direction (world/ibl.ts envInMood)
  const hemiSky = new THREE.Color(m.lights.hemi.sky).multiplyScalar(m.lights.hemi.intensity);
  const env = up.hdri && envReady() ? envSH(m.lights.key.dir as V3, new THREE.Color(m.lights.hemi.ground)) : null;
  const hdriHue = m.lights.hemi.sky.toLowerCase() === moodOf("day").lights.hemi.sky.toLowerCase();
  const ibl = env && !hdriHue ? envInMood(env, hemiSky) : env;
  const iblI = (() => {
    if (!ibl) return 0;
    const lum = (c: { r: number; g: number; b: number }) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
    return (lum(hemiSky) / Math.max(1e-5, lum({ r: ibl.up.x, g: ibl.up.y, b: ibl.up.z }))) * IBL_GAIN;
  })();
  setIblTint(ibl, ibl ? IBL_TINT : 0);
  const mood: MoodPreset = !ibl && !up.soft ? m : {
    ...m,
    lights: {
      ...m.lights,
      hemi: ibl ? { ...m.lights.hemi, intensity: 0 } : m.lights.hemi,
      key: (up.soft ? { ...m.lights.key, ...SOFT_SUN } : m.lights.key) as MoodPreset["lights"]["key"],
    },
  };
  const probe = React.useMemo(() => new THREE.LightProbe(), []);
  if (ibl) { probe.sh.copy(ibl.sh); probe.intensity = iblI; }
  const L = shotLight(mood, cam);
  const fd = Math.max(0.2, new THREE.Vector3(...cam.pos).distanceTo(new THREE.Vector3(...(focus ?? cam.look))));
  const P = mood.post;
  const k = width / 1080; // post px values are authored at 1080 wide
  const grip = gripRequest();
  const post = {
    ...P,
    outline: { ...P.outline, widthPx: P.outline.widthPx * k, setInk: setInk ?? P.outline.setInk ?? false },
    dof: { enabled: true, focusDistance: fd, focusRange: fd * 1.1, maxBlurPx: Math.max(5, blur * 4) * k },   // user 2026-11-21: depth of field always visible
    bloom: { ...P.bloom, radiusPx: P.bloom.radiusPx * k },
    grade: { ...P.grade, exposure: P.grade.exposure + exposure, ...(up.agx ? { agx: 1, agxGain: AGX_GAIN, agxPunch: AGX_PUNCH, agxWhite: AGX_WHITE } : {}) },
    ao: ao === false ? { enabled: false } : { ...(P.ao ?? {}), ...(ao ?? {}) },
    shafts: shafts === false ? { enabled: false } : { dir: mood.lights.key.dir as V3, ...(P.shafts ?? {}), ...(shafts ?? {}) },
  };
  return (
    <ThreeCanvas width={width} height={height} shadows flat style={{ position: "absolute", inset: 0, ...style }}>
      <CamSet cam={cam} far={far} near={near} />
      <LookLights look={L.look} center={L.center} extent={L.extent} fog />
      {ibl ? <primitive object={probe} /> : null}
      <ToonSync look={L.look} />
      <CamFill cam={cam} color={mood.camFill.color} intensity={mood.camFill.intensity} />
      {sky ? <LookSky look={L.look} t={t} cloudSeed={3} /> : null}
      <MoodCtx.Provider value={mood}>{children}</MoodCtx.Provider>
      {grip ? <GripCam grip={grip} cam={cam} post={post} /> : null}
      <PostFX settings={post} />
    </ThreeCanvas>
  );
};
