// Flat-card FALLBACK: the painter's flat character cards (stickman-short look) standing in a three.js set next to the
// 3D stickmen. Use for crowds / background extras and for poses Mixamo cannot do (lie, dead, sit without a chair model).
// `stickman3d.py cards` renders every state of blender/cards_plan.json to public/cards/<id>.png (CardExport.tsx) and
// writes the manifest src/cards.gen.json (+ measured head / extent per card).
//   shot needs:  ...needCards("extra1")             (blocks the frame until those PNGs are decoded)
//   in the View: <Card who="extra1" expr="sad" pose="stand" at={[x, groundY(set, x, z), z]} cam={cam.pos} t={t} tg={tg} />
// Size: a card's standing figure is spec.height (default 1.7 m) from head top to feet, the same as a 3D stickman of
// that height. Feet sit on `at`; yaw-only billboard toward the camera (Blender lib.Card LOCKED_TRACK); hard alpha edge
// (alphaTest 0.5); unlit (MeshBasic, no fog, no tone mapping); the ink pass treats the card as an occluder through its
// alpha (userData.outline 'occlude'), so ink behind it stops at the figure's edge.
// Light: tint "auto" (default) colours the card from the enclosing View's mood (MoodCtx) with the light model of the 3D
// stickman's toon head (autoTint: hemi + key + fill + rim + lens fill through the toon ramp), and drops the key when
// the set shadows the card from it (two rays per frame: rooms). Dim and night sets darken and colour it; an explicit
// tint ("#9a90b0") still works, and "#ffffff" is the old full-bright card.
import { useFrame } from "@react-three/fiber";
import React from "react";
import { staticFile } from "remotion";
import * as THREE from "three";
import { CAST } from "../char/cast";
import { CARD_CONSTANTS } from "../char/drawCharacter";
import type { AnyExpression } from "../char/drawCharacter";
import type { Pose } from "../char/types";
import { blinkAt } from "../char3d/face";
import { useMood } from "../engine/core/View";
import type { MoodPreset } from "../engine/core/moods";
import { toonRamp } from "../engine/mat/materials";
import type { V3 } from "../engine/types";
import MANIFEST from "../cards.gen.json";
import { got } from "./assets";
import type { Need } from "./assets";

// ---------------------------------------------------------------- card constants (shared with CardExport.tsx)
/** every card PNG: CARD_W x CARD_H px, feet line at ANCHOR, painter scale headW = HEAD_W px (same as stickman-short) */
export const CARD_W = 1200;
export const CARD_H = 1300;
export const ANCHOR = { x: 600, y: 1230 };
export const HEAD_W = 300;
/** standing figure height (head top -> feet) in card px: HEADS_TALL * REF_HH * headW / REF_HW (lib.py STAND_PX) */
export const STAND_PX = 3.2 * CARD_CONSTANTS.REF_HH * (HEAD_W / CARD_CONSTANTS.REF_HW);

export type CardEntry = {
  id: number; who: string; expr: string; pose: Pose; blink: number; mouth: number; prop: string | null; facing: 1 | -1;
  /** measured by `stickman3d.py cards` (card px): head top, head centre, horizontal extent of the figure */
  m?: { top: number; hx: number; hy: number; x0: number; x1: number };
};
export const CARDS = MANIFEST as unknown as CardEntry[];

const key = (id: number) => `card:${id}`;
const file = (id: number) => `cards/${id}.png`;

/** the manifest id of one card state (mouth snaps to the nearest exported mouth state) */
export const cardId = (who: string, expr: string, pose: Pose, blink = 0, mouth = 0, prop: string | null = null): number => {
  let best: CardEntry | null = null;
  for (const e of CARDS) {
    if (e.who !== who || e.expr !== expr || e.pose !== pose || e.blink !== blink || (e.prop ?? null) !== (prop ?? null)) continue;
    if (!best || Math.abs(e.mouth - mouth) < Math.abs(best.mouth - mouth)) best = e;
  }
  if (!best) throw new Error(`no card ${who}/${expr}/${pose} blink ${blink} prop ${prop}: add it to blender/cards_plan.json and run \`stickman3d.py cards\``);
  return best.id;
};

/** needs for every card state of `who` (optionally only some exprs / poses): put them in the shot's needs */
export const needCards = (who: string, only?: { exprs?: string[]; poses?: Pose[] }): Need[] => {
  const L = CARDS.filter((e) => e.who === who && (!only?.exprs || only.exprs.includes(e.expr)) && (!only?.poses || only.poses.includes(e.pose)));
  if (L.length === 0) throw new Error(`no cards for "${who}" in src/cards.gen.json: add it to blender/cards_plan.json and run \`stickman3d.py cards\``);
  return L.map((e): Need => [
    key(e.id),
    () =>
      new Promise<HTMLImageElement>((ok, bad) => {
        const img = new Image();
        img.onload = () => ok(img);
        img.onerror = () => bad(new Error(`card PNG missing: public/${file(e.id)} (run \`stickman3d.py cards\`)`));
        img.src = staticFile(file(e.id));
      }).then((img) => img.decode().then(() => img)),
  ]);
};

