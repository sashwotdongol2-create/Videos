// DUO SCENE (2026-11-25, films 78-87): one place, the hero and at most one partner, many cameras. A meter-format
// film is then one short file: the two people (where they stand or sit, their beats on the words), the set, the list
// of cameras. Everything 75-77 did by hand is here: coded poses from act(), solo singles, the hero turning to the lens
// in asides ("cam" / "end" turns in src/turns.json), a prop carried in a drawn hand, StageQA in every shot.
//   export const SHOTS = duo({ pal, hero: { id: "jay", spk: "JAY", x: -0.47, h: 1.76, beats: [...] },
//     other: { id: "dana", spk: "DANA", x: 0.47, h: 1.66, beats: [...] }, Set, shots: ["two", { hero: 4, w: 0.35 }, "end"] });
// Sides come from x: the person on screen right gets mirrored poses and marks on the right. A seated person sits at
// SIT behind a Table (y 0.6, z 0.42); someone standing in a room with a table stands behind it (z about -0.25).
// The camera pushes in all through a shot (`rate`, per second): a shot longer than about 6 s needs a lower rate
// (two-shot 0.012, single 0.02), or a head or the hips leave the frame before the cut.
import React from "react";
import * as THREE from "three";
import { act } from "../char3d/act";
import type { ActBeat } from "../char3d/act";
import { Manpu } from "../char3d/manpu";
import { needProc, POSES } from "../char3d/poseEngine";
import type { PoseDef, ProcKey } from "../char3d/poseEngine";
import type { ClipKey } from "../char3d/rig";
import { Stickman } from "../char3d/Stickman";
import type { ExprKey } from "../char3d/Stickman";
import { View } from "../engine/core/View";
import type { V3 } from "../engine/types";
import { shotStartS } from "../film/time";
import { lens, push } from "../world/camera";
import { moodFor, SET_VIEW } from "../world/codeSet";
import type { Palette } from "../world/codeSet";
import { single, twoShot } from "../world/dialogueCam";
import type { DCam } from "../world/dialogueCam";
import { StageQA } from "../world/stage";
import TURNS from "../turns.json";
import type { ShotDef } from "./types";

export type Turn = { n: number; spk: string; mode: string; i0: number; i1: number; t0: number; t1: number };
export const TURN = TURNS as Turn[];
/** start / end of turn n (1-based) in film seconds */
export const t0 = (n: number) => TURN[n - 1].t0;
export const t1 = (n: number) => TURN[n - 1].t1;
export const SIT = -0.24;

export type Person = {
  id: string;
  /** the speaker name in turns.json */
  spk: string;
  x: number;
  z?: number;
  h: number;
  seated?: boolean;
  yaw?: number;
  beats: ActBeat[];
  /** arm directions kept in every pose (an arm that holds something) */
  hold?: Partial<PoseDef>;
  /** a prop at the drawn hand of the outer arm (hand position, film seconds) */
  carry?: (hand: V3, tg: number) => React.ReactNode;
  /** what they look at when not talking to the lens (default: the partner's head) */
  look?: V3;
};
export type Cam =
  | "two"
  | "end"
  | { two: number; rate?: number }
  | { hero: number; w?: number; y?: number; rate?: number }
  | { other: number; w?: number; y?: number; rate?: number }
  | { cam: DCam; show?: "both" | "hero" | "other" | "none"; rate?: number };
export type DuoCfg = { pal: Palette; hero: Person; other?: Person; Set: React.FC<{ tg: number }>; shots: Cam[]; fill?: number; twoY?: number; exposure?: number };

const withHold = (ks: ProcKey[], hold: Partial<PoseDef>): ProcKey[] => ks.map((k) => ({ ...k, pose: { ...(typeof k.pose === "string" ? POSES[k.pose] ?? POSES.neutral : k.pose), ...hold } }));
const mk = (p: Person) => {
  const right = p.x > 0;
  const a = act(p.beats, { seated: !!p.seated, mirror: right, markSide: right ? 1 : -1 });
  const at: V3 = [p.x, p.seated ? SIT : 0, p.z ?? 0];
  const yaw = p.yaw ?? (right ? -1 : 1) * (p.seated ? 0.8 : 0.5);
  const head: V3 = [at[0], at[1] + p.h * 0.855, at[2]];
  const keys = p.hold ? withHold(a.keys, p.hold) : a.keys;
  const talk = TURN.filter((x) => x.spk === p.spk).map((x) => [x.t0 - 0.02, x.t1 + 0.04] as [number, number]);
  return { p, right, a, at, yaw, head, keys, talk, clip: `Proc_${p.id}` };
};
type Made = ReturnType<typeof mk>;
/** head centre of a person as duo() places them (for set dressing and custom cameras) */
export const headOf = (p: Person): V3 => [p.x, (p.seated ? SIT : 0) + p.h * 0.855, p.z ?? 0];

