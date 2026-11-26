// The 3D stickman in the RicksClips style (references/RC_CHARACTER_STYLE.md): a flat 2D drawing that lives in 3D.
//   DEFAULT since 2026-11-20 (toon, char3d/toon.tsx): head / torso / hat / hair / skirt are REAL 3D meshes that turn
//     with the body, flat-coloured with the painter's own drawings projected on and a hull outline (looks like the
//     card from the front, shows the back of the head and jacket from behind). `toon={false}` = the cards below:
//   head / hat / torso / skirt = flat painted layers (the painter's own art, char3d/art.ts) on quads that always face
//     the lens, placed on the Mixamo joints: placement, occlusion, props and cast shadows stay true 3D, and the figure
//     keeps its drawn shape when the camera arcs (a flattened 3D head narrows and its hat turns into a line at 35 deg);
//   limbs = thin unlit ink tubes, one smooth curve through the elbow / knee, dot hands, short stroke feet;
//   motion = Mixamo clips through the pose-to-pose time remap of rig.ts (ClipKey.step) + the puppet layer below
//     (reaction hop with squash / stretch, head tip, hat lift, breathing, walk bob, quiet walk arms).
// Every number is in STYLE; LOOK.md -> 3D stickman says where each one was measured.
// Contact (RULES.md): one pure solver per frame (solve) poses the body, shapes the 'dress' skirt around the legs, pushes
// elbows / hands out of the skirt and swings the held prop's shaft clear of skirt, legs and body. <Stickman/>, jointsAt
// and poseQA all read that solver, so what a shot attaches to a hand is where the hand is drawn.
import React from "react";
import { useCurrentFrame } from "remotion";
import * as THREE from "three";
import type { AnyExpression } from "../char/drawCharacter";
import { ART, ART_REF, lookOf } from "../char/drawCharacter";
import { CAST } from "../char/cast";
import type { CharacterSpec } from "../char/types";
import { useMood } from "../engine/core/View";
import type { V3 } from "../engine/types";
import { putJoints, ShotCtx } from "../world/registry";
import type { Joints } from "../world/registry";
import { Tears } from "./tears";
import { faceAt, GAZE_AHEAD, LIP_LEAD, lipAt, lookAt, talkEnv } from "./faceAnim";
import type { LookSpec } from "./faceAnim";
import { figureTint, hatTex, HEAD_QUAD, headFaceTex, headTex, INK_MAT, layerMat, shadowMat, skirtTex, TORSO_QUAD, torsoTex } from "./art";
import { blinkAt } from "./face";
import { getProp, modeAt, POSE_MODES } from "./props";
import type { PropKey, PropMode, PropSpec } from "./props";
import { armAngle, grabWeight, REACH, smoother, solveArm, targetAt, timeFor } from "./reach";
import { recoil } from "../world/fx_action";
import { stainMat, stainSpots } from "../world/blood";
import type { Bleed } from "../world/blood";
import type { Grab } from "./reach";
import { clipSpeed, evaluate, keyAt, restPose, rigFor, stepOf, walkWeight } from "./rig";
import type { ClipKey, Rig } from "./rig";
import { flatMat, HEAD_DEPTH, TORSO_DEPTH, hairBack, hairFront, hairGeo, hatGeo, HEAD_FRAME, headBack, headFront, headGeo, hatFront, PEN_HW, projMat, skirtGeo3, ToonPart, TORSO_FRAME, torsoBack, torsoFront, torsoGeo } from "./toon";
import { UP } from "../upgrade";
import { WornParts } from "./worn";
import type { Wear } from "./worn";

export const STYLE = {
  // ---- proportions (median of 12 reference figures: head 30 %, torso 30 %, legs 40 %)
  headFrac: 0.29, // head height / figure height (without headwear)
  headRatio: ART.headRatio, // head width / height 1.10 (the painter's seeded wobble adds +-2 %)
  // torso = the painter's capsule: 0.66 head widths wide (measured median 0.69), W/H 0.61 (median 0.62), the head
  // overlaps its top by ART_REF.HEAD_OVERLAP; with headFrac 0.29 the legs come out at 0.39 of the height
  hipIn: 0.05, // the hip joint sits this far (x figure height) inside the torso's bottom end
  shoulderAt: 0.52, // arms leave the torso's top cap this many radians above its widest point
  armBow: 0.03, // a straight hanging arm bows outward by this x figure height at the elbow (bendy noodle arms)
  hipSpread: 0.42, // leg roots: this share of the torso half width either side of the centre
  // ---- line (the painter's reference px; 1 head width = 512)
  limb: ART_REF.LIMB / 2, // limb radius: 30 px pen = 1.9 % of the figure height (measured 1.6-2.1 %)
  hand: ART_REF.HAND_R, // hand dot radius = 1.65 x the limb width
  foot: ART_REF.FOOT, // foot stroke length 5.7 % of the height (measured 4-5 %; foreshortened by the 20-35 deg drop it reads as ~5 %)
  footDown: 0.49, // the stroke points this far below level (rad; measured 20-35 deg)
  footSplay: 0.95, // and this far outward when the figure faces the lens (rad); 0 in profile
  ink: ART.ink,
  // ---- layers: metres toward the lens along the view ray (screen position unchanged, only what covers what)
  zHead: 0.02,
  zHat: 0.026,
  zArm: 0.045,
  zLeg: -0.045,
  zSkirt: -0.02,
  lean: 0.5, // share of the Mixamo spine lean the torso cut-out takes (the reference's torso stays near upright)
  // ---- head
  headTilt: 0.25, // share of the Mixamo head-bone tilt the big head follows (1.0 rolls it over when bending)
  // ---- motion layer (frames at 30 fps measured on the reference; RC_CHARACTER_STYLE.md -> Movement)
  squash: 0.35, // body squash/stretch per m/s of vertical speed (clamped 0.9..1.12)
  headLag: 0.02, // head drop per m/s of vertical hip speed (the head lags the bob)
  jiggle: 0.035, // head roll on each step (rad), while walking
  bob: 1.6, // walk: the body's own bob is exaggerated by this much (reference 2-3 % of the height)
  walkArm: 0.45, // walk: share of the Mixamo arm swing kept (the reference's arms hang almost still)
  hop: 0.07, // laugh / cheer: the body jumps this x figure height (measured 8.7 % on the tallest figure), twice
  hopT: 0.28, // seconds per bounce (8-9 frames)
  jolt: 0.045, // shocked / scared: one jump
  nod: 0.012, // any other expression change: a small hop ...
  tip: 0.11, // ... with a head tilt (rad; measured 6-10 deg) in 2 frames, held 13, back in 2
  tipBig: 0.24, // laugh: the head tips back ~15 deg
  hatLift: 0.16, // the hat leaves the head by this x head height for 4-5 frames on a big reaction
  breath: 0.007, // idle: torso stretch +- this, period ~3.4 s
  armLen: 0.95, // shoulder -> hand = this x the torso height (RC measured 0.85-1.0): hands rest torso-high
  // ---- jelly layer (measured 2026-11-20 on RC TRU 36.3-37.4 laugh, full fps, charstudy/jelly): on a beat the body tips
  // 10-15 deg in 2 frames, swings back through upright to the other side and settles in ~15 frames (1.5 swings); the
  // head follows a beat late and overshoots more; the hat trails furthest (0.65 torso widths at the peak, lands 6-8 f
  // later). Holds are dead still (< 0.5 % change over 25 frames): the springs only ring after a change.
  jellyLean: 0.7, // upper-body lean = this x the reaction's head tip (laugh ~0.17 rad, nod ~0.08)
  leanJolt: 0.13, // shocked / scared: the body recoils back this far (rad)
  springBody: [2.3, 0.32] as [number, number], // [Hz, damping] of the body lean
  springHead: [1.9, 0.28] as [number, number], // the head: softer, lags and overshoots more
  springHat: [1.5, 0.24] as [number, number], // the hat: softest, trails furthest
  // ---- 'dress' skirt and contact solver (unchanged from the first 3D build)
  skirtFlare: 1.5, // 'dress': hem radius / body radius when the legs are together (the card's 0.78 / 0.5 flare)
  skirtHem: 0.45, // hem height between the knees (0) and the ankles (1)
  skirtMax: 2.4, // the hem never grows past this x body radius (a high kick then shows the shin below the hem)
  skirtHang: 0.5, // skirt axis: 0 = along the thighs, 1 = straight down (cloth hangs: a bent-over figure keeps a level hem)
  carryTilt: 1.3, // carry: the working end leans this far from straight down (rad), forward: carried level at the side, not a cane
  restFit: 1.018, // the bind pose's spine is straighter than a standing idle: x this, the idle figure is spec.height tall
  clear: 0.015, // gap kept between limbs / the held prop and the skirt, legs and body (m)
};

export type ExprKey = { at: number; e: AnyExpression };
/** a held prop. mode keys cross-fade over `fade` s (default 0.4; 0.3 when aim / behind / chest is involved).
 *  target: what `aim` points at (world point or a function of shot t). fire: shot seconds of each shot fired (recoil
 *  kicks the arm and the gun up, settles in ~0.4 s). strike: shot seconds where the `chest` left hand taps the prop's
 *  top. size: scales the prop model (default 1; RC hands are big dots, a 15 cm pistol reads better at 1.3-1.6).
 *  cam: the lens (<Stickman/> fills it in from its own `cam`; pass it to jointsAt / gunAt for the same pose): `chest`
 *  holds sit in front of the torso layer AS SEEN from the lens (the torso is a flat card facing it). */
export type PropHold = { id: string; mode: PropKey[] | PropMode; target?: V3 | ((t: number) => V3); fire?: number[]; strike?: number[]; size?: number; fade?: number; cam?: V3 };
/** seated / standing dead pose (no Mixamo): from `at` the body sags sideways (`sag` rad, default 0.32) and back
 *  (`back` rad, default 0.22) about the hips, the head tips to `side` (+1 = the character's right), the arms go limp,
 *  breathing / blinks / reactions stop; eased in over `dur` s (default 0.5). The clip freezes at at + dur. */
export type Slump = { at: number; dur?: number; side?: 1 | -1; sag?: number; back?: number; head?: number; arms?: boolean };
/** the hat falls off at `at` (0.5 s fall with a little arc and spin) and lands at `to` (world point; default beside the
 *  hips on the seat / ground, on the `side` of the slump), lying there (follows the body if it moves, e.g. a car) */
export type HatOff = { at: number; to?: V3 | ((t: number) => V3); dur?: number };
export type StickmanProps = {
  who: string; // cast id (src/char/cast.ts)
  t: number; // shot seconds (timelines are in shot seconds)
  tg?: number; // global film seconds (blinks stay continuous across shots); default t
  at: V3; // feet position (y = ground: use groundY)
  yaw: number; // facing: 0 = +z, PI/2 = +x
  cam: V3; // lens position (the flat layers face it)
  clips: ClipKey[];
  expr?: ExprKey[] | AnyExpression;
  /** where the eyes look: a world point, "cam", or keys [{at, to}] (to = point | "cam" | null = ahead). Default:
   *  ahead, toward the facing side (characters do not stare into the lens) */
  look?: LookSpec;
  talk?: [number, number][]; // mouth flaps inside these shot-second intervals (quoted lines only, not under narration)
  prop?: PropHold;
  walking?: number; // 0..1 how much the step jiggle applies (default 1)
  /** which way the drawing looks: 1 = screen right, -1 = screen left; default = the side the body faces */
  facing?: 1 | -1;
  /** 0..1 scales the reaction layer (hop, head tip, hat lift) on expression changes; default 1 */
  react?: number;
  /** cast a real shadow (default true) */
  shadow?: boolean;
  /** hands on things in the world (reach.tsx): eased reach -> contact at `at` -> hold -> release. Do not grab with
   *  the hand that holds `prop` (the right hand) while the prop is shown. */
  grab?: Grab[];
  /** tears (char3d/tears.tsx): shot seconds where crying starts; each start runs one drop per eye, 0.6 s apart */
  tears?: number[];
  /** sweat drops from the temple: shot seconds (shock, fear, effort) */
  sweat?: number[];
  /** dead slump (seated or standing), see Slump */
  slump?: Slump;
  /** the hat falls off, see HatOff */
  hatOff?: HatOff;
  /** cartoon blood: a crimson stain spreading on the torso drawing from hit points (world/blood.tsx Bleed); stays */
  bleed?: Bleed | Bleed[];
  /** 0..1: turn the legs' depth into the picture plane (a cartoon profile leg). A kneel seen from the front points the
   *  kneeling shin straight away from the lens and reads as standing: legs2d 1 draws it sideways (back leg away from the
   *  facing side). Heights are kept, so feet / knee stay on the ground. Default 0. */
  legs2d?: number;
  /** body parts as real 3D meshes turned with the body (char3d/toon.tsx; DEFAULT), limbs at their true depth.
   *  false = the old camera-facing cards (always show the front, flip in one frame); "lit" = experimental lit 3D. */
  toon?: boolean | "lit";
  /** worn pieces (char3d/worn.tsx: bomb_vest, worn_bag, worn_chute) drawn on the torso (toon mode), shown from..to */
  wear?: Wear[];
};

