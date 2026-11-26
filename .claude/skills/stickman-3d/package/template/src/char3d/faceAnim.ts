// Slider-face animation (2026-11-19, RicksClips face study: charstudy, TRU 36-40 s frame by frame).
// The reference never swaps a whole face: each feature eases to its new value on its own clock (brows lead, eyes a
// frame later, mouth two frames later), with a small overshoot, a blink on the change, and a face that never quite
// stops (brow drift, mouth breathing, head sway). Talking opens the mouth by a continuous syllable envelope instead of
// three fixed shapes.
import type { AnyExpression, FaceParams } from "../char/drawCharacter";
import { faceParamsOf } from "../char/drawCharacter";
import LIP_JSON from "../lip.json";

export type ExprKeys = AnyExpression | { at: number; e: AnyExpression }[] | undefined;

/** feature timing in seconds: delay after the expression key, ease duration */
export const FACE_T = {
  brow: { delay: 0, dur: 0.17 },
  eye: { delay: 1 / 30, dur: 0.13 },
  mouth: { delay: 2 / 30, dur: 0.2 },
  tilt: { delay: 0, dur: 0.3 },
  overshoot: 1.5, // easeOutBack strength (0 = none)
  blinkOnChange: [1 / 30, 4 / 30] as [number, number], // eyes shut in this window after a change
  idle: { brow: 3, mouth: 0.06, tilt: 2 }, // drift amplitudes: ref px, curve units, degrees
  talk: { rate: 4.3, open: 0.75 }, // syllables per second, how far the envelope opens the mouth
};

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const back = (u: number) => {
  const s = FACE_T.overshoot;
  const v = u - 1;
  return 1 + (s + 1) * v * v * v + s * v * v;
};
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const lerp2 = (a: [number, number], b: [number, number], k: number): [number, number] => [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];

const keysOf = (e: ExprKeys) => {
  if (!e) return [{ at: -1e9, e: "neutral" as AnyExpression }];
  if (typeof e === "string") return [{ at: -1e9, e }];
  return [...e].sort((a, b) => a.at - b.at);
};

/** the eased face at time t while key i is active (depth-limited recursion: a change during a change starts from
 *  wherever the previous transition had got to) */
const blendAt = (ks: { at: number; e: AnyExpression }[], i: number, t: number, depth: number): FaceParams => {
  const to = faceParamsOf(ks[i].e);
  if (i === 0) return to; // the first expression is simply there
  const from = depth > 3 ? faceParamsOf(ks[i - 1].e) : blendAt(ks, i - 1, ks[i].at, depth + 1);
  const at = ks[i].at;
  const k = (g: { delay: number; dur: number }) => back(clamp01((t - at - g.delay) / g.dur));
  const kb = k(FACE_T.brow);
  const ke = k(FACE_T.eye);
  const km = k(FACE_T.mouth);
  const kt = k(FACE_T.tilt);
  // discrete looks (happy arcs, ring eyes) switch at the half-way point of their feature, never overshoot past 1
  const ke1 = clamp01(ke);
  return {
    bY: lerp2(from.bY, to.bY, kb),
    bTilt: lerp2(from.bTilt, to.bTilt, kb),
    bArch: lerp2(from.bArch, to.bArch, clamp01(kb)),
    bLen: lerp(from.bLen, to.bLen, clamp01(kb)),
    eOpen: Math.max(0, lerp(from.eOpen, to.eOpen, ke)),
    eBig: Math.max(0, lerp(from.eBig, to.eBig, ke)),
    eHappy: lerp(from.eHappy, to.eHappy, ke1),
    pX: lerp(from.pX, to.pX, ke),
    pY: lerp(from.pY, to.pY, ke),
    lid: [clamp01(lerp(from.lid[0], to.lid[0], ke)), clamp01(lerp(from.lid[1], to.lid[1], ke))],
    lidTilt: lerp2(from.lidTilt, to.lidTilt, ke),
    lidB: clamp01(lerp(from.lidB, to.lidB, ke)),
    gX: lerp(from.gX, to.gX, ke),
    gY: lerp(from.gY, to.gY, ke),
    mOpen: Math.max(0, lerp(from.mOpen, to.mOpen, km)),
    mW: Math.max(8, lerp(from.mW, to.mW, km)),
    mCurve: lerp(from.mCurve, to.mCurve, km),
    mTwist: lerp(from.mTwist, to.mTwist, km),
    mShift: lerp(from.mShift, to.mShift, km),
    teeth: clamp01(lerp(from.teeth, to.teeth, clamp01(km))),
    tongue: clamp01(lerp(from.tongue, to.tongue, clamp01(km))),
    tilt: lerp(from.tilt, to.tilt, kt),
    extras: km >= 0.5 ? to.extras : from.extras,
    anime: clamp01(ke) >= 0.5 ? to.anime : from.anime,
    amouth: clamp01(km) >= 0.5 ? to.amouth : from.amouth,
  };
};

