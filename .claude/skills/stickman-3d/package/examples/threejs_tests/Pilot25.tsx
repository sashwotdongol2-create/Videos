// PILOT: Grave Bell shot 25 re-rendered in three.js with the inkbeat look. The set is the Blender build exported as GLB;
// camera, card positions, card frames and animated props replay per frame from track.json (exported by
// pilot/export_s25.py), so the staging is identical to the Blender render. Every frame is a pure function of the frame.
import React from "react";
import { AbsoluteFill, continueRender, delayRender, staticFile, useCurrentFrame } from "remotion";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { subFrame } from "../inkbeat/core/frame";
import { mk } from "../inkbeat/core/moods";
import { View } from "../inkbeat/core/View";
import { patch, toonRamp } from "../inkbeat/mat/materials";
import type { V3 } from "../inkbeat/types";

type Frame = {
  cam: { pos: V3; look: V3; up: V3; fov: number; focus: number; fstop: number };
  cards: { name: string; pos: V3; scale: number; hidden: boolean }[];
  props: Record<string, { m: number[]; hidden: boolean }>;
};
export type Track = {
  n: number;
  card: { W: number; H: number; anchor: [number, number]; list: { name: string; height: number; tint: string; unit: number }[] };
  anim: string[];
  lights: { name: string; kind: string; dir: V3 }[];
  frames: Frame[];
};

// ---------- one load per browser tab (static data: the same in every tab)
let loadP: Promise<{ track: Track; scene: THREE.Group }> | null = null;
let loaded: { track: Track; scene: THREE.Group } | null = null;
export const getLoaded = () => loaded;
const toToon = (src: THREE.Material): THREE.Material => {
  const s = src as THREE.MeshStandardMaterial;
  const transparent = s.transparent || s.opacity < 0.99;
  const m = new THREE.MeshToonMaterial({
    color: s.color,
    map: s.map ?? null,
    gradientMap: toonRamp(),
    emissive: s.emissive,
    emissiveMap: s.emissiveMap ?? null,
    emissiveIntensity: s.emissiveIntensity * 0.5,
    transparent,
    opacity: s.opacity,
    side: THREE.FrontSide, // Blender exports everything double-sided; inkbeat would ink it as cloth
    alphaTest: s.alphaTest,
  });
  m.userData.triScale = { value: 1 };
  patch(m);
  return m;
};
export const loadAll = () => {
  if (!loadP)
    loadP = Promise.all([
      fetch(staticFile("pilot25/track.json")).then((r) => r.json() as Promise<Track>),
      new GLTFLoader().loadAsync(staticFile("pilot25/scene.glb")),
    ]).then(([track, gltf]) => {
      const cache = new Map<THREE.Material, THREE.Material>();
      gltf.scene.traverse((o) => {
        const me = o as THREE.Mesh;
        if (!me.isMesh) return;
        me.castShadow = true;
        me.receiveShadow = true;
        const conv = (x: THREE.Material) => {
          if (!cache.has(x)) cache.set(x, toToon(x));
          return cache.get(x)!;
        };
        me.material = Array.isArray(me.material) ? me.material.map(conv) : conv(me.material);
        if (/^(smoke|iou)/.test(me.name) || /^(smoke|iou)/.test(me.parent?.name ?? "")) me.castShadow = false;
        // the candy cord is one mesh per 5 cm stripe: object-id edges would ink every stripe boundary
        if (/^cord/.test(me.name) || /^cord/.test(me.parent?.name ?? "")) me.userData.outline = false;
        // snow caps intersect the stones / crosses / fence: their ink flickers
        if (/_snow$|_s$|fenceSnow/.test(me.name) || /_snow$|_s$|fenceSnow/.test(me.parent?.name ?? "")) me.userData.outline = false;
      });
      // decals >= 1 cm proud (the plaque sat 2 mm in front of its board: z-fighting in WebGL)
      const plaque = gltf.scene.getObjectByName("plaque");
      if (plaque) plaque.position.z += 0.015;
      for (const name of track.anim) {
        const node = gltf.scene.getObjectByName(name);
        if (node) node.matrixAutoUpdate = false;
      }
      loaded = { track, scene: gltf.scene };
      return loaded;
    });
  return loadP;
};

// ---------- card frames: one texture per output frame, bounded cache
const texCache = new Map<number, THREE.Texture>();
const texLoader = new THREE.TextureLoader();
export const cardTex = (f: number): Promise<THREE.Texture> => {
  const hit = texCache.get(f);
  if (hit) return Promise.resolve(hit);
  return texLoader.loadAsync(staticFile(`pilot25/bl/s25/cards/wife/${String(f).padStart(4, "0")}.png`)).then((t) => {
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    texCache.set(f, t);
    while (texCache.size > 6) {
      const k = texCache.keys().next().value as number;
      texCache.get(k)!.dispose();
      texCache.delete(k);
    }
    return t;
  });
};

const useAssets = (f: number) => {
  // block the frame SYNCHRONOUSLY (during render) until the GLB + this frame's card texture are loaded, and release it
  // only after the re-render with the assets has committed (continueRender right after setState fires too early)
  const [, bump] = React.useState(0);
  const pending = React.useRef<{ f: number; h: number } | null>(null);
  const tex = texCache.get(f);
  const ready = !!loaded && !!tex;
  if (!ready && pending.current?.f !== f) {
    const h = delayRender("pilot assets " + f);
    pending.current = { f, h };
    Promise.all([loadAll(), cardTex(f)]).then(() => bump((x) => x + 1));
  }
  React.useLayoutEffect(() => {
    if (ready && pending.current) {
      const h = pending.current.h;
      pending.current = null;
      // one more animation frame so the three canvas has drawn the new scene
      requestAnimationFrame(() => continueRender(h));
    }
  });
  return ready ? { ...loaded!, tex: tex! } : null;
};