const BONES = ["Hips", "Neck", "Head", "HeadTop_End", "LeftArm", "LeftForeArm", "LeftHandMiddle1", "RightArm", "RightForeArm", "RightHandMiddle1",
  "LeftUpLeg", "LeftLeg", "LeftFoot", "LeftToeBase", "RightUpLeg", "RightLeg", "RightFoot", "RightToeBase"];
const LEGS = /UpLeg|Leg|Foot|ToeBase/;
export type Pose = Record<string, THREE.Vector3>;
const Y = new THREE.Vector3(0, 1, 0);
const V = () => new THREE.Vector3();

/** per-character sizes. u = metres per painter reference px (1 head width = 512 px): every drawn size comes from it.
 *  s / legK map the Mixamo skeleton onto the drawn figure: measured on the skeleton's bind (rest) pose, a fixed
 *  reference, so every render tab gets the same size whichever shot / clip it draws first. */
type Dims = { s: number; legK: number; u: number; H: number; headH: number; headW: number; R: number; torsoLen: number; over: number; hipIn: number; toe0: number; armUp: number; armLo: number };
const dims = new Map<string, Dims>();
const dimsFor = (r: Rig, H: number): Dims => {
  const key = `${r.who}|${H}`;
  let d = dims.get(key);
  if (!d) {
    restPose(r);
    const neck = r.bone("Neck").getWorldPosition(V()).y;
    const hips = r.bone("Hips").getWorldPosition(V()).y;
    const toe = r.bone("LeftToeBase").getWorldPosition(V()).y;
    const sh = r.bone("LeftArm").getWorldPosition(V());
    const el = r.bone("LeftForeArm").getWorldPosition(V());
    const hd = r.bone("LeftHandMiddle1").getWorldPosition(V());
    const headH = STYLE.headFrac * H;
    const headW = headH * STYLE.headRatio;
    const u = headW / ART_REF.HW;
    const torsoLen = ART_REF.TORSO_H * u;
    const over = ART_REF.HEAD_OVERLAP * u;
    const hipIn = STYLE.hipIn * H;
    const neckY = H - headH; // the chin line
    const hipY = neckY + over - torsoLen + hipIn;
    const s = (STYLE.restFit * (neckY - hipY)) / (neck - hips);
    const legK = hipY / (s * hips);
    // drawn arm lengths for solveArm (the bind pose's own bones at the figure's scale; the arm never stretches past them)
    d = { s, legK, u, H, headH, headW, R: (ART_REF.TORSO_W / 2) * u, torsoLen, over, hipIn, toe0: s * legK * toe, armUp: s * sh.distanceTo(el), armLo: s * el.distanceTo(hd) };
    dims.set(key, d);
  }
  return d;
};

/** the torso layer's frame: bottom end B, top end T (under the head), axis ax */
const torsoOf = (P: Pose, d: Dims, raw = false) => {
  const ax = P.Neck.clone().sub(P.Hips).normalize();
  // on the raw Mixamo pose, standing: damp the lean (lying / bowing keep it); sample() then puts the neck on this axis
  if (raw && ax.y > 0.5) ax.multiplyScalar(STYLE.lean).addScaledVector(Y, 1 - STYLE.lean).normalize();
  const B = P.Hips.clone().addScaledVector(ax, -d.hipIn);
  return { ax, B, T: B.clone().addScaledVector(ax, d.torsoLen) };
};

const boneY = (r: Rig, keys: ClipKey[], t: number, name: string) => {
  evaluate(r, keys, t);
  r.root.updateMatrixWorld(true);
  return r.bone(name).getWorldPosition(V()).y;
};

/** one pose of the drawn figure: Mixamo bones mapped to the style sheet's proportions. The torso is a rigid cut-out
 *  (the neck sits a fixed length above the hips along the spine), arms leave it at its upper edge and legs at its
 *  bottom, hands and feet stay where Mixamo put them. `quietArms` (no prop held) calms the walk's arm swing. */
const sample = (r: Rig, keys: ClipKey[], t: number, at: V3, yaw: number, d: Dims, quietArms = true): Pose => {
  r.root.position.set(...at);
  r.root.rotation.set(0, yaw, 0);
  r.root.scale.setScalar(d.s);
  // walk: exaggerate the body's own bob (hip height against its average over the stride around t)
  const ww = walkWeight(keys, t);
  let bob = 0;
  if (ww > 0) {
    let m = 0;
    for (const dt of [-0.27, -0.13, 0.13, 0.27]) m += boneY(r, keys, t + dt, "Hips") / 4;
    bob = (boneY(r, keys, t, "Hips") - m) * d.legK * (STYLE.bob - 1) * ww;
  }
  evaluate(r, keys, t);
  r.root.updateMatrixWorld(true);
  const p: Pose = {};
  for (const n of BONES) p[n] = r.bone(n).getWorldPosition(V());
  const drop = (p.Hips.y - at[1]) * (1 - d.legK) - bob;
  for (const n of BONES) {
    if (LEGS.test(n)) p[n].y = at[1] + (p[n].y - at[1]) * d.legK;
    else p[n].y -= drop;
  }
  // rigid torso: neck (and the head bones) a fixed length above the hips
  const { ax, B, T } = torsoOf(p, d, true);
  const neck = T.clone().addScaledVector(ax, -d.over);
  const dn = neck.clone().sub(p.Neck);
  for (const n of ["Neck", "Head", "HeadTop_End"]) p[n].add(dn);
  // shoulders on the torso's top cap, leg roots at its bottom; elbows / knees follow half way
  const lat = (a: THREE.Vector3, b: THREE.Vector3) => {
    const v = a.clone().sub(b);
    v.addScaledVector(ax, -v.dot(ax));
    return v.lengthSq() > 1e-8 ? v.normalize() : new THREE.Vector3(-Math.cos(yaw), 0, Math.sin(yaw));
  };
  const latS = lat(p.RightArm, p.LeftArm);
  const latH = lat(p.RightUpLeg, p.LeftUpLeg);
  const capC = T.clone().addScaledVector(ax, -d.R);
  const Rs = d.R - 0.5 * ART.thick * d.u;
  for (const [sd, sg] of [["Left", -1], ["Right", 1]] as const) {
    const S = capC.clone().addScaledVector(latS, sg * Rs * Math.cos(STYLE.shoulderAt)).addScaledVector(ax, Rs * Math.sin(STYLE.shoulderAt));
    const E = p[sd + "ForeArm"];
    const Hd = p[sd + "HandMiddle1"];
    E.addScaledVector(S.clone().sub(p[sd + "Arm"]), 0.5);
    p[sd + "Arm"].copy(S);
    if (quietArms && ww > 0) {
      // the reference walks with its arms hanging almost still: blend toward a relaxed hang from the shoulder
      const k = (1 - STYLE.walkArm) * ww;
      const up = S.distanceTo(E);
      const lo = E.distanceTo(Hd);
      const down = ax.clone().negate().addScaledVector(latS, sg * 0.16).normalize();
      E.lerp(S.clone().addScaledVector(down, up), k);
      Hd.lerp(S.clone().addScaledVector(down, up + lo), k);
    }
    const hip = B.clone().addScaledVector(ax, 0.35 * d.R).addScaledVector(latH, sg * STYLE.hipSpread * d.R);
    p[sd + "Leg"].addScaledVector(hip.clone().sub(p[sd + "UpLeg"]), 0.5);
    p[sd + "UpLeg"].copy(hip);
  }
  return p;
};

// ------------------------------------------------------------------ contact solver (pure function of the pose)
/** the 'dress' skirt: a flared cone from the hips (top, radius r0) to the hem (radius r1), axis u, length len */
type Skirt = { top: THREE.Vector3; u: THREE.Vector3; len: number; r0: number; r1: number };
const SKIRT_HULL = 1.07; // the skirt's ink hull (outer visible surface = radius x this)
const skirtR = (sk: Skirt, h: number) => sk.r0 + (sk.r1 - sk.r0) * THREE.MathUtils.clamp(h / sk.len, 0, 1);
type Gap = { gap: number; n: THREE.Vector3; what?: string };
const FREE: Gap = { gap: Infinity, n: Y };
/** clearance of a ball (centre p, radius rad) from the skirt's inked surface; n = the way out (radial) */
const skirtGap = (sk: Skirt, p: THREE.Vector3, rad: number, side: THREE.Vector3): Gap => {
  const v = p.clone().sub(sk.top);
  const h = v.dot(sk.u);
  if (h < -rad || h > sk.len + rad) return FREE; // above the waist (inside the body pill) or below the hem
  const radial = v.addScaledVector(sk.u, -h);
  const d = radial.length();
  const n = d > 1e-5 ? radial.divideScalar(d) : side.clone();
  return { gap: d - skirtR(sk, h) * SKIRT_HULL - rad, n, what: "skirt" };
};
/** clearance of a ball from a capsule a-b of radius r */
const capGap = (a: THREE.Vector3, b: THREE.Vector3, r: number, p: THREE.Vector3, rad: number, side: THREE.Vector3): Gap => {
  const ab = b.clone().sub(a);
  const u = THREE.MathUtils.clamp(p.clone().sub(a).dot(ab) / Math.max(1e-9, ab.lengthSq()), 0, 1);
  const off = p.clone().sub(a.clone().addScaledVector(ab, u));
  const d = off.length();
  return { gap: d - r - rad, n: d > 1e-5 ? off.divideScalar(d) : side.clone() };
};

type Body = { sk: Skirt | null; caps: [THREE.Vector3, THREE.Vector3, number, string][]; right: THREE.Vector3; handR: number };
const bodyGap = (b: Body, p: THREE.Vector3, rad: number): Gap => {
  let best = b.sk ? skirtGap(b.sk, p, rad, b.right) : FREE;
  for (const [a, c, r, what] of b.caps) {
    const g = capGap(a, c, r, p, rad, b.right);
    if (g.gap < best.gap) best = { ...g, what };
  }
  return best;
};

/** the skirt shaped around this frame's legs: the hem widens until both thighs and knees stay inside it */
const skirtShape = (P: Pose, bodyR: number, legR: number): Skirt => {
  const top = P.Hips.clone().add(new THREE.Vector3(0, 0.12 * bodyR, 0));
  const knees = P.LeftLeg.clone().add(P.RightLeg).multiplyScalar(0.5);
  const ankles = P.LeftFoot.clone().add(P.RightFoot).multiplyScalar(0.5);
  const bot = knees.lerp(ankles, STYLE.skirtHem);
  const thigh = bot.clone().sub(top);
  const u = thigh.clone().normalize().lerp(new THREE.Vector3(0, -1, 0), STYLE.skirtHang).normalize();
  const len = Math.max(0.05, thigh.dot(u)); // the hem passes through the hem point between the knees and ankles
  const r0 = 0.9 * bodyR;
  let r1 = STYLE.skirtFlare * bodyR;
  for (const sd of ["Left", "Right"]) {
    for (const [a, b] of [[P[sd + "UpLeg"], P[sd + "Leg"]], [P[sd + "Leg"], P[sd + "Foot"]]]) {
      for (let i = 0; i <= 8; i++) {
        const q = a.clone().lerp(b, i / 8);
        const v = q.sub(top);
        const h = v.dot(u);
        if (h < 0.25 * len || h > len) continue;
        const need = v.addScaledVector(u, -h).length() + legR + STYLE.clear;
        r1 = Math.max(r1, r0 + ((need - r0) * len) / h);
      }
    }
  }
  return { top, u, len, r0, r1: Math.min(r1, STYLE.skirtMax * bodyR) };
};

/** push elbows and hands (and the forearm sticks) out of the skirt and the body pill, keeping STYLE.clear; the upper arm
 *  levers about the shoulder out of the skirt (it starts inside the pill: only its lower part is checked against that) */
