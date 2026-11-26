// The 3D stickman's body parts as REAL 3D MESHES (default since 2026-11-20, user pick after the _t_toon3d test):
// head / torso / hat / hair / 'dress' skirt are solids that turn with the body, while the look stays the flat cut-out:
//   - unlit flat colour x the same mood tint as the old cards (art.ts figureTint), no lighting, no shading lines;
//   - the painter's OWN drawings (draw*Art with the silhouette outline switched off: withToonPaint) projected onto the
//     mesh front-to-back; the back half gets a back drawing (back of the head, back of the jacket, back of the hair);
//   - one dark purple-brown outline round each part's silhouette: an inverted hull, 0.85 painter's pen wide in world
//     units (scales with the figure like the drawn outline). Meshes sit half a pen inside the painted outline, so from
//     the front the ink lands where the card's ink was;
//   - all geometry is generated from the cast spec at runtime (no per-character build): head + torso from the
//     painter's numbers, hats spun from the hat drawing, hair = the head inflated to the hair drawing's outline,
//     both carved by the drawing seen from the front.
// <Stickman toon={false}/> draws the old camera-facing cards; toon="lit" = experimental lit 3D (2-5x slower).
import * as THREE from "three";
import { ART, ART_REF, drawHairArt, drawHatArt, drawHeadArt, drawTorsoArt, lookOf, withToonPaint } from "../char/drawCharacter";
import type { FaceParams } from "../char/drawCharacter";
import type { CharacterSpec } from "../char/types";
import { faceKey } from "./faceAnim";
import { ART_PX } from "./art";
import { IBL, IBL_GLSL } from "../world/ibl";

// ---------------------------------------------------------------- textures (front = the card's own drawing)
const texs = new Map<string, THREE.CanvasTexture>();
const tex = (key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) => {
  let t = texs.get(key);
  if (t) return t;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d")!);
  t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  texs.set(key, t);
  while (texs.size > 96) {
    const k = texs.keys().next().value as string;
    texs.get(k)!.dispose();
    texs.delete(k);
  }
  return t;
};
export const PEN_HW = (0.85 * (ART.thin + ART.thick)) / 2 / ART_REF.HW; // hull outline width in head widths (the card's texture pen reads ~15 % thinner after filtering)
const idOf = (spec: CharacterSpec) => `${spec.id}|${JSON.stringify(spec.outfit)}`;
const HEAD_W = Math.round(ART.W * ART_PX), HEAD_H = Math.round((ART.UP + ART.DOWN) * ART_PX);
const TS = ART_PX / ART_REF.HW;
const TOR_W = Math.round((ART_REF.TORSO_W + 2 * ART.torsoPad) * TS), TOR_H = Math.round((ART_REF.TORSO_H + 2 * ART.torsoPad) * TS);

export const headFront = (spec: CharacterSpec, face: FaceParams) =>
  tex(`hf|${idOf(spec)}|${faceKey(face)}`, HEAD_W, HEAD_H, (ctx) =>
    withToonPaint(() => drawHeadArt(ctx, spec, { expr: "neutral", pose: "stand", facing: 1, blink: 0, mouthOpen: 0, walkPhase: 0, face }, ART_PX)));
export const hatFront = (spec: CharacterSpec) =>
  tex(`hat|${idOf(spec)}`, HEAD_W, HEAD_H, (ctx) => withToonPaint(() => drawHatArt(ctx, spec, ART_PX)));
export const torsoFront = (spec: CharacterSpec) => tex(`tf|${idOf(spec)}`, TOR_W, TOR_H, (ctx) => withToonPaint(() => drawTorsoArt(ctx, spec, ART_PX)));

/** back of the head: skin, the hair (under a hat: a band of hair under the brim with a tufted lower edge), the painter's
 *  violet edge shade */
