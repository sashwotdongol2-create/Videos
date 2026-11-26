// beatCam: the word-keyed camera of references/RC_CAMERA_MOVEMENT.md §6.
// A shot's camera is a list of beats keyed on shot seconds (use Wl(word, shot)). Each beat sets what to aim at
// (subj) and where the lens sits on a sphere around it (az / el in degrees, dist in m), plus fov, roll, the move's
// length (s, the move PEAKS on the beat time: it starts 60 % of `move` before it), push (log zoom per s after the
// move), orbit (deg/s drift; default 1.5) and hold (true = rate 0: punchlines and reveal words).
// Between beats the lens travels on the sphere (so it passes things: parallax), with a bank of 0.006 x the angular
// speed (deg/s, i.e. 0.006 x rad-scaled) capped at 3 deg, plus the beat's own roll. Pure function of t.
// CAMERA_STUDY.md (31 Shorts measured): the camera never stops (hold = a calm 5 %/s push, not a freeze), the default
// push is 10 %/s, roll is capped at 3 deg, shots enter / exit with a carried move over 8 frames (enter / exit options)
// and framing is solved from the head size (frameHead).
import type { V3 } from "../engine/types";

export const CAM = { push: 0.10, calmPush: 0.05, calmOrbit: 0.5, orbit: 1.5, rollMax: 3, transF: 8, move: 14 / 30, bank: 0.006 };

export type Beat = { at: number; subj: V3; az: number; el: number; dist: number; fov?: number; roll?: number; move?: number; push?: number; orbit?: number; hold?: boolean };
export type BeatCam = { pos: V3; look: V3; fov: number; roll: number };

// RicksClips' measured move (257 moves): ~14 frames, speed peaking at 41 % of the move (a quick start, a longer
// settle). Quintic smootherstep on u^0.85 peaks at 41.8 % (the symmetric quintic peaks at 50 %).
const ease = (u: number) => { const k = Math.pow(Math.max(0, Math.min(1, u)), 0.85); return k * k * k * (k * (k * 6 - 15) + 10); };
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const R = Math.PI / 180;

const place = (b: { subj: V3; az: number; el: number; dist: number }): V3 => {
  const a = b.az * R, e = b.el * R;
  return [b.subj[0] + Math.sin(a) * Math.cos(e) * b.dist, b.subj[1] + Math.sin(e) * b.dist, b.subj[2] + Math.cos(a) * Math.cos(e) * b.dist];
};

/** the beat-state (subject, az, el, dist, fov, roll) at time t, before banking */
const stateAt = (beats: Beat[], t: number) => {
  let cur = { ...beats[0], fov: beats[0].fov ?? 40, roll: beats[0].roll ?? 0 };
  let since = Math.max(0, t - beats[0].at);
  for (let i = 1; i < beats.length; i++) {
    const b = beats[i], mv = b.move ?? CAM.move, t0 = b.at - 0.6 * mv;
    if (t < t0) break;
    const prev = cur;
    // the previous beat keeps drifting until this move starts
    const drift = (prev.hold ? CAM.calmOrbit : (prev.orbit ?? CAM.orbit)) * Math.max(0, t0 - prev.at);
    const pushed = Math.exp(-(prev.hold ? CAM.calmPush : (prev.push ?? CAM.push)) * Math.max(0, t0 - prev.at));
    const k = ease((t - t0) / mv);
    cur = {
      ...b,
      subj: [lerp(prev.subj[0], b.subj[0], k), lerp(prev.subj[1], b.subj[1], k), lerp(prev.subj[2], b.subj[2], k)],
      az: lerp(prev.az + drift, b.az, k), el: lerp(prev.el, b.el, k), dist: lerp(prev.dist * pushed, b.dist, k),
      fov: lerp(prev.fov, b.fov ?? prev.fov, k), roll: lerp(prev.roll, b.roll ?? 0, k),
      at: k < 1 ? prev.at : b.at,
    } as any;
    if (k < 1) return { s: cur, since: 0, moving: true };
    since = t - b.at;
  }
  const hold = cur.hold;
  return {
    s: { ...cur, az: cur.az + (hold ? CAM.calmOrbit : (cur.orbit ?? CAM.orbit)) * Math.max(0, since), dist: cur.dist * Math.exp(-(hold ? CAM.calmPush : (cur.push ?? CAM.push)) * Math.max(0, since)) },
    since, moving: false,
  };
};

