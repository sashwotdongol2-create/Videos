/**
 * drawCharacter.ts — pure canvas painter for the RicksClips3000-style bean-head cards.
 *
 * Everything is specified in "reference pixels" at a 512 px wide head (HW = 512, HH ≈ 490) and
 * scaled by `px.headW / 512`. The figure is always drawn FACING +x (screen right); pass
 * `facing: -1` to get a mirrored card (the R3F component instead mirrors with scale.x so one
 * texture serves both directions).
 *
 * Deterministic: all randomness (head wobble, default hair style, costume detail choice, hat colour)
 * is seeded from `spec.id` via mulberry32.
 */
import type { CharacterSpec, Expression, Pose, Hat } from './types';
import { clamp, hashString, lerp, mulberry32, pick } from './rng';

// ───────────────────────────── constants (reference px at HW = 512) ─────────────────────────────
export let INK = '#1C1620'; // (let: the 3D art layers draw with ART.ink, see the end of this file)
export const SKIN = '#FDFBF6';
export const REF_HW = 512;
export const REF_HH = 490; // w/h 1.045 mean; per-character wobble ±2 %
let THIN = 13; // upper-left outline weight
let THICK = 33; // lower-right outline weight
/** true while the stickman-3d art layers draw (withArtPen): crisper hats, hair tufts under hats, bigger face.
 *  The flat cards keep their old look. */
let ART_MODE = false;
/** 3D-mesh body parts (char3d/toon.tsx): the silhouette outline comes from an inverted hull, so the painter skips it
 *  (fills, costume detail and face stay) and the face group is centred (the 3D head turns it) */
let SKIP_SIL = false;
const silOutline = (ctx: Ctx, pts: Pt[]) => { if (!SKIP_SIL) inkOutline(ctx, pts); };
export function withToonPaint<T>(f: () => T): T {
  const keep: [boolean, number] = [SKIP_SIL, FACE_SHIFT];
  SKIP_SIL = true;
  FACE_SHIFT = 0;
  try { return f(); } finally { [SKIP_SIL, FACE_SHIFT] = keep; }
}
/** hat outline pen scale: the art layers use the head's full pen on hats (measured: same pen), the cards 0.8 */
const HP = () => (ART_MODE ? 1 : 0.8);
const LIMB = 30; // arm/leg stroke (0.06 HW), constant width
const HAND_R = 20;
const TORSO_W = 340; // 0.66 HW
const TORSO_H = 560; // 1.14 HH
const HEAD_OVERLAP = 40; // head hides the torso top by this much
const ARM_LEN = 480;
const FOOT_W = 72;
const FOOT_H = 28;
const HAT_ROOM = 0.35 * REF_HW; // space above the head for tall hats
const HEADS_TALL = 3.2; // head top → feet bottom, in HH
let FACE_SHIFT = 45; // whole face group shifts toward the facing side (0.05–0.15 HW)

/** canvas size classes, in HW units */
const NARROW_W = 1.75;
const WIDE_W = 2.3;
const CARD_H = 3.55;

export type ExtraExpression =
  | 'stern' | 'nervous' | 'cry' | 'effort' | 'bored' | 'talkO' | 'cheer' | 'dizzy' | 'tongue' | 'teethGrit'
  | 'suspicious' | 'smirk' | 'unimpressed' | 'tired'
  // added 2026-11-24 for dialogue skits: clear, readable reactions (FACES + FACE_OVER below)
  | 'eager' | 'excited' | 'awkward' | 'embarrassed' | 'relieved' | 'deadpan' | 'hopeful' | 'proud' | 'surprised'
  | 'curious' | 'annoyed' | 'thinking' | 'wince' | 'shy' | 'sheepish'
  // ANIME reactions (2026-11-24): anime eye / mouth modes + face marks (gloom, pale, vein, blush lines). Pair them
  // with the manpu symbols around the head (char3d/manpu.tsx: sweat drop, vein, ! ? ..., sparkles, gloom, steam).
  | 'a_sparkle' | 'a_cringe' | 'a_blank' | 'a_gloom' | 'a_cry' | 'a_cat' | 'a_deadpan' | 'a_heart' | 'a_dizzy'
  | 'a_rage' | 'a_joy' | 'a_shy' | 'a_nervous' | 'a_pout' | 'a_smug' | 'a_dead';
export type AnyExpression = Expression | ExtraExpression;

export const ALL_EXPRESSIONS: readonly AnyExpression[] = [
  'neutral', 'happy', 'grin', 'laugh', 'sad', 'angry', 'shocked', 'worried', 'smug', 'sleepy', 'confused',
  'scared', 'evil', 'whistle', 'stern', 'nervous', 'cry', 'effort', 'bored', 'talkO', 'cheer', 'dizzy', 'tongue',
  'teethGrit', 'suspicious', 'smirk', 'unimpressed', 'tired',
  'eager', 'excited', 'awkward', 'embarrassed', 'relieved', 'deadpan', 'hopeful', 'proud', 'surprised', 'curious',
  'annoyed', 'thinking', 'wince', 'shy', 'sheepish',
  'a_sparkle', 'a_cringe', 'a_blank', 'a_gloom', 'a_cry', 'a_cat', 'a_deadpan', 'a_heart', 'a_dizzy', 'a_rage', 'a_joy',
  'a_shy', 'a_nervous', 'a_pout', 'a_smug', 'a_dead',
];
export const ALL_POSES: readonly Pose[] = [
  'stand', 'walk', 'run', 'sit', 'lie', 'pointR', 'pointL', 'armsUp', 'wave', 'hold', 'crouch', 'dead',
];
export const ALL_HATS: readonly Hat[] = [
  'none', 'bowler', 'cap', 'tophat', 'helmet', 'bonnet', 'chef', 'pirate', 'crown', 'headband', 'beanie', 'cowboy',
  'police',
];
export type HairStyle = 'bowl' | 'side' | 'quiff' | 'swoosh' | 'bun' | 'curly';
export const HAIR_STYLES: readonly HairStyle[] = ['bowl', 'side', 'quiff', 'swoosh', 'bun', 'curly'];
export type TorsoPattern = 'plain' | 'stripes' | 'plaid' | 'buttons' | 'lapels' | 'vest' | 'belt' | 'poncho' | 'dress' | 'jacket' | 'wrap' | 'cardigan';
export const TORSO_PATTERNS: readonly TorsoPattern[] = [
  'plain', 'stripes', 'plaid', 'buttons', 'lapels', 'vest', 'belt', 'poncho', 'dress', 'jacket', 'wrap', 'cardigan',
];
export const ALL_PROPS = [
  'shovel', 'lantern', 'mirror', 'ticket', 'bag', 'sword', 'phone', 'cup', 'book', 'bell', 'revolver', 'spear',
  'shield', 'cards', 'cash', 'pot', 'rifle', 'capsule',
] as const;
export type PropId = (typeof ALL_PROPS)[number];
export const ALL_ACCESSORIES = [
  'glasses', 'sunglasses', 'monocle', 'moustache', 'beard', 'tie', 'bowtie', 'apron', 'badge', 'scarf', 'toothbrush', 'bandage', 'sling',
] as const;

export interface DrawState {
  expr: AnyExpression;
  pose: Pose;
  facing: 1 | -1;
  /** 0..1, ≥ 0.5 → eyes closed (hard swap, no in-between) */
  blink: number;
  /** 0..1 talking mouth: 0 = expression's own mouth, (0,0.5] = open "o", > 0.5 = teeth block */
  mouthOpen: number;
  /** 0..1 over one 21-frame two-step cycle (see anim.walkPhase) — used by walk/run */
  walkPhase: number;
  /** optional pupil dart (-1..1 each) for ring eyes / dot eyes */
  pupil?: { x: number; y: number };
  /** stickman-3d slider face: when set, the head layer draws these sliders (drawFaceRig) instead of `expr`'s picture,
   *  and the head tilt is left to the 3D head */
  face?: FaceParams;
  /** pose 'rig': joint offsets in reference px (body frame, +x = facing side, +y = down), from Mixamo projections.
   *  armF/armB: [elbow, hand] relative to the shoulder; legF/legB: [knee, ankle] relative to the hip; lean in rad;
   *  dy = body drop in px (crouch while digging). */
  joints?: { armF: [number, number][]; armB: [number, number][]; legF: [number, number][]; legB: [number, number][]; lean?: number; dy?: number };
}

export interface CardMetrics {
  /** canvas size in px */
  w: number;
  h: number;
  /** y (px from top) of the ground contact line */
  feetY: number;
  headCenter: { x: number; y: number };
  /** head-top→feet height of the *standing* figure in px (use this for metres conversion) */
  standH: number;
  /** px per reference px (= headW / 512) */
  unit: number;
}

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
type Pt = { x: number; y: number };

// ───────────────────────────── look resolution (parsed outfit + seeded defaults) ─────────────────────────────
interface Look {
  skin: string;
  torso: string;
  torsoPattern: TorsoPattern;
  legs: string;
  hat: Hat;
  hatColor: string;
  hair?: string;
  hairStyle: HairStyle;
  hairStreaks?: boolean;
  accessories: Set<string>;
  /** role costume painted on the torso (drawCostume): 'banker' | 'clerk' | 'guard'; overrides the pattern */
  costume?: string;
  prop?: PropId;
  /** head w/h ratio with wobble */
  headRatio: number;
  wobble: { a: number[]; p: number[] };
  rand: () => number;
}

const HAT_COLORS: Record<Hat, string[]> = {
  none: [INK],
  bowler: ['#2B2533', '#9D5918'],
  cap: ['#EDF8FA'],
  tophat: ['#37262C', '#2B2533'],
  helmet: ['#5B6B3B'],
  bonnet: ['#F3C7D6', '#CFE4F2', '#F6E7B5'],
  chef: ['#F7F7F4'],
  pirate: ['#2B2533'],
  crown: ['#E7B93A'],
  headband: ['#D83A3A', '#3B6FD6', '#F1F1EE'],
  beanie: ['#A6837F', '#E8702A', '#4C6B9A'],
  cowboy: ['#F6C67A', '#B07A3F', '#232740'],
  police: ['#1F2C6B'],
  nightcap: ['#F4F1EC'],
  officer: ['#5E6455'],
  fieldcap: ['#7A7444'],
  veil: ['#F7F4EE'],
};

/** HAIR (workshop rule, 2026-11-24: "the hair is bad on all. remove hair from everyone", then approved): every
 *  character is drawn bald (the plain white bean head) unless its hair string ends with " keep" ("#3d2a22 quiff keep").
 *  Set HAIR_DEFAULT = true to bring back hair for every cast. Tell people apart by torso colour, costume and
 *  accessories (glasses, tie, hat). */
export const HAIR_DEFAULT = false;
function resolveLook(spec: CharacterSpec): Look {
  const rand = mulberry32(hashString(spec.seed ?? spec.id));
  const torsoTokens = (spec.outfit.torso || '#48A3F4').trim().split(/[\s,]+/);
  const torsoColor = torsoTokens[0];
  const patKw = torsoTokens.slice(1).find((t) => (TORSO_PATTERNS as readonly string[]).includes(t)) as
    | TorsoPattern
    | undefined;
  const rawHair = (spec.outfit.hair ?? '').trim();
  const hairTokens = (HAIR_DEFAULT || / keep$/.test(rawHair) ? rawHair.replace(/ keep$/, '') : '').split(/[\s,]+/).filter(Boolean);
  const hairColor = hairTokens[0];
  const hairKw = hairTokens.slice(1).find((t) => (HAIR_STYLES as readonly string[]).includes(t)) as
    | HairStyle
    | undefined;
  // outfit.hat = "<hat>[ <#colour>]": a hand-picked hat colour beats the seeded one
  const hatTokens = String(spec.outfit.hat ?? 'none').trim().split(/[\s,]+/);
  const hat = hatTokens[0] as Hat;
  const hatColorKw = hatTokens.slice(1).find((t) => t.startsWith('#'));
  const accessories = new Set((spec.outfit.accessory ?? '').split(/[\s,]+/).filter(Boolean));
  const propTok = (spec.outfit.prop ?? '').trim().split(/[\s,]+/)[0];
  const prop = (ALL_PROPS as readonly string[]).includes(propTok) ? (propTok as PropId) : undefined;

  // seeded choices (consume rand in a fixed order so the look is stable)
  const headRatio = 1.05 + (rand() - 0.5) * 0.04;
  const wobbleA = [0, 0, 0, 0].map(() => 0.006 + rand() * 0.008); // lobes k = 2..5, ±~2 % total
  const wobbleP = [0, 0, 0, 0].map(() => rand() * Math.PI * 2);
  const defaultPattern = pick(rand, ['buttons', 'lapels', 'plain', 'belt', 'plain', 'vest'] as const);
  const defaultHair = pick(rand, HAIR_STYLES);
  const hatColor = hatColorKw ?? pick(rand, HAT_COLORS[hat] ?? [INK]);

  return {
    skin: spec.skin ?? SKIN,
    torso: torsoColor,
    torsoPattern: patKw ?? defaultPattern,
    legs: spec.outfit.legs || torsoColor,
    hat,
    hatColor,
    hair: hairColor,
    hairStyle: hairKw ?? defaultHair,
    hairStreaks: hairTokens.includes('streaks'),
    accessories,
    costume: spec.outfit.costume,
    prop,
    headRatio,
    wobble: { a: wobbleA, p: wobbleP },
    rand,
  };
}

// ───────────────────────────── colour helpers ─────────────────────────────
function parseHex(c: string): [number, number, number] | null {
  const m = c.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split('').map((x) => x + x).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function toHex([r, g, b]: [number, number, number]): string {
  const h = (v: number) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}
/** darken/lighten a CSS hex colour by factor (0.8 = 20 % darker). Non-hex colours fall back to ink. */
function shade(c: string, f: number): string {
  const p = parseHex(c);
  if (!p) return f < 1 ? INK : '#ffffff';
  return toHex([p[0] * f, p[1] * f, p[2] * f]);
}
function isDark(c: string): boolean {
  const p = parseHex(c);
  if (!p) return false;
  return (p[0] * 0.299 + p[1] * 0.587 + p[2] * 0.114) < 70;
}

// ───────────────────────────── geometry + ink helpers ─────────────────────────────
/** linear part of the layout transform; used so the thin-thick weight stays on the SCREEN lower-right */
let inkM = { a: 1, b: 0, c: 0, d: 1 };
function setInkMatrix(a: number, b: number, c: number, d: number) {
  inkM = { a, b, c, d };
}
function inkWidth(nx: number, ny: number, thin = THIN, thick = THICK): number {
  // normals transform like directions for rotations/reflections (what we use)
  const sx = inkM.a * nx + inkM.c * ny;
  const sy = inkM.b * nx + inkM.d * ny;
  const ang = Math.atan2(sy, sx);
  return thin + (thick - thin) * Math.max(0, Math.cos(ang - Math.PI / 4));
}

function signedArea(pts: Pt[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}
/** ensure screen-clockwise winding (positive shoelace area in y-down coords) */
function cw(pts: Pt[]): Pt[] {
  return signedArea(pts) < 0 ? pts.slice().reverse() : pts;
}

function ellipsePts(cx: number, cy: number, rx: number, ry: number, n = 64, a0 = 0, a1 = Math.PI * 2): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const t = a0 + ((a1 - a0) * i) / (n - (a1 - a0 >= Math.PI * 2 - 1e-6 ? 0 : 1));
    out.push({ x: cx + rx * Math.cos(t), y: cy + ry * Math.sin(t) });
  }
  return out;
}
/** capsule: rounded rect with full semicircle ends, clockwise. */
function capsulePts(cx: number, top: number, w: number, h: number): Pt[] {
  const r = w / 2;
  const pts: Pt[] = [];
  const n = 20;
  for (let i = 0; i <= n; i++) {
    const t = Math.PI + (Math.PI * i) / n; // left → top → right
    pts.push({ x: cx + r * Math.cos(t), y: top + r + r * Math.sin(t) });
  }
  for (let i = 1; i < 6; i++) pts.push({ x: cx + r, y: top + r + ((h - 2 * r) * i) / 6 });
  for (let i = 0; i <= n; i++) {
    const t = (Math.PI * i) / n; // right → bottom → left
    pts.push({ x: cx + r * Math.cos(t), y: top + h - r + r * Math.sin(t) });
  }
  for (let i = 1; i < 6; i++) pts.push({ x: cx - r, y: top + h - r - ((h - 2 * r) * i) / 6 });
  return pts;
}
function roundRectPts(x: number, y: number, w: number, h: number, r: number): Pt[] {
  r = Math.min(r, w / 2, h / 2);
  const pts: Pt[] = [];
  const corner = (cx: number, cy: number, a0: number) => {
    for (let i = 0; i <= 6; i++) {
      const t = a0 + ((Math.PI / 2) * i) / 6;
      pts.push({ x: cx + r * Math.cos(t), y: cy + r * Math.sin(t) });
    }
  };
  corner(x + w - r, y + r, -Math.PI / 2); // top-right
  corner(x + w - r, y + h - r, 0); // bottom-right
  corner(x + r, y + h - r, Math.PI / 2); // bottom-left
  corner(x + r, y + r, Math.PI); // top-left
  return pts;
}
/** subdivide a polygon so straight runs also get gradual width changes */
function densify(pts: Pt[], maxSeg = 40): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    const L = Math.hypot(q.x - p.x, q.y - p.y);
    const n = Math.max(1, Math.ceil(L / maxSeg));
    for (let k = 0; k < n; k++) out.push({ x: lerp(p.x, q.x, k / n), y: lerp(p.y, q.y, k / n) });
  }
  return out;
}

function pathOf(ctx: Ctx, pts: Pt[]) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
}
function fillPts(ctx: Ctx, pts: Pt[], color: string) {
  pathOf(ctx, pts);
  ctx.fillStyle = color;
  ctx.fill();
}
/**
 * Thin-thick outline: each segment is stroked with a width from the outward normal angle
 * (w = thin + (thick-thin)·max(0, cos(θ − 45°)) in screen space). Round caps hide the steps.
 */
function inkOutline(ctx: Ctx, ptsIn: Pt[], scale = 1, thin = THIN, thick = THICK) {
  const pts = densify(cw(ptsIn));
  ctx.strokeStyle = INK;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const L = Math.hypot(dx, dy);
    if (L < 1e-6) continue;
    ctx.lineWidth = inkWidth(dy / L, -dx / L, thin * scale, thick * scale);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
}
/** fill + thin-thick outline in one go */
function inkShape(ctx: Ctx, pts: Pt[], color: string, scale = 1) {
  fillPts(ctx, pts, color);
  inkOutline(ctx, pts, scale);
}
function strokePts(ctx: Ctx, pts: Pt[], width: number, color = INK, closed = false) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  if (closed) ctx.closePath();
  ctx.stroke();
}
function line(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, width: number, color = INK) {
  strokePts(ctx, [{ x: x0, y: y0 }, { x: x1, y: y1 }], width, color);
}
function dot(ctx: Ctx, x: number, y: number, r: number, color = INK, ry = r) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, r, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}
function ring(ctx: Ctx, x: number, y: number, r: number, width: number, color = INK) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
}
/** quadratic curve sampled to points */
function quad(p0: Pt, c: Pt, p1: Pt, n = 10): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    out.push({ x: u * u * p0.x + 2 * u * t * c.x + t * t * p1.x, y: u * u * p0.y + 2 * u * t * c.y + t * t * p1.y });
  }
  return out;
}
/** two-segment arm: shoulder → elbow → hand with total length `len`; `bend` = ±1 picks the elbow side. */
function bentArm(s: Pt, h: Pt, len = ARM_LEN, bend = 1): Pt[] {
  const dx = h.x - s.x;
  const dy = h.y - s.y;
  const d = Math.hypot(dx, dy);
  if (d >= len - 1) {
    const k = len / d;
    return [s, { x: s.x + dx * k, y: s.y + dy * k }];
  }
  const half = len / 2;
  const mx = (s.x + h.x) / 2;
  const my = (s.y + h.y) / 2;
  const off = Math.sqrt(Math.max(0, half * half - (d / 2) * (d / 2)));
  const nx = -dy / d;
  const ny = dx / d;
  return [s, { x: mx + nx * off * bend, y: my + ny * off * bend }, h];
}

// ───────────────────────────── rig ─────────────────────────────
interface Rig {
  cx: number;
  headTop: number; // of the standing figure
  footY: number; // ground contact line (bottom of feet)
  /** upper-body transform (applied to head, torso, arms): translate then scale about pivot */
  dy: number;
  sx: number;
  sy: number;
  lean: number; // radians, forward lean of upper body about the pivot
  pivot: Pt;
  // body-frame points (BEFORE the upper-body transform)
  headC: Pt;
  torsoTop: number;
  torsoBottom: number;
  shoulderF: Pt; // front (facing side, +x)
  shoulderB: Pt;
  hipF: Pt;
  hipB: Pt;
}

function buildRig(cxBody: number, look: Look): Rig {
  const headTop = HAT_ROOM;
  const hh = REF_HW / look.headRatio;
  const headC = { x: cxBody, y: headTop + hh / 2 };
  const torsoTop = headTop + hh - HEAD_OVERLAP;
  const torsoBottom = torsoTop + TORSO_H;
  const footY = headTop + HEADS_TALL * REF_HH;
  const sy = torsoTop + 90;
  const sxOff = Math.sqrt(170 * 170 - 80 * 80); // capsule half-width at the shoulder row
  return {
    cx: cxBody,
    headTop,
    footY,
    dy: 0,
    sx: 1,
    sy: 1,
    lean: 0,
    pivot: { x: cxBody, y: torsoBottom },
    headC,
    torsoTop,
    torsoBottom,
    shoulderF: { x: cxBody + sxOff, y: sy },
    shoulderB: { x: cxBody - sxOff, y: sy },
    hipF: { x: cxBody + 85, y: torsoBottom - 50 },
    hipB: { x: cxBody - 85, y: torsoBottom - 50 },
  };
}
/** apply the upper-body transform to a body-frame point (so legs can start at the moved hips) */
function xf(r: Rig, p: Pt): Pt {
  const x = p.x - r.pivot.x;
  const y = p.y - r.pivot.y;
  const c = Math.cos(r.lean);
  const s = Math.sin(r.lean);
  const rx = x * c - y * s;
  const ry = x * s + y * c;
  return { x: r.pivot.x + rx * r.sx, y: r.pivot.y + ry * r.sy + r.dy };
}

interface Limbs {
  legs: Pt[][]; // polylines from hip to ankle (screen/body frame, already transformed)
  feet: { at: Pt; angle: number }[]; // foot oval centre + rotation
  armBack: Pt[]; // body frame BEFORE upper transform (drawn inside the transform)
  armFront: Pt[];
  handFront?: Pt; // where a prop attaches (body frame)
  handBack?: Pt;
  bothHands?: boolean;
  pointing?: Pt[]; // extra finger stroke
  horizontal?: boolean;
}

const WIDE_POSES = new Set<Pose>(['rig', 'pointR', 'pointL', 'armsUp', 'wave', 'run', 'sit']);
const WIDE_PROPS = new Set<string>(['revolver', 'spear', 'sword', 'shovel', 'shield', 'rifle']);
const SIDE_CARRY = new Set<string>(['bag', 'lantern', 'shovel', 'spear', 'shield']);