/** time of the last expression change at or before t (-1e9 if none) */
export const changeAt = (e: ExprKeys, t: number) => {
  const ks = keysOf(e);
  let at = -1e9;
  for (let i = 1; i < ks.length; i++) if (ks[i].at <= t) at = ks[i].at;
  return at;
};

/** lip-sync track from the real voice (voice/lip_track.py -> src/lip.json), read at global film seconds */
const LIP = LIP_JSON as { fps: number; open: number[]; round: number[]; teeth: number[] };
/** the mouth leads the sound by 2 frames (BUILD_LESSONS #37: lips that move with the sound read as late) */
export const LIP_LEAD = 2 / 30;
export const lipAt = (tg: number) => {
  const f = (tg + LIP_LEAD) * LIP.fps;
  const i = Math.floor(f);
  if (i < 0 || i + 1 >= LIP.open.length) return null;
  const k = f - i;
  const at = (a: number[]) => a[i] + (a[i + 1] - a[i]) * k;
  return { open: at(LIP.open), round: at(LIP.round), teeth: at(LIP.teeth) };
};

/** smooth syllable envelope 0..1 for a talking mouth (seeded so two speakers differ); fallback when no lip track */
export const talkEnv = (t: number, seed: number) => {
  const r = FACE_T.talk.rate;
  const ph = 2 * Math.PI * r * t + 1.4 * Math.sin(2 * Math.PI * 0.9 * t + seed);
  const syl = Math.max(0, Math.sin(ph)) ** 0.7;
  const loud = 0.6 + 0.4 * Math.sin(2 * Math.PI * 1.3 * t + seed * 2.1);
  return syl * loud;
};

/**
 * The face sliders of a character at shot time t.
 * tg = film time (idle drift), blink = the seeded blink, talk = [from, to) ranges in shot seconds.
 */