type Pill = [THREE.Vector3, THREE.Vector3, number];
const pushArms = (P: Pose, sk: Skirt | null, pill: Pill, right: THREE.Vector3, limbR: number, handR: number) => {
  const out = (p: THREE.Vector3, rad: number, side: THREE.Vector3, withPill = true): Gap => {
    const a = sk ? skirtGap(sk, p, rad, side) : FREE;
    if (!withPill) return a;
    const b = capGap(pill[0], pill[1], pill[2], p, rad, side);
    return b.gap < a.gap ? b : a;
  };
  for (const sd of ["Left", "Right"]) {
    const side = sd === "Left" ? right.clone().negate() : right;
    const S = P[sd + "Arm"];
    const E = P[sd + "ForeArm"];
    const H = P[sd + "HandMiddle1"];
    for (let it = 0; it < 4; it++) {
      for (const [p, rad] of [[E, limbR], [H, handR]] as const) {
        const g = out(p, rad + STYLE.clear, side);
        if (g.gap < 0) p.addScaledVector(g.n, -g.gap);
      }
      if (sk)
        for (let i = 2; i <= 8; i++) {
          const f = i / 8;
          const g = out(S.clone().lerp(E, f), limbR + STYLE.clear, side, false);
          if (g.gap < 0) E.addScaledVector(g.n, Math.min(0.15, -g.gap / f));
        }
      for (let i = 1; i < 8; i++) {
        const g = out(E.clone().lerp(H, i / 8), limbR + STYLE.clear, side);
        if (g.gap < 0) {
          E.addScaledVector(g.n, -g.gap);
          H.addScaledVector(g.n, -g.gap);
        }
      }
    }
  }
};

/** a held prop in world space: working end W, unit axis y toward the top end (length L) */
type Hold = { W: THREE.Vector3; y: THREE.Vector3; fix?: [string, THREE.Vector3] };
const SHAFT_R = 0.02;
/** worst shaft sample against the body (samples within `skip` m of `pivot` are ignored: rotation cannot move them) */
const shaftWorst = (h: Hold, L: number, b: Body, pivot: THREE.Vector3 | null, skip = 0.06) => {
  let worst: Gap & { p: THREE.Vector3; f: number } = { gap: Infinity, n: Y, p: h.W, f: 0 };
  for (let i = 0; i <= 16; i++) {
    const p = h.W.clone().addScaledVector(h.y, (L * (0.04 + (0.96 * i) / 16)));
    if (pivot && p.distanceTo(pivot) < skip) continue;
    const g = bodyGap(b, p, SHAFT_R + STYLE.clear);
    if (g.gap < worst.gap) worst = { ...g, p, f: 0.04 + (0.96 * i) / 16 };
  }
  return worst;
};
/** swing the shaft about the grip G until no sample is inside the body (keeps the grip point on the shaft) */
const swingClear = (h: Hold, L: number, b: Body, G: THREE.Vector3): Hold => {
  const along = G.clone().sub(h.W).dot(h.y);
  let y = h.y.clone();
  for (let it = 0; it < 10; it++) {
    const w = shaftWorst({ W: G.clone().addScaledVector(y, -along), y }, L, b, G);
    if (w.gap >= 0) break;
    const a = w.p.clone().sub(G).dot(y);
    y = y.addScaledVector(w.n, (-w.gap + 0.002) / a).normalize();
  }
  return { W: G.clone().addScaledVector(y, -along), y };
};

/** where the prop goes for a grip mode, cleared of skirt, legs and body */
const holdFor = (mode: PropMode, P: Pose, b: Body, fwd: THREE.Vector3, ground: number, ps: PropSpec): Hold => {
  const L = ps.length;
  const right = b.right;
  const hand = P.RightHandMiddle1;
  if (mode === "two") {
    // the top hand is the one higher AND further back (u: up, leaning back); the shaft runs from the lower/front hand
    // to it. When the hands come together or level out (the toss at the end of a dig stroke) their line says nothing
    // (and which hand is "top" flips), so the direction fades smoothly to a default: working end forward and low, handle
    // up and back. Without this the shaft swung level beside the skirt, blade at the hand (Grave Bell s25, 2026-11-16).
    const l = P.LeftHandMiddle1;
    const u = Y.clone().addScaledVector(fwd, -0.6).normalize();
    const d = l.clone().sub(hand); // right hand -> left hand
    const su = d.dot(u);
    const hi = su >= 0 ? l : hand;
    const lo = su >= 0 ? hand : l;
    const ref = Y.clone().multiplyScalar(0.6).addScaledVector(fwd, -1).normalize();
    const sure = Math.tanh(su / 0.06); // +-1: one hand clearly on top; 0: level / together
    const y = d.multiplyScalar(sure).addScaledVector(ref, 0.02 + 0.15 * (1 - Math.abs(sure))).normalize();
    const h = swingClear({ W: hi.clone().addScaledVector(y, -ps.two * L), y }, L, b, hi);
    // the lower hand slides onto the (possibly swung) shaft
    const onShaft = hi.clone().addScaledVector(h.y, lo.clone().sub(hi).dot(h.y));
    return { ...h, fix: [lo === hand ? "RightHandMiddle1" : "LeftHandMiddle1", onShaft] };
  }
  if (mode === "palm") return { W: hand.clone().addScaledVector(Y, -0.5 * L), y: Y.clone() };
  if (mode === "plant") {
    // a long tool standing on its working end beside the right foot, the shaft up to the right hand. The hand moves out
    // to the side until it is clear of the skirt / body outline (so the shaft reads from the front, not hidden behind
    // a skirt), and the foot of the shaft steps outward until the whole shaft clears skirt, legs and body
    const lat = (p: THREE.Vector3) => p.clone().sub(P.Hips).dot(right);
    const hy = hand.y - (b.sk ? b.sk.top.y : P.Hips.y);
    const outline = b.sk ? skirtR(b.sk, -hy) * SKIRT_HULL : b.caps[0][2];
    const grip = hand.clone().addScaledVector(right, Math.max(0, outline + b.handR + 0.04 - lat(hand)));
    const gy = Math.min(P.RightToeBase.y, P.LeftToeBase.y) - 0.03;
    const foot = new THREE.Vector3(P.RightFoot.x, gy, P.RightFoot.z).addScaledVector(fwd, 0.14); // a little forward
    const out0 = Math.max(0.3, lat(grip) - lat(foot)); // the shaft stands upright or leans out, never in under the skirt
    let best: Hold | null = null;
    let bestGap = -Infinity;
    for (let i = 0; i <= 12; i++) {
      const F = foot.clone().addScaledVector(right, out0 + 0.04 * i);
      const h: Hold = { W: F, y: grip.clone().sub(F).normalize(), fix: ["RightHandMiddle1", grip] };
      const g = shaftWorst(h, L, b, grip, 0.04).gap; // the whole shaft, the handle above the hand too
      if (g > bestGap) {
        best = h;
        bestGap = g;
      }
      if (g >= 0) break;
    }
    return best!;
  }
  // carry: one hand at `carry` from the working end; the working end low and forward, a little OUT to the side, high
  // enough to clear the ground; then swung clear of the legs (a carried prop never crosses the legs or body)
  const along = ps.carry * L;
  const a = Math.max(STYLE.carryTilt, Math.acos(THREE.MathUtils.clamp((hand.y - ground - 0.08) / along, -1, 1)));
  const down = fwd.clone().multiplyScalar(0.92).addScaledVector(right, 0.38).normalize().multiplyScalar(Math.sin(a)).addScaledVector(Y, -Math.cos(a));
  let h = swingClear({ W: hand.clone().addScaledVector(down, along), y: down.clone().negate() }, L, b, hand);
  if (h.W.y < ground + 0.03) {
    // still too low after the swing: raise the working end (same heading)
    const flat = new THREE.Vector3(-h.y.x, 0, -h.y.z).normalize();
    const dy = Math.min(1, (hand.y - ground - 0.03) / along);
    const d2 = flat.multiplyScalar(Math.sqrt(1 - dy * dy)).addScaledVector(Y, -dy);
    h = { W: hand.clone().addScaledVector(d2, along), y: d2.negate() };
  }
  return h;
};

/** turn unit vector a toward unit vector b by the share w (great-circle) */
const slerpDir = (a: THREE.Vector3, b: THREE.Vector3, w: number) =>
  a.clone().applyQuaternion(new THREE.Quaternion().slerp(new THREE.Quaternion().setFromUnitVectors(a, b), w)).normalize();

type Solved = {
  P: Pose; sk: Skirt | null; body: Body; hold: { W: THREE.Vector3; y: THREE.Vector3; L: number; q?: THREE.Quaternion; size: number } | null;
  /** arms whose hand is held behind the back (drawn behind the torso layer when the hand is farther than it) */
  armBack: Record<string, number>;
  /** 0..1 how far the dead slump is in */
  slumpW: number;
  /** 0..1 how far the aim pose is in (the aiming arm is drawn without the noodle bow) */
  aimW: number;
  /** hands that hold the shaft this frame, with how much (1 = fully; a 'two' hand fades in/out with its mode) */
  grips: [string, number][];
  /** grabbing hands this frame: weight (1 = on the target) and how far the hand is short of the full target (m) */
  reach: { hand: string; w: number; err: number }[];
  d: Dims; bodyR: number; limbR: number; handR: number;
};

/** reach / release seconds of a grab: >= REACH.minTime, and long enough that the arm turns <= REACH.maxSpeed between
 *  the clip's own hand and the target (measured on the clip pose where the move starts / ends) */
const grabTimes = (r: Rig, clips: ClipKey[], at: V3, yaw: number, d: Dims, quiet: boolean, g: Grab) => {
  const sd = g.hand === "left" ? "Left" : "Right";
  const need = (tc: number, sign: number, given?: number) => {
    let dur = REACH.minTime;
    if (given !== undefined) return Math.max(REACH.minTime, given);
    // the start pose depends on the duration: iterate until it settles (the longest wins)
    for (let i = 0; i < 4; i++) {
      const Q = sample(r, clips, tc + sign * dur, at, yaw, d, quiet);
      const next = timeFor(armAngle(Q[sd + "Arm"], Q[sd + "HandMiddle1"], targetAt(g, tc)));
      if (next <= dur + 1e-3) break;
      dur = next;
    }
    return dur;
  };
  const reach = need(g.at, -1, g.reach);
  const release = g.until === undefined ? REACH.minTime : need(g.until, 1, g.release);
  // the arm's direction (shoulder -> hand) where the reach starts / the release ends: the blend runs from / to these
  // FIXED directions, so the clip's own pose snaps on that arm cannot whip it during the move
  const dirAt = (tt: number) => {
    const Q = sample(r, clips, tt, at, yaw, d, quiet);
    return Q[sd + "HandMiddle1"].clone().sub(Q[sd + "Arm"]);
  };
  return { reach, release, from: dirAt(g.at - reach), to: g.until === undefined ? null : dirAt(g.until + release) };
};

