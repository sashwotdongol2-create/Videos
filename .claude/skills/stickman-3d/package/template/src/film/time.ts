// Film timing: src/shots.gen.json (written by `stickman3d.py timing` from shots_plan.json + src/words.json),
// src/edit.json ({"xfade": 9, "cuts": [shot ids entered by a hard cut], "kinds": {"<shotId>": "dissolve" | "cut" | "push" |
// "whip" | "spin" | "vwhip" | "flip" | "through" | "dive" | "wipe"}}: how each shot is ENTERED; default dissolve, ids in "cuts" stay hard cuts; see film/transitions.ts).
import SHOTS_JSON from "../shots.gen.json";
import EDIT_JSON from "../edit.json";
import WORDS_JSON from "../words.json";

export type ShotTime = { id: number; a: number; b: number; words: string };
export const SHOTS = SHOTS_JSON as ShotTime[];
export const EDIT = EDIT_JSON as { xfade: number; cuts: number[]; kinds?: Record<string, string> };
export const WORDS = WORDS_JSON as { w: string; s: number; e: number }[];
export const FPS = 30;

/** global film seconds where word i lands on screen (2 frames before it is spoken) */
export const W = (i: number) => (WORDS[i] ? WORDS[i].s : 0) - 2 / FPS;
/** the same in a shot's own seconds */
export const Wl = (i: number, shotId: number) => W(i) - shotStartS(shotId);
export const shotStartS = (id: number) => (SHOTS.find((s) => s.id === id)?.a ?? 0) / FPS;
export const shotEndS = (id: number) => (SHOTS.find((s) => s.id === id)?.b ?? 0) / FPS;
