// Cast lineup: every character of src/char/cast.ts as a 3D stickman, in a row, under one light, posed by the first clip
// in src/clips.gen.json (written by `stickman3d.py clip`). `stickman3d.py castsheet` renders it to out/castsheet.png.
// Input props (optional, for look checks: `npx remotion still build Cast out.png --props=F`):
//   {"camYaw": 35}  camera orbited about the row's centre (degrees)      {"expr": "laugh"}  one expression for all
//   {"mood": "lamp"}  another mood preset                                 {"only": ["hero"]}  a subset of the cast
import React from "react";
import { AbsoluteFill, getInputProps, useCurrentFrame } from "remotion";
import * as THREE from "three";
import { CAST } from "./char/cast";
import type { AnyExpression } from "./char/drawCharacter";
import { Stickman } from "./char3d/Stickman";
import { needClip } from "./char3d/rig";
import { needProc } from "./char3d/poseEngine";
import { needWorn } from "./char3d/worn";
import type { Wear } from "./char3d/worn";
import { View } from "./engine/core/View";
import { moodOf } from "./engine/core/moods";
import type { V3 } from "./engine/types";
import CLIPS from "./clips.gen.json";
import { UP } from "./upgrade";
import { useNeeds } from "./world/assets";
import { needEnv } from "./world/ibl";

const ground = new THREE.MeshBasicMaterial({ color: "#e9e1f2" });
const lit = new THREE.MeshStandardMaterial({ color: "#e9e1f2", roughness: 1 });
const shadow = new THREE.ShadowMaterial({ color: "#3a2a5a", opacity: 0.3 });

export const Cast: React.FC = () => {
  // face test (CastAnim): {"seq": [{"at": 0, "e": "neutral"}, ...], "dist": 2.2, "lookY": 1.45, "talk": [[a, b]]}, t = frame / 30
  const ip = getInputProps() as { camYaw?: number; expr?: AnyExpression; mood?: string; only?: string[]; clip?: string; t?: number; seq?: { at: number; e: AnyExpression }[]; dist?: number; lookY?: number; talk?: [number, number][]; lookPeer?: boolean; wear?: Record<string, Wear[]>; camY?: number };
  const frame = useCurrentFrame();
  // no Mixamo clips in the film: a coded idle (poseEngine + codeSkel)
  const clip = ip.clip ?? (CLIPS as string[]).find((c) => /idle/i.test(c)) ?? (CLIPS as string[])[0] ?? "Proc_cast_idle";
  const ready = useNeeds([...(UP().hdri ? [needEnv()] : []), clip === "Proc_cast_idle" ? needProc(clip, [{ at: 0, pose: "neutral" }]) : needClip(clip), ...[...new Set(Object.values(ip.wear ?? {}).flat().map((w) => w.id))].map(needWorn)]);
  if (!ready) return <AbsoluteFill style={{ background: "#ddd" }} />;
  const ids = Object.keys(CAST).filter((id) => !ip.only || ip.only.includes(id));
  const gap = 1.1;
  const fov = 38;
  // far enough for the whole row (16:9), never closer than the old 5.2 m
  const dist = ip.dist ?? Math.max(5.2, (ids.length * gap + 0.5) / (2 * Math.tan((fov * Math.PI) / 360) * (16 / 9)));
  const a = ((ip.camYaw ?? 0) * Math.PI) / 180;
  const cam = { pos: [Math.sin(a) * dist, ip.camY ?? 1.0, Math.cos(a) * dist] as V3, look: [0, ip.lookY ?? 0.85, 0] as V3, fov, roll: 0 };
  return (
    <View mood={moodOf((ip.mood ?? "day") as "day")} cam={cam} t={0} sky={false} blur={0} width={1920} height={1080}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} material={ip.mood ? lit : ground} receiveShadow>
        <planeGeometry args={[40, 40]} />
      </mesh>
      {ip.mood ? null : (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.003, 0]} material={shadow} receiveShadow userData={{ outline: false }}>
          <planeGeometry args={[40, 40]} />
        </mesh>
      )}
      {ids.map((id, i) => (
        <Stickman key={id} who={id} t={ip.seq ? frame / 30 : ip.t ?? 0.2} at={[(i - (ids.length - 1) / 2) * gap, 0, 0]} yaw={0} cam={cam.pos} clips={[{ clip, from: 0 }]} walking={0} expr={ip.seq ?? ip.expr ?? "happy"} talk={ip.talk} wear={ip.wear?.[id]} look={ip.lookPeer && ids.length > 1 ? [(((i + 1) % ids.length) - (ids.length - 1) / 2) * gap, 1.5, 0] : undefined} />
      ))}
    </View>
  );
};
