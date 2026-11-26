// LookDev: a set (or several, or none) under a mood from one camera, for look-dev stills before any shot exists.
// `stickman3d.py lookdev <set>:<state> ... [--mood day] [--cams cams.json] [--figure x,y,z|auto|none] [--vehicle ...]`
// renders 3 views at half size and tiles them into out/lookdev_<set>_<state>.jpg.
// Input props (Remotion --props): {"sets": [["road","day"], ["tree","tree"]], "mood": "day"|"dusk"|"night"|"sunrise"|
// "golden"|"lamp"|"cold", "cams": [{"pos": [x,y,z], "look": [x,y,z], "fov": 50}], "cam": 0, "figure": [x,y,z] | "auto",
// "vehicles": [{"id": "car_sedan", "at": [0,0,0], "yaw": 0, "steer": 0.4, "crumple": 0.6, "lights": true}],
// "exposure": 0, "blur": 0.6, "far": 300, "sky": true}. three.js coordinates (Blender (x, y, z) -> (x, z, -y)).
// The mood takes the FIRST set's exported sun: forSet(mood, sunDir) or nightSet(sunDir) for "night".
// Without "cams" three default views are computed from the first set's content (meshes under 60 m across, so the
// ground and sky planes do not count) or, with no set, from the vehicles: 0 = eye-level 3/4 at 1.4 m, 1 = medium,
// 2 = high wide. A focus anchor (look / focus / center / centre / hero / subject) wins over the box centre.
// Every render logs "LOOKDEV CAM i {json}" per camera (the CLI labels the tiles and saves them as a cams.json to edit)
// and runs lensClear on each set (LENS BLOCKED lines).
import React from "react";
import { AbsoluteFill } from "remotion";
import * as THREE from "three";
import { View } from "./engine/core/View";
import type { Cam } from "./engine/core/View";
import type { V3 } from "./engine/types";
import { UP } from "./upgrade";
import { useNeeds, toonColor } from "./world/assets";
import { needEnv } from "./world/ibl";
import type { Need } from "./world/assets";
import { lensClear } from "./world/camera";
import { cabinNight, forSet, nightReal, nightSet, nightWoods } from "./world/moods";
import { NightSky, needNightSky } from "./world/nightSky";
import { getSet, groundY, needSet, sunDir, useSetScene } from "./world/set";
import type { LoadedSet } from "./world/set";
import { getVehicle, needVehicle, Vehicle } from "./world/vehicle";
import type { VehicleProps } from "./world/vehicle";
import { SetLights } from "./world/weather";

export type LookCam = { pos: V3; look: V3; fov?: number; roll?: number };
export type LookVehicle = Omit<VehicleProps, "at"> & { at?: V3 };
export type LookDevProps = {
  sets?: [string, string][];
  mood?: string;
  cams?: LookCam[];
  cam?: number;
  figure?: V3 | "auto" | null;
  vehicles?: LookVehicle[];
  exposure?: number;
  blur?: number;
  far?: number;
  sky?: boolean;
  /** fog density multiplier (SETS role 2026-11-21: aerial sets need ~0.02) */
  fog?: number;
};
export const LOOKDEV_DEFAULTS: LookDevProps = { sets: [], mood: "day", cam: 0, figure: "auto", vehicles: [] };

const FOCUS = ["look", "focus", "center", "centre", "hero", "subject"];
const TAN_H = Math.tan((25 * Math.PI) / 180) * (1080 / 1920); // half-width of a vfov-50 portrait view
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/** the set's "content": meshes under 60 m across (ground, sky and road planes do not count), else everything */
const contentBox = (s: LoadedSet) => {
  const b = new THREE.Box3();
  s.scene.updateMatrixWorld(true);
  for (const me of s.ground) {
    const mb = new THREE.Box3().setFromObject(me);
    const sz = mb.getSize(new THREE.Vector3());
    if (Math.max(sz.x, sz.z) < 60) b.union(mb);
  }
  return b.isEmpty() ? new THREE.Box3().setFromObject(s.scene) : b;
};

/** k = how much of the content's radius the view fits: sets 0.6 / 0.85 / 1.15 (the set fills the frame, the edges may
 *  crop), single objects (vehicles) 1.0 / 1.3 / 1.7 (the whole object in frame) */