export const headBack = (spec: CharacterSpec) =>
  tex(`hb|${idOf(spec)}`, HEAD_W, HEAD_H, (ctx) => {
    const L = lookOf(spec);
    const ratio = L.headRatio * (ART.headRatio / 1.05);
    const px = ART_PX;
    const cx = (ART.W / 2) * px, cy = ART.UP * px, rx = 0.5 * px, ry = rx / ratio;
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx * 1.04, ry * 1.04, 0, 0, Math.PI * 2);
    ctx.fillStyle = L.skin;
    ctx.fill();
    ctx.clip();
    if (false as boolean) { // the hair is a 3D shell now (hairGeo)
      const hasHat = false; // under a hat the hair is the 3D band of the parts GLB
      const low = cy + ry * (hasHat ? 0.05 : 0.25); // lower edge of the hair
      ctx.beginPath();
      ctx.moveTo(cx - rx * 1.2, cy - ry * 1.2);
      ctx.lineTo(cx + rx * 1.2, cy - ry * 1.2);
      ctx.lineTo(cx + rx * 1.2, low - ry * 0.2);
      const n = 7;
      for (let i = 0; i <= n; i++) {
        const x = cx + rx * 1.05 - (2.1 * rx * i) / n;
        const y = low + (i % 2 ? ry * 0.1 : -ry * 0.04) - ry * 0.18 * Math.pow(Math.abs(i / n - 0.5) * 2, 2);
        ctx.lineTo(x, y);
      }
      ctx.lineTo(cx - rx * 1.2, low - ry * 0.2);
      ctx.closePath();
      ctx.fillStyle = L.hair ?? "#222";
      ctx.fill();
      // half-pen ink strand lines
      ctx.strokeStyle = ART.ink;
      ctx.lineWidth = (ART.thin / 2) * (px / ART_REF.HW) * 0.6;
      ctx.lineCap = "round";
      for (const k of [-0.45, -0.1, 0.25]) {
        ctx.beginPath();
        ctx.moveTo(cx + rx * k, cy - ry * 0.8);
        ctx.quadraticCurveTo(cx + rx * (k + 0.12), cy - ry * 0.3, cx + rx * (k + 0.05), low - ry * 0.12);
        ctx.stroke();
      }
    }
    const g = ctx.createRadialGradient(cx + 40, cy - 50, rx * 0.55, cx - 20, cy + 20, rx * 1.05);
    g.addColorStop(0, "rgba(120,80,140,0)");
    g.addColorStop(1, "rgba(110,70,135,0.16)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, HEAD_W, HEAD_H);
    ctx.restore();
  });

/** back of the jacket: the front drawing's own colours (sampled where the costume is plain), the trousers band and
 *  belt line, a centre seam and back vent, the white collar at the neck, the same cloth shading */
