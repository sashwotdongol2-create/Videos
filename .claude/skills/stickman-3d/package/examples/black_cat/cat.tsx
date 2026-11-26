// "He Blamed a Black Cat for This" - 13 shots, 39 s. Three coords: x right, y up, z = -blender_y (camera side +z).
// Park zones (blender/sets_park.py): A oak lawn (oak trunk at 0,0,-2.2) | B sidewalk (x ~22, wall z -1.7, street +z,
// facades z +12.5) | C fountain (-22,0,-3) | D bench row (z +16, benches face +z, cart at x 7.5).
// MASTER_WORKFLOW K: beatCam beats on the marked nouns, expressions per word for speaker + listeners, eye keys, talk
// only on his own quoted / ranting lines, one symbol per shot, acting clip per beat, physics (leaves, phone slide).
import React from "react";
import * as THREE from "three";
import { Stickman, jointsAt } from "../char3d/Stickman";
import { needClip } from "../char3d/rig";
import type { ClipKey } from "../char3d/rig";
import { View } from "../engine/core/View";
import type { V3 } from "../engine/types";
import { Wl } from "../film/time";
import { beatCam } from "../kit/beatCam";
import type { Beat } from "../kit/beatCam";
import { forSet } from "../world/moods";
import { getSet, needSet, sunDir, useSetScene } from "../world/set";
import { Glow } from "../world/weather";
import { Debris, Dust, Motes } from "../world/fx";
import { Symbol3D } from "../kit/Symbol3D";
import { Cat } from "../kit/Cat";
import type { CatPose } from "../kit/Cat";
import { Phone } from "../kit/Phone";
import type { ShotDef } from "./types";

const SK = ["park", "day"] as const;
const idleStep = { every: 26, snap: 6, drift: 0.03 };
const ck = (clip: string, extra: Partial<ClipKey> = {}): ClipKey[] => [{ clip, from: 0, step: idleStep, ...extra } as any];
const act = (idle: string, ...beats: [string, number, number?][]): ClipKey[] =>
  [{ clip: idle, from: 0, step: idleStep } as any, ...beats.map(([clip, at, offset]) => ({ clip, from: at - 0.12, fade: 0.18, offset: offset ?? 0, loop: false }))];
const cont = (clip: string, offset = 0): ClipKey[] => [{ clip, from: 0, offset, step: false } as any];
const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp3 = (a: V3, b: V3, k: number): V3 => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

type Who = { who: string; at: V3; yaw: number; clips: ClipKey[]; expr: { at: number; e: string }[]; talk?: [number, number][]; eyes?: { at: number; x: number; y: number }[]; sweat?: number[]; react?: number };

/** a joint of a character in world space (frame a lying hero by his real head: BUILD_LESSONS #51) */
const jointOf = (p: Who, t: number, j = "Head"): V3 => {
  const P: any = jointsAt(p.who, p.clips, t, p.at, p.yaw, undefined as any);
  const h = P?.[j];
  return h ? [h[0] ?? h.x, h[1] ?? h.y, h[2] ?? h.z] : [p.at[0], 1.5, p.at[2]];
};
/** the hero's right hand in world space (phone in hand) */
const handOf = (p: Who, t: number): V3 => {
  const P: any = jointsAt(p.who, p.clips, t, p.at, p.yaw, undefined as any);
  const h = P?.RightHandMiddle1;
  return h ? [h[0] ?? h.x, h[1] ?? h.y, h[2] ?? h.z] : [p.at[0], 1.0, p.at[2]];
};

// a realistic RicksClips day sky (user note): deep blue zenith -> pale hazy horizon, big lit cumulus
const MOOD = (set: any) => { const m: any = forSet("day" as any, sunDir(set), { sat: 1.05 });
  return { ...m, sky: { ...m.sky, top: "#1f5ad0", mid: "#69a2ec", bottom: "#e2eef9", cloudColor: "#a9bcd8", cloudLit: "#ffffff", clouds: 0.8, horizon: 0.26, cloudStyle: "puffy" } }; };

