// The 3D head's face: the flat cards' own painter (src/char/drawCharacter.ts -> drawFaceDecal) draws brows, eyes, mouth
// and glasses / beard / moustache onto a canvas that is projected on the front of the head. Same 24 expressions, same
// blinks and talking mouths as the cards, so a film can mix 3D characters and cards.
import * as THREE from "three";
import { drawFaceDecal, FACE_SPAN } from "../char/drawCharacter";
import type { AnyExpression } from "../char/drawCharacter";
import type { CharacterSpec } from "../char/types";

const texs = new Map<string, THREE.CanvasTexture>();
const mats = new Map<THREE.Texture, THREE.MeshBasicMaterial>();

export const faceMaterial = (spec: CharacterSpec, expr: AnyExpression, blink: boolean, mouth: number): THREE.MeshBasicMaterial => {
  const key = `${spec.id}|${expr}|${blink ? 1 : 0}|${mouth}`;
  let t = texs.get(key);
  if (!t) {
    const c = document.createElement("canvas");
    drawFaceDecal(c.getContext("2d")!, spec, { expr, pose: "stand", facing: 1, blink: blink ? 1 : 0, mouthOpen: mouth, walkPhase: 0 }, 512);
    t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    texs.set(key, t);
  }
  let m = mats.get(t);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ map: t, transparent: true, alphaTest: 0.35, depthWrite: false, toneMapped: false, fog: false });
    mats.set(t, m);
  }
  return m;
};

/** the front patch of a unit sphere (r 1.004) with PLANAR uvs matching the decal canvas (FACE_SPAN head widths) */
let patchGeo: THREE.SphereGeometry | null = null;
export const facePatch = () => {
  if (patchGeo) return patchGeo;
  const g = new THREE.SphereGeometry(1.004, 48, 32, Math.PI / 2 - 1.25, 2.5, Math.PI / 2 - 1.1, 2.2);
  const p = g.attributes.position;
  const uv = g.attributes.uv;
  const span = FACE_SPAN * 2; // head diameter = 2 units
  for (let i = 0; i < p.count; i++) uv.setXY(i, 0.5 + p.getX(i) / span, 0.5 + p.getY(i) / span);
  uv.needsUpdate = true;
  patchGeo = g;
  return g;
};

/** deterministic blinks every 0.5-2.3 s, eyes shut for 3 frames (measured on the reference), seeded per character;
 *  t = global film seconds */
export const blinkAt = (t: number, seed: number) => {
  const f = Math.floor(t * 30);
  let s = 0;
  let k = (seed * 97 + 1) % 2147483647 || 1;
  while (s <= f) {
    k = (k * 16807) % 2147483647;
    const gap = 15 + (k % 54);
    if (f >= s + gap && f < s + gap + 3) return true;
    s += gap + 3;
  }
  return false;
};