function buildLimbs(r: Rig, st: DrawState, look: Look): Limbs {
  const hang = (sh: Pt, side: number, swing = 0): Pt[] => {
    const hx = sh.x + side * 28 + swing;
    return [sh, { x: hx, y: sh.y + ARM_LEN - 10 }];
  };
  const footLine = (hip: Pt, fx: number, lift = 0): { leg: Pt[]; foot: { at: Pt; angle: number } } => {
    const ankle = { x: fx, y: r.footY - FOOT_H / 2 - lift };
    return { leg: [hip, ankle], foot: { at: { x: fx + 14, y: ankle.y }, angle: 0 } };
  };
  const p = st.pose;
  const prop = look.prop;
  const propFront = prop && !SIDE_CARRY.has(prop);
  const hipF0 = xf(r, r.hipF);
  const hipB0 = xf(r, r.hipB);

  // default standing legs with 6° splay, feet outward
  const standLegs = () => {
    const a = footLine(hipF0, r.cx + 150);
    const b = footLine(hipB0, r.cx - 150);
    a.foot.angle = 0.12;
    b.foot.angle = -0.12;
    b.foot.at.x = r.cx - 150 - 14;
    return { legs: [b.leg, a.leg], feet: [b.foot, a.foot] };
  };
  const frontCarryHand = { x: r.cx + 235, y: r.torsoTop + 250 };

  if (p === 'rig' && st.joints) {
    const J = st.joints;
    const rel = (o: Pt, ps: [number, number][]) => [o, ...ps.map(([x, y]) => ({ x: o.x + x, y: o.y + y }))];
    const hF = xf(r, r.hipF), hB = xf(r, r.hipB);
    const lf = rel(hF, J.legF), lb = rel(hB, J.legB);
    const ankF = lf[lf.length - 1], ankB = lb[lb.length - 1];
    const armFront = rel(r.shoulderF, J.armF), armBack = rel(r.shoulderB, J.armB);
    return {
      legs: [lb, lf], feet: [{ at: { x: ankB.x + 14, y: ankB.y + FOOT_H / 2 }, angle: 0 }, { at: { x: ankF.x + 14, y: ankF.y + FOOT_H / 2 }, angle: 0 }],
      armBack, armFront, handFront: armFront[armFront.length - 1], handBack: armBack[armBack.length - 1],
      bothHands: !!look.prop && !SIDE_CARRY.has(look.prop),
    };
  }
  switch (p) {
    case 'walk':
    case 'run': {
      const run = p === 'run';
      const ph = st.walkPhase * Math.PI * 2;
      const spread = (run ? 0.65 : 0.5) * REF_HW * Math.sin(ph);
      const hF = xf(r, r.hipF);
      const hB = xf(r, r.hipB);
      const fxF = r.cx + 40 + spread;
      const fxB = r.cx - 40 - spread;
      const legF = footLine(hF, fxF, run ? Math.max(0, -Math.sin(ph)) * 70 : 0);
      const legB = footLine(hB, fxB, run ? Math.max(0, Math.sin(ph)) * 70 : 0);
      if (run) {
        // bent knees: push the knee forward/up a little
        const knee = (hip: Pt, ankle: Pt, fwd: number): Pt[] => {
          const mx = (hip.x + ankle.x) / 2 + fwd;
          const my = (hip.y + ankle.y) / 2 - 20;
          return [hip, { x: mx, y: my }, ankle];
        };
        legF.leg = knee(hF, legF.leg[1], 70);
        legB.leg = knee(hB, legB.leg[1], 70);
      }
      legF.foot.angle = 0;
      legB.foot.angle = 0;
      // arms: walk = hang with a little swing; run = bent 90°, pumping
      const swing = Math.sin(ph) * (run ? 0 : 40);
      let armFront: Pt[];
      let armBack: Pt[];
      if (run) {
        armFront = bentArm(r.shoulderF, { x: r.shoulderF.x + 60 + Math.sin(ph) * 90, y: r.shoulderF.y + 200 }, ARM_LEN, 1);
        armBack = bentArm(r.shoulderB, { x: r.shoulderB.x + 20 - Math.sin(ph) * 90, y: r.shoulderB.y + 200 }, ARM_LEN, 1);
      } else {
        armFront = propFront ? bentArm(r.shoulderF, frontCarryHand, ARM_LEN, 1) : hang(r.shoulderF, 1, -swing);
        armBack = hang(r.shoulderB, -1, swing);
      }
      // back leg drawn first
      return {
        legs: [legB.leg, legF.leg],
        feet: [legB.foot, legF.foot],
        armBack,
        armFront,
        handFront: armFront[armFront.length - 1],
        handBack: armBack[armBack.length - 1],
      };
    }
    case 'sit': {
      const kneeF = { x: hipF0.x + 300, y: hipF0.y + 30 };
      const kneeB = { x: hipB0.x + 300, y: hipB0.y + 30 };
      const ankF = { x: kneeF.x + 30, y: r.footY - FOOT_H / 2 };
      const ankB = { x: kneeB.x + 10, y: r.footY - FOOT_H / 2 };
      const armFront = propFront
        ? bentArm(r.shoulderF, frontCarryHand, ARM_LEN, 1)
        : bentArm(r.shoulderF, { x: r.shoulderF.x + 160, y: r.torsoBottom - 20 }, ARM_LEN, -1);
      const armBack = bentArm(r.shoulderB, { x: r.shoulderB.x + 220, y: r.torsoBottom - 40 }, ARM_LEN, -1);
      return {
        legs: [[hipB0, kneeB, ankB], [hipF0, kneeF, ankF]],
        feet: [{ at: { x: ankB.x + 14, y: ankB.y }, angle: 0 }, { at: { x: ankF.x + 14, y: ankF.y }, angle: 0 }],
        armBack,
        armFront,
        handFront: armFront[armFront.length - 1],
      };
    }
    case 'crouch': {
      const kneeF = { x: hipF0.x + 230, y: hipF0.y + 160 };
      const kneeB = { x: hipB0.x - 230, y: hipB0.y + 160 };
      const ankF = { x: r.cx + 200, y: r.footY - FOOT_H / 2 };
      const ankB = { x: r.cx - 200, y: r.footY - FOOT_H / 2 };
      const armFront = propFront
        ? bentArm(r.shoulderF, frontCarryHand, ARM_LEN, 1)
        : [r.shoulderF, { x: r.shoulderF.x + 60, y: r.shoulderF.y + ARM_LEN - 40 }];
      const armBack = [r.shoulderB, { x: r.shoulderB.x - 60, y: r.shoulderB.y + ARM_LEN - 40 }];
      return {
        legs: [[hipB0, kneeB, ankB], [hipF0, kneeF, ankF]],
        feet: [{ at: { x: ankB.x - 14, y: ankB.y }, angle: -0.2 }, { at: { x: ankF.x + 14, y: ankF.y }, angle: 0.2 }],
        armBack,
        armFront,
        handFront: armFront[armFront.length - 1],
      };
    }
    case 'pointR': {
      const { legs, feet } = standLegs();
      const armFront = [r.shoulderF, { x: r.shoulderF.x + ARM_LEN - 20, y: r.shoulderF.y - 10 }];
      const h = armFront[1];
      return {
        legs, feet,
        armBack: hang(r.shoulderB, -1),
        armFront,
        handFront: h,
        pointing: [h, { x: h.x + 46, y: h.y - 6 }],
      };
    }
    case 'pointL': {
      const { legs, feet } = standLegs();
      const armBack = [r.shoulderB, { x: r.shoulderB.x - ARM_LEN + 20, y: r.shoulderB.y - 10 }];
      const h = armBack[1];
      return {
        legs, feet,
        armBack,
        armFront: propFront ? bentArm(r.shoulderF, frontCarryHand, ARM_LEN, 1) : hang(r.shoulderF, 1),
        handFront: propFront ? frontCarryHand : undefined,
        handBack: h,
        pointing: [h, { x: h.x - 46, y: h.y - 6 }],
      };
    }
    case 'armsUp': {
      const { legs, feet } = standLegs();
      const k = ARM_LEN * Math.SQRT1_2;
      return {
        legs, feet,
        armBack: [r.shoulderB, { x: r.shoulderB.x - k, y: r.shoulderB.y - k }],
        armFront: [r.shoulderF, { x: r.shoulderF.x + k, y: r.shoulderF.y - k }],
        handFront: { x: r.shoulderF.x + k, y: r.shoulderF.y - k },
        handBack: { x: r.shoulderB.x - k, y: r.shoulderB.y - k },
      };
    }
    case 'wave': {
      const { legs, feet } = standLegs();
      const hand = { x: r.shoulderF.x + 250, y: r.headC.y - 60 };
      const armFront = bentArm(r.shoulderF, hand, ARM_LEN, -1);
      return { legs, feet, armBack: hang(r.shoulderB, -1), armFront, handFront: hand };
    }
    case 'hold': {
      const { legs, feet } = standLegs();
      const hand = { x: r.cx + 215, y: r.torsoTop + 230 };
      const hand2 = { x: r.cx + 205, y: r.torsoTop + 290 };
      return {
        legs, feet,
        armBack: bentArm(r.shoulderB, hand2, ARM_LEN, -1),
        armFront: bentArm(r.shoulderF, hand, ARM_LEN, 1),
        handFront: hand,
        handBack: hand2,
        bothHands: true,
      };
    }
    case 'lie':
    case 'dead': {
      // body frame still "standing"; the layout rotates it. dead: limbs stick toward +x (screen up).
      const dead = p === 'dead';
      const legF = dead
        ? [hipF0, { x: hipF0.x + 200, y: hipF0.y + 260 }, { x: hipF0.x + 330, y: hipF0.y + 460 }]
        : [hipF0, { x: r.cx + 110, y: r.footY - FOOT_H / 2 }];
      const legB = dead
        ? [hipB0, { x: hipB0.x + 120, y: hipB0.y + 300 }, { x: hipB0.x + 260, y: hipB0.y + 520 }]
        : [hipB0, { x: r.cx - 110, y: r.footY - FOOT_H / 2 }];
      const fF = legF[legF.length - 1];
      const fB = legB[legB.length - 1];
      return {
        legs: [legB, legF],
        feet: [
          { at: { x: fB.x + (dead ? 20 : 0), y: fB.y }, angle: dead ? -1.3 : -0.1 },
          { at: { x: fF.x + (dead ? 20 : 0), y: fF.y }, angle: dead ? -1.3 : 0.1 },
        ],
        armBack: dead
          ? [r.shoulderB, { x: r.shoulderB.x + 330, y: r.shoulderB.y + 150 }]
          : [r.shoulderB, { x: r.shoulderB.x - 30, y: r.shoulderB.y + 380 }],
        armFront: dead
          ? [r.shoulderF, { x: r.shoulderF.x + 380, y: r.shoulderF.y - 120 }]
          : [r.shoulderF, { x: r.shoulderF.x + 30, y: r.shoulderF.y + 380 }],
        horizontal: true,
      };
    }
    case 'stand':
    default: {
      const { legs, feet } = standLegs();
      const armFront = propFront ? bentArm(r.shoulderF, frontCarryHand, ARM_LEN, 1) : hang(r.shoulderF, 1);
      const armBack = hang(r.shoulderB, -1);
      return {
        legs, feet, armBack, armFront,
        handFront: armFront[armFront.length - 1],
        handBack: armBack[armBack.length - 1],
      };
    }
  }
}

// ───────────────────────────── torso ─────────────────────────────
function drawSkirt(ctx: Ctx, r: Rig, look: Look) {
  const yTop = r.torsoBottom - TORSO_H * 0.45;
  const yBot = Math.max(r.torsoBottom + 40, r.footY - 70 - r.dy);
  const w0 = TORSO_W * 0.5, w1 = TORSO_W * 0.78;
  const pts: Pt[] = [
    { x: r.cx - w0, y: yTop }, { x: r.cx + w0, y: yTop },
    ...quad({ x: r.cx + w0 + 10, y: yTop + 60 }, { x: r.cx + w1 - 20, y: (yTop + yBot) / 2 }, { x: r.cx + w1, y: yBot }),
    ...quad({ x: r.cx + w1, y: yBot }, { x: r.cx, y: yBot + 26 }, { x: r.cx - w1, y: yBot }),
    ...quad({ x: r.cx - w1, y: yBot }, { x: r.cx - w1 + 20, y: (yTop + yBot) / 2 }, { x: r.cx - w0 - 10, y: yTop + 60 }),
  ];
  inkShape(ctx, pts, look.legs || look.torso, 0.85);
  const dk = shade(look.legs || look.torso, 0.75);
  for (const k of [-0.45, 0, 0.45]) strokePts(ctx, quad({ x: r.cx + k * w0, y: yTop + 80 }, { x: r.cx + k * (w0 + w1) / 2, y: (yTop + yBot) / 2 }, { x: r.cx + k * w1, y: yBot - 10 }), 8, dk);
}

function drawTorso(ctx: Ctx, r: Rig, look: Look, skirt = true) {
  if (skirt && look.torsoPattern === 'dress') drawSkirt(ctx, r, look);
  const pts = capsulePts(r.cx, r.torsoTop, TORSO_W, TORSO_H);
  fillPts(ctx, pts, look.torso);
  ctx.save();
  pathOf(ctx, pts);
  ctx.clip();
  const x0 = r.cx - TORSO_W / 2;
  const y0 = r.torsoTop;
  const beltY = r.torsoBottom - TORSO_H * 0.24;
  // trousers band in the legs colour (if it differs) + belt line
  if (look.legs && look.legs !== look.torso && look.torsoPattern !== 'poncho') {
    ctx.fillStyle = look.legs;
    ctx.fillRect(x0 - 10, beltY, TORSO_W + 20, TORSO_H);
    line(ctx, x0 - 10, beltY, x0 + TORSO_W + 10, beltY, 14);
  }
  // soft vertical shade on the right third (costume gets slightly darker toward the right)
  const g = ctx.createLinearGradient(r.cx + 40, 0, r.cx + TORSO_W / 2, 0);
  g.addColorStop(0, 'rgba(40,20,60,0)');
  g.addColorStop(1, 'rgba(40,20,60,0.12)');
  ctx.fillStyle = g;
  ctx.fillRect(x0, y0, TORSO_W, TORSO_H);

  const darker = shade(look.torso, 0.72);
  if (look.costume) { drawCostume(ctx, r, look, look.costume); ctx.restore(); silOutline(ctx, pts); return; }
  switch (look.torsoPattern) {
    case 'stripes':
      for (let x = x0 + 22; x < x0 + TORSO_W; x += 46) line(ctx, x, y0, x, y0 + TORSO_H, 12, darker);
      break;
    case 'plaid':
      for (let x = x0 + 30; x < x0 + TORSO_W; x += 60) line(ctx, x, y0, x, y0 + TORSO_H, 10, darker);
      for (let y = y0 + 40; y < y0 + TORSO_H; y += 60) line(ctx, x0, y, x0 + TORSO_W, y, 10, darker);
      for (let x = x0 + 60; x < x0 + TORSO_W; x += 60) line(ctx, x, y0, x, y0 + TORSO_H, 4, 'rgba(255,255,255,0.35)');
      break;
    case 'buttons': {
      // work shirt: pointed collar wings, placket line, buttons, a chest pocket with a flap
      const lighter = shade(look.torso, isDark(look.torso) ? 1.35 : 0.86);
      for (const sd of [-1, 1]) {
        const wing: Pt[] = [{ x: r.cx, y: y0 + 46 }, { x: r.cx + sd * 92, y: y0 + 14 }, { x: r.cx + sd * 66, y: y0 + 120 }];
        fillPts(ctx, wing, lighter);
        strokePts(ctx, wing, 10, INK, true);
      }
      line(ctx, r.cx + 4, y0 + 60, r.cx + 4, beltY - 6, 7, darker);
      for (let i = 0; i < 4; i++) dot(ctx, r.cx + 4, y0 + 150 + i * 72, 11);
      if (!ART_MODE) break;
      const pk = roundRectPts(r.cx - 128, y0 + 150, 76, 82, 10);
      strokePts(ctx, pk, 8, INK, true);
      line(ctx, r.cx - 128, y0 + 172, r.cx - 52, y0 + 172, 7);
      break;
    }
    case 'jacket':
    case 'cardigan': {
      // open jacket over a pale shirt: shirt strip down the middle, front edges, (jacket) collar wings + lapel notch,
      // buttons on one edge, two hip pockets with flaps and a chest pocket
      const cardi = look.torsoPattern === 'cardigan';
      const shirt = '#F4F1E8';
      const half = cardi ? 44 : 52;
      const strip: Pt[] = [
        { x: r.cx - half - 40, y: y0 - 10 }, { x: r.cx + half + 40, y: y0 - 10 },
        { x: r.cx + half, y: y0 + 170 }, { x: r.cx + half - 8, y: beltY },
        { x: r.cx - half + 8, y: beltY }, { x: r.cx - half, y: y0 + 170 },
      ];
      fillPts(ctx, strip, shirt);
      for (const sd of [-1, 1]) strokePts(ctx, [{ x: r.cx + sd * (half + 40), y: y0 - 10 }, { x: r.cx + sd * half, y: y0 + 170 }, { x: r.cx + sd * (half - 8), y: beltY + 4 }], 11);
      if (!cardi) {
        for (const sd of [-1, 1]) {
          const lap: Pt[] = [{ x: r.cx + sd * (half + 38), y: y0 - 6 }, { x: r.cx + sd * (half + 92), y: y0 + 30 }, { x: r.cx + sd * (half + 46), y: y0 + 96 }, { x: r.cx + sd * (half + 6), y: y0 + 150 }];
          fillPts(ctx, lap, darker);
          strokePts(ctx, lap, 9, INK, false);
        }
        // shirt collar peeking out
        for (const sd of [-1, 1]) strokePts(ctx, [{ x: r.cx, y: y0 + 34 }, { x: r.cx + sd * (half + 20), y: y0 + 4 }], 8);
      }
      for (let i = 0; i < 3; i++) dot(ctx, r.cx - half - 30, y0 + 210 + i * 70, 10, cardi ? '#E9D8B0' : INK);
      for (const sd of [-1, 1]) {
        const px = r.cx + sd * 112;
        const pk = roundRectPts(px - 40, beltY - 120, 80, 80, 10);
        strokePts(ctx, pk, 8, INK, true);
        line(ctx, px - 40, beltY - 98, px + 40, beltY - 98, 7);
      }
      if (!cardi) {
        line(ctx, r.cx + 82, y0 + 190, r.cx + 146, y0 + 190, 8);
        strokePts(ctx, quad({ x: r.cx + 96, y: y0 + 190 }, { x: r.cx + 104, y: y0 + 160 }, { x: r.cx + 118, y: y0 + 150 }), 6, '#E7B93A');
      } else {
        // knit ribs along the hem
        for (let x = x0 + 20; x < x0 + TORSO_W; x += 24) line(ctx, x, beltY - 36, x, beltY - 4, 5, darker);
      }
      break;
    }
    case 'wrap': {
      // kimono / wrap top: pale under-collar V, the front panel crossing left-over-right, a wide sash with a cord
      const sash = shade(look.torso, isDark(look.torso) ? 1.6 : 0.55);
      const v: Pt[] = [{ x: r.cx - 96, y: y0 - 10 }, { x: r.cx + 96, y: y0 - 10 }, { x: r.cx - 10, y: y0 + 230 }];
      fillPts(ctx, v, '#F4F1E8');
      strokePts(ctx, [{ x: r.cx + 96, y: y0 - 10 }, { x: r.cx - 10, y: y0 + 230 }, { x: r.cx - 70, y: y0 + 300 }], 12);
      strokePts(ctx, [{ x: r.cx - 96, y: y0 - 10 }, { x: r.cx - 10, y: y0 + 230 }], 12);
      // collar band
      strokePts(ctx, [{ x: r.cx + 70, y: y0 - 10 }, { x: r.cx - 20, y: y0 + 190 }], 18, darker);
      const sy = y0 + TORSO_H * 0.5;
      ctx.fillStyle = sash;
      ctx.fillRect(x0 - 10, sy, TORSO_W + 20, 90);
      line(ctx, x0 - 10, sy, x0 + TORSO_W + 10, sy, 10);
      line(ctx, x0 - 10, sy + 90, x0 + TORSO_W + 10, sy + 90, 10);
      line(ctx, x0, sy + 45, x0 + TORSO_W, sy + 45, 8, '#E7B93A');
      dot(ctx, r.cx + 30, sy + 45, 18, '#E7B93A');
      break;
    }
    case 'dress':
      // high collar + button row
      strokePts(ctx, quad({ x: r.cx - 80, y: y0 + 40 }, { x: r.cx, y: y0 + 70 }, { x: r.cx + 80, y: y0 + 40 }), 10, darker);
      for (let i = 0; i < 5; i++) dot(ctx, r.cx, y0 + 110 + i * 62, 9, '#E9D8B0');
      break;
    case 'lapels': {
      // white shirt triangle + lapel lines + 2 buttons (suit)
      ctx.fillStyle = '#F7F5F0';
      ctx.beginPath();
      ctx.moveTo(r.cx - 70, y0 + 20);
      ctx.lineTo(r.cx + 70, y0 + 20);
      ctx.lineTo(r.cx, y0 + 215);
      ctx.closePath();
      ctx.fill();
      strokePts(ctx, [{ x: r.cx - 70, y: y0 + 20 }, { x: r.cx, y: y0 + 215 }, { x: r.cx + 70, y: y0 + 20 }], 12);
      line(ctx, r.cx, y0 + 215, r.cx, y0 + TORSO_H - 120, 10);
      dot(ctx, r.cx + 1, y0 + 290, 9);
      dot(ctx, r.cx + 1, y0 + 360, 9);
      break;
    }
    case 'vest': {
      // waistcoat over a white shirt: V opening, vertical edges, buttons, watch chain
      ctx.fillStyle = '#F7F5F0';
      ctx.beginPath();
      ctx.moveTo(r.cx - 95, y0 + 10);
      ctx.lineTo(r.cx + 95, y0 + 10);
      ctx.lineTo(r.cx + 40, y0 + 190);
      ctx.lineTo(r.cx - 40, y0 + 190);
      ctx.closePath();
      ctx.fill();
      strokePts(ctx, [{ x: r.cx - 95, y: y0 + 10 }, { x: r.cx - 40, y: y0 + 190 }, { x: r.cx - 40, y: y0 + TORSO_H - 100 }], 11);
      strokePts(ctx, [{ x: r.cx + 95, y: y0 + 10 }, { x: r.cx + 40, y: y0 + 190 }, { x: r.cx + 40, y: y0 + TORSO_H - 100 }], 11);
      for (let i = 0; i < 3; i++) dot(ctx, r.cx, y0 + 230 + i * 70, 9);
      strokePts(ctx, quad({ x: r.cx + 40, y: y0 + 300 }, { x: r.cx + 90, y: y0 + 360 }, { x: r.cx + 130, y: y0 + 300 }), 7, '#E7B93A');
      break;
    }
    case 'belt': {
      line(ctx, x0, beltY, x0 + TORSO_W, beltY, 26);
      ctx.fillStyle = '#E7B93A';
      ctx.fillRect(r.cx - 26, beltY - 22, 52, 44);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 8;
      ctx.strokeRect(r.cx - 26, beltY - 22, 52, 44);
      break;
    }
    case 'poncho': {
      // fringe tick marks row near the top + dark bottom band (red poncho ref)
      for (let x = x0 + 24; x < x0 + TORSO_W; x += 28) line(ctx, x, y0 + 120, x, y0 + 150, 8, '#F7F5F0');
      line(ctx, x0, y0 + 150, x0 + TORSO_W, y0 + 150, 6, '#F7F5F0');
      ctx.fillStyle = look.legs !== look.torso ? look.legs : shade(look.torso, 0.5);
      ctx.fillRect(x0 - 10, r.torsoBottom - 110, TORSO_W + 20, 120);
      line(ctx, x0 - 10, r.torsoBottom - 110, x0 + TORSO_W + 10, r.torsoBottom - 110, 12);
      for (let x = x0 + 30; x < x0 + TORSO_W; x += 40) line(ctx, x, r.torsoBottom - 100, x, r.torsoBottom - 80, 8, '#E7B93A');
      break;
    }
    case 'plain':
    default:
      break;
  }
  // accessories that live on the torso
  const acc = look.accessories;
  if (acc.has('apron')) {
    const ap = roundRectPts(r.cx - 120, y0 + 150, 240, TORSO_H - 170, 40);
    fillPts(ctx, ap, '#F4F1EA');
    strokePts(ctx, ap, 10, INK, true);
    line(ctx, r.cx - 60, y0 + 150, r.cx - 150, y0 - 10, 10);
    line(ctx, r.cx + 60, y0 + 150, r.cx + 150, y0 - 10, 10);
  }
  if (acc.has('tie')) {
    ctx.fillStyle = '#C8323A';
    ctx.beginPath();
    ctx.moveTo(r.cx - 22, y0 + 40);
    ctx.lineTo(r.cx + 22, y0 + 40);
    ctx.lineTo(r.cx + 36, y0 + 290);
    ctx.lineTo(r.cx, y0 + 330);
    ctx.lineTo(r.cx - 36, y0 + 290);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 10;
    ctx.lineJoin = 'round';
    ctx.stroke();
    for (let y = y0 + 100; y < y0 + 290; y += 50) line(ctx, r.cx - 30, y, r.cx + 30, y - 18, 7, shade('#C8323A', 0.55));
  }
  if (acc.has('bowtie')) {
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.moveTo(r.cx, y0 + 70);
    ctx.lineTo(r.cx - 70, y0 + 35);
    ctx.lineTo(r.cx - 70, y0 + 105);
    ctx.closePath();
    ctx.moveTo(r.cx, y0 + 70);
    ctx.lineTo(r.cx + 70, y0 + 35);
    ctx.lineTo(r.cx + 70, y0 + 105);
    ctx.closePath();
    ctx.fill();
    dot(ctx, r.cx, y0 + 70, 16);
  }
  if (acc.has('scarf')) {
    ctx.fillStyle = '#D83A3A';
    ctx.fillRect(x0 - 10, y0 + 10, TORSO_W + 20, 90);
    line(ctx, x0 - 10, y0 + 100, x0 + TORSO_W + 10, y0 + 100, 10);
    const tail = roundRectPts(r.cx + 60, y0 + 60, 70, 230, 30);
    fillPts(ctx, tail, '#D83A3A');
    strokePts(ctx, tail, 10, INK, true);
    for (let i = 0; i < 4; i++) line(ctx, r.cx + 70 + i * 15, y0 + 290, r.cx + 70 + i * 15, y0 + 320, 8);
  }
  if (acc.has('sling')) {
    // survivor2: a white cloth sling across the chest (strap from the far shoulder)
    line(ctx, x0 + TORSO_W - 40, y0 + 10, r.cx - 40, y0 + 260, 34, '#f4f1ea');
    line(ctx, x0 + TORSO_W - 40, y0 + 10, r.cx - 40, y0 + 260, 6, INK);
    const sl: Pt[] = [{ x: x0 - 6, y: y0 + 230 }, { x: x0 + TORSO_W - 30, y: y0 + 210 }, { x: r.cx + 10, y: y0 + 400 }];
    fillPts(ctx, sl, '#f4f1ea');
    strokePts(ctx, sl, 10, INK, true);
    line(ctx, x0 + 30, y0 + 250, x0 + TORSO_W - 70, y0 + 240, 6, '#c9c0b0');
    line(ctx, x0 + 70, y0 + 290, x0 + TORSO_W - 110, y0 + 285, 6, '#c9c0b0');
  }
  if (acc.has('badge')) {
    ctx.fillStyle = '#F7F5F0';
    ctx.fillRect(r.cx - 120, y0 + 170, 70, 50);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 8;
    ctx.strokeRect(r.cx - 120, y0 + 170, 70, 50);
    line(ctx, r.cx - 108, y0 + 205, r.cx - 62, y0 + 205, 5);
    line(ctx, r.cx - 85, y0 + 170, r.cx - 20, y0 - 10, 7, '#2F4A9A');
  }
  ctx.restore();
  silOutline(ctx, pts);
}

