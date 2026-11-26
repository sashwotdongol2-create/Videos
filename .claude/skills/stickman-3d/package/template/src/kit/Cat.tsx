// The black cat: a flat ink card in the cast's style (thick purple-brown ink, flat fill, big yellow eyes), billboarded
// to the lens like the characters' head layer, with a contact shadow. Poses: sit (tail swish, blink), lick (paw to
// mouth), run (6-pose gallop, body stretch + compress), stare (dead-on, slow blink). Pure function of t.
import React from "react";
import * as THREE from "three";
import type { V3 } from "../engine/types";

export type CatPose = "sit" | "lick" | "run" | "stare";
const INK = "#1c1620", FUR = "#17141c", RIM = "#4a3e5e", EYE = "#f2c83a";
const W = 512, H = 384;
const texs = new Map<string, THREE.CanvasTexture>();

const draw = (g: CanvasRenderingContext2D, pose: CatPose, k: number, blink: boolean, look: number) => {
  g.clearRect(0, 0, W, H); g.lineJoin = "round"; g.lineCap = "round";
  const stroke = (w = 10) => { g.lineWidth = w; g.strokeStyle = INK; g.stroke(); };
  const fill = (c = FUR) => { g.fillStyle = c; g.fill(); };
  const ell = (x: number, y: number, rx: number, ry: number, a = 0) => { g.beginPath(); g.ellipse(x, y, rx, ry, a, 0, 7); };
  const headAt = (hx: number, hy: number, tilt: number) => {
    g.save(); g.translate(hx, hy); g.rotate(tilt);
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 18, -36); g.lineTo(s * 46, -78); g.lineTo(s * 52, -22); g.closePath(); fill(); stroke(9);
      g.beginPath(); g.moveTo(s * 26, -38); g.lineTo(s * 44, -64); g.lineTo(s * 46, -32); g.closePath(); fill("#8a5a7a"); }
    ell(0, 0, 62, 52); fill(); stroke(10);
    g.beginPath(); g.ellipse(-30, -26, 22, 12, -0.5, Math.PI, 2 * Math.PI); g.strokeStyle = RIM; g.lineWidth = 6; g.stroke();   // rim light on the skull
    for (const s of [-1, 1]) {
      if (blink) { g.beginPath(); g.moveTo(s * 24 - 14, -2); g.quadraticCurveTo(s * 24, 6, s * 24 + 14, -2); stroke(6); }
      else { ell(s * 24, -4, 17, 19); fill(EYE); stroke(5); ell(s * 24 + look * 6, -3, 5, 15); fill(INK); ell(s * 24 + look * 6 - 5, -10, 4, 4); fill("#fff"); }
    }
    g.beginPath(); g.moveTo(-7, 16); g.lineTo(7, 16); g.lineTo(0, 24); g.closePath(); fill("#e07a9a"); stroke(4);                   // nose
    g.beginPath(); g.moveTo(0, 24); g.quadraticCurveTo(-8, 34, -16, 28); g.moveTo(0, 24); g.quadraticCurveTo(8, 34, 16, 28); stroke(4);
    for (const s of [-1, 1]) for (const dy of [-4, 6]) { g.beginPath(); g.moveTo(s * 30, 22 + dy); g.lineTo(s * 78, 16 + dy * 1.6); g.strokeStyle = "#e8e4ee"; g.lineWidth = 3; g.stroke(); }
    g.restore();
  };
  if (pose === "run") {
    // 6-pose gallop: k in 0..1. stretch at 0.5, gather at 0
    const st = Math.sin(k * Math.PI * 2), bob = -Math.abs(Math.sin(k * Math.PI * 2)) * 18;
    const bx = 250, by = 230 + bob, len = 120 + st * 34;
    g.beginPath(); g.moveTo(bx - len, by - 10); g.bezierCurveTo(bx - len - 70, by - 90 - st * 20, bx - len - 110, by - 40, bx - len - 140, by - 110); stroke(26); g.strokeStyle = FUR; g.lineWidth = 16; g.stroke();
    for (const [lx, ph] of [[-len + 20, 0], [-len + 50, 0.15], [len - 40, 0.5], [len - 10, 0.65]] as [number, number][]) {
      const a = Math.sin((k + ph) * Math.PI * 2) * 0.9;
      g.beginPath(); g.moveTo(bx + lx, by + 10); g.lineTo(bx + lx + Math.sin(a) * 60, by + 10 + Math.cos(a) * 62); stroke(20); g.strokeStyle = FUR; g.lineWidth = 11; g.stroke();
    }
    ell(bx, by, len, 46, -0.05); fill(); stroke(10);
    headAt(bx + len + 20, by - 30, 0.15 - st * 0.08);
    return;
  }
  // seated body, tail swish
  const sw = Math.sin(k * Math.PI * 2);
  g.beginPath(); g.moveTo(320, 330); g.bezierCurveTo(430, 340, 440 + sw * 30, 230, 400 + sw * 50, 170); stroke(26); g.strokeStyle = FUR; g.lineWidth = 15; g.stroke();
  ell(256, 270, 92, 92); fill(); stroke(10);
  g.beginPath(); g.ellipse(214, 230, 40, 26, -0.9, Math.PI, 2 * Math.PI); g.strokeStyle = RIM; g.lineWidth = 7; g.stroke();
  for (const s of [-1, 1]) { ell(256 + s * 40, 352, 30, 18); fill(); stroke(8); }
  if (pose === "lick") {
    const up = 0.5 + 0.5 * Math.sin(k * Math.PI * 4);
    g.beginPath(); g.moveTo(296, 300); g.lineTo(300, 190 - up * 30); stroke(26); g.strokeStyle = FUR; g.lineWidth = 15; g.stroke();
    headAt(256, 150, -0.25 + up * 0.1);
    g.beginPath(); g.ellipse(276, 178, 10, 7, 0, 0, 7); fill("#e07a9a");
  } else headAt(256, 160, pose === "stare" ? 0 : sw * 0.06);
};

