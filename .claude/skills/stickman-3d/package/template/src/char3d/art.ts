// Flat art layers of the 3D stickman (RicksClips style sheet): head (skin + hair + face), hat, torso (costume), skirt.
// Each is the painter's own drawing (src/char/drawCharacter.ts -> draw*Art) on a canvas texture, shown on a quad that
// faces the lens. Unlit: the layer is multiplied by a light tint from the View's mood that keeps the figure bright
// (the reference head never drops under ~90 % of white; only its hue takes the scene's light).
import * as THREE from "three";
import { ART, ART_REF, drawHatArt, drawHeadArt, drawSkirtArt, drawTorsoArt } from "../char/drawCharacter";
import type { AnyExpression, FaceParams } from "../char/drawCharacter";
import { faceKey } from "./faceAnim";
import type { CharacterSpec } from "../char/types";
import type { MoodPreset } from "../engine/core/moods";
import type { V3 } from "../engine/types";
import { autoTint } from "../world/Card";

/** canvas pixels per head width (a head is ~300-500 px wide on screen in a medium shot at 1080 x 1920) */
export const ART_PX = 300;
export const TINT = {
  floor: 0.92, // the brightest channel of the tint never falls below this (measured: >= 0.91 in every light)
  hue: 0.45, // share of the scene light's hue the figure takes (measured channel drop 2-27 %)
};

const texOf = (draw: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture => {
  const c = document.createElement("canvas");
  draw(c.getContext("2d")!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
};

// bounded LRU caches: textures by what they show, materials by texture + tint
const texs = new Map<string, THREE.Texture | null>();
const mats = new Map<string, THREE.MeshBasicMaterial>();
const MAX_TEX = 96; // slider faces add one texture per visible face change
const MAX_MAT = 256;
const cached = (key: string, make: () => THREE.Texture | null): THREE.Texture | null => {
  if (texs.has(key)) {
    const t = texs.get(key)!;
    texs.delete(key);
    texs.set(key, t);
    return t;
  }
  const t = make();
  texs.set(key, t);
  while (texs.size > MAX_TEX) {
    const old = texs.keys().next().value as string;
    const ot = texs.get(old);
    texs.delete(old);
    if (ot) {
      for (const [k, m] of mats) if (k.startsWith(ot.id + "|")) (m.dispose(), mats.delete(k));
      ot.dispose();
    }
  }
  return t;
};
// a costume change keeps the cast id: the key carries the whole spec
const idOf = (spec: CharacterSpec) => `${spec.id}|${JSON.stringify(spec.outfit)}|${spec.skin ?? ""}`;

export const headTex = (spec: CharacterSpec, expr: AnyExpression, blink: boolean, mouth: number) =>
  cached(`head|${idOf(spec)}|${expr}|${blink ? 1 : 0}|${mouth}`, () =>
    texOf((ctx) => drawHeadArt(ctx, spec, { expr, pose: "stand", facing: 1, blink: blink ? 1 : 0, mouthOpen: mouth, walkPhase: 0 }, ART_PX)),
  )!;
/** head layer with a slider face (faceAnim.faceAt): redrawn whenever a slider moves by a visible step */
export const headFaceTex = (spec: CharacterSpec, face: FaceParams) =>
  cached(`headF|${idOf(spec)}|${faceKey(face)}`, () =>
    texOf((ctx) => drawHeadArt(ctx, spec, { expr: "neutral", pose: "stand", facing: 1, blink: 0, mouthOpen: 0, walkPhase: 0, face }, ART_PX)),
  )!;
export const hatTex = (spec: CharacterSpec) =>
  cached(`hat|${idOf(spec)}`, () => {
    let has = false;
    const t = texOf((ctx) => (has = drawHatArt(ctx, spec, ART_PX)));
    if (!has) t.dispose();
    return has ? t : null;
  });
export const torsoTex = (spec: CharacterSpec) => cached(`torso|${idOf(spec)}`, () => texOf((ctx) => drawTorsoArt(ctx, spec, ART_PX)))!;
export const skirtTex = (spec: CharacterSpec) => cached(`skirt|${idOf(spec)}`, () => texOf((ctx) => drawSkirtArt(ctx, spec, ART_PX)))!;

/** The mood grade lifts near-blacks to a mid plum (engine/post/shaders.ts grade): fine for lit sets, wrong for drawn
 *  ink. The grade skips most of the lift where the scene alpha is 0.4 (the marker thick dark liquids use), so the ink
 *  limbs write 0.4 everywhere and the layers write it on their dark texels (outline, brows, eyes, dark hats). */
const darkFloor = (m: THREE.MeshBasicMaterial, always: boolean) => {
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace(
      "#include <dithering_fragment>",
      always
        ? "#include <dithering_fragment>\n  gl_FragColor.a = 0.4;"
        : "#include <dithering_fragment>\n  gl_FragColor.a = dot(gl_FragColor.rgb, vec3(0.2126, 0.7152, 0.0722)) < 0.03 ? 0.4 : 1.0;",
    );
  };
  m.customProgramCacheKey = () => (always ? "stickman-ink" : "stickman-layer");
  return m;
};

/** the unlit cut-out material of a layer under a tint (hex) */
export const layerMat = (tex: THREE.Texture, tint: string): THREE.MeshBasicMaterial => {
  const k = `${tex.id}|${tint}`;
  let m = mats.get(k);
  if (m) mats.delete(k);
  else m = darkFloor(new THREE.MeshBasicMaterial({ map: tex, color: tint, alphaTest: 0.5, side: THREE.DoubleSide, toneMapped: false, fog: false }), false);
  mats.set(k, m);
  while (mats.size > MAX_MAT) {
    const old = mats.keys().next().value as string;
    mats.get(old)!.dispose();
    mats.delete(old);
  }
  return m;
};

/** shadow-only copy of a layer (Stickman turns it toward the key light): invisible in the picture, cut out by the
 *  layer's alpha in the shadow pass */
const shadowMats = new Map<number, THREE.MeshBasicMaterial>();
export const shadowMat = (tex: THREE.Texture): THREE.MeshBasicMaterial => {
  let m = shadowMats.get(tex.id);
  if (m) shadowMats.delete(tex.id);
  else m = new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide, colorWrite: false, depthWrite: false });
  shadowMats.set(tex.id, m);
  while (shadowMats.size > MAX_TEX) {
    const old = shadowMats.keys().next().value as number;
    shadowMats.get(old)!.dispose();
    shadowMats.delete(old);
  }
  return m;
};

