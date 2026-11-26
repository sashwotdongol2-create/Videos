// ARC TEST: the camera orbits 40 degrees around three standing characters (the depth-standard move). The flat layers
// keep facing the lens, so the drawing holds its shape; placement, occlusion and shadows stay 3D.
import React from "react";
import { Stickman } from "../char3d/Stickman";
import { needClip } from "../char3d/rig";
import type { ClipKey } from "../char3d/rig";
import { View } from "../engine/core/View";
import type { V3 } from "../engine/types";
import { arc, lens, lensClear } from "../world/camera";
import { forSet } from "../world/moods";
import { getSet, groundY, needSet, sunDir, useSetScene } from "../world/set";
import type { ShotDef } from "./types";

const SET = ["parlour", "day"] as const;
const IDLE: ClipKey[] = [{ clip: "Looking_Around", from: 0 }];
const SAD: ClipKey[] = [{ clip: "Sad_Idle", from: 0 }];

const Comp: React.FC<{ t: number; tg: number }> = ({ t, tg }) => {
  const set = getSet(...SET);
  const P = (x: number, z: number): V3 => [x, groundY(set, x, z), z];
  const look: V3 = [0.05, 0.8, 0.2];
  const cam = lens(arc([0.05, 1.0, 3.5], look, t, 0, 3, 40, 0), 60);
  lensClear(set, cam, look, `s03 t=${t.toFixed(2)}`);
  return (
    <View mood={forSet("day", sunDir(set))} cam={cam} t={tg} focus={look} blur={0.8} near={0.1} far={120}>
      <primitive object={useSetScene(set)} />
      <Stickman who="ranger" t={t} tg={tg} at={P(-0.5, 0.6)} yaw={0.5} cam={cam.pos} clips={IDLE} expr="smug" />
      <Stickman who="partner" t={t} tg={tg} at={P(0.0, -0.1)} yaw={0} cam={cam.pos} clips={SAD} expr="stern" />
      <Stickman who="guard" t={t} tg={tg} at={P(0.75, 0.2)} yaw={-0.6} cam={cam.pos} clips={IDLE} expr="happy" />
    </View>
  );
};

export const s03: ShotDef = { id: 3, needs: [needSet(...SET), needClip("Looking_Around"), needClip("Sad_Idle")], Comp };
