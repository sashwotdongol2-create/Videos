// MOTION TEST of the RicksClips-style character (8 s): the banker walks in, stops, points, laughs, then is startled,
// while the miner idles, looks around and reacts. Everything a shot normally uses: walk + root motion, stepped
// gestures, expression reactions (hop, head tip, hat lift), talk, blinks.
import React from "react";
import { Stickman, walkSpeed } from "../char3d/Stickman";
import { needClip, walked } from "../char3d/rig";
import type { ClipKey } from "../char3d/rig";
import { View } from "../engine/core/View";
import type { V3 } from "../engine/types";
import { lens, lensClear, push } from "../world/camera";
import { forSet } from "../world/moods";
import { getSet, groundY, needSet, sunDir, useSetScene } from "../world/set";
import type { ShotDef } from "./types";

const SET = ["parlour", "day"] as const;
const X0 = 1.9;
const X1 = 0.5;
const Z = 0.35;
const WALK: ClipKey[] = [{ clip: "Walking_IP", from: 0 }];

const Comp: React.FC<{ t: number; tg: number }> = ({ t, tg }) => {
  const set = getSet(...SET);
  const v = walkSpeed("banker", WALK, "Walking_IP");
  const stop = (X0 - X1) / v - 0.2;
  const BANKER: ClipKey[] = [
    { clip: "Walking_IP", from: 0 },
    { clip: "Pointing_Forward", from: stop, fade: 0.4, loop: false },
    { clip: "Rallying", from: stop + 2.2, fade: 0.2 },
    { clip: "Shrugging", from: stop + 4.2, fade: 0.2, loop: false },
  ];
  const MINER: ClipKey[] = [{ clip: "Looking_Around", from: 0 }, { clip: "Waving", from: stop + 0.6, fade: 0.2 }, { clip: "Sad_Idle", from: stop + 2.4, fade: 0.2 }];
  const x = X0 - walked(t, v, 0, stop, 0.4);
  const banker: V3 = [x, groundY(set, x, Z), Z];
  const miner: V3 = [-0.5, groundY(set, -0.5, 0.25), 0.25];
  const look: V3 = [0.0, 0.88, 0.2];
  const cam = lens(push([0.05, 0.95, 3.6], look, t, 0, 0.02), 50);
  lensClear(set, cam, look, `s02 t=${t.toFixed(2)}`);
  return (
    <View mood={forSet("day", sunDir(set))} cam={cam} t={tg} focus={look} blur={0.8} near={0.1} far={120}>
      <primitive object={useSetScene(set)} />
      <Stickman who="banker" t={t} tg={tg} at={banker} yaw={-Math.PI / 2 + 1.1 * Math.min(1, Math.max(0, (t - stop) / 0.3))} cam={cam.pos} clips={BANKER}
        expr={[{ at: 0, e: "happy" }, { at: stop + 0.5, e: "smug" }, { at: stop + 2.2, e: "laugh" }, { at: stop + 4.2, e: "shocked" }]} talk={[[stop + 0.7, stop + 2.0]]} />
      <Stickman who="miner" t={t} tg={tg} at={miner} yaw={0.7} cam={cam.pos} clips={MINER}
        expr={[{ at: 0, e: "bored" }, { at: stop + 0.6, e: "grin" }, { at: stop + 2.5, e: "worried" }, { at: stop + 4.4, e: "laugh" }]} />
    </View>
  );
};

export const s02: ShotDef = {
  id: 2,
  needs: [needSet(...SET), ...["Walking_IP", "Pointing_Forward", "Rallying", "Shrugging", "Looking_Around", "Waving", "Sad_Idle"].map(needClip)],
  Comp,
};
