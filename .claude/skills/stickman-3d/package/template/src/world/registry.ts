import React from "react";
/** id of the shot being drawn (Film provides it); used to key per-shot clones (sets, props) because two shots render in two canvases during a dissolve */
export const ShotCtx = React.createContext<number>(0);
/** world-space joints of every Stickman drawn this frame, keyed by cast id (written by Stickman during render; read by the grip camera) */
export type Joints = Record<string, [number, number, number]>;
export const JOINTS = new Map<string, Joints>();
/** the same joints per shot and frame, keyed `${who}#${shotId}`: the grip camera reads only the entry of ITS shot written
 *  at THIS frame (JOINTS alone is ambiguous on a dissolve with the same character in both shots, and keeps a character
 *  drawn in an earlier frame of the same tab). Bounded: one entry per character per shot. */
export const SHOT_JOINTS = new Map<string, { frame: number; J: Joints }>();
export const putJoints = (who: string, shot: number, frame: number, J: Joints) => {
  JOINTS.set(who, J);
  const k = `${who}#${shot}`;
  SHOT_JOINTS.delete(k);
  SHOT_JOINTS.set(k, { frame, J });
  while (SHOT_JOINTS.size > 256) SHOT_JOINTS.delete(SHOT_JOINTS.keys().next().value as string);
};
