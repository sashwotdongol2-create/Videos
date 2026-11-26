// HAND PROPS for duo scenes (2026-11-26, films 118-137): small things a figure carries in the outer hand.
//   hero: { ..., hold: HOLD_R, carry: (hand) => <Mic p={hand} /> }      (the person on the LEFT holds with HOLD_R)
//   other: { ..., hold: HOLD_L, carry: (hand, tg) => (tg > T ? <Sheet p={hand} /> : null) }
// `hold` keeps the outer arm bent in front of the chest in every pose; the prop sits at the drawn hand duo() passes in.
import React from "react";
import type { PoseDef } from "../char3d/poseEngine";
import { boxG, coneG, cylG, M, sphG, torG } from "../engine/core/kit";
import type { V3 } from "../engine/types";

export const HOLD_R: Partial<PoseDef> = { rArm: [-0.28, -0.85, 0.32], rFore: [0.18, 0.5, 0.82] };
export const HOLD_L: Partial<PoseDef> = { lArm: [0.28, -0.85, 0.32], lFore: [-0.18, 0.5, 0.82] };
const up = (p: V3, dy: number, dz = 0.02): V3 => [p[0], p[1] + dy, p[2] + dz];

/** a hand microphone */
export const Mic: React.FC<{ p: V3 }> = ({ p }) => (
  <group position={up(p, 0.05)}>
    <M g={cylG(0.016, 0.02, 0.17, 10)} c="#2b2d35" cast={false} />
    <M g={sphG(0.04, 12)} c="#9aa2aa" tex="metal" p={[0, 0.115, 0]} cast={false} />
  </group>
);
/** a sheet of paper; `mark` = a coloured block on it (a grade, a stamp), `lines` = rows of writing */
export const Sheet: React.FC<{ p: V3; yaw?: number; c?: string; mark?: string; lines?: number; w?: number; h?: number }> = ({ p, yaw = 0, c = "#fbf6ea", mark, lines = 3, w = 0.2, h = 0.26 }) => (
  <group position={up(p, 0.03, 0.03)} rotation={[0, yaw, 0.06]}>
    <M g={boxG(w, h, 0.01)} c={c} cast={false} />
    {Array.from({ length: lines }, (_, i) => <M key={i} g={boxG(w * 0.7, 0.012, 0.012)} c="#8a8f96" p={[0, -h * 0.05 - i * 0.04, 0.002]} cast={false} />)}
    {mark ? <M g={boxG(w * 0.36, h * 0.24, 0.013)} c={mark} p={[w * 0.2, h * 0.3, 0.002]} cast={false} /> : null}
  </group>
);
/** a phone held up */
export const Phone: React.FC<{ p: V3; screen?: string }> = ({ p, screen = "#bfe0ff" }) => (
  <group position={up(p, 0.05)} rotation={[0, 0.3, 0.1]}>
    <M g={boxG(0.078, 0.155, 0.012)} c="#17121a" cast={false} />
    <M g={boxG(0.064, 0.13, 0.014)} c={screen} cast={false} />
  </group>
);
/** a gold cup */
export const Trophy: React.FC<{ p: V3 }> = ({ p }) => (
  <group position={up(p, 0.02)}>
    <M g={boxG(0.09, 0.03, 0.09)} c="#4a2c1a" cast={false} />
    <M g={cylG(0.014, 0.02, 0.08, 10)} c="#f2c230" tex="metal" p={[0, 0.055, 0]} cast={false} />
    <M g={cylG(0.07, 0.03, 0.12, 16)} c="#f2c230" tex="metal" p={[0, 0.155, 0]} cast={false} />
    {[-1, 1].map((k) => <M key={k} g={torG(0.035, 0.008, Math.PI)} c="#f2c230" tex="metal" p={[k * 0.065, 0.16, 0]} r={[0, 0, (-k * Math.PI) / 2]} cast={false} />)}
  </group>
);
/** an open ring box */
export const RingBox: React.FC<{ p: V3 }> = ({ p }) => (
  <group position={up(p, 0.02, 0.04)}>
    <M g={boxG(0.08, 0.045, 0.08)} c="#7a2f4a" tex="fabric" cast={false} />
    <M g={boxG(0.08, 0.08, 0.012)} c="#7a2f4a" tex="fabric" p={[0, 0.055, -0.04]} cast={false} />
    <M g={torG(0.02, 0.006)} c="#f2c230" tex="metal" p={[0, 0.045, 0]} cast={false} />
    <M g={sphG(0.014, 8)} c="#dff4ff" p={[0, 0.07, 0]} cast={false} />
  </group>
);
/** a ladle / big spoon */
export const Ladle: React.FC<{ p: V3 }> = ({ p }) => (
  <group position={up(p, 0.08)} rotation={[0, 0, -0.25]}>
    <M g={cylG(0.011, 0.011, 0.3, 8)} c="#b9bcc2" tex="metal" cast={false} />
    <M g={sphG(0.045, 12)} c="#b9bcc2" tex="metal" p={[0, 0.17, 0]} s={[1, 0.6, 1]} cast={false} />
  </group>
);
/** a small booklet (passport, notebook) */
export const Booklet: React.FC<{ p: V3; c?: string }> = ({ p, c = "#7a2f3a" }) => (
  <group position={up(p, 0.04, 0.03)} rotation={[0, 0, 0.1]}>
    <M g={boxG(0.1, 0.14, 0.016)} c={c} cast={false} />
    <M g={boxG(0.04, 0.04, 0.018)} c="#f2c230" p={[0, 0.02, 0]} cast={false} />
  </group>
);
/** a thick stack of pages (a script, a pile of quizzes) */
export const Stack: React.FC<{ p: V3; c?: string }> = ({ p, c = "#fbf6ea" }) => (
  <group position={up(p, 0.02, 0.05)} rotation={[0.5, 0.2, 0]}>
    <M g={boxG(0.2, 0.09, 0.27)} c={c} cast={false} />
    {[0, 1, 2].map((i) => <M key={i} g={boxG(0.202, 0.004, 0.272)} c="#b8b0a0" p={[0, -0.025 + i * 0.025, 0]} cast={false} />)}
  </group>
);
/** a clipboard */
export const Board: React.FC<{ p: V3; yaw?: number }> = ({ p, yaw = 0 }) => (
  <group position={up(p, 0.03, 0.03)} rotation={[0, yaw, 0.06]}>
    <M g={boxG(0.21, 0.28, 0.012)} c="#8a5a32" cast={false} />
    <M g={boxG(0.18, 0.23, 0.014)} c="#fbf6ea" p={[0, -0.01, 0.002]} cast={false} />
    <M g={boxG(0.07, 0.025, 0.02)} c="#9aa2aa" tex="metal" p={[0, 0.125, 0.002]} cast={false} />
  </group>
);
/** a party cone used as a megaphone, a flag on a stick, a small card: one colour, one shape */
export const CardProp: React.FC<{ p: V3; c: string }> = ({ p, c }) => (
  <group position={up(p, 0.2, 0.03)} rotation={[0, 0, 0.08]}>
    <M g={boxG(0.11, 0.16, 0.01)} c={c} cast={false} />
  </group>
);
export const Cone: React.FC<{ p: V3; c: string; r?: number; h?: number }> = ({ p, c, r = 0.1, h = 0.25 }) => <M g={coneG(r, h, 14)} c={c} p={p} cast={false} />;
