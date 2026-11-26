// CamSample: an 8 s camera test of CAMERA_STUDY.md (plain animation, the park set). Four shots, three continuous
// transitions (dive, through, wipe), every beat moving (10 %/s push), roll <= 3 deg, framing solved from head size:
//   1  0.0-1.5 s  ESTABLISHING (no character): high wide on the oak lawn, pushing; exits with a DIVE
//   2  1.5-4.0 s  MEDIUM on the hero (head 35 % of the width, eyes at 1/3); a slow arc; exits THROUGH (push in)
//   3  4.0-5.5 s  INSERT: his phone in hand (no face); exits with a foreground WIPE
//   4  5.5-8.0 s  TWO-SHOT hero + cat (full), then a reveal pull-out (15 % of beats pull out)
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Stickman, jointsAt } from "./char3d/Stickman";
import { needClip } from "./char3d/rig";
import type { ClipKey } from "./char3d/rig";
import { View } from "./engine/core/View";
import type { V3 } from "./engine/types";
import { BlurDefs, layerStyle } from "./film/Film";
import { mergeLook, PLAIN, transOf } from "./film/transitions";
import type { Kind, Look } from "./film/transitions";
import { beatCam, frameHead, standingHead } from "./kit/beatCam";
import type { Beat, ShotOpts } from "./kit/beatCam";
import { Cat } from "./kit/Cat";
import { Phone } from "./kit/Phone";
import { FgWipe, wipeU } from "./kit/FgWipe";
import { faceClear } from "./world/camera";
import { forSet } from "./world/moods";
import { getSet, needSet, sunDir, useSetScene } from "./world/set";
import { useNeeds } from "./world/assets";
import { ShotCtx } from "./world/registry";

export const CS_FRAMES = 240;
const HERO: V3 = [2.3, 0, -0.5], H = 1.72, CAT: V3 = [3.2, 0, -0.2];
const clips: ClipKey[] = [{ clip: "Texting_Standing", from: 0 } as any];
const needs = [needSet("park", "day"), needClip("Texting_Standing")];

const MOOD = (set: any) => { const m: any = forSet("day" as any, sunDir(set), { sat: 1.05 });
  return { ...m, sky: { ...m.sky, top: "#1f5ad0", mid: "#69a2ec", bottom: "#e2eef9", cloudColor: "#a9bcd8", cloudLit: "#ffffff", clouds: 0.8, horizon: 0.26, cloudStyle: "puffy" } }; };

const Scene: React.FC<{ t: number; beats: Beat[]; o: ShotOpts; cat?: boolean; wipeIn?: boolean; wipeOut?: boolean }> = ({ t, beats, o, cat, wipeIn, wipeOut }) => {
  const set = getSet("park", "day"); const scene = useSetScene(set);
  const c = beatCam(beats, t, o);
  const P: any = jointsAt("hero", clips, t, HERO, 0.3, undefined as any);
  const h = P?.RightHandMiddle1; const hand: V3 = h ? [h[0] ?? h.x, h[1] ?? h.y, h[2] ?? h.z] : [HERO[0], 1, HERO[2]];
  const hd = P?.Head; const headP: V3 = hd ? [hd[0] ?? hd.x, (hd[1] ?? hd.y) + 0.2, hd[2] ?? hd.z] : head;
  const wu = o.dur ? wipeU(t, o.dur, !!wipeIn, !!wipeOut) : null;
  const inTrans = t < 8 / 30 || (o.dur ? t > o.dur - 8 / 30 : false); // planned moves through the set
  if (wu === null && !inTrans) faceClear(scene, c, [headP], Math.round(t * 30), `CamSample t=${t.toFixed(2)}`);
  return (
    <View mood={MOOD(set)} cam={c} t={t} focus={c.look} blur={1.2} near={0.03} far={220}>
      <primitive object={scene} />
      <Stickman who="hero" t={t} tg={t} at={HERO} yaw={0.3} cam={c.pos} clips={clips} walking={0} expr={[{ at: 0, e: "smug" }] as any} />
      <Phone at={[hand[0] + 0.02, hand[1] + 0.1, hand[2] + 0.07]} to={[hand[0] + 0.1, hand[1] + 0.4, hand[2] + 0.3]} upto={3} glow={0.8} />
      {cat ? <Cat t={t} at={CAT} cam={c.pos} pose="sit" size={0.6} facing={-1} /> : null}
      {wu !== null ? <FgWipe cam={c} u={wu} color="#3a2e22" /> : null}
    </View>
  );
};

