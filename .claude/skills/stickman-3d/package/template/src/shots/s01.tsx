// EXAMPLE shot (smoke test + starting point): the parlour set from blender/sets.py exported to three.js, the hero walks
// in carrying a shovel, stops and shrugs at the partner, who reacts. Copy it to sNN.tsx for real shots.
// Pattern: needs (set + clips + props) -> set info -> characters on the ground (groundY) -> camera (arc/push) -> View
// -> <StageQA/> last (world/stage.tsx: lens in a body, blocked view, overlaps, bodies in furniture, heads out of frame).
import React from "react";
import { Stickman, walkSpeed } from "../char3d/Stickman";
import { needProp } from "../char3d/props";
import { needClip, walked } from "../char3d/rig";
import type { ClipKey } from "../char3d/rig";
import { View } from "../engine/core/View";
import type { V3 } from "../engine/types";
import { arc, lens, lensClear, push } from "../world/camera";
import { forSet } from "../world/moods";
import { getSet, groundY, needSet, sunDir, useSetScene } from "../world/set";
import { StageQA } from "../world/stage";
import type { ShotDef } from "./types";

const SET = ["parlour", "night"] as const;
const HERO_CLIPS: ClipKey[] = [{ clip: "Walking_IP", from: 0 }, { clip: "Shrugging", from: 99 }];
const X0 = 1.75; // enters from off-screen right ...
const X1 = 0.6; // ... and stops ~0.95 m from the partner (a carried long prop reaches ~0.55 m ahead of the hand)
const PARTNER: ClipKey[] = [{ clip: "Sad_Idle", from: 0 }];

const Comp: React.FC<{ t: number; tg: number }> = ({ t, tg }) => {
  const set = getSet(...SET);
  // hero: walks from the door side toward the room centre, stops at 2.6 s (same fade as the clip cross-fade)
  // stop time from the distance (Mixamo walks are ~1.1 m/s): the walk -> shrug cross-fade uses the same 0.4 s fade
  const v = walkSpeed("hero", HERO_CLIPS, "Walking_IP");
  const stop = (X0 - X1) / v - 0.2;
  const HERO: ClipKey[] = [{ clip: "Walking_IP", from: 0 }, { clip: "Shrugging", from: stop, fade: 0.4, loop: false }];
  const x = X0 - walked(t, v, 0, stop, 0.4);
  const hz = 0.05;
  const hero: V3 = [x, groundY(set, x, hz), hz];
  const partner: V3 = [-0.35, groundY(set, -0.35, -0.15), -0.15];
  // portrait frame: the horizontal view is only ~0.56 x the vertical one, so stage people within ~1 m of each other
  // camera: an arc around the pair while closing in, then the channel's slow push
  const look: V3 = [0.15, 0.9, -0.1];
  const A = arc([1.0, 1.4, 2.85], look, t, 0, stop + 0.4, -12, 0.08); // stays inside the room (lensClear checks every frame)
  const cam = lens(t < stop + 0.4 ? A : push(A[0], A[1], t, stop + 0.4, 0.05), 56);
  lensClear(set, cam, look, `s01 t=${t.toFixed(2)}`);
  return (
    <View mood={forSet("lamp", sunDir(set))} cam={cam} t={tg} focus={look} blur={1.4} near={0.1} far={120}>
      <primitive object={useSetScene(set)} />
      <Stickman who="hero" t={t} tg={tg} at={hero} yaw={-Math.PI / 2 + 0.9 * Math.min(1, Math.max(0, (t - stop) / 0.5))} cam={cam.pos} clips={HERO}
        expr={[{ at: 0, e: "happy" }, { at: stop + 0.3, e: "confused" }]} prop={{ id: "shovel", mode: [{ at: 0, mode: "carry" }, { at: stop, mode: "plant" }] }} />
      <Stickman who="partner" t={t} tg={tg} at={partner} yaw={0.6} cam={cam.pos} clips={PARTNER} walking={0}
        expr={[{ at: 0, e: "neutral" }, { at: stop + 0.5, e: "shocked" }]} talk={[[stop + 1.0, stop + 1.8]]} />
      {/* numeric staging checks (STAGE lines in the QA console): keep it LAST, after every Stickman */}
      <StageQA cam={cam} subject={look} keep={t > 0.8 ? ["hero", "partner"] : ["partner"]} set={set} label={`s01 t=${t.toFixed(2)}`} />
    </View>
  );
};

export const s01: ShotDef = {
  id: 1,
  needs: [needSet(...SET), needClip("Walking_IP"), needClip("Shrugging"), needClip("Sad_Idle"), needProp("shovel")],
  Comp,
};