// ---------------------------------------------------------------- bounded GPU cache (decoded images stay in assets.ts)
const MAX_TEX = 32;
const texs = new Map<number, THREE.Texture>();
const mats = new Map<string, THREE.MeshBasicMaterial>();
const texFor = (id: number): THREE.Texture => {
  let t = texs.get(id);
  if (t) {
    texs.delete(id); // LRU: re-insert as newest
    texs.set(id, t);
    return t;
  }
  t = new THREE.Texture(got<HTMLImageElement>(key(id)));
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.needsUpdate = true;
  texs.set(id, t);
  while (texs.size > MAX_TEX) {
    const old = texs.keys().next().value as number;
    for (const [k, m] of mats) if (k.startsWith(old + "|")) (m.dispose(), mats.delete(k));
    texs.get(old)!.dispose();
    texs.delete(old);
  }
  return t;
};
const MAX_MATS = 96; // auto tints are quantized (1/64 per channel), so a moving camera makes only a few per card
const matFor = (id: number, tint: string): THREE.MeshBasicMaterial => {
  const tex = texFor(id);
  const k = `${id}|${tint}`;
  let m = mats.get(k);
  if (m) {
    mats.delete(k); // LRU: re-insert as newest
  } else {
    m = new THREE.MeshBasicMaterial({ map: tex, color: tint, alphaTest: 0.5, side: THREE.DoubleSide, toneMapped: false, fog: false });
  }
  mats.set(k, m);
  while (mats.size > MAX_MATS) {
    const old = mats.keys().next().value as string;
    mats.get(old)!.dispose();
    mats.delete(old);
  }
  return m;
};

// ---------------------------------------------------------------- automatic light from the mood
/** overall scale of the automatic card light (1 = the same light model as the 3D stickman's toon head; checked
 *  against a 3D head beside the card: parlour / graveyard night / graveyard sunrise came out 3-5 % darker at 1.0) */
export const CARD_LIGHT_CAL = 1.05;
const col = (hex: string, k: number) => new THREE.Color(hex).multiplyScalar(k);
// the toon ramp (engine/mat/materials toonRamp) averaged over a round figure's visible half, per channel, for the
// cosine between the view direction and the light: what a directional light gives a 3D head facing the lens
let AV: Float32Array | null = null;
const AVN = 33;
const buildAV = (): Float32Array => {
  const d = toonRamp().image.data as Uint8Array;
  const N = d.length / 4;
  const out = new Float32Array(AVN * 3);
  for (let k = 0; k < AVN; k++) {
    const c = -1 + (2 * k) / (AVN - 1);
    const lx = Math.sqrt(Math.max(0, 1 - c * c));
    let w = 0;
    const acc = [0, 0, 0];
    for (let i = 0; i < 16; i++) {
      const th = ((i + 0.5) / 16) * (Math.PI / 2); // angle from the view axis
      for (let j = 0; j < 32; j++) {
        const ph = ((j + 0.5) / 32) * 2 * Math.PI;
        const wt = Math.cos(th) * Math.sin(th); // projected area x solid angle
        const x = (Math.sin(th) * Math.cos(ph) * lx + Math.cos(th) * c) * 0.5 + 0.5;
        const f = x * (N - 1);
        const i0 = Math.min(N - 2, Math.floor(f));
        const u = f - i0;
        for (let ch = 0; ch < 3; ch++) acc[ch] += wt * ((d[i0 * 4 + ch] * (1 - u) + d[(i0 + 1) * 4 + ch] * u) / 255);
        w += wt;
      }
    }
    for (let ch = 0; ch < 3; ch++) out[k * 3 + ch] = acc[ch] / w;
  }
  return out;
};
const rampAvg = (cosNL: number): [number, number, number] => {
  const T = (AV ??= buildAV());
  const f = ((Math.min(1, Math.max(-1, cosNL)) + 1) / 2) * (AVN - 1);
  const k0 = Math.min(AVN - 2, Math.floor(f));
  const u = f - k0;
  const at = (ch: number) => T[k0 * 3 + ch] * (1 - u) + T[(k0 + 1) * 3 + ch] * u;
  return [at(0), at(1), at(2)];
};
const dirLight = (n: THREE.Vector3, hex: string, I: number, dir: V3): THREE.Color => {
  const r = rampAvg(n.dot(new THREE.Vector3(...dir).normalize()));
  const c = new THREE.Color(hex).multiplyScalar(I);
  return new THREE.Color(c.r * r[0], c.g * r[1], c.b * r[2]);
};
/** the colour (hex, sRGB) an unlit card is multiplied by to sit in `mood` at `at`, seen from `cam`, the way three lights
 *  the 3D stickman's toon head: hemisphere (a vertical figure: the mid of sky and ground) + key (times `keyVis`: 0 when
 *  the set shadows the card from the key, e.g. indoors) + fill + rim + the lens-side fill, each through the toon ramp
 *  averaged over a round figure facing the lens, over pi (Lambert), plus the head's own 0.18 glow. Max 1 per channel. */
