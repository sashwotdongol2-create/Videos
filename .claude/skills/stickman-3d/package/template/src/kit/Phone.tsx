// The hero's phone: a modelled handset (rounded body, camera bump, glowing screen) carrying the chat that is the
// story's reveal. `PhoneInHand` follows the right hand joint every frame; `PhoneInsert` is the phone close to the lens
// for the insert shots (screen legible on a phone: DESIGN_DETAIL D2, POSTED L4). Messages appear one by one (`upto`).
import React from "react";
import * as THREE from "three";
import type { V3 } from "../engine/types";

const MSGS: { me: boolean; text?: string; meme?: boolean }[] = [
  { me: true, text: "BRO a black cat just crossed my path" },
  { me: true, meme: true },
  { me: true, text: "im literally CURSED rn" },
  { me: true, text: "walking backwards to undo it" },
  { me: false, text: "dude..." },
  { me: false, text: "LOOK BEHIND YOU" },
];
const texs = new Map<number, THREE.CanvasTexture>();
const screenTex = (upto: number) => {
  let t = texs.get(upto); if (t) return t;
  const c = document.createElement("canvas"); c.width = 512; c.height = 1024; const g = c.getContext("2d")!;
  const bg = g.createLinearGradient(0, 0, 0, 1024); bg.addColorStop(0, "#1e2a3a"); bg.addColorStop(1, "#141c28"); g.fillStyle = bg; g.fillRect(0, 0, 512, 1024);
  g.fillStyle = "#2a3a50"; g.fillRect(0, 0, 512, 110); g.fillStyle = "#e8eef8"; g.font = "bold 34px Arial"; g.fillText("Kev 🐈", 120, 72);
  g.beginPath(); g.arc(70, 58, 30, 0, 7); g.fillStyle = "#7ab0e0"; g.fill();
  g.font = "bold 13px Arial"; g.fillStyle = "#e8eef8"; g.fillText("9:41", 18, 22); g.fillText("🔋 3%", 440, 22);
  let y = 140;
  const wrap = (s: string, w: number) => { const out: string[] = []; let line = ""; for (const word of s.split(" ")) { const tst = line ? line + " " + word : word; if (g.measureText(tst).width > w) { out.push(line); line = word; } else line = tst; } out.push(line); return out; };
  g.font = "bold 30px Arial";
  MSGS.slice(0, upto).forEach((m) => {
    if (m.meme) {
      const x = 170, w = 300, h = 230; g.fillStyle = "#f4f0e6"; g.beginPath(); g.roundRect(x, y, w, h, 18); g.fill();
      g.fillStyle = "#1c1620"; g.beginPath(); g.arc(x + w / 2, y + 120, 62, 0, 7); g.fill();
      for (const s of [-1, 1]) { g.beginPath(); g.moveTo(x + w / 2 + s * 20, y + 70); g.lineTo(x + w / 2 + s * 52, y + 30); g.lineTo(x + w / 2 + s * 58, y + 90); g.fill(); g.beginPath(); g.arc(x + w / 2 + s * 24, y + 112, 13, 0, 7); g.fillStyle = "#f2c83a"; g.fill(); g.fillStyle = "#1c1620"; }
      g.font = "900 30px Impact, Arial"; g.fillStyle = "#fff"; g.strokeStyle = "#000"; g.lineWidth = 6; g.textAlign = "center";
      g.strokeText("ME AFTER 1 CAT", x + w / 2, y + 220); g.fillText("ME AFTER 1 CAT", x + w / 2, y + 220); g.textAlign = "left"; g.font = "bold 30px Arial";
      y += h + 22; return;
    }
    const lines = wrap(m.text!, 300), h = lines.length * 38 + 26, w = Math.max(...lines.map((l) => g.measureText(l).width)) + 36;
    const x = m.me ? 492 - w : 20;
    g.fillStyle = m.me ? "#2f7cf6" : "#3a4658"; g.beginPath(); g.roundRect(x, y, w, h, 22); g.fill();
    g.fillStyle = "#fff"; lines.forEach((l, i) => g.fillText(l, x + 18, y + 40 + i * 38));
    y += h + 16;
  });
  g.fillStyle = "#223044"; g.fillRect(0, 930, 512, 94); g.fillStyle = "#3a4a60"; g.beginPath(); g.roundRect(20, 950, 400, 54, 27); g.fill();
  g.fillStyle = "#8aa0bc"; g.font = "26px Arial"; g.fillText("typing...", 44, 986);
  t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; texs.set(upto, t); return t;
};
const caseM = new THREE.MeshStandardMaterial({ color: "#d84a6a", roughness: 0.6 });
const scr = new Map<THREE.Texture, THREE.MeshBasicMaterial>();
const scrMat = (t: THREE.Texture) => { let m = scr.get(t); if (!m) { m = new THREE.MeshBasicMaterial({ map: t, toneMapped: false }); scr.set(t, m); } return m; };
const shell = new THREE.BoxGeometry(0.075, 0.155, 0.009);
const face = new THREE.PlaneGeometry(0.068, 0.145);

/** the handset at a position, facing `to` (screen side) */
export const Phone: React.FC<{ at: V3; to: V3; upto?: number; scale?: number; roll?: number; glow?: number }> = ({ at, to, upto = 4, scale = 1, roll = 0, glow = 1 }) => {
  const m = new THREE.Matrix4().lookAt(new THREE.Vector3(...at), new THREE.Vector3(...to), new THREE.Vector3(0, 1, 0));
  const q = new THREE.Quaternion().setFromRotationMatrix(m).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), roll));
  return (
    <group position={at} quaternion={q} scale={scale}>
      <mesh geometry={shell} material={caseM} castShadow userData={{ outline: false }} />
      <mesh geometry={face} material={scrMat(screenTex(upto))} position={[0, 0, -0.0051]} rotation={[0, Math.PI, 0]} userData={{ outline: false }} />
      {glow > 0 ? <pointLight position={[0, 0, -0.08]} color="#9ac8ff" intensity={0.35 * glow} distance={0.8} decay={2} /> : null}
    </group>
  );
};
