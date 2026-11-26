// GRAB TEST 2: a two-hand tool that stays in the world (the shovel standing in for a mop). Its working end slides on
// the floor in front of the hero; both hands reach onto its shaft (twoHandTargets: 0.25 h apart) and the shaft's angle
// comes from where the two solved hands are (toolFromHands). GRAB TEST 3: the partner reaches for the wall bell from
// too far away: the arm must NOT stretch, and the console must print a REACH: line.
import React from "react";
import * as THREE from "three";
import { jointsAt, Stickman } from "../char3d/Stickman";
import { needProp } from "../char3d/props";
import { toolFromHands, twoHandTargets, WorldProp } from "../char3d/reach";
import type { Grab } from "../char3d/reach";
import { needClip } from "../char3d/rig";
import type { ClipKey } from "../char3d/rig";
import { View } from "../engine/core/View";
import type { V3 } from "../engine/types";
import { lens, lensClear, push } from "../world/camera";
import { forSet } from "../world/moods";
import { getSet, groundY, needSet, sunDir, useSetScene } from "../world/set";
import type { ShotDef } from "./types";

const SET = ["parlour", "night"] as const;
const IDLE: ClipKey[] = [{ clip: "Old_Man_Idle", from: 0 }];
const SAD: ClipKey[] = [{ clip: "Sad_Idle", from: 0 }];
const H = 1.7;
const YAW = 0.5;
const T_ON = 0.9; // right hand on the shaft (left 0.1 s later)
const T_SWEEP = 1.4;

const Comp: React.FC<{ t: number; tg: number }> = ({ t, tg }) => {
  const set = getSet(...SET);
  const at: V3 = [0.25, groundY(set, 0.25, -0.7), -0.7];
  const f = new THREE.Vector3(Math.sin(YAW), 0, Math.cos(YAW));
  const r = new THREE.Vector3(-Math.cos(YAW), 0, Math.sin(YAW));
  // the mop head: in front of the feet, sweeping side to side once the hands are on (sweep eased in over 0.5 s)
  const head = (tt: number) => {
    const kk = THREE.MathUtils.smoothstep(tt, T_SWEEP, T_SWEEP + 0.5);
    return new THREE.Vector3(...at).addScaledVector(f, 0.46).addScaledVector(r, 0.08 + 0.15 * kk * Math.sin((2 * Math.PI * (tt - T_SWEEP)) / 1.6)).setY(at[1] + 0.01);
  };
  // the shaft leans back toward the body: from the head up to a point in front of the chest
  const dirAt = (tt: number) => new THREE.Vector3(...at).addScaledVector(f, 0.15).addScaledVector(r, 0.12).setY(at[1] + 1.15).sub(head(tt)).normalize();
  const goals = (tt: number) => twoHandTargets("shovel", head(tt).toArray() as V3, dirAt(tt).toArray() as V3, H);
  const grab: Grab[] = [
    { hand: "right", target: (tt) => goals(tt).lo, at: T_ON },
    { hand: "left", target: (tt) => goals(tt).hi, at: T_ON + 0.1 },
  ];
  const P = jointsAt("hero", IDLE, t, at, YAW, undefined, grab);
  const rest = goals(0);
  const mop = t < T_ON + 0.1
    ? toolFromHands("shovel", new THREE.Vector3(...rest.lo), new THREE.Vector3(...rest.hi), [f.x, 0, f.z]) // leaning, untouched
    : toolFromHands("shovel", P.RightHandMiddle1, P.LeftHandMiddle1, [f.x, 0, f.z]); // angle from the two real hands
  // partner: reaches for the wall bell from ~1.3 m away (deliberately out of reach)
  const pat: V3 = [-0.95, groundY(set, -0.95, -1.5), -1.5];
  const bell: Grab[] = [{ hand: "right", target: [0.62, 1.6, -2.22], at: 1.6, until: 3.0 }];
  const look: V3 = [-0.25, 0.85, -1.0];
  const cam = lens(push([0.35, 1.4, 2.7], look, t, 0, 0.05), 55);
  lensClear(set, cam, look, `s03 t=${t.toFixed(2)}`);
  return (
    <View mood={forSet("lamp", sunDir(set))} cam={cam} t={tg} focus={look} blur={0.8} near={0.05} far={120}>
      <primitive object={useSetScene(set)} />
      <WorldProp id="shovel" pose={mop} />
      <Stickman who="hero" t={t} tg={tg} at={at} yaw={YAW} cam={cam.pos} clips={IDLE} walking={0} grab={grab} expr="neutral" />
      <Stickman who="partner" t={t} tg={tg} at={pat} yaw={2.2} cam={cam.pos} clips={SAD} walking={0} grab={bell} expr="confused" />
    </View>
  );
};

export const s03: ShotDef = { id: 3, needs: [needSet(...SET), needClip("Old_Man_Idle"), needClip("Sad_Idle"), needProp("shovel")], Comp };
