// A Mixamo-shaped skeleton built in code (added 2026-11-24): the same bone names and hierarchy as a Mixamo download,
// in a T-pose (y up, facing +z, the character's left = +x, metres, 1.78 m to the top of the head). Procedural pose
// clips (poseEngine.ts needProc) bake onto it, so a film whose motion is all written as poses needs no Mixamo file at
// all. rig.ts / Stickman.tsx measure everything from the bind pose (dimsFor), so only the proportions matter.
import * as THREE from "three";

type V = [number, number, number];
/** [bone, parent, world position at bind] in parent-first order */
const BIND: [string, string | null, V][] = [
  ["Hips", null, [0, 1.0, 0]],
  ["Spine", "Hips", [0, 1.1, 0.005]],
  ["Spine1", "Spine", [0, 1.22, 0.01]],
  ["Spine2", "Spine1", [0, 1.35, 0.01]],
  ["Neck", "Spine2", [0, 1.5, 0.005]],
  ["Head", "Neck", [0, 1.58, 0.02]],
  ["HeadTop_End", "Head", [0, 1.78, 0.02]],
];
for (const [s, x] of [["Left", 1], ["Right", -1]] as const) {
  BIND.push(
    [`${s}Shoulder`, "Spine2", [0.06 * x, 1.45, 0]],
    [`${s}Arm`, `${s}Shoulder`, [0.17 * x, 1.44, 0]],
    [`${s}ForeArm`, `${s}Arm`, [0.45 * x, 1.44, 0]],
    [`${s}Hand`, `${s}ForeArm`, [0.7 * x, 1.44, 0]],
    [`${s}HandMiddle1`, `${s}Hand`, [0.79 * x, 1.44, 0]],
    [`${s}UpLeg`, "Hips", [0.09 * x, 0.95, 0]],
    [`${s}Leg`, `${s}UpLeg`, [0.09 * x, 0.52, 0.01]],
    [`${s}Foot`, `${s}Leg`, [0.09 * x, 0.09, -0.01]],
    [`${s}ToeBase`, `${s}Foot`, [0.09 * x, 0.02, 0.12]],
    [`${s}Toe_End`, `${s}ToeBase`, [0.09 * x, 0.02, 0.2]],
  );
}

/** a fresh skeleton: a group named "Armature" holding mixamorig* bones (no mesh; Stickman draws the figure) */
export const codeSkeleton = (): THREE.Group => {
  const root = new THREE.Group();
  root.name = "Armature";
  const at = new Map<string, V>();
  const bones = new Map<string, THREE.Bone>();
  for (const [n, parent, p] of BIND) {
    const b = new THREE.Bone();
    b.name = "mixamorig" + n;
    const pp = parent ? at.get(parent)! : ([0, 0, 0] as V);
    b.position.set(p[0] - pp[0], p[1] - pp[1], p[2] - pp[2]);
    (parent ? bones.get(parent)! : root).add(b);
    at.set(n, p);
    bones.set(n, b);
  }
  root.updateMatrixWorld(true);
  return root;
};
