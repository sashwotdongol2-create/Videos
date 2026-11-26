// MANPU: the anime symbols around a head (2026-11-24). A big sweat drop that slides down, the cross-popping anger vein,
// "!" "?" and "..." that pop over the head, sparkles, a gloom cloud with hanging lines, steam puffs, a shock burst
// behind the head and floating hearts. Flat ink drawings on billboards that face the lens and follow the drawn head
// (jointsAt), so they work in every shot and at any yaw. Pure functions of t: pop in with an overshoot, live, fade.
// Pair them with the anime faces (a_* in src/char/drawCharacter.ts) and key both to the word that causes them
// (film/cues.ts). Usage, inside the View after the <Stickman/>:
//   <Manpu who="zoe" clips={zClip} t={t} at={Z_AT} yaw={Z_YAW} cam={cam.pos} height={1.66} marks={[{ at: 3.1, kind: "question" }]} />
import React from "react";
import * as THREE from "three";
import { canvasTex } from "../engine/core/kit";
import type { V3 } from "../engine/types";
import type { ClipKey } from "./rig";
import { jointsAt } from "./Stickman";

export type MarkKind = "sweat" | "vein" | "exclaim" | "question" | "dots" | "sparkles" | "gloom" | "steam" | "shock" | "hearts";
/** at = shot seconds; dur = how long it stays (default per kind); side = which side of the head (1 = screen right) */
export type MarkKey = { at: number; kind: MarkKind; dur?: number; side?: 1 | -1 };
// SIZE RULE (user, 2026-11-24: "certain things are overdone and oversized"): a mark is an accent, well under half a
// head; the face carries the reaction. Budget: at most one mark per character per exchange (about one per 6 s overall).
export const MARK_DUR: Record<MarkKind, number> = { sweat: 1.2, vein: 1.1, exclaim: 0.8, question: 1.0, dots: 1.3, sparkles: 1.0, gloom: 1.4, steam: 1.1, shock: 0.5, hearts: 1.3 };

