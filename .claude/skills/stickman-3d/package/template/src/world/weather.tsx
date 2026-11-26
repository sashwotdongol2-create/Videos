// Weather and air for three.js shots: falling snow, snow / dust puffs, light beams, window glow halos, and the set's
// exported point lights (SetLights, optional shadows).
// Every component is a pure function of t (seconds): positions come from a seeded hash, never from accumulated state,
// so any frame (and any motion-blur sub-frame) renders the same in every Remotion tab. Nothing here gets post ink
// (userData.outline = false) or casts shadows. Coordinates are three.js (Y up); Blender (x, y, z) -> (x, z, -y).
import React from "react";
import * as THREE from "three";
import type { V3 } from "../engine/types";
import type { LoadedSet } from "./set";

/** deterministic [0, 1) stream (mulberry32); the same seed always gives the same numbers */
export const rng = (seed: number) => {
  let a = (seed * 2654435761) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
const wrap = (v: number, lo: number, hi: number) => {
  const r = hi - lo;
  return lo + ((((v - lo) % r) + r) % r);
};
const smooth = (u: number) => {
  const x = Math.min(1, Math.max(0, u));
  return x * x * (3 - 2 * x);
};
const noInk = (o: THREE.Object3D | null) => {
  if (!o) return;
  o.userData.outline = false;
  o.castShadow = false;
  o.receiveShadow = false;
};

export type SnowfallProps = {
  t: number;
  /** centre of the snow box at ground level (three coords) */
  center: V3;
  /** box size [x, height, z] in m */
  size: V3;
  count?: number;
  /** fall speed m/s (Blender graveyard: 0.5) */
  speed?: number;
  /** flake radius m (scaled 0.5-1.6 per flake) */
  radius?: number;
  /** sideways sway amplitude m (sin(1.3 t + 3 h0)) */
  sway?: number;
  seed?: number;
  color?: string;
  /** colour multiplier (unlit flakes: 0.95 matches the Blender emission 0.95) */
  strength?: number;
  opacity?: number;
};
/** falling snow (the graveyard's geometry-nodes snowfall, ported): random points in a box, height =
 *  wrap(h0 - speed * t), x sways; one InstancedMesh of unlit icospheres (one draw call for 1500 flakes) */
export const Snowfall: React.FC<SnowfallProps> = ({ t, center, size, count = 900, speed = 0.55, radius = 0.018, sway = 0.08, seed = 3, color = "#f4f6ff", strength = 0.95, opacity = 1 }) => {
  const mesh = React.useMemo(() => {
    const geo = new THREE.IcosahedronGeometry(1, 1);
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(strength), transparent: opacity < 1, opacity });
    const m = new THREE.InstancedMesh(geo, mat, count);
    m.frustumCulled = false;
    noInk(m);
    const r = rng(seed);
    const seeds = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      seeds[i * 4] = (r() - 0.5) * size[0];
      seeds[i * 4 + 1] = r() * size[1];
      seeds[i * 4 + 2] = (r() - 0.5) * size[2];
      seeds[i * 4 + 3] = 0.5 + r() * 1.1;
    }
    m.userData.seeds = seeds;
    return m;
  }, [count, seed, size[0], size[1], size[2], color, strength, opacity]);
  const s = mesh.userData.seeds as Float32Array;
  const M = new THREE.Matrix4();
  for (let i = 0; i < count; i++) {
    const x0 = s[i * 4], h0 = s[i * 4 + 1], z0 = s[i * 4 + 2], k = s[i * 4 + 3] * radius;
    const h = wrap(h0 - speed * t, 0, size[1]);
    const x = x0 + sway * Math.sin(1.3 * t + 3 * h0);
    M.makeScale(k, k, k).setPosition(center[0] + x, center[1] + h, center[2] + z0);
    mesh.setMatrixAt(i, M);
  }
  mesh.instanceMatrix.needsUpdate = true;
  return <primitive object={mesh} />;
};

