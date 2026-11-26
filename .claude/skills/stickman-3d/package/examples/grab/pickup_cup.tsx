// GRAB TEST 1: reach -> grab -> lift. The hero stands at the round table and picks the teacup up by its handle.
// The cup stays on the table (WorldProp at its rest pose) until the hand arrives (contact at T_GRAB), then follows the
// hand (follow()) along an eased lift path to chest height in front of the body (0.7 s, quintic).
import React from "react";
import { jointsAt, Stickman } from "../char3d/Stickman";
import { needProp } from "../char3d/props";
import { follow, gripAt, liftPath, WorldProp } from "../char3d/reach";
import type { Grab, PropPose } from "../char3d/reach";
import { needClip } from "../char3d/rig";
import type { ClipKey } from "../char3d/rig";
import { View } from "../engine/core/View";
import type { V3 } from "../engine/types";
import { lens, lensClear, push } from "../world/camera";
import { forSet } from "../world/moods";
import { getSet, groundY, needSet, sunDir, useSetScene } from "../world/set";
import type { ShotDef } from "./types";

const SET = ["parlour", "night"] as const;
// Taking_Item bends the body toward the table as the hand reaches (a standing idle cannot reach a 0.7 m table top)
const IDLE: ClipKey[] = [{ clip: "Old_Man_Idle", from: 0 }, { clip: "Taking_Item", from: 0.5, fade: 0.4, loop: false, step: false }];
const H = 1.7;
const YAW = Math.PI; // at the table's front edge (the table is 1.86 m across), facing it; the right hand (lens side) reaches
const CUP: PropPose = { pos: [-1.62, 0.705, 0.04], yaw: Math.PI }; // near the table's front edge, handle toward the hero (+z) // on the table top, handle toward the hero
const T_GRAB = 1.3;
const T_LIFT = 2.0;

const Comp: React.FC<{ t: number; tg: number }> = ({ t, tg }) => {
  const set = getSet(...SET);
  const at: V3 = [-1.8, groundY(set, -1.8, 0.44), 0.44];
  const fwd = [Math.sin(YAW), 0, Math.cos(YAW)];
  const right = [-Math.cos(YAW), 0, Math.sin(YAW)];
  const handle = gripAt("cup", CUP, "handle");
  // lift goal: chest height (~0.62 h), 0.3 m in front, a little to the right
  const chest: V3 = [at[0] + 0.3 * fwd[0] + 0.1 * right[0], at[1] + 0.62 * H, at[2] + 0.3 * fwd[2] + 0.1 * right[2]];
  const grab: Grab[] = [{ hand: "right", target: liftPath([[T_GRAB + 0.1, handle], [T_LIFT + 0.7, chest]]), at: T_GRAB }];
  const P = jointsAt("hero", IDLE, t, at, YAW, undefined, grab);
  const cup = t < T_GRAB ? CUP : follow("cup", CUP, "handle", P.RightHandMiddle1);
  const look: V3 = [-1.75, 0.95, 0.15];
  const cam = lens(push([-0.35, 1.4, 1.75], look, t, 0, 0.05), 45);
  lensClear(set, cam, look, `s02 t=${t.toFixed(2)}`);
  return (
    <View mood={forSet("lamp", sunDir(set))} cam={cam} t={tg} focus={look} blur={0.8} near={0.05} far={120}>
      <primitive object={useSetScene(set)} />
      <WorldProp id="cup" pose={cup} />
      <Stickman who="hero" t={t} tg={tg} at={at} yaw={YAW} cam={cam.pos} clips={IDLE} walking={0} grab={grab}
        expr={[{ at: 0, e: "neutral" }, { at: T_LIFT + 0.8, e: "happy" }]} />
    </View>
  );
};

export const s02: ShotDef = { id: 2, needs: [needSet(...SET), needClip("Old_Man_Idle"), needClip("Taking_Item"), needProp("cup")], Comp };