// ───────────────────────────── role costumes (DESIGN_DETAIL D1, BUILD_LESSONS #28) ─────────────────────────────
// RicksClips-style garments: several layered pieces (shirt, waistcoat / tunic, collar, lapels, pocket flaps, belts,
// straps, buttons, chains), each ink-outlined, each with a light / mid / shadow tone and a fabric texture. Painted in
// torso reference px inside the clipped capsule: x0..x0+340, y0..y0+560 (the head hides the top 40 px).
function fabric(ctx: Ctx, x0: number, y0: number, w: number, h: number, kind: 'wool' | 'knit' | 'cotton' | 'pin', col: string, seed = 1) {
  ctx.save();
  let k = seed * 9301 + 49297;
  const rnd = () => ((k = (k * 9301 + 49297) % 233280) / 233280);
  if (kind === 'pin') for (let x = x0 + 14; x < x0 + w; x += 26) line(ctx, x, y0, x, y0 + h, 3, 'rgba(255,255,255,0.22)');
  if (kind === 'knit') {
    for (let x = x0 + 10; x < x0 + w; x += 22) for (let y = y0; y < y0 + h; y += 18) {
      strokePts(ctx, [{ x, y }, { x: x + 6, y: y + 9 }, { x: x + 12, y }], 4, shade(col, 0.82));
    }
  }
  const n = kind === 'cotton' ? 140 : 320;
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = rnd() > 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)';
    ctx.fillRect(x0 + rnd() * w, y0 + rnd() * h, 3 + rnd() * 5, 2);
  }
  ctx.restore();
}
function poly(ctx: Ctx, pts: [number, number][], fill: string, ink = 9) {
  const P = pts.map(([x, y]) => ({ x, y }));
  fillPts(ctx, P, fill); strokePts(ctx, P, ink, INK, true);
}
function button(ctx: Ctx, x: number, y: number, r: number, col: string) {
  dot(ctx, x, y, r + 4); dot(ctx, x, y, r, col); dot(ctx, x - r * 0.3, y - r * 0.3, r * 0.35, 'rgba(255,255,255,0.7)');
}
function pocketFlap(ctx: Ctx, x: number, y: number, w: number, col: string, btn?: string) {
  poly(ctx, [[x - w / 2, y], [x + w / 2, y], [x + w / 2 - 6, y + 34], [x, y + 46], [x - w / 2 + 6, y + 34]], shade(col, 0.88), 7);
  line(ctx, x - w / 2, y + 60, x - w / 2, y + 120, 5, shade(col, 0.6)); line(ctx, x + w / 2, y + 60, x + w / 2, y + 120, 5, shade(col, 0.6));
  if (btn) button(ctx, x, y + 30, 8, btn);
}
function drawCostume(ctx: Ctx, r: Rig, look: Look, kind: string) {
  const cx = r.cx, x0 = cx - TORSO_W / 2, y0 = r.torsoTop, W = TORSO_W, H = TORSO_H, B = r.torsoBottom;
  const GOLD = '#E9B949';
  if (kind === 'banker') {
    // charcoal pinstripe three-piece: trousers band, open jacket with peaked lapels, grey double-breasted waistcoat,
    // wing-collar shirt, burgundy cravat with pearl pin, gold watch chain + fob, red pocket square, pocket flaps
    const jacket = '#2B2E3A', vest = '#6E717C', trou = '#23252E';
    ctx.fillStyle = trou; ctx.fillRect(x0 - 10, B - 120, W + 20, 130); fabric(ctx, x0, B - 120, W, 120, 'pin', trou, 3);
    ctx.fillStyle = jacket; ctx.fillRect(x0 - 10, y0, W + 20, B - y0 - 118); fabric(ctx, x0, y0, W, H - 118, 'pin', jacket, 1);
    poly(ctx, [[cx - 92, y0 + 20], [cx + 92, y0 + 20], [cx + 70, B - 125], [cx - 70, B - 125]], vest, 9);
    fabric(ctx, cx - 90, y0 + 20, 180, H - 150, 'wool', vest, 2);
    poly(ctx, [[cx - 62, y0 + 20], [cx + 62, y0 + 20], [cx, y0 + 170]], '#F6F2EA', 8);           // shirt V
    poly(ctx, [[cx - 62, y0 + 22], [cx - 18, y0 + 58], [cx - 36, y0 + 80]], '#FFFFFF', 6);        // wing collar
    poly(ctx, [[cx + 62, y0 + 22], [cx + 18, y0 + 58], [cx + 36, y0 + 80]], '#FFFFFF', 6);
    poly(ctx, [[cx - 22, y0 + 60], [cx + 22, y0 + 60], [cx + 30, y0 + 150], [cx, y0 + 172], [cx - 30, y0 + 150]], '#7A1E2C', 7); // cravat
    dot(ctx, cx, y0 + 110, 9, '#F4F0E6');
    for (let i = 0; i < 3; i++) { button(ctx, cx - 34, y0 + 215 + i * 62, 9, GOLD); button(ctx, cx + 34, y0 + 215 + i * 62, 9, GOLD); }
    strokePts(ctx, quad({ x: cx - 34, y: y0 + 280 }, { x: cx - 80, y: y0 + 330 }, { x: cx - 92, y: y0 + 285 }), 6, GOLD);  // watch chain
    dot(ctx, cx - 94, y0 + 292, 11, GOLD); dot(ctx, cx - 94, y0 + 292, 5, '#F7E6A0');
    // jacket lapels (peaked) over the waistcoat edges
    poly(ctx, [[cx - 100, y0 + 10], [cx - 60, y0 + 30], [cx - 72, y0 + 250], [cx - 118, y0 + 150], [cx - 150, y0 + 90]], shade(jacket, 1.25), 9);
    poly(ctx, [[cx + 100, y0 + 10], [cx + 60, y0 + 30], [cx + 72, y0 + 250], [cx + 118, y0 + 150], [cx + 150, y0 + 90]], shade(jacket, 1.25), 9);
    poly(ctx, [[cx + 112, y0 + 170], [cx + 150, y0 + 170], [cx + 146, y0 + 186], [cx + 114, y0 + 186]], '#202330', 5);
    poly(ctx, [[cx + 116, y0 + 154], [cx + 128, y0 + 140], [cx + 140, y0 + 156], [cx + 148, y0 + 146], [cx + 146, y0 + 172], [cx + 116, y0 + 172]], '#C8323A', 5); // pocket square
    line(ctx, x0 + 18, B - 170, x0 + 82, B - 170, 7); line(ctx, x0 + W - 82, B - 170, x0 + W - 18, B - 170, 7);  // hip pocket flaps
    line(ctx, x0 - 10, B - 118, x0 + W + 10, B - 118, 10);
  } else if (kind === 'clerk') {
    // junior teller: blue-striped cotton shirt, brown knit sweater vest with ribbed V and hem, black bow tie,
    // pencil + notepad in the shirt pocket, brass name pin, brown trousers with a thin belt
    const shirt = '#EEF0F4', knit = '#8A5A36', trou = '#4A3A2A';
    ctx.fillStyle = shirt; ctx.fillRect(x0 - 10, y0, W + 20, H); fabric(ctx, x0, y0, W, H, 'cotton', shirt, 4);
    for (let x = x0 + 12; x < x0 + W; x += 22) line(ctx, x, y0, x, y0 + H, 4, '#7A92D0');
    ctx.fillStyle = trou; ctx.fillRect(x0 - 10, B - 110, W + 20, 120); fabric(ctx, x0, B - 110, W, 110, 'wool', trou, 5);
    poly(ctx, [[x0 - 20, y0 + 60], [cx - 40, y0 + 60], [cx, y0 + 220], [cx + 40, y0 + 60], [x0 + W + 20, y0 + 60], [x0 + W + 20, B - 120], [x0 - 20, B - 120]], knit, 9);
    fabric(ctx, x0, y0 + 60, W, H - 180, 'knit', knit, 6);
    strokePts(ctx, [{ x: cx - 40, y: y0 + 60 }, { x: cx, y: y0 + 220 }, { x: cx + 40, y: y0 + 60 }], 22, shade(knit, 0.7));       // ribbed V
    strokePts(ctx, [{ x: cx - 40, y: y0 + 60 }, { x: cx, y: y0 + 220 }, { x: cx + 40, y: y0 + 60 }], 6, INK);
    ctx.fillStyle = shade(knit, 0.72); ctx.fillRect(x0 - 20, B - 160, W + 40, 40);
    for (let x = x0; x < x0 + W; x += 14) line(ctx, x, B - 160, x, B - 120, 3, shade(knit, 0.55));
    line(ctx, x0 - 20, B - 160, x0 + W + 20, B - 160, 8); line(ctx, x0 - 20, B - 120, x0 + W + 20, B - 120, 8);
    poly(ctx, [[cx - 44, y0 + 84], [cx - 6, y0 + 100], [cx - 44, y0 + 118]], '#1C1620', 5); poly(ctx, [[cx + 44, y0 + 84], [cx + 6, y0 + 100], [cx + 44, y0 + 118]], '#1C1620', 5); // bow tie
    dot(ctx, cx, y0 + 101, 10, '#2A2228');
    poly(ctx, [[cx + 70, y0 + 120], [cx + 130, y0 + 120], [cx + 130, y0 + 190], [cx + 70, y0 + 190]], shade(knit, 1.15), 6); // vest pocket
    line(ctx, cx + 84, y0 + 70, cx + 84, y0 + 140, 9, '#F2C430'); dot(ctx, cx + 84, y0 + 68, 5, '#F4A0A8');  // pencil
    poly(ctx, [[cx - 120, y0 + 130], [cx - 72, y0 + 130], [cx - 72, y0 + 150], [cx - 120, y0 + 150]], GOLD, 5); // name pin
    line(ctx, x0 - 10, B - 110, x0 + W + 10, B - 110, 12);
  } else if (kind === 'guard') {
    // bank guard: navy wool tunic, high stand collar with gold piping, gold button row, two chest pockets with flaps,
    // brass star badge, leather Sam Browne belt with diagonal strap + buckle, whistle chain, shoulder boards
    const navy = '#253458', leather = '#5A3420';
    ctx.fillStyle = navy; ctx.fillRect(x0 - 10, y0, W + 20, H); fabric(ctx, x0, y0, W, H, 'wool', navy, 7);
    poly(ctx, [[cx - 70, y0 + 40], [cx + 70, y0 + 40], [cx + 66, y0 + 96], [cx - 66, y0 + 96]], shade(navy, 0.85), 8);  // stand collar
    line(ctx, cx - 66, y0 + 92, cx + 66, y0 + 92, 6, GOLD);
    poly(ctx, [[x0 - 10, y0 + 60], [x0 + 70, y0 + 52], [x0 + 74, y0 + 80], [x0 - 10, y0 + 90]], shade(navy, 1.2), 6);   // shoulder boards
    poly(ctx, [[x0 + W + 10, y0 + 60], [x0 + W - 70, y0 + 52], [x0 + W - 74, y0 + 80], [x0 + W + 10, y0 + 90]], shade(navy, 1.2), 6);
    line(ctx, cx, y0 + 72, cx, B - 20, 6, shade(navy, 0.7));
    for (let i = 0; i < 5; i++) button(ctx, cx, y0 + 110 + i * 64, 10, GOLD);
    pocketFlap(ctx, cx - 88, y0 + 120, 92, navy, GOLD); pocketFlap(ctx, cx + 88, y0 + 120, 92, navy, GOLD);
    // star badge on the left chest
    const sx = cx + 88, sy = y0 + 230, pts: Pt[] = [];
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? 14 : 34; pts.push({ x: sx + Math.cos(a) * rr, y: sy + Math.sin(a) * rr }); }
    fillPts(ctx, pts, GOLD); strokePts(ctx, pts, 6, INK, true); dot(ctx, sx, sy, 8, '#F7E6A0');
    strokePts(ctx, quad({ x: cx - 60, y: y0 + 160 }, { x: cx - 30, y: y0 + 230 }, { x: cx - 4, y: y0 + 180 }), 5, '#C8CCD4'); // whistle chain
    // Sam Browne: diagonal strap + belt + buckle
    poly(ctx, [[x0 + W - 40, y0 + 40], [x0 + W - 10, y0 + 50], [x0 + 60, B - 140], [x0 + 30, B - 150]], leather, 7);
    ctx.fillStyle = leather; ctx.fillRect(x0 - 10, B - 160, W + 20, 46);
    line(ctx, x0 - 10, B - 160, x0 + W + 10, B - 160, 8); line(ctx, x0 - 10, B - 114, x0 + W + 10, B - 114, 8);
    poly(ctx, [[cx - 30, B - 166], [cx + 30, B - 166], [cx + 30, B - 108], [cx - 30, B - 108]], GOLD, 7);
    poly(ctx, [[cx - 14, B - 152], [cx + 14, B - 152], [cx + 14, B - 122], [cx - 14, B - 122]], leather, 5);
    ctx.fillStyle = '#1E2236'; ctx.fillRect(x0 - 10, B - 108, W + 20, 120);
  } else if (kind === 'hoodie') {
    // hero, a phone-addicted twenty-something: mustard hoodie (kangaroo pocket, drawstrings, ribbed cuffs, a small
    // cat-meme print), headphones round the neck, faded jeans band with a phone-shaped bulge
    const hood = '#E3A93A', jean = '#3E5E8E';
    ctx.fillStyle = hood; ctx.fillRect(x0 - 10, y0, W + 20, H); fabric(ctx, x0, y0, W, H, 'cotton', hood, 11);
    poly(ctx, [[cx - 110, y0 + 30], [cx - 40, y0 + 120], [cx, y0 + 100], [cx + 40, y0 + 120], [cx + 110, y0 + 30], [cx + 70, y0 + 20], [cx, y0 + 70], [cx - 70, y0 + 20]], shade(hood, 0.8), 8);   // hood folded at the neck
    line(ctx, cx - 22, y0 + 110, cx - 28, y0 + 210, 6, '#F4EDE0'); line(ctx, cx + 22, y0 + 110, cx + 28, y0 + 210, 6, '#F4EDE0');      // drawstrings
    dot(ctx, cx - 28, y0 + 214, 7, '#F4EDE0'); dot(ctx, cx + 28, y0 + 214, 7, '#F4EDE0');
    strokePts(ctx, quad({ x: cx - 120, y: y0 + 90 }, { x: cx, y: y0 + 150 }, { x: cx + 120, y: y0 + 90 }), 18, '#2A2A30');               // headphones band
    dot(ctx, cx - 122, y0 + 96, 26, '#2A2A30'); dot(ctx, cx + 122, y0 + 96, 26, '#2A2A30'); dot(ctx, cx - 122, y0 + 96, 12, '#C8323A'); dot(ctx, cx + 122, y0 + 96, 12, '#C8323A');
    // cat-meme print: a black cat face on a white square
    poly(ctx, [[cx - 50, y0 + 240], [cx + 50, y0 + 240], [cx + 50, y0 + 320], [cx - 50, y0 + 320]], '#F4F0E6', 6);
    dot(ctx, cx, y0 + 288, 26, '#1C1620'); poly(ctx, [[cx - 24, y0 + 274], [cx - 18, y0 + 252], [cx - 6, y0 + 268]], '#1C1620', 3); poly(ctx, [[cx + 24, y0 + 274], [cx + 18, y0 + 252], [cx + 6, y0 + 268]], '#1C1620', 3);
    dot(ctx, cx - 9, y0 + 284, 5, '#F2D23A'); dot(ctx, cx + 9, y0 + 284, 5, '#F2D23A');
    poly(ctx, [[cx - 100, B - 210], [cx + 100, B - 210], [cx + 120, B - 140], [cx - 120, B - 140]], shade(hood, 0.86), 7);                // kangaroo pocket
    ctx.fillStyle = shade(hood, 0.7); ctx.fillRect(x0 - 10, B - 140, W + 20, 26);                                                             // ribbed hem
    for (let x = x0; x < x0 + W; x += 12) line(ctx, x, B - 140, x, B - 114, 3, shade(hood, 0.55));
    ctx.fillStyle = jean; ctx.fillRect(x0 - 10, B - 114, W + 20, 130); fabric(ctx, x0, B - 114, W, 114, 'cotton', jean, 12);
    line(ctx, cx, B - 114, cx, B, 5, '#C88A3A');                                                                                             // jeans seam stitch
    line(ctx, x0 - 10, B - 114, x0 + W + 10, B - 114, 9);
  } else if (kind === 'granny') {
    // granny on the bench: lavender knit cardigan over a floral dress, pearl necklace, brooch, handbag strap
    const card = '#A88CC8', dress = '#F2D8E0';
    ctx.fillStyle = dress; ctx.fillRect(x0 - 10, y0, W + 20, H);
    for (let i = 0; i < 40; i++) { const fx = x0 + ((i * 73) % W), fy = y0 + ((i * 131) % H); dot(ctx, fx, fy, 9, i % 2 ? '#D8507A' : '#6AA86A'); dot(ctx, fx, fy, 3, '#F8E8A0'); }
    poly(ctx, [[x0 - 20, y0 + 20], [cx - 50, y0 + 20], [cx - 30, B - 20], [x0 - 20, B - 20]], card, 8); poly(ctx, [[x0 + W + 20, y0 + 20], [cx + 50, y0 + 20], [cx + 30, B - 20], [x0 + W + 20, B - 20]], card, 8);
    fabric(ctx, x0, y0, cx - 40 - x0, H, 'knit', card, 13); fabric(ctx, cx + 40, y0, x0 + W - cx - 40, H, 'knit', card, 14);
    for (let i = 0; i < 4; i++) button(ctx, cx - 40, y0 + 160 + i * 80, 9, '#F4F0E6');
    for (let i = 0; i < 11; i++) { const a = Math.PI * (0.15 + 0.7 * i / 10); dot(ctx, cx + Math.cos(a) * 70, y0 + 60 + Math.sin(a) * 70, 9, '#FFFFFF'); }   // pearls
    dot(ctx, cx + 80, y0 + 170, 14, '#E9B949'); dot(ctx, cx + 80, y0 + 170, 6, '#C8323A');                                                  // brooch
    line(ctx, x0 + W - 30, y0 + 20, x0 + 40, B - 60, 10, '#7A4A2A');                                                                         // handbag strap
  } else if (kind === 'jogger') {
    // jogger: red track jacket with white side stripes, zip, collar, sweat patch, a headband (hat), wristband
    const red = '#D2363A';
    ctx.fillStyle = red; ctx.fillRect(x0 - 10, y0, W + 20, H); fabric(ctx, x0, y0, W, H, 'cotton', red, 15);
    for (const sx of [x0 + 18, x0 + 34, x0 + W - 34, x0 + W - 18]) line(ctx, sx, y0, sx, B, 8, '#F4F0E6');
    poly(ctx, [[cx - 70, y0 + 40], [cx + 70, y0 + 40], [cx + 60, y0 + 100], [cx - 60, y0 + 100]], shade(red, 0.8), 7);
    line(ctx, cx, y0 + 100, cx, B - 110, 7, '#C8CCD4'); dot(ctx, cx, y0 + 130, 9, '#C8CCD4');
    poly(ctx, [[cx - 40, y0 + 150], [cx + 40, y0 + 150], [cx + 30, y0 + 220], [cx - 30, y0 + 220]], 'rgba(120,20,30,0.45)', 0);       // sweat patch
    ctx.fillStyle = '#20242E'; ctx.fillRect(x0 - 10, B - 110, W + 20, 120); for (const sx of [x0 + 18, x0 + W - 18]) line(ctx, sx, B - 110, sx, B, 8, '#F4F0E6');
    line(ctx, x0 - 10, B - 110, x0 + W + 10, B - 110, 9);
  } else if (kind === 'varsity') {
    // teen filming: green varsity jacket (cream sleeves edge, ribbed collar + hem, chenille letter), white tee
    const g = '#2E6A4A';
    ctx.fillStyle = '#F4F2EC'; ctx.fillRect(x0 - 10, y0, W + 20, H);
    poly(ctx, [[x0 - 20, y0 + 10], [cx - 40, y0 + 10], [cx - 40, B - 110], [x0 - 20, B - 110]], g, 8); poly(ctx, [[x0 + W + 20, y0 + 10], [cx + 40, y0 + 10], [cx + 40, B - 110], [x0 + W + 20, B - 110]], g, 8);
    fabric(ctx, x0, y0, W, H - 110, 'wool', g, 16);
    for (const [ax, bx] of [[x0 - 20, cx - 40], [cx + 40, x0 + W + 20]]) { ctx.fillStyle = '#E8C860'; ctx.fillRect(ax, B - 150, bx - ax, 40); for (let x = ax; x < bx; x += 10) line(ctx, x, B - 150, x, B - 110, 3, '#B8962A'); }
    for (let i = 0; i < 4; i++) button(ctx, cx - 40, y0 + 120 + i * 70, 9, '#E8C860');
    ctx.font = 'bold 120px Georgia'; ctx.fillStyle = '#E8C860'; ctx.strokeStyle = INK; ctx.lineWidth = 8; ctx.strokeText('B', cx - 150, y0 + 260); ctx.fillText('B', cx - 150, y0 + 260);
    ctx.fillStyle = '#3A3A44'; ctx.fillRect(x0 - 10, B - 110, W + 20, 120); line(ctx, x0 - 10, B - 110, x0 + W + 10, B - 110, 9);
  } else if (kind === 'vendor') {
    // hot-dog vendor: red-and-white striped shirt, white apron with ketchup stains + pocket, bow tie
    ctx.fillStyle = '#F4F0E6'; ctx.fillRect(x0 - 10, y0, W + 20, H);
    for (let x = x0 + 10; x < x0 + W; x += 40) { ctx.fillStyle = '#C8323A'; ctx.fillRect(x, y0, 18, H); }
    const ap = roundRectPts(cx - 130, y0 + 140, 260, H - 150, 30); fillPts(ctx, ap, '#FBFAF6'); strokePts(ctx, ap, 9, INK, true);
    for (let i = 0; i < 5; i++) dot(ctx, cx - 60 + i * 30, y0 + 260 + (i % 2) * 40, 9 + (i % 3) * 3, 'rgba(200,40,40,0.7)');
    poly(ctx, [[cx - 50, y0 + 330], [cx + 50, y0 + 330], [cx + 50, y0 + 400], [cx - 50, y0 + 400]], '#F0EEE6', 6);
    line(ctx, cx - 130, y0 + 140, cx - 150, y0 + 30, 8); line(ctx, cx + 130, y0 + 140, cx + 150, y0 + 30, 8);
    poly(ctx, [[cx - 40, y0 + 84], [cx - 4, y0 + 100], [cx - 40, y0 + 116]], '#1C1620', 5); poly(ctx, [[cx + 40, y0 + 84], [cx + 4, y0 + 100], [cx + 40, y0 + 116]], '#1C1620', 5);
  }
  // shared form shading: shadow side, top light, bottom occlusion
  const g = ctx.createLinearGradient(x0, 0, x0 + W, 0);
  g.addColorStop(0, 'rgba(255,240,220,0.12)'); g.addColorStop(0.4, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(15,10,30,0.3)');
  ctx.fillStyle = g; ctx.fillRect(x0 - 10, y0, W + 20, H);
}

// ───────────────────────────── head, hair, hats ─────────────────────────────
function headPts(r: Rig, look: Look): Pt[] {
  const rx = REF_HW / 2;
  const ry = rx / look.headRatio;
  const n = 96;
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    let k = 1;
    for (let j = 0; j < 4; j++) k += look.wobble.a[j] * Math.cos((j + 2) * t + look.wobble.p[j]);
    k += 0.012 * Math.sin(t); // bottom slightly heavier (sin > 0 is down in canvas coords)
    pts.push({ x: r.headC.x + rx * k * Math.cos(t), y: r.headC.y + ry * k * Math.sin(t) });
  }
  return pts;
}

function drawHead(ctx: Ctx, r: Rig, look: Look) {
  const pts = headPts(r, look);
  fillPts(ctx, pts, look.skin);
  // inner shadow / AO on the right-bottom edge: ~6 % darker, violet tinted, ~35 px wide
  ctx.save();
  pathOf(ctx, pts);
  ctx.clip();
  const rx = REF_HW / 2;
  const g = ctx.createRadialGradient(r.headC.x - 40, r.headC.y - 50, rx * 0.55, r.headC.x + 20, r.headC.y + 20, rx * 1.05);
  g.addColorStop(0, 'rgba(120,80,140,0)');
  g.addColorStop(0.8, 'rgba(120,80,140,0.02)');
  g.addColorStop(1, 'rgba(110,70,135,0.16)');
  ctx.fillStyle = g;
  ctx.fillRect(r.headC.x - rx * 1.2, r.headC.y - rx * 1.2, rx * 2.4, rx * 2.4);
  ctx.restore();
  silOutline(ctx, pts);
}

