// PROCEDURAL POSE TEST (2026-11-20): Princip runs through the 15 code-written cartoon poses of char3d/poseEngine.ts
// on the `corner` set, 1 s per pose (held, then snapped in 5 frames). No Mixamo clip drives him: the timeline is baked
// into a clip on the skeleton and handed to the normal Stickman solver.
//   props: yawDeg (body turn off the lens, default 25), label (pose name overlay, default true), ids (one pose per frame
//   for stills: {"only":"wave"})
import React from "react";
import { AbsoluteFill, getInputProps, useCurrentFrame } from "remotion";
import { Stickman } from "./char3d/Stickman";
import { POSES, needProc } from "./char3d/poseEngine";
import type { ProcKey } from "./char3d/poseEngine";
import type { ClipKey } from "./char3d/rig";
import { View } from "./engine/core/View";
import type { V3 } from "./engine/types";
import { useNeeds } from "./world/assets";
import { forSet } from "./world/moods";
import { getSet, groundY, needSet, sunDir, useSetScene } from "./world/set";

type P = { yawDeg?: number; label?: boolean; only?: string };
const C: V3 = [4.6, 0, -21.25];
export const ORDER = ["neutral", "talk_shrug", "point_forward", "hands_on_hips", "shock_jump", "cheer", "facepalm", "think",
  "wave", "arms_crossed", "lean_in", "recoil", "sad_slump", "fist_pump", "present"];
const EXPR: Record<string, string> = { neutral: "neutral", talk_shrug: "confused", point_forward: "angry", hands_on_hips: "smug",
  shock_jump: "shocked", cheer: "laugh", facepalm: "sad", think: "confused", wave: "happy", arms_crossed: "smug",
  lean_in: "worried", recoil: "scared", sad_slump: "sad", fist_pump: "grin", present: "happy" };
const PER = 1.0;
export const PROC_FRAMES = Math.round((ORDER.length * PER + 0.6) * 30);

export const ProcTest: React.FC = () => {
  const ip = getInputProps() as P;
  const frame = useCurrentFrame();
  const t = frame / 30;
  const seq = ip.only ? [ip.only] : ORDER;
  const keys: ProcKey[] = seq.map((pose, i) => ({ at: i * PER, pose, snap: pose === "shock_jump" ? 4 : 5 }));
  const name = ip.only ? `Proc_${ip.only}` : "Proc_demo";
  const ready = useNeeds([needSet("corner", "day"), needProc(name, keys)]);
  if (!ready) return <AbsoluteFill style={{ background: "#888" }} />;
  const set = getSet("corner", "day");
  const gy = groundY(set, C[0], C[2]);
  const dist = 3.6;
  const cam = { pos: [C[0] - dist, gy + 1.15, C[2] + 0.35] as V3, look: [C[0], gy + 0.85, C[2]] as V3, fov: 40, roll: 0 };
  const toLens = Math.atan2(cam.pos[0] - C[0], cam.pos[2] - C[2]);
  const yaw = toLens + ((ip.yawDeg ?? 25) * Math.PI) / 180;
  const clips: ClipKey[] = [{ clip: name, from: 0, step: false, loop: false }];
  const idx = Math.min(seq.length - 1, Math.max(0, Math.floor(t / PER)));
  const expr = seq.map((p, i) => ({ at: i * PER + 0.05, e: (EXPR[p] ?? "neutral") as never }));
  return (
    <AbsoluteFill>
      <View mood={forSet("day", sunDir(set))} cam={cam} t={t} blur={0} near={0.05} far={300}>
        <primitive object={useSetScene(set)} />
        <Stickman who="princip" t={t} tg={t} at={[C[0], gy, C[2]]} yaw={yaw} cam={cam.pos} clips={clips} walking={0} expr={expr}
          talk={seq[idx] === "talk_shrug" ? [[idx * PER + 0.1, idx * PER + 0.9]] : []} toon />
      </View>
      {ip.label !== false && (
        <div style={{ position: "absolute", top: 120, width: "100%", textAlign: "center", font: "700 64px sans-serif", color: "#fff", textShadow: "0 0 12px #000" }}>
          {seq[idx]} <span style={{ fontSize: 40, opacity: 0.7 }}>({idx + 1}/{seq.length})</span>
        </div>
      )}
    </AbsoluteFill>
  );
};
export const POSE_NAMES = Object.keys(POSES);