export type PuffProps = {
  t: number;
  /** start time (s) and duration (s) */
  t0: number;
  dur?: number;
  at: V3;
  size?: number;
  count?: number;
  seed?: number;
  color?: string;
  opacity?: number;
  /** fade out over the last part of the life (0 = pop off like the Blender keys) */
  fade?: number;
};
/** a puff of snow / dust: soft spheres that grow and drift out from `at`, then fade (graveyard shot 6 cap puff) */
export const Puff: React.FC<PuffProps> = ({ t, t0, dur = 1, at, size = 0.3, count = 6, seed = 1, color = "#f6f6ff", opacity = 0.35, fade = 0.35 }) => {
  const parts = React.useMemo(() => {
    const r = rng(seed);
    return Array.from({ length: count }, () => ({ d: [(r() * 2 - 1) * size, (r() * 1.0 - 0.2) * size, -(r() * 0.8 - 0.4) * size] as V3, k: 0.7 + r() * 0.5 }));
  }, [seed, count, size]);
  const mat = React.useMemo(() => {
    const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
    return m;
  }, [color, opacity]);
  const geo = React.useMemo(() => new THREE.SphereGeometry(1, 14, 8), []);
  const u = (t - t0) / dur;
  if (u < 0 || u >= 1) return null;
  // the Blender keys: k = 0.15 at the start, 0.8 at half life, 1.0 at the end
  const k = u < 0.5 ? 0.15 + 0.65 * smooth(u / 0.5) : 0.8 + 0.2 * smooth((u - 0.5) / 0.5);
  mat.opacity = opacity * (fade > 0 ? 1 - smooth((u - (1 - fade)) / fade) : 1);
  return (
    <group ref={noInk}>
      {parts.map((p, i) => {
        const sc = size * (0.35 + 0.6 * k) * p.k;
        return (
          <mesh key={i} ref={noInk} geometry={geo} material={mat} renderOrder={2}
            position={[at[0] + p.d[0] * (0.3 + k), at[1] + p.d[1] * (0.3 + k), at[2] + p.d[2] * (0.3 + k)]} scale={[sc, sc * 0.8, sc * 0.8]} />
        );
      })}
    </group>
  );
};

/** soft additive cone of light from `from` to `to` (moon / window / lantern shafts); `strength` 0.1-0.4 reads as haze */
export const LightBeam: React.FC<{ from: V3; to: V3; width?: number; color?: string; strength?: number }> = ({ from, to, width = 0.6, color = "#c9d4ff", strength = 0.18 }) => {
  const mat = React.useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        uniforms: { uCol: { value: new THREE.Color(color) }, uK: { value: strength } },
        vertexShader: "varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv=uv; vec4 w=modelViewMatrix*vec4(position,1.); vN=normalize(normalMatrix*normal); vV=normalize(-w.xyz); gl_Position=projectionMatrix*w; }",
        fragmentShader: "uniform vec3 uCol; uniform float uK; varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ float e=pow(abs(dot(vN,vV)),1.5); float a=uK*e*smoothstep(0.,0.15,vUv.y)*(1.-vUv.y*0.6); gl_FragColor=vec4(uCol*a,1.); }",
      }),
    [color, strength],
  );
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  const len = a.distanceTo(b);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), b.clone().sub(a).normalize());
  const mid = a.clone().add(b).multiplyScalar(0.5);
  return (
    <mesh ref={noInk} position={mid} quaternion={q} material={mat} renderOrder={3}>
      <cylinderGeometry args={[width, width * 0.15, len, 24, 1, true]} />
    </mesh>
  );
};