/** point on the head ellipse at canvas angle t (0 = right, -90° = top), scaled by k */
function headAt(r: Rig, look: Look, t: number, k = 1): Pt {
  const rx = REF_HW / 2;
  const ry = rx / look.headRatio;
  return { x: r.headC.x + rx * k * Math.cos(t), y: r.headC.y + ry * k * Math.sin(t) };
}
const D = Math.PI / 180;

function drawHair(ctx: Ctx, r: Rig, look: Look) {
  if (!look.hair) return;
  const col = look.hair;
  const hh = REF_HW / look.headRatio;
  const top = r.headC.y - hh / 2;
  const style = look.hairStyle;
  const arc = (a0: number, a1: number, k = 1.03, n = 36): Pt[] => {
    const out: Pt[] = [];
    for (let i = 0; i <= n; i++) out.push(headAt(r, look, (a0 + ((a1 - a0) * i) / n) * D, k));
    return out;
  };
  if (ART_MODE && look.hat !== 'none' && look.hat !== 'headband' && look.hat !== 'veil' && look.hat !== 'crown') {
    // under a hat the reference shows hair only as tufts beside and behind the head, poking 8-12 % of the head width
    // outside the outline just under the brim (TRU_38, i4h soldiers); the cap would only show as a band under the brim
    const big = style === 'curly' || style === 'bun' ? 1.25 : 1;
    for (const [a0, a1] of [[200, 236], [304, 340]] as const) {
      const n = 4;
      const out: Pt[] = [];
      for (let i = 0; i <= 2 * n; i++) {
        const a = a0 + ((a1 - a0) * i) / (2 * n);
        out.push(headAt(r, look, a * D, i % 2 ? 1.06 : 1.0 + 0.11 * big * Math.sin((Math.PI * i) / (2 * n)) ** 0.5));
      }
      const back = [...Array(9).keys()].map((i) => headAt(r, look, (a1 - ((a1 - a0) * i) / 8) * D, 0.86));
      inkShape(ctx, [...out, ...back], col, 0.75);
      if (style === 'bun' && a0 === 200) {
        const bun = ellipsePts(r.headC.x - 0.47 * REF_HW, top + 0.36 * hh, 62, 58, 32);
        inkShape(ctx, bun, col, 0.8);
      }
    }
    return;
  }
  // art mode: the hairline sits high so the brows (the reference's main acting tool) stay on bare skin
  const HL = (v: number) => (ART_MODE ? v * 0.55 : v);
  let cap: Pt[] = [];
  switch (style) {
    case 'bowl': {
      // cap over the top ~42 %, straight-ish fringe, small side flaps
      const upper = arc(188, 352);
      const right = upper[upper.length - 1];
      const left = upper[0];
      const fringeY = top + hh * HL(0.40);
      const lower = [
        { x: right.x + 6, y: right.y + 60 },
        ...quad({ x: right.x - 20, y: fringeY + 10 }, { x: r.headC.x + 40, y: fringeY - 30 }, { x: left.x + 20, y: fringeY + 10 }),
        { x: left.x - 6, y: left.y + 60 },
      ];
      cap = [...upper, ...lower];
      break;
    }
    case 'side': {
      const upper = arc(196, 350);
      const right = upper[upper.length - 1];
      const left = upper[0];
      const lower = quad({ x: right.x, y: top + hh * HL(0.36) }, { x: r.headC.x + 60, y: top + hh * HL(0.25) }, { x: left.x, y: top + hh * HL(0.20) });
      cap = [...upper, ...lower];
      break;
    }
    case 'quiff': {
      const upper = arc(196, 350);
      // forward-up bump on the facing side
      const bump = [
        headAt(r, look, 300 * D, 1.03),
        { x: r.headC.x + 40, y: top - 70 },
        { x: r.headC.x + 150, y: top - 95 },
        { x: r.headC.x + 230, y: top - 20 },
        headAt(r, look, 335 * D, 1.03),
      ];
      const i0 = upper.findIndex((p) => p.x > r.headC.x + 10);
      const left = upper[0];
      const lower = quad({ x: headAt(r, look, 350 * D, 1.03).x, y: top + hh * HL(0.33) }, { x: r.headC.x + 40, y: top + hh * HL(0.22) }, { x: left.x, y: top + hh * HL(0.22) });
      cap = [...upper.slice(0, i0), ...bump, headAt(r, look, 350 * D, 1.03), ...lower];
      break;
    }
    case 'swoosh': {
      const upper = arc(200, 352);
      const right = upper[upper.length - 1];
      const left = upper[0];
      const lower = quad({ x: right.x, y: top + hh * HL(0.38) }, { x: r.headC.x + 20, y: top + hh * HL(0.27) }, { x: left.x, y: top + hh * HL(0.24) });
      cap = [...upper, ...lower];
      // antenna swoosh on the back-top (channel signature): a tapering lobe curling up and back
      const base = headAt(r, look, 262 * D, 1.0);
      const lobe = [
        { x: base.x - 60, y: base.y + 10 },
        { x: base.x - 110, y: base.y - 70 },
        { x: base.x - 150, y: base.y - 150 },
        { x: base.x - 135, y: base.y - 165 },
        { x: base.x - 95, y: base.y - 110 },
        { x: base.x - 40, y: base.y - 40 },
        { x: base.x + 10, y: base.y + 8 },
      ];
      inkShape(ctx, lobe, col, 0.8);
      break;
    }
    case 'bun': {
      const upper = arc(200, 340);
      const lower = arc(340, 200, ART_MODE ? 0.9 : 0.80, 36); // follow the head ellipse inside → a crescent
      cap = [...upper, ...lower];
      const bun = ellipsePts(r.headC.x - 110, top - 30, 78, 72, 40);
      inkShape(ctx, bun, col, 0.8);
      // bun highlight ring
      ring(ctx, r.headC.x - 110, top - 30, 38, 8, shade(col, 0.7));
      break;
    }
    case 'curly': {
      const n = 48;
      const upper: Pt[] = [];
      for (let i = 0; i <= n; i++) {
        const t = (192 + (156 * i) / n) * D;
        upper.push(headAt(r, look, t, 1.04 + 0.05 * Math.abs(Math.sin(t * 5.5))));
      }
      const right = upper[upper.length - 1];
      const left = upper[0];
      const lower = quad({ x: right.x, y: top + hh * HL(0.34) }, { x: r.headC.x, y: top + hh * HL(0.30) }, { x: left.x, y: top + hh * HL(0.34) });
      cap = [...upper, ...lower];
      break;
    }
  }
  inkShape(ctx, cap, col, 0.85);
  // 2-3 strand lines inside the cap
  const dark = shade(col, 0.6);
  if (style === 'bowl' || style === 'side' || style === 'swoosh' || style === 'quiff') {
    strokePts(ctx, quad({ x: r.headC.x - 20, y: top + 25 }, { x: r.headC.x + 60, y: top + 40 }, { x: r.headC.x + 120, y: top + hh * 0.2 }), 9, dark);
    strokePts(ctx, quad({ x: r.headC.x - 120, y: top + 60 }, { x: r.headC.x - 60, y: top + 30 }, { x: r.headC.x - 10, y: top + 20 }), 9, dark);
  } else if (style === 'curly') {
    for (let i = 0; i < 3; i++) ring(ctx, r.headC.x - 120 + i * 120, top + 40 + (i % 2) * 30, 22, 8, dark);
  } else if (style === 'bun') {
    strokePts(ctx, quad({ x: r.headC.x - 180, y: top + 120 }, { x: r.headC.x - 60, y: top + 10 }, { x: r.headC.x + 60, y: top + 20 }), 8, dark);
    if (look.hairStreaks) {
      // grey streaks combed back across the dark hair (the wife), plus a gold hair pin in the bun
      ctx.save(); pathOf(ctx, cap); ctx.clip();
      for (let k = 0; k < 6; k++) strokePts(ctx, quad({ x: r.headC.x + 230, y: top + 40 + k * 26 }, { x: r.headC.x + 20, y: top - 10 + k * 24 }, { x: r.headC.x - 240, y: top + 70 + k * 30 }), 13, '#9a96a8');
      ctx.restore();
      line(ctx, r.headC.x - 175, top - 60, r.headC.x - 40, top - 40, 10, '#d9b04a');
    }
  }
}

