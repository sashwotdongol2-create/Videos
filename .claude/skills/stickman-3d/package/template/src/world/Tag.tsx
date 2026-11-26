// Sound-off tags (HYBRID_PLAN 4.3): an UNLIT painted label on a key object ("1 BELL", "6 FEET DOWN"), about one per
// 15 s. Bold dark text on a cream plate with a clean dark frame drawn into the texture (an ink occluder: no ink inside
// it, none from behind it drawn over it; no fog, no tone mapping), so it reads with the sound off.
// Long text goes on 2 lines (auto split at the middle space, or "\n").
//   shot needs:  needTag()                                   (the tag font, Poppins ExtraBold from public/fonts)
//   in the View: <Tag text="6 FEET" at={[x, y, z]} rot={[0, yaw, 0]} size={0.25} t={t} show={[1.2, 3.5]} />
// QA: every frame the four plate corners are projected through the real camera; console.error("TAG OUTSIDE SAFE
// AREA ...") when a corner leaves the safe area (5 % margins left / right / top, 15 % bottom: YouTube buttons) or the
// plate overlaps the caption band (y 0.62-0.78 of the height). The CLI prints those lines from still / render.
import { useFrame } from "@react-three/fiber";
import React from "react";
import { staticFile, useCurrentFrame } from "remotion";
import * as THREE from "three";
import { gripRequest } from "../engine/core/View";
import type { V3 } from "../engine/types";
import { got } from "./assets";
import type { Need } from "./assets";

const FONT = "StickTag";
const FONT_KEY = "font:tag";
/** put it in the needs of every shot that draws a Tag (blocks the frame until the font is ready: no fallback font) */
export const needTag = (): Need => [
  FONT_KEY,
  async () => {
    const f = new FontFace(FONT, `url(${staticFile("fonts/Poppins-ExtraBold.ttf")})`, { weight: "800" });
    await f.load();
    document.fonts.add(f);
    return f;
  },
];

/** safe area in fractions of the frame (top-left origin) and the caption band (captions sit at y 0.70) */
export const SAFE = { x0: 0.05, x1: 0.95, y0: 0.05, y1: 0.85, cap0: 0.62, cap1: 0.78 };

type TagStyle = { color: string; bg: string; frame: string | false };
const PX = 120; // font px in the texture
const lines = (text: string): string[] => {
  if (text.includes("\n")) return text.split("\n");
  if (text.length <= 14 || !text.includes(" ")) return [text];
  // split at the space nearest the middle
  const mid = text.length / 2;
  let best = -1;
  for (let i = 0; i < text.length; i++) if (text[i] === " " && (best < 0 || Math.abs(i - mid) < Math.abs(best - mid))) best = i;
  return [text.slice(0, best), text.slice(best + 1)];
};

// bounded texture cache (one canvas texture per text + style)
const MAX_TEX = 24;
const texs = new Map<string, { tex: THREE.CanvasTexture; mat: THREE.MeshBasicMaterial; aspect: number }>();
const plate = (text: string, st: TagStyle) => {
  const k = `${text}|${st.color}|${st.bg}|${st.frame}`;
  const hit = texs.get(k);
  if (hit) {
    texs.delete(k);
    texs.set(k, hit);
    return hit;
  }
  got(FONT_KEY); // throws if the shot forgot needTag()
  const L = lines(text);
  const cv = document.createElement("canvas");
  const g0 = cv.getContext("2d")!;
  g0.font = `800 ${PX}px ${FONT}`;
  const tw = Math.max(...L.map((s) => g0.measureText(s).width));
  const padX = PX * 0.45;
  const padY = PX * 0.3;
  const lh = PX * 1.08;
  const W = Math.ceil(tw + padX * 2);
  const H = Math.ceil(lh * L.length + padY * 2);
  cv.width = W;
  cv.height = H;
  const g = cv.getContext("2d")!;
  const r = PX * 0.18;
  const fw = st.frame ? PX * 0.09 : 0;
  g.beginPath();
  g.roundRect(fw / 2, fw / 2, W - fw, H - fw, r);
  g.fillStyle = st.bg;
  g.fill();
  if (st.frame) {
    g.lineWidth = fw;
    g.strokeStyle = st.frame;
    g.stroke();
  }
  g.font = `800 ${PX}px ${FONT}`;
  g.fillStyle = st.color;
  g.textAlign = "center";
  g.textBaseline = "middle";
  L.forEach((s, i) => g.fillText(s, W / 2, padY + lh * (i + 0.5) + PX * 0.04));
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const mat = new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5, toneMapped: false, fog: false, side: THREE.FrontSide });
  const v = { tex, mat, aspect: W / H };
  texs.set(k, v);
  while (texs.size > MAX_TEX) {
    const old = texs.keys().next().value as string;
    texs.get(old)!.tex.dispose();
    texs.get(old)!.mat.dispose();
    texs.delete(old);
  }
  return v;
};
const UNIT = new THREE.PlaneGeometry(1, 1);

