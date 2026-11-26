// FgWipe: a REAL foreground occluder for the "wipe" transition (CAMERA_STUDY: RicksClips tracks the camera behind a
// jar / pillar / train, the object fills the frame for 4-8 frames and the shot changes under it). A soft-edged,
// set-coloured slab 0.3 m in front of the lens sweeps across the view, covering the whole frame at the boundary, so the
// hard switch between the two shots happens behind it. Render it in BOTH shots: exit (last 8 frames) and enter (first 8).
import React from "react";
import * as THREE from "three";
import type { BeatCam } from "./beatCam";
import { CAM } from "./beatCam";

let tex: THREE.CanvasTexture | null = null, body: THREE.CanvasTexture | null = null;
/** mottled vertical grain (bark / painted pillar) so the slab reads as a real out-of-focus object, not a card */
const bodyTex = () => {
  if (body) return body;
  const c = document.createElement("canvas"); c.width = 128; c.height = 256; const g = c.getContext("2d")!;
  const gr = g.createLinearGradient(0, 0, 128, 0); gr.addColorStop(0, "#777"); gr.addColorStop(0.5, "#fff"); gr.addColorStop(1, "#666");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 256);
  let r = 7; const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 140; i++) { g.fillStyle = `rgba(0,0,0,${0.08 + 0.12 * rnd()})`; g.fillRect(rnd() * 128, rnd() * 256, 2 + rnd() * 6, 20 + rnd() * 80); }
  body = new THREE.CanvasTexture(c); body.colorSpace = THREE.SRGBColorSpace; return body;
};
const softTex = () => {
  if (tex) return tex;
  const c = document.createElement("canvas"); c.width = 256; c.height = 8; const g = c.getContext("2d")!;
  const gr = g.createLinearGradient(0, 0, 256, 0);
  gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(0.18, "rgba(255,255,255,1)"); gr.addColorStop(0.82, "rgba(255,255,255,1)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 256, 8); tex = new THREE.CanvasTexture(c); return tex;
};

/** u: -1 (8 frames before the boundary) .. 0 (boundary, frame covered) .. +1 (8 frames after). dir 1 = sweeps right-to-left */
export const FgWipe: React.FC<{ cam: BeatCam; u: number; color?: string; dir?: number; aspect?: number }> = ({ cam, u, color = "#2b2a22", dir = 1, aspect = 9 / 16 }) => {
  if (u < -1 || u > 1) return null;
  const D = 0.3, th = Math.tan((cam.fov * Math.PI) / 360) * D * aspect; // half the frame width at D
  const w = 2 * th * 1.6; // slab wider than the frame
  const x = dir * (-u) * (th + w / 2) * 1.05; // centred on the frame at u = 0
  const p = new THREE.Vector3(...cam.pos), l = new THREE.Vector3(...cam.look);
  const f = l.clone().sub(p).normalize(), up = new THREE.Vector3(0, 1, 0).applyAxisAngle(f, (cam.roll * Math.PI) / 180);
  const r = new THREE.Vector3().crossVectors(f, up).normalize(); const u2 = new THREE.Vector3().crossVectors(r, f);
  const pos = p.clone().addScaledVector(f, D).addScaledVector(r, x);
  const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(r, u2, f.clone().negate()));
  return (
    <mesh position={pos} quaternion={q} renderOrder={98} userData={{ outline: false }}>
      <planeGeometry args={[w, 4 * th / aspect]} />
      {/* depth-tested (it is the nearest thing anyway) so the View's DOF blurs it like a real near object */}
      <meshBasicMaterial color={color} map={bodyTex()} alphaMap={softTex()} transparent toneMapped={false} />
    </mesh>
  );
};
/** the wipe's u for a shot: exit over its last CAM.transF frames, enter over its first */
export const wipeU = (t: number, dur: number, enter: boolean, exit: boolean): number | null => {
  const T = CAM.transF / 30;
  if (exit && t > dur - T) return (t - dur) / T; // -1 .. 0
  if (enter && t < T) return t / T; // 0 .. 1
  return null;
};