export const torsoBack = (spec: CharacterSpec) =>
  tex(`tb|${idOf(spec)}`, TOR_W, TOR_H, (ctx) => {
    const front = torsoFront(spec).image as HTMLCanvasElement;
    const f = front.getContext("2d")!;
    const at = (x: number, y: number) => { const d = f.getImageData(Math.round(x * TOR_W), Math.round(y * TOR_H), 1, 1).data; return `rgb(${d[0]},${d[1]},${d[2]})`; };
    void at;
    const L = lookOf(spec);
    const suit = L.torso, trou = L.legs || L.torso;
    const s = TS;
    const pad = ART.torsoPad * s;
    const W = ART_REF.TORSO_W * s, H = ART_REF.TORSO_H * s;
    const x0 = pad, y0 = pad, B = pad + H;
    ctx.save();
    // capsule clip
    const r = W / 2;
    ctx.beginPath();
    ctx.arc(x0 + r, y0 + r, r, Math.PI, 0);
    ctx.lineTo(x0 + W, B - r);
    ctx.arc(x0 + r, B - r, r, 0, Math.PI);
    ctx.closePath();
    ctx.fillStyle = suit;
    ctx.fill();
    ctx.clip();
    // copy the front's band of trousers + belt row as it is (same heights all round)
    const bandY = B - 120 * s;
    ctx.drawImage(front, 0, bandY, TOR_W, TOR_H - bandY, 0, bandY, TOR_W, TOR_H - bandY);
    ctx.fillStyle = trou;
    const ink = ART.ink;
    ctx.strokeStyle = ink;
    ctx.lineCap = "round";
    // white collar band at the neck + the jacket collar over it
    ctx.fillStyle = "#F4F1EA";
    ctx.fillRect(x0, y0, W, 22 * s);
    ctx.fillStyle = suit;
    ctx.beginPath();
    ctx.moveTo(x0, y0 + 18 * s);
    ctx.quadraticCurveTo(x0 + r, y0 + 40 * s, x0 + W, y0 + 18 * s);
    ctx.lineTo(x0 + W, y0 + 90 * s);
    ctx.quadraticCurveTo(x0 + r, y0 + 120 * s, x0, y0 + 90 * s);
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = 7 * s;
    ctx.stroke();
    // centre seam + vent
    ctx.lineWidth = 6 * s;
    ctx.beginPath();
    ctx.moveTo(x0 + r, y0 + 110 * s);
    ctx.lineTo(x0 + r, bandY - 4 * s);
    ctx.stroke();
    ctx.lineWidth = 5 * s;
    ctx.beginPath();
    ctx.moveTo(x0 + r - 14 * s, bandY - 90 * s);
    ctx.lineTo(x0 + r - 14 * s, bandY - 4 * s);
    ctx.stroke();
    // shoulder seams
    for (const d of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(x0 + r + d * 30 * s, y0 + 100 * s);
      ctx.quadraticCurveTo(x0 + r + d * 110 * s, y0 + 120 * s, x0 + r + d * 150 * s, y0 + 210 * s);
      ctx.stroke();
    }
    // the same cloth light as the front (dark on the screen-right side seen from the back = the figure's left)
    const g = ctx.createLinearGradient(0, 0, TOR_W, 0);
    g.addColorStop(0, "rgba(255,245,225,0.16)");
    g.addColorStop(0.35, "rgba(255,245,225,0)");
    g.addColorStop(0.62, "rgba(20,10,30,0)");
    g.addColorStop(1, "rgba(20,10,30,0.34)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, TOR_W, TOR_H);
    ctx.restore();
  });

// ---------------------------------------------------------------- materials
const WHITE = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
WHITE.needsUpdate = true;
/** canvas frame of a part (head widths): uv = (p.xy + off) * inv; back mirrors x */
export type Frame = { off: [number, number]; size: [number, number] };
export const HEAD_FRAME: Frame = { off: [ART.W / 2, ART.DOWN], size: [ART.W, ART.UP + ART.DOWN] };
const TW = (ART_REF.TORSO_W + 2 * ART.torsoPad) / ART_REF.HW, TH = (ART_REF.TORSO_H + 2 * ART.torsoPad) / ART_REF.HW;
export const TORSO_FRAME: Frame = { off: [TW / 2, ART.torsoPad / ART_REF.HW], size: [TW, TH] };

const mats = new Map<string, THREE.MeshBasicMaterial>();
/** unlit projected material: front texture on the +z half, back texture (x mirrored) on the -z half; `base` fills
 *  texels the drawing leaves empty (the drawn shape's wobble vs. the smooth mesh) */
export const projMat = (front: THREE.Texture, back: THREE.Texture, fr: Frame, tint: string, base: string, blend = 0.12, lit = false, carve = false) => {
  const key = `${front.id}|${back.id}|${fr.off}|${tint}|${base}|${blend}|${lit}|${carve}`;
  let m = mats.get(key);
  if (m) return m;
  m = (lit ? new THREE.MeshStandardMaterial({ color: "#ffffff", map: WHITE, roughness: 0.42, metalness: 0 }) : new THREE.MeshBasicMaterial({ color: tint, map: WHITE, toneMapped: false, fog: false })) as THREE.MeshBasicMaterial;
  const u = { uF: { value: front }, uB: { value: back }, uOff: { value: new THREE.Vector2(...fr.off) }, uInv: { value: new THREE.Vector2(1 / fr.size[0], 1 / fr.size[1]) }, uBase: { value: new THREE.Color(base) }, uBlend: { value: blend } };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u, lit ? {} : IBL);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vObj; varying vec3 vObjN; varying vec3 vIblN;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvObj = position; vObjN = normal; vIblN = mat3(modelMatrix) * normal;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vObj; varying vec3 vObjN; uniform sampler2D uF; uniform sampler2D uB; uniform vec2 uOff; uniform vec2 uInv; uniform vec3 uBase; uniform float uBlend; varying vec3 vIblN;" + (lit ? "" : IBL_GLSL))
      .replace(
        "#include <map_fragment>",
        `vec2 uvF = (vObj.xy + uOff) * uInv; vec2 uvB = (vec2(-vObj.x, vObj.y) + uOff) * uInv;
         vec4 cF = texture2D(uF, uvF); vec4 cB = texture2D(uB, uvB);
         ${carve ? 'if (mix(cB.a, cF.a, smoothstep(-uBlend, uBlend, normalize(vObjN).z)) < 0.5) discard;' : ''}
         vec3 fF = mix(uBase, cF.rgb, cF.a); vec3 fB = mix(uBase, cB.rgb, cB.a);
         float w = smoothstep(-uBlend, uBlend, normalize(vObjN).z);
         diffuseColor.rgb *= mix(fB, fF, w);${lit ? "" : " diffuseColor.rgb *= iblTint(vIblN);"}`,
      )
      .replace("#include <dithering_fragment>", "#include <dithering_fragment>\n  gl_FragColor.a = dot(gl_FragColor.rgb, vec3(0.2126, 0.7152, 0.0722)) < 0.03 ? 0.4 : 1.0;");
  };
  m.customProgramCacheKey = () => `toon-proj-${lit}-${carve}`;
  mats.set(key, m);
  return m;
};

