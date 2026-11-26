// Tears and sweat on the 3D stickman's drawn head (the head is a flat painted layer, so the drops are drawn too: a
// pale-blue drop with the painter's ink outline and a white catch-light, plus a wet streak). The timing is the
// blocky-shorts v1.2 tear (MIT, engine/THIRD_PARTY_NOTICES.md): 0.5 s forming at the lower lid (grows, trembles) ->
// runs down with gravity and stick-slip, leaving a streak -> past the chin it detaches, falls and fades.
// Units: HEAD WIDTHS in the head layer's own frame (x right on the drawing as painted for facing = 1, y up, origin at
// the head centre). <Stickman/> mounts this group with the head mesh's own scale and mirror, so the drops sit on the
// painted eyes in every pose, tip and squash. Sizes from the blocky rule: a drop ~6 % of the head width reads on a phone.
//   <Stickman ... tears={[2.4]} sweat={[5.1]} />   (shot seconds; each tear start = one drop per eye, 0.6 s apart)
import React from "react";
import * as THREE from "three";
import { ART } from "../char/drawCharacter";

// where the painter puts the eyes (char/drawCharacter.ts drawHeadArt / drawFace, ref px with 1 head width = 512):
// face group shifted 45 px toward the facing side and drawn ART.face larger about a point 55 % down the head; dot eyes
// 72 px either side of the face centre, ~42 % down the face, radius ART.eyeR
const HW = 512;
const HH = 1 / ART.headRatio; // head height in head widths
const FACE_X = 45 / HW;
const EYE_DX = (72 * ART.face) / HW;
const EYE_R = (ART.eyeR * ART.face) / HW;
const EYE_Y = HH / 2 - (0.55 + (0.42 - 0.55) * ART.face) * HH; // eye centre above the head centre
export const TEAR_EYES: [number, number][] = [
  [FACE_X + EYE_DX, EYE_Y - EYE_R * 1.1], // lower lid, the eye on the facing side
  [FACE_X - EYE_DX, EYE_Y - EYE_R * 1.1],
];
const CHIN = -HH / 2;
const R_DROP = 0.06;
const STAGGER = 0.6;

const drop = (() => {
  let t: THREE.CanvasTexture | null = null;
  return () => {
    if (t) return t;
    const c = document.createElement("canvas");
    c.width = 128;
    c.height = 160;
    const g = c.getContext("2d")!;
    // a teardrop: round bottom, pointed top (y down on the canvas)
    const path = () => {
      g.beginPath();
      g.moveTo(64, 10);
      g.bezierCurveTo(78, 46, 112, 76, 112, 104);
      g.arc(64, 104, 48, 0, Math.PI, false);
      g.bezierCurveTo(16, 76, 50, 46, 64, 10);
      g.closePath();
    };
    path();
    g.fillStyle = "#9fdcff";
    g.fill();
    g.lineWidth = 11;
    g.strokeStyle = ART.ink;
    g.lineJoin = "round";
    g.stroke();
    // catch-light up-left
    g.fillStyle = "#ffffff";
    g.beginPath();
    g.ellipse(48, 92, 9, 15, -0.35, 0, Math.PI * 2);
    g.fill();
    t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
})();
const mats = new Map<string, THREE.MeshBasicMaterial>();
const dropMat = (tint: string) => {
  let m = mats.get(tint);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ map: drop(), color: tint, transparent: true, alphaTest: 0.05, depthWrite: false, toneMapped: false, fog: false });
    mats.set(tint, m);
  }
  return m;
};
const wetMats = new Map<string, THREE.MeshBasicMaterial>();
const wetMat = (tint: string) => {
  let m = wetMats.get(tint);
  if (!m) {
    const c = new THREE.Color("#c4ecff").multiply(new THREE.Color(tint));
    m = new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.6, depthWrite: false, toneMapped: false, fog: false });
    wetMats.set(tint, m);
  }
  return m;
};
const QUAD = new THREE.PlaneGeometry(1, 1);
const NO_INK = { outline: false };

/** the blocky slide, converted from metres on a 0.27 m head to head widths */
const slideOf = (tr: number, seed: number) => (0.05 * tr + 0.09 * tr * tr + 0.004 * Math.sin(tr * 11 + seed) * Math.min(1, tr * 3)) / 0.27;