const Body: React.FC<{ m: Made; t: number; tg: number; off: number; cam: V3; yaw: number; look: V3 | "cam" | undefined }> = ({ m, t, tg, off, cam, yaw, look }) => {
  const clips: ClipKey[] = [{ clip: m.clip, from: 0, offset: off, loop: false, step: false }];
  const expr = m.a.expr.map((k) => ({ at: k.at - off, e: k.e })) as ExprKey[];
  const talk = m.talk.map(([a, b]) => [a - off, b - off] as [number, number]);
  let carried: React.ReactNode = null;
  if (m.p.carry) {
    // the drawn hand of the outer arm rests in front of the chest (the skeleton's own hand joint is further out)
    const f = new THREE.Vector3(Math.sin(m.yaw), 0, Math.cos(m.yaw));
    const l = new THREE.Vector3(Math.cos(m.yaw), 0, -Math.sin(m.yaw)).multiplyScalar(m.right ? 1 : -1);
    const hand = new THREE.Vector3(...m.at).addScaledVector(f, 0.2).addScaledVector(l, 0.12);
    carried = m.p.carry([hand.x, m.at[1] + m.p.h * 0.58, hand.z], tg);
  }
  return (
    <>
      <Stickman who={m.p.id} t={t} tg={tg} at={m.at} yaw={yaw} cam={cam} clips={clips} walking={0} react={0.25} facing={m.right ? -1 : 1} expr={expr} talk={talk} look={look} />
      {carried}
      <Manpu who={m.p.id} clips={clips} t={t} at={m.at} yaw={yaw} cam={cam} height={m.p.h} marks={m.a.marks.map((mk2) => ({ ...mk2, at: mk2.at - off }))} />
    </>
  );
};

export const duo = (cfg: DuoCfg): ShotDef[] => {
  const H = mk(cfg.hero);
  const O = cfg.other ? mk(cfg.other) : null;
  const mood = moodFor(cfg.pal, cfg.exposure ?? 0.2);
  const needs = [needProc(H.clip, H.keys), ...(O ? [needProc(O.clip, O.keys)] : [])];
  const aside = (tg: number) => TURN.some((x) => x.spk === cfg.hero.spk && ((x.mode === "cam" && tg >= x.t0 - 0.15 && tg <= x.t1 + 0.25) || (x.mode === "end" && tg >= x.t0 - 0.15)));
  type Spec = { d: DCam; rate: number; show: "both" | "hero" | "other" | "none" };
  const spec = (c: Cam): Spec => {
    if (c === "end") return { d: single(H.head, { az: H.right ? -3 : 3, widthFrac: 0.35, yFrac: 0.34 }), rate: 0.03, show: "hero" };
    if (c === "two" || "two" in c) {
      if (!O) throw new Error("duo: a two-shot needs `other`");
      const [a, b] = H.right ? [O.head, H.head] : [H.head, O.head];
      return { d: twoShot(a, b, { fill: cfg.fill ?? 0.7, yFrac: cfg.twoY ?? 0.6, dx: c === "two" ? 0 : c.two }), rate: c === "two" ? 0.03 : c.rate ?? 0.03, show: "both" };
    }
    if ("hero" in c) return { d: single(H.head, { az: c.hero, widthFrac: c.w ?? 0.32, yFrac: c.y }), rate: c.rate ?? 0.06, show: "hero" };
    if ("other" in c) {
      if (!O) throw new Error("duo: this camera needs `other`");
      return { d: single(O.head, { az: c.other, widthFrac: c.w ?? 0.32, yFrac: c.y }), rate: c.rate ?? 0.06, show: "other" };
    }
    return { d: c.cam, rate: c.rate ?? 0.03, show: c.show ?? "both" };
  };
  const Scene: React.FC<{ t: number; tg: number; id: number; s: Spec }> = ({ t, tg, id, s }) => {
    const cam = lens(push(s.d.pos, s.d.look, t, 0, s.rate), s.d.fov);
    const off = shotStartS(id);
    const ja = aside(tg);
    const hYaw = ja ? (H.right ? -0.16 : 0.16) : H.yaw;
    const showH = s.show === "both" || s.show === "hero";
    const showO = !!O && (s.show === "both" || s.show === "other");
    const keep = [...(showH ? [H.p.id] : []), ...(showO && O ? [O.p.id] : [])];
    return (
      <View {...SET_VIEW} mood={mood} cam={cam} t={tg} focus={s.d.look}>
        <cfg.Set tg={tg} />
        {showH ? <Body m={H} t={t} tg={tg} off={off} cam={cam.pos} yaw={hYaw} look={ja ? "cam" : H.p.look ?? O?.head} /> : null}
        {showO && O ? <Body m={O} t={t} tg={tg} off={off} cam={cam.pos} yaw={O.yaw} look={O.p.look ?? H.head} /> : null}
        {keep.length ? <StageQA cam={cam} subject={s.d.look} who={keep.length === 1 ? keep[0] : undefined} keep={keep} label={`s${id} t=${t.toFixed(2)}`} /> : null}
      </View>
    );
  };
  return cfg.shots.map((c, i) => {
    const s = spec(c);
    const id = i + 1;
    return { id, needs, Comp: ({ t, tg }) => <Scene t={t} tg={tg} id={id} s={s} /> };
  });
};