/** inverted hull: back faces pushed out along the normal by `w` (object units), ink colour; alpha 0.4 tells the
 *  grade not to lift it (the cards' ink marker, art.ts darkFloor) */
const hulls = new Map<string, THREE.MeshBasicMaterial>();
/** carve: the hull of a carved shell (hair, hats) is carved where its shell is (front-facing, no drawing there) */
export const hullMat = (w: number, carve?: { tex: THREE.Texture; back?: THREE.Texture; fr: Frame }) => {
  const k = `${Math.round(w * 1e5)}|${carve ? carve.tex.id + "/" + (carve.back ?? carve.tex).id : "-"}`;
  let m = hulls.get(k);
  if (m) return m;
  m = new THREE.MeshBasicMaterial({ color: ART.ink, map: WHITE, side: THREE.BackSide, toneMapped: false, fog: false });
  const u = carve ? { uF: { value: carve.tex }, uB: { value: carve.back ?? carve.tex }, uOff: { value: new THREE.Vector2(...carve.fr.off) }, uInv: { value: new THREE.Vector2(1 / carve.fr.size[0], 1 / carve.fr.size[1]) } } : {};
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vObj; varying vec3 vObjN;")
      .replace("#include <begin_vertex>", `#include <begin_vertex>\nvObj = position; vObjN = normal;\ntransformed += normalize(normal) * ${w.toFixed(5)};`);
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vObj; varying vec3 vObjN;" + (carve ? " uniform sampler2D uF; uniform sampler2D uB; uniform vec2 uOff; uniform vec2 uInv;" : ""))
      .replace("#include <map_fragment>", carve ? "#include <map_fragment>\n { float aF = texture2D(uF, (vObj.xy + uOff) * uInv).a; float aB = texture2D(uB, (vec2(-vObj.x, vObj.y) + uOff) * uInv).a; if (mix(aB, aF, smoothstep(-0.12, 0.12, normalize(vObjN).z)) < 0.5) discard; }" : "#include <map_fragment>")
      .replace("#include <dithering_fragment>", "#include <dithering_fragment>\n  gl_FragColor.a = 0.4;");
  };
  m.customProgramCacheKey = () => `toon-hull-${k.split("|")[0]}-${!!carve}`;
  hulls.set(k, m);
  return m;
};