const Stage: React.FC<{ t: number; tg: number; beats: Beat[]; people: Who[]; phone?: { who: Who; upto: number }; children?: React.ReactNode; wash?: number; black?: boolean; dark?: number; dizzy?: number }> = ({ t, tg, beats, people, phone, children, wash = 0, black, dark = 0, dizzy = 0 }) => {
  const set = getSet(SK[0], SK[1]);
  const scene = useSetScene(set);
  const c0 = beatCam(beats.map((b) => ({ ...b, dist: b.dist * 1.15, fov: (b.fov ?? 44) + 2 })), t);
  // Lights out (user note): the world swims (roll + sway), goes soft (focus pulled to the lens) and fades to black
  const c = dizzy > 0 ? { ...c0, roll: c0.roll + dizzy * 9 * Math.sin(t * 3.1), fov: c0.fov + dizzy * 6 * Math.sin(t * 2.3),
    pos: [c0.pos[0] + dizzy * 0.18 * Math.sin(t * 2.7), c0.pos[1] + dizzy * 0.1 * Math.sin(t * 1.9), c0.pos[2] + dizzy * 0.18 * Math.cos(t * 2.2)] as V3 } : c0;
  let ph: React.ReactNode = null;
  if (phone) {
    const h = handOf(phone.who, t);
    const look: V3 = [h[0] + Math.sin(phone.who.yaw) * 0.3, h[1] + 0.35, h[2] + Math.cos(phone.who.yaw) * 0.3];
    ph = <Phone at={[h[0], h[1] + 0.02, h[2]]} to={look} upto={phone.upto} glow={0.6} />;
  }
  const dir = new THREE.Vector3(...c.look).sub(new THREE.Vector3(...c.pos)).normalize();
  const bp: V3 = [c.pos[0] + dir.x * 0.08, c.pos[1] + dir.y * 0.08, c.pos[2] + dir.z * 0.08];
  return (
    <View mood={MOOD(set)} cam={c} t={tg} focus={dizzy > 0 ? lerp3(c.pos, c.look, 1 - 0.85 * dizzy) : c.look} blur={1.2 + dizzy * 7} exposure={-dark * 2.5} near={0.03} far={220}>
      <primitive object={scene} />
      {people.map((p) => (
        <Stickman key={p.who} who={p.who} t={t} tg={tg} at={p.at} yaw={p.yaw} cam={c.pos} clips={p.clips} walking={0}
          expr={p.expr as any} talk={p.talk} eyes={p.eyes} sweat={p.sweat} react={p.react ?? 1} />
      ))}
      {ph}
      {wash > 0 ? <pointLight position={[c.pos[0], 0.2, c.pos[2]]} color="#ff2a40" intensity={wash * 30} distance={8} decay={1.5} /> : null}
      {wash > 0 ? <Glow at={[c.look[0], c.look[1] - 0.6, c.look[2]]} size={3} color="#c01828" strength={0.5 * wash} /> : null}
      <Motes c={[c.look[0], 1.6, c.look[2]]} hs={[3, 1.4, 3]} n={60} t={tg} color={[1, 0.98, 0.85]} />
      {black || dark > 0 ? <mesh position={bp} quaternion={new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.clone().negate())} userData={{ outline: false }} renderOrder={99}>
        <planeGeometry args={[1, 1]} /><meshBasicMaterial color="#000" depthTest={false} transparent opacity={black ? 1 : dark} /></mesh> : null}
      {children}
    </View>
  );
};

// ----------------------------------------------------------------------------------------------- the hero at the oak
// the oak's REAL trunk (measured from park_day.glb at head height): centre (1.12, -2.6), radius ~0.28, front face z -2.33
const TX = 1.12, TFRONT = -2.33;
const HERO_OAK: V3 = [TX, 0, TFRONT + 0.2];