// ---------- sunrise mood (matches the Blender PAL["sunrise"] sky + warm low sun + pink fill)
export const sunriseMood = (sunDir: V3) =>
  mk({
    note: "sunrise over snow",
    hemi: ["#e0c0f4", "#8a6a9a", 0.55],
    key: ["#ffd6b8", 1.7, sunDir],
    rim: ["#ffe2c8", 1.0, [-sunDir[0], 0.4, -sunDir[2]]],
    fill: ["#ff9ad4", 0.6, [0.7, 0.3, 0.6]],
    prac: ["#ffb050", 4, "#ffe0a0"],
    fog: ["#e0b0e0", 0.003],
    sky: {
      top: "#6f86e8", mid: "#d79ae8", bottom: "#ffc7a6", cloudColor: "#e8a8d8", cloudLit: "#ffe0d0", clouds: 0.3, stars: 0, rays: 0,
      horizon: 0.14, brush: 0.05, sun: { dir: [-0.6, 0.12, -1], color: "#ffd9a0", size: 7 }, sunOn: 0, moon: { dir: [-0.4, 0.45, -1], color: "#e6eaff", size: 4 }, moonOn: 0,
    },
    toon: { shadowTint: [0.92, 0.8, 1.18], hiTint: [1.06, 0.98, 0.96], rimColor: "#ffd0e8" },
    grade: { exposure: 1.05, contrast: 1.16, saturation: 1.25, shadowTint: "#5a4a9a", highlightTint: "#ffe8f4", gain: "#fbf6ff" },
    bloomTint: "#ffd8e8",
    ink: "#1a1424",
    camFill: ["#ffe0f0", 0.15],
    cast: { rim: ["#ffe0c8", 1.8], fill: ["#e8d8ff", 0.6] },
  });

export const Card: React.FC<{ tex: THREE.Texture; pos: V3; scale: number; cam: V3; spec: Track["card"]; item: Track["card"]["list"][0] }> = ({ tex, pos, scale, cam, spec, item }) => {
  const w = spec.W * item.unit;
  const h = spec.H * item.unit;
  // anchor (feet) pixel at the origin
  const ox = -(spec.anchor[0] / spec.W - 0.5) * w;
  const oy = -(0.5 - spec.anchor[1] / spec.H) * h;
  const geo = React.useMemo(() => new THREE.PlaneGeometry(w, h).translate(ox, oy, 0), [w, h, ox, oy]);
  const mat = React.useMemo(() => new THREE.MeshBasicMaterial({ color: item.tint, alphaTest: 0.5, side: THREE.DoubleSide, toneMapped: false, fog: false }), [item.tint]);
  mat.map = tex;
  mat.needsUpdate = true;
  const yaw = Math.atan2(cam[0] - pos[0], cam[2] - pos[2]); // yaw-only billboard (Blender LOCKED_TRACK, lock Z)
  return <mesh geometry={geo} material={mat} position={pos} rotation={[0, yaw, 0]} scale={scale} userData={{ outline: "occlude" }} />;
};

export const Pilot25: React.FC<{ sub?: boolean }> = ({ sub = false }) => {
  const g = useCurrentFrame();
  const { n, fp } = sub ? subFrame(g) : { n: g, fp: g };
  const a = useAssets(n + 1);
  if (!a) return <AbsoluteFill style={{ background: "#2a2040" }} />;
  const T = a.track;
  // sub-frame camera: interpolate between neighbouring exported frames
  const i0 = Math.min(T.n - 1, Math.floor(fp));
  const i1 = Math.min(T.n - 1, i0 + 1);
  const u = fp - Math.floor(fp);
  const F0 = T.frames[i0];
  const F1 = T.frames[i1];
  const lerp = (p: V3, q: V3): V3 => [p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u, p[2] + (q[2] - p[2]) * u];
  const cam = { pos: lerp(F0.cam.pos, F1.cam.pos), look: lerp(F0.cam.look, F1.cam.look), fov: F0.cam.fov + (F1.cam.fov - F0.cam.fov) * u, roll: 0 };
  const F = T.frames[Math.min(T.n - 1, n)];
  for (const name of T.anim) {
    const node = a.scene.getObjectByName(name);
    const p = F.props[name];
    if (!node || !p) continue;
    node.matrix.fromArray(p.m);
    node.visible = !p.hidden;
    node.updateMatrixWorld(true);
  }
  const sun = T.lights.find((l) => l.kind === "SUN");
  const mood = sunriseMood(sun ? sun.dir : [0.4, 0.6, 0.5]);
  const d = new THREE.Vector3(...cam.look).sub(new THREE.Vector3(...cam.pos)).normalize();
  const focus = new THREE.Vector3(...cam.pos).addScaledVector(d, F.cam.focus).toArray() as V3;
  return (
    <AbsoluteFill style={{ background: "#2a2040" }}>
      <View mood={mood} cam={cam} t={fp / 30} focus={focus} blur={1.6} near={0.15} far={250}>
        <primitive object={a.scene} />
        {F.cards.map((c, k) =>
          c.hidden ? null : <Card key={c.name} tex={a.tex} pos={c.pos} scale={c.scale} cam={cam.pos} spec={T.card} item={T.card.list[k]} />,
        )}
      </View>
    </AbsoluteFill>
  );
};