export const faceAt = (e: ExprKeys, t: number, tg: number, seed: number, blink: boolean, talk: [number, number][] = []): FaceParams => {
  const ks = keysOf(e);
  let i = 0;
  for (let j = 0; j < ks.length; j++) if (ks[j].at <= t) i = j;
  const f = blendAt(ks, i, t, 0);
  // blink on the change (not into wide shock or closed happy eyes) + the seeded blinks
  const ts = i > 0 ? t - ks[i].at : 1e9;
  const [b0, b1] = FACE_T.blinkOnChange;
  const changeBlink = ts >= b0 && ts < b1 && f.eBig < 0.5 && Math.abs(f.eHappy) < 0.5;
  if (blink || changeBlink) f.eOpen = 0;
  // idle life: the face never quite stops
  const I = FACE_T.idle;
  f.bY = [f.bY[0] + I.brow * Math.sin(tg * 1.7 + seed), f.bY[1] + I.brow * Math.sin(tg * 1.5 + seed * 1.3)];
  f.mCurve += I.mouth * Math.sin(tg * 1.1 + seed * 0.7);
  f.tilt += I.tilt * Math.sin(tg * 0.8 + seed);
  // talking: a continuous envelope, eased in and out at the edges of each range
  let w = 0;
  for (const [a0, b] of talk) { const a = a0 - LIP_LEAD; if (t >= a && t < b) w = Math.max(w, Math.min(1, (t - a) / 0.08, (b - t) / 0.08)); }
  // an anime mouth (:3, wobble, tiny, pout) gives way to the talking mouth while the character speaks; a shout stays
  if (w > 0.2 && f.amouth && f.amouth !== "shout") f.amouth = undefined;
  if (w > 0) {
    const lip = lipAt(tg);
    if (lip) {
      // lip-sync: the jaw follows the voice loudness, the lips follow the letter (o/u round, e/i wide, f/v teeth)
      const env = lip.open * w;
      f.mOpen = f.mOpen * (1 - w) + FACE_T.talk.open * env * w;
      const base = Math.max(30, f.mW * 0.85);
      f.mW = lerp(f.mW, lip.round > 0 ? lerp(base, 18, lip.round) : lerp(base, 50, -lip.round), w);
      f.mCurve = lerp(f.mCurve, 0, w * 0.7);
      f.teeth = Math.max(f.teeth * (1 - w), lip.teeth * w * 0.8);
      f.bY = [f.bY[0] - 6 * env, f.bY[1] - 6 * env];
    } else {
      const env = talkEnv(t, seed) * w;
      f.mOpen = Math.max(f.mOpen, f.mOpen * 0.4 + FACE_T.talk.open * env);
      f.mW = lerp(f.mW, Math.max(26, f.mW * 0.8), env * 0.6);
      f.bY = [f.bY[0] - 6 * env, f.bY[1] - 6 * env]; // brows lift a little on stressed syllables
    }
  }
  return f;
};

/** cache key for a face: sliders rounded to steps too small to see */
export const faceKey = (f: FaceParams) => {
  const q = (x: number, s: number) => Math.round(x / s);
  return [
    q(f.bY[0], 1), q(f.bY[1], 1), q(f.bTilt[0], 0.5), q(f.bTilt[1], 0.5), q(f.bArch[0], 0.03), q(f.bArch[1], 0.03), q(f.bLen, 0.02),
    q(f.eOpen, 0.04), q(f.eBig, 0.03), q(f.eHappy, 0.5), q(f.pX, 0.05), q(f.pY, 0.05),
    q(f.lid[0], 0.02), q(f.lid[1], 0.02), q(f.lidTilt[0], 1), q(f.lidTilt[1], 1), q(f.lidB, 0.02), q(f.gX, 0.04), q(f.gY, 0.04),
    q(f.mOpen, 0.015), q(f.mW, 1), q(f.mCurve, 0.02), q(f.mTwist, 0.03), q(f.mShift, 1), q(f.teeth, 0.03), q(f.tongue, 0.03), f.extras.join("+"), f.anime ?? "", f.amouth ?? "",
  ].join(",");
};

/** gaze keys: where the eyes look. A world point, "cam" (into the lens) or null (ahead, toward the facing side) */
export type LookKey = { at: number; to: [number, number, number] | "cam" | null };
export type LookSpec = [number, number, number] | "cam" | LookKey[] | undefined;
/** the active look target and the previous one with the blend (eyes dart in ~0.1 s, the head follows slower) */
export const lookAt = (l: LookSpec, t: number): { prev: LookKey["to"]; cur: LookKey["to"]; k: number } => {
  if (!l) return { prev: null, cur: null, k: 1 };
  if (typeof l === "string" || (Array.isArray(l) && typeof l[0] === "number")) {
    const v = l as LookKey["to"];
    return { prev: v, cur: v, k: 1 };
  }
  const ks = [...(l as LookKey[])].sort((a, b) => a.at - b.at);
  let i = 0;
  for (let j = 0; j < ks.length; j++) if (ks[j].at <= t) i = j;
  if (i === 0 || ks[i].at > t) return { prev: ks[i].to, cur: ks[i].to, k: 1 };
  const u = clamp01((t - ks[i].at) / 0.1);
  return { prev: ks[i - 1].to, cur: ks[i].to, k: u * u * (3 - 2 * u) };
};
/** default gaze when no target: a little toward the facing side, never dead into the lens (RC) */
export const GAZE_AHEAD = { x: 0.45, y: 0.05 };