export const autoTint = (mood: MoodPreset, at: V3, cam: V3, keyVis = 1): string => {
  const L = mood.lights;
  const n = new THREE.Vector3(cam[0] - at[0], 0, cam[2] - at[2]);
  if (n.lengthSq() < 1e-8) n.set(0, 0, 1);
  n.normalize();
  // the View's lens fill comes from beside and above the camera (engine/core/View CamFill)
  const camDir: V3 = [n.x * 0.9, 0.42, n.z * 0.9];
  const E = new THREE.Color(0, 0, 0)
    .add(col(L.hemi.sky, 0.5 * L.hemi.intensity).add(col(L.hemi.ground, 0.5 * L.hemi.intensity)))
    .add(dirLight(n, L.key.color, L.key.intensity * keyVis, L.key.dir))
    .add(dirLight(n, L.fill.color, L.fill.intensity, L.fill.dir))
    .add(dirLight(n, L.rim.color, L.rim.intensity, L.rim.dir))
    .add(dirLight(n, mood.camFill.color, mood.camFill.intensity, camDir))
    .multiplyScalar(1 / Math.PI)
    .add(col("#fff6f2", 0.18))
    .multiplyScalar(CARD_LIGHT_CAL);
  const q = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 64) / 64;
  return "#" + new THREE.Color(q(E.r), q(E.g), q(E.b)).getHexString();
};

// key-light visibility of a card: rays from its chest and head toward the key against everything that casts shadows
const kRay = new THREE.Raycaster();
const keyVisibility = (scene: THREE.Object3D, self: THREE.Object3D | null, at: V3, H: number, cam: V3, keyDir: V3): number => {
  const mine = new Set<THREE.Object3D>();
  self?.traverse((o) => mine.add(o));
  const occ: THREE.Object3D[] = [];
  scene.traverseVisible((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && m.castShadow && !(o as THREE.InstancedMesh).isInstancedMesh && !mine.has(o)) occ.push(o);
  });
  const d = new THREE.Vector3(...keyDir).normalize();
  const toCam = new THREE.Vector3(cam[0] - at[0], 0, cam[2] - at[2]).normalize().multiplyScalar(0.05);
  let lit = 0;
  for (const h of [0.55, 0.85]) {
    kRay.set(new THREE.Vector3(at[0], at[1] + h * H, at[2]).add(toCam), d);
    kRay.near = 0.02;
    kRay.far = 80;
    if (kRay.intersectObjects(occ, false).length === 0) lit += 0.5;
  }
  return lit;
};

// one plane for a 1 m standing figure, feet anchor at the origin; scaled by the character height
const PLANE = new THREE.PlaneGeometry(CARD_W / STAND_PX, CARD_H / STAND_PX).translate(
  -(ANCHOR.x / CARD_W - 0.5) * (CARD_W / STAND_PX),
  -(0.5 - ANCHOR.y / CARD_H) * (CARD_H / STAND_PX),
  0,
);
const BLOB = new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2);
const SHADOW = new THREE.MeshBasicMaterial({ color: "#3a2a5a", transparent: true, opacity: 0.22, depthWrite: false, fog: false });

export type CardExprKey = { at: number; e: AnyExpression };
export type CardProps = {
  who: string;
  /** an expression, or a schedule [{at: shot seconds, e}] (needs t) */
  expr: AnyExpression | CardExprKey[];
  pose: Pose;
  /** feet position (use groundY) */
  at: V3;
  /** camera position: the card turns about Y to face it */
  cam: V3;
  /** 0/1 = fixed; omitted = automatic blinks from tg (when the card has blink states) */
  blink?: number;
  /** talking mouth 0..1 (nearest exported state; needs mouth: true in cards_plan.json) */
  mouth?: number;
  /** extra yaw in rad on top of the billboard (small turns only: a card seen edge-on disappears) */
  yaw?: number;
  /** 1 = as drawn, -1 = mirrored (faces the other way) */
  facing?: 1 | -1;
  /** figure height in m (head top -> feet when standing); default the cast's height (1.7) */
  height?: number;
  /** "auto" (default): light from the View's mood (autoTint); or a fixed multiply colour, e.g. "#9a90b0"
   *  ("#ffffff" = full-bright, the old default) */
  tint?: string;
  prop?: string | null;
  /** shot seconds (expr schedule) and global seconds (blinks) */
  t?: number;
  tg?: number;
  /** contact shadow under the card (default true) */
  shadow?: boolean;
  /** 0..1 of the camera's down-angle the card leans back about its feet line, so a lying figure reads as ON the floor
   *  (default 1 for lie / dead, 0 otherwise: standing cards stay upright like Blender's LOCKED_TRACK) */
  lay?: number;
};

