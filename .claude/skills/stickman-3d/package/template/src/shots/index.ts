// Register every shot module here (one file per shot or per set: src/shots/sNN.tsx). Keys = shot ids in shots_plan.json.
import type { ShotDef } from "./types";
import { s01 } from "./s01";

export const SHOT_DEFS: Record<number, ShotDef> = {
  1: s01,
};