/** one frame of `who`: pose, skirt, pushed arms, prop hold. Pure function of (clips, t, at, yaw, prop). */
const solve = (who: string, clips: ClipKey[], t: number, at: V3, yaw: number, prop?: PropHold, grab?: Grab[], slump?: Slump): Solved => {
  const spec: CharacterSpec = CAST[who];
  if (!spec) throw new Error(`cast has no "${who}" (src/char/cast.ts)`);
  const look = lookOf(spec);
  const H = spec.height ?? 1.7;
  const r = rigFor(who, [...new Set(clips.map((c) => c.clip))]);
  const d = dimsFor(r, H);
  const slumpW = slump ? smoother((t - slump.at) / Math.max(0.05, slump.dur ?? 0.5)) : 0;
  // a slumped body stops moving: the clip freezes once the slump is in
  const tc = slump ? Math.min(t, slump.at + (slump.dur ?? 0.5)) : t;
  const P = sample(r, clips, tc, at, yaw, d, !prop);
  if (slumpW > 0) {
    // the upper body sags about the hips: sideways (about the facing axis) and back (about the right axis)
    const f0 = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const r0 = new THREE.Vector3(-Math.cos(yaw), 0, Math.sin(yaw));
    const q = new THREE.Quaternion().setFromAxisAngle(f0, (slump!.side ?? 1) * (slump!.sag ?? 0.32) * slumpW)
      .multiply(new THREE.Quaternion().setFromAxisAngle(r0, (slump!.back ?? 0.22) * slumpW));
    const piv = P.Hips.clone();
    for (const n of BONES) if (!LEGS.test(n) && n !== "Hips") P[n].sub(piv).applyQuaternion(q).add(piv);
  }
  const bodyR = d.R;
  const limbR = STYLE.limb * d.u;
  const handR = STYLE.hand * d.u;
  const legR = limbR;
  const fwd = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
  const right = new THREE.Vector3(-Math.cos(yaw), 0, Math.sin(yaw));
  const sk = look.torsoPattern === "dress" ? skirtShape(P, bodyR, legR) : null;
  const { ax, B, T } = torsoOf(P, d);
  const pill: Pill = [B.clone().addScaledVector(ax, bodyR), T.clone().addScaledVector(ax, -bodyR), bodyR * 1.02];
  // RicksClips arms are short: shoulder -> hand 0.85-1.0 x the torso height (RC_CHARACTER_STYLE §1), so a hanging
  // hand ends at the torso's lower edge and hands always sit torso-high (user rule 2026-11-20). Mixamo arms are ~1.5 x:
  // scale both arm bones about the shoulder (the pose's angles are kept). Grabs (reach.tsx) still use the raw lengths.
  const armK = (STYLE.armLen * d.torsoLen) / (d.armUp + d.armLo);
  for (const sd of ["Left", "Right"]) {
    const S = P[sd + "Arm"], E = P[sd + "ForeArm"], Hd = P[sd + "HandMiddle1"];
    const e2 = S.clone().addScaledVector(E.clone().sub(S), armK);
    const h2 = e2.clone().addScaledVector(Hd.clone().sub(E), armK);
    E.copy(e2); Hd.copy(h2);
  }
  pushArms(P, sk, pill, right, limbR, handR);
  const upK = d.armUp * armK, loK = d.armLo * armK; // the drawn (short RC) arm lengths
  /** swing an arm onto `goal` by weight w about its shoulder (direction slerped, distance blended) and solve it with
   *  the drawn lengths, the elbow bending toward `hint` (blended from the clip's elbow) */
  const armTo = (sd: string, goal: THREE.Vector3, hint: THREE.Vector3, w: number) => {
    if (w <= 1e-4) return;
    const S = P[sd + "Arm"], E = P[sd + "ForeArm"], Hd = P[sd + "HandMiddle1"];
    const a0 = Hd.clone().sub(S), a1 = goal.clone().sub(S);
    const dir = a0.lengthSq() > 1e-8 && a1.lengthSq() > 1e-8 ? slerpDir(a0.clone().normalize(), a1.clone().normalize(), w) : a1.clone().normalize();
    const g = S.clone().addScaledVector(dir, THREE.MathUtils.lerp(a0.length(), a1.length(), w));
    const ik = solveArm(S, E.clone().lerp(hint, w), g, upK, loK);
    E.copy(ik.E);
    Hd.copy(ik.H);
  };
  /** a relaxed hang for an arm (hand by the thigh), the RC rest pose */
  const hang = (sd: string, w: number, out = 0.16, fwdK = 0.05) => {
    const S = P[sd + "Arm"];
    const sg = sd === "Left" ? -1 : 1;
    const down = ax.clone().negate().addScaledVector(right, sg * out).addScaledVector(fwd, fwdK).normalize();
    armTo(sd, S.clone().addScaledVector(down, 0.96 * (upK + loK)), S.clone().addScaledVector(down, upK).addScaledVector(right, sg * 0.04), w);
  };
  if (slumpW > 0 && slump!.arms !== false) {
    // limp arms: hands drop into the lap / beside the hips
    for (const sd of ["Left", "Right"]) hang(sd, slumpW, 0.22, 0.25);
  }
  // ---- arm poses of the held-prop modes aim / behind / chest, blended in over the mode fade (quintic)
  const armBack: Record<string, number> = {};
  const gun = !!(prop && getProp(prop.id).spec.gun);
  const size = prop?.size ?? (gun ? 1.4 : 1);
  /** modes whose prop hold is solved here (gun holds, aim, behind, chest) */
  const isPose = (mo: PropMode) => POSE_MODES.has(mo) || (gun && (mo === "palm" || mo === "two" || mo === "low"));
  let fade = prop?.fade ?? 0.4;
  if (prop && prop.fade === undefined && typeof prop.mode !== "string" && prop.mode.some((k) => isPose(k.mode))) fade = 0.3;
  const mk = prop ? modeAt(prop.mode, t, fade) : null;
  const wMode = (mode: PropMode) => (!mk ? 0 : smoother((mk.a === mode ? 1 - mk.w : 0) + (mk.b === mode ? mk.w : 0)) * (1 - slumpW));
  const wAim = wMode("aim"), wBehind = wMode("behind"), wChest = wMode("chest");
  const wLow = gun ? wMode("low") : 0, wTwoG = gun ? wMode("two") : 0;
  const kick = prop?.fire ? prop.fire.reduce((s, f) => s + recoil(t, f), 0) : 0;
  const aimT = prop?.target ? new THREE.Vector3(...(typeof prop.target === "function" ? prop.target(t) : prop.target)) : P.RightArm.clone().addScaledVector(fwd, 5);
  /** aim direction from a point, pitched up by `up` rad (recoil) */
  const aimFrom = (o: THREE.Vector3, up: number) => {
    const dv = aimT.clone().sub(o).normalize();
    if (Math.abs(up) < 1e-5) return dv;
    const axis = new THREE.Vector3().crossVectors(dv, Y);
    return axis.lengthSq() < 1e-8 ? dv : dv.applyAxisAngle(axis.normalize(), up);
  };
  if (wAim > 0) {
    const S = P.RightArm;
    const dv = aimFrom(S, 0.1 * kick);
    const goal = S.clone().addScaledVector(dv, 0.97 * (upK + loK)); // elbow almost straight
    const hint = S.clone().addScaledVector(dv, 0.5 * upK).addScaledVector(Y, -0.08).addScaledVector(right, 0.05);
    armTo("Right", goal, hint, wAim);
    hang("Left", wAim * 0.85);
  }
  // chest holds: "in front of the chest" as seen from the lens (the torso is a flat card facing it: a point 12 cm in
  // front of the body's own forward axis lands beside the torso in a 3/4 view)
  const camF = prop?.cam ? new THREE.Vector3(prop.cam[0] - P.Hips.x, 0, prop.cam[2] - P.Hips.z) : fwd.clone();
  const cf = camF.lengthSq() > 1e-6 ? camF.normalize().lerp(fwd, 0.25).normalize() : fwd.clone();
  const cr = new THREE.Vector3().crossVectors(cf, Y).multiplyScalar(-1).normalize(); // "right" in that frame
  if (cr.dot(right) < 0) cr.negate();
  const chestC = (() => {
    const tf = torsoOf(P, d);
    return tf.B.clone().addScaledVector(tf.ax, 0.62 * d.torsoLen).addScaledVector(cf, bodyR + handR + 0.02);
  })();
  if (wLow > 0) hang("Right", wLow, 0.2, 0.16); // gun at the thigh, the hand a little forward
  const twoC = chestC.clone().addScaledVector(Y, -0.07).addScaledVector(cf, 0.02); // nervous two-hand hold: low chest
  if (wTwoG > 0) {
    armTo("Right", twoC.clone().addScaledVector(cr, 0.01), twoC.clone().addScaledVector(cr, 0.22).addScaledVector(Y, -0.2), wTwoG);
    armTo("Left", twoC.clone().addScaledVector(cr, -1.5 * handR).addScaledVector(Y, -0.015), twoC.clone().addScaledVector(cr, -0.22).addScaledVector(Y, -0.2), wTwoG);
  }
  if (wBehind > 0) {
    // the gun hand in the small of the back, a little to the right; the elbow out and back
    const goal = P.Hips.clone().addScaledVector(ax, 0.12 * d.torsoLen).addScaledVector(fwd, -(bodyR + handR + 0.04)).addScaledVector(right, 0.35 * bodyR);
    const hint = P.RightArm.clone().addScaledVector(right, 0.12).addScaledVector(fwd, -0.12).addScaledVector(ax, -0.12);
    armTo("Right", goal, hint, wBehind);
    armBack.Right = wBehind;
  }
  if (wChest > 0) {
    const pr = getProp(prop!.id);
    const rad = 0.5 * pr.spec.length * size; // a round prop: half its height
    const lo = chestC.clone().addScaledVector(Y, -0.25 * rad);
    armTo("Right", lo.clone().addScaledVector(cr, rad + 0.6 * handR), lo.clone().addScaledVector(cr, 0.2).addScaledVector(Y, -0.15), wChest);
    // the left hand: on the other side, or (strike) up and down onto the top of the prop at each strike time
    const L0 = lo.clone().addScaledVector(cr, -(rad + 0.6 * handR));
    const cap = chestC.clone().addScaledVector(Y, rad + 0.7 * handR);
    const lift = cap.clone().addScaledVector(Y, 0.08).addScaledVector(cr, -0.05).addScaledVector(cf, 0.03);
    let goal = L0;
    for (const s of prop!.strike ?? []) {
      const u = t - s;
      if (u < -0.5 || u > 0.45) continue;
      if (u < -0.15) goal = L0.clone().lerp(lift, smoother((u + 0.5) / 0.35)); // wind up
      else if (u < 0) goal = lift.clone().lerp(cap, ((u + 0.15) / 0.15) ** 2); // the strike accelerates into the cap
      else if (u < 0.06) goal = cap; // contact
      else goal = cap.clone().lerp(L0, smoother((u - 0.06) / 0.39)); // back
    }
    armTo("Left", goal, lo.clone().addScaledVector(cr, -0.2).addScaledVector(Y, -0.15), wChest);
  }
  const caps: Body["caps"] = [[...pill, "body"]];
  for (const sd of ["Left", "Right"]) {
    caps.push([P[sd + "UpLeg"], P[sd + "Leg"], legR, sd + "Thigh"], [P[sd + "Leg"], P[sd + "Foot"], legR, sd + "Shin"]);
    const shoe = P[sd + "Foot"].clone().lerp(P[sd + "ToeBase"], 0.5);
    caps.push([shoe, shoe, 2.2 * limbR, sd + "Shoe"]);
  }
  const body: Body = { sk, caps, right, handR };
  let hold: Solved["hold"] = null;
  const grips: Solved["grips"] = [];
  if (prop && mk) {
    const pr = getProp(prop.id);
    const m = mk;
    if (!(m.a === "none" && m.b === "none")) {
      const ma = m.a === "none" ? m.b : m.a;
      const mb = m.b === "none" ? m.a : m.b;
      const L = pr.spec.length * size;
      const ps: PropSpec = size === 1 ? pr.spec : { ...pr.spec, length: L };
      const G = P.RightHandMiddle1;
      const gripY = (pr.spec.grips?.hand?.[1] ?? pr.spec.carry * pr.spec.length) * size; // grip distance from the working end
      /** the hold of a pose mode: working end W and orientation q (local +Y = working end -> top) */
      // gun holds: grip point wrapped in the drawn hand, barrel along F (muzzle direction), the slide's top toward U
      const tl = new THREE.Vector3(...(pr.spec.up ?? [0, 0, 1]));
      const gl = new THREE.Vector3(...(pr.spec.grips?.hand ?? [0, pr.spec.carry * pr.spec.length, 0])).multiplyScalar(size);
      const frame = (a: THREE.Vector3, b: THREE.Vector3) => new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(a, b, new THREE.Vector3().crossVectors(a, b)));
      const qL = frame(Y, tl).invert();
      const gunHold = (F: THREE.Vector3, U: THREE.Vector3) => {
        const y = F.clone().negate().normalize();
        let u = U.clone().addScaledVector(y, -U.dot(y));
        if (u.lengthSq() < 1e-6) u = fwd.clone().addScaledVector(y, -fwd.dot(y));
        const q = frame(y, u.normalize()).multiply(qL);
        return { W: G.clone().sub(gl.clone().applyQuaternion(q)), q };
      };
      const pitched = (h: THREE.Vector3, a: number) => h.clone().setY(0).normalize().multiplyScalar(Math.cos(a)).addScaledVector(Y, Math.sin(a));
      const poseHold = (mode: PropMode): { W: THREE.Vector3; q: THREE.Quaternion } => {
        if (gun) {
          if (mode === "aim") return gunHold(aimFrom(G, 0.45 * kick), Y); // level on the aim line; the wrist kicks up
          if (mode === "low") return gunHold(pitched(fwd.clone().addScaledVector(right, 0.12), -0.5), Y);
          if (mode === "two") return gunHold(prop.target ? aimFrom(G, 0) : pitched(fwd, -0.4), Y);
          if (mode === "behind") return gunHold(Y.clone().multiplyScalar(-0.94).addScaledVector(fwd, -0.34), fwd.clone().negate());
          if (mode === "palm") {
            // along the forearm (wrist straight), but never steeper than 35 deg down / 20 deg up: muzzle forward
            const fa = G.clone().sub(P.RightForeArm).normalize();
            const h = fa.clone().setY(0).lengthSq() > 0.04 ? fa : fwd;
            return gunHold(pitched(h, THREE.MathUtils.clamp(Math.asin(THREE.MathUtils.clamp(fa.y, -1, 1)), -0.6, 0.35)), Y);
          }
        }
        if (mode === "aim") {
          const dg = aimFrom(G, 0.45 * kick); // the wrist kicks the muzzle up further than the arm
          const y = dg.clone().negate();
          const z = Y.clone().addScaledVector(y, -Y.dot(y));
          if (z.lengthSq() < 1e-6) z.copy(fwd);
          z.normalize();
          const x = new THREE.Vector3().crossVectors(y, z).normalize();
          return { W: G.clone().addScaledVector(dg, gripY), q: new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z)) };
        }
        if (mode === "behind") {
          const y = Y.clone().addScaledVector(fwd, 0.35).normalize(); // muzzle down and a little back
          return { W: G.clone().addScaledVector(y, -gripY), q: holdQuat(y, yaw) };
        }
        // chest: upright, centred between the hands
        return { W: chestC.clone().addScaledVector(Y, -0.5 * L), q: holdQuat(Y, yaw) };
      };
      if (isPose(ma) || isPose(mb)) {
        // a pose mode on either side: working end and orientation blended (the arm pose itself is blended above)
        const legacy = (mode: PropMode) => { const h = holdFor(mode, P, body, fwd, at[1], ps); return { W: h.W, q: holdQuat(h.y, yaw) }; };
        const hA = isPose(ma) ? poseHold(ma) : legacy(ma);
        const hB = isPose(mb) ? poseHold(mb) : legacy(mb);
        const q = hA.q.clone().slerp(hB.q, smoother(m.w));
        const W = hA.W.clone().lerp(hB.W, smoother(m.w));
        hold = { W, y: Y.clone().applyQuaternion(q), L, q, size };
        grips.push(["RightHandMiddle1", 1]);
        if (wChest > 0) grips.push(["LeftHandMiddle1", wChest]);
        if (wTwoG > 0) grips.push(["LeftHandMiddle1", wTwoG]);
      } else {
        const hand0 = P.RightHandMiddle1.clone();
        const A = holdFor(ma, P, body, fwd, at[1], ps);
        const B = holdFor(mb, P, body, fwd, at[1], ps);
        for (const [hd, w] of [[A, 1 - m.w], [B, m.w]] as const) if (hd.fix && w > 0) P[hd.fix[0]].lerp(hd.fix[1], w);
        if (A.fix || B.fix) pushArms(P, sk, pill, right, limbR, handR); // a hand slid onto the shaft stays out of skirt and body
        // The right hand holds the prop in every mode, so the shaft is placed through where that hand is DRAWN (after the
        // push), and a mode change turns the shaft about that hand: direction slerped, grip distance from the working end
        // blended. (Blending the two holds' working ends and directions separately let the shaft swing level beside the
        // body with the hand at the blade neck during the 0.4 s cross-fade.) 'plant' keeps its foot on the ground.
        const anchor = (h: Hold, mode: PropMode) => {
          if (mode === "plant") return { y: G.clone().sub(h.W).normalize(), along: G.distanceTo(h.W) };
          const grip = h.fix && h.fix[0] === "RightHandMiddle1" ? h.fix[1] : hand0;
          return { y: h.y.clone(), along: grip.clone().sub(h.W).dot(h.y) };
        };
        const a = anchor(A, ma);
        const b = anchor(B, mb);
        const y = slerpDir(a.y, b.y, m.w);
        let along = THREE.MathUtils.lerp(a.along, b.along, m.w);
        const low = G.y - along * y.y - at[1]; // the working end never dips under the ground mid-blend
        if (low < 0 && y.y > 0.2) along += low / y.y;
        let h: Hold = { W: G.clone().addScaledVector(y, -along), y };
        if (ma !== mb && m.w > 0 && m.w < 1) h = swingClear(h, L, body, G); // the turning shaft stays clear of skirt, legs, body
        grips.push(["RightHandMiddle1", 1]);
        // the other hand of a 'two' grip goes back onto the final shaft (the push above may have moved it off)
        const wTwo = (ma === "two" ? 1 - m.w : 0) + (mb === "two" ? m.w : 0);
        if (wTwo > 0) {
          const Lh = P.LeftHandMiddle1;
          Lh.lerp(h.W.clone().addScaledVector(h.y, THREE.MathUtils.clamp(Lh.clone().sub(h.W).dot(h.y), 0, L)), wTwo);
          grips.push(["LeftHandMiddle1", wTwo]);
        }
        hold = { W: h.W, y: h.y, L, size };
      }
    }
  }
  // hands on world targets: the clip's hand is blended toward the target (quintic, grabTimes) and the arm is solved onto
  // it with its drawn lengths. An unreachable target leaves the hand short (err): never stretch the arm.
  const reach: Solved["reach"] = [];
  for (const g of grab ?? []) {
    const tm = grabTimes(r, clips, at, yaw, d, !prop, g);
    const w = grabWeight(g, t, tm.reach, tm.release);
    if (w <= 0) continue;
    const sd = g.hand === "left" ? "Left" : "Right";
    const S = P[sd + "Arm"];
    const E = P[sd + "ForeArm"];
    const Hd = P[sd + "HandMiddle1"];
    const T = targetAt(g, t);
    const full = solveArm(S, E, T, d.armUp, d.armLo);
    // in between, the goal swings ABOUT THE SHOULDER (direction slerped, distance blended) from the arm's direction at
    // the start of the reach (or to the one at the end of the release): a straight line from the clip's hand to the
    // target can pass close to the shoulder and whip the arm round (6.7 rad/s measured), and a stepped clip's pose snap
    // mid-reach adds its own speed (4.4 rad/s measured)
    const a0 = (t < g.at ? tm.from : tm.to ?? tm.from).clone();
    const a1 = T.clone().sub(S);
    const dir = a0.lengthSq() > 1e-8 && a1.lengthSq() > 1e-8 ? slerpDir(a0.clone().normalize(), a1.clone().normalize(), w) : a1.clone().normalize();
    const goal = S.clone().addScaledVector(dir, THREE.MathUtils.lerp(a0.length(), a1.length(), w));
    const ik = w >= 1 ? full : solveArm(S, E, goal, d.armUp, d.armLo);
    E.lerp(ik.E, Math.min(1, 2 * w));
    Hd.copy(ik.H);
    reach.push({ hand: sd + "HandMiddle1", w, err: full.err });
  }
  return { P, sk, body, hold, grips, reach, d, bodyR, limbR, handR, armBack, slumpW, aimW: wAim };
};