function drawHat(ctx: Ctx, r: Rig, look: Look) {
  const hat = look.hat;
  if (hat === 'none') return;
  const col = look.hatColor;
  const hh = REF_HW / look.headRatio;
  const top = r.headC.y - hh / 2;
  const cx = r.headC.x;
  const band = (y: number, w: number, h: number, c: string) => {
    ctx.fillStyle = c;
    ctx.fillRect(cx - w / 2, y, w, h);
  };
  switch (hat) {
    case 'bowler': {
      if (ART_MODE) {
        // reference bowler: a round dome, a clear dark band with a highlight line, a bold brim curled up at both ends
        const yb = top + 92;
        const dome = [
          ...ellipsePts(cx, yb, 0.36 * REF_HW, 0.44 * REF_HH, 40, Math.PI, Math.PI * 2),
          { x: cx + 0.36 * REF_HW, y: yb + 10 },
          { x: cx - 0.36 * REF_HW, y: yb + 10 },
        ];
        if (SKIP_SIL) fillPts(ctx, dome, col); else inkShape(ctx, dome, col, HP());
        ctx.save(); pathOf(ctx, dome); ctx.clip();
        band(yb - 52, 0.8 * REF_HW, 46, isDark(col) ? INK : shade(col, 0.5));
        line(ctx, cx - 0.4 * REF_HW, yb - 50, cx + 0.4 * REF_HW, yb - 50, 7, isDark(col) ? '#6d5a66' : shade(col, 1.25));
        strokePts(ctx, quad({ x: cx - 0.2 * REF_HW, y: yb - 0.3 * REF_HH }, { x: cx - 0.12 * REF_HW, y: yb - 0.4 * REF_HH }, { x: cx + 0.02 * REF_HW, y: yb - 0.42 * REF_HH }), 9, isDark(col) ? '#5e4c58' : shade(col, 1.2));
        ctx.restore();
        silOutline(ctx, dome);
        const W = 0.62 * REF_HW;
        const brim = [
          ...quad({ x: cx - W, y: yb - 26 }, { x: cx - W + 30, y: yb + 30 }, { x: cx, y: yb + 30 }),
          ...quad({ x: cx, y: yb + 30 }, { x: cx + W - 30, y: yb + 30 }, { x: cx + W, y: yb - 26 }).slice(1),
          ...quad({ x: cx + W, y: yb - 26 }, { x: cx + W - 40, y: yb + 2 }, { x: cx, y: yb + 2 }).slice(1),
          ...quad({ x: cx, y: yb + 2 }, { x: cx - W + 40, y: yb + 2 }, { x: cx - W, y: yb - 26 }).slice(1),
        ];
        if (SKIP_SIL) fillPts(ctx, brim, col); else inkShape(ctx, brim, col, HP());
        break;
      }
      const brim = ellipsePts(cx, top + 88, 0.66 * REF_HW, 26, 48);
      inkShape(ctx, brim, col, HP());
      const dome = [
        ...ellipsePts(cx, top + 95, 0.33 * REF_HW, 0.42 * REF_HH, 40, Math.PI, Math.PI * 2),
        { x: cx + 0.33 * REF_HW, y: top + 95 },
        { x: cx - 0.33 * REF_HW, y: top + 95 },
      ];
      inkShape(ctx, dome, col, HP());
      line(ctx, cx - 0.31 * REF_HW, top + 62, cx + 0.31 * REF_HW, top + 62, 12, shade(col, 0.55));
      break;
    }
    case 'tophat': {
      if (ART_MODE) {
        // reference top hat: a tall crown flaring a little toward the top, a wide dark band with a highlight line, and
        // a bold brim wider than the head (1.15 x) with its ends curled up; full pen everywhere
        const yb = top + 64;
        const crown = [
          { x: cx - 150, y: yb },
          { x: cx - 172, y: top - 250 },
          ...quad({ x: cx - 172, y: top - 250 }, { x: cx, y: top - 268 }, { x: cx + 172, y: top - 250 }).slice(1),
          { x: cx + 150, y: yb },
        ];
        inkShape(ctx, crown, col, HP());
        ctx.save(); pathOf(ctx, crown); ctx.clip();
        const dark = isDark(col);
        band(yb - 92, 380, 82, dark ? INK : shade(col, 0.3));
        // on a dark hat the band only shows through its two light edge lines (silk ribbon)
        line(ctx, cx - 190, yb - 88, cx + 190, yb - 88, 10, dark ? '#a08a98' : shade(col, 0.6));
        if (dark) line(ctx, cx - 190, yb - 14, cx + 190, yb - 14, 7, '#6e5a66');
        // a soft highlight down the crown (the reference's flat sheen)
        strokePts(ctx, [{ x: cx - 105, y: top - 225 }, { x: cx - 98, y: yb - 110 }], 16, dark ? '#55424d' : shade(col, 1.08));
        ctx.restore();
        inkOutline(ctx, crown);
        const W = 0.59 * REF_HW;
        const brim = [
          ...quad({ x: cx - W, y: yb - 30 }, { x: cx - W + 40, y: yb + 30 }, { x: cx, y: yb + 30 }),
          ...quad({ x: cx, y: yb + 30 }, { x: cx + W - 40, y: yb + 30 }, { x: cx + W, y: yb - 30 }).slice(1),
          ...quad({ x: cx + W, y: yb - 30 }, { x: cx + W - 50, y: yb - 2 }, { x: cx, y: yb - 2 }).slice(1),
          ...quad({ x: cx, y: yb - 2 }, { x: cx - W + 50, y: yb - 2 }, { x: cx - W, y: yb - 30 }).slice(1),
        ];
        inkShape(ctx, brim, col, HP());
        break;
      }
      const brim = ellipsePts(cx, top + 70, 0.52 * REF_HW, 24, 48);
      inkShape(ctx, brim, col, HP());
      const crown = [
        { x: cx - 150, y: top + 70 },
        { x: cx - 165, y: top - 230 },
        { x: cx + 165, y: top - 230 },
        { x: cx + 150, y: top + 70 },
      ];
      inkShape(ctx, crown, col, HP());
      band(top + 10, 300, 40, '#C8B690');
      break;
    }
    case 'cowboy': {
      // wide curved brim + dented crown
      const brim = [
        ...quad({ x: cx - 0.8 * REF_HW, y: top + 10 }, { x: cx - 0.5 * REF_HW, y: top + 140 }, { x: cx, y: top + 130 }),
        ...quad({ x: cx, y: top + 130 }, { x: cx + 0.5 * REF_HW, y: top + 140 }, { x: cx + 0.8 * REF_HW, y: top + 10 }),
        ...quad({ x: cx + 0.8 * REF_HW, y: top + 10 }, { x: cx + 0.45 * REF_HW, y: top + 60 }, { x: cx, y: top + 80 }),
        ...quad({ x: cx, y: top + 80 }, { x: cx - 0.45 * REF_HW, y: top + 60 }, { x: cx - 0.8 * REF_HW, y: top + 10 }),
      ];
      inkShape(ctx, brim, col, HP());
      const crown = [
        { x: cx - 175, y: top + 95 },
        { x: cx - 165, y: top - 120 },
        { x: cx - 60, y: top - 170 },
        { x: cx, y: top - 130 },
        { x: cx + 60, y: top - 170 },
        { x: cx + 165, y: top - 120 },
        { x: cx + 175, y: top + 95 },
      ];
      inkShape(ctx, crown, col, HP());
      if (ART_MODE) {
        ctx.save(); pathOf(ctx, crown); ctx.clip();
        band(top + 34, 380, 46, shade(col, 0.4));
        line(ctx, cx - 190, top + 38, cx + 190, top + 38, 7, shade(col, 1.2));
        strokePts(ctx, quad({ x: cx, y: top - 120 }, { x: cx - 8, y: top - 60 }, { x: cx, y: top + 20 }), 9, shade(col, 0.6));
        ctx.restore();
        inkOutline(ctx, crown);
        // badge on the band
        dot(ctx, cx + 40, top + 57, 20, '#E7B93A');
        ring(ctx, cx + 40, top + 57, 20, 7);
      } else band(top + 40, 345, 36, shade(col, 0.45));
      break;
    }
    case 'cap': {
      // engineer cap: puffy striped crown + short brim on the facing side
      const crown = [
        ...ellipsePts(cx, top + 70, 0.58 * REF_HW, 0.36 * REF_HH, 48, Math.PI, Math.PI * 2),
        { x: cx + 0.58 * REF_HW, y: top + 70 },
        { x: cx + 0.5 * REF_HW, y: top + 120 },
        { x: cx - 0.5 * REF_HW, y: top + 120 },
        { x: cx - 0.58 * REF_HW, y: top + 70 },
      ];
      fillPts(ctx, crown, col);
      ctx.save();
      pathOf(ctx, crown);
      ctx.clip();
      for (let x = cx - 260; x < cx + 300; x += 52) line(ctx, x, top - 200, x + 30, top + 130, 16, ART_MODE ? shade(col, 0.82) : '#5A7FD6');
      ctx.restore();
      inkOutline(ctx, crown, HP());
      const brim = [
        { x: cx + 60, y: top + 118 },
        { x: cx + 330, y: top + 95 },
        { x: cx + 340, y: top + 140 },
        { x: cx + 60, y: top + 150 },
      ];
      inkShape(ctx, brim, '#2B2533', HP());
      break;
    }
    case 'fieldcap': {
      // 1940s Japanese field cap: soft olive crown + short visor (drawn by the officer branch below) and cloth neck
      // flaps hanging at the back and sides of the head
      const flapCol = shade(col, 0.92);
      const back = [{ x: cx - 0.52 * REF_HW, y: top + 60 }, { x: cx - 0.2 * REF_HW, y: top + 70 },
        { x: cx - 0.25 * REF_HW, y: top + 0.78 * REF_HH }, { x: cx - 0.58 * REF_HW, y: top + 0.72 * REF_HH }];
      inkShape(ctx, back, flapCol, 0.7);
      for (let k = 0; k < 3; k++) line(ctx, cx - 0.48 * REF_HW + k * 50, top + 110, cx - 0.5 * REF_HW + k * 50, top + 0.7 * REF_HH, 6, shade(col, 0.7));
    }
    // falls through: crown + visor like the officer cap
    case 'officer':
    case 'police': {
      const crown = [
        { x: cx - 250, y: top - 40 },
        { x: cx - 230, y: top - 110 },
        { x: cx, y: top - 135 },
        { x: cx + 230, y: top - 110 },
        { x: cx + 250, y: top - 40 },
        { x: cx + 215, y: top + 110 },
        { x: cx - 215, y: top + 110 },
      ];
      inkShape(ctx, crown, col, HP());
      band(top + 50, 430, 50, '#15193f');
      const brim = [
        { x: cx + 60, y: top + 110 },
        { x: cx + 320, y: top + 90 },
        { x: cx + 330, y: top + 135 },
        { x: cx + 60, y: top + 145 },
      ];
      inkShape(ctx, brim, '#2B2533', HP());
      // gold badge
      dot(ctx, cx, top + 10, 30, '#E7B93A');
      ring(ctx, cx, top + 10, 30, 8);
      break;
    }
    case 'helmet': {
      const dome = [
        ...ellipsePts(cx, top + 150, 0.56 * REF_HW, 0.5 * REF_HH, 48, Math.PI, Math.PI * 2),
        { x: cx + 0.56 * REF_HW, y: top + 150 },
        { x: cx - 0.56 * REF_HW, y: top + 150 },
      ];
      inkShape(ctx, dome, col, HP());
      line(ctx, cx - 0.56 * REF_HW, top + 150, cx + 0.56 * REF_HW, top + 150, 18);
      // visor stub on the facing side
      const visor = [
        { x: cx + 160, y: top + 150 },
        { x: cx + 330, y: top + 150 },
        { x: cx + 300, y: top + 190 },
        { x: cx + 160, y: top + 185 },
      ];
      inkShape(ctx, visor, shade(col, 0.7), HP());
      line(ctx, cx, top - 90, cx, top + 150, 10, shade(col, 0.7));
      break;
    }
    case 'bonnet': {
      const frill = ellipsePts(cx - 20, top + 140, 0.7 * REF_HW, 0.62 * REF_HH, 56, Math.PI * 0.95, Math.PI * 2.05);
      const frillPoly = [...frill, { x: cx + 0.7 * REF_HW - 10, y: top + 200 }, { x: cx - 0.7 * REF_HW - 30, y: top + 200 }];
      inkShape(ctx, frillPoly, '#F7F5F0', HP());
      const dome = [
        ...ellipsePts(cx, top + 120, 0.56 * REF_HW, 0.5 * REF_HH, 48, Math.PI, Math.PI * 2),
        { x: cx + 0.56 * REF_HW, y: top + 120 },
        { x: cx - 0.56 * REF_HW, y: top + 120 },
      ];
      inkShape(ctx, dome, col, HP());
      band(top + 70, 0.9 * REF_HW, 36, shade(col, 0.6));
      break;
    }
    case 'chef': {
      band(top + 60, 0.62 * REF_HW, 70, '#F7F7F4');
      const bandPts = roundRectPts(cx - 0.31 * REF_HW, top + 40, 0.62 * REF_HW, 90, 20);
      const puff = [
        { x: cx - 0.31 * REF_HW, y: top + 50 },
        ...ellipsePts(cx - 200, top - 80, 130, 120, 24, Math.PI * 0.9, Math.PI * 1.55),
        ...ellipsePts(cx, top - 150, 170, 130, 24, Math.PI * 1.15, Math.PI * 1.85),
        ...ellipsePts(cx + 200, top - 80, 130, 120, 24, Math.PI * 1.45, Math.PI * 2.1),
        { x: cx + 0.31 * REF_HW, y: top + 50 },
      ];
      inkShape(ctx, puff, col, HP());
      inkShape(ctx, bandPts, col, HP());
      if (ART_MODE) {
        // pleats on the band and two folds in the puff, half pen
        for (let k = -2; k <= 2; k++) line(ctx, cx + k * 52, top + 58, cx + k * 52, top + 112, 8, shade(col, 0.72));
        strokePts(ctx, quad({ x: cx - 100, y: top + 30 }, { x: cx - 120, y: top - 60 }, { x: cx - 90, y: top - 130 }), 9, shade(col, 0.75));
        strokePts(ctx, quad({ x: cx + 100, y: top + 30 }, { x: cx + 120, y: top - 60 }, { x: cx + 90, y: top - 130 }), 9, shade(col, 0.75));
      }
      break;
    }
    case 'pirate': {
      const tri = [
        { x: cx - 0.72 * REF_HW, y: top + 60 },
        { x: cx - 0.55 * REF_HW, y: top - 140 },
        { x: cx - 0.25 * REF_HW, y: top - 40 },
        { x: cx, y: top - 70 },
        { x: cx + 0.25 * REF_HW, y: top - 40 },
        { x: cx + 0.55 * REF_HW, y: top - 140 },
        { x: cx + 0.72 * REF_HW, y: top + 60 },
        { x: cx + 0.35 * REF_HW, y: top + 110 },
        { x: cx - 0.35 * REF_HW, y: top + 110 },
      ];
      inkShape(ctx, tri, col, HP());
      // skull mark
      dot(ctx, cx, top + 10, 34, '#F7F5F0', 30);
      dot(ctx, cx - 12, top + 4, 7, INK);
      dot(ctx, cx + 12, top + 4, 7, INK);
      line(ctx, cx - 36, top + 46, cx + 36, top + 46, 8, '#F7F5F0');
      break;
    }
    case 'crown': {
      const pts: Pt[] = [{ x: cx - 165, y: top + 110 }, { x: cx - 175, y: top - 90 }];
      for (let i = 0; i < 4; i++) {
        pts.push({ x: cx - 175 + 87.5 * (i + 0.5), y: top + 10 });
        pts.push({ x: cx - 175 + 87.5 * (i + 1), y: top - 90 });
      }
      pts.push({ x: cx + 165, y: top + 110 });
      inkShape(ctx, pts, col, HP());
      for (let i = 0; i < 3; i++) dot(ctx, cx - 100 + i * 100, top + 60, 14, '#C8323A');
      break;
    }
    case 'headband': {
      const y = top + hh * 0.22;
      const bandPts = [
        ...ellipsePts(cx, y, 0.53 * REF_HW, 0.11 * REF_HH, 48, Math.PI, Math.PI * 2).map((p) => ({ x: p.x, y: p.y + 20 })),
        { x: cx + 0.53 * REF_HW, y: y + 60 },
        { x: cx - 0.53 * REF_HW, y: y + 60 },
      ];
      inkShape(ctx, bandPts, col, HP());
      // knot tails on the back
      const tail = [{ x: cx - 0.5 * REF_HW, y: y + 30 }, { x: cx - 0.5 * REF_HW - 120, y: y + 110 }, { x: cx - 0.5 * REF_HW - 70, y: y + 130 }, { x: cx - 0.5 * REF_HW, y: y + 70 }];
      inkShape(ctx, tail, col, HP());
      break;
    }
    case 'veil': {
      const drape = [
        { x: cx - 0.42 * REF_HW, y: top + 60 }, { x: cx - 0.18 * REF_HW, y: top - 6 },
        { x: cx - 0.6 * REF_HW, y: top + 0.7 * REF_HH }, { x: cx - 0.82 * REF_HW, y: top + 1.6 * REF_HH }, { x: cx - 0.5 * REF_HW, y: top + 1.7 * REF_HH },
      ];
      ctx.save(); ctx.globalAlpha = 0.85; inkShape(ctx, drape, '#F7F4EE', 0.5); ctx.restore();
      for (let k = -2; k <= 2; k++) dot(ctx, cx + k * 55, top + 18 - Math.abs(k) * 6, 16, '#F2E7C8');
      break;
    }
    case 'nightcap': {
      const band = top + 120;
      const tip = { x: cx - 0.78 * REF_HW, y: top + 0.42 * REF_HH };
      const cone: Pt[] = [
        { x: cx + 0.56 * REF_HW, y: band },
        ...quad({ x: cx + 0.5 * REF_HW, y: top - 60 }, { x: cx - 0.1 * REF_HW, y: top - 150 }, { x: cx - 0.62 * REF_HW, y: top - 10 }),
        ...quad({ x: cx - 0.62 * REF_HW, y: top - 10 }, { x: cx - 0.8 * REF_HW, y: top + 100 }, tip),
        ...quad(tip, { x: cx - 0.6 * REF_HW, y: top + 60 }, { x: cx - 0.56 * REF_HW, y: band }),
      ];
      inkShape(ctx, cone, '#F4F1EC', HP());
      ctx.save(); pathOf(ctx, cone); ctx.clip();
      for (let k = -6; k < 10; k++) {
        const x = cx + 0.6 * REF_HW - k * 95;
        ctx.fillStyle = '#D8333A';
        ctx.beginPath(); ctx.moveTo(x, band + 40); ctx.lineTo(x + 45, band + 40); ctx.lineTo(x - 260, top - 320); ctx.lineTo(x - 305, top - 320); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
      inkShape(ctx, cone, 'rgba(0,0,0,0)', HP());
      const fold = roundRectPts(cx - 0.58 * REF_HW, band - 20, 1.16 * REF_HW, 72, 30);
      inkShape(ctx, fold, '#F4F1EC', HP());
      dot(ctx, tip.x, tip.y + 10, 48, '#F4F1EC');
      ring(ctx, tip.x, tip.y + 10, 48, 10);
      break;
    }
    case 'beanie': {
      const dome = [
        ...ellipsePts(cx, top + 110, 0.55 * REF_HW, 0.48 * REF_HH, 48, Math.PI, Math.PI * 2),
        { x: cx + 0.55 * REF_HW, y: top + 110 },
        { x: cx - 0.55 * REF_HW, y: top + 110 },
      ];
      inkShape(ctx, dome, col, HP());
      const fold = roundRectPts(cx - 0.56 * REF_HW, top + 90, 1.12 * REF_HW, 80, 30);
      inkShape(ctx, fold, shade(col, HP()), HP());
      for (let x = cx - 240; x < cx + 260; x += 48) line(ctx, x, top + 100, x + 10, top + 160, 6, shade(col, 0.6));
      dot(ctx, cx, top - 120, 42, shade(col, 1.15));
      ring(ctx, cx, top - 120, 42, 10);
      break;
    }
    default:
      break;
  }
}

// ───────────────────────────── face ─────────────────────────────
type BrowStyle = 'flat' | 'angryV' | 'sternV' | 'sadArch' | 'raised' | 'arched' | 'asym' | 'asymUD' | 'oneUp' | 'wavy' | 'lowFlat' | 'none';
type EyeStyle = 'dot' | 'dash' | 'ring' | 'ringSmall' | 'happy' | 'happyLow' | 'squint' | 'x' | 'dotUp' | 'dotDown' | 'dotClose';
type MouthStyle =
  | 'line' | 'smirk' | 'frown' | 'o' | 'oSmall' | 'openOval' | 'openSmall' | 'teeth' | 'teethUp' | 'teethWide' | 'grin'
  | 'grinTongue' | 'dSmile' | 'wavy' | 'tilde' | 'tongue' | 'whistle' | 'lineSmall';
type Extra = 'sweat' | 'speed' | 'tears' | 'zzz' | 'note' | 'blush' | 'gloom' | 'pale' | 'vein' | 'blushLines';
/** anime eye modes (drawn instead of the slider eyes) and anime mouths */
export type AnimeEyes = 'sparkle' | 'xx' | 'blank' | 'flat' | 'tt' | 'spiral' | 'heart';
export type AnimeMouth = 'cat' | 'shout' | 'tiny' | 'wobble' | 'pout';
interface Face {
  brows: BrowStyle;
  eyes: EyeStyle;
  mouth: MouthStyle;
  extras?: Extra[];
  tilt?: number; // head tilt in degrees (positive = toward facing side)
  anime?: AnimeEyes;
  amouth?: AnimeMouth;
}

const FACES: Record<AnyExpression, Face> = {
  neutral: { brows: 'flat', eyes: 'dot', mouth: 'line' },
  happy: { brows: 'arched', eyes: 'happy', mouth: 'dSmile' },
  grin: { brows: 'arched', eyes: 'dot', mouth: 'teethUp' },
  laugh: { brows: 'arched', eyes: 'happy', mouth: 'grinTongue' },
  sad: { brows: 'sadArch', eyes: 'dotDown', mouth: 'frown', tilt: -5 },
  angry: { brows: 'angryV', eyes: 'dotClose', mouth: 'openOval' },
  shocked: { brows: 'raised', eyes: 'ring', mouth: 'openOval' },
  worried: { brows: 'sadArch', eyes: 'dot', mouth: 'teeth', extras: ['sweat'] },
  smug: { brows: 'asym', eyes: 'dot', mouth: 'smirk', tilt: 7 },
  sleepy: { brows: 'lowFlat', eyes: 'happyLow', mouth: 'lineSmall', extras: ['zzz'] },
  confused: { brows: 'oneUp', eyes: 'dot', mouth: 'tilde', tilt: 6 },
  scared: { brows: 'sadArch', eyes: 'ringSmall', mouth: 'teethWide', extras: ['sweat'] },
  evil: { brows: 'angryV', eyes: 'dot', mouth: 'teethWide' },
  whistle: { brows: 'raised', eyes: 'dotUp', mouth: 'whistle', extras: ['note'] },
  stern: { brows: 'sternV', eyes: 'dotClose', mouth: 'frown' },
  nervous: { brows: 'asymUD', eyes: 'ring', mouth: 'teeth', extras: ['sweat'] },
  cry: { brows: 'sadArch', eyes: 'happyLow', mouth: 'oSmall', extras: ['tears', 'sweat'] },
  effort: { brows: 'angryV', eyes: 'squint', mouth: 'oSmall' },
  bored: { brows: 'flat', eyes: 'dash', mouth: 'line', tilt: -6 },
  talkO: { brows: 'flat', eyes: 'dot', mouth: 'o' },
  cheer: { brows: 'arched', eyes: 'happy', mouth: 'teeth' },
  dizzy: { brows: 'none', eyes: 'x', mouth: 'wavy' },
  tongue: { brows: 'oneUp', eyes: 'ring', mouth: 'tongue' },
  teethGrit: { brows: 'sadArch', eyes: 'squint', mouth: 'teeth' }, // pain: squeezed eyes, gritted teeth (was happy arcs = read as laughing)
  // lidded attitudes (the 3D slider face adds the lids / lopsided mouths: FACE_OVER)
  suspicious: { brows: 'asymUD', eyes: 'dot', mouth: 'smirk' },
  smirk: { brows: 'asym', eyes: 'dot', mouth: 'smirk', tilt: 5 },
  unimpressed: { brows: 'flat', eyes: 'dot', mouth: 'lineSmall' },
  tired: { brows: 'sadArch', eyes: 'dot', mouth: 'frown', tilt: -4 },
  // dialogue reactions (2026-11-24). Each one is meant to read on a phone at a glance; the slider tweaks are in FACE_OVER.
  eager: { brows: 'raised', eyes: 'dot', mouth: 'dSmile', tilt: 4 }, // too keen: brows up, open smile
  excited: { brows: 'arched', eyes: 'ring', mouth: 'grin' },
  awkward: { brows: 'asymUD', eyes: 'dot', mouth: 'wavy', extras: ['sweat'] }, // eyes slide away, wobbly mouth
  embarrassed: { brows: 'sadArch', eyes: 'dotDown', mouth: 'smirk', extras: ['blush'], tilt: -6 },
  relieved: { brows: 'sadArch', eyes: 'happy', mouth: 'dSmile' }, // inner brows up + closed happy eyes
  deadpan: { brows: 'flat', eyes: 'dot', mouth: 'line' }, // flat lids, straight mouth: a dry joke
  hopeful: { brows: 'sadArch', eyes: 'dotUp', mouth: 'smirk', tilt: 5 },
  proud: { brows: 'arched', eyes: 'happy', mouth: 'smirk', tilt: -4 },
  surprised: { brows: 'raised', eyes: 'ring', mouth: 'o' }, // pleasant surprise (shocked is the big one)
  curious: { brows: 'oneUp', eyes: 'dot', mouth: 'oSmall', tilt: 8 },
  annoyed: { brows: 'sternV', eyes: 'dot', mouth: 'line', tilt: -3 },
  thinking: { brows: 'asymUD', eyes: 'dotUp', mouth: 'tilde', tilt: 6 },
  wince: { brows: 'sadArch', eyes: 'squint', mouth: 'teethWide' }, // ouch / cringe
  shy: { brows: 'sadArch', eyes: 'dotDown', mouth: 'lineSmall', extras: ['blush'], tilt: -8 },
  sheepish: { brows: 'sadArch', eyes: 'dot', mouth: 'teethUp', extras: ['blush', 'sweat'], tilt: 6 },
  // anime (2026-11-24): what each one is for, in a skit
  a_sparkle: { brows: 'raised', eyes: 'ring', mouth: 'dSmile', anime: 'sparkle', tilt: 4 }, // too keen, starry-eyed ask
  a_cringe: { brows: 'sadArch', eyes: 'squint', mouth: 'teeth', anime: 'xx', amouth: 'wobble', extras: ['sweat'] }, // >_< "that went badly"
  a_blank: { brows: 'raised', eyes: 'ring', mouth: 'o', anime: 'blank', amouth: 'tiny', extras: ['pale'] }, // white-eyed shock, frozen
  a_gloom: { brows: 'sadArch', eyes: 'dash', mouth: 'wavy', anime: 'flat', amouth: 'wobble', extras: ['gloom', 'pale'], tilt: -8 }, // crushed
  a_cry: { brows: 'sadArch', eyes: 'happyLow', mouth: 'grin', anime: 'tt', amouth: 'shout', tilt: -4 }, // comic tear streams
  a_cat: { brows: 'arched', eyes: 'happy', mouth: 'smirk', amouth: 'cat', tilt: 6 }, // teasing ":3"
  a_deadpan: { brows: 'flat', eyes: 'dash', mouth: 'line', anime: 'flat', amouth: 'tiny' }, // "-_-"
  a_heart: { brows: 'arched', eyes: 'ring', mouth: 'dSmile', anime: 'heart', extras: ['blush'] }, // smitten
  a_dizzy: { brows: 'wavy', eyes: 'x', mouth: 'wavy', anime: 'spiral', amouth: 'wobble' }, // overwhelmed
  a_rage: { brows: 'angryV', eyes: 'dotClose', mouth: 'openOval', amouth: 'shout', extras: ['vein'] }, // comic anger
  a_joy: { brows: 'arched', eyes: 'happy', mouth: 'grin', amouth: 'shout' }, // ^o^ big happy
  a_shy: { brows: 'sadArch', eyes: 'dotDown', mouth: 'lineSmall', amouth: 'wobble', extras: ['blushLines'], tilt: -8 }, // flustered
  a_nervous: { brows: 'sadArch', eyes: 'dot', mouth: 'teethUp', amouth: 'wobble', extras: ['sweat'], tilt: 5 }, // forced smile
  a_pout: { brows: 'sternV', eyes: 'dot', mouth: 'lineSmall', amouth: 'pout', extras: ['blush'], tilt: -6 }, // sulking
  a_smug: { brows: 'asym', eyes: 'happy', mouth: 'smirk', amouth: 'cat', tilt: 7 },
  a_dead: { brows: 'none', eyes: 'x', mouth: 'line', anime: 'flat', amouth: 'tiny', extras: ['gloom', 'pale'] }, // soul left the body
};

function browStroke(ctx: Ctx, x: number, y: number, tiltRad: number, len = 92, thick = 31, taperToward = 1) {
  // blunt tapered quad: thick end → 70 % thick end
  const c = Math.cos(tiltRad);
  const s = Math.sin(tiltRad);
  const hl = len / 2;
  const t0 = thick / 2;
  const t1 = (thick * 0.7) / 2;
  const a = taperToward > 0 ? t0 : t1;
  const b = taperToward > 0 ? t1 : t0;
  const pts = [
    { x: x - hl * c + a * s, y: y - hl * s - a * c },
    { x: x + hl * c + b * s, y: y + hl * s - b * c },
    { x: x + hl * c - b * s, y: y + hl * s + b * c },
    { x: x - hl * c - a * s, y: y - hl * s + a * c },
  ];
  if (ART_MODE) {
    // skin halo: a brow that crosses the hairline still reads as a brow
    pathOf(ctx, pts);
    ctx.strokeStyle = SKIN;
    ctx.lineWidth = 22;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
  fillPts(ctx, pts, INK);
  // round the ends a touch
  dot(ctx, pts[0].x * 0.5 + pts[3].x * 0.5, pts[0].y * 0.5 + pts[3].y * 0.5, a * 0.9);
  dot(ctx, pts[1].x * 0.5 + pts[2].x * 0.5, pts[1].y * 0.5 + pts[2].y * 0.5, b * 0.9);
}

function drawExtras(ctx: Ctx, r: Rig, look: Look, extras: string[], cx: number, eyeDX: number, eyeY: number, top: number, hh: number) {
  // ── extras
  for (const ex of extras) {
    switch (ex) {
      case 'gloom': {
        // anime "kage": vertical blue-violet lines hanging over the upper face, clipped to the head
        ctx.save(); pathOf(ctx, headPts(r, look)); ctx.clip();
        for (let i = 0; i < 6; i++) {
          const x = r.headC.x - REF_HW * 0.36 + (i * REF_HW * 0.72) / 5;
          const len = hh * (0.22 + 0.07 * Math.sin(i * 2.3));
          line(ctx, x, top - 10, x, top + len, 7, 'rgba(70,60,140,0.6)');
        }
        ctx.restore();
        break;
      }
      case 'pale': {
        // blue shade over the forehead (the colour drains out)
        ctx.save(); pathOf(ctx, headPts(r, look)); ctx.clip();
        const g = ctx.createLinearGradient(0, top, 0, top + hh * 0.45);
        g.addColorStop(0, 'rgba(110,130,210,0.32)'); g.addColorStop(1, 'rgba(110,130,210,0)');
        ctx.fillStyle = g; ctx.fillRect(r.headC.x - REF_HW, top - 20, REF_HW * 2, hh * 0.5);
        ctx.restore();
        break;
      }
      case 'vein': {
        // the anger cross-popping vein on the upper corner of the forehead (facing side)
        const vx = r.headC.x + 0.26 * REF_HW, vy = top + 0.17 * hh, a = 34;
        for (const [dx, dy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
          strokePts(ctx, quad({ x: vx + dx * 10, y: vy + dy * a }, { x: vx + dx * 4, y: vy + dy * 8 }, { x: vx + dx * a, y: vy + dy * 10 }), 22, '#E0483C');
        }
        break;
      }
      case 'blushLines': {
        // anime fluster: a pink band across the cheeks with diagonal hatching
        for (const side of [-1, 1]) {
          const bx = cx + side * (eyeDX + 10);
          const by = eyeY + 0.12 * hh;
          dot(ctx, bx, by, 58, 'rgba(240,110,125,0.5)', 24);
          for (let i = -2; i <= 2; i++) line(ctx, bx + i * 20 - 10, by + 16, bx + i * 20 + 10, by - 16, 8, '#D84A60');
        }
        break;
      }
      case 'blush': {
        // two soft pink cheeks with three ink hatch strokes each (reads at phone size, stays in the flat style)
        for (const side of [-1, 1]) {
          const bx = cx + side * (eyeDX + 18);
          const by = eyeY + 0.13 * hh;
          dot(ctx, bx, by, 44, 'rgba(240,120,130,0.55)', 26);
          for (let i = -1; i <= 1; i++) line(ctx, bx + i * 22 - 8, by + 10, bx + i * 22 + 8, by - 10, 7);
        }
        break;
      }
      case 'sweat': {
        const sx = r.headC.x + 0.40 * REF_HW;
        const sy = top + 0.22 * hh;
        const drop = [
          { x: sx, y: sy - 34 },
          ...ellipsePts(sx, sy + 8, 20, 22, 20, Math.PI * 1.75, Math.PI * 3.25).slice(1, -1),
        ];
        inkShape(ctx, drop, '#9FD4F5', 0.45);
        break;
      }
      case 'tears':
        for (const side of [-1, 1]) {
          const ex = cx + side * eyeDX;
          const band = roundRectPts(ex - 15, eyeY + 26, 30, hh / 2 - 30 + (r.headC.y - eyeY) - 20, 14);
          fillPts(ctx, band, 'rgba(159,212,245,0.95)');
          strokePts(ctx, band, 6, INK, true);
        }
        break;
      case 'speed':
        for (const side of [-1, 1]) {
          for (let i = 0; i < 3; i++) {
            const a = (side > 0 ? -25 + i * 25 : 180 + 25 - i * 25) * D;
            const p0 = headAt(r, look, a, 1.12);
            const p1 = headAt(r, look, a, 1.12 + (i === 1 ? 0.34 : 0.26));
            line(ctx, p0.x, p0.y, p1.x, p1.y, 14);
          }
        }
        break;
      case 'zzz': {
        ctx.fillStyle = INK;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const bx = r.headC.x + 0.52 * REF_HW;
        const by = top + 0.08 * hh;
        const sizes = [60, 84, 110];
        for (let i = 0; i < 3; i++) {
          ctx.font = `900 ${sizes[i]}px Arial, Helvetica, sans-serif`;
          ctx.fillText('Z', bx + i * 70, by - i * 95);
        }
        break;
      }
      case 'note': {
        const nx = r.headC.x + 0.5 * REF_HW;
        const ny = top + 0.55 * hh;
        dot(ctx, nx, ny, 22, INK, 16);
        line(ctx, nx + 18, ny, nx + 18, ny - 90, 12);
        strokePts(ctx, quad({ x: nx + 18, y: ny - 90 }, { x: nx + 60, y: ny - 80 }, { x: nx + 62, y: ny - 40 }), 12);
        break;
      }
    }
  }
}

// ───────────────────────────── props ─────────────────────────────
function drawProp(ctx: Ctx, id: PropId, h: Pt, h2: Pt | undefined, look: Look) {
  const x = h.x;
  const y = h.y;
  switch (id) {
    case 'shovel': {
      const shaft = roundRectPts(x - 11, y - 190, 22, 520, 11);
      inkShape(ctx, shaft, '#8B5A2B', 0.5);
      const blade = [
        { x: x - 60, y: y + 300 },
        { x: x + 60, y: y + 300 },
        { x: x + 66, y: y + 400 },
        { x: x, y: y + 470 },
        { x: x - 66, y: y + 400 },
      ];
      inkShape(ctx, blade, '#9AA3AD', 0.6);
      const grip = roundRectPts(x - 40, y - 250, 80, 60, 24);
      inkShape(ctx, grip, '#8B5A2B', 0.5);
      break;
    }
    case 'lantern': {
      line(ctx, x, y, x, y + 50, 10);
      const body = roundRectPts(x - 50, y + 60, 100, 150, 14);
      // glow behind
      const g = ctx.createRadialGradient(x, y + 135, 20, x, y + 135, 220);
      g.addColorStop(0, 'rgba(255,200,90,0.55)');
      g.addColorStop(1, 'rgba(255,200,90,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - 220, y - 85, 440, 440);
      inkShape(ctx, body, '#FFD66B', 0.6);
      const cap = roundRectPts(x - 42, y + 40, 84, 30, 8);
      inkShape(ctx, cap, '#3B3F48', 0.5);
      const base = roundRectPts(x - 42, y + 200, 84, 26, 8);
      inkShape(ctx, base, '#3B3F48', 0.5);
      dot(ctx, x, y + 140, 14, '#FFF4C8', 26);
      break;
    }
    case 'mirror': {
      line(ctx, x, y, x + 10, y - 90, 18, '#E7B93A');
      const frame = ellipsePts(x + 16, y - 170, 78, 84, 40);
      inkShape(ctx, frame, '#E7B93A', 0.6);
      dot(ctx, x + 16, y - 170, 58, '#BFE3F7', 64);
      line(ctx, x - 10, y - 200, x + 10, y - 150, 8, '#FFFFFF');
      break;
    }
    case 'ticket': {
      ctx.save();
      ctx.translate(x + 20, y - 20);
      ctx.rotate(-0.2);
      const t = roundRectPts(-80, -42, 160, 84, 10);
      inkShape(ctx, t, '#F7F5F0', 0.5);
      ctx.fillStyle = '#C8323A';
      ctx.fillRect(-80, -42, 160, 22);
      line(ctx, -50, 0, 50, 0, 6);
      line(ctx, -50, 20, 20, 20, 6);
      ctx.restore();
      break;
    }
    case 'bag': {
      strokePts(ctx, quad({ x: x - 40, y: y + 40 }, { x, y: y - 20 }, { x: x + 40, y: y + 40 }), 12);
      const b = roundRectPts(x - 95, y + 40, 190, 140, 22);
      inkShape(ctx, b, '#8B5A2B', 0.6);
      line(ctx, x - 95, y + 80, x + 95, y + 80, 8);
      ctx.fillStyle = '#E7B93A';
      ctx.fillRect(x - 16, y + 68, 32, 24);
      break;
    }
    case 'sword': {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-0.9);
      const grip = roundRectPts(-12, -10, 24, 90, 8);
      inkShape(ctx, grip, '#3B3F48', 0.5);
      const guard = roundRectPts(-60, -34, 120, 26, 8);
      inkShape(ctx, guard, '#E7B93A', 0.5);
      const blade = [{ x: -14, y: -34 }, { x: 14, y: -34 }, { x: 14, y: -300 }, { x: 0, y: -340 }, { x: -14, y: -300 }];
      inkShape(ctx, blade, '#C9D1DA', 0.6);
      line(ctx, 0, -50, 0, -290, 5, '#FFFFFF');
      ctx.restore();
      break;
    }
    case 'phone': {
      const p = roundRectPts(x - 36, y - 95, 72, 135, 12);
      inkShape(ctx, p, '#2B2533', 0.5);
      ctx.fillStyle = '#9FD4F5';
      ctx.fillRect(x - 28, y - 80, 56, 100);
      break;
    }
    case 'cup': {
      const mug = roundRectPts(x - 45, y - 90, 90, 115, 12);
      inkShape(ctx, mug, '#E7B93A', 0.6);
      line(ctx, x - 20, y - 70, x - 20, y + 10, 6, shade('#E7B93A', 0.75));
      line(ctx, x + 10, y - 70, x + 10, y + 10, 6, shade('#E7B93A', 0.75));
      // handle on the back side
      ring(ctx, x - 55, y - 35, 26, 14);
      // foam
      const foam = [
        { x: x - 50, y: y - 90 },
        ...ellipsePts(x - 28, y - 100, 26, 22, 12, Math.PI, Math.PI * 2),
        ...ellipsePts(x + 2, y - 112, 30, 26, 12, Math.PI, Math.PI * 2),
        ...ellipsePts(x + 34, y - 100, 24, 22, 12, Math.PI, Math.PI * 2),
        { x: x + 58, y: y - 90 },
      ];
      inkShape(ctx, foam, '#FFFFFF', 0.5);
      break;
    }
    case 'book': {
      const b = roundRectPts(x - 80, y - 70, 160, 115, 8);
      inkShape(ctx, b, '#8A3A3A', 0.6);
      ctx.fillStyle = '#F7F5F0';
      ctx.fillRect(x - 70, y + 28, 150, 12);
      line(ctx, x - 50, y - 40, x + 40, y - 40, 6, '#E7B93A');
      break;
    }
    case 'bell': {
      line(ctx, x, y, x, y - 70, 16, '#8B5A2B');
      const bell = [
        { x: x - 22, y: y - 60 },
        { x: x + 22, y: y - 60 },
        ...quad({ x: x + 22, y: y - 60 }, { x: x + 30, y: y + 20 }, { x: x + 60, y: y + 50 }),
        { x: x - 60, y: y + 50 },
        ...quad({ x: x - 60, y: y + 50 }, { x: x - 30, y: y + 20 }, { x: x - 22, y: y - 60 }),
      ];
      inkShape(ctx, bell, '#E7B93A', 0.6);
      dot(ctx, x, y + 58, 14);
      break;
    }
    case 'rifle': {
      // 1940s bolt-action rifle (~2/3 of the figure tall), carried across the body muzzle-up: shaped wooden stock with a
      // butt plate, wrist under the hand, steel action with bolt knob + magazine + trigger guard, wooden fore-end with
      // barrel bands, long barrel with a front sight, a sagging sling. Drawn along local +x, then tilted.
      const wood = '#8B5A2E', woodDk = '#6A4220', steel = '#3A3F48', steelLt = '#5A616C', sling = '#5C4A2E';
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-0.42);
      const P = (pts: number[][]) => pts.map(([px, py]) => ({ x: px, y: py }));
      // sling (behind everything)
      strokePts(ctx, quad({ x: -330, y: 70 }, { x: 60, y: 210 }, { x: 430, y: 40 }), 14, sling);
      // butt stock: wide at the butt, narrowing to the wrist under the hand
      inkShape(ctx, P([[-440, -40], [-260, -38], [-80, -14], [0, -12], [0, 30], [-90, 40], [-270, 78], [-440, 92]]), wood, 0.6);
      inkShape(ctx, P([[-458, -44], [-436, -44], [-436, 96], [-458, 96]]), '#2A2420', 0.5);      // butt plate
      strokePts(ctx, P([[-400, 40], [-280, 30], [-140, 14]]), 6, woodDk);                          // grain line
      // receiver / action
      inkShape(ctx, P([[0, -22], [170, -22], [170, 22], [0, 22]]), steel, 0.6);
      inkShape(ctx, P([[40, 22], [120, 22], [112, 92], [48, 92]]), steel, 0.6);                    // magazine
      strokePts(ctx, quad({ x: 0, y: 26 }, { x: 25, y: 84 }, { x: 70, y: 26 }), 9, steel);       // trigger guard
      strokePts(ctx, P([[96, -10], [118, 40], [128, 70]]), 12, steelLt);                           // bolt handle
      dot(ctx, 130, 76, 17, steelLt); ring(ctx, 130, 76, 17, 6);                                     // bolt knob
      // fore-end + barrel bands
      inkShape(ctx, P([[170, -14], [540, -10], [560, 6], [540, 20], [170, 24]]), wood, 0.6);
      for (const bx of [270, 490]) inkShape(ctx, P([[bx, -18], [bx + 22, -18], [bx + 22, 26], [bx, 26]]), steelLt, 0.5);
      // barrel + front sight
      inkShape(ctx, P([[150, -30], [760, -26], [760, -10], [150, -12]]), steel, 0.6);
      inkShape(ctx, P([[728, -46], [744, -46], [744, -26], [728, -26]]), steel, 0.5);
      ctx.restore();
      break;
    }
    case 'capsule': {
      // a tiny glass cyanide capsule on the open palm
      dot(ctx, x + 6, y - 26, 16, '#DDE8EE'); ring(ctx, x + 6, y - 26, 16, 6);
      break;
    }
    case 'revolver': {
      // oversized (≈ 1 HW long), grey-blue, pointing forward
      const col = '#6F7F99';
      const grip = [{ x: x - 30, y: y - 20 }, { x: x + 30, y: y - 20 }, { x: x + 10, y: y + 90 }, { x: x - 60, y: y + 90 }];
      inkShape(ctx, grip, '#5A3A22', 0.6);
      const frame = roundRectPts(x - 60, y - 70, 170, 70, 14);
      inkShape(ctx, frame, col, 0.6);
      const barrel = roundRectPts(x + 90, y - 72, 330, 36, 10);
      inkShape(ctx, barrel, col, 0.6);
      const cyl = roundRectPts(x + 10, y - 92, 110, 100, 26);
      inkShape(ctx, cyl, shade(col, 0.85), 0.6);
      ring(ctx, x + 65, y - 42, 18, 8);
      // trigger guard
      ring(ctx, x + 20, y + 10, 22, 10);
      break;
    }
    case 'spear': {
      const shaft = roundRectPts(x - 11, y - 560, 22, 1080, 11);
      inkShape(ctx, shaft, '#8B5A2B', 0.5);
      const head = [{ x, y: y - 700 }, { x: x + 40, y: y - 580 }, { x, y: y - 540 }, { x: x - 40, y: y - 580 }];
      inkShape(ctx, head, '#C9D1DA', 0.6);
      break;
    }
    case 'shield': {
      const sh = [
        { x: x - 130, y: y - 170 },
        { x: x + 130, y: y - 170 },
        { x: x + 125, y: y + 20 },
        ...quad({ x: x + 125, y: y + 20 }, { x: x + 60, y: y + 170 }, { x, y: y + 200 }),
        ...quad({ x, y: y + 200 }, { x: x - 60, y: y + 170 }, { x: x - 125, y: y + 20 }),
      ];
      inkShape(ctx, sh, '#2F4A9A', 0.7);
      dot(ctx, x, y, 34, '#E7B93A');
      ring(ctx, x, y, 34, 8);
      line(ctx, x, y - 160, x, y + 190, 10, '#E7B93A');
      break;
    }
    case 'cards': {
      for (let i = -1; i <= 1; i++) {
        ctx.save();
        ctx.translate(x + i * 20, y - 40);
        ctx.rotate(i * 0.28);
        const c = roundRectPts(-36, -60, 72, 100, 8);
        inkShape(ctx, c, '#FFFFFF', 0.45);
        dot(ctx, 0, -10, 12, i === 0 ? '#C8323A' : INK);
        ctx.restore();
      }
      break;
    }
    case 'cash': {
      for (let i = 2; i >= 0; i--) {
        const b = roundRectPts(x - 70 + i * 8, y - 60 - i * 14, 140, 70, 8);
        inkShape(ctx, b, '#4E9B5F', 0.45);
      }
      ctx.fillStyle = INK;
      ctx.font = '900 48px Arial, Helvetica, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('$', x + 10, y - 50);
      break;
    }
    case 'pot': {
      const px0 = h2 ? (h.x + h2.x) / 2 : x;
      const py0 = h2 ? (h.y + h2.y) / 2 : y;
      const pot = roundRectPts(px0 - 90, py0 - 60, 180, 130, 20);
      inkShape(ctx, pot, '#3B3F48', 0.6);
      const lid = ellipsePts(px0, py0 - 60, 100, 22, 36);
      inkShape(ctx, lid, '#5A6170', 0.5);
      dot(ctx, px0, py0 - 80, 14, '#3B3F48');
      ring(ctx, px0 - 100, py0 - 10, 22, 12);
      ring(ctx, px0 + 100, py0 - 10, 22, 12);
      break;
    }
  }
}

function drawFace(ctx: Ctx, r: Rig, look: Look, st: DrawState) {
  const face = FACES[st.expr] ?? FACES.neutral;
  const hh = REF_HW / look.headRatio;
  const top = r.headC.y - hh / 2;
  const cx = r.headC.x + FACE_SHIFT; // face group shifted toward the facing side
  const closed = st.blink >= 0.5;
  let eyes = face.eyes;
  const useRing = eyes === 'ring' || eyes === 'ringSmall' || look.accessories.has('glasses') && eyes === 'dot';
  const eyeY = top + (useRing ? 0.48 : ART_MODE ? 0.42 : 0.40) * hh;
  const eyeDX = eyes === 'dotClose' ? 60 : 72;
  const browY = eyeY - (useRing ? 0.17 : ART_MODE ? 0.13 : 0.15) * hh;
  const mouthY = top + 0.70 * hh;
  const pupil = st.pupil ?? { x: 0, y: 0 };

  // ── brows
  const bw = 92;
  const B = (side: number, dy: number, tiltDeg: number, len = bw, thick = 31) =>
    browStroke(ctx, cx + side * eyeDX, browY + dy, tiltDeg * D * side, len, thick, -side);
  const browPts = (pts: Pt[], w: number) => {
    if (ART_MODE) strokePts(ctx, pts, w + 22, SKIN);
    strokePts(ctx, pts, w);
  };
  switch (face.brows) {
    case 'flat': B(-1, 0, 0); B(1, 0, 0); break;
    case 'lowFlat': B(-1, 20, 0); B(1, 20, 0); break;
    // (signs fixed 2026-11-19: a positive tilt on the left brow (side -1) lifts its OUTER end, so angry = inner ends
    // down = negative here; the old values drew angry faces sad and sad faces angry)
    case 'angryV': B(-1, 14, -24, 100, 34); B(1, 14, -24, 100, 34); break;
    case 'sternV': B(-1, 8, -13); B(1, 8, -13); break;
    case 'sadArch': B(-1, -10, 26, 96, 33); B(1, -10, 26, 96, 33); break;
    case 'raised': B(-1, -40, 6, 84, 24); B(1, -40, 6, 84, 24); break;
    case 'arched':
      browPts(quad({ x: cx - eyeDX - 46, y: browY + 12 }, { x: cx - eyeDX, y: browY - 34 }, { x: cx - eyeDX + 46, y: browY + 12 }), 28);
      browPts(quad({ x: cx + eyeDX - 46, y: browY + 12 }, { x: cx + eyeDX, y: browY - 34 }, { x: cx + eyeDX + 46, y: browY + 12 }), 28);
      break;
    case 'asym': // smug: back brow raised arch, front brow flat-low
      browPts(quad({ x: cx - eyeDX - 46, y: browY - 30 }, { x: cx - eyeDX, y: browY - 80 }, { x: cx - eyeDX + 46, y: browY - 36 }), 28);
      B(1, 10, -8);
      break;
    case 'asymUD': B(-1, -36, 8); B(1, 12, -14); break;
    case 'oneUp': B(-1, 4, 0); B(1, -46, 12); break;
    case 'wavy':
      for (const side of [-1, 1]) {
        const x0 = cx + side * eyeDX;
        browPts([
          { x: x0 - 46, y: browY - 40 }, { x: x0 - 20, y: browY - 56 }, { x: x0 + 5, y: browY - 40 }, { x: x0 + 30, y: browY - 56 }, { x: x0 + 46, y: browY - 44 },
        ], 22);
      }
      break;
    case 'none': default: break;
  }

  // ── eyes
  if (closed && eyes !== 'happy' && eyes !== 'happyLow' && eyes !== 'x') {
    line(ctx, cx - eyeDX - 41, eyeY, cx - eyeDX + 41, eyeY, 20);
    line(ctx, cx + eyeDX - 41, eyeY, cx + eyeDX + 41, eyeY, 20);
    eyes = 'dash'; // mark handled
  } else {
    const dotEye = (dx: number, dy: number) => {
      const er = ART_MODE ? ART.eyeR : 14;
      dot(ctx, cx - eyeDX + dx, eyeY + dy, er, INK, er + 1);
      dot(ctx, cx + eyeDX + dx, eyeY + dy, er, INK, er + 1);
    };
    switch (eyes) {
      case 'dot': dotEye(pupil.x * 8, pupil.y * 8); break;
      case 'dotClose': dotEye(0, 10); break;
      case 'dotUp': dotEye(10, -16); break;
      case 'dotDown': dotEye(0, 16); break;
      case 'dash':
        line(ctx, cx - eyeDX - 46, eyeY, cx - eyeDX + 46, eyeY, 22);
        line(ctx, cx + eyeDX - 46, eyeY, cx + eyeDX + 46, eyeY, 22);
        break;
      case 'ring':
      case 'ringSmall': {
        const small = eyes === 'ringSmall';
        const R0 = small ? 72 : 62;
        const pr = small ? 8 : 12;
        for (const side of [-1, 1]) {
          const ex = cx + side * (small ? 76 : 68);
          dot(ctx, ex, eyeY, R0, '#FFFFFF');
          ring(ctx, ex, eyeY, R0 - 10, 20);
          const lim = R0 - 10 - pr - 6;
          const px = clamp(pupil.x, -1, 1) * lim;
          const py = clamp(pupil.y, -1, 1) * lim;
          dot(ctx, ex + px, eyeY + py, pr);
        }
        break;
      }
      case 'happy':
      case 'happyLow': {
        const y = eyeY + (eyes === 'happyLow' ? 24 : 10);
        const up = eyes === 'happy';
        for (const side of [-1, 1]) {
          const ex = cx + side * eyeDX;
          ctx.strokeStyle = INK;
          ctx.lineWidth = ART_MODE ? 30 : 24;
          ctx.lineCap = 'round';
          ctx.beginPath();
          if (up) ctx.arc(ex, y + 10, 41, Math.PI * 1.05, Math.PI * 1.95);
          else ctx.arc(ex, y - 10, 41, Math.PI * 0.05, Math.PI * 0.95);
          ctx.stroke();
        }
        break;
      }
      case 'squint':
        strokePts(ctx, [{ x: cx - eyeDX - 24, y: eyeY - 22 }, { x: cx - eyeDX + 14, y: eyeY }, { x: cx - eyeDX - 24, y: eyeY + 22 }], 20);
        strokePts(ctx, [{ x: cx + eyeDX + 24, y: eyeY - 22 }, { x: cx + eyeDX - 14, y: eyeY }, { x: cx + eyeDX + 24, y: eyeY + 22 }], 20);
        break;
      case 'x':
        for (const side of [-1, 1]) {
          const ex = cx + side * eyeDX;
          line(ctx, ex - 26, eyeY - 26, ex + 26, eyeY + 26, 16);
          line(ctx, ex + 26, eyeY - 26, ex - 26, eyeY + 26, 16);
        }
        break;
    }
  }

  // ── glasses / sunglasses / monocle (over the eyes)
  if (look.accessories.has('glasses')) {
    for (const side of [-1, 1]) ring(ctx, cx + side * 68, eyeY, 56, 16);
    line(ctx, cx - 12, eyeY - 6, cx + 12, eyeY - 6, 12);
    line(ctx, cx - 124, eyeY - 10, cx - 190, eyeY - 30, 10);
  } else if (look.accessories.has('sunglasses')) {
    for (const side of [-1, 1]) {
      const g = roundRectPts(cx + side * 68 - 58, eyeY - 40, 116, 80, 26);
      fillPts(ctx, g, '#2B2533');
      strokePts(ctx, g, 12, INK, true);
    }
    line(ctx, cx - 12, eyeY - 10, cx + 12, eyeY - 10, 12);
    line(ctx, cx - 126, eyeY - 14, cx - 190, eyeY - 30, 10);
  } else if (look.accessories.has('monocle')) {
    ring(ctx, cx + 68, eyeY, 50, 14);
    strokePts(ctx, quad({ x: cx + 68, y: eyeY + 50 }, { x: cx + 110, y: eyeY + 140 }, { x: cx + 60, y: eyeY + 230 }), 7);
  }

  // ── beard (before the mouth so the mouth sits on it)
  if (look.accessories.has('beard')) {
    const col = look.hair ?? '#4A3A2E';
    const lower = ellipsePts(r.headC.x, r.headC.y, REF_HW / 2 + 10, hh / 2 + 12, 40, Math.PI * 0.12, Math.PI * 0.88);
    const chin = [...lower, { x: r.headC.x - 140, y: mouthY - 30 }, { x: cx, y: mouthY - 10 }, { x: r.headC.x + 230, y: mouthY - 30 }];
    inkShape(ctx, chin, col, 0.8);
  }

  // ── mouth (talking override)
  let mouth: MouthStyle = face.mouth;
  if (st.mouthOpen > 0.05) mouth = st.mouthOpen > 0.5 ? 'teeth' : 'o';
  const mx = cx + 10;
  // a moustache covers a closed mouth (only the moustache shows, as on the reference); an open mouth sits below it
  const tache = look.accessories.has('moustache');
  const shut = mouth === 'line' || mouth === 'lineSmall' || mouth === 'smirk' || mouth === 'frown' || mouth === 'wavy' || mouth === 'tilde';
  ctx.save();
  if (tache) ctx.translate(0, ART_MODE ? 24 : 34);
  if (!(tache && shut)) switch (mouth) {
    case 'line': line(ctx, mx - 50, mouthY, mx + 50, mouthY, 20); break;
    case 'lineSmall': line(ctx, mx - 30, mouthY, mx + 30, mouthY, 18); break;
    case 'smirk':
      strokePts(ctx, quad({ x: mx - 50, y: mouthY + 4 }, { x: mx + 10, y: mouthY + 14 }, { x: mx + 54, y: mouthY - 22 }), 20);
      break;
    case 'frown':
      strokePts(ctx, quad({ x: mx - 52, y: mouthY + 20 }, { x: mx, y: mouthY - 30 }, { x: mx + 52, y: mouthY + 20 }), 20);
      break;
    case 'o':
      dot(ctx, mx, mouthY + 10, 30, INK, 38);
      break;
    case 'oSmall': ring(ctx, mx, mouthY, 16, 14); break;
    case 'openOval': dot(ctx, mx, mouthY + 10, 51, INK, 37); break;
    case 'openSmall': dot(ctx, mx, mouthY + 10, 31, INK, 40); break;
    case 'teeth':
    case 'teethUp':
    case 'teethWide': {
      const w = mouth === 'teethWide' ? 154 : 112;
      const h = 50;
      const pts = roundRectPts(mx - w / 2, mouthY - h / 2, w, h, 12);
      fillPts(ctx, pts, '#FFFFFF');
      strokePts(ctx, pts, 14, INK, true);
      const n = mouth === 'teethWide' ? 6 : 5;
      for (let i = 1; i <= n; i++) line(ctx, mx - w / 2 + (w * i) / (n + 1), mouthY - h / 2 + 6, mx - w / 2 + (w * i) / (n + 1), mouthY + h / 2 - 6, 8);
      if (mouth !== 'teeth') {
        // corners up
        strokePts(ctx, quad({ x: mx - w / 2 - 14, y: mouthY - 20 }, { x: mx - w / 2 - 2, y: mouthY + 6 }, { x: mx - w / 2 + 6, y: mouthY + h / 2 }), 12);
        strokePts(ctx, quad({ x: mx + w / 2 + 14, y: mouthY - 20 }, { x: mx + w / 2 + 2, y: mouthY + 6 }, { x: mx + w / 2 - 6, y: mouthY + h / 2 }), 12);
      }
      break;
    }
    case 'grin':
    case 'grinTongue': {
      const w = 230;
      const h = 100;
      const pts = [
        { x: mx - w / 2, y: mouthY - 20 },
        { x: mx + w / 2, y: mouthY - 20 },
        ...ellipsePts(mx, mouthY - 20, w / 2, h, 30, 0, Math.PI).slice(1, -1),
      ];
      inkShape(ctx, pts, INK, 0.6);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(mx - w / 2 + 14, mouthY - 20, w - 28, 40);
      line(ctx, mx - w / 2 + 14, mouthY + 20, mx + w / 2 - 14, mouthY + 20, 8);
      if (mouth === 'grinTongue') {
        dot(ctx, mx + 20, mouthY + 58, 46, '#D6425A', 30);
      }
      break;
    }
    case 'dSmile': {
      const pts = [
        { x: mx - 52, y: mouthY - 6 },
        { x: mx + 52, y: mouthY - 6 },
        ...ellipsePts(mx, mouthY - 6, 52, 46, 20, 0, Math.PI).slice(1, -1),
      ];
      inkShape(ctx, pts, INK, 0.6);
      break;
    }
    case 'tongue': {
      const pts = [
        { x: mx - 52, y: mouthY - 6 },
        { x: mx + 52, y: mouthY - 6 },
        ...ellipsePts(mx, mouthY - 6, 52, 46, 20, 0, Math.PI).slice(1, -1),
      ];
      inkShape(ctx, pts, INK, 0.6);
      const tg = ellipsePts(mx + 24, mouthY + 44, 22, 34, 20);
      inkShape(ctx, tg, '#D6425A', 0.5);
      break;
    }
    case 'wavy':
      strokePts(ctx, [
        { x: mx - 46, y: mouthY + 6 }, { x: mx - 23, y: mouthY - 8 }, { x: mx, y: mouthY + 6 }, { x: mx + 23, y: mouthY - 8 }, { x: mx + 46, y: mouthY + 6 },
      ], 18);
      break;
    case 'tilde':
      strokePts(ctx, quad({ x: mx - 32, y: mouthY + 6 }, { x: mx - 10, y: mouthY - 20 }, { x: mx + 6, y: mouthY }), 16);
      strokePts(ctx, quad({ x: mx + 6, y: mouthY }, { x: mx + 22, y: mouthY + 20 }, { x: mx + 36, y: mouthY - 6 }), 16);
      break;
    case 'whistle':
      ring(ctx, mx + 26, mouthY, 14, 14);
      break;
  }

  ctx.restore();

  // ── toothbrush moustache: a small dark block under the nose
  if (look.accessories.has('toothbrush')) {
    const my = mouthY - 44;
    fillPts(ctx, roundRectPts(mx - 34, my - 22, 68, 40, 8), INK);
  }
  // ── moustache: a bushy handlebar between the eyes and the mouth (wider than the mouth, tips curled up), so it
  // never reads as a mouth; a frown / sad face droops the tips
  if (tache && ART_MODE) {
    // reference handlebar: sits right under the nose with a clear gap above the (shifted-down) mouth, two plump lobes
    // meeting in a dip, and tips that curl UP into small hooks; a highlight stroke on each lobe when it is ink-dark
    const my = mouthY - 46;
    const col = look.hair && !isDark(look.hair) ? look.hair : INK;
    const droop = mouth === 'frown' || face.brows === 'sadArch';
    for (const sd of [-1, 1]) {
      const tipX = mx + sd * 118;
      const tipY = my + (droop ? 26 : 4);
      const wing = [
        ...quad({ x: mx, y: my - 14 }, { x: mx + sd * 60, y: my - 52 }, { x: tipX, y: tipY }),
        ...quad({ x: tipX, y: tipY }, { x: mx + sd * 70, y: my + 46 }, { x: mx, y: my + 22 }).slice(1),
      ];
      inkShape(ctx, wing, col, 0.45);
      // curled tip: a hook rolling up and back toward the face (down when sad)
      const up = droop ? 1 : -1;
      strokePts(ctx, quad({ x: tipX - sd * 4, y: tipY }, { x: tipX + sd * 34, y: tipY + up * 6 }, { x: tipX + sd * 30, y: tipY + up * 36 }), 15, col === INK ? INK : shade(col, 0.6));
      dot(ctx, tipX + sd * 22, tipY + up * 38, 10, col === INK ? INK : shade(col, 0.6));
      if (col === INK) strokePts(ctx, quad({ x: mx + sd * 22, y: my - 10 }, { x: mx + sd * 56, y: my - 30 }, { x: mx + sd * 88, y: my - 12 }), 7, '#6d5a66');
    }
  } else if (tache) {
    const my = mouthY - 34;
    const col = look.hair && !isDark(look.hair) ? look.hair : INK;
    const tip = mouth === 'frown' || face.brows === 'sadArch' ? 22 : -6;
    for (const sd of [-1, 1]) {
      // each wing humps up from a dip under the nose and comes down to a tip at the side: two arches, the opposite
      // of a smile's curve
      const wing = [
        ...quad({ x: mx, y: my - 8 }, { x: mx + sd * 58, y: my - 58 }, { x: mx + sd * 126, y: my + tip }),
        ...quad({ x: mx + sd * 126, y: my + tip }, { x: mx + sd * 76, y: my + 44 }, { x: mx, y: my + 26 }),
      ];
      if (col === INK) fillPts(ctx, wing, INK);
      else inkShape(ctx, wing, col, 0.5);
    }
  }

  drawExtras(ctx, r, look, (face.extras ?? []) as string[], cx, eyeDX, eyeY, top, hh);
}

// ───────────────────────────── main ─────────────────────────────
function headYForWalk(st: DrawState, r: Rig) {
  // walk/run bounce: peak-to-peak 0.2 HW once per step (10.5 f); squash at the low point
  if (st.pose !== 'walk' && st.pose !== 'run') return;
  const ph = st.walkPhase * Math.PI * 2;
  const h = 0.5 * (1 + Math.cos(2 * ph)); // 1 = legs passing (top), 0 = max spread (bottom)
  const amp = st.pose === 'run' ? 0.12 : 0.1;
  r.dy = -(amp * REF_HW) * (2 * h - 1);
  r.sx = lerp(1.15, 0.95, h);
  r.sy = lerp(0.9, 1.05, h);
  if (st.pose === 'run') r.lean = 10 * D;
}

/**
 * Draw the whole figure (no ground shadow) into `ctx`'s canvas, which is resized to fit.
 * Returns the canvas metrics in px.
 */
export function drawCharacterCard(
  ctx: Ctx,
  spec: CharacterSpec,
  state: DrawState,
  px: { headW: number },
): CardMetrics {
  const s = px.headW / REF_HW;
  const look = resolveLook(spec);
  const horizontal = state.pose === 'lie' || state.pose === 'dead';
  const wide = horizontal || WIDE_POSES.has(state.pose) || (look.prop !== undefined && WIDE_PROPS.has(look.prop));
  const bodyW = (state.pose === 'rig' ? 3.2 : wide ? WIDE_W : NARROW_W) * REF_HW; // body-frame canvas width
  const bodyH = CARD_H * REF_HW;
  const Wref = horizontal ? bodyH : bodyW;
  const Href = horizontal ? bodyW : bodyH;
  const W = Math.ceil(Wref * s);
  const H = Math.ceil(Href * s);
  const canvas = ctx.canvas as HTMLCanvasElement | OffscreenCanvas;
  if (canvas.width !== W) canvas.width = W;
  if (canvas.height !== H) canvas.height = H;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  ctx.scale(s, s);

  // layout transform (body frame → canvas). Keep the ink-weight matrix in sync.
  let ma = 1, mb = 0, mc = 0, md = 1;
  if (state.facing === -1) {
    ctx.translate(Wref, 0);
    ctx.scale(-1, 1);
    ma = -1;
  }
  if (horizontal) {
    // body (x,y) → (y, bodyW - x): head left, feet right, face up
    ctx.translate(0, bodyW);
    ctx.rotate(-Math.PI / 2);
    // compose: rotation R = [[0,1],[-1,0]] applied first then the mirror
    const ra = 0, rb = -1, rc = 1, rd = 0;
    const na = ma * ra + mc * rb, nb = mb * ra + md * rb, nc = ma * rc + mc * rd, nd = mb * rc + md * rd;
    ma = na; mb = nb; mc = nc; md = nd;
  }
  setInkMatrix(ma, mb, mc, md);

  const rig = buildRig(bodyW / 2, look);
  headYForWalk(state, rig);
  if (state.pose === 'sit') rig.dy = 410 - (rig.footY - rig.torsoBottom) + 0; // hips drop toward seat height
  if (state.pose === 'crouch') rig.dy = 0.5 * REF_HH;
  if (state.pose === 'rig' && state.joints) { rig.dy = state.joints.dy ?? 0; rig.lean = 0.45 * (state.joints.lean ?? 0); }
  const limbs = buildLimbs(rig, state, look);

  // 1. legs + feet (body frame; hips already transformed)
  for (const leg of limbs.legs) strokePts(ctx, leg, LIMB);
  for (const f of limbs.feet) {
    ctx.save();
    ctx.translate(f.at.x, f.at.y);
    ctx.rotate(f.angle);
    dot(ctx, 0, 0, FOOT_W / 2, INK, FOOT_H / 2);
    ctx.restore();
  }

  // upper body transform: translate(dy) + scale/lean about the pivot
  ctx.save();
  ctx.translate(rig.pivot.x, rig.pivot.y + rig.dy);
  ctx.scale(rig.sx, rig.sy);
  ctx.rotate(rig.lean);
  ctx.translate(-rig.pivot.x, -rig.pivot.y);

  // 2. back arm (+ hand, + back prop)
  strokePts(ctx, limbs.armBack, LIMB);
  const hb = limbs.armBack[limbs.armBack.length - 1];
  dot(ctx, hb.x, hb.y, HAND_R);
  if (limbs.pointing && limbs.handBack && limbs.pointing[0] === limbs.handBack) strokePts(ctx, limbs.pointing, 22);
  const sideProp = look.prop && SIDE_CARRY.has(look.prop);
  if (look.prop === 'shield') drawProp(ctx, 'shield', { x: hb.x - 40, y: hb.y - 60 }, undefined, look);

  // 3. torso
  drawTorso(ctx, rig, look);

  // 4. front arm + hand + prop
  strokePts(ctx, limbs.armFront, LIMB);
  const hf = limbs.armFront[limbs.armFront.length - 1];
  dot(ctx, hf.x, hf.y, HAND_R);
  if (limbs.pointing && limbs.handFront && limbs.pointing[0] === limbs.handFront) strokePts(ctx, limbs.pointing, 22);
  if (look.prop && look.prop !== 'shield' && !horizontal) {
    if (sideProp) drawProp(ctx, look.prop, hf, undefined, look);
    else drawProp(ctx, look.prop, limbs.handFront ?? hf, limbs.bothHands ? limbs.handBack : undefined, look);
    // re-draw the gripping hand with a thumb notch over the prop
    dot(ctx, hf.x, hf.y, HAND_R + 2);
    line(ctx, hf.x, hf.y, hf.x + 16, hf.y - 18, 12);
  }

  // 5. head (with optional tilt about its centre)
  const face = FACES[state.expr] ?? FACES.neutral;
  ctx.save();
  if (face.tilt) {
    ctx.translate(rig.headC.x, rig.headC.y);
    ctx.rotate(face.tilt * D);
    ctx.translate(-rig.headC.x, -rig.headC.y);
  }
  drawHead(ctx, rig, look);
  // 6. hair, then hat (hat covers hair)
  drawHair(ctx, rig, look);
  // 7. face
  drawFace(ctx, rig, look, state);
  drawHat(ctx, rig, look);
  ctx.restore();

  ctx.restore(); // upper body transform
  ctx.restore(); // layout
  setInkMatrix(1, 0, 0, 1);

  // metrics (canvas px)
  const hc = xf(rig, rig.headC);
  let headCenter: Pt;
  let feetY: number;
  if (horizontal) {
    headCenter = { x: hc.y * s, y: (bodyW - hc.x) * s };
    feetY = (bodyW - (rig.cx - TORSO_W / 2 - THICK / 2)) * s; // the torso's back edge rests on the ground
  } else {
    headCenter = { x: (state.facing === -1 ? Wref - hc.x : hc.x) * s, y: hc.y * s };
    feetY = rig.footY * s;
  }
  return { w: W, h: H, feetY, headCenter, standH: HEADS_TALL * REF_HH * s, unit: s };
}

/** Which canvas size class a given spec/pose produces (useful for pre-sizing planes). */
export function cardSizeRef(spec: CharacterSpec, pose: Pose): { wRef: number; hRef: number } {
  const look = resolveLook(spec);
  const horizontal = pose === 'lie' || pose === 'dead';
  const wide = horizontal || WIDE_POSES.has(pose) || (look.prop !== undefined && WIDE_PROPS.has(look.prop));
  const bodyW = (wide ? WIDE_W : NARROW_W) * REF_HW;
  const bodyH = CARD_H * REF_HW;
  return horizontal ? { wRef: bodyH, hRef: bodyW } : { wRef: bodyW, hRef: bodyH };
}

export const CARD_CONSTANTS = {
  REF_HW, REF_HH, THIN, THICK, LIMB, HAND_R, TORSO_W, TORSO_H, HEAD_OVERLAP, ARM_LEN, FOOT_W, FOOT_H, HAT_ROOM,
  HEADS_TALL, FACE_SHIFT, NARROW_W, WIDE_W, CARD_H,
};

// ───────────────────────────── stickman-3d: face decal + resolved look for the 3D character ─────────────────────────────
/** The face alone (brows, eyes, mouth, glasses / beard / moustache) centred on the head, for the 3D head's front decal.
 *  The square canvas spans FACE_SPAN head-widths around the head centre (head width = REF_HW ref px = the 3D head's
 *  diameter), transparent everywhere else. Same expressions, blinks and talking mouths as the flat cards. */
export const FACE_SPAN = 1.25;
export function drawFaceDecal(ctx: Ctx, spec: CharacterSpec, state: DrawState, px: number): void {
  const look = resolveLook(spec);
  const rig = buildRig(0, look);
  const canvas = ctx.canvas as HTMLCanvasElement | OffscreenCanvas;
  if (canvas.width !== px) canvas.width = px;
  if (canvas.height !== px) canvas.height = px;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, px, px);
  const s = px / (REF_HW * FACE_SPAN);
  ctx.save();
  ctx.scale(s, s);
  ctx.translate((REF_HW * FACE_SPAN) / 2 - rig.headC.x - FACE_SHIFT, (REF_HW * FACE_SPAN) / 2 - rig.headC.y);
  setInkMatrix(1, 0, 0, 1);
  drawFace(ctx, rig, look, { ...state, facing: 1 });
  ctx.restore();
}

/** the resolved (seeded) look of a cast spec: what the 3D builder needs for colours, hair and hat */
export function lookOf(spec: CharacterSpec) {
  const l = resolveLook(spec);
  return {
    skin: l.skin, torso: l.torso, torsoPattern: l.torsoPattern, legs: l.legs, hat: l.hat, hatColor: l.hatColor,
    hair: l.hair, hairStyle: l.hairStyle, accessories: [...l.accessories], prop: l.prop, headRatio: l.headRatio,
  };
}

// ───────────────────────────── stickman-3d: flat art layers (RicksClips style sheet, references/RC_CHARACTER_STYLE.md) ─────────────────────────────
// The 3D figure is built from flat painted layers that face the lens: head (skin + hair + face), hat, torso (costume
// pattern + accessories), skirt. They are drawn by the SAME functions as the flat cards, with the measured pen:
// near-uniform outline (4.6 % of the head height), dark purple-brown ink, head W/H 1.10.
export const ART = {
  ink: '#2a1c24', // measured outline / limb colour (never pure black)
  // outline pen at HW = 512: near-uniform (the 2026 videos), a touch heavier lower right. Nominal 6 % of the head
  // height: after texture filtering at film size it reads as the measured ~4-5 % (19 / 25 read as ~3 %)
  thin: 26,
  thick: 31,
  face: 1.1, // the face group (brows, eyes, mouth, moustache) drawn this much larger about 55 % down the head
  faceDrop: 22, // ref px the face group sits lower (brows clear of hat brims)
  hatLift: 20, // ref px every hat sits higher on the head layer
  eyeR: 22, // dot-eye radius (ref px): 8-9 % of the head width after `face` (measured 9-11 %)
  headRatio: 1.1, // head width / height (median of 12 figures)
  W: 2.4, // head + hat canvas, in head widths: W wide, UP above and DOWN below the head centre
  UP: 1.3,
  DOWN: 1.2,
  torsoPad: 26, // ref px around the torso capsule (room for the outline)
  skirtW: 510, // skirt canvas in ref px (hem width x length); the mesh squeezes its top edge
  skirtH: 620,
};
/** reference-pixel sizes the 3D builder converts to metres (1 head width = REF_HW ref px) */
export const ART_REF = { HW: REF_HW, TORSO_W, TORSO_H, HEAD_OVERLAP, LIMB, HAND_R: 25, FOOT: 92 };

function withArtPen<T>(f: () => T): T {
  const keep: [string, number, number, boolean] = [INK, THIN, THICK, ART_MODE];
  INK = ART.ink;
  THIN = ART.thin;
  THICK = ART.thick;
  ART_MODE = true;
  setInkMatrix(1, 0, 0, 1);
  try {
    return f();
  } finally {
    [INK, THIN, THICK, ART_MODE] = keep;
  }
}
function artLook(spec: CharacterSpec): Look {
  const look = resolveLook(spec);
  look.headRatio *= ART.headRatio / 1.05;
  return look;
}
/** size + clear the head canvas, return the rig whose head centre sits at (W/2, UP) head widths; ctx is left scaled */
function headCanvas(ctx: Ctx, look: Look, px: number): Rig {
  const canvas = ctx.canvas as HTMLCanvasElement | OffscreenCanvas;
  const w = Math.round(ART.W * px);
  const h = Math.round((ART.UP + ART.DOWN) * px);
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const rig = buildRig(0, look);
  const s = px / REF_HW;
  ctx.scale(s, s);
  ctx.translate((ART.W / 2) * REF_HW - rig.headC.x, ART.UP * REF_HW - rig.headC.y);
  return rig;
}
/** head layer: skin ellipse, hair, face (expression, blink, talking mouth, glasses / beard / moustache); px = pixels
 *  per head width. Drawn looking toward +x (the builder mirrors the layer for the other way). */
export function drawHeadArt(ctx: Ctx, spec: CharacterSpec, state: DrawState, px: number): void {
  withArtPen(() => {
    const look = artLook(spec);
    ctx.save();
    const rig = headCanvas(ctx, look, px);
    const face = FACES[state.expr] ?? FACES.neutral;
    if (face.tilt && !state.face) {
      ctx.translate(rig.headC.x, rig.headC.y);
      ctx.rotate(face.tilt * D);
      ctx.translate(-rig.headC.x, -rig.headC.y);
    }
    drawHead(ctx, rig, look);
    drawHair(ctx, rig, look);
    // the face group is drawn ART.face larger about a point 55 % down the head (the reference's faces fill more of
    // the head than the cards'); eyes land ~40 %, the mouth ~72 % down
    const fy = rig.headC.y + (0.55 - 0.5) * (REF_HW / look.headRatio);
    ctx.save();
    const fx = rig.headC.x + FACE_SHIFT;
    ctx.translate(fx, fy);
    ctx.scale(ART.face, ART.face);
    ctx.translate(-fx, -fy + ART.faceDrop);
    if (state.face) drawFaceRig(ctx, rig, look, state.face);
    else drawFace(ctx, rig, look, { ...state, facing: 1 });
    ctx.restore();
    if (look.accessories.has('bandage')) {
      // survivor2: gauze wrap over the forehead + a pad on the back cheek (drawn on the head layer, art mode only)
      ctx.save();
      const hr = rig;
      const c = hr.headC, rx = REF_HW / 2, ry = rx / look.headRatio;
      ctx.save();
      pathOf(ctx, headPts(hr, look));
      ctx.clip();
      const band: Pt[] = [
        { x: c.x - rx - 10, y: c.y - ry * 0.92 }, { x: c.x + rx + 10, y: c.y - ry * 1.04 },
        { x: c.x + rx + 10, y: c.y - ry * 0.8 }, { x: c.x - rx - 10, y: c.y - ry * 0.68 },
      ];
      fillPts(ctx, band, '#f4f1ea');
      strokePts(ctx, band, 9, INK, true);
      line(ctx, c.x - rx * 0.6, c.y - ry * 0.8, c.x - rx * 0.1, c.y - ry * 0.87, 5, '#c9c0b0');
      line(ctx, c.x + rx * 0.1, c.y - ry * 0.89, c.x + rx * 0.6, c.y - ry * 0.94, 5, '#c9c0b0');
      ctx.restore();
      const pad = roundRectPts(c.x - rx * 0.8, c.y + ry * 0.02, rx * 0.46, ry * 0.5, 22);
      fillPts(ctx, pad, '#f4f1ea');
      strokePts(ctx, pad, 9, INK, true);
      line(ctx, c.x - rx * 0.8, c.y + ry * 0.27, c.x - rx * 0.34, c.y + ry * 0.27, 6, '#c9c0b0');
      dot(ctx, c.x - rx * 0.57, c.y + ry * 0.17, 14, '#c86a4a');
      ctx.restore();
    }
    ctx.restore();
  });
}
/** 3D-mesh hair (char3d/toon.tsx): the hair alone on the head layer's canvas frame; false when the cast has no hair */
export function drawHairArt(ctx: Ctx, spec: CharacterSpec, px: number): boolean {
  return withArtPen(() => {
    const look = artLook(spec);
    ctx.save();
    const rig = headCanvas(ctx, look, px);
    drawHair(ctx, rig, look);
    ctx.restore();
    return !!look.hair;
  });
}
/** hat layer on the same canvas frame as the head layer (so it can lift off the head); false when the cast has no hat */
export function drawHatArt(ctx: Ctx, spec: CharacterSpec, px: number): boolean {
  return withArtPen(() => {
    const look = artLook(spec);
    ctx.save();
    const rig = headCanvas(ctx, look, px);
    ctx.translate(0, -ART.hatLift);
    drawHat(ctx, rig, look);
    ctx.restore();
    return look.hat !== 'none';
  });
}
/** torso layer: the capsule with the cast's pattern (buttons, lapels, vest, belt, stripes, plaid, poncho, dress
 *  bodice) and torso accessories (tie, bowtie, scarf, badge, apron); px = pixels per head width */
export function drawTorsoArt(ctx: Ctx, spec: CharacterSpec, px: number): void {
  withArtPen(() => {
    const look = artLook(spec);
    const s = px / REF_HW;
    const canvas = ctx.canvas as HTMLCanvasElement | OffscreenCanvas;
    const w = Math.round((TORSO_W + 2 * ART.torsoPad) * s);
    const h = Math.round((TORSO_H + 2 * ART.torsoPad) * s);
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.scale(s, s);
    const rig = buildRig(ART.torsoPad + TORSO_W / 2, look);
    ctx.translate(0, ART.torsoPad - rig.torsoTop);
    drawTorso(ctx, rig, look, false);
    ctx.restore();
    shadeCloth(ctx, w, h, s, spec.seed ?? spec.id);
  });
}
/** BUILD_LESSONS #22: cloth depth on the flat torso layer (painted only over the torso's own pixels): a form shadow
 *  on the side away from the key, a soft highlight on the lit side, a collar shadow under the head, two fold creases
 *  and a fine fabric weave. */
function shadeCloth(ctx: Ctx, w: number, h: number, s: number, seedId: string) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'source-atop';
  const side = ctx.createLinearGradient(0, 0, w, 0);
  side.addColorStop(0, 'rgba(255,245,225,0.16)'); side.addColorStop(0.35, 'rgba(255,245,225,0)');
  side.addColorStop(0.62, 'rgba(20,10,30,0)'); side.addColorStop(1, 'rgba(20,10,30,0.34)');
  ctx.fillStyle = side; ctx.fillRect(0, 0, w, h);
  const col = ctx.createLinearGradient(0, 0, 0, h * 0.22);
  col.addColorStop(0, 'rgba(20,10,30,0.38)'); col.addColorStop(1, 'rgba(20,10,30,0)');
  ctx.fillStyle = col; ctx.fillRect(0, 0, w, h * 0.22);
  const bot = ctx.createLinearGradient(0, h * 0.7, 0, h);
  bot.addColorStop(0, 'rgba(20,10,30,0)'); bot.addColorStop(1, 'rgba(20,10,30,0.22)');
  ctx.fillStyle = bot; ctx.fillRect(0, h * 0.7, w, h * 0.3);
  ctx.strokeStyle = 'rgba(20,10,30,0.22)'; ctx.lineCap = 'round'; ctx.lineWidth = 9 * s;
  let k = 0; for (const c of seedId) k = (k * 31 + c.charCodeAt(0)) % 997;
  for (const [x0, y0, x1, y1] of [[0.3, 0.55, 0.42, 0.92], [0.7, 0.5, 0.6, 0.88]]) {
    const j = ((k % 7) - 3) * 0.01;
    ctx.beginPath(); ctx.moveTo(w * (x0 + j), h * y0); ctx.quadraticCurveTo(w * (x0 + x1) / 2 + 14 * s, h * (y0 + y1) / 2, w * (x1 + j), h * y1); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(0,0,0,0.05)';
  const step = Math.max(2, Math.round(6 * s));
  for (let y = 0; y < h; y += step) for (let x = (y / step) % 2 ? step / 2 : 0; x < w; x += step) ctx.fillRect(x, y, Math.max(1, s * 2), Math.max(1, s * 2));
  ctx.restore();
}
/** skirt layer ('dress'): a full rectangle of cloth with ink on both sides and along a curved hem, fold lines inside;
 *  the 3D builder maps it on a trapezoid (hips -> hem) shaped by the legs */
export function drawSkirtArt(ctx: Ctx, spec: CharacterSpec, px: number): void {
  withArtPen(() => {
    const look = artLook(spec);
    const s = px / REF_HW;
    const canvas = ctx.canvas as HTMLCanvasElement | OffscreenCanvas;
    const w = Math.round(ART.skirtW * s);
    const h = Math.round(ART.skirtH * s);
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.scale(s, s);
    const W = ART.skirtW;
    const H = ART.skirtH;
    const col = look.legs || look.torso;
    const hem = quad({ x: W, y: H - 44 }, { x: W / 2, y: H + 10 }, { x: 0, y: H - 44 }, 16);
    const pts: Pt[] = [{ x: 0, y: 0 }, { x: W, y: 0 }, ...hem];
    fillPts(ctx, pts, col);
    ctx.save();
    pathOf(ctx, pts);
    ctx.clip();
    const dk = shade(col, 0.8);
    for (const k of [0.22, 0.5, 0.78]) strokePts(ctx, quad({ x: W * (0.5 + (k - 0.5) * 0.6), y: 90 }, { x: W * k, y: H / 2 }, { x: W * k, y: H - 60 }), 7, dk);
    const pen = (THIN + THICK) / 2;
    strokePts(ctx, [{ x: 0, y: 0 }, { x: 0, y: H - 44 }], pen * 2); // half of each side stroke is clipped away
    strokePts(ctx, [{ x: W, y: 0 }, { x: W, y: H - 44 }], pen * 2);
    strokePts(ctx, hem, pen * 2);
    ctx.restore();
    ctx.restore();
  });
}

// ───────────────────────────── slider face (stickman-3d, 2026-11-19) ─────────────────────────────
// The RicksClips face is a puppet of sliders, not a set of pictures: brows, eyes and mouth move on their own and pass
// through in-between shapes (measured frame by frame on TRU 36-40 s). An expression is a set of slider values
// (faceParamsOf); char3d/faceAnim.ts eases between them with staggered timing, and drawFaceRig draws any in-between.
// Second pass (same day, RC close-up comparison): eyelids (their most-used attitude: half-lidded dot eyes), gaze
// (characters look at each other / at things, not at the lens), asymmetry (lopsided mouths, mouth off-centre, one
// brow cocked) and feature sizes back to the measured style sheet (§4).
export interface FaceParams {
  /** brow vertical offset in ref px (+ = down), [back brow, front brow] */
  bY: [number, number];
  /** brow tilt in degrees, + = inner end UP (sad / worried), - = inner end down (angry) */
  bTilt: [number, number];
  /** 0 straight .. 1 arched */
  bArch: [number, number];
  bLen: number;
  /** 0 shut .. 1 open (blinks multiply it) */
  eOpen: number;
  /** 0 dot eyes .. 1 big ring eyes with a pupil */
  eBig: number;
  /** 1 = happy closed arcs, -1 = low-lid arcs (cry / sleepy), 0 = none */
  eHappy: number;
  pX: number;
  pY: number;
  /** upper eyelid 0 (none) .. 1 (shut) per eye [back, front]: 0.4-0.6 = RC's half-lidded attitude */
  lid: [number, number];
  /** eyelid tilt in degrees per eye, + = inner end up (sad, droopy), - = inner end down (angry, suspicious) */
  lidTilt: [number, number];
  /** lower lid / cheek push 0..0.6 (smug squint, laugh) */
  lidB: number;
  /** gaze, -1..1: + x = toward the facing side, + y = down. Set by the 3D head from a look target */
  gX: number;
  gY: number;
  /** 0 closed .. 1 wide open */
  mOpen: number;
  /** mouth half width in ref px */
  mW: number;
  /** -1 frown .. 1 smile */
  mCurve: number;
  /** -1..1: the front corner up and the back corner down (+), a lopsided mouth */
  mTwist: number;
  /** mouth sideways offset in ref px (+ = toward the facing side) */
  mShift: number;
  /** 0..1 share of the open mouth filled with teeth from the top (1 = grimace) */
  teeth: number;
  tongue: number;
  /** head tilt in degrees toward the facing side (applied by the 3D head, not on the canvas) */
  tilt: number;
  extras: string[];
  /** anime eye mode / mouth (switch at the half-way point of the eye / mouth ease); undefined = the slider face */
  anime?: AnimeEyes;
  amouth?: AnimeMouth;
}

const BROW_P: Record<BrowStyle, Pick<FaceParams, 'bY' | 'bTilt' | 'bArch' | 'bLen'>> = {
  flat: { bY: [0, 0], bTilt: [0, 0], bArch: [0, 0], bLen: 1 },
  lowFlat: { bY: [20, 20], bTilt: [0, 0], bArch: [0, 0], bLen: 1 },
  angryV: { bY: [14, 14], bTilt: [-24, -24], bArch: [0, 0], bLen: 1.1 },
  sternV: { bY: [8, 8], bTilt: [-13, -13], bArch: [0, 0], bLen: 1 },
  sadArch: { bY: [-10, -10], bTilt: [26, 26], bArch: [0, 0], bLen: 1.05 },
  raised: { bY: [-40, -40], bTilt: [6, 6], bArch: [0.3, 0.3], bLen: 0.92 },
  arched: { bY: [-12, -12], bTilt: [0, 0], bArch: [1, 1], bLen: 1 },
  asym: { bY: [-30, -4], bTilt: [0, -8], bArch: [0.8, 0], bLen: 1 },
  asymUD: { bY: [-36, 12], bTilt: [8, -14], bArch: [0, 0], bLen: 1 },
  oneUp: { bY: [4, -46], bTilt: [0, 12], bArch: [0, 0.3], bLen: 1 },
  wavy: { bY: [-44, -44], bTilt: [14, 14], bArch: [0.4, 0.4], bLen: 1 },
  none: { bY: [0, 0], bTilt: [0, 0], bArch: [0, 0], bLen: 0 },
};
const EYE_P: Record<EyeStyle, Pick<FaceParams, 'eOpen' | 'eBig' | 'eHappy' | 'pX' | 'pY'>> = {
  dot: { eOpen: 1, eBig: 0, eHappy: 0, pX: 0, pY: 0 },
  dotClose: { eOpen: 0.85, eBig: 0, eHappy: 0, pX: 0, pY: 0.4 },
  dotUp: { eOpen: 1, eBig: 0, eHappy: 0, pX: 0.5, pY: -0.8 },
  dotDown: { eOpen: 0.9, eBig: 0, eHappy: 0, pX: 0, pY: 0.8 },
  dash: { eOpen: 0, eBig: 0, eHappy: 0, pX: 0, pY: 0 },
  ring: { eOpen: 1, eBig: 1, eHappy: 0, pX: 0, pY: 0 },
  ringSmall: { eOpen: 1, eBig: 0.8, eHappy: 0, pX: 0, pY: 0 },
  happy: { eOpen: 1, eBig: 0, eHappy: 1, pX: 0, pY: 0 },
  happyLow: { eOpen: 1, eBig: 0, eHappy: -1, pX: 0, pY: 0 },
  squint: { eOpen: 0.2, eBig: 0, eHappy: 0, pX: 0, pY: 0 },
  x: { eOpen: 0, eBig: 0, eHappy: 0, pX: 0, pY: 0 },
};
// mouth half widths from the style sheet: closed 10-20 % of the head width, a laugh up to 38 % (after ART.face)
const MOUTH_P: Record<MouthStyle, Pick<FaceParams, 'mOpen' | 'mW' | 'mCurve' | 'teeth' | 'tongue'>> = {
  line: { mOpen: 0, mW: 36, mCurve: 0, teeth: 0, tongue: 0 },
  lineSmall: { mOpen: 0, mW: 24, mCurve: 0, teeth: 0, tongue: 0 },
  smirk: { mOpen: 0, mW: 38, mCurve: 0.35, teeth: 0, tongue: 0 },
  frown: { mOpen: 0, mW: 40, mCurve: -1, teeth: 0, tongue: 0 },
  wavy: { mOpen: 0, mW: 34, mCurve: -0.35, teeth: 0, tongue: 0 },
  tilde: { mOpen: 0, mW: 28, mCurve: -0.2, teeth: 0, tongue: 0 },
  o: { mOpen: 0.5, mW: 24, mCurve: 0, teeth: 0, tongue: 0 },
  oSmall: { mOpen: 0.3, mW: 15, mCurve: 0, teeth: 0, tongue: 0 },
  openOval: { mOpen: 0.7, mW: 40, mCurve: 0, teeth: 0, tongue: 0.3 },
  openSmall: { mOpen: 0.58, mW: 24, mCurve: 0, teeth: 0, tongue: 0 },
  teeth: { mOpen: 0.4, mW: 46, mCurve: -0.1, teeth: 1, tongue: 0 },
  teethUp: { mOpen: 0.4, mW: 46, mCurve: 0.6, teeth: 1, tongue: 0 },
  teethWide: { mOpen: 0.42, mW: 60, mCurve: 0.15, teeth: 1, tongue: 0 },
  grin: { mOpen: 0.8, mW: 86, mCurve: 1, teeth: 0.4, tongue: 0 },
  grinTongue: { mOpen: 0.9, mW: 86, mCurve: 1, teeth: 0.35, tongue: 1 },
  dSmile: { mOpen: 0.55, mW: 44, mCurve: 1, teeth: 0, tongue: 0.4 },
  tongue: { mOpen: 0.5, mW: 42, mCurve: 0.8, teeth: 0, tongue: 1 },
  whistle: { mOpen: 0.24, mW: 11, mCurve: 0, teeth: 0, tongue: 0 },
};
/** per-expression extras on top of the style mapping: lids, lopsided mouths, mouth offsets (RC close-ups) */
const FACE_OVER: Partial<Record<AnyExpression, Partial<FaceParams>>> = {
  neutral: { lid: [0.08, 0.08] }, // was 0.18: every resting face looked bored
  smug: { lid: [0.5, 0.42], lidTilt: [-6, -6], mTwist: 0.8, mShift: 16, mCurve: 0.2 },
  bored: { eOpen: 1, lid: [0.55, 0.55], lidTilt: [8, 8], mShift: 14, mW: 22 },
  sleepy: { eOpen: 1, eHappy: 0, lid: [0.72, 0.72], lidTilt: [10, 10] },
  stern: { lid: [0.35, 0.35], lidTilt: [-14, -14] },
  angry: { lid: [0.18, 0.18], lidTilt: [-16, -16] },
  evil: { lid: [0.45, 0.45], lidTilt: [-20, -20], mTwist: 0.4 },
  sad: { lid: [0.3, 0.3], lidTilt: [18, 18], mShift: -6 },
  worried: { lid: [0.12, 0.12], lidTilt: [14, 14], mTwist: -0.3, mShift: 8 },
  confused: { lid: [0.3, 0], mTwist: -0.5, mShift: 14 },
  effort: { lidB: 0.2 },
  happy: { lidB: 0.2 },
  laugh: { lidB: 0.25 },
  grin: { lid: [0, 0], lidB: 0.12 }, // was lid 0.25 + a twist: read as smug (2026-11-24)
  whistle: { mShift: 18 },
  suspicious: { lid: [0.55, 0.4], lidTilt: [-10, -4], mTwist: -0.4, mShift: 14, gX: 0.9 },
  smirk: { lid: [0.38, 0.32], mTwist: 0.9, mShift: 18, mCurve: 0.3 },
  unimpressed: { lid: [0.5, 0.5], lidTilt: [0, 0], mShift: 12, mW: 26, mCurve: -0.15 },
  tired: { lid: [0.62, 0.62], lidTilt: [14, 14], mW: 24, mCurve: -0.3, extras: [] },
  eager: { eBig: 0.35, lid: [0, 0], mW: 50 },
  excited: { lidB: 0.1 },
  awkward: { gX: -0.8, gY: 0.2, mW: 30, mShift: -10 },
  embarrassed: { lid: [0.25, 0.25], lidTilt: [12, 12], gX: -0.6, gY: 0.6, mW: 26, mTwist: -0.3 },
  relieved: { lidB: 0.15, mW: 40 },
  deadpan: { lid: [0.42, 0.42], lidTilt: [0, 0], mW: 30 },
  hopeful: { eBig: 0.25, lid: [0, 0], mCurve: 0.4, mW: 30 },
  proud: { lidB: 0.25, mTwist: 0.5, mShift: 10, mCurve: 0.5 },
  surprised: { eBig: 0.8, mOpen: 0.45, mW: 22 },
  curious: { eBig: 0.2, lid: [0.1, 0], gX: 0.4 },
  annoyed: { lid: [0.4, 0.4], lidTilt: [-10, -10], mW: 32, mCurve: -0.2 },
  thinking: { lid: [0.15, 0.15], gX: 0.6, gY: -0.8, mShift: 16 },
  wince: { lidB: 0.3, mW: 52 },
  shy: { lid: [0.3, 0.3], lidTilt: [10, 10], gX: -0.5, gY: 0.7, mCurve: 0.2 },
  sheepish: { lid: [0.1, 0.1], gX: -0.4, mW: 44, mTwist: 0.2 },
};
/** the slider values of a named expression */
export function faceParamsOf(expr: AnyExpression): FaceParams {
  const f = FACES[expr] ?? FACES.neutral;
  const b = BROW_P[f.brows];
  const base: FaceParams = {
    bY: [...b.bY] as [number, number], bTilt: [...b.bTilt] as [number, number], bArch: [...b.bArch] as [number, number], bLen: b.bLen,
    ...EYE_P[f.eyes], lid: [0, 0], lidTilt: [0, 0], lidB: 0, gX: 0, gY: 0,
    ...MOUTH_P[f.mouth], mTwist: 0, mShift: 0, tilt: f.tilt ?? 0, extras: [...(f.extras ?? [])],
    anime: f.anime, amouth: f.amouth,
  };
  const o = FACE_OVER[expr];
  return o ? { ...base, ...o, lid: [...(o.lid ?? base.lid)] as [number, number], lidTilt: [...(o.lidTilt ?? base.lidTilt)] as [number, number] } : base;
}

/** the mOpen an anime mouth has on its own (the talking test compares against it) */
const MOUTH_OPEN_OF: Record<string, number> = { cat: 0, tiny: 0, wobble: 0, pout: 0, shout: 0.8 };
/** anime eyes, both sides, in the head frame (cx = face centre, gx / gy = gaze -1..1) */
function drawAnimeEyes(ctx: Ctx, kind: AnimeEyes, cx: number, eyeY: number, eyeDX: number, gx: number, gy: number) {
  for (const s of [-1, 1]) {
    const ex = cx + s * eyeDX;
    switch (kind) {
      case 'sparkle': {
        // big glossy eyes: a tall dark oval, two white highlights and a small star
        const px = ex + clamp(gx, -1, 1) * 6, py = eyeY + clamp(gy, -1, 1) * 5;
        dot(ctx, px, py, 25, INK, 32); // a little larger than a dot eye, not a saucer
        dot(ctx, px - 9, py - 12, 9, '#FFFFFF', 10);
        dot(ctx, px + 9, py + 11, 4, '#FFFFFF', 4);
        const sx = px + 10, sy = py - 18, R = 11;
        const star: Pt[] = [];
        for (let k = 0; k < 8; k++) { const a = (k * Math.PI) / 4; const rr = k % 2 ? R * 0.32 : R; star.push({ x: sx + Math.cos(a) * rr, y: sy + Math.sin(a) * rr }); }
        fillPts(ctx, star, '#FFFFFF');
        break;
      }
      case 'xx': {
        // ">_<": chevrons pointing in toward the nose
        const k = -s;
        strokePts(ctx, [{ x: ex - k * 24, y: eyeY - 24 }, { x: ex + k * 20, y: eyeY }, { x: ex - k * 24, y: eyeY + 24 }], 18);
        break;
      }
      case 'blank': {
        // white empty eyes, no pupil: the frozen anime shock
        dot(ctx, ex, eyeY, 32, '#FFFFFF', 36);
        ring(ctx, ex, eyeY, 30, 12);
        break;
      }
      case 'flat': {
        // "-_-": a thick flat bar, a little low
        line(ctx, ex - 34, eyeY + 6, ex + 34, eyeY + 6, 18);
        break;
      }
      case 'tt': {
        // "T_T": a flat bar + a tear stream pouring down the cheek
        line(ctx, ex - 32, eyeY, ex + 32, eyeY, 18);
        const band = roundRectPts(ex - 11, eyeY + 6, 22, 105, 10);
        fillPts(ctx, band, 'rgba(120,190,245,0.95)');
        strokePts(ctx, band, 7, INK, true);
        break;
      }
      case 'spiral': {
        const pts: Pt[] = [];
        for (let k = 0; k <= 60; k++) { const a = k * 0.42 * s; const rr = 3 + k * 0.62; pts.push({ x: ex + Math.cos(a) * rr, y: eyeY + Math.sin(a) * rr }); }
        strokePts(ctx, pts, 9);
        break;
      }
      case 'heart': {
        const H: Pt[] = [];
        for (let k = 0; k <= 40; k++) { const t = (k / 40) * Math.PI * 2; H.push({ x: ex + 2.4 * 16 * Math.sin(t) ** 3, y: eyeY - 2.4 * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) }); }
        fillPts(ctx, H, '#E0485A');
        strokePts(ctx, H, 9, INK, true);
        break;
      }
    }
  }
}
/** anime mouths in the head frame */
function drawAnimeMouth(ctx: Ctx, kind: AnimeMouth, mx: number, my: number, open: number) {
  switch (kind) {
    case 'cat': // ":3" / "w"
      strokePts(ctx, [...quad({ x: mx - 46, y: my - 6 }, { x: mx - 24, y: my + 22 }, { x: mx, y: my }), ...quad({ x: mx, y: my }, { x: mx + 24, y: my + 22 }, { x: mx + 46, y: my - 6 }).slice(1)], 16);
      break;
    case 'tiny':
      dot(ctx, mx, my, 11, INK, 9);
      break;
    case 'wobble': {
      const pts: Pt[] = [];
      for (let k = 0; k <= 24; k++) { const x = mx - 44 + (88 * k) / 24; pts.push({ x, y: my + 8 * Math.sin((k / 24) * Math.PI * 4) }); }
      strokePts(ctx, pts, 14);
      break;
    }
    case 'pout': // a small "3" pucker
      strokePts(ctx, [...quad({ x: mx - 6, y: my - 26 }, { x: mx + 26, y: my - 14 }, { x: mx, y: my }), ...quad({ x: mx, y: my }, { x: mx + 26, y: my + 14 }, { x: mx - 6, y: my + 26 }).slice(1)], 14);
      break;
    case 'shout': {
      // the big open anime mouth: a wide rounded triangle, wider while talking
      const k = 0.6 + 0.25 * clamp(open, 0, 1);
      const sh: Pt[] = [
        { x: mx - 66 * k, y: my - 24 }, { x: mx + 66 * k, y: my - 24 },
        ...quad({ x: mx + 66 * k, y: my - 24 }, { x: mx + 30 * k, y: my + 70 * k }, { x: mx, y: my + 76 * k }, 10).slice(1),
        ...quad({ x: mx, y: my + 76 * k }, { x: mx - 30 * k, y: my + 70 * k }, { x: mx - 66 * k, y: my - 24 }, 10).slice(1),
      ];
      fillPts(ctx, sh, INK);
      ctx.save(); pathOf(ctx, sh); ctx.clip();
      dot(ctx, mx + 6, my + 64 * k, 34 * k, '#D6425A', 22 * k);
      ctx.restore();
      strokePts(ctx, sh, 12, INK, true);
      break;
    }
  }
}