// 1 "This guy walked face-first into a tree, and he swears" - frame 1 = the impact. Low from the side on the trunk,
// leaves burst; on "swears" he staggers back, dizzy.
const S1: React.FC<{ t: number; tg: number }> = ({ t, tg }) => {
  const w = (i: number) => Wl(i, 1);
  const hero: Who = { who: "hero", at: HERO_OAK, yaw: Math.PI, clips: act("Hit_To_Head", ["Reacting", 0.42, 0.25], ["Yelling", w(9), 0.1]),
    expr: [{ at: 0, e: "shocked" }, { at: 0.35, e: "dizzy" }, { at: w(9), e: "angry" }], eyes: [{ at: 0, x: 0, y: -0.4 }, { at: w(9), x: 1, y: 0 }] };
  const beats: Beat[] = [
    { at: 0, subj: [TX, 1.45, -2.1], az: 82, el: -14, dist: 1.6, fov: 48, push: 0.12, roll: -3 },
    { at: w(3), subj: [TX, 1.5, -2.15], az: 66, el: -8, dist: 1.25, fov: 44, move: 0.3, roll: 2 },
    { at: w(9), subj: [TX, 1.2, -1.8], az: 34, el: 10, dist: 2.6, fov: 48, move: 0.45 },
  ];
  return <Stage t={t} tg={tg} beats={beats} people={[hero]} phone={{ who: hero, upto: 4 }}>
    <Debris t={t} t0={0.02} p={[TX, 2.6, -2.4]} n={40} seed={4} color="#4a8a3a" k={1.2} dir={[0, -0.3, 1]} cone={1.4} />
    <Debris t={t} t0={0.05} p={[TX, 3.2, -2.5]} n={30} seed={9} color="#6aa84a" k={0.8} />
    <Dust t={t} t0={0.0} p={[TX, 1.6, TFRONT]} k={0.5} n={10} color={[0.85, 0.8, 0.65]} />
    <Symbol3D kind="!!" at={[TX, 2.25, TFRONT + 0.25]} t={t} t0={0.05} size={0.34} hold={0.45} />
  </Stage>;
};

// 2 "a black cat cursed him." - the culprit: the black cat on the low brick wall, licking a paw, unbothered. Low
// angle (power to the cat), push in; on "cursed" it looks up into the lens.
const CAT_WALL: V3 = [22.4, 0.9, -1.7];
const S2: React.FC<{ t: number; tg: number }> = ({ t, tg }) => {
  const w = (i: number) => Wl(i, 2);
  const beats: Beat[] = [
    { at: 0, subj: [22.4, 1.1, -1.7], az: -12, el: -10, dist: 1.5, fov: 40, push: 0.16, orbit: 3 },
    { at: w(13), subj: [22.4, 1.15, -1.7], az: 4, el: -6, dist: 1.0, fov: 38, move: 0.4, hold: true },
  ];
  const pose: CatPose = t < w(13) ? "lick" : "stare";
  return <Stage t={t} tg={tg} beats={beats} people={[]}>
    <Cat t={t} at={CAT_WALL} cam={[22.4, 1, 0]} pose={pose} size={0.6} facing={1} look={t < w(13) ? 0 : 0} />
  </Stage>;
};

// 3 "But the truth is way more embarrassing." - straight down on him flat on the grass, dizzy, the phone hidden under
// his hand; the camera rises (pull-out reveals the oak) and whips away (rewind) into shot 4.
const S3: React.FC<{ t: number; tg: number }> = ({ t, tg }) => {
  const w = (i: number) => Wl(i, 3);
  const hero: Who = { who: "hero", at: [0.05, 0, -0.9], yaw: Math.PI, clips: cont("Knocked_Out", 3.2),
    expr: [{ at: 0, e: "dizzy" }, { at: w(19), e: "dizzy" }], eyes: [{ at: 0, x: 0.5, y: -0.5 }, { at: 0.8, x: -0.5, y: 0.5 }, { at: 1.4, x: 0.5, y: 0.5 }] };
  const hd = jointOf(hero, 0.5);
  const beats: Beat[] = [
    { at: 0, subj: [hd[0], 0.25, hd[2]], az: 0, el: 52, dist: 2.6, fov: 46, push: 0.05, orbit: 6 },
    { at: w(21), subj: [0, 0.9, -1.4], az: 20, el: 30, dist: 4.0, fov: 50, move: 0.5 },
  ];
  return <Stage t={t} tg={tg} beats={beats} people={[hero]} phone={{ who: hero, upto: 4 }}>
    <Symbol3D kind="sparkle" at={[hd[0], 0.6, hd[2]]} t={t} t0={0.1} size={0.4} hold={1.6} />
  </Stage>;
};