/** additive camera-facing halo (window / lamp glare that blooms even where the bloom threshold misses it) */
export const Glow: React.FC<{ at: V3; size?: number; color?: string; strength?: number }> = ({ at, size = 1.5, color = "#ffb24a", strength = 0.5 }) => {
  const mat = React.useMemo(
    () =>
      new THREE.SpriteMaterial({
        map: haloTex(),
        color: new THREE.Color(color).multiplyScalar(strength),
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
        fog: false,
      }),
    [color, strength],
  );
  return <sprite ref={noInk} position={at} scale={[size, size, 1]} material={mat} renderOrder={3} />;
};
let _halo: THREE.Texture | null = null;
const haloTex = () => {
  if (_halo) return _halo;
  const N = 64;
  const data = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const d = Math.hypot(x - N / 2 + 0.5, y - N / 2 + 0.5) / (N / 2);
      const v = Math.max(0, 1 - d) ** 2.2 * 255;
      const i = (y * N + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = 255;
      data[i + 3] = v;
    }
  _halo = new THREE.DataTexture(data, N, N);
  _halo.needsUpdate = true;
  return _halo;
};

/** make the set's lit windows / lamps GLOW: meshes whose name (or parent name) matches `re` get an unlit HDR colour
 *  (k > 1 so they pass the bloom threshold; yellow reads like Blender's clipped orange emission). Idempotent (runs once
 *  per loaded scene). Keep k ~1.2-1.3: the grade burns anything brighter than ~1.0 after exposure toward a cream core
 *  (the windows read cream, not yellow, at k 1.8). Returns the world positions of the matched meshes (for Glow halos / point lights). */
export const glowMeshes = (root: THREE.Object3D, re: RegExp, color = "#ffe040", k = 1.25): V3[] => {
  const key = `glow:${re.source}`;
  if (root.userData[key]) return root.userData[key] as V3[];
  const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), fog: false, toneMapped: false });
  const out: V3[] = [];
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    const me = o as THREE.Mesh;
    if (!me.isMesh || !(re.test(me.name) || re.test(me.parent?.name ?? ""))) return;
    me.material = mat;
    me.castShadow = false;
    const p = new THREE.Vector3();
    me.getWorldPosition(p);
    out.push([p.x, p.y, p.z]);
  });
  root.userData[key] = out;
  return out;
};

type Rest = { p: THREE.Vector3; q: THREE.Quaternion; s: THREE.Vector3 };
// rest poses live outside userData: Object3D.clone() JSON-copies userData, which would turn a Quaternion into an array
const rests = new WeakMap<THREE.Object3D, Rest>();
/** pose a named node of a loaded set every frame from its rest pose (captured once): never accumulates.
 *  Pass the shot's own scene (useSetScene(set)), not set.scene. rot = radians about a three axis; offset in three
 *  coords; scale multiplies the rest scale; visible toggles it. */
export const poseNode = (root: THREE.Object3D, name: string, p: { axis?: V3; rot?: number; offset?: V3; scale?: number; visible?: boolean }) => {
  const o = root.getObjectByName(name);
  if (!o) return null;
  let rest = rests.get(o);
  if (!rest) rests.set(o, (rest = { p: o.position.clone(), q: o.quaternion.clone(), s: o.scale.clone() }));
  o.position.copy(rest.p);
  if (p.offset) o.position.add(new THREE.Vector3(...p.offset));
  o.quaternion.copy(rest.q);
  if (p.rot) o.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(...(p.axis ?? [0, 0, 1])).normalize(), p.rot));
  o.scale.copy(rest.s).multiplyScalar(p.scale ?? 1);
  o.visible = p.visible ?? true;
  return o;
};

