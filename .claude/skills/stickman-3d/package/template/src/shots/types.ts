import type React from "react";
import type { V3 } from "../engine/types";
import type { Need } from "../world/assets";

/** a moving (or standing) thing of a shot, exported for `S cam` as a Blender stand-in (CamPaths.tsx): position on the
 *  ground at shot second t, facing (Stickman / Vehicle convention: yaw 0 = +z), kind = stand-in shape
 *  (person: 0.44 m body + 0.5 m RicksClips head, height default 1.7; car: 1.75 x 1.3 x 4.4 box; box: `size` [w, h, d]) */
export type CamPath = { kind: "person" | "car" | "box"; at: (t: number) => V3; yaw?: (t: number) => number; height?: number; size?: V3 };

/** one shot module: what it loads, and how it draws at shot seconds t (tg = global film seconds).
 *  paths (optional): the shot's characters / vehicles as pure functions of t, for the Blender camera stand-ins (`S cam`) */
export type ShotDef = {
  id: number;
  needs: Need[];
  Comp: React.FC<{ t: number; tg: number }>;
  paths?: Record<string, CamPath>;
};