// ------------------------------------------------------------------------------------------------- the sidewalk (B)
const WALK0: V3 = [17.6, 0, 0.1];
// 4 "You see, a black cat sprinted across his path," - ground-level lens at the curb: he walks toward us texting, the
// cat sprints across right in front of the lens on "cat ... sprinted" (the cause, followed), facades behind.
const catRun = (t: number, t0: number): V3 => { const u = clamp((t - t0) / 0.9); return [20.3 - 0.1 * u, 0, -2.0 + 4.4 * u]; };
const S4: React.FC<{ t: number; tg: number }> = ({ t, tg }) => {
  const w = (i: number) => Wl(i, 4);
  const hero: Who = { who: "hero", at: [WALK0[0] + 1.05 * Math.min(t, w(31)), 0, WALK0[2]], yaw: Math.PI / 2, clips: cont("Walking_Texting"),
    expr: [{ at: 0, e: "happy" }, { at: w(30), e: "shocked" }], eyes: [{ at: 0, x: 0, y: 0.9 }, { at: w(27) + 0.1, x: 0.6, y: 0.1 }] };
  const cr = catRun(t, w(26));
  const beats: Beat[] = [
    { at: 0, subj: [19.6, 1.3, 0.1], az: 105, el: 4, dist: 2.4, fov: 48, push: 0.08 },
    { at: w(26), subj: [20.3, 0.3, 0.4], az: 268, el: 8, dist: 1.0, fov: 56, move: 0.35, roll: 3 },
    { at: w(29), subj: [20.6, 1.0, 0.4], az: 150, el: 6, dist: 2.6, fov: 50, move: 0.4 },
  ];
  return <Stage t={t} tg={tg} beats={beats} people={[hero]} phone={{ who: hero, upto: 1 }}>
    {t > w(26) - 0.1 ? <Cat t={t} at={cr} cam={beatCam(beats, t).pos} pose={cr[2] < 2.3 ? "run" : "sit"} size={0.6} facing={1} speed={1.4} /> : null}
    <Dust t={t} t0={w(27)} p={[20.3, 0.05, 0.0]} k={0.35} n={8} />
  </Stage>;
};

// 5 "so he froze, pointed a shaking finger and screamed, "You've cursed me!"" - freeze (terrified), the point at the
// cat sitting on the curb, the scream in his own voice (mouth), push in to the face, "!!".
const HERO5: V3 = [20.2, 0, 0.1];
const CAT5: V3 = [20.9, 0, 2.3];
const S5: React.FC<{ t: number; tg: number }> = ({ t, tg }) => {
  const w = (i: number) => Wl(i, 5);
  const hero: Who = { who: "hero", at: HERO5, yaw: 0.35, clips: act("Terrified", ["Pointing", w(34), 0.25], ["Yelling", w(39), 0.1]),
    expr: [{ at: 0, e: "shocked" }, { at: w(33), e: "scared" }, { at: w(36), e: "nervous" }, { at: w(39), e: "angry" }],
    eyes: [{ at: 0, x: 1, y: 0.3 }, { at: w(36), x: 0.6, y: 0.2 }, { at: w(40), x: 1, y: 0 }], sweat: [w(33)], talk: [[w(40), w(42) + 0.4]] };
  const beats: Beat[] = [
    { at: 0, subj: [20.2, 1.35, 0.1], az: 25, el: -2, dist: 2.7, fov: 46, push: 0.08 },
    { at: w(34), subj: [20.55, 1.1, 1.0], az: -40, el: 6, dist: 3.4, fov: 50, move: 0.45 },
    { at: w(39), subj: [20.2, 1.5, 0.1], az: 20, el: -4, dist: 1.9, fov: 44, move: 0.3, roll: 4, hold: true },
  ];
  return <Stage t={t} tg={tg} beats={beats} people={[hero]} phone={{ who: hero, upto: 2 }}>
    <Cat t={t} at={CAT5} cam={beatCam(beats, t).pos} pose="sit" size={0.6} facing={-1} />
    <Symbol3D kind="!!" at={[20.2, 2.1, 0.1]} t={t} t0={w(40)} size={0.36} hold={0.6} />
  </Stage>;
};

