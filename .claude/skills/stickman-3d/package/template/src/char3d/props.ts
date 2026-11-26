// Held props: real 3D models (public/props/<id>.glb from `stickman3d.py prop <id> <file.blend|glb>`), normalised so the
// long axis is +Y, the WORKING END (blade, head, bottom) sits at y = 0 and the length is `length` metres.
// Grip modes (RULES.md -> props); Stickman.tsx (holdFor) places them and swings the shaft clear of skirt, legs and body:
//   carry : one hand (right) holds the shaft at `carry` (fraction from the working end); the working end hangs low,
//           forward and a little OUT to the side, above the ground; never crosses the legs while walking
//   two   : both hands on the shaft; the top hand (higher and further back) at `two`; the angle comes from the two hand
//           positions, fading to a default (working end forward and low) when the hands come level or together; the
//           other hand goes onto the shaft after the shaft swings clear of the body
//   palm  : small props (cup, phone, book): centred in the right hand, upright
//   plant : a long tool standing on its working end ~0.3 m right of and 0.14 m ahead of the right foot, shaft up to the right hand (a
//           shovel at rest); the foot of the shaft steps outward until the shaft clears a skirt
//   none  : not shown
// Mode keys cross-fade over 0.4 s by turning the shaft about the drawn right hand (Stickman.tsx solve).
import * as THREE from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { got, loadGLB, toToon } from "../world/assets";
import type { Need } from "../world/assets";

/** grips: named grip points in the normalised frame (metres; +Y = the long axis, origin = working end / base), e.g.
 *  a mop { lo: [0, 0.7, 0] }, a drawer { knob: [0, 0.12, 0.2] } (reach.tsx gripAt). keep: do not turn the longest
 *  axis to +Y (cabinets, drawers, cups with a handle): the model keeps its own axes, base at y = 0, centred in x / z,
 *  and `length` is its HEIGHT. */
export type PropSpec = { length: number; carry: number; two: number; grips?: Record<string, [number, number, number]>; keep?: boolean;
  /** a hand gun: held by `grips.hand` wrapped in the hand, barrel along the forearm / aim line, top (`up`, the local
   *  direction of the slide's top in the normalised frame) up; palm / low / two / aim / behind become gun holds */
  gun?: boolean; up?: [number, number, number] };
/** per-prop numbers; add an entry when you add public/props/<id>.glb */
export const PROPS: Record<string, PropSpec> = {
  shovel: { length: 0.95, carry: 0.62, two: 0.9, grips: { lo: [0, 0.5, 0] } },
  lantern: { length: 0.32, carry: 0.95, two: 0.9 },
  cup: { length: 0.1, carry: 0.5, two: 0.5 },
  book: { length: 0.24, carry: 0.5, two: 0.5 },
  rifle: { length: 1.0, carry: 0.55, two: 0.75 },
  // Sarajevo (blender/assets/pistol.blend, grenade.blend from sj_props.blend; PROPS.md). pistol: FN M1910-style, the long
  // axis is the barrel, working end (y = 0) = the MUZZLE, the grip at the far end below the barrel line (-z); hand =
  // the middle of the grip, trigger = the trigger guard. grenade: round bomb, base at y = 0, cap on top.
  // measured on the GLB (16 x 7.5 x 2.9 cm): the normalisation turns its height (+Y in the GLB) into local -X, so the
  // slide's top is local -X and the grip handle hangs toward +X at the rear (y 0.11-0.155)
  pistol: { length: 0.155, carry: 0.88, two: 0.88, gun: true, up: [-1, 0, 0], grips: { hand: [0.016, 0.132, 0], trigger: [0.004, 0.11, 0], muzzle: [0, 0, 0] } },
  grenade: { length: 0.12, carry: 0.45, two: 0.45, grips: { palm: [0, 0.05, 0], cap: [0, 0.115, 0] } },
};
/** aim    : (pistol) the right arm straight from the shoulder at `target`, muzzle on the target; the left arm relaxes;
 *           `fire` times kick it up (recoil)
 *  behind : the right hand behind the back at hip height, the prop (pistol) muzzle down, hidden from the front
 *  chest  : both hands at chest height holding the prop between them (grenade, bomb); `strike` times = the left hand
 *           lifts and taps the prop's top (the cap) at that moment
 *  low    : (gun) idle carry: arm hanging, the gun at the thigh, muzzle forward-down ~30 deg
 *  For a `gun` prop palm = the gun wrapped in the hand along the forearm (muzzle forward, never down from the fingertips)
 *  and two = a nervous two-hand hold at the chest (muzzle forward-down, or at `target`).
 *  The arm poses of these modes blend in over the mode fade (default 0.3 s, eased) and work at any arm length. */
export type PropMode = "carry" | "two" | "palm" | "plant" | "none" | "aim" | "behind" | "chest" | "low";
/** modes that set the arm pose themselves (Stickman.tsx solve) */
export const POSE_MODES = new Set<PropMode>(["aim", "behind", "chest"]);
export type PropKey = { at: number; mode: PropMode };

export const needProp = (id: string): Need => [
  `prop:${id}`,
  () =>
    loadGLB(`props/${id}.glb`).then((g: GLTF) => {
      const spec = PROPS[id] ?? { length: 0.5, carry: 0.6, two: 0.9 };
      const inner = g.scene;
      inner.traverse((o) => {
        const me = o as THREE.Mesh;
        if (me.isMesh) {
          me.material = toToon(me.material as THREE.Material);
          me.castShadow = true;
        }
      });
      // normalise: longest axis -> +Y, working end (min) at 0, scaled to spec.length
      const box = new THREE.Box3().setFromObject(inner);
      const size = box.getSize(new THREE.Vector3());
      const ax = size.x >= size.y && size.x >= size.z ? "x" : size.z >= size.y ? "z" : "y";
      const pivot = new THREE.Group();
      pivot.add(inner);
      if (!spec.keep && ax === "x") pivot.rotation.z = Math.PI / 2;
      if (!spec.keep && ax === "z") pivot.rotation.x = -Math.PI / 2;
      pivot.updateMatrixWorld(true);
      const b2 = new THREE.Box3().setFromObject(pivot);
      const k = spec.length / Math.max(1e-4, b2.max.y - b2.min.y);
      const c = b2.getCenter(new THREE.Vector3());
      const root = new THREE.Group();
      root.add(pivot);
      pivot.position.set(-c.x, -b2.min.y, -c.z);
      root.scale.setScalar(k);
      const holder = new THREE.Group();
      holder.add(root);
      return { obj: holder, spec };
    }),
];
export const getProp = (id: string) => got<{ obj: THREE.Group; spec: PropSpec }>(`prop:${id}`);

export const modeAt = (keys: PropKey[] | PropMode, t: number, fade = 0.4): { a: PropMode; b: PropMode; w: number } => {
  if (typeof keys === "string") return { a: keys, b: keys, w: 1 };
  const ks = [...keys].sort((x, y) => x.at - y.at);
  let i = 0;
  for (let k = 0; k < ks.length; k++) if (ks[k].at <= t) i = k;
  if (i === 0) return { a: ks[0].mode, b: ks[0].mode, w: 1 };
  return { a: ks[i - 1].mode, b: ks[i].mode, w: THREE.MathUtils.clamp((t - ks[i].at) / fade, 0, 1) };
};