/** one drop: tau = seconds since it starts; from = the lid (or temple) point; off = where it leaves the face */
export const Drop: React.FC<{ tau: number; from: [number, number]; off: number; tint: string; r?: number; seed?: number }> = ({ tau, from, off, tint, r = R_DROP, seed = 0 }) => {
  if (tau <= 0) return null;
  const FORM = 0.5;
  const grow = Math.min(1, tau / FORM);
  const tr = Math.max(0, tau - FORM);
  const pathX = (s: number) => from[0] + 0.012 * Math.sin(s * 22 + seed) + 0.05 * s * Math.sign(from[0] || 1);
  const slide = slideOf(tr, seed);
  const sDet = from[1] - off;
  const detached = slide > sDet;
  let x: number;
  let y: number;
  let op = 1;
  if (!detached) {
    x = pathX(slide);
    y = from[1] - slide;
  } else {
    // when did it detach? slide is monotonic: bisection
    let lo = 0;
    let hi = tr;
    for (let i = 0; i < 30; i++) {
      const m = (lo + hi) / 2;
      if (slideOf(m, seed) < sDet) lo = m;
      else hi = m;
    }
    const fall = tr - lo;
    x = pathX(sDet);
    y = off - (0.3 * fall + 4.9 * fall * fall) / 0.27;
    op = Math.max(0, 1 - fall / 0.35);
  }
  const moving = tr > 0 && !detached;
  const rr = r * (grow < 1 ? 0.3 + 0.7 * grow : 1) * (detached ? 0.8 : 1 - 0.15 * Math.min(1, slide / 0.4));
  const tremble = grow < 1 ? 1 + 0.08 * Math.sin(tau * 40 + seed) : 1;
  const stretch = moving ? 1.25 : detached ? 1.15 : 1;
  // the wet streak: short segments from the lid to the drop (or to where it left the face)
  const sMax = Math.min(slide, sDet);
  const STEP = 0.025;
  const N = Math.floor(sMax / STEP);
  const segs: React.ReactNode[] = [];
  for (let i = 0; i < N; i++) {
    const s0 = i * STEP;
    const s1 = s0 + STEP;
    const ax = pathX(s0);
    const bx = pathX(s1);
    const dx = bx - ax;
    segs.push(
      <mesh key={i} geometry={QUAD} material={wetMat(tint)} position={[(ax + bx) / 2, from[1] - (s0 + s1) / 2, 0]} rotation={[0, 0, Math.atan2(dx, STEP)]}
        scale={[r * 0.45, Math.hypot(dx, STEP) * 1.15, 1]} renderOrder={3} userData={NO_INK} />,
    );
  }
  return (
    <group>
      {segs}
      {op > 0 ? (
        <mesh geometry={QUAD} material={dropMat(tint)} position={[x, y + rr * 0.2, 0.002]} scale={[rr * 2 * tremble, (rr * 2.5 * stretch) / tremble, 1]}
          renderOrder={4} userData={NO_INK} visible={op > 0.02} />
      ) : null}
    </group>
  );
};

/** every tear and sweat drop of one character at shot time t (head-width units, see the header) */
export const Tears: React.FC<{ t: number; tears?: number[]; sweat?: number[]; tint: string; seed: number }> = ({ t, tears = [], sweat = [], tint, seed }) => {
  const out: React.ReactNode[] = [];
  tears.forEach((t0, i) =>
    TEAR_EYES.forEach((eye, k) => {
      const tau = t - t0 - k * STAGGER;
      if (tau > 0 && tau < 4) out.push(<Drop key={`t${i}${k}`} tau={tau} from={eye} off={CHIN + 0.06} tint={tint} seed={seed + i * 7 + k * 3} />);
    }),
  );
  sweat.forEach((t0, i) => {
    const tau = t - t0;
    // from the temple on the facing side, down the side of the head, off at the jaw
    if (tau > 0 && tau < 3) out.push(<Drop key={`s${i}`} tau={tau} from={[0.4, EYE_Y + 0.12]} off={-0.28} tint={tint} r={R_DROP * 0.85} seed={seed + 50 + i} />);
  });
  return out.length ? <>{out}</> : null;
};