// 6 "like a B-movie horror star." - low, rolled horror angle, a red wash from below, hands up to his face; the cat
// on the curb licks a paw, unimpressed (follow-through gag).
const S6: React.FC<{ t: number; tg: number }> = ({ t, tg }) => {
  const w = (i: number) => Wl(i, 6);
  const hero: Who = { who: "hero", at: HERO5, yaw: 0.35, clips: ck("Terrified"),
    expr: [{ at: 0, e: "scared" }, { at: w(45), e: "cry" }], eyes: [{ at: 0, x: 0, y: -0.8 }], talk: [[0, 0.5]] };
  const beats: Beat[] = [
    { at: 0, subj: [20.2, 1.4, 0.1], az: 30, el: -24, dist: 2.4, fov: 50, roll: 7, push: 0.15 },
    { at: w(46), subj: [20.55, 0.75, 1.3], az: 18, el: 2, dist: 3.0, fov: 48, move: 0.4, hold: true },
  ];
  return <Stage t={t} tg={tg} beats={beats} people={[hero]} wash={t < w(46) ? 1 : 0.3} phone={{ who: hero, upto: 2 }}>
    <Cat t={t} at={CAT5} cam={beatCam(beats, t).pos} pose="lick" size={0.6} facing={-1} />
  </Stage>;
};

// ----------------------------------------------------------------------------------------------- the fountain (C)
// 7 "He paced backward, ranting about broken mirrors and seven years of bad luck," - plaza, the fountain behind, he
// backs across frame ranting (mouth), thumbs still typing; the camera tracks him low, passing the lamp post.
const S7: React.FC<{ t: number; tg: number }> = ({ t, tg }) => {
  const w = (i: number) => Wl(i, 7);
  const x = -17.5 - 0.8 * t;
  const hero: Who = { who: "hero", at: [x, 0, 1.6], yaw: Math.PI / 2, clips: cont("Walk_Back"),
    expr: [{ at: 0, e: "angry" }, { at: w(53), e: "scared" }, { at: w(56), e: "nervous" }, { at: w(59), e: "angry" }],
    eyes: [{ at: 0, x: 0.8, y: 0.6 }, { at: w(53), x: -0.5, y: 0 }, { at: w(57), x: 0.8, y: 0.8 }], talk: [[w(51), w(60) + 0.3]] };
  const beats: Beat[] = [
    { at: 0, subj: [x, 1.25, 1.6], az: 40, el: -4, dist: 3.4, fov: 50, orbit: -4 },
    { at: w(54), subj: [x, 1.3, 1.6], az: 15, el: -2, dist: 2.8, fov: 46, move: 0.45 },
    { at: w(57), subj: [x, 1.2, 1.5], az: -20, el: 4, dist: 3.6, fov: 50, move: 0.5 },
  ];
  return <Stage t={t} tg={tg} beats={beats} people={[hero]} phone={{ who: hero, upto: 3 }}>
    <Symbol3D kind="vein" at={(() => { const h = jointOf(hero, t); return [h[0] + 0.2, h[1] + 0.48, h[2] + 0.12] as V3; })()} t={t} t0={w(51)} size={0.28} hold={0.6} />
  </Stage>;
};