export type TagProps = {
  text: string;
  /** plate centre (three coords) */
  at: V3;
  /** Euler rotation in radians (the plate faces +Z before rotation) */
  rot?: V3;
  /** plate height in m (width follows the text) */
  size?: number;
  /** text colour, plate colour, frame colour (false = no frame) */
  color?: string;
  bg?: string;
  frame?: string | false;
  /** shot seconds + [in, out]: the tag pops in / out over 0.15 s (omit to always show) */
  t?: number;
  show?: [number, number];
  /** extra text for the QA log line */
  label?: string;
};

const ease = (u: number) => {
  const x = Math.min(1, Math.max(0, u));
  return x * x * (3 - 2 * x);
};
const corner = new THREE.Vector3();
const inView = new THREE.Vector3();

export const Tag: React.FC<TagProps> = ({ text, at, rot = [0, 0, 0], size = 0.25, color = "#1a1424", bg = "#f6ecd4", frame = "#1a1424", t, show, label = "" }) => {
  const p = plate(text, { color, bg, frame });
  const ref = React.useRef<THREE.Mesh>(null);
  const frameNo = useCurrentFrame();
  const pop = show && t !== undefined ? Math.min(ease((t - show[0]) / 0.15), 1 - ease((t - (show[1] - 0.15)) / 0.15)) : 1;
  const qa = !gripRequest();
  useFrame(({ camera }) => {
    const m = ref.current;
    if (!qa || !m || pop <= 0) return;
    m.updateWorldMatrix(true, false);
    camera.updateMatrixWorld();
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, behind = false;
    for (const [cx, cy] of [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]]) {
      corner.set(cx, cy, 0).applyMatrix4(m.matrixWorld);
      inView.copy(corner).applyMatrix4(camera.matrixWorldInverse);
      if (inView.z > -0.01) behind = true;
      corner.project(camera);
      const sx = (corner.x + 1) / 2;
      const sy = (1 - corner.y) / 2;
      x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
    }
    const out = behind || x0 < SAFE.x0 || x1 > SAFE.x1 || y0 < SAFE.y0 || y1 > SAFE.y1;
    const cap = y1 > SAFE.cap0 && y0 < SAFE.cap1;
    if (out || cap) {
      const f = (v: number) => v.toFixed(2);
      console.error(
        `TAG OUTSIDE SAFE AREA "${text.replace(/\n/g, " ")}" frame ${frameNo}${label ? " " + label : ""}: ` +
          `${behind ? "behind the camera" : `x ${f(x0)}-${f(x1)} y ${f(y0)}-${f(y1)}`}${out ? " (safe x 0.05-0.95, y 0.05-0.85)" : ""}${cap ? " overlaps the caption band y 0.62-0.78" : ""}`,
      );
    }
  });
  if (pop <= 0) return null;
  return (
    <mesh ref={ref} geometry={UNIT} material={p.mat} position={at} rotation={rot} scale={[size * p.aspect * pop, size * pop, 1]} userData={{ outline: "occlude" }} renderOrder={2} />
  );
};
