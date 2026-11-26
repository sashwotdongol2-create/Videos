// Detailed waving flags (notes F: flags on poles over a tabletop map, readable at 20-50 % of the frame height).
//   <Flag t p flag="austria" h={0.5} pole={1.4} yaw={0.3} wind={1} seed={2} />
// Cloth: a 48 x 24 grid, a travelling wave whose amplitude grows from the hoist to the fly, a faster flutter at the free
// edge, the fly end pulled in as the cloth folds (it keeps its length), the bottom corner sagging; folds are shaded in
// soft light / dark bands from the cloth's slope (vertex colours on an unlit textured material: reads the same under any
// mood). Pole with a gilded finial, halyard rope with a little sag and a cleat. Period flags drawn on a canvas (FLAG_IDS),
// or any stripes via `colors` (+ `vertical`). Pure function of t (+ seed). Origin = pole foot; the flag flies toward the
// local +X (turn it with yaw: wind direction = (cos yaw, 0, -sin yaw)).
import React from "react";
import * as THREE from "three";
import type { V3 } from "../engine/types";
import { toonMaterial } from "../engine/mat/materials";

export type FlagId = "austria" | "blackyellow" | "serbia" | "russia" | "germany" | "france" | "uk" | "habsburg";
/** width / height of each flag */
export const FLAG_ASPECT: Record<FlagId, number> = { austria: 1.5, blackyellow: 1.5, habsburg: 1.5, serbia: 1.5, russia: 1.5, germany: 1.5, france: 1.5, uk: 2 };

const texCache = new Map<string, THREE.CanvasTexture>();
const stripesH = (g: CanvasRenderingContext2D, W: number, H: number, cols: string[], x0 = 0, x1 = W) =>
  cols.forEach((c, i) => { g.fillStyle = c; g.fillRect(x0, Math.floor((i * H) / cols.length), x1 - x0, Math.ceil(H / cols.length) + 1); });
const stripesV = (g: CanvasRenderingContext2D, W: number, H: number, cols: string[]) =>
  cols.forEach((c, i) => { g.fillStyle = c; g.fillRect(Math.floor((i * W) / cols.length), 0, Math.ceil(W / cols.length) + 1, H); });