const { head, headW } = standingHead(HERO, H);
type S = { a: number; b: number; enter: Kind; Comp: React.FC<{ t: number; dur: number }> };
const SH: S[] = [
  { a: 0, b: 45, enter: "cut", Comp: ({ t, dur }) =>
    <Scene t={t} o={{ dur, exit: "dive" }} beats={[{ at: 0, subj: [1.6, 2.4, -1.6], az: 60, el: 16, dist: 13, fov: 46 }]} /> },
  { a: 45, b: 120, enter: "dive", Comp: ({ t, dur }) =>
    <Scene t={t} o={{ dur, enter: "dive", exit: "through" }} beats={[
      { at: 0, ...frameHead(head, headW, "M", 18, 4), orbit: 4 },
      { at: 1.4, ...frameHead(head, headW, "M", 8, 2), move: 0.6 }]} /> },
  { a: 120, b: 165, enter: "through", Comp: ({ t, dur }) => {
    const P: any = jointsAt("hero", clips, t, HERO, 0.3, undefined as any); const hp = P?.RightHandMiddle1;
    const hand: V3 = hp ? [hp[0] ?? hp.x, hp[1] ?? hp.y, hp[2] ?? hp.z] : [HERO[0], 1, HERO[2]];
    return <Scene t={t} wipeOut o={{ dur, enter: "through", exit: "wipe" }} beats={[{ at: 0, subj: hand, az: 12, el: 42, dist: 0.6, fov: 42 }]} />; } },
  { a: 165, b: 240, enter: "cut", Comp: ({ t, dur }) =>
    <Scene t={t} cat wipeIn o={{ dur, enter: "wipe" }} beats={[
      { at: 0, subj: [2.75, 0.95, -0.35], az: -10, el: 6, dist: 4.6, fov: 46 },
      { at: 1.3, subj: [2.7, 1.3, -0.6], az: -6, el: 16, dist: 7.0, fov: 48, move: 1.0, push: -0.04 }]} /> },
];

export const CamSample: React.FC = () => {
  const fp = useCurrentFrame();
  const vis: { i: number; s: S; look: Look }[] = [];
  SH.forEach((s, i) => {
    const tin = transOf(s.enter), nx = SH[i + 1], tout = nx ? transOf(nx.enter) : transOf("cut");
    if (fp < s.a - tin.pre || fp >= s.b + tout.post) return;
    let look = PLAIN; const u = fp - s.a, v = fp - s.b;
    if (i > 0 && u < tin.inTo) look = mergeLook(look, tin.in(u, 1080));
    if (nx && v >= -tout.outFrom) look = mergeLook(look, tout.out(v, 1080));
    vis.push({ i, s, look });
  });
  const ready = useNeeds(needs);
  if (!ready) return <AbsoluteFill style={{ background: "#000" }} />;
  return (
    <AbsoluteFill style={{ background: "#000", overflow: "hidden" }}>
      <BlurDefs vis={vis.map((v) => ({ id: 100 + v.i, look: v.look }))} />
      {vis.map((v) => (
        <AbsoluteFill key={v.i} style={layerStyle(v.look, 100 + v.i)}>
          <ShotCtx.Provider value={100 + v.i}><v.s.Comp t={(fp - v.s.a) / 30} dur={(v.s.b - v.s.a) / 30} /></ShotCtx.Provider>
        </AbsoluteFill>
      ))}
    </AbsoluteFill>
  );
};