// ------------------------------------------------------------------ geometry + materials (module caches, bounded)
const G = {
  limb: new THREE.CylinderGeometry(1, 1, 1, 10),
  dot: new THREE.SphereGeometry(1, 16, 12),
};
const M = {
  shadow: new THREE.MeshBasicMaterial({ color: "#3a2a5a", transparent: true, opacity: 0.16, depthWrite: false }),
};
const NO_INK = { outline: false };
const OCC = { outline: "silent" }; // cut-out occluder in the ink pass that gets no ink itself (engine/post/pipeline occMatFor): the drawing has its own outline
/** bounded keyed cache (insertion order eviction): per-shot clones and per-shot geometry */
const bounded = <T,>(m: Map<string, T>, key: string, make: () => T, max = 32): T => {
  let v = m.get(key);
  if (v === undefined) {
    v = make();
    m.set(key, v);
    while (m.size > max) m.delete(m.keys().next().value as string);
  }
  return v;
};

const Stick: React.FC<{ a: THREE.Vector3; b: THREE.Vector3; r: number; cast: boolean }> = ({ a, b, r, cast }) => {
  const d = b.clone().sub(a);
  const q = new THREE.Quaternion().setFromUnitVectors(Y, d.clone().normalize());
  return <mesh geometry={G.limb} material={INK_MAT} position={a.clone().add(b).multiplyScalar(0.5)} quaternion={q} scale={[r, d.length(), r]} castShadow={cast} userData={OCC} />;
};
const Dot: React.FC<{ p: THREE.Vector3; r: number; cast: boolean }> = ({ p, r, cast }) => (
  <mesh geometry={G.dot} material={INK_MAT} position={p} scale={r} castShadow={cast} userData={OCC} />
);

// limb = a tube along a quadratic curve through the middle joint (one smooth bend, never two straight segments).
// One geometry per character, limb and shot (the two canvases of a dissolve never share it); its positions are
// rewritten from the joints every frame, never accumulated.
const SEG = 16;
const RAD = 8;
const tubeGeos = new Map<string, THREE.BufferGeometry>();
const newTube = () => {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array((SEG + 1) * RAD * 3), 3));
  g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array((SEG + 1) * RAD * 2).fill(0.5), 2));
  const idx: number[] = [];
  for (let i = 0; i < SEG; i++)
    for (let j = 0; j < RAD; j++) {
      const a = i * RAD + j;
      const b = i * RAD + ((j + 1) % RAD);
      idx.push(a, a + RAD, b, b, a + RAD, b + RAD);
    }
  g.setIndex(idx);
  return g;
};
const curveAt = (a: THREE.Vector3, m: THREE.Vector3, b: THREE.Vector3, t: number) => {
  // quadratic Bezier that passes through m at t = 0.5
  const c = m.clone().multiplyScalar(2).addScaledVector(a, -0.5).addScaledVector(b, -0.5);
  const k = 1 - t;
  return a.clone().multiplyScalar(k * k).addScaledVector(c, 2 * k * t).addScaledVector(b, t * t);
};
const tubeGeo = (key: string, a: THREE.Vector3, m: THREE.Vector3, b: THREE.Vector3, r: number, ref: THREE.Vector3) => {
  const g = bounded(tubeGeos, key, newTube, 96);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= SEG; i++) pts.push(curveAt(a, m, b, i / SEG));
  const n1 = V();
  const n2 = V();
  for (let i = 0; i <= SEG; i++) {
    const tan = pts[Math.min(SEG, i + 1)].clone().sub(pts[Math.max(0, i - 1)]);
    if (tan.lengthSq() < 1e-12) tan.set(0, 1, 0);
    tan.normalize();
    n1.crossVectors(tan, ref);
    if (n1.lengthSq() < 1e-8) n1.crossVectors(tan, Math.abs(tan.y) < 0.9 ? Y : new THREE.Vector3(1, 0, 0));
    n1.normalize();
    n2.crossVectors(tan, n1);
    for (let j = 0; j < RAD; j++) {
      const an = (j / RAD) * Math.PI * 2;
      const c = Math.cos(an) * r;
      const s = Math.sin(an) * r;
      pos.setXYZ(i * RAD + j, pts[i].x + n1.x * c + n2.x * s, pts[i].y + n1.y * c + n2.y * s, pts[i].z + n1.z * c + n2.z * s);
    }
  }
  pos.needsUpdate = true;
  g.computeBoundingSphere();
  return g;
};

// 'dress' skirt layer: a strip from the hips (half width r0) to the hem (r1), facing the lens; positions rewritten per frame
const SK_ROWS = 6;
const SK_COLS = 8; // a trapezoid of two triangles kinks the drawing along its diagonal: many small cells do not
const skirtGeos = new Map<string, THREE.BufferGeometry>();
const skirtGeo = (key: string, r0: number, r1: number, len: number) => {
  const g = bounded(skirtGeos, key, () => new THREE.PlaneGeometry(1, 1, SK_COLS, SK_ROWS), 16);
  const pos = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i <= SK_ROWS; i++) {
    const v = i / SK_ROWS;
    const hw = r0 + (r1 - r0) * v;
    for (let j = 0; j <= SK_COLS; j++) pos.setXYZ(i * (SK_COLS + 1) + j, hw * ((2 * j) / SK_COLS - 1), -v * len, 0);
  }
  pos.needsUpdate = true;
  g.computeBoundingSphere();
  return g;
};

const exprAt = (e: StickmanProps["expr"], t: number): { e: AnyExpression; since: number } => {
  if (!e) return { e: "neutral", since: -1e9 };
  if (typeof e === "string") return { e, since: -1e9 };
  const ks = [...e].sort((a, b) => a.at - b.at);
  let i = 0;
  for (let k = 0; k < ks.length; k++) if (ks[k].at <= t) i = k;
  return { e: ks[i].e, since: i === 0 ? -1e9 : ks[i].at }; // the first expression is simply there: no reaction
};