// --------------------------------------------------------------------------------------------- the bench row (D)
// 8 "and the whole park stopped to watch." - start close on the teen's raised phone filming, pull OUT to reveal the
// whole row: granny laughing, the jogger stopped mid-run, the hot-dog vendor laughing (the mockery group shot).
const S8: React.FC<{ t: number; tg: number }> = ({ t, tg }) => {
  const w = (i: number) => Wl(i, 8);
  const people: Who[] = [
    { who: "granny", at: [-0.3, -0.08, 16.35], yaw: 0, clips: ck("Sitting_Laughing"), expr: [{ at: 0, e: "laugh" }], eyes: [{ at: 0, x: 0.4, y: 0 }] },
    { who: "teen", at: [-1.5, 0, 17.4], yaw: 0.25, clips: ck("Texting_Standing"), expr: [{ at: 0, e: "grin" }, { at: w(66), e: "laugh" }], eyes: [{ at: 0, x: 0, y: -0.2 }] },
    { who: "jogger", at: [1.1, 0, 17.7], yaw: -0.4, clips: act("Jogging", ["Surprised", w(65), 0.3]), expr: [{ at: 0, e: "neutral" }, { at: w(65), e: "shocked" }], eyes: [{ at: 0, x: 1, y: 0 }, { at: w(65), x: -1, y: 0 }] },
    { who: "vendor", at: [2.4, 0, 16.9], yaw: -0.3, clips: ck("Laughing"), expr: [{ at: 0, e: "laugh" }], eyes: [{ at: 0, x: -0.5, y: 0 }] },
  ];
  const beats: Beat[] = [
    { at: 0, subj: [-1.0, 1.3, 17.2], az: 10, el: 2, dist: 2.6, fov: 46 },
    { at: w(64), subj: [0.3, 1.05, 16.9], az: -4, el: 7, dist: 7.6, fov: 56, move: 0.6, hold: true },
  ];
  return <Stage t={t} tg={tg} beats={beats} people={people}>
  </Stage>;
};

// ------------------------------------------------------------------------------------------- back at the oak (A)
// 9 "He was too busy playing the cursed victim to see the giant oak behind him." - high top-down: he backs toward the
// oak still ranting, the gap closing; on "oak" the camera tilts up to reveal the giant trunk filling the frame.
const S9: React.FC<{ t: number; tg: number }> = ({ t, tg }) => {
  const w = (i: number) => Wl(i, 9);
  const z = 2.4 - 0.62 * t;  // Walk_Back stride
  const hero: Who = { who: "hero", at: [TX, 0, z], yaw: 0, clips: cont("Walk_Back", 0.3),
    expr: [{ at: 0, e: "scared" }, { at: w(72), e: "cry" }, { at: w(76), e: "nervous" }], eyes: [{ at: 0, x: 0, y: 0.8 }], talk: [[0, w(79)]] };
  const beats: Beat[] = [
    { at: 0, subj: [TX, 0.8, z - 0.4], az: 10, el: 64, dist: 3.4, fov: 50, orbit: 4 },
    { at: w(80), subj: [TX, 2.6, -2.6], az: 2, el: -18, dist: 4.6, fov: 54, move: 0.55, hold: true },
  ];
  return <Stage t={t} tg={tg} beats={beats} people={[hero]} phone={{ who: hero, upto: 4 }} />;
};