const SILENT = { outline: "silent" };
/** one part: the flat projected mesh + its hull */
export const ToonPart: React.FC<{ geo: THREE.BufferGeometry; mat: THREE.Material; hull: number; cast: boolean; scale?: [number, number, number]; carve?: { tex: THREE.Texture; back?: THREE.Texture; fr: Frame } }> = ({ geo, mat, hull, cast, scale, carve }) => (
  <group scale={scale}>
    <mesh geometry={geo} material={mat} castShadow={cast} receiveShadow={(mat as THREE.MeshStandardMaterial).isMeshStandardMaterial} userData={SILENT} />
    <mesh geometry={geo} material={hullMat(hull, carve)} userData={SILENT} />
  </group>
);


/** a plain flat colour under the figure tint (hair tufts) */
const flats = new Map<string, THREE.MeshBasicMaterial>();
export const flatMat = (hex: string, tint: string, lit = false) => {
  const k = `${hex}|${tint}|${lit}`;
  let m = flats.get(k);
  if (!m) {
    m = (lit ? new THREE.MeshStandardMaterial({ color: hex, map: WHITE, roughness: 0.6, metalness: 0 }) : new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiply(new THREE.Color(tint)), map: WHITE, toneMapped: false, fog: false })) as THREE.MeshBasicMaterial;
    m.onBeforeCompile = (sh) => {
      if (!lit) {
        Object.assign(sh.uniforms, IBL);
        sh.vertexShader = sh.vertexShader
          .replace("#include <common>", "#include <common>\nvarying vec3 vIblN;")
          .replace("#include <begin_vertex>", "#include <begin_vertex>\nvIblN = mat3(modelMatrix) * normal;");
        sh.fragmentShader = sh.fragmentShader
          .replace("#include <common>", "#include <common>\nvarying vec3 vIblN;" + IBL_GLSL)
          .replace("#include <map_fragment>", "#include <map_fragment>\n  diffuseColor.rgb *= iblTint(vIblN);");
      }
      sh.fragmentShader = sh.fragmentShader.replace("#include <dithering_fragment>", "#include <dithering_fragment>\n  gl_FragColor.a = dot(gl_FragColor.rgb, vec3(0.2126, 0.7152, 0.0722)) < 0.03 ? 0.4 : 1.0;");
    };
    m.customProgramCacheKey = () => (lit ? "toon-flat-lit" : "toon-flat");
    flats.set(k, m);
  }
  return m;
};

