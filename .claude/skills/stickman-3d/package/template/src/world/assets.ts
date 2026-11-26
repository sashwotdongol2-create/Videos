// Asset loading that is safe for Remotion's multi-tab rendering.
// RULE (learned the hard way in the pilot): block the frame SYNCHRONOUSLY during render with delayRender, and release it
// only after the re-render WITH the assets has committed (+1 animation frame). A delayRender taken inside an effect, or a
// continueRender fired right after setState, lets Remotion capture the loading fallback (whole-frame flicker).
import React from "react";
import { continueRender, delayRender, staticFile } from "remotion";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { patch, toonRamp } from "../engine/mat/materials";

const cache = new Map<string, unknown>();
const pending = new Map<string, Promise<unknown>>();

/** start (once per tab) loading `key` with `fn`; the value stays cached for the tab's lifetime */
export const load = <T,>(key: string, fn: () => Promise<T>): Promise<T> => {
  if (!pending.has(key)) pending.set(key, fn().then((v) => (cache.set(key, v), v)));
  return pending.get(key) as Promise<T>;
};
export const got = <T,>(key: string): T => {
  if (!cache.has(key)) throw new Error(`asset ${key} not loaded: list it in the shot's needs`);
  return cache.get(key) as T;
};
export const has = (key: string) => cache.has(key);

export type Need = [key: string, fn: () => Promise<unknown>];

/** true once every need is loaded; until then the frame is blocked (delayRender) and the caller renders a fallback */
export const useNeeds = (needs: Need[]): boolean => {
  const [, bump] = React.useState(0);
  const handle = React.useRef<number | null>(null);
  const missing = needs.filter(([k]) => !cache.has(k));
  if (missing.length > 0 && handle.current === null) {
    handle.current = delayRender("assets: " + missing.map(([k]) => k).join(", "), { timeoutInMilliseconds: 240000 });
    Promise.all(missing.map(([k, f]) => load(k, f))).then(() => bump((x) => x + 1));
  }
  React.useLayoutEffect(() => {
    if (missing.length === 0 && handle.current !== null) {
      const h = handle.current;
      handle.current = null;
      requestAnimationFrame(() => continueRender(h));
    }
  });
  return missing.length === 0;
};

// ------------------------------------------------------------------ GLB + toon conversion
const loader = new GLTFLoader();
export const loadGLB = (path: string): Promise<GLTF> => loader.loadAsync(staticFile(path));

/** inkbeat toon material that keeps a Blender material's colour / texture / emission */
export const toToon = (src: THREE.Material, emissiveScale = 0.5): THREE.Material => {
  const s = src as THREE.MeshStandardMaterial;
  const m = new THREE.MeshToonMaterial({
    color: s.color,
    map: s.map ?? null,
    gradientMap: toonRamp(),
    emissive: s.emissive,
    emissiveMap: s.emissiveMap ?? null,
    emissiveIntensity: (s.emissiveIntensity ?? 1) * emissiveScale,
    transparent: s.transparent || s.opacity < 0.99,
    opacity: s.opacity,
    side: THREE.FrontSide, // Blender exports everything double-sided; double-sided meshes get inked as cloth
    alphaTest: s.alphaTest,
  });
  m.name = s.name; // shots find set materials by their Blender name (e.g. winLit)
  m.userData.triScale = { value: 1 };
  // PBR detail from Blender (sets.pbr_mat, Poly Haven assets): the normal map shades the toon ramp; roughness (the glTF
  // metallicRoughness texture, G channel, carried in the unused aoMap slot) drives a small key-light highlight
  if (s.normalMap) {
    m.normalMap = s.normalMap;
    m.normalScale.copy(s.normalScale ?? new THREE.Vector2(1, 1));
  }
  const rough = s.roughness ?? 1;
  m.userData.rough = { value: rough };
  if (s.roughnessMap || rough < 0.95) {
    if (s.roughnessMap) m.aoMap = s.roughnessMap;
    m.defines = { ...(m.defines ?? {}), TOON_SPEC: "" };
  }
  patch(m);
  return m;
};
export const toonColor = (color: string, emissive?: string, emissiveIntensity = 0) => {
  const m = new THREE.MeshToonMaterial({ color, gradientMap: toonRamp() });
  if (emissive) {
    m.emissive.set(emissive);
    m.emissiveIntensity = emissiveIntensity;
  }
  m.userData.triScale = { value: 1 };
  patch(m);
  return m;
};
