// WORD CUES (2026-11-24): put every reaction ON the word that causes it. src/words.json holds when each word is spoken
// (film seconds); these helpers find a word and turn a beat list keyed to words into times.
//   wordAt("sat")            -> start of the first "sat"
//   wordAt("percent", 9.5)   -> the first "percent" at or after 9.5 s (a word said twice)
//   onWords([{ word: "sat", face: "confused", mark: "question" }, { word: "down", edge: "end", offset: 0.15, ... }])
//     resolves in order: each beat searches from the previous beat's word, so repeated words land on the right one.
// TAG_ACT maps the delivery tags we already write into the voice lines ("[deadpan, flat] It's a charger.") to an anime
// face, a body emote and a mark; actFromTags() also reads the punctuation ("?" -> curious + "?", "!" -> "!").
import WORDS_JSON from "../words.json";
import type { MarkKind } from "../char3d/manpu";

type Word = { w: string; s: number; e: number };
const WORDS = WORDS_JSON as Word[];
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9']/g, "");

/** index of the first word matching `word` that starts at or after `after` (film seconds); -1 if none */
export const wordIndex = (word: string, after = 0): number => {
  const k = norm(word);
  return WORDS.findIndex((x) => x.s >= after - 1e-3 && norm(x.w) === k);
};
/** start (or end) of a spoken word in film seconds; throws when the word is not in the voice, so a typo is caught */
export const wordAt = (word: string, after = 0, edge: "start" | "end" = "start"): number => {
  const i = wordIndex(word, after);
  if (i < 0) throw new Error(`cue word "${word}" not spoken after ${after.toFixed(2)} s (src/words.json)`);
  return edge === "end" ? WORDS[i].e : WORDS[i].s;
};

export type WordBeat = { word: string; edge?: "start" | "end"; offset?: number; after?: number };
/** resolve beats keyed to words, in order (each search starts at the previous beat's word): adds `at` (film seconds) */
export const onWords = <B extends WordBeat>(beats: B[], from = 0): (B & { at: number })[] => {
  let cur = from;
  return beats.map((b) => {
    const i = wordIndex(b.word, b.after ?? cur);
    if (i < 0) throw new Error(`cue word "${b.word}" not spoken after ${(b.after ?? cur).toFixed(2)} s (src/words.json)`);
    cur = WORDS[i].s;
    const t = (b.edge === "end" ? WORDS[i].e : WORDS[i].s) + (b.offset ?? 0);
    return { ...b, at: t };
  });
};

// RESTRAINT (user, 2026-11-24): most tags give a FACE only; a mark is kept for the four beats that need one.
/** delivery tag -> anime face (src/char/drawCharacter.ts), body emote (char3d/poseEngine.ts EMOTES), mark (manpu) */
export const TAG_ACT: Record<string, { face: string; emote: string; mark?: MarkKind }> = {
  confused: { face: "confused", emote: "confused", mark: "question" },
  puzzled: { face: "confused", emote: "confused", mark: "question" },
  curious: { face: "curious", emote: "curious" },
  suspicious: { face: "suspicious", emote: "deadpan" },
  deadpan: { face: "a_deadpan", emote: "deadpan", mark: "dots" },
  flat: { face: "a_deadpan", emote: "deadpan" },
  unimpressed: { face: "a_deadpan", emote: "deadpan" },
  bored: { face: "a_deadpan", emote: "deadpan" },
  "taken aback": { face: "a_blank", emote: "surprised" },
  surprised: { face: "surprised", emote: "surprised" },
  shocked: { face: "a_blank", emote: "shocked" },
  excited: { face: "a_sparkle", emote: "excited" },
  delighted: { face: "a_joy", emote: "excited" },
  cheerful: { face: "a_joy", emote: "happy" },
  playful: { face: "a_cat", emote: "talk" },
  amused: { face: "a_cat", emote: "talk" },
  teasing: { face: "a_cat", emote: "talk" },
  smug: { face: "a_smug", emote: "proud" },
  laughing: { face: "a_joy", emote: "laugh" },
  relieved: { face: "relieved", emote: "relieved" },
  warm: { face: "happy", emote: "happy" },
  polite: { face: "a_nervous", emote: "awkward" },
  hesitant: { face: "a_nervous", emote: "awkward", mark: "sweat" },
  nervous: { face: "a_nervous", emote: "awkward", mark: "sweat" },
  embarrassed: { face: "a_shy", emote: "embarrassed" },
  flustered: { face: "a_shy", emote: "embarrassed" },
  annoyed: { face: "a_rage", emote: "annoyed" },
  angry: { face: "a_rage", emote: "annoyed", mark: "vein" },
  frustrated: { face: "a_rage", emote: "annoyed" },
  sad: { face: "a_gloom", emote: "sad", mark: "gloom" },
  crying: { face: "a_cry", emote: "sad" },
  defeated: { face: "a_gloom", emote: "sad", mark: "gloom" },
  smitten: { face: "a_heart", emote: "hopeful" },
};
/** the act for one line from its tags (first tag that is known wins), else from its punctuation; null = keep acting */
export const actFromTags = (tags: string[], text: string): { face: string; emote: string; mark?: MarkKind } | null => {
  for (const tg of tags) {
    const k = tg.trim().toLowerCase();
    if (TAG_ACT[k]) return TAG_ACT[k];
    for (const w of k.split(/\s+/)) if (TAG_ACT[w]) return TAG_ACT[w];
  }
  const tx = text.trim();
  if (/\.\.\.$|…$/.test(tx)) return { face: "a_deadpan", emote: "deadpan", mark: "dots" };
  if (/\?$/.test(tx)) return { face: "curious", emote: "curious" };
  if (/!$/.test(tx)) return { face: "eager", emote: "eager" };
  return null;
};
/** the delivery tags of a voice line: "[deadpan, flat] It's a charger." -> ["deadpan", "flat"] */
export const tagsOf = (line: string) => [...line.matchAll(/\[([^\]]+)\]/g)].flatMap((m) => m[1].split(","));