const INK = "#1a1416";
const PX = 256;
const halo = (g: CanvasRenderingContext2D, w: number, draw: () => void) => {
  // a white halo under the ink, so a mark reads on any background
  g.save(); g.strokeStyle = "#ffffff"; g.lineWidth = w; g.lineJoin = "round"; g.lineCap = "round"; draw(); g.stroke(); g.restore();
};
const TEX: Record<string, (g: CanvasRenderingContext2D, w: number, h: number) => void> = {
  sweat: (g) => {
    const path = () => { g.beginPath(); g.moveTo(128, 20); g.bezierCurveTo(150, 80, 205, 130, 200, 175); g.arc(128, 175, 72, 0, Math.PI); g.bezierCurveTo(51, 130, 106, 80, 128, 20); g.closePath(); };
    halo(g, 34, path); path(); g.fillStyle = "#9FD4F5"; g.fill(); g.lineWidth = 14; g.strokeStyle = INK; g.stroke();
    g.beginPath(); g.ellipse(104, 168, 14, 26, -0.3, 0, Math.PI * 2); g.fillStyle = "#ffffff"; g.fill();
  },
  vein: (g) => {
    const arm = (dx: number, dy: number) => { g.beginPath(); g.moveTo(128 + dx * 22, 128 + dy * 96); g.quadraticCurveTo(128 + dx * 10, 128 + dy * 10, 128 + dx * 96, 128 + dy * 22); };
    for (const [dx, dy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { halo(g, 64, () => arm(dx, dy)); }
    for (const [dx, dy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { arm(dx, dy); g.strokeStyle = INK; g.lineWidth = 50; g.lineCap = "round"; g.stroke(); arm(dx, dy); g.strokeStyle = "#E0483C"; g.lineWidth = 30; g.stroke(); }
  },
  exclaim: (g) => {
    const bar = () => { g.beginPath(); g.moveTo(108, 24); g.lineTo(148, 24); g.lineTo(138, 168); g.lineTo(118, 168); g.closePath(); };
    halo(g, 30, bar); bar(); g.fillStyle = INK; g.fill();
    g.beginPath(); g.arc(128, 214, 22, 0, Math.PI * 2); g.lineWidth = 30; g.strokeStyle = "#fff"; g.stroke(); g.fillStyle = INK; g.fill();
  },
  question: (g) => {
    const hook = () => { g.beginPath(); g.moveTo(70, 82); g.bezierCurveTo(70, 10, 190, 10, 186, 82); g.bezierCurveTo(184, 130, 128, 130, 128, 170); };
    halo(g, 70, hook); hook(); g.strokeStyle = INK; g.lineWidth = 40; g.lineCap = "round"; g.stroke();
    g.beginPath(); g.arc(128, 222, 22, 0, Math.PI * 2); g.lineWidth = 26; g.strokeStyle = "#fff"; g.stroke(); g.fillStyle = INK; g.fill();
  },
  dot: (g) => { g.beginPath(); g.arc(128, 128, 70, 0, Math.PI * 2); g.lineWidth = 36; g.strokeStyle = "#fff"; g.stroke(); g.fillStyle = INK; g.fill(); },
  star: (g) => {
    const P: [number, number][] = [];
    for (let k = 0; k < 8; k++) { const a = (k * Math.PI) / 4 - Math.PI / 2; const r = k % 2 ? 30 : 110; P.push([128 + Math.cos(a) * r, 128 + Math.sin(a) * r]); }
    const path = () => { g.beginPath(); P.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); };
    path(); g.fillStyle = "#FFE066"; g.fill(); g.lineWidth = 12; g.strokeStyle = INK; g.lineJoin = "round"; g.stroke();
  },
  gloom: (g) => {
    // a dark cloud with hanging lines (drawn on a 256 x 256 canvas used as a wide, tall plane)
    g.fillStyle = "rgba(60,50,110,0.9)";
    for (const [x, y, r] of [[70, 70, 46], [128, 52, 58], [188, 72, 46], [100, 92, 40], [160, 94, 40]]) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
    g.strokeStyle = "rgba(60,50,110,0.85)"; g.lineCap = "round";
    for (let i = 0; i < 7; i++) { const x = 40 + i * 29; g.lineWidth = 9; g.beginPath(); g.moveTo(x, 120); g.lineTo(x, 150 + ((i * 37) % 40)); g.stroke(); }
  },
  puff: (g) => {
    g.fillStyle = "rgba(255,255,255,0.95)"; g.strokeStyle = INK; g.lineWidth = 12;
    g.beginPath(); for (const [x, y, r] of [[100, 140, 60], [150, 120, 66], [130, 170, 50]]) { g.moveTo(x + r, y); g.arc(x, y, r, 0, Math.PI * 2); } g.fill(); g.stroke();
  },
  shock: (g) => {
    // bold tapered spikes round the head (thin strokes read as scratches at phone size)
    g.fillStyle = INK;
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2 + 0.26;
      const r0 = 92, r1 = k % 2 ? 110 : 122, w = k % 2 ? 0.03 : 0.045;
      g.beginPath();
      g.moveTo(128 + Math.cos(a - w) * r1, 128 + Math.sin(a - w) * r1);
      g.lineTo(128 + Math.cos(a + w) * r1, 128 + Math.sin(a + w) * r1);
      g.lineTo(128 + Math.cos(a) * r0, 128 + Math.sin(a) * r0);
      g.closePath();
      g.fill();
    }
  },
  heart: (g) => {
    const path = () => { g.beginPath(); for (let k = 0; k <= 60; k++) { const t = (k / 60) * Math.PI * 2; const x = 128 + 6 * 16 * Math.sin(t) ** 3; const y = 120 - 6 * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)); k ? g.lineTo(x, y) : g.moveTo(x, y); } g.closePath(); };
    path(); g.fillStyle = "#E0485A"; g.fill(); g.lineWidth = 12; g.strokeStyle = INK; g.stroke();
  },
};
const mats = new Map<string, THREE.MeshBasicMaterial>();
const matOf = (k: string) => {
  let m = mats.get(k);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ map: canvasTex(`manpu|${k}`, PX, PX, TEX[k]), transparent: true, depthWrite: false, toneMapped: false, fog: false, side: THREE.DoubleSide });
    mats.set(k, m);
  }
  return m;
};
const PLANE = new THREE.PlaneGeometry(1, 1);

const back = (u: number) => { const c = 1.9, v = Math.min(1, Math.max(0, u)) - 1; return 1 + (c + 1) * v * v * v + c * v * v; };
const sm = (u: number) => { const x = Math.min(1, Math.max(0, u)); return x * x * (3 - 2 * x); };