// ink limbs: unlit, with a 1 x 1 white map so the ink pass can treat them as cut-out occluders like the layers
const WHITE = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
WHITE.needsUpdate = true;
export const INK_MAT = darkFloor(new THREE.MeshBasicMaterial({ color: ART.ink, map: WHITE, toneMapped: false, fog: false }), true);

/** the light tint of an unlit figure standing at `at` seen from `cam` in `mood` (sRGB hex): the hue of what a lit
 *  head would get (world/Card autoTint), softened to TINT.hue, at a brightness that never drops under TINT.floor */
export const figureTint = (mood: MoodPreset | null, at: V3, cam: V3): string => {
  if (!mood) return "#ffffff";
  const hex = autoTint(mood, at, cam, 1);
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const m = Math.max(c[0], c[1], c[2], 1e-3);
  const b = Math.min(1, Math.max(TINT.floor, m));
  const q = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 40) * (255 / 40);
  return "#" + c.map((v) => Math.round(q(b * (1 - TINT.hue * (1 - v / m)))).toString(16).padStart(2, "0")).join("");
};

/** layer quads in head widths (the builder scales by the head width in metres). Head / hat: the canvas frame of
 *  draw*Art, origin at the head centre. Torso: origin at the capsule's bottom centre, +y toward the neck. */
export const HEAD_QUAD = new THREE.PlaneGeometry(ART.W, ART.UP + ART.DOWN).translate(0, (ART.UP - ART.DOWN) / 2, 0);
const TW = (ART_REF.TORSO_W + 2 * ART.torsoPad) / ART_REF.HW;
const TH = (ART_REF.TORSO_H + 2 * ART.torsoPad) / ART_REF.HW;
export const TORSO_QUAD = new THREE.PlaneGeometry(TW, TH).translate(0, TH / 2 - ART.torsoPad / ART_REF.HW, 0);