/** carried moves into / out of a shot over CAM.transF frames (pair them with the same kind in edit.json):
 *  through = a fast push into the frame; dive = a downward swoop; whip = a fast pan; wipe = a lateral slide (behind a
 *  foreground object); move = a gentle drift that keeps the camera moving across a cut */
export type TransMove = "through" | "dive" | "whip" | "wipe" | "move";
export type ShotOpts = { dur?: number; enter?: TransMove; exit?: TransMove };
const carry = (k: TransMove, u: number, out: boolean) => {
  // u: 0 = far from the boundary, 1 = at the boundary
  const e = u * u, sg = out ? 1 : -1;
  switch (k) {
    case "through": return { dist: out ? 1 - 0.45 * e : 1 + 0.35 * e, az: 0, el: 0, y: 0 };
    case "dive": return { dist: 1, az: 0, el: sg * -28 * e, y: sg * -0.6 * e };
    case "whip": return { dist: 1, az: sg * 35 * e, el: 0, y: 0 };
    case "wipe": return { dist: 1, az: sg * 16 * u, el: 0, y: 0 };
    // push only: a sideways swing here read as roll on high / downward shots (camqa 2026-11-20)
    default: return { dist: out ? 1 - 0.06 * u : 1 + 0.06 * u, az: 0, el: 0, y: 0 };
  }
};

export const beatCam = (beats: Beat[], t: number, o: ShotOpts = {}): BeatCam => {
  const T = CAM.transF / 30;
  const st = (tt: number) => {
    const { s } = stateAt(beats, tt);
    let dist = s.dist, az = s.az, el = s.el, y = 0;
    const apply = (k: TransMove | undefined, u: number, out: boolean) => {
      if (!k || u <= 0) return;
      const c = carry(k, Math.min(1, u), out); dist *= c.dist; az += c.az; el += c.el; y += c.y;
    };
    if (o.exit && o.dur) apply(o.exit, (tt - (o.dur - T)) / T, true);
    // every shot enters already moving (measured: RicksClips' camera speed RISES through transitions, ours dipped)
    apply(o.enter ?? "move", 1 - tt / T, false);
    const subj: V3 = [s.subj[0], s.subj[1] + y, s.subj[2]];
    return { ...s, dist, az, el, subj };
  };
  const s = st(t), s1 = st(t + 1 / 30);
  const angSpeed = Math.abs(s1.az - s.az) * 30; // deg/s
  const bank = Math.sign(s1.az - s.az) * Math.min(CAM.rollMax, angSpeed * CAM.bank);
  const roll = Math.max(-CAM.rollMax, Math.min(CAM.rollMax, (s.roll ?? 0) + bank));
  return { pos: place(s), look: s.subj, fov: s.fov ?? 40, roll }; // degrees (View)
};

/** CAMERA_STUDY §4.5 framing: the beat that puts a standing (or any) head at the measured size and height.
 *  head = the head's centre (world), headW = its width (m; a stickman's is 0.32 x its height).
 *  Head width / frame width and eye line from the top: X 0.75 / 0.45, C 0.52 / 0.40, M 0.35 / 0.33, F 0.16 / 0.22,
 *  W 0.07 / 0.40. Returns subj (aim point, shifted so the head lands on its line) + dist for the given fov. */
export type ShotSize = "X" | "C" | "M" | "F" | "W";
export const SIZE = { X: [0.75, 0.45], C: [0.52, 0.40], M: [0.35, 0.33], F: [0.16, 0.22], W: [0.07, 0.40] } as const;
export const frameHead = (head: V3, headW: number, size: ShotSize, az: number, el: number, fov = 44, aspect = 9 / 16) => {
  const [wFrac, yTop] = SIZE[size];
  const tv = Math.tan((fov * Math.PI) / 360), th = tv * aspect;
  const dist = headW / (wFrac * 2 * th);
  const drop = (0.5 - yTop) * 2 * dist * tv * Math.cos((el * Math.PI) / 180); // aim below the head
  return { subj: [head[0], head[1] - drop, head[2]] as V3, az, el, dist, fov };
};
/** head centre + width of a standing character from its feet position and height */
export const standingHead = (at: V3, height: number): { head: V3; headW: number } =>
  ({ head: [at[0], at[1] + height * (1 - 0.29 / 2), at[2]], headW: 0.29 * height * 1.1 });