// ------------------------------------------------------------------ puppet layer: what an expression change does
const BIG = new Set<AnyExpression>(["laugh", "cheer"]);
const JOLT = new Set<string>(["shocked", "scared", "aghast", "terrified", "panicked"]); // string: some casts add their own expressions (aghast...)
const pulse = (t: number, a: number, b: number) => (t <= a || t >= b ? 0 : Math.sin((Math.PI * (t - a)) / (b - a)));
/** trapezoid: up over `ramp`, held until `hold`, down over `ramp` */
const trap = (t: number, ramp: number, hold: number) => (t <= 0 || t >= hold + ramp ? 0 : t < ramp ? t / ramp : t < hold ? 1 : 1 - (t - hold) / ramp);
/** ts = seconds since the expression changed; sg = +-1 (seeded). hop x figure height, tip rad, hat x head height */
export const reaction = (e: AnyExpression, ts: number, sg: number) => {
  if (ts < 0 || ts > 3) return { hop: 0, tip: 0, lean: 0, hat: 0, hatTip: 0 };
  if (BIG.has(e)) {
    const n = ts / STYLE.hopT;
    const b = n < 1 ? Math.sin(Math.PI * n) : n < 2 ? 0.6 * Math.sin(Math.PI * (n - 1)) : 0.1 * Math.abs(Math.sin(Math.PI * n)) * Math.exp(-(n - 2) * 0.6);
    const tip = STYLE.tipBig * sg * trap(ts, 0.07, 2 * STYLE.hopT);
    return { hop: STYLE.hop * b, tip, lean: STYLE.jellyLean * tip, hat: STYLE.hatLift * pulse(ts, 0.03, 0.2), hatTip: -0.3 * sg * pulse(ts, 0.03, 0.2) };
  }
  if (JOLT.has(e)) return { hop: STYLE.jolt * pulse(ts, 0, 0.22), tip: 0, lean: STYLE.leanJolt * sg * trap(ts, 0.05, 0.4), hat: 0.7 * STYLE.hatLift * pulse(ts, 0.02, 0.17), hatTip: 0.15 * sg * pulse(ts, 0.02, 0.17) };
  const tip = STYLE.tip * sg * trap(ts, 0.067, 0.5);
  return { hop: STYLE.nod * pulse(ts, 0, 0.13), tip, lean: STYLE.jellyLean * tip, hat: 0, hatTip: 0 };
};
/** a damped spring chasing sig(t), simulated over the last `win` s (deterministic: every frame re-runs it) */
const spring = (sig: (tt: number) => number, t: number, [hz, z]: [number, number], win = 0.9) => {
  const w = 2 * Math.PI * hz, dt = 1 / 60;
  let x = sig(t - win), v = 0;
  for (let tt = t - win; tt < t; tt += dt) { v += (w * w * (sig(tt) - x) - 2 * z * w * v) * dt; x += v * dt; }
  return x;
};
const hash = (n: number) => {
  let x = (Math.imul(n | 0, 0x9e3779b1) ^ 0x85ebca6b) >>> 0;
  x = Math.imul(x ^ (x >>> 15), 0x2c1b3c6d) >>> 0;
  return (x ^ (x >>> 13)) >>> 0;
};

const holdQuat = (y: THREE.Vector3, yaw: number) => {
  const fwd = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
  let z = fwd.addScaledVector(y, -fwd.dot(y));
  if (z.lengthSq() < 1e-6) z = new THREE.Vector3(-Math.cos(yaw), 0, Math.sin(yaw)).cross(y);
  z.normalize();
  const x = new THREE.Vector3().crossVectors(y, z).normalize();
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
};

const propClones = new Map<string, THREE.Object3D>();

/** world walking speed (m/s) of `who` on an in-place clip, at the character's own scale: integrate it with walked() */
export const walkSpeed = (who: string, clips: ClipKey[], clip = clips[0].clip): number => {
  const spec = CAST[who];
  const r = rigFor(who, [...new Set(clips.map((c) => c.clip))]);
  const { s } = dimsFor(r, spec.height ?? 1.7);
  return clipSpeed(r, clip) * s;
};

/** world joint positions of `who` at shot time t, as <Stickman/> poses them (arms pushed out of a skirt, the lower
 *  hand on a two-hand shaft): attach papers, letters, dropped items to a hand. Pass the same `prop` as the Stickman
 *  when it holds one. (The reaction hop of an expression change, a few cm for ~0.5 s, is not included.) */
export const jointsAt = (who: string, clips: ClipKey[], t: number, at: V3, yaw: number, prop?: PropHold, grab?: Grab[], slump?: Slump): Pose =>
  solve(who, clips, t, at, yaw, prop, grab, slump).P;

/** the held gun at shot time t, as <Stickman/> draws it (pass the same prop / grab / slump): muzzle point, unit
 *  direction it fires along, the gripping hand. For <GunShot p={g.muzzle} dir={g.dir}/> and a POV / OTS camera.
 *  null when the prop is not shown. (The reaction hop of an expression change, a few cm, is not included.) */
export const gunAt = (who: string, clips: ClipKey[], t: number, at: V3, yaw: number, prop: PropHold, grab?: Grab[], slump?: Slump) => {
  const S = solve(who, clips, t, at, yaw, prop, grab, slump);
  if (!S.hold) return null;
  const h = S.P.RightHandMiddle1;
  return { muzzle: [S.hold.W.x, S.hold.W.y, S.hold.W.z] as V3, dir: [-S.hold.y.x, -S.hold.y.y, -S.hold.y.z] as V3, hand: [h.x, h.y, h.z] as V3 };
};

/** contact QA at shot time t (metres; negative = passes through): arm = elbows / hands / arm sticks vs the skirt,
 *  leg = thighs / knees vs the skirt (a leg poking out), prop = the held shaft vs skirt, legs and body,
 *  grip = the farthest holding hand's distance from the shaft axis (0 = on it; a 'two' hand counts once it is >= half
 *  in its mode; > ~0.03 m reads as a hand beside the shaft), reach = the worst grabbing hand's distance short of its
 *  target (> REACH.maxErr: move the character or the prop) */
export const poseQA = (who: string, clips: ClipKey[], t: number, at: V3, yaw: number, prop?: PropHold, grab?: Grab[]) => {
  const S = solve(who, clips, t, at, yaw, prop, grab);
  const { P, sk, body, hold, limbR, handR } = S;
  const raw = sample(rigFor(who, [...new Set(clips.map((c) => c.clip))]), clips, t, at, yaw, S.d, !prop); // before the push
  const armGap = (Q: Pose, sd: string) => {
    const pts: [THREE.Vector3, number][] = [[Q[sd + "HandMiddle1"], handR]];
    for (let i = 2; i <= 8; i++) pts.push([Q[sd + "Arm"].clone().lerp(Q[sd + "ForeArm"], i / 8), limbR]);
    for (let i = 0; i <= 8; i++) pts.push([Q[sd + "ForeArm"].clone().lerp(Q[sd + "HandMiddle1"], i / 8), limbR]);
    return Math.min(...pts.map(([p, r]) => skirtGap(sk!, p, r, body.right).gap));
  };
  let arm = Infinity;
  let armRaw = Infinity;
  let leg = Infinity;
  if (sk) {
    for (const sd of ["Left", "Right"]) {
      arm = Math.min(arm, armGap(P, sd));
      armRaw = Math.min(armRaw, armGap(raw, sd));
      for (const [a, b] of [[P[sd + "UpLeg"], P[sd + "Leg"]], [P[sd + "Leg"], P[sd + "Foot"]]])
        for (let i = 0; i <= 8; i++) {
          const v = a.clone().lerp(b, i / 8).sub(sk.top);
          const h = v.dot(sk.u);
          if (h < 0.25 * sk.len || h > sk.len) continue;
          leg = Math.min(leg, skirtR(sk, h) - v.addScaledVector(sk.u, -h).length() - limbR);
        }
    }
  }
  const [p0, p1, pr] = body.caps[0];
  const handBody = Math.min(...["Left", "Right"].map((sd) => capGap(p0, p1, pr, P[sd + "HandMiddle1"], handR, body.right).gap));
  const pw = hold ? shaftWorst({ W: hold.W, y: hold.y }, hold.L, body, null) : null;
  let grip = 0;
  if (hold)
    for (const [n, w] of S.grips) {
      if (w < 0.999) continue;
      const v = P[n].clone().sub(hold.W);
      const u = THREE.MathUtils.clamp(v.dot(hold.y), 0, hold.L);
      grip = Math.max(grip, v.addScaledVector(hold.y, -u).length());
    }
  return { arm, armRaw, handBody, leg, prop: pw ? pw.gap + STYLE.clear : Infinity, propHit: pw ? `${pw.what}@${pw.f.toFixed(2)}L` : "", grip, reach: Math.max(0, ...S.reach.map((x) => x.err)), hem: sk ? sk.r1 : 0, W: hold?.W };
};

