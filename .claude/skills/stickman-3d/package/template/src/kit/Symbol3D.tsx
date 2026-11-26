// Emotion symbols over a head (MOTION_EXPRESSION M1, BUILD_LESSONS #7): "!" "?" heart, steam, sparkle, anger vein.
// One camera-facing sprite, pops in with overshoot (1 -> 1.25 -> 1 over 5 frames), holds, shrinks out. Deterministic.
import React from "react";
import * as THREE from "three";
import type { V3 } from "../engine/types";

export type SymKind = "!" | "?" | "heart" | "sparkle" | "vein" | "!!";
const INK = "#1c1620";
const texs = new Map<string, THREE.CanvasTexture>();
const tex = (k: SymKind) => {
  let t = texs.get(k);
  if (t) return t;
  const c = document.createElement("canvas"); c.width = c.height = 256;
  const g = c.getContext("2d")!; g.lineJoin = "round"; g.lineCap = "round"; g.strokeStyle = INK;
  if (k === "!" || k === "?" || k === "!!") {
    g.font = "900 200px Arial Black, Arial"; g.textAlign = "center"; g.textBaseline = "middle"; g.lineWidth = 22;
    const s = k === "!!" ? "!!" : k; g.fillStyle = k === "?" ? "#ffffff" : "#ffd23a";
    g.strokeText(s, 128, 136); g.fillText(s, 128, 136);
  } else if (k === "heart") {
    g.lineWidth = 14; g.beginPath(); g.moveTo(128, 210); g.bezierCurveTo(10, 120, 50, 20, 128, 80); g.bezierCurveTo(206, 20, 246, 120, 128, 210);
    g.fillStyle = "#ff4a6a"; g.fill(); g.stroke();
  } else if (k === "sparkle") {
    const star = (x: number, y: number, r: number) => { g.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, q = i % 2 ? r * 0.28 : r; g.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); } g.closePath(); g.fillStyle = "#fff5a0"; g.fill(); g.lineWidth = 9; g.stroke(); };
    star(118, 140, 90); star(206, 60, 40); star(46, 54, 30);
  } else if (k === "vein") {
    g.lineWidth = 30; g.strokeStyle = "#e03040";
    for (const [a, b, c2, d] of [[60, 60, 110, 110], [196, 60, 146, 110], [60, 196, 110, 146], [196, 196, 146, 146]]) { g.beginPath(); g.moveTo(a, b); g.quadraticCurveTo((a + c2) / 2 + 20, (b + d) / 2 - 20, c2, d); g.stroke(); }
  }
  t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; texs.set(k, t);
  return t;
};
const mats = new Map<SymKind, THREE.SpriteMaterial>();
const matOf = (k: SymKind) => {
  let m = mats.get(k);
  if (!m) { m = new THREE.SpriteMaterial({ map: tex(k), transparent: true, depthWrite: false, toneMapped: false }); mats.set(k, m); }
  return m;
};

/** t, t0 in seconds; hold = seconds shown (default 0.55 s = 16 frames) */
export const Symbol3D: React.FC<{ kind: SymKind; at: V3; t: number; t0: number; size?: number; hold?: number }> = ({ kind, at, t, t0, size = 0.32, hold = 0.55 }) => {
  const u = (t - t0) * 30; // frames since the pop
  const end = hold * 30;
  if (u < 0 || u > end + 4) return null;
  let s = 1;
  if (u < 5) { const k = u / 5; s = k * (1 + 0.25 * Math.sin(k * Math.PI)); }
  else if (u > end) s = Math.max(0, 1 - (u - end) / 4);
  const wob = Math.sin(u * 0.5) * 0.01;
  return <sprite material={matOf(kind)} position={[at[0], at[1] + wob, at[2]]} scale={[size * s, size * s, 1]} userData={{ outline: false }} renderOrder={10} />;
};