/** draw a slider face (any in-between) in the head frame of drawFace */
function drawFaceRig(ctx: Ctx, r: Rig, look: Look, p: FaceParams) {
  const hh = REF_HW / look.headRatio;
  const top = r.headC.y - hh / 2;
  // the face group turns toward where the character looks (3/4 feel, style sheet: up to 10-15 % of the head width)
  const cx = r.headC.x + FACE_SHIFT + clamp(p.gX, -1, 1) * 22;
  const glasses = look.accessories.has('glasses');
  const happy = Math.abs(p.eHappy) >= 0.5;
  const big = glasses && !happy && p.eOpen > 0.3 ? Math.max(p.eBig, 0.85) : p.eBig;
  const eyeY = top + (0.42 + 0.05 * big) * hh + clamp(p.gY, -1, 1) * 6;
  const eyeDX = 70 - 3 * big;
  const browY = eyeY - (0.13 + 0.03 * big) * hh;
  const mouthY = top + 0.70 * hh;
  const er = ART.eyeR;
  const gx = clamp(p.pX + p.gX, -1.2, 1.2);
  const gy = clamp(p.pY + p.gY, -1.2, 1.2);
  // ── brows: a thick stroke per side, tilted about its centre, bowed by the arch, with a skin halo over hair
  for (const [i, s] of [[0, -1], [1, 1]] as const) {
    if (p.bLen < 0.05) break;
    const len = 84 * p.bLen;
    const bx = cx + s * eyeDX;
    const by = browY + p.bY[i];
    const sn = (Math.sin(p.bTilt[i] * D) * len) / 2;
    const cs = (Math.cos(p.bTilt[i] * D) * len) / 2;
    const inner = { x: bx - s * cs, y: by - sn };
    const outer = { x: bx + s * cs, y: by + sn };
    const ctl = { x: bx, y: by - p.bArch[i] * 42 };
    const pts = quad(inner, ctl, outer, 12);
    strokePts(ctx, pts, 27 + 22, SKIN);
    strokePts(ctx, pts, 27);
  }
  // ── eyes (with lids: the lid line cuts the eye; above it is skin)
  const lidCut = (i: number, s: number, ex: number, ey: number, rx: number, ry: number, ring: boolean) => {
    // behind glasses a light lid is clutter (lens rim + lid + brow): only the heavier lids show, softened
    const L = glasses ? clamp((p.lid[i] - 0.2) / 0.8, 0, 1) : clamp(p.lid[i], 0, 1);
    const B = clamp(p.lidB, 0, 0.7);
    if (L < 0.04 && B < 0.04) return;
    const w = rx * 1.45;
    const tl = Math.tan(p.lidTilt[i] * D) * w;
    ctx.save();
    // the eye's own area (a touch larger, so the cut leaves no rim)
    ctx.beginPath();
    ctx.ellipse(ex, ey, rx + (ring ? 12 : 3), ry + (ring ? 12 : 3), 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = SKIN;
    if (L >= 0.04) {
      const y = ey - ry + 2 * ry * L;
      // inner end = toward the nose (x toward cx): + tilt lifts the inner end
      const yi = y - tl;
      const yo = y + tl;
      const xi = ex - s * w;
      const xo = ex + s * w;
      ctx.beginPath();
      ctx.moveTo(xi, yi);
      ctx.lineTo(xo, yo);
      ctx.lineTo(xo, ey - ry - 40);
      ctx.lineTo(xi, ey - ry - 40);
      ctx.closePath();
      ctx.fill();
    }
    let yb = 0;
    if (B >= 0.04) {
      yb = ey + ry - 2 * ry * B;
      ctx.beginPath();
      ctx.moveTo(ex - w, yb + 6);
      ctx.quadraticCurveTo(ex, yb - 10, ex + w, yb + 6);
      ctx.lineTo(ex + w, ey + ry + 40);
      ctx.lineTo(ex - w, ey + ry + 40);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    if (L >= 0.04) {
      const y = ey - ry + 2 * ry * L;
      // ring eyes: the lid is a chord of the eye white (never past the lens); dot eyes: a short bar over the dot
      const hc = ring ? Math.sqrt(Math.max(0, rx * rx - (y - ey) * (y - ey) * (rx / ry) * (rx / ry))) : w;
      const k = hc / w;
      line(ctx, ex - s * hc, y - tl * k, ex + s * hc, y + tl * k, ring ? 15 : 13);
    }
    if (B >= 0.04 && ring) strokePts(ctx, quad({ x: ex - w * 0.9, y: yb + 5 }, { x: ex, y: yb - 9 }, { x: ex + w * 0.9, y: yb + 5 }, 8), 9);
  };
  if (p.anime && !(p.eOpen < 0.3 && (p.anime === 'sparkle' || p.anime === 'blank' || p.anime === 'heart'))) {
    drawAnimeEyes(ctx, p.anime, cx, eyeY, eyeDX, gx, gy);
  } else for (const [i, s] of [[0, -1], [1, 1]] as const) {
    const ex = cx + s * eyeDX;
    if (happy) {
      const up = p.eHappy > 0;
      const y = eyeY + (up ? 10 : 24);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 26;
      ctx.lineCap = 'round';
      ctx.beginPath();
      if (up) ctx.arc(ex, y + 10, 36, Math.PI * 1.05, Math.PI * 1.95);
      else ctx.arc(ex, y - 10, 36, Math.PI * 0.05, Math.PI * 0.95);
      ctx.stroke();
    } else if (p.eOpen < 0.3) {
      line(ctx, ex - 36, eyeY, ex + 36, eyeY, 18);
    } else if (big >= 0.5) {
      const kb = Math.min(1, (big - 0.5) * 2);
      const R0 = 36 + 16 * kb;
      const pr = 8 + 3 * kb;
      const ry = R0 * Math.min(1, p.eOpen);
      dot(ctx, ex, eyeY, R0, '#FFFFFF', ry);
      ctx.save();
      ctx.translate(ex, eyeY);
      ctx.scale(1, ry / R0);
      ring(ctx, 0, 0, R0 - 9, 17);
      ctx.restore();
      const lim = R0 - 9 - pr - 6;
      dot(ctx, ex + clamp(gx, -1, 1) * lim, eyeY + clamp(gy, -1, 1) * lim * (ry / R0), pr);
      lidCut(i, s, ex, eyeY, R0, ry, true);
    } else {
      const rx = er * (1 + big * 0.4);
      const ry = Math.max(4, rx * Math.min(1, p.eOpen) * Math.max(0.3, 1 - 1.4 * Math.abs(p.eHappy))) + 1;
      // dot eyes look by moving inside an imagined eye white (no white drawn): up to ~0.6 of a dot each way
      const dx = gx * 14;
      const dy = gy * 10;
      dot(ctx, ex + dx, eyeY + dy, rx, INK, ry);
      lidCut(i, s, ex + dx, eyeY + dy, rx, ry, false);
    }
  }
  // ── glasses / sunglasses / monocle
  if (glasses) {
    for (const s of [-1, 1]) ring(ctx, cx + s * 66, eyeY, 52, 15);
    line(ctx, cx - 14, eyeY - 6, cx + 14, eyeY - 6, 11);
    line(ctx, cx - 118, eyeY - 10, cx - 184, eyeY - 30, 9);
  } else if (look.accessories.has('sunglasses')) {
    for (const s of [-1, 1]) {
      const g = roundRectPts(cx + s * 66 - 54, eyeY - 38, 108, 76, 24);
      fillPts(ctx, g, '#2B2533');
      strokePts(ctx, g, 12, INK, true);
    }
    line(ctx, cx - 12, eyeY - 10, cx + 12, eyeY - 10, 12);
    line(ctx, cx - 120, eyeY - 14, cx - 184, eyeY - 30, 10);
  } else if (look.accessories.has('monocle')) {
    ring(ctx, cx + 66, eyeY, 48, 14);
    strokePts(ctx, quad({ x: cx + 66, y: eyeY + 48 }, { x: cx + 106, y: eyeY + 136 }, { x: cx + 58, y: eyeY + 224 }), 7);
  }
  if (look.accessories.has('beard')) {
    const col = look.hair ?? '#4A3A2E';
    const lower = ellipsePts(r.headC.x, r.headC.y, REF_HW / 2 + 10, hh / 2 + 12, 40, Math.PI * 0.12, Math.PI * 0.88);
    inkShape(ctx, [...lower, { x: r.headC.x - 140, y: mouthY - 30 }, { x: cx, y: mouthY - 10 }, { x: r.headC.x + 230, y: mouthY - 30 }], col, 0.8);
  }
  // ── mouth: one shape for every in-between. Corners rise with the smile, twist lifts the front corner and drops
  // the back one; it opens downward into a D (smile), an oval (o) or a box (grimace); teeth fill it from the top
  const tache = look.accessories.has('moustache');
  const mx = cx + 6 + p.mShift + p.gX * 8;
  const H = p.mOpen * 82;
  const my = mouthY + (tache ? 24 : 0) - H * 0.3;
  const w = p.mW;
  const c = p.mCurve;
  const tw = p.mTwist * 16;
  const cL = my - c * 18 + tw; // back corner (left on the canvas)
  const cR = my - c * 18 - tw; // front corner
  // anime mouths stay while silent; talking (the syllable envelope opens mOpen past the expression's own) uses the
  // ordinary mouth, except a shout, which simply opens wider
  const talkingOpen = p.mOpen > (MOUTH_OPEN_OF[p.amouth ?? ''] ?? 0) + 0.12;
  if (p.amouth && (!talkingOpen || p.amouth === 'shout')) {
    drawAnimeMouth(ctx, p.amouth, mx, mouthY + (tache ? 24 : 0), p.mOpen);
  } else if (p.mOpen < 0.06) {
    if (!tache) strokePts(ctx, quad({ x: mx - w, y: cL }, { x: mx, y: my + c * 26 }, { x: mx + w, y: cR }, 14), 18);
  } else {
    const box = p.teeth > 0.7 ? 0.9 : 0.6 + 0.25 * Math.max(0, -c);
    const shape: Pt[] = [
      ...quad({ x: mx - w, y: cL }, { x: mx, y: my + c * 12 - H * 0.12 }, { x: mx + w, y: cR }, 14),
      { x: mx + w * 0.92, y: cR + H * 0.5 * box },
      ...quad({ x: mx + w * 0.8, y: cR + H * box }, { x: mx, y: my + H * (1.05 + 0.15 * box) + c * 12 }, { x: mx - w * 0.8, y: cL + H * box }, 14),
      { x: mx - w * 0.92, y: cL + H * 0.5 * box },
    ];
    fillPts(ctx, shape, INK);
    ctx.save();
    pathOf(ctx, shape);
    ctx.clip();
    if (p.tongue > 0.05) dot(ctx, mx + 10, my + H * 0.95 + c * 8, w * 0.55 * (0.5 + 0.5 * p.tongue), '#D6425A', H * 0.38 * p.tongue + 4);
    if (p.teeth > 0.05) {
      const ty = Math.min(cL, cR, my - H * 0.12) - 20;
      const th = (H * 1.2 + 30) * p.teeth;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(mx - w - 10, ty, 2 * w + 20, th);
      // a few tooth gaps, not a grill
      if (p.teeth > 0.6) for (let k = 1; k <= 3; k++) line(ctx, mx - w + (2 * w * k) / 4, ty, mx - w + (2 * w * k) / 4, ty + th, 6);
      else line(ctx, mx - w, ty + th, mx + w, ty + th, 7);
    }
    ctx.restore();
    strokePts(ctx, shape, 13, INK, true);
  }
  // ── moustache (handlebar over the mouth, tips droop when sad)
  if (tache) {
    const my2 = mouthY - 46;
    const col = look.hair && !isDark(look.hair) ? look.hair : INK;
    const droop = c < -0.4 || (p.bTilt[0] + p.bTilt[1]) / 2 > 15;
    const tx = cx + 10 + p.gX * 8;
    for (const sd of [-1, 1]) {
      const tipX = tx + sd * 112;
      const tipY = my2 + (droop ? 26 : 4) - sd * tw * 0.5;
      const wing = [
        ...quad({ x: tx, y: my2 - 14 }, { x: tx + sd * 58, y: my2 - 50 }, { x: tipX, y: tipY }),
        ...quad({ x: tipX, y: tipY }, { x: tx + sd * 68, y: my2 + 44 }, { x: tx, y: my2 + 22 }).slice(1),
      ];
      inkShape(ctx, wing, col, 0.45);
      const up = droop ? 1 : -1;
      strokePts(ctx, quad({ x: tipX - sd * 4, y: tipY }, { x: tipX + sd * 32, y: tipY + up * 6 }, { x: tipX + sd * 28, y: tipY + up * 34 }), 14, col === INK ? INK : shade(col, 0.6));
      dot(ctx, tipX + sd * 20, tipY + up * 36, 9, col === INK ? INK : shade(col, 0.6));
    }
  }
  if (look.accessories.has('toothbrush')) fillPts(ctx, roundRectPts(mx - 32, mouthY - 64, 64, 38, 8), INK);
  drawExtras(ctx, r, look, p.extras, cx, eyeDX, eyeY, top, hh);
}