// 10 "One last dramatic step, and BAM. Lights out." - low on the trunk: he spins and strides forward with a flourish,
// face-first into the bark on "BAM" (silence before it), leaves burst, hold, then black on "out".
const S10: React.FC<{ t: number; tg: number }> = ({ t, tg }) => {
  const w = (i: number) => Wl(i, 10);
  const bam = w(88);
  // a real hit: he strides forward (accelerating) until his face meets the bark exactly on BAM, then the body recoils
  // 0.35 m back (the head snaps, the trunk shudders), camera kicks, bark dust and leaves burst AT the contact point.
  const z0 = -0.45, zHit = TFRONT + 0.16;
  const u = clamp((t - w(85)) / (bam - w(85)));
  const rec = t < bam ? 0 : 0.35 * (1 - Math.exp(-(t - bam) / 0.09));
  const z = t < w(85) ? z0 : t < bam ? z0 + (zHit - z0) * u * u : zHit + rec;
  const hero: Who = { who: "hero", at: [TX, 0, z], yaw: t < w(84) ? 0 : Math.PI, clips: t < bam ? act("Walking_Texting", ["Walking_Texting", w(85), 0.4]) : act("Hit_To_Head", ["Knocked_Out", bam + 0.5, 0]),
    expr: [{ at: 0, e: "smug" }, { at: w(85), e: "smug" }, { at: bam, e: "shocked" }, { at: bam + 0.25, e: "dizzy" }], eyes: [{ at: 0, x: 0, y: 0.9 }] };
  const kick = t > bam ? Math.exp(-(t - bam) / 0.12) : 0;
  const sh = (k: number) => kick * 0.06 * Math.sin((t - bam) * 70 + k);
  const beats: Beat[] = [
    { at: 0, subj: [TX, 1.3, -1.5], az: 90, el: -2, dist: 4.2, fov: 50, push: 0.08 },
    { at: w(86), subj: [TX, 1.4, -2.0], az: 90, el: -2, dist: 3.4, fov: 48, move: 0.35, hold: true },
    { at: bam, subj: [TX + sh(0), 1.45 + sh(1), -2.05], az: 90, el: -2, dist: 2.9, fov: 48, move: 0.08, hold: true, roll: -5 + kick * 6 },
  ];
  const C: V3 = [TX, 1.6, TFRONT];
  return <Stage t={t} tg={tg} beats={beats} people={[hero]} phone={{ who: hero, upto: 4 }} dizzy={clamp((t - bam - 0.25) / 0.6)} dark={clamp((t - w(89)) / (Math.max(w(90) + 0.6, bam + 1.6) - w(89))) ** 1.6}>
    <Debris t={t} t0={bam + 0.02} p={[TX, 3.0, -2.5]} n={50} seed={2} color="#4a8a3a" k={1.1} dir={[0.3, -0.4, 0.6]} cone={1.5} />
    <Debris t={t} t0={bam + 0.06} p={[TX, 3.8, -2.6]} n={34} seed={7} color="#7ab04a" k={0.8} />
    <Debris t={t} t0={bam} p={C} n={18} seed={5} color="#6a4a30" k={1.6} dir={[0, 0.3, 1]} cone={0.9} />
    <Dust t={t} t0={bam} p={C} k={0.5} n={14} color={[0.75, 0.65, 0.5]} />
    <Symbol3D kind="!!" at={[TX, 2.2, TFRONT + 0.3]} t={t} t0={bam + 0.04} size={0.38} hold={0.4} />
  </Stage>;
};

// 11 "He hits the grass, and his phone slides out, screen still glowing." - grass-level lens: he lies dazed, the phone
// slides out of his hand toward the lens (friction, spin), stops close, screen glowing.
const S11: React.FC<{ t: number; tg: number }> = ({ t, tg }) => {
  const w = (i: number) => Wl(i, 11);
  const hero: Who = { who: "hero", at: [0.05, 0, -0.9], yaw: Math.PI, clips: cont("Knocked_Out", 2.6),
    expr: [{ at: 0, e: "dizzy" }], eyes: [{ at: 0, x: 0.5, y: -0.5 }, { at: 1.2, x: -0.5, y: 0.4 }] };
  const s0 = w(98) - 0.1, u = clamp((t - s0) / 0.9), slide = 1 - (1 - u) * (1 - u);
  const p: V3 = lerp3([0.35, 0.03, -0.55], [0.9, 0.03, 0.55], slide);
  const beats: Beat[] = [
    { at: 0, subj: [jointOf(hero, 0.3)[0], 0.3, jointOf(hero, 0.3)[2]], az: 40, el: 14, dist: 2.4, fov: 50, push: 0.06 },
    { at: w(97), subj: [0.8, 0.08, 0.4], az: 25, el: 10, dist: 1.0, fov: 46, move: 0.45 },
    { at: w(101), subj: [0.9, 0.05, 0.55], az: 15, el: 40, dist: 0.55, fov: 42, move: 0.4, hold: true },
  ];
  return <Stage t={t} tg={tg} beats={beats} people={[hero]}>
    <group position={p} rotation={[-Math.PI / 2, 0, slide * 4.2]}><Phone at={[0, 0, 0]} to={[0, 0, 1]} upto={4} glow={1.2} /></group>
    <Symbol3D kind="sparkle" at={[0.05, 0.6, -0.3]} t={t} t0={0.1} size={0.38} hold={2.5} />
  </Stage>;
};