type Sprite = { k: string; x: number; y: number; s: number; op: number; z?: number; sx?: number };
/** the sprites of one mark at life u seconds (positions in head radii, x = screen right, y = up) */
const spritesOf = (m: MarkKey, u: number, dur: number): Sprite[] => {
  const side = m.side ?? 1;
  const pop = back(u / 0.16);
  const op = Math.min(sm(u / 0.08), 1 - sm((u - (dur - 0.2)) / 0.2));
  switch (m.kind) {
    case "sweat": return [{ k: "sweat", x: side * 0.98, y: 0.45 - 0.3 * sm(u / dur), s: 0.32 * pop, op }];
    case "vein": return [{ k: "vein", x: side * 0.8, y: 0.9, s: 0.3 * pop * (1 + 0.08 * Math.sin(u * 18)), op }];
    case "exclaim": return [{ k: "exclaim", x: side * 0.45, y: 1.5 + 0.06 * Math.sin(u * 20) * Math.exp(-u * 4), s: 0.4 * pop, op }];
    case "question": return [{ k: "question", x: side * 0.5, y: 1.52, s: 0.46 * pop, op, sx: 1 + 0.05 * Math.sin(u * 6) }];
    case "dots": return [0, 1, 2].map((i) => ({ k: "dot", x: side * (0.64 + i * 0.22), y: 1.0 + i * 0.28, s: 0.2 * back((u - i * 0.28) / 0.14), op: op * (u > i * 0.28 ? 1 : 0) })); // a diagonal rising from the head's outer shoulder: on top they sat in the hair, in a row they ran off the frame
    case "sparkles": return [[1.15, 0.7, 0], [1.3, 0.1, 0.5]].map(([x, y, ph]) => ({ k: "star", x: x * side, y, s: 0.26 * back((u - ph * 0.2) / 0.16) * (0.75 + 0.25 * Math.sin(u * 9 + ph * 6)), op }));
    case "gloom": return [{ k: "gloom", x: 0, y: 1.72, s: 0.85 * (0.9 + 0.1 * pop), op: op * 0.9 }]; // above the head, never over the face
    case "steam": return [0, 1, 2].map((i) => { const v = (u + i * 0.35) % 1.05; return { k: "puff", x: side * (0.55 + 0.25 * i) * (i % 2 ? -1 : 1), y: 1.05 + v * 0.9, s: 0.28 * (0.6 + v), op: op * (1 - sm((v - 0.6) / 0.45)) }; });
    case "shock": return [{ k: "shock", x: 0, y: 0.05, s: 2.0 * (0.9 + 0.1 * sm(u / 0.25)), op: op * 0.75, z: 1 }]; // tight round the head: a bigger burst crossed into the partner
    case "hearts": return [0, 1, 2].map((i) => { const v = Math.max(0, u - i * 0.3); return { k: "heart", x: side * (0.9 + 0.3 * Math.sin(v * 3 + i)), y: 0.6 + v * 0.55, s: 0.22 * back(v / 0.16), op: op * (u > i * 0.3 ? 1 : 0) }; });
  }
};

/** the anime marks of one character, placed around its drawn head */
export const Manpu: React.FC<{ who: string; clips: ClipKey[]; t: number; at: V3; yaw: number; cam: V3; height?: number; marks: MarkKey[] }> = ({ who, clips, t, at, yaw, cam, height = 1.7, marks }) => {
  const live = marks.filter((m) => t >= m.at && t < m.at + (m.dur ?? MARK_DUR[m.kind]));
  if (!live.length) return null;
  const P = jointsAt(who, clips, t, at, yaw);
  const H0 = new THREE.Vector3().copy(jointsAt(who, clips, t, at, yaw).Head);
  // marks grow only a touch in wide shots (x1 at 4.5 m, at most x1.15): at x1.5 a "!" was as tall as the head
  const far = Math.min(1.15, Math.max(1, H0.distanceTo(new THREE.Vector3(...cam)) / 4.5));
  const R = height * 0.29 * 0.55; // half the drawn head width
  const H = new THREE.Vector3().copy(P.Head).lerp(P.HeadTop_End ?? P.Head, 0.35);
  const C = new THREE.Vector3(...cam);
  const dir = H.clone().sub(C).normalize();
  const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
  const up = new THREE.Vector3().crossVectors(right, dir).normalize();
  const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, dir.clone().negate()));
  const out: React.ReactNode[] = [];
  live.forEach((m, mi) => {
    const dur = m.dur ?? MARK_DUR[m.kind];
    spritesOf(m, t - m.at, dur).forEach((sp, si) => {
      if (sp.op <= 0.01 || sp.s <= 0.001) return;
      // in front of the head (toward the lens) so the head never hides a mark; the shock burst sits behind it
      const p = H.clone().addScaledVector(right, sp.x * R).addScaledVector(up, sp.y * R).addScaledVector(dir, (sp.z ? 1 : -0.9) * R);
      const mat = matOf(sp.k);
      const k = `${sp.k}|${Math.round(sp.op * 20)}`;
      let mm = mats.get(k);
      if (!mm) { mm = mat.clone(); mm.opacity = Math.round(sp.op * 20) / 20; mats.set(k, mm); }
      out.push(
        <mesh key={`${mi}-${si}`} geometry={PLANE} material={mm} position={p} quaternion={q} scale={[sp.s * R * 2 * (sp.sx ?? 1) * (sp.z ? 1 : far), sp.s * R * 2 * (sp.z ? 1 : far), 1]} renderOrder={sp.z ? 1 : 20} userData={{ outline: "silent" }} />,
      );
    });
  });
  return <group>{out}</group>;
};