// ---- full-3D toon test: the rest-pose forward of the Head bone (bone space), per rig
const headFwd = new Map<string, THREE.Vector3>();
const headForward = (r: Rig, clips: ClipKey[], t: number, yaw: number) => {
  let lf = headFwd.get(r.who);
  if (!lf) {
    restPose(r);
    const q0 = r.bone("Head").getWorldQuaternion(new THREE.Quaternion());
    lf = new THREE.Vector3(0, 0, 1).applyQuaternion(q0.invert());
    headFwd.set(r.who, lf);
  }
  r.root.rotation.set(0, yaw, 0);
  evaluate(r, clips, t);
  r.root.updateMatrixWorld(true);
  return lf.clone().applyQuaternion(r.bone("Head").getWorldQuaternion(new THREE.Quaternion()));
};
export const Stickman: React.FC<StickmanProps> = (p) => {
  const shot = React.useContext(ShotCtx);
  const frame = useCurrentFrame();
  const mood = useMood();
  const spec: CharacterSpec = CAST[p.who];
  if (!spec) throw new Error(`cast has no "${p.who}" (src/char/cast.ts)`);
  const prop = p.prop ? { cam: p.cam, ...p.prop } : undefined;
  const { P, sk, hold, d, limbR, handR, reach, armBack, slumpW, aimW } = solve(p.who, p.clips, p.t, p.at, p.yaw, prop, p.grab, p.slump);
  // grab QA (console, read by `still` / `grips` / `render`): a hand short of its target, an arm turning too fast
  if (reach.length) {
    const where = `"${p.who}" in shot ${shot} at frame ${frame} (t=${p.t.toFixed(2)})`;
    for (const g of reach)
      if (g.w >= 0.999 && g.err > REACH.maxErr)
        console.error(`REACH: ${g.hand.replace("HandMiddle1", "")} hand of ${where} is ${g.err.toFixed(3)} m short of its target: move the character or the prop (never stretch the arm)`);
    const Q = solve(p.who, p.clips, p.t - 1 / 30, p.at, p.yaw, prop, p.grab, p.slump).P;
    for (const g of reach) {
      const sd = g.hand.replace("HandMiddle1", "");
      const a = P[sd + "HandMiddle1"].clone().sub(P[sd + "Arm"]).angleTo(Q[sd + "HandMiddle1"].clone().sub(Q[sd + "Arm"]));
      if (a * 30 > REACH.maxSpeed * 1.05)
        console.error(`ARM FAST: ${sd} arm of ${where} turns ${(a * 30).toFixed(1)} rad/s (max ${REACH.maxSpeed}): slow the reach / lift (>= ${REACH.minTime} s)`);
    }
  }
  const r = rigFor(p.who, [...new Set(p.clips.map((c) => c.clip))]);
  const Pp = sample(r, p.clips, p.t - 0.06, p.at, p.yaw, d, !p.prop);
  const cam = new THREE.Vector3(...p.cam);
  // Shadows: a layer that faces the lens is edge-on to a side light and would cast a sliver. So in the shadow pass
  // each layer is replaced by an invisible copy turned (about the vertical) toward the mood's key light: the ground
  // gets the whole cut-out's silhouette, as in the reference. Limbs are real tubes and cast as they are.
  const want = p.shadow !== false;
  const kd = mood ? mood.lights.key.dir : null;
  const sun = want && kd && kd[0] * kd[0] + kd[2] * kd[2] > 0.04 ? new THREE.Vector3(kd[0], 0, kd[2]).normalize() : null;
  const cast = want && !sun; // the layers themselves cast only when there is no usable key direction
  const lcast = want; // limbs
  const faceSun = (yAx: THREE.Vector3) => {
    const z = sun!.clone().addScaledVector(yAx, -sun!.dot(yAx)).normalize();
    const x = new THREE.Vector3().crossVectors(yAx, z).normalize();
    return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, yAx, z));
  };
  const sid = spec.seed ?? spec.id;
  const seed = sid.length * 7 + sid.charCodeAt(0);
  const tg = p.tg ?? p.t;
  // expression -> face, and the puppet reaction to its change (hop with squash / stretch, head tip, hat lift)
  const ex = exprAt(p.expr, p.t);
  const ts = p.t - ex.since;
  const sg = hash(seed + Math.round(ex.since * 30)) % 2 ? 1 : -1;
  const k = (p.react ?? 1) * (1 - slumpW);
  const R = reaction(ex.e, ts, sg);
  const hopV = ((reaction(ex.e, ts + 0.02, sg).hop - reaction(ex.e, ts - 0.02, sg).hop) / 0.04) * d.H * k;
  const jolt = JOLT.has(ex.e) && ts >= 0 ? Math.exp(-ts * 7) * Math.sin(ts * 30) * k : 0;
  const blink = ex.e !== "shocked" && slumpW < 0.3 && blinkAt(tg, seed);
  const talking = (p.talk ?? []).some(([a, b]) => p.t >= a - LIP_LEAD && p.t < b);
  // slider face (faceAnim.ts): staggered eased features, blink on change, idle drift, continuous talking mouth
  const fp = faceAt(p.expr, p.t, tg, seed, blink, p.talk ?? []);
  const mouth = talking ? (lipAt(tg)?.open ?? talkEnv(p.t, seed)) : 0;
  const { cur } = keyAt(p.clips, p.t);
  const held = !!stepOf(cur); // a held pose breathes; a walk bobs on its own
  const ww = walkWeight(p.clips, p.t);
  const breath = held ? STYLE.breath * Math.sin(tg * 1.85 + seed) * (1 - slumpW) : 0;
  const vy = (P.Hips.y - Pp.Hips.y) / 0.06 + hopV;
  const sy = THREE.MathUtils.clamp(1 + vy * STYLE.squash, 0.9, 1.12) * (1 + breath);
  // the hop lifts everything above the legs (feet stay planted, the legs stretch); the torso stretches along its axis
  const lift = R.hop * d.H * k + (mouth > 0 ? 0.003 * d.H : 0);
  for (const n of BONES) if (!LEGS.test(n) || /UpLeg/.test(n)) P[n].y += lift;
  for (const sd of ["Left", "Right"]) P[sd + "Leg"].y += lift * 0.5;
  // jelly: the upper body leans about the hips in the picture plane on a spring (overshoot, swing back, settle)
  const leanSig = (tt: number) => { const e = exprAt(p.expr, tt); return reaction(e.e, tt - e.since, hash(seed + Math.round(e.since * 30)) % 2 ? 1 : -1).lean * k; };
  const lean = spring(leanSig, p.t, STYLE.springBody);
  if (Math.abs(lean) > 1e-4) {
    const piv = P.Hips.clone(), vax = cam.clone().sub(piv).normalize();
    for (const n of BONES) if (!LEGS.test(n) && n !== 'Hips') P[n].sub(piv).applyAxisAngle(vax, lean).add(piv);
  }
  const { ax, B } = torsoOf(P, d);
  const grow = ax.clone().multiplyScalar((sy - 1) * d.torsoLen);
  for (const n of ["Neck", "Head", "HeadTop_End", "LeftArm", "RightArm"]) P[n].add(grow);
  // ---- head: upright (a share of the bone tilt), always facing the lens; tips about the chin on reactions
  const up = Y.clone().multiplyScalar(1 - STYLE.headTilt).addScaledVector(P.HeadTop_End.clone().sub(P.Head).normalize(), STYLE.headTilt).normalize();
  const hsq = 1 - (sy - 1) * 0.5 + jolt * 0.05;
  const chin = P.Neck.clone().add(new THREE.Vector3(0, -vy * STYLE.headLag * 0.5 + Math.abs(jolt) * 0.03 * d.H, 0));
  const headC = chin.clone().addScaledVector(up, 0.5 * d.headH * hsq);
  const hn = cam.clone().sub(headC).normalize();
  const hx = new THREE.Vector3().crossVectors(up, hn).normalize();
  const hy = new THREE.Vector3().crossVectors(hn, hx);
  const hq = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(hx, hy, hn));
  // which way the drawing looks: the screen side the body faces (a turn past the lens axis is a flip, as in the reference)
  const fwd = new THREE.Vector3(Math.sin(p.yaw), 0, Math.cos(p.yaw));
  const facing = p.facing ?? (fwd.dot(hx) >= -1e-3 ? 1 : -1);
  if (p.legs2d) {
    // turn each leg's depth (along the horizontal view direction) into the screen's lateral direction, about the
    // vertical through its hip: heights kept (feet and knees stay on the ground). Away from the lens = away from the
    // facing side.
    const aw = P.Hips.clone().sub(cam).setY(0).normalize();
    const lr = new THREE.Vector3().crossVectors(aw, Y).normalize(); // screen right
    const ph = THREE.MathUtils.clamp(p.legs2d, 0, 1) * Math.PI / 2;
    for (const sd of ["Left", "Right"]) {
      const hip = P[sd + "UpLeg"];
      for (const n of ["Leg", "Foot", "ToeBase"]) {
        const q = P[sd + n];
        const a = (q.x - hip.x) * aw.x + (q.z - hip.z) * aw.z;
        q.addScaledVector(aw, a * (Math.cos(ph) - 1)).addScaledVector(lr, -facing * a * Math.sin(ph));
      }
    }
  }
  // the face's head tilt (eased with the expression, + idle sway) is a 3D roll; the hat lags it by ~2-3 frames
  const tiltRoll = (tt: number) => -faceAt(p.expr, tt, tg - (p.t - tt), seed, false).tilt * (Math.PI / 180) * facing + reaction(exprAt(p.expr, tt).e, tt - exprAt(p.expr, tt).since, sg).tip * k;
  // jelly: the head rides the body lean on a softer spring (lags, overshoots); the hat trails on a softer one still
  const headSig = (tt: number) => tiltRoll(tt) + leanSig(tt);
  const headRoll = spring(headSig, p.t, STYLE.springHead);
  const rightV = new THREE.Vector3(-Math.cos(p.yaw), 0, Math.sin(p.yaw));
  const slumpRoll = slumpW > 0 ? -(p.slump!.side ?? 1) * (rightV.dot(hx) >= 0 ? 1 : -1) * (p.slump!.head ?? 0.55) * slumpW : 0;
  // aiming: the head tips a little toward the gun arm (sighting along it)
  const aimRoll = aimW > 0 ? -(rightV.dot(hx) >= 0 ? 1 : -1) * 0.1 * aimW : 0;
  const roll = (headRoll + Math.sin(p.t * 6.1 + 0.6) * STYLE.jiggle * (p.walking ?? 1) * ww + jolt * 0.08) + slumpRoll + aimRoll;
  const hatLag = spring(headSig, p.t, STYLE.springHat) - headRoll;
  // gaze: the eyes (and the face group, a little) turn to the look target, in the head layer's own frame
  const gazeOf = (to: ReturnType<typeof lookAt>["cur"]) => {
    if (toon) {
      // painted eyes on the 3D head: the head itself points ahead; a target moves the eyes in the head's own frame
      if (!to) return { x: 0, y: GAZE_AHEAD.y };
      const dir = (to === "cam" ? cam.clone() : new THREE.Vector3(...to)).sub(headC).normalize();
      return { x: THREE.MathUtils.clamp(dir.dot(X3) * 1.6, -1, 1), y: THREE.MathUtils.clamp(-dir.dot(Y3) * 1.4, -1, 1) };
    }
    if (to === "cam") return { x: 0, y: 0 };
    if (!to) return { x: GAZE_AHEAD.x, y: GAZE_AHEAD.y };
    const dir = new THREE.Vector3(...to).sub(headC).normalize();
    return { x: THREE.MathUtils.clamp(dir.dot(hx) * facing * 1.6, -1, 1), y: THREE.MathUtils.clamp(-dir.dot(hy) * 1.4, -1, 1) };
  };
  // the eyes follow the aim target unless the shot says where to look
  const aimLook = aimW > 0.3 && p.prop?.target ? (typeof p.prop.target === "function" ? p.prop.target(p.t) : p.prop.target) : undefined;
  // full-3D toon: the head turns with the Head bone (horizontal part), upright like the card's
  const toon = p.toon !== undefined ? p.toon !== false : UP().toon; // default from the input props (src/upgrade.ts)
  const lit = p.toon === "lit"; // lit test: the 3D parts take the set's lights (shading, highlights, shadows)
  let hq3: THREE.Quaternion | null = null, X3 = hx, Y3 = up;
  if (toon) {
    const f = headForward(r, p.clips, p.t, p.yaw);
    f.addScaledVector(up, -f.dot(up));
    if (f.lengthSq() < 1e-6) f.set(Math.sin(p.yaw), 0, Math.cos(p.yaw));
    f.normalize();
    X3 = new THREE.Vector3().crossVectors(up, f).normalize();
    Y3 = up;
    hq3 = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X3, up, f));
  }
  const la = lookAt(p.look ?? aimLook, p.t);
  const g0 = gazeOf(la.prev);
  const g1 = gazeOf(la.cur);
  fp.gX += g0.x + (g1.x - g0.x) * la.k;
  fp.gY += g0.y + (g1.y - g0.y) * la.k;
  const hu = d.headW; // metres per head width: the layer quads are in head widths
  const pivotY = -0.42 * (d.headH / d.headW); // the chin, in head widths below the head centre
  const tint = figureTint(mood, p.at, p.cam);
  const hat = hatTex(spec);
  // ---- torso layer: along the spine, turned about it toward the lens
  const tz0 = cam.clone().sub(B);
  const tz = tz0.addScaledVector(ax, -tz0.dot(ax)).normalize();
  const tx = new THREE.Vector3().crossVectors(ax, tz).normalize();
  const tq = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(tx, ax, tz));
  /** move a point toward the lens along its own view ray (screen position unchanged): layer order in metres */
  const near = (q: THREE.Vector3, z: number) => q.clone().addScaledVector(cam.clone().sub(q).normalize(), z);
  // the head (and hat) must never sit behind the torso layer: the torso card tilts with the spine, so on a lean or a
  // high / low camera its top edge can come nearer the lens than the head card. Measure how far the torso plane cuts
  // the view rays to the head centre and the chin, and push the head layer in front of it (user rule 2026-11-20).
  const headZ = (() => {
    let extra = 0;
    const chin = headC.clone().addScaledVector(ax, -0.5 * d.headH);
    for (const q of [headC, chin]) {
      const v = q.clone().sub(cam);
      const len = v.length();
      const dn = v.dot(tz);
      if (Math.abs(dn) < 1e-6) continue;
      const tHit = B.clone().sub(cam).dot(tz) / dn; // fraction of the ray where it meets the torso plane
      if (tHit > 0 && tHit < 1) extra = Math.max(extra, (1 - tHit) * len);
    }
    return STYLE.zHead + extra;
  })();
  // joints for the grip camera and QA (world/registry.ts): bones + the drawn head centre (+ the prop's two ends)
  const J: Joints = {};
  for (const n of BONES) J[n] = [P[n].x, P[n].y, P[n].z];
  J.HeadBone = J.Head;
  J.Head = [headC.x, headC.y, headC.z];
  // prop: one clone per character, prop and shot (two shots of a dissolve render in two canvases at once)
  let propEl: React.ReactNode = null;
  if (p.prop && hold) {
    const obj = bounded(propClones, `${p.who}|${p.prop.id}|${shot}`, () => getProp(p.prop!.id).obj.clone(true));
    const W = hold.W.clone().add(new THREE.Vector3(0, lift, 0));
    const top = W.clone().addScaledVector(hold.y, hold.L);
    J.PropEnd = [W.x, W.y, W.z];
    J.PropTop = [top.x, top.y, top.z];
    propEl = (
      <group position={W} quaternion={hold.q ?? holdQuat(hold.y, p.yaw)} scale={hold.size}>
        <primitive object={obj} />
      </group>
    );
  }
  putJoints(p.who, shot, frame, J);
  const stain = stainSpots(p.bleed, p.t);
  // ---- hat off: it leaves the head at hatOff.at, falls with a small arc and tips onto its side where it lands
  const hatGone = !!(hat && p.hatOff && p.t >= p.hatOff.at);
  let hatFall: React.ReactNode = null;
  if (hatGone) {
    const ho = p.hatOff!;
    const u = THREE.MathUtils.clamp((p.t - ho.at) / (ho.dur ?? 0.5), 0, 1);
    const hy0 = 0.42 * d.headH; // the hat art's centre above the head centre
    const sideK = p.slump?.side ?? 1;
    const rv = new THREE.Vector3(-Math.cos(p.yaw), 0, Math.sin(p.yaw));
    const start = headC.clone().addScaledVector(up, hy0);
    const end = ho.to ? new THREE.Vector3(...(typeof ho.to === "function" ? ho.to(p.t) : ho.to))
      : P.Hips.clone().addScaledVector(rv, sideK * (d.R + 0.12)).addScaledVector(fwd, 0.06).setY(P.Hips.y + 0.02);
    end.y += 0.25 * hy0; // the tipped hat rests on its brim edge
    const e = u * u; // falls: accelerates
    const pos = start.clone().lerp(end, e).addScaledVector(Y, 0.12 * Math.sin(Math.PI * Math.min(1, u * 1.4)));
    const hroll = -sideK * (rv.dot(hx) >= 0 ? 1 : -1) * 1.35 * smoother(u);
    hatFall = (
      <group position={near(pos, STYLE.zHat)} quaternion={hq}>
        <group rotation={[0, 0, hroll]}>
          <mesh geometry={HEAD_QUAD} material={layerMat(hat!, tint)} position={[0, -hy0, 0]} scale={[hu * facing, hu, 1]} castShadow={cast} userData={OCC} />
        </group>
      </group>
    );
  }
  // full-3D toon: the torso turns with the body (lateral = shoulders + hips), not toward the lens
  const rightB = P.RightArm.clone().sub(P.LeftArm).add(P.RightUpLeg.clone().sub(P.LeftUpLeg));
  rightB.addScaledVector(ax, -rightB.dot(ax));
  if (rightB.lengthSq() < 1e-8) rightB.set(-Math.cos(p.yaw), 0, Math.sin(p.yaw));
  rightB.normalize();
  const tq3 = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(rightB.clone().negate(), ax, new THREE.Vector3().crossVectors(rightB.clone().negate(), ax)));
  // ---- limbs
  const flip = P.RightArm.clone().sub(P.LeftArm).dot(tx) < 0; // the character's right is on screen left
  const camDir = cam.clone().sub(P.Hips).normalize();
  let skPlane: { o: THREE.Vector3; n: THREE.Vector3 } | null = null;
  if (sk) {
    const o = sk.top.clone().add(new THREE.Vector3(0, lift, 0));
    const n0 = cam.clone().sub(o);
    skPlane = { o, n: n0.addScaledVector(sk.u, -n0.dot(sk.u)).normalize() };
  }
  const limbs: React.ReactNode[] = [];
  for (const [sd, sgn] of [["Left", -1], ["Right", 1]] as const) {
    const other = sd === "Left" ? "Right" : "Left";
    // an arm whose shoulder is clearly behind the other one (profile) goes behind the torso
    const behind = armBack[sd] > 0.5 ? P[sd + "HandMiddle1"].clone().sub(B).dot(camDir) < 0 : P[sd + "Arm"].clone().sub(P[other + "Arm"]).dot(camDir) < -0.5 * d.R;
    const za = toon ? 0 : behind ? STYLE.zLeg : STYLE.zArm;
    const a0 = near(P[sd + "Arm"], za);
    // a straight arm still reads as a noodle: bow the elbow outward (less the more the arm is already bent)
    const S0 = P[sd + "Arm"];
    const H0 = P[sd + "HandMiddle1"];
    const E0 = P[sd + "ForeArm"];
    const straight = THREE.MathUtils.clamp((S0.distanceTo(H0) / Math.max(1e-4, S0.distanceTo(E0) + E0.distanceTo(H0)) - 0.9) / 0.1, 0, 1);
    const a1 = near(E0.clone().addScaledVector(toon ? rightB.clone().multiplyScalar(-1) : tx, sgn * (toon ? -1 : flip ? -1 : 1) * STYLE.armBow * d.H * straight * (sd === "Right" ? 1 - aimW : 1)), za);
    const a2 = near(P[sd + "HandMiddle1"], za);
    // foot: a short stroke from the ankle outward and down to the ground (outward when facing the lens, forward in profile)
    const foot = P[sd + "Foot"];
    const toe = P[sd + "ToeBase"];
    let fH = new THREE.Vector3(toe.x - foot.x, 0, toe.z - foot.z);
    if (fH.lengthSq() < 1e-8) fH = fwd.clone();
    fH.normalize();
    const out = new THREE.Vector3().crossVectors(fH, Y).multiplyScalar(sgn);
    const sp = STYLE.footSplay * Math.abs(fH.dot(new THREE.Vector3(camDir.x, 0, camDir.z).normalize()));
    const dir = fH.clone().multiplyScalar(Math.cos(sp)).addScaledVector(out, Math.sin(sp));
    const L = STYLE.foot * d.u;
    const tipY = toe.y - (d.toe0 - limbR);
    const tip = new THREE.Vector3(foot.x, tipY, foot.z).addScaledVector(dir, L * Math.cos(STYLE.footDown));
    const ankle = new THREE.Vector3(foot.x, tipY + L * Math.sin(STYLE.footDown), foot.z);
    // legs go behind the torso layer, and behind the skirt layer however far a knee or foot swings forward
    const back = (q: THREE.Vector3) => toon ? q.clone() : near(q, STYLE.zLeg - (skPlane ? Math.max(0, q.clone().sub(skPlane.o).dot(skPlane.n)) : 0));
    const l0 = back(P[sd + "UpLeg"]);
    const l1 = back(P[sd + "Leg"]);
    const l2 = back(ankle);
    const l3 = back(tip);
    limbs.push(
      <group key={sd}>
        <mesh geometry={tubeGeo(`${p.who}|${shot}|arm${sd}`, a0, a1, a2, limbR, camDir)} material={INK_MAT} castShadow={lcast} userData={OCC} frustumCulled={false} />
        <Dot p={a0} r={limbR} cast={lcast} />
        <Dot p={near(P[sd + "HandMiddle1"], toon ? 0 : za + 0.004)} r={handR} cast={lcast} />
        <mesh geometry={tubeGeo(`${p.who}|${shot}|leg${sd}`, l0, l1, l2, limbR, camDir)} material={INK_MAT} castShadow={lcast} userData={OCC} frustumCulled={false} />
        <Stick a={l2} b={l3} r={limbR} cast={lcast} />
        <Dot p={l2} r={limbR} cast={lcast} />
        <Dot p={l3} r={limbR} cast={lcast} />
      </group>,
    );
  }
  // ---- 'dress' skirt layer (behind the torso, in front of the legs)
  let skirtEl: React.ReactNode = null;
  if (sk && toon) {
    const top = sk.top.clone().add(new THREE.Vector3(0, lift, 0));
    const yA = sk.u.clone().negate().normalize();
    const xA = rightB.clone().negate().addScaledVector(yA, rightB.dot(yA)).normalize();
    const zA = new THREE.Vector3().crossVectors(xA, yA);
    const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(xA, yA, zA));
    const kk = Math.round((sk.r1 / Math.max(1e-4, sk.r0)) * 20) / 20;
    const Ls = lookOf(spec);
    skirtEl = (
      <group position={top} quaternion={q} scale={[sk.r0, sk.len, sk.r0]}>
        <ToonPart geo={skirtGeo3(kk)} mat={flatMat(Ls.legs || Ls.torso, tint, lit)} hull={(PEN_HW * hu) / sk.r0} cast={want} />
      </group>
    );
  } else if (sk) {
    const top = sk.top.clone().add(new THREE.Vector3(0, lift, 0));
    const sz0 = cam.clone().sub(top);
    const sz = sz0.addScaledVector(sk.u, -sz0.dot(sk.u)).normalize();
    const syAx = sk.u.clone().negate();
    const sx = new THREE.Vector3().crossVectors(syAx, sz).normalize();
    const sq = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(sx, syAx, sz));
    const sgeo = skirtGeo(`${p.who}|${shot}`, sk.r0, sk.r1 * SKIRT_HULL, sk.len);
    skirtEl = (
      <>
        {sun ? <mesh geometry={sgeo} material={shadowMat(skirtTex(spec))} position={top} quaternion={faceSun(syAx)} castShadow userData={NO_INK} frustumCulled={false} /> : null}
      <mesh geometry={skirtGeo(`${p.who}|${shot}`, sk.r0, sk.r1 * SKIRT_HULL, sk.len)} material={layerMat(skirtTex(spec), tint)} position={near(top, STYLE.zSkirt)} quaternion={sq}
        scale={[facing, 1, 1]} castShadow={cast} userData={OCC} frustumCulled={false} />
      </>
    );
  }
  return (
    <group>
      {limbs}
      {skirtEl}
      {toon ? (() => {
        const L = lookOf(spec);
        const ratio = L.headRatio * (ART.headRatio / 1.05);
        const tm = projMat(torsoFront(spec), torsoBack(spec), TORSO_FRAME, tint, L.torso, 0.12, lit);
        const hm = projMat(headFront(spec, fp), headBack(spec), HEAD_FRAME, tint, L.skin, 0.12, lit);
        const hatG = L.hat !== "none" ? hatGeo(spec) : null;
        const hatM = hatG ? projMat(hatFront(spec), hatFront(spec), HEAD_FRAME, tint, L.hatColor ?? "#222", 0.12, lit, true) : null;
        const hairG = L.hair ? hairGeo(spec, ratio) : null;
        const hairM = hairG ? projMat(hairFront(spec), hairBack(spec), HEAD_FRAME, tint, L.hair ?? "#222", 0.12, lit, true) : null;
        const hsx = 1 / Math.sqrt(hsq);
        return (
          <>
            <group position={B} quaternion={tq3} scale={[hu / Math.sqrt(sy), hu * sy, hu]}>
              <ToonPart geo={torsoGeo()} mat={tm} hull={PEN_HW} cast={want} />
              <WornParts wear={p.wear} t={p.t} who={p.who} shot={String(shot)} />
              {stain.length ? <mesh geometry={TORSO_QUAD} material={stainMat(torsoTex(spec), stain, tint)} position={[0, 0, (ART_REF.TORSO_W / 2 / ART_REF.HW) * TORSO_DEPTH + 0.01]} renderOrder={2} userData={NO_INK} /> : null}
            </group>
            <group position={headC} quaternion={hq3!}>
              <group position={[0, pivotY * hu * hsq, 0]} rotation={[0, 0, roll]}>
                <group position={[0, -pivotY * hu * hsq, 0]} scale={[hu * hsx, hu * hsq, hu * hsx]}>
                  <ToonPart geo={headGeo(ratio)} mat={hm} hull={PEN_HW} cast={want} />
                  {p.tears?.length || p.sweat?.length ? (
                    <group position={[0, 0, HEAD_DEPTH - 0.02]} scale={[1, 1, 1]}>
                      <Tears t={p.t} tears={p.tears} sweat={p.sweat} tint={tint} seed={seed} />
                    </group>
                  ) : null}
                  {hairG && hairM ? <ToonPart geo={hairG} mat={hairM} hull={PEN_HW} cast={want} carve={{ tex: hairFront(spec), back: hairBack(spec), fr: HEAD_FRAME }} /> : null}
                </group>
                {hatG && hatM && !hatGone ? (
                  <group position={[0, (-pivotY + 0.3) * hu * hsq + R.hat * k * d.headH, 0]} rotation={[0, 0, R.hatTip * k + hatLag]}>
                    <group position={[0, -0.3 * hu * hsq, 0]} scale={[hu * hsx, hu * hsq, hu * hsx]}>
                      <ToonPart geo={hatG} mat={hatM} hull={PEN_HW} cast={want} carve={{ tex: hatFront(spec), fr: HEAD_FRAME }} />
                    </group>
                  </group>
                ) : null}
              </group>
            </group>
          </>
        );
      })() : (<>
      <mesh geometry={TORSO_QUAD} material={layerMat(torsoTex(spec), tint)} position={B} quaternion={tq} scale={[(hu * facing) / Math.sqrt(sy), hu * sy, 1]} castShadow={cast} userData={OCC} />
      {stain.length ? <mesh geometry={TORSO_QUAD} material={stainMat(torsoTex(spec), stain, tint)} position={near(B, 0.004)} quaternion={tq} scale={[(hu * facing) / Math.sqrt(sy), hu * sy, 1]} renderOrder={2} userData={NO_INK} /> : null}
      <group position={near(headC, headZ)} quaternion={hq}>
        <group position={[0, pivotY * hu * hsq, 0]} rotation={[0, 0, roll]}>
          <mesh geometry={HEAD_QUAD} material={layerMat(headFaceTex(spec, fp), tint)} position={[0, -pivotY * hu * hsq, 0]} scale={[(hu * facing) / Math.sqrt(hsq), hu * hsq, 1]} castShadow={cast} userData={OCC} />
          {p.tears?.length || p.sweat?.length ? (
            <group position={[0, -pivotY * hu * hsq, 0.004]} scale={[(hu * facing) / Math.sqrt(hsq), hu * hsq, hu]}>
              <Tears t={p.t} tears={p.tears} sweat={p.sweat} tint={tint} seed={seed} />
            </group>
          ) : null}
          {hat && !hatGone ? (
            <group position={[0, (-pivotY + 0.3) * hu * hsq + R.hat * k * d.headH, STYLE.zHat - STYLE.zHead]} rotation={[0, 0, R.hatTip * k + hatLag]}>
              <mesh geometry={HEAD_QUAD} material={layerMat(hat, tint)} position={[0, -0.3 * hu * hsq, 0]} scale={[(hu * facing) / Math.sqrt(hsq), hu * hsq, 1]} castShadow={cast} userData={OCC} />
            </group>
          ) : null}
        </group>
      </group>
      </>)}
      {sun && !toon ? (
        <>
          <mesh geometry={TORSO_QUAD} material={shadowMat(torsoTex(spec))} position={B} quaternion={faceSun(ax)} scale={[hu * facing, hu * sy, 1]} castShadow userData={NO_INK} />
          <group position={headC} quaternion={faceSun(up)} scale={[hu * facing, hu * hsq, 1]}>
            <mesh geometry={HEAD_QUAD} material={shadowMat(headTex(spec, ex.e, false, 0))} castShadow userData={NO_INK} />
            {hat && !hatGone ? <mesh geometry={HEAD_QUAD} material={shadowMat(hat)} position={[0, (R.hat * k * d.headH) / (hu * hsq), 0]} castShadow userData={NO_INK} /> : null}
          </group>
        </>
      ) : null}
      {propEl}
      {hatFall}
      <mesh geometry={G.dot} material={M.shadow} position={[P.Hips.x, p.at[1] + 0.004, P.Hips.z]} scale={[0.2 * d.H, 0.001, 0.09 * d.H]} userData={NO_INK} />
    </group>
  );
};