const exprAt = (e: CardProps["expr"], t: number): string => {
  if (typeof e === "string") return e;
  let cur = e[0].e;
  for (const k of e) if (t >= k.at) cur = k.e;
  return cur;
};

/** world position of the card's head centre (from the measured PNG) for a card with its feet at `at` */
export const cardHead = (who: string, expr: string, pose: Pose, at: V3, cam: V3, height?: number): V3 => {
  const e = CARDS[cardId(who, expr, pose)];
  const H = height ?? CAST[who]?.height ?? 1.7;
  const u = H / STAND_PX;
  const m = e.m ?? { hx: ANCHOR.x, hy: ANCHOR.y - STAND_PX + 0.2 * STAND_PX, top: 0, x0: 0, x1: 0 };
  const yaw = Math.atan2(cam[0] - at[0], cam[2] - at[2]);
  const dx = (m.hx - ANCHOR.x) * u;
  return [at[0] + Math.cos(yaw) * dx, at[1] + (ANCHOR.y - m.hy) * u, at[2] - Math.sin(yaw) * dx];
};

export const Card: React.FC<CardProps> = (p) => {
  const H = p.height ?? CAST[p.who]?.height ?? 1.7;
  const ex = exprAt(p.expr, p.t ?? 0);
  const seed = p.who.length * 7 + p.who.charCodeAt(0);
  const wantBlink = p.blink ?? (p.tg !== undefined && ex !== "shocked" && blinkAt(p.tg, seed) ? 1 : 0);
  let id: number;
  try {
    id = cardId(p.who, ex, p.pose, wantBlink, p.mouth ?? 0, p.prop ?? null);
  } catch (err) {
    if (wantBlink === 0) throw err;
    id = cardId(p.who, ex, p.pose, 0, p.mouth ?? 0, p.prop ?? null); // no blink state exported: keep eyes open
  }
  const e = CARDS[id];
  const mood = useMood();
  const auto = !p.tint || p.tint === "auto";
  const tint = auto ? (mood ? autoTint(mood, p.at, p.cam) : "#ffffff") : p.tint!;
  const grp = React.useRef<THREE.Group>(null);
  const card = React.useRef<THREE.Mesh>(null);
  // auto light: once the frame's scene graph is complete (useFrame, before the post chain draws), test whether the set
  // shadows the card from the key, and pick the material for that light
  useFrame(({ scene }) => {
    if (!auto || !mood || !card.current) return;
    const K = mood.lights.key;
    const vis = K.castShadow && K.intensity > 0.001 ? keyVisibility(scene, grp.current, p.at, H, p.cam, K.dir) : 1;
    card.current.material = matFor(id, autoTint(mood, p.at, p.cam, vis));
  });
  const yaw = Math.atan2(p.cam[0] - p.at[0], p.cam[2] - p.at[2]) + (p.yaw ?? 0);
  const f = p.facing ?? 1;
  const lay = p.lay ?? (p.pose === "lie" || p.pose === "dead" ? 1 : 0);
  const pitch = lay * Math.atan2(p.cam[1] - p.at[1], Math.hypot(p.cam[0] - p.at[0], p.cam[2] - p.at[2]));
  // contact shadow: across the measured figure width (lying cards get a long one), shallow in depth
  const u = H / STAND_PX;
  const x0 = e.m ? e.m.x0 : ANCHOR.x - 0.12 * STAND_PX;
  const x1 = e.m ? e.m.x1 : ANCHOR.x + 0.12 * STAND_PX;
  const half = Math.max(0.16 * H, ((x1 - x0) / 2) * u * 0.9);
  const cx = ((x0 + x1) / 2 - ANCHOR.x) * u * f;
  return (
    <group ref={grp} position={p.at} rotation={[0, yaw, 0]}>
      <mesh ref={card} geometry={PLANE} material={matFor(id, tint)} rotation={[-pitch, 0, 0]} scale={[H * f, H, H]} userData={{ outline: "occlude" }} />
      {p.shadow === false ? null : (
        <mesh geometry={BLOB} material={SHADOW} position={[cx, 0.004, 0]} scale={[half, 1, 0.16 * H]} userData={{ outline: false }} />
      )}
    </group>
  );
};