const defaultCams = (focus: V3, R: number, ground: number, top: number, k: [number, number, number]): (LookCam & { kind: string })[] => {
  const at = (deg: number, d: number, y: number, ly: number, fov: number, kind: string) => {
    const a = (deg * Math.PI) / 180;
    return { kind, pos: [focus[0] + Math.sin(a) * d, ground + y, focus[2] + Math.cos(a) * d] as V3, look: [focus[0], ground + ly, focus[2]] as V3, fov };
  };
  const mid = clamp((top - ground) * 0.4, 0.9, 4);
  return [
    at(35, clamp((k[0] * R) / TAN_H, 3, 30), 1.4, Math.min(mid, 1.3), 50, "eye 3/4"),
    at(-30, clamp((k[1] * R) / TAN_H, 5, 45), clamp(0.45 * R + 2, 3, 16), mid, 45, "medium"),
    at(60, clamp((k[2] * R) / TAN_H, 8, 70), clamp(1.0 * R, 6, 50), mid * 0.5, 50, "high wide"),
  ];
};

// ------------------------------------------------------------------ 1.7 m stand-in figure (scale reference)
const figMat = toonColor("#ece6da");
const legMat = toonColor("#3a3a46");
const StandIn: React.FC<{ at: V3; face: number }> = ({ at, face }) => (
  <group position={at} rotation={[0, face, 0]}>
    {[-0.09, 0.09].map((x) => (
      <mesh key={x} position={[x, 0.4, 0]} material={legMat} castShadow>
        <cylinderGeometry args={[0.045, 0.045, 0.8, 10]} />
      </mesh>
    ))}
    <mesh position={[0, 1.11, 0]} material={figMat} castShadow>
      <capsuleGeometry args={[0.18, 0.42, 6, 16]} />
    </mesh>
    {[-0.24, 0.24].map((x) => (
      <mesh key={x} position={[x, 1.05, 0]} rotation={[0, 0, Math.sign(x) * 0.12]} material={legMat} castShadow>
        <cylinderGeometry args={[0.035, 0.035, 0.6, 8]} />
      </mesh>
    ))}
    <mesh position={[0, 1.57, 0]} material={figMat} castShadow>
      <sphereGeometry args={[0.13, 20, 14]} />
    </mesh>
  </group>
);

const groundMat = toonColor("#b9b6a8");
const SetDraw: React.FC<{ s: LoadedSet; night: boolean }> = ({ s, night }) => (
  <>
    <primitive object={useSetScene(s)} />
    {night ? <SetLights set={s} /> : null}
  </>
);