// ---------------------------------------------------------------- generic geometry (no per-character build step)
// Every part is a solid of revolution about +y (front = +z), built half a pen inside the painted outline (the hull adds
// the pen). Head + torso from the painter's numbers; hats + hair spun from the painter's own hat / hair drawing: per
// distance from the centre line, the drawing's top and bottom edge (union of both sides) becomes the profile, so the
// front silhouette IS the drawing. Hair shells and hats are carved by the front drawing (projMat carve): seen from the
// front only what the drawing shows is there; the back half is whole (the back of the hair, the back of the hat).
export const HP = (ART.thin + ART.thick) / 4 / ART_REF.HW; // half the painter's pen
type Ring = { y: number; w: number; d: number; dy?: (cosA: number) => number };
const lathe = (rings: Ring[], seg = 64): THREE.BufferGeometry => {
  const pos: number[] = [];
  const idx: number[] = [];
  const start: number[] = [];
  for (const r of rings) {
    start.push(pos.length / 3);
    if (r.w < 1e-6) { pos.push(0, r.y, 0); continue; }
    for (let j = 0; j < seg; j++) {
      const a = (2 * Math.PI * j) / seg;
      const c = Math.cos(a), sn = Math.sin(a);
      pos.push(r.w * c, r.y + (r.dy ? r.dy(Math.abs(c)) : 0), r.d * sn);
    }
  }
  const at = (i: number, j: number) => (rings[i].w < 1e-6 ? start[i] : start[i] + (j % seg));
  for (let i = 0; i < rings.length - 1; i++)
    for (let j = 0; j < seg; j++) {
      const a = at(i, j), b = at(i, j + 1), c = at(i + 1, j + 1), d = at(i + 1, j);
      if (a !== b) idx.push(a, d, b);
      if (c !== d) idx.push(b, d, c);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // the profile may run either way round: make the normals point out (away from the axis, on the whole)
  const n = g.getAttribute("normal"), p = g.getAttribute("position");
  let out = 0;
  for (let i = 0; i < n.count; i++) out += n.getX(i) * p.getX(i) + n.getZ(i) * p.getZ(i);
  if (out < 0) {
    for (let k = 0; k < idx.length; k += 3) [idx[k + 1], idx[k + 2]] = [idx[k + 2], idx[k + 1]];
    g.setIndex(idx);
    g.computeVertexNormals();
  }
  g.computeBoundingSphere();
  return g;
};
const geos = new Map<string, THREE.BufferGeometry>();
const geo = (k: string, make: () => THREE.BufferGeometry) => {
  let g = geos.get(k);
  if (!g) { g = make(); geos.set(k, g); }
  return g;
};

export const HEAD_DEPTH = 0.45;
/** bean head of width/height `ratio` (the painter's flat-ish bottom), centre at 0 */
export const headGeo = (ratio: number) => geo(`head|${ratio.toFixed(4)}`, () => {
  const rx = 0.5 - HP, rz = HEAD_DEPTH - HP, ry = 0.5 / ratio - HP;
  const rings: Ring[] = [];
  const N = 48;
  for (let i = 0; i <= N; i++) {
    const th = (Math.PI * i) / N;
    const y = -Math.cos(th), s = Math.sin(th), down = Math.max(0, -y);
    const k = 1 + 0.012 * down - 0.045 * down ** 4;
    rings.push({ y: y * ry * k, w: s * rx * k, d: s * rz * k });
  }
  return lathe(rings);
});
export const TORSO_DEPTH = 0.68;
/** the painter's capsule as a pill, origin at its bottom end */
export const torsoGeo = () => geo("torso", () => {
  const W = ART_REF.TORSO_W / ART_REF.HW, H = ART_REF.TORSO_H / ART_REF.HW, r = W / 2;
  const rings: Ring[] = [];
  const N = 64;
  for (let i = 0; i <= N; i++) {
    const z = (H * i) / N;
    const w = z < r ? Math.sqrt(Math.max(0, r * r - (r - z) ** 2)) : z > H - r ? Math.sqrt(Math.max(0, r * r - (z - (H - r)) ** 2)) : r;
    const ww = i > 0 && i < N ? Math.max(0, w - HP) : 0;
    rings.push({ y: HP + ((H - 2 * HP) * i) / N, w: ww, d: ww * TORSO_DEPTH });
  }
  return lathe(rings);
});
/** a 'dress' skirt: a frustum from the waist (radius 1) down to the hem (radius k), height 1, origin at the waist */
export const skirtGeo3 = (k: number) => geo(`skirt|${k.toFixed(2)}`, () => {
  const rings: Ring[] = [{ y: 0, w: 0, d: 0 }];
  for (let i = 0; i <= 12; i++) {
    const u = i / 12;
    rings.push({ y: -u, w: 1 + (k - 1) * u, d: (1 + (k - 1) * u) * 0.8 });
  }
  rings.push({ y: -1, w: 0, d: 0 });
  return lathe(rings, 48);
});

/** top / bottom edge of a drawing per distance from the canvas centre line (head widths, y up from the head centre) */
const profileOf = (img: HTMLCanvasElement, step = 3) => {
  const ctx = img.getContext("2d")!;
  const { width: W, height: H } = img;
  const d = ctx.getImageData(0, 0, W, H).data;
  const cx = Math.round(W / 2);
  const px = W / ART.W;
  const out: { r: number; top: number; bot: number }[] = [];
  for (let dx = 0; dx < W / 2; dx += step) {
    let top = -1, bot = -1;
    for (const x of [cx - dx, cx + dx]) {
      if (x < 0 || x >= W) continue;
      for (let y = 0; y < H; y++) if (d[(y * W + x) * 4 + 3] > 127) { if (top < 0 || y < top) top = y; break; }
      for (let y = H - 1; y >= 0; y--) if (d[(y * W + x) * 4 + 3] > 127) { if (y > bot) bot = y; break; }
    }
    if (top < 0) break; // past the drawing's widest point
    out.push({ r: dx / px, top: ART.UP - top / px, bot: ART.UP - bot / px });
  }
  return out;
};
/** spin a drawing's profile into a closed shell; `curl` keeps a brim's up-curl at the sides only (front/back level) */
const shellOf = (img: HTMLCanvasElement, depth: number, curl: boolean) => {
  const P = profileOf(img);
  if (P.length < 2) return null;
  const thick = P.map((p) => p.top - p.bot), tMax = Math.max(...thick);
  let rd = 0;
  P.forEach((p, i) => { if (thick[i] >= 0.45 * tMax) rd = p.r; });
  const q = P.find((p) => p.r >= rd)!;
  const midD = (q.top + q.bot) / 2;
  const rings: Ring[] = [];
  const shrink = (r: number) => Math.max(0, r - HP);
  const curlDy = (p: { r: number; top: number; bot: number }) => {
    if (!curl || p.r <= rd) return undefined;
    const delta = (p.top + p.bot) / 2 - midD;
    return (c: number) => -(1 - Math.pow(c, 1.5)) * delta;
  };
  rings.push({ y: P[0].top - HP, w: 0, d: 0 });
  for (const p of P) { const w = shrink(p.r); if (w > 0) rings.push({ y: p.top - HP, w, d: w * depth, dy: curlDy(p) }); }
  for (let i = P.length - 1; i >= 0; i--) {
    const p = P[i];
    const w = shrink(p.r);
    if (w > 0) rings.push({ y: Math.min(p.bot + HP, p.top - HP - 0.004), w, d: w * depth, dy: curlDy(p) });
  }
  rings.push({ y: Math.min(P[0].bot + HP, P[0].top - HP - 0.004), w: 0, d: 0 });
  return lathe(rings);
};
const keyOf = (spec: CharacterSpec) => `${spec.id}|${JSON.stringify(spec.outfit)}`;
export const hatGeo = (spec: CharacterSpec) => {
  const k = `hatG|${keyOf(spec)}`;
  if (geos.has(k)) return geos.get(k)!;
  const g = shellOf(hatFront(spec).image as HTMLCanvasElement, 0.92, true);
  if (g) geos.set(k, g);
  return g;
};
export const hairFront = (spec: CharacterSpec) =>
  tex(`hairF|${idOf(spec)}`, HEAD_W, HEAD_H, (ctx) => withToonPaint(() => drawHairArt(ctx, spec, ART_PX)));
/** back of the hair: per column from the hair drawing's top edge down to its lowest hair pixel (the back of the
 *  haircut covers everything the front shows at that width, and the back of the head under it), hair colour with a few
 *  strands. Its alpha also carves the back half of the hair shell. */
export const hairBack = (spec: CharacterSpec) =>
  tex(`hairB|${idOf(spec)}`, HEAD_W, HEAD_H, (ctx) => {
    const L = lookOf(spec);
    const src = hairFront(spec).image as HTMLCanvasElement;
    const d = src.getContext("2d")!.getImageData(0, 0, HEAD_W, HEAD_H).data;
    ctx.fillStyle = L.hair || "#222";
    const cx = HEAD_W / 2;
    for (let x = 0; x < HEAD_W; x++) {
      // the back is mirrored (uvB): use the column on the other side, and make the cut level-ish (union with the mirror)
      let top = -1, bot = -1;
      for (const xx of [x, Math.round(2 * cx - x)]) {
        if (xx < 0 || xx >= HEAD_W) continue;
        for (let y = 0; y < HEAD_H; y++) if (d[(y * HEAD_W + xx) * 4 + 3] > 127) { if (top < 0 || y < top) top = y; break; }
        for (let y = HEAD_H - 1; y >= 0; y--) if (d[(y * HEAD_W + xx) * 4 + 3] > 127) { if (y > bot) bot = y; break; }
      }
      if (top >= 0) ctx.fillRect(x, top, 1, bot - top + 1);
    }
    // (2026-11-24) no strand lines on the back of the hair: from a 3/4 view they showed as dark stripes across the
    // hair and made every haircut read as a striped helmet. The hair is one flat colour, like the rest of the figure.
  });
/** hair shell: the head inflated, per direction in the front plane, out to the hair drawing's outer edge (a quiff, a
 *  bun, curls stick out as in the drawing; elsewhere a hair's breadth over the skin), carved by hairFront / hairBack */
export const hairGeo = (spec: CharacterSpec, ratio: number) => {
  const k = `hairG|${keyOf(spec)}|${ratio.toFixed(4)}`;
  if (geos.has(k)) return geos.get(k)!;
  const img = hairFront(spec).image as HTMLCanvasElement;
  const d = img.getContext("2d")!.getImageData(0, 0, HEAD_W, HEAD_H).data;
  const px = ART_PX, cx = HEAD_W / 2, cy = ART.UP * px;
  const outer = (th: number) => {
    // last hair pixel along the ray from the head centre (head widths), 0 when none
    let last = 0;
    for (let r = 0; r < 1.2 * px; r += 1.5) {
      const x = Math.round(cx + r * Math.cos(th)), y = Math.round(cy - r * Math.sin(th));
      if (x < 0 || y < 0 || x >= HEAD_W || y >= HEAD_H) break;
      if (d[(y * HEAD_W + x) * 4 + 3] > 127) last = r / px;
    }
    return last;
  };
  const N = 180;
  const rho = [...Array(N + 1).keys()].map((i) => outer((2 * Math.PI * i) / N));
  const g = headGeo(ratio).clone();
  const pos = g.getAttribute("position");
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const th = Math.atan2(v.y, v.x);
    // the head outline's radius in this direction (ellipse 0.5 x 0.5/ratio): hair grows out from the outline
    const ex = 0.5 * Math.cos(th), ey = (0.5 / ratio) * Math.sin(th);
    const r0 = 1 / Math.sqrt((Math.cos(th) / 0.5) ** 2 + (Math.sin(th) / (0.5 / ratio)) ** 2);
    void ex; void ey;
    const a = ((th < 0 ? th + 2 * Math.PI : th) / (2 * Math.PI)) * N;
    const ia = Math.floor(a), f = a - ia;
    const rh = rho[ia % (N + 1)] * (1 - f) + rho[(ia + 1) % (N + 1)] * f;
    const kk = THREE.MathUtils.clamp(rh / r0, 1.02, 1.6);
    v.multiplyScalar(kk);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  g.computeBoundingSphere();
  geos.set(k, g);
  return g;
};
