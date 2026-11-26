// Sets exported from Blender (blender/export.py -> public/sets/<name>_<state>.glb + .json).
// The WebGL rules from the pilot are applied here: toon materials, front-side only, no ink on objects marked no_ink in
// Blender (glTF extras) or matching NO_INK names, shadows on, and a ground ray for feet. Light shafts tagged o["beam"]
// in Blender (sets.py light_beam) are redrawn here as additive, unlit, ink-free, shadowless glow (beamMaterial): glTF
// cannot carry Blender's transparent-mix shader and would deliver an opaque slab.
// Draw a set with <primitive object={useSetScene(set)} />, never set.scene: during a dissolve two shots render in two
// canvases at once and a THREE object has one parent, so each shot gets its own clone (shared geometry + materials).
import React from "react";
import { staticFile } from "remotion";
import * as THREE from "three";
import type { V3 } from "../engine/types";
import { got, load, loadGLB, toToon } from "./assets";
import type { Need } from "./assets";
import { ShotCtx } from "./registry";

export type SetInfo = {
  set: string;
  state: string;
  anchors: Record<string, V3>;
  lights: { name: string; kind: string; color: number[]; energy: number; pos: V3; dir: V3 }[];
  warnings: string[];
  /** export --light: one lightmap atlas (rgb = sRGB(irradiance / k): every bounce, the sky, emissive surfaces, area /
   *  point / spot lights, NOT the sun's direct light; a = AO 1 m) and per-node the UV channel that maps into it */
  lightmap?: { file: string; k: number; size: [number, number]; direct: string[]; entries: Record<string, { uv: number; rect: number[] }> } | null;
};
export type LoadedSet = { scene: THREE.Group; info: SetInfo; ground: THREE.Mesh[] };

/** names that never get post ink (thin / striped / many-part decoration); the parent name is checked too, because a
 *  multi-material mesh arrives as a Group whose children carry suffixed names */
export const NO_INK = /cord|_snow$|_s$|Snow|grass|flake|smoke|puff|^iou|rope/i;