const texOf = (pose: CatPose, k: number, blink: boolean, look: number) => {
  const key = `${pose}|${k}|${blink ? 1 : 0}|${look}`;
  let t = texs.get(key);
  if (!t) {
    const c = document.createElement("canvas"); c.width = W; c.height = H; draw(c.getContext("2d")!, pose, k, blink, look);
    t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; texs.set(key, t);
  }
  return t;
};
const mats = new Map<THREE.Texture, THREE.MeshBasicMaterial>();
const matOf = (t: THREE.Texture) => { let m = mats.get(t); if (!m) { m = new THREE.MeshBasicMaterial({ map: t, transparent: true, alphaTest: 0.4, toneMapped: false }); mats.set(t, m); } return m; };
const shadow = new THREE.MeshBasicMaterial({ color: "#1a1424", transparent: true, opacity: 0.32, depthWrite: false });
const plane = new THREE.PlaneGeometry(1, 0.75).translate(0, 0.375, 0);
const disc = new THREE.CircleGeometry(0.5, 24);

/** at = paw contact point; size = card width in metres (a cat ~0.55 m long); facing 1 = to screen right */
export const Cat: React.FC<{ t: number; at: V3; cam: V3; pose: CatPose; size?: number; facing?: 1 | -1; look?: number; speed?: number }> = ({ t, at, cam, pose, size = 0.55, facing = 1, look = 0, speed = 1 }) => {
  const steps = pose === "run" ? 6 : 12;
  const period = pose === "run" ? 0.36 / speed : pose === "lick" ? 1.2 : 2.6;
  const k = Math.floor(((t / period) % 1) * steps) / steps;
  const blink = pose !== "run" && (Math.floor(t * 30) % (pose === "stare" ? 75 : 52)) < (pose === "stare" ? 6 : 3);
  const yaw = Math.atan2(cam[0] - at[0], cam[2] - at[2]);
  return (
    <group position={at}>
      <mesh geometry={disc} material={shadow} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]} scale={[size * 0.9, size * 0.35, 1]} userData={{ outline: false }} />
      <mesh geometry={plane} material={matOf(texOf(pose, k, blink, Math.round(look * 2) / 2))} rotation={[0, yaw, 0]} scale={[size * facing, size, 1]} userData={{ outline: false }} />
    </group>
  );
};