/** a small heater shield: fill, optional cross, a gold rim and a little crown on top */
const shield = (g: CanvasRenderingContext2D, cx: number, cy: number, s: number, fill: string, cross: string | null, crown = true) => {
  g.save();
  g.translate(cx, cy);
  g.beginPath();
  g.moveTo(-s, -s); g.lineTo(s, -s); g.lineTo(s, 0.15 * s);
  g.quadraticCurveTo(s, 0.9 * s, 0, 1.25 * s); g.quadraticCurveTo(-s, 0.9 * s, -s, 0.15 * s); g.closePath();
  g.fillStyle = fill; g.fill();
  if (cross) { g.fillStyle = cross; g.fillRect(-0.18 * s, -s, 0.36 * s, 2.2 * s); g.fillRect(-s, -0.38 * s, 2 * s, 0.36 * s); }
  g.lineWidth = 0.14 * s; g.strokeStyle = "#d8a92a"; g.stroke();
  if (crown) {
    g.fillStyle = "#e3b12c";
    g.beginPath();
    g.moveTo(-0.7 * s, -1.08 * s); g.lineTo(-0.7 * s, -1.6 * s); g.lineTo(-0.35 * s, -1.3 * s); g.lineTo(0, -1.75 * s);
    g.lineTo(0.35 * s, -1.3 * s); g.lineTo(0.7 * s, -1.6 * s); g.lineTo(0.7 * s, -1.08 * s); g.closePath(); g.fill();
  }
  g.restore();
};
const drawUK = (g: CanvasRenderingContext2D, W: number, H: number) => {
  g.fillStyle = "#012169"; g.fillRect(0, 0, W, H);
  const diag = (w: number, col: string, off = 0) => {
    g.strokeStyle = col; g.lineWidth = w;
    g.beginPath(); g.moveTo(0, off); g.lineTo(W, H + off); g.moveTo(W, off); g.lineTo(0, H + off); g.stroke();
  };
  diag(H * 0.2, "#ffffff");
  g.save(); g.beginPath(); g.rect(0, 0, W, H); g.clip();
  diag(H * 0.067, "#C8102E", H * 0.03); // the counterchanged red saltire, simplified (offset)
  g.restore();
  g.fillStyle = "#ffffff"; g.fillRect(W / 2 - H * 0.167, 0, H * 0.333, H); g.fillRect(0, H / 2 - H * 0.167, W, H * 0.333);
  g.fillStyle = "#C8102E"; g.fillRect(W / 2 - H * 0.1, 0, H * 0.2, H); g.fillRect(0, H / 2 - H * 0.1, W, H * 0.2);
};
export const flagTexture = (flag: FlagId | null, colors?: string[], vertical = false): THREE.CanvasTexture => {
  const key = flag ?? `c:${(colors ?? []).join(",")}|${vertical}`;
  let t = texCache.get(key);
  if (t) return t;
  const H = 384, W = Math.round(H * (flag ? FLAG_ASPECT[flag] : 1.5));
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d")!;
  switch (flag) {
    case "austria": // civil ensign 1869-1918: red-white-red | red-white-green, the two arms in the white band
      stripesH(g, W, H, ["#C8102E", "#ffffff", "#C8102E"], 0, W / 2);
      stripesH(g, W, H, ["#C8102E", "#ffffff", "#2E7D32"], W / 2, W);
      shield(g, W * 0.3, H * 0.47, H * 0.1, "#C8102E", null);
      g.fillStyle = "#ffffff"; g.fillRect(W * 0.3 - H * 0.1, H * 0.445, H * 0.2, H * 0.05); // Austria: red-white-red
      shield(g, W * 0.68, H * 0.47, H * 0.1, "#C8102E", "#ffffff"); // Hungary, simplified (double cross -> cross)
      break;
    case "blackyellow":
    case "habsburg":
      stripesH(g, W, H, ["#111111", "#F2C318"]);
      break;
    case "serbia": // red-blue-white with the arms (white cross on red, crowned), simplified
      stripesH(g, W, H, ["#C6363C", "#0C4076", "#ffffff"]);
      shield(g, W * 0.36, H * 0.48, H * 0.17, "#C6363C", "#ffffff");
      break;
    case "russia":
      stripesH(g, W, H, ["#ffffff", "#1C3FAA", "#D52B1E"]);
      break;
    case "germany": // the Empire: black-white-red
      stripesH(g, W, H, ["#111111", "#ffffff", "#D00000"]);
      break;
    case "france":
      stripesV(g, W, H, ["#0055A4", "#ffffff", "#EF4135"]);
      break;
    case "uk":
      drawUK(g, W, H);
      break;
    default:
      (vertical ? stripesV : stripesH)(g, W, H, colors && colors.length ? colors : ["#cccccc"]);
  }
  // cloth weave: faint horizontal threads (reads as fabric close up, invisible far away)
  g.globalAlpha = 0.05; g.fillStyle = "#000";
  for (let y = 0; y < H; y += 4) g.fillRect(0, y, W, 1);
  g.globalAlpha = 1;
  t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  texCache.set(key, t);
  return t;
};

const NX = 48, NY = 24;
const clothMat = (tex: THREE.Texture) => {
  const k = `m|${tex.id}`;
  let m = matCache.get(k);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ map: tex, vertexColors: true, side: THREE.DoubleSide, toneMapped: true });
    matCache.set(k, m);
  }
  return m;
};
const matCache = new Map<string, THREE.Material>();
const geos = new Map<string, THREE.BufferGeometry>();
const geoOf = (k: string, make: () => THREE.BufferGeometry) => { let g = geos.get(k); if (!g) { g = make(); geos.set(k, g); } return g; };

export type FlagProps = {
  t: number;
  /** pole foot (world) */
  p: V3;
  flag?: FlagId;
  /** stripes instead of a period flag (top -> bottom, or left -> right with vertical) */
  colors?: string[];
  vertical?: boolean;
  /** cloth height m (width = h x the flag's aspect, or `w`) */
  h?: number;
  w?: number;
  /** pole height m (default 2.6 x h) */
  pole?: number;
  yaw?: number;
  /** 0 = limp, 1 = a fresh breeze, 1.5 = strong */
  wind?: number;
  seed?: number;
  /** pole colour (default dark lacquered wood) */
  poleColor?: string;
};