// 12 "He wasn't dodging a curse. He was texting about it the whole time." - REVEAL held on the screen: his texts, the
// meme, then the friend's "dude... LOOK BEHIND YOU" pops on "texting"; on "whole time" his dazed deadpan face, the cat
// strolling past behind him.
const S12: React.FC<{ t: number; tg: number }> = ({ t, tg }) => {
  const w = (i: number) => Wl(i, 12);
  const face = w(113);
  if (t < face) {
    const upto = t < w(108) ? 4 : t < w(110) ? 5 : 6;
    const beats: Beat[] = [{ at: 0, subj: [0.9, 0.05, 0.55], az: 0, el: 88, dist: 0.32, fov: 40, push: 0.04, hold: false, orbit: 0 }];
    return <Stage t={t} tg={tg} beats={beats} people={[]}>
      <group position={[0.9, 0.03, 0.55]} rotation={[-Math.PI / 2, 0, 0]}><Phone at={[0, 0, 0]} to={[0, 0, 1]} upto={upto} glow={1.5} /></group>
    </Stage>;
  }
  const hero: Who = { who: "hero", at: [0.05, 0, -0.9], yaw: Math.PI, clips: cont("Knocked_Out", 2.9 - face), expr: [{ at: 0, e: "bored" }], eyes: [{ at: 0, x: 0, y: 0 }] };
  const hd = jointOf(hero, face);
  const beats: Beat[] = [{ at: face, subj: [hd[0], hd[1] - 0.05, hd[2] + 0.2], az: -45, el: 22, dist: 2.2, fov: 48, hold: true }];
  const cu = clamp((t - face) / 1.6);
  return <Stage t={t} tg={tg} beats={beats} people={[hero]}>
    <Cat t={t} at={[hd[0] - 1.6 + 2.8 * cu, 0, hd[2] + 0.7]} cam={beatCam(beats, t).pos} pose="run" size={0.55} facing={1} speed={0.5} />
  </Stage>;
};

// 13 "And that is exactly how" - the cat sits by the dazed hero and stares straight into the lens; slow push, hold
// (the loop line: replay continues "...this guy walked face-first into a tree").
const S13: React.FC<{ t: number; tg: number }> = ({ t, tg }) => {
  const hero: Who = { who: "hero", at: [0.05, 0, -0.9], yaw: Math.PI, clips: cont("Knocked_Out", 3.0), expr: [{ at: 0, e: "dizzy" }] };
  const beats: Beat[] = [{ at: 0, subj: [1.7, 0.35, -0.4], az: -15, el: 4, dist: 1.3, fov: 42, push: 0.22, orbit: 0 }];
  return <Stage t={t} tg={tg} beats={beats} people={[hero]}>
    <Cat t={t} at={[1.7, 0, -0.4]} cam={beatCam(beats, t).pos} pose="stare" size={0.6} facing={-1} />
  </Stage>;
};

const CLIPS = ["Hit_To_Head", "Knocked_Out", "Walking_Texting", "Texting_Standing", "Yelling", "Walking_Backwards", "Terrified", "Pointing", "Sitting_Laughing", "Jogging", "Surprised", "Laughing", "Reacting", "Walk_Back"];
const needs = [needSet("park", "day"), ...CLIPS.map(needClip)];
const COMPS = [S1, S2, S3, S4, S5, S6, S7, S8, S9, S10, S11, S12, S13];
export const CAT_SHOTS: Record<number, ShotDef> = Object.fromEntries(COMPS.map((C, i) => [i + 1, { id: i + 1, needs, Comp: C }]));