// ------------------------------------------------------------------ the set's exported point lights
export type SetLightsProps = {
  set: LoadedSet;
  /** cast shadows (cube shadow maps: 6 extra depth renders per light per frame). Off by default. */
  castShadow?: boolean;
  /** at most this many lights cast shadows (the strongest first; default 2) */
  maxShadows?: number;
  /** shadow map size per cube face (clamped 128-1024; default 512) */
  mapSize?: number;
  /** intensity (cd) = Blender W / (4 pi^2) * k. Default pi = W / (4 pi): the same irradiance as in Blender (a 40 W lamp
   *  gives ~1.4 at 1.5 m, next to a forSet key of ~1.6). The _night3d window pools 12 m away used k = 10. */
  k?: number;
  /** light reach in m (default 10; decay 2) */
  distance?: number;
  /** only lights whose name matches */
  only?: RegExp;
  /** also add lights whose light is already in the set's lightmap (export --light bakes every non-sun light: adding them
   *  live doubles their pools on the set). Default false: baked lights are skipped. */
  baked?: boolean;
};
/** the set's exported POINT lights (set.info.lights: windows, lamps, stoves) as three point lights; optional shadows.
 *  The mood already carries the room's overall light: use it for local pools (a lamp beside a character) and the
 *  shadows they throw. A light inside a closed house with castShadow lights nothing outside (the walls block it).
 *  Cost (parlour, 2 shadowed lights at 512 px, 1080x1920): one still 13.8 s vs 14.1 s without (noise); 30 frames
 *  16.4-17.0 s vs 15.2-15.4 s with the lights unshadowed (~+45 ms / frame, ~+9 %). */
export const SetLights: React.FC<SetLightsProps> = ({ set, castShadow = false, maxShadows = 2, mapSize = 512, k = Math.PI, distance = 10, only, baked = false }) => {
  const inMap = new Set(baked ? [] : set.info.lightmap?.direct ?? []);
  const pts = set.info.lights.filter((l) => l.kind === "POINT" && (!only || only.test(l.name)) && !inMap.has(l.name));
  // SPOT lights (WORLD2 2026-11-21: cabin:night aisle downlights + reading lights): a downward cone, no light on the
  // ceiling above them. json dir = the light's local +Z = AWAY from the beam; angle = half cone (rad), blend = penumbra
  const spots = set.info.lights.filter((l) => l.kind === "SPOT" && (!only || only.test(l.name)) && !inMap.has(l.name)) as (typeof set.info.lights[number] & { angle?: number; blend?: number })[];
  const strong = [...pts].sort((a, b) => b.energy - a.energy || a.name.localeCompare(b.name)).slice(0, castShadow ? maxShadows : 0);
  const ms = Math.min(1024, Math.max(128, Math.round(mapSize)));
  return (
    <>
      {pts.map((l) => {
        const sh = strong.includes(l);
        return (
          <pointLight key={l.name + (sh ? ":s" : "")} position={l.pos} color={new THREE.Color(l.color[0], l.color[1], l.color[2])}
            intensity={(l.energy / (4 * Math.PI * Math.PI)) * k} distance={distance} decay={2} castShadow={sh}
            shadow-mapSize-width={ms} shadow-mapSize-height={ms} shadow-camera-near={0.05} shadow-camera-far={distance} shadow-bias={-0.002} shadow-normalBias={0.03} />
        );
      })}
      {spots.map((l) => (
        <SpotFromSet key={l.name} pos={l.pos as V3} dir={l.dir as V3} color={new THREE.Color(l.color[0], l.color[1], l.color[2])}
          intensity={(l.energy / (4 * Math.PI * Math.PI)) * k} distance={distance} angle={l.angle ?? 0.6} penumbra={l.blend ?? 0.5} />
      ))}
    </>
  );
};

const SpotFromSet: React.FC<{ pos: V3; dir: V3; color: THREE.Color; intensity: number; distance: number; angle: number; penumbra: number }> = ({ pos, dir, color, intensity, distance, angle, penumbra }) => {
  const light = React.useMemo(() => new THREE.SpotLight(), []);
  light.position.set(...pos);
  light.color.copy(color);
  light.intensity = intensity;
  light.distance = distance;
  light.decay = 2;
  light.angle = Math.min(1.5, angle);
  light.penumbra = penumbra;
  light.target.position.set(pos[0] - dir[0], pos[1] - dir[1], pos[2] - dir[2]);
  light.target.updateMatrixWorld();
  return (
    <>
      <primitive object={light} />
      <primitive object={light.target} />
    </>
  );
};
