// WORN pieces (PROPS2, h67): GLBs built in TORSO UNITS (head widths, origin at the torso bottom, +Z = the character's
// front, +X = the character's left) by blender/assets_src/build_props2.py. <Stickman wear={[...]}/> renders them inside
// the torso group, so they sit ON the body (follow lean, turn and breathing) and never float.
//   bomb_vest  : dynamite vest (2 rows x 6 sticks, duct tape, detonator box with toggle + red pilot lamp, 6 V battery
//                on his right side, coloured wires + blasting caps). Use with cast "cooper_open" (jacket pulled back).
//   worn_bag   : the canvas money bag strapped on the chest: two olive webbing bands round the torso + an X of white
//                shroud cord over the shoulders, knot on the bag, drawcord + seal + tag at the neck (S19-S23)
//   worn_chute : the back parachute worn: container on the back, yellow harness (main lift webs over the shoulders,
//                chest strap + adapter, waist band, ripcord D-handle on his left) (S19-S23)
// Shots: needs: [needWorn("bomb_vest")], <Stickman ... wear={[{ id: "bomb_vest", from: 2.1 }]}/>
import React from "react";
import * as THREE from "three";
import { got, loadGLB, toToon } from "../world/assets";
import type { Need } from "../world/assets";

/** a worn piece, shown while from <= t < to (shot seconds; defaults: always) */
export type Wear = { id: string; from?: number; to?: number };

export const needWorn = (id: string): Need => [
  `worn:${id}`,
  () =>
    loadGLB(`props/${id}.glb`).then((g) => {
      g.scene.traverse((o) => {
        const me = o as THREE.Mesh;
        if (me.isMesh) {
          me.material = toToon(me.material as THREE.Material);
          me.castShadow = true;
        }
      });
      return g.scene;
    }),
];

const clones = new Map<string, THREE.Object3D>();
/** rendered by Stickman inside the torso group (already in torso units) */
export const WornParts: React.FC<{ wear?: Wear[]; t: number; who: string; shot: string }> = ({ wear, t, who, shot }) => {
  if (!wear?.length) return null;
  return (
    <>
      {wear
        .filter((w) => t >= (w.from ?? -1e9) && t < (w.to ?? 1e9))
        .map((w) => {
          const key = `${w.id}|${who}|${shot}`;
          let obj = clones.get(key);
          if (!obj) {
            obj = got<THREE.Object3D>(`worn:${w.id}`).clone(true);
            clones.set(key, obj);
            while (clones.size > 32) clones.delete(clones.keys().next().value as string);
          }
          return <primitive key={key} object={obj} />;
        })}
    </>
  );
};
