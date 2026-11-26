// CamPaths: the three.js side of `S cam <shot>` (stickman3d.py cmd_cam). Loads the shot's needs, evaluates its
// ShotDef.paths (characters / vehicles as pure functions of shot seconds) at every frame of the shot and logs them as
// "CAMPATH {json}" lines (50 frames per line); the CLI joins them into public/cams/paths/<shot>.json, which
// blender/cam_shot.py turns into keyed stand-ins. Input props: { shot: id, n: frames, fps }.
import React from "react";
import { AbsoluteFill, getInputProps } from "remotion";
import { SHOT_DEFS } from "./shots";
import { useNeeds } from "./world/assets";
import { ShotCtx } from "./world/registry";

const r4 = (x: number) => Math.round(x * 1e4) / 1e4;

const Dump: React.FC<{ id: number; n: number; fps: number }> = ({ id, n, fps }) => {
  const def = SHOT_DEFS[id];
  const paths = def.paths ?? {};
  for (const [name, P] of Object.entries(paths)) {
    for (let f0 = 0; f0 < n; f0 += 50) {
      const p: number[][] = [], yaw: number[] = [];
      for (let f = f0; f < Math.min(n, f0 + 50); f++) {
        const t = f / fps;
        p.push(P.at(t).map(r4));
        yaw.push(r4(P.yaw ? P.yaw(t) : 0));
      }
      console.error(`CAMPATH ${JSON.stringify({ name, kind: P.kind, height: P.height, size: P.size, f0, p, yaw })}`);
    }
  }
  console.error(`CAMPATH ${JSON.stringify({ done: Object.keys(paths).length, n, fps })}`);
  return null;
};

export const CamPaths: React.FC = () => {
  const { shot = 1, n = 150, fps = 30 } = getInputProps() as { shot?: number; n?: number; fps?: number };
  const def = SHOT_DEFS[shot];
  // the shot's own Blender camera (bcam:<shot>) is what `S cam` is about to write: never wait for it here
  const ready = useNeeds(def ? def.needs.filter((n) => !n[0].startsWith("bcam:")) : []);
  if (!def) { console.error(`CAMPATH ${JSON.stringify({ error: `no shot ${shot} in src/shots/index.ts` })}`); return null; }
  if (!ready) return <AbsoluteFill style={{ background: "#000" }} />;
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <ShotCtx.Provider value={def.id}><Dump id={def.id} n={n} fps={fps} /></ShotCtx.Provider>
    </AbsoluteFill>
  );
};