export const LookDev: React.FC<LookDevProps> = (props) => {
  const p = { ...LOOKDEV_DEFAULTS, ...props };
  const sets = p.sets ?? [];
  const vehicles = p.vehicles ?? [];
  const real = p.mood === "nightReal" || p.mood === "nightWoods";
  const needs: Need[] = [...(UP().hdri ? [needEnv()] : []), ...(real ? [needNightSky()] : []), ...sets.map(([n, s]) => needSet(n, s)), ...vehicles.map((v) => needVehicle(v.id))];
  const ready = useNeeds(needs);
  if (!ready) return <AbsoluteFill style={{ background: "#000" }} />;
  const loaded = sets.map(([n, s]) => getSet(n, s));
  const first = loaded[0];
  // WORLD2 2026-11-21: "nightReal" (real moonlit night + the Poly Haven NightSky) and "cabinNight" (cabin:night)
  const night = p.mood === "night" || real || p.mood === "cabinNight";
  const sun = first ? sunDir(first) : undefined;
  const fo = p.fog !== undefined ? { fog: p.fog * (night ? 1 : 0.5) } : {};
  const mood = p.mood === "nightWoods" ? nightWoods(sun, fo) : real ? nightReal(sun, fo) : p.mood === "cabinNight" ? cabinNight(sun, fo) : night ? nightSet(sun, fo) : forSet(p.mood ?? "day", sun, fo);

  // content: the first set, else the vehicles, else 2 m around the origin
  let focus: V3 = [0, 0, 0];
  let R = 2;
  let ground = 0;
  let top = 2;
  if (first) {
    const b = contentBox(first);
    const c = b.getCenter(new THREE.Vector3());
    const sz = b.getSize(new THREE.Vector3());
    const named = FOCUS.map((k) => first.info.anchors[k]).find(Boolean);
    focus = named ?? [c.x, c.y, c.z];
    R = clamp(Math.hypot(sz.x, sz.z) / 2, 2, 22);
    ground = groundY(first, focus[0], focus[2], b.min.y);
    top = b.max.y;
  } else if (vehicles.length) {
    const b = new THREE.Box3();
    for (const v of vehicles) {
      const d = getVehicle(v.id).dims;
      const at = v.at ?? [0, 0, 0];
      const h = Math.max(d.length, d.width) / 2;
      b.union(new THREE.Box3(new THREE.Vector3(at[0] - h, at[1], at[2] - h), new THREE.Vector3(at[0] + h, at[1] + d.height, at[2] + h)));
    }
    const c = b.getCenter(new THREE.Vector3());
    focus = [c.x, b.min.y, c.z];
    R = clamp(Math.hypot(b.max.x - b.min.x, b.max.z - b.min.z) / 2 / Math.SQRT2, 2, 22);
    ground = b.min.y;
    top = b.max.y;
  }
  const auto = defaultCams(focus, R, ground, top, first ? [0.6, 0.85, 1.15] : [1.0, 1.3, 1.7]);
  const cams: (LookCam & { kind?: string })[] = p.cams && p.cams.length ? p.cams : auto;
  const i = clamp(Math.round(p.cam ?? 0), 0, cams.length - 1);
  const c = cams[i];
  const cam: Cam = { pos: c.pos, look: c.look, fov: c.fov ?? 50, roll: c.roll ?? 0 };
  cams.forEach((k, j) => console.error(`LOOKDEV CAM ${j} ${JSON.stringify({ kind: k.kind ?? "given", pos: k.pos.map((x) => +x.toFixed(2)), look: k.look.map((x) => +x.toFixed(2)), fov: k.fov ?? 50 })}`));
  for (const s of loaded) lensClear(s, cam, cam.look, `lookdev cam ${i} (${s.info.set}_${s.info.state})`);

  // the stand-in: given, or "auto" beside the focus toward camera 0
  let fig: V3 | null = null;
  if (Array.isArray(p.figure)) fig = p.figure;
  else if (p.figure === "auto") {
    const c0 = auto[0].pos;
    const d = new THREE.Vector3(c0[0] - focus[0], 0, c0[2] - focus[2]).normalize();
    const side = new THREE.Vector3(-d.z, 0, d.x);
    // sets: half way toward camera 0 and a little aside; vehicles only: beside them, clear of the body
    const [fwd, off] = first ? [R * 0.5, R * 0.5 + 0.8] : [0, R + 1.2];
    const x = focus[0] + d.x * fwd + side.x * off;
    const z = focus[2] + d.z * fwd + side.z * off;
    fig = [x, first ? groundY(first, x, z, ground) : ground, z];
  }
  const far = p.far ?? clamp(R * 12, 250, 600);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <View mood={mood} cam={cam} t={0} focus={cam.look} blur={p.blur ?? 0.6} exposure={p.exposure ?? 0} sky={real ? false : p.sky ?? true} near={0.1} far={far}>
        {real ? <NightSky /> : null}
        {loaded.map((s, j) => (
          <SetDraw key={j} s={s} night={night} />
        ))}
        {first ? null : (
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[focus[0], ground - 0.002, focus[2]]} material={groundMat} receiveShadow userData={{ outline: false }}>
            <circleGeometry args={[Math.max(60, R * 10), 64]} />
          </mesh>
        )}
        {vehicles.map((v, j) => (
          <Vehicle key={j} name={`lookdev${j}`} {...v} at={v.at ?? [0, 0, 0]} />
        ))}
        {fig ? <StandIn at={fig} face={Math.atan2(cam.pos[0] - fig[0], cam.pos[2] - fig[2])} /> : null}
      </View>
    </AbsoluteFill>
  );
};