// ------------------------------------------------------------------ light shafts (o["beam"] in Blender)
const BEAM_VERT = `varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
// u across the width: (2 * pingpong(u))^2 like the Blender node graph (bright core, soft edges); v along the shaft:
// soft at both ends so it never ends in a hard line
const BEAM_FRAG = `uniform vec3 uColor; uniform float uK; varying vec2 vUv;
void main() {
  float a = 1.0 - abs(vUv.x * 2.0 - 1.0);
  float e = smoothstep(0.0, 0.18, vUv.y) * smoothstep(1.0, 0.7, vUv.y);
  gl_FragColor = vec4(uColor * (uK * a * a * e), 1.0);
}`;
/** peak added brightness of a beam per unit of its Blender strength (strength 1.6 -> +0.26 x its colour at the core) */
export const BEAM_GAIN = 0.16;
const beamMats = new Map<string, THREE.ShaderMaterial>();
/** additive unlit light shaft: transparent + no depth write, so the ink, depth (DOF) and shadow passes skip it */
export const beamMaterial = (color: string, strength = 1.2): THREE.ShaderMaterial => {
  const k = `${color}|${strength}`;
  let m = beamMats.get(k);
  if (!m) {
    m = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(color) }, uK: { value: strength * BEAM_GAIN } },
      vertexShader: BEAM_VERT,
      fragmentShader: BEAM_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    m.name = "beam";
    beamMats.set(k, m);
  }
  return m;
};

type LM = { tex: THREE.Texture; k: number; uv: number };
/** the lightmap of a mesh: its own node name, or (a multi-material mesh = Group of meshes) its parent's */
const lmFor = (me: THREE.Mesh, lms: Map<string, LM>): LM | undefined => {
  const own = lms.get(me.name);
  if (own) return own;
  const par = me.parent;
  if (par && !(par as THREE.Mesh).isMesh && par.children.length > 1 && par.children.every((c) => (c as THREE.Mesh).isMesh)) return lms.get(par.name);
  return undefined;
};
/** baked light on a set material: a per-mesh toon material with the lightmap (engine/mat/materials.ts reads it:
 *  hemi x hemiKeep, unshadowed fills x fillKeep x AO, + lightmap x lmGain; the sun / key stays live) */
const withLightmap = (src: THREE.Material, lm: LM): THREE.Material => {
  const m = toToon(src) as THREE.MeshToonMaterial;
  m.lightMap = lm.tex;
  m.lightMapIntensity = lm.k * Math.PI; // Cycles diffuse irradiance -> three's irradiance (BRDF_Lambert divides by pi)
  return m;
};

const prep = (scene: THREE.Group, lms: Map<string, LM> = new Map()) => {
  const conv = new Map<THREE.Material, THREE.Material>();
  const lmConv = new Map<string, THREE.Material>();
  const ground: THREE.Mesh[] = [];
  scene.traverse((o) => {
    const me = o as THREE.Mesh;
    if (!me.isMesh) return;
    const beam = me.userData.beam ? me.userData : me.parent?.userData.beam ? me.parent.userData : null;
    if (beam) {
      // not ground, not a lens blocker (groundY / lensClear read `ground`), no shadow, no ink, drawn after the set
      me.material = beamMaterial(String(beam.beam_color ?? "#c9d4ff"), Number(beam.beam_strength ?? 1.2));
      me.castShadow = false;
      me.receiveShadow = false;
      me.userData.outline = false;
      me.renderOrder = 10;
      return;
    }
    const ud = { ...(me.parent?.userData ?? {}), ...me.userData };
    if (ud.sky) {
      // a photographic sky dome (blender ready.sky_dome / o["sky"]): its own picture, unlit, never fogged, inked,
      // shadowed or "ground" (restored 2026-11-19 from survivor v1: the template had lost it)
      const src = (Array.isArray(me.material) ? me.material[0] : me.material) as THREE.MeshStandardMaterial;
      const map = src.map ?? src.emissiveMap ?? null;
      // the mood grade lifts exposure (day ~x2): pre-dim the photo so it lands near its own colours (survivor3: x1 read pale);
      // a set may set o["sky_gain"] (0..1, default 0.55)
      const g = Number(ud.sky_gain ?? 0.55);
      me.material = new THREE.MeshBasicMaterial({ map, color: map ? new THREE.Color(g, g, g) : src.color, fog: false, toneMapped: false, side: THREE.DoubleSide, depthWrite: false });
      me.castShadow = false;
      me.receiveShadow = false;
      me.userData.outline = false;
      me.renderOrder = -10;
      me.frustumCulled = false;
      return;
    }
    me.castShadow = true;
    me.receiveShadow = true;
    const lm = lmFor(me, lms);
    const uvName = lm ? (lm.uv === 0 ? "uv" : `uv${lm.uv}`) : "";
    if (lm && !me.geometry.getAttribute(uvName)) console.error(`LIGHTMAP: ${me.name} has no ${uvName} (lightmap UV): not lit by the bake`);
    const c = (m: THREE.Material) => {
      if (lm && me.geometry.getAttribute(uvName)) {
        const key = `${m.uuid}|${lm.uv}`;
        if (!lmConv.has(key)) lmConv.set(key, withLightmap(m, lm));
        return lmConv.get(key)!;
      }
      if (!conv.has(m)) conv.set(m, toToon(m));
      return conv.get(m)!;
    };
    me.material = Array.isArray(me.material) ? me.material.map(c) : c(me.material);
    const par = me.parent?.name ?? "";
    // "noink": never inked, but (with the default setInk false) still in the depth / normal pass for DOF and SSAO
    if (me.userData.no_ink || me.parent?.userData.no_ink || NO_INK.test(me.name) || NO_INK.test(par)) me.userData.outline = "noink";
    ground.push(me);
  });
  return ground;
};

export const setKey = (name: string, state: string) => `set:${name}_${state}`;
export const needSet = (name: string, state: string): Need => [
  setKey(name, state),
  () =>
    Promise.all([
      loadGLB(`sets/${name}_${state}.glb`),
      fetch(staticFile(`sets/${name}_${state}.json`))
        .then((r) => (r.ok ? (r.json() as Promise<SetInfo>) : null))
        .catch(() => null),
    ]).then(async ([g, info]) => {
      const lms = new Map<string, LM>();
      const L = info?.lightmap;
      if (L) {
        const base = await new THREE.TextureLoader().loadAsync(staticFile(`sets/${L.file}`));
        const byUv = new Map<number, THREE.Texture>();
        for (const [node, e] of Object.entries(L.entries)) {
          // one texture object per UV channel (texture.channel picks uv / uv1 / uv2 ...), same image
          let tex = byUv.get(e.uv);
          if (!tex) {
            tex = byUv.size ? base.clone() : base;
            tex.flipY = false; // glTF UV convention (like GLTFLoader's own textures)
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.channel = e.uv;
            tex.generateMipmaps = false; // mips would bleed the 4 px gaps between atlas tiles at a distance
            tex.minFilter = THREE.LinearFilter;
            tex.magFilter = THREE.LinearFilter;
            tex.needsUpdate = true;
            byUv.set(e.uv, tex);
          }
          lms.set(node, { tex, k: L.k, uv: e.uv });
        }
      }
      const ground = prep(g.scene, lms);
      return { scene: g.scene, info: info ?? { set: name, state, anchors: {}, lights: [], warnings: [] }, ground } as LoadedSet;
    }),
];
export const getSet = (name: string, state: string) => got<LoadedSet>(setKey(name, state));
export const preloadSet = (name: string, state: string) => load(...needSet(name, state));

// ------------------------------------------------------------------ per-shot scene clones
const MAX_CLONES = 12; // a tab draws at most 2 shots at once (dissolve); 12 keeps a short film's sets warm
const clones = new Map<string, THREE.Group>();
/** the scene instance of `s` for shot `shotId` (clone(true): geometry and materials are shared, nodes are not).
 *  Bounded LRU; an evicted clone is only dropped (nothing shared is disposed). */
export const sceneFor = (s: LoadedSet, shotId: number): THREE.Group => {
  const k = `${setKey(s.info.set, s.info.state)}#${shotId}`;
  let c = clones.get(k);
  if (c) {
    clones.delete(k); // LRU: re-insert as newest
  } else {
    c = s.scene.clone(true);
    c.updateMatrixWorld(true);
  }
  clones.set(k, c);
  while (clones.size > MAX_CLONES) clones.delete(clones.keys().next().value as string);
  return c;
};
/** this shot's own copy of the set scene (shot id from ShotCtx, provided by Film): render it with
 *  <primitive object={useSetScene(set)} />. Animated set nodes (poseNode, glowMeshes, getObjectByName) must be looked
 *  up in THIS clone, not in set.scene. groundY / lensClear keep using the loaded set (rest pose). */
export const useSetScene = (s: LoadedSet): THREE.Group => sceneFor(s, React.useContext(ShotCtx));

const ray = new THREE.Raycaster();
const DOWN = new THREE.Vector3(0, -1, 0);
/** height of the surface under (x, z): a ray straight down from `from` m (default 1.6: below any ceiling, so interiors
 *  hit the floor, not the roof; raise it on hills or roofs); `fallback` if nothing is hit */
export const groundY = (s: LoadedSet, x: number, z: number, fallback = 0, from = 1.6): number => {
  ray.set(new THREE.Vector3(x, from, z), DOWN);
  ray.far = from + 30;
  s.scene.updateMatrixWorld(true);
  const hit = ray.intersectObjects(s.ground, false)[0];
  return hit ? hit.point.y : fallback;
};
/** the exported sun direction (toward the light) for a mood's key light */
/** true when the set brings its own photographic sky dome: draw the View with sky={false} */
export const hasSkyDome = (s: LoadedSet) => { let k = false; s.scene.traverse((o) => { if (o.userData.sky) k = true; }); return k; };
export const sunDir = (s: LoadedSet, fallback: V3 = [0.4, 0.6, 0.5]): V3 => s.info.lights.find((l) => l.kind === "SUN")?.dir ?? fallback;