/** a detailed cloth flag on a pole with finial and halyard */
export const Flag: React.FC<FlagProps> = ({ t, p, flag, colors, vertical = false, h = 0.4, w, pole, yaw = 0, wind = 1, seed = 1, poleColor = "#3a2a20" }) => {
  const W = w ?? h * (flag ? FLAG_ASPECT[flag] : 1.5);
  const P = pole ?? 2.6 * h;
  const pr = Math.max(0.006, 0.028 * h); // pole radius
  const tex = flagTexture(flag ?? null, colors, vertical);
  // one cloth geometry per mounted flag (rewritten every frame: never accumulated)
  const geo = React.useMemo(() => {
    const g = new THREE.PlaneGeometry(1, 1, NX, NY);
    g.setAttribute("color", new THREE.BufferAttribute(new Float32Array((NX + 1) * (NY + 1) * 3), 3));
    return g;
  }, []);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const col = geo.attributes.color as THREE.BufferAttribute;
  const ph = seed * 1.7;
  const wk = Math.max(0, wind);
  const disp = (u: number, v: number) => {
    // travelling waves (hoist -> fly), amplitude growing toward the free edge; flutter at the fly; a slow sway
    const amp = wk * (0.03 + 0.16 * u) * W;
    const z = amp * Math.sin(u * 8.5 - t * 7 * (0.7 + 0.3 * wk) + ph + 2.2 * v) // diagonal folds, as on a real flag
      + wk * 0.035 * W * u * u * Math.sin(u * 17 - t * 15 + ph * 2 + v * 4)
      + wk * 0.03 * W * u * Math.sin(t * 1.3 + ph);
    return z;
  };
  for (let j = 0; j <= NY; j++) {
    const v = 1 - j / NY; // 1 = top
    for (let i = 0; i <= NX; i++) {
      const u = i / NX;
      const k = j * (NX + 1) + i;
      const z = disp(u, v);
      const dz = (disp(Math.min(1, u + 0.02), v) - disp(Math.max(0, u - 0.02), v)) / (0.04 * W); // slope along the cloth
      const dzv = (disp(u, Math.min(1, v + 0.04)) - disp(u, Math.max(0, v - 0.04))) / (0.08 * h);
      // the cloth keeps its length: the fly end is pulled in as it folds; with little wind it droops
      const pull = 1 - 0.07 * wk * u * Math.min(1, Math.abs(dz) + 0.4);
      const droop = (1 - Math.min(1, wk)) * 0.35 * h * u * u + 0.04 * h * u * (1 - v) * wk;
      // the free edge flutters up and down a little too (wavy top / bottom edges in silhouette)
      const flut = wk * 0.045 * h * u * u * Math.sin(u * 11 - t * 9 + ph * 3);
      pos.setXYZ(k, u * W * pull, (v - 0.5) * h - droop * (1.2 - v) + flut, z);
      // folds: light / dark bands from the slope (light from the front-left), soft-quantised
      const s = -dz * 1.6 + dzv * 0.5;
      const band = 0.62 + 0.38 * THREE.MathUtils.smoothstep(s, -0.3, 0.3) + 0.12 * THREE.MathUtils.smoothstep(s, 0.5, 0.95);
      col.setXYZ(k, band, band, band);
    }
  }
  pos.needsUpdate = true;
  col.needsUpdate = true;
  geo.computeBoundingSphere();
  const wood = toonMaterial({ color: poleColor });
  const gold = toonMaterial({ color: "#d9a52b" });
  const rope = toonMaterial({ color: "#d8cbb0" });
  const top = P;
  // halyard: from the truck at the top down the pole's fly side to a cleat at 1 m, sagging a little
  const ropePts: THREE.Vector3[] = [];
  for (let i = 0; i <= 12; i++) {
    const k = i / 12;
    const y = top - 0.02 * h - k * (top - Math.min(1, 0.4 * top));
    ropePts.push(new THREE.Vector3(pr * 1.6 + 0.012 * h * Math.sin(Math.PI * k), y, pr * 0.6));
  }
  const ropeGeo = React.useMemo(() => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ropePts), 12, Math.max(0.0015, 0.004 * h), 4), [h, P, pr]); // eslint-disable-line
  return (
    <group position={p} rotation={[0, yaw, 0]}>
      <mesh geometry={geoOf("fpole", () => new THREE.CylinderGeometry(0.85, 1, 1, 12))} material={wood} position={[0, P / 2, 0]} scale={[pr, P, pr]} castShadow />
      <mesh geometry={geoOf("fball", () => new THREE.SphereGeometry(1, 14, 10))} material={gold} position={[0, top + 1.6 * pr, 0]} scale={1.6 * pr} castShadow />
      <mesh geometry={geoOf("fspike", () => new THREE.ConeGeometry(1, 1, 10))} material={gold} position={[0, top + 3.2 * pr + 1.5 * pr, 0]} scale={[0.9 * pr, 3 * pr, 0.9 * pr]} castShadow />
      <mesh geometry={geoOf("fcleat", () => new THREE.BoxGeometry(1, 1, 1))} material={gold} position={[pr * 1.2, Math.min(1, 0.4 * top), pr * 0.6]} scale={[0.6 * pr, 2.5 * pr, 0.8 * pr]} />
      <mesh geometry={ropeGeo} material={rope} />
      <mesh geometry={geo} material={clothMat(tex)} position={[pr * 0.9, top - h / 2 - 0.01 * h, 0]} castShadow />
    </group>
  );
};
