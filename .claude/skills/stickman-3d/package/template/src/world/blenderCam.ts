// A shot camera authored in Blender (tested in _t_upgrade 2026-11-20; template since 2026-11-21). `S cam <shot>`
// (stickman3d.py cmd_cam -> blender/cam_shot.py) keys ONE eased move in background Blender with the set GLB and
// stand-ins for the moving things, and exports every frame to public/cams/<shot>.json in three.js coordinates:
//   { fps, frames: [{ t, p: [x,y,z], l: [x,y,z] (look point), fov (vertical deg), roll (deg) }], check: {...} }
// blenderCam(name, t) plays it frame-exactly: on a whole frame it returns that frame's exported values; between frames
// (FilmSub motion-blur sub-frames) it interpolates linearly, so the blur follows the authored path. Past either end
// it holds the end frame. List needCam(name) in the shot's needs. Pattern (keeps the OLD camera one switch away):
//   const cam = UP().bcam ? blenderCam("s03", t) : beatCam(...);
import { staticFile } from "remotion";
import type { V3 } from "../engine/types";
import { got } from "./assets";
import type { Need } from "./assets";

export type BlenderCamFrame = { t: number; p: V3; l: V3; fov: number; roll: number };
export type BlenderCam = { fps: number; frames: BlenderCamFrame[]; check?: Record<string, number | boolean | string> };

const key = (name: string) => `bcam:${name}`;
export const needCam = (name: string): Need => [key(name), () => fetch(staticFile(`cams/${name}.json`)).then((r) => {
  if (!r.ok) throw new Error(`cams/${name}.json: ${r.status} (run \`S cam ${name}\`)`);
  return r.json() as Promise<BlenderCam>;
})];

const lerp = (a: V3, b: V3, k: number): V3 => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

/** the authored lens at shot second t: { pos, look, fov, roll } (the View's Cam) */
export const blenderCam = (name: string, t: number) => {
  const c = got<BlenderCam>(key(name));
  const F = c.frames;
  const x = Math.min(F.length - 1, Math.max(0, t * c.fps));
  const i = Math.max(0, Math.min(F.length - 2, Math.floor(x))), k = Math.min(1, x - i);
  const a = F[i], b = F[Math.min(F.length - 1, i + 1)];
  return { pos: lerp(a.p, b.p, k), look: lerp(a.l, b.l, k), fov: a.fov + (b.fov - a.fov) * k, roll: a.roll + (b.roll - a.roll) * k };
};
