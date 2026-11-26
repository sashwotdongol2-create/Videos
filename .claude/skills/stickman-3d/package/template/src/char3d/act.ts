// ACTING ON THE WORDS (2026-11-24): one beat list per character, every beat keyed to a spoken word, gives the body
// (pose keys for needProc), the face (expression keys) and the anime marks (Manpu) together.
//   const J = act([{ word: "Do", emote: "eager", e: "a_sparkle" }, { word: "friends", mark: "sparkles" },
//                  { word: "down", edge: "end", offset: 0.1, emote: "awkward", e: "a_blank", mark: "shock" }], { seated: true });
//   needs: needProc("Proc_jay", J.keys)   <Stickman expr={J.expr} .../>   <Manpu marks={J.marks} .../>
// Rules that came out of reviewing the first film (BUILD_LESSONS 2026-11-24):
//   - the listener reacts at the END of the word that hits them (+0.1 s); the speaker changes ON their own word;
//   - a character on screen right who faces screen left uses { mirror: true } (gestures open to the lens);
//   - never hold one pose through a long line: gestures(...) adds a small pose change every few words;
//   - closed-eye faces (happy, a_joy, a_cat) last under ~1 s on a speaker; explaining to the lens uses open eyes;
//   - RESTRAINT (user 2026-11-24, "overdone and oversized"): the face carries the reaction. One mark per character per
//     exchange at most (about one per 6 s of film), each strong anime face (sparkle, blank, T_T, gloom) once or twice
//     per film, a pose change only when the intention changes (not on every few words).
import { onWords } from "../film/cues";
import type { WordBeat } from "../film/cues";
import WORDS_JSON from "../words.json";
import type { MarkKey, MarkKind } from "./manpu";
import { EMOTES, mirrorPose } from "./poseEngine";
import type { PoseDef, ProcKey } from "./poseEngine";

export type ActBeat = WordBeat & { emote?: string; pose?: string | PoseDef; e?: string; mark?: MarkKind; dur?: number; side?: 1 | -1; snap?: number };
/** markSide: which side of the head this character's marks sit on (1 = screen right). Give the left person -1 and
 *  the right person 1, so marks sit on the outer sides and never cross into the partner. */
export type ActOpts = { seated?: boolean; mirror?: boolean; from?: number; markSide?: 1 | -1 };
export const act = (beats: ActBeat[], o: ActOpts = {}) => {
  const keys: ProcKey[] = [];
  const expr: { at: number; e: string }[] = [];
  const marks: MarkKey[] = [];
  for (const b of onWords(beats, o.from ?? 0)) {
    const at = Math.max(0, b.at);
    const em = b.emote ? EMOTES[b.emote] : undefined;
    if (b.emote && !em) throw new Error(`unknown emote "${b.emote}" (EMOTES in char3d/poseEngine.ts)`);
    const pose = b.pose ?? (em ? (o.seated ? em.sit : em.stand) : undefined);
    if (pose) keys.push({ at, pose: o.mirror ? mirrorPose(pose) : pose, snap: b.snap ?? 5 });
    const face = b.e ?? em?.e;
    if (face) expr.push({ at, e: face });
    if (b.mark) marks.push({ at: b.at, kind: b.mark, dur: b.dur, side: b.side ?? o.markSide ?? 1 });
  }
  // restraint check: marks closer than 3 s on one character read as noise
  marks.sort((a, b) => a.at - b.at);
  for (let i = 1; i < marks.length; i++) if (marks[i].at - marks[i - 1].at < 3 && !(marks[i - 1].kind === "shock")) console.warn(`ACT DENSE: "${marks[i - 1].kind}" at ${marks[i - 1].at.toFixed(1)} s and "${marks[i].kind}" at ${marks[i].at.toFixed(1)} s are under 3 s apart: keep one`);
  keys.sort((a, b) => a.at - b.at);
  expr.sort((a, b) => a.at - b.at);
  return { keys, expr, marks };
};

const W = WORDS_JSON as { w: string; s: number; e: number }[];
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9']/g, "");
/** gesture beats through a long line: from the word `from` to the word `to` (searched in order after `after`), a pose
 *  change on every `every`-th word, cycling through `poses`. Returns beats to spread into the list given to act(). */
export const gestures = (from: string, to: string, poses: string[], every = 3, after = 0): ActBeat[] => {
  const i0 = W.findIndex((x) => x.s >= after - 1e-3 && norm(x.w) === norm(from));
  const i1 = W.findIndex((x, i) => i >= i0 && norm(x.w) === norm(to));
  if (i0 < 0 || i1 < 0) throw new Error(`gestures: "${from}" .. "${to}" not spoken after ${after.toFixed(2)} s`);
  const out: ActBeat[] = [];
  for (let i = i0, k = 0; i <= i1; i += every, k++) out.push({ word: W[i].w, after: W[i].s, pose: poses[k % poses.length], snap: 6 });
  return out;
};
