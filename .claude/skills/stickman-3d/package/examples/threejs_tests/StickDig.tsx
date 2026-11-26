// TEST 2: the 3D stickman with EXPRESSIONS (face atlas: happy, effort, shocked, smug, talk; deterministic blinks),
// PROPS (a real Poly Haven spade on the hand bones: one hand while walking, both hands while digging; a flat cap on
// the head) and two Mixamo clips blended (walk -> dig). Pure function of the frame.
import React from "react";
import { AbsoluteFill, continueRender, delayRender, staticFile, useCurrentFrame } from "remotion";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { subFrame } from "../inkbeat/core/frame";
import { View } from "../inkbeat/core/View";
import { patch, toonRamp } from "../inkbeat/mat/materials";
import type { V3 } from "../inkbeat/types";
import { Card, cardTex, getLoaded, loadAll, sunriseMood } from "./Pilot25";

export const SD_FRAMES = 240;
const INK = "#120a10";
const BODY = "#c8452f"; // red coat
const CAP = "#6a4a32";

// ---------------------------------------------------------------- timeline (seconds)
const T_STOP = 2.8; // walk -> dig crossfade 2.8 .. 3.2
const X_FADE = 0.4;
const T_DIG = 3.0;
const T_SHOCK = 5.6;
const T_SMUG = 6.8;
type Expr = "happy" | "effort" | "shocked" | "smug";
const exprAt = (t: number): Expr => (t < 3.2 ? "happy" : t < T_SHOCK ? "effort" : t < T_SMUG ? "shocked" : "smug");
const talkAt = (t: number) => (t > 7.0 && t < 7.7 ? (Math.floor((t - 7.0) / 0.11) % 2 === 0 ? 1 : 0) : 0);
/** deterministic blinks: one every 0.5-2.3 s, 4 frames long, none during shock */
const blinkAt = (t: number) => {
  const f = Math.floor(t * 30);
  let s = 0;
  let k = 7919;
  while (s <= f) {
    k = (k * 16807) % 2147483647;
    const gap = 15 + (k % 54);
    if (f >= s + gap && f < s + gap + 4) return true;
    s += gap + 4;
  }
  return false;
};

// ---------------------------------------------------------------- assets (one load per tab)
type Rig = {
  root: THREE.Group;
  mixer: THREE.AnimationMixer;
  walk: THREE.AnimationAction;
  dig: THREE.AnimationAction;
  walkDur: number;
  digDur: number;
  speed: number;
  bone: (n: string) => THREE.Object3D;
  spade: THREE.Group;
  spadeLen: number;
};
let rigP: Promise<Rig> | null = null;
let rig: Rig | null = null;
const toToon = (src: THREE.Material) => {
  const s = src as THREE.MeshStandardMaterial;
  const m = new THREE.MeshToonMaterial({ color: s.color, map: s.map ?? null, gradientMap: toonRamp() });
  m.userData.triScale = { value: 1 };
  patch(m);
  return m;
};
const loadRig = () => {
  if (!rigP) {
    const L = new GLTFLoader();
    rigP = Promise.all([L.loadAsync(staticFile("stick3d/walk.glb")), L.loadAsync(staticFile("stick3d/dig.glb")), L.loadAsync(staticFile("stick3d/spade.glb"))]).then(
      ([w, d, sp]) => {
        const root = new THREE.Group();
        root.add(w.scene);
        const mixer = new THREE.AnimationMixer(w.scene);
        const walk = mixer.clipAction(w.animations[0]);
        const dig = mixer.clipAction(d.animations[0]); // same Mixamo skeleton: tracks bind by bone name
        for (const a of [walk, dig]) {
          a.play();
          a.enabled = true;
        }
        const bone = (n: string) => w.scene.getObjectByName("mixamorig" + n) ?? w.scene.getObjectByName("mixamorig:" + n)!;
        // walk speed from the planted foot (slides back at walk speed during stance)
        walk.setEffectiveWeight(1);
        dig.setEffectiveWeight(0);
        const foot = bone("LeftFoot");
        const v = new THREE.Vector3();
        let zmin = 1e9;
        let zmax = -1e9;
        for (let i = 0; i < 32; i++) {
          walk.time = (i / 32) * w.animations[0].duration;
          mixer.update(0);
          w.scene.updateMatrixWorld(true);
          foot.getWorldPosition(v);
          zmin = Math.min(zmin, v.z);
          zmax = Math.max(zmax, v.z);
        }
        const speed = (zmax - zmin) / (w.animations[0].duration * 0.5);
        sp.scene.traverse((o) => {
          const me = o as THREE.Mesh;
          if (me.isMesh) {
            me.material = toToon(me.material as THREE.Material);
            me.castShadow = true;
          }
        });
        const spade = new THREE.Group();
        spade.add(sp.scene);
        rig = { root, mixer, walk, dig, walkDur: w.animations[0].duration, digDur: d.animations[0].duration, speed, bone, spade, spadeLen: 1.1 };
        return rig;
      },
    );
  }
  return rigP;
};

// ---------------------------------------------------------------- face atlas (canvas, cached per state)
const faces = new Map<string, THREE.CanvasTexture>();
const getFace = (e: Expr, blink: boolean, talk: number) => {
  const key = `${e}|${blink ? 1 : 0}|${talk}`;
  const hit = faces.get(key);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 384;
  const g = c.getContext("2d")!;
  g.fillStyle = INK;
  g.strokeStyle = INK;
  g.lineCap = "round";
  g.lineJoin = "round";
  const EX = [196, 316];
  const EY = 196;
  const line = (w: number, pts: number[]) => {
    g.lineWidth = w;
    g.beginPath();
    g.moveTo(pts[0], pts[1]);
    if (pts.length === 4) g.lineTo(pts[2], pts[3]);
    else g.quadraticCurveTo(pts[2], pts[3], pts[4], pts[5]);
    g.stroke();
  };
  // eyes
  for (let i = 0; i < 2; i++) {
    const x = EX[i];
    if (blink && e !== "shocked") line(9, [x - 22, EY + 2, x, EY + 10, x + 22, EY + 2]);
    else if (e === "shocked") {
      g.fillStyle = "#ffffff";
      g.beginPath();
      g.arc(x, EY - 4, 36, 0, Math.PI * 2);
      g.fill();
      g.lineWidth = 8;
      g.stroke();
      g.fillStyle = INK;
      g.beginPath();
      g.arc(x, EY - 4, 10, 0, Math.PI * 2);
      g.fill();
    } else if (e === "effort") line(10, i === 0 ? [x - 22, EY - 14, x + 18, EY, x - 22, EY + 14] : [x + 22, EY - 14, x - 18, EY, x + 22, EY + 14]);
    else if (e === "smug") {
      g.beginPath();
      g.arc(x, EY + 4, 21, 0, Math.PI); // lower half only: half-lidded
      g.fill();
      line(9, [x - 26, EY + 2, x + 26, EY + 2]);
    } else {
      g.beginPath();
      g.arc(x, EY, 21, 0, Math.PI * 2);
      g.fill();
    }
  }
  // brows
  if (e === "happy") {
    line(17, [160, 140, 196, 116, 228, 134]);
    line(17, [284, 134, 316, 116, 352, 140]);
  } else if (e === "effort") {
    line(18, [160, 128, 196, 136, 232, 156]);
    line(18, [280, 156, 316, 136, 352, 128]);
  } else if (e === "shocked") {
    line(15, [156, 112, 196, 82, 232, 104]);
    line(15, [280, 104, 316, 82, 356, 112]);
  } else {
    line(17, [160, 150, 196, 146, 230, 150]); // smug: one flat ...
    line(17, [282, 138, 316, 110, 352, 124]); // ... one raised
  }
  // mouth
  if (talk) {
    g.beginPath();
    g.ellipse(262, 284, 30, 22, 0, 0, Math.PI * 2);
    g.fill();
  } else if (e === "happy") line(11, [222, 272, 256, 302, 292, 270]);
  else if (e === "effort") {
    g.fillStyle = "#ffffff";
    g.fillRect(212, 266, 96, 34);
    g.lineWidth = 8;
    g.strokeRect(212, 266, 96, 34);
    line(5, [212, 283, 308, 283]);
    for (const x of [236, 260, 284]) line(5, [x, 266, x, 300]);
  } else if (e === "shocked") {
    g.beginPath();
    g.ellipse(258, 290, 26, 34, 0, 0, Math.PI * 2);
    g.fill();
  } else line(11, [232, 290, 270, 292, 300, 268]); // smirk
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  faces.set(key, t);
  return t;
};
const faceMats = new Map<THREE.Texture, THREE.MeshBasicMaterial>();
const faceMat = (tex: THREE.Texture) => {
  let m = faceMats.get(tex);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.4, depthWrite: false, toneMapped: false });
    faceMats.set(tex, m);
  }
  return m;
};

// ---------------------------------------------------------------- materials / geometry
const toon = (color: string) => {
  const m = new THREE.MeshToonMaterial({ color, gradientMap: toonRamp() });
  m.userData.triScale = { value: 1 };
  patch(m);
  return m;
};
const HEAD_R = 0.25;
const M = {
  head: (() => {
    const m = toon("#ffffff");
    m.emissive.set("#fff6f2");
    m.emissiveIntensity = 0.32;
    return m;
  })(),
  body: toon(BODY),
  cap: toon(CAP),
  stick: new THREE.MeshBasicMaterial({ color: INK }),
  hull: new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide }),
};
const G = {
  head: new THREE.SphereGeometry(HEAD_R, 48, 32),
  face: new THREE.SphereGeometry(HEAD_R * 1.004, 48, 32, Math.PI / 2 - 1.05, 2.1, Math.PI / 2 - 0.8, 1.6),
  limb: new THREE.CylinderGeometry(1, 1, 1, 12),
  dot: new THREE.SphereGeometry(1, 16, 12),
  pill: new THREE.CapsuleGeometry(0.165, 0.3, 8, 24),
  capTop: new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2 + 0.25),
  capBrim: new THREE.CylinderGeometry(1, 1, 1, 32, 1, false, -Math.PI / 2 - 0.9, 1.8),
};
const Y = new THREE.Vector3(0, 1, 0);
const Stick: React.FC<{ a: THREE.Vector3; b: THREE.Vector3; r: number }> = ({ a, b, r }) => {
  const d = b.clone().sub(a);
  const q = new THREE.Quaternion().setFromUnitVectors(Y, d.clone().normalize());
  return <mesh geometry={G.limb} material={M.stick} position={a.clone().add(b).multiplyScalar(0.5)} quaternion={q} scale={[r, d.length() + r * 0.6, r]} castShadow userData={{ outline: false }} />;
};
const Dot: React.FC<{ p: THREE.Vector3; r: number; s?: V3 }> = ({ p, r, s = [1, 1, 1] }) => (
  <mesh geometry={G.dot} material={M.stick} position={p} scale={[r * s[0], r * s[1], r * s[2]]} castShadow userData={{ outline: false }} />
);

// ---------------------------------------------------------------- pose sampling (two clips blended)
type Pose = Record<string, THREE.Vector3>;
const NAMES = ["Hips", "Neck", "Head", "HeadTop_End", "LeftArm", "LeftForeArm", "LeftHand", "LeftHandMiddle1", "RightArm", "RightForeArm", "RightHand", "RightHandMiddle1",
  "LeftUpLeg", "LeftLeg", "LeftFoot", "LeftToeBase", "RightUpLeg", "RightLeg", "RightFoot", "RightToeBase"];
const walkW = (t: number) => 1 - THREE.MathUtils.clamp((t - T_STOP) / X_FADE, 0, 1);
const sample = (R: Rig, t: number, at: V3, yaw: number, scale: number): Pose => {
  const w = walkW(t);
  R.walk.time = ((t % R.walkDur) + R.walkDur) % R.walkDur;
  R.dig.time = THREE.MathUtils.clamp(t - T_DIG + 0.25, 0, R.digDur - 1e-3);
  R.walk.setEffectiveWeight(w);
  R.dig.setEffectiveWeight(1 - w);
  R.mixer.update(0);
  R.root.position.set(...at);
  R.root.rotation.set(0, yaw, 0);
  R.root.scale.setScalar(scale);
  R.root.updateMatrixWorld(true);
  const p: Pose = {};
  for (const n of NAMES) p[n] = R.bone(n).getWorldPosition(new THREE.Vector3());
  const LEG_K = 0.7; // cartoon legs: squashed vertically, feet on the ground, stride unchanged
  const drop = at[1] + (p.Hips.y - at[1]) * (1 - LEG_K);
  for (const n of NAMES) {
    if (/UpLeg|Leg|Foot|ToeBase/.test(n)) p[n].y = at[1] + (p[n].y - at[1]) * LEG_K;
    else p[n].y -= drop - at[1];
  }
  return p;
};

/** the spade: carried in the right hand while walking, gripped by both hands (blade below the lower hand) while digging */
const spadeXform = (P: Pose, yaw: number, w: number, L: number) => {
  const fwd = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
  const basis = (yAxis: THREE.Vector3, along: number, grip: THREE.Vector3) => {
    const y = yAxis.clone().normalize();
    const z = fwd.clone().addScaledVector(y, -fwd.dot(y)).normalize();
    const x = new THREE.Vector3().crossVectors(y, z).normalize();
    const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
    return { pos: grip.clone().addScaledVector(y, -along * L), q };
  };
  // walking: hand near the top of the shaft, blade down and a little forward
  const carry = basis(new THREE.Vector3(0, 1, 0).addScaledVector(fwd, -0.25), 0.62, P.RightHandMiddle1);
  // digging: shaft through both hands; the higher hand holds the handle end
  const r = P.RightHandMiddle1;
  const l = P.LeftHandMiddle1;
  const hi = r.y > l.y ? r : l;
  const lo = r.y > l.y ? l : r;
  const dig = basis(hi.clone().sub(lo), 0.9, hi);
  const pos = dig.pos.clone().lerp(carry.pos, w);
  const q = dig.q.clone().slerp(carry.q, w);
  return { pos, q };
};

const StickMan: React.FC<{ R: Rig; t: number; at: V3; yaw: number; cam: V3; scale: number }> = ({ R, t, at, yaw, cam, scale }) => {
  const P = sample(R, t, at, yaw, scale);
  const Pp = sample(R, t - 0.06, at, yaw, scale);
  const vy = (P.Hips.y - Pp.Hips.y) / 0.06;
  const sy = THREE.MathUtils.clamp(1 + vy * 0.35, 0.9, 1.1);
  const sxz = 1 / Math.sqrt(sy);
  const bodyA = P.Hips.clone().add(new THREE.Vector3(0, -0.06, 0));
  const bdir = P.Neck.clone().sub(bodyA);
  const bq = new THREE.Quaternion().setFromUnitVectors(Y, bdir.clone().normalize());
  const bmid = bodyA.clone().add(P.Neck).multiplyScalar(0.5);
  const blen = bdir.length() / 0.63;
  // head: up along neck->head top, lags the bob, 3/4 turn toward the lens, jiggles; shock = a small jump back
  const shockK = t > T_SHOCK ? Math.exp(-(t - T_SHOCK) * 7) * Math.sin((t - T_SHOCK) * 30) : 0;
  // big cartoon heads stay mostly upright: take only a quarter of the bone's tilt (a full Mixamo head tilt rolls the
  // giant head over when he bends to dig)
  const up = new THREE.Vector3(0, 1, 0).multiplyScalar(0.75).addScaledVector(P.HeadTop_End.clone().sub(P.Head).normalize(), 0.25).normalize();
  const headC = P.Neck.clone().addScaledVector(up, HEAD_R * 0.92).add(new THREE.Vector3(0, -vy * 0.025 + Math.abs(shockK) * 0.06, 0));
  const toCam = new THREE.Vector3(cam[0] - headC.x, 0, cam[2] - headC.z).normalize();
  let dy = Math.atan2(toCam.x, toCam.z) - yaw;
  dy = Math.atan2(Math.sin(dy), Math.cos(dy));
  const hy = yaw + THREE.MathUtils.clamp(dy * 0.55, -0.75, 0.75);
  const hf = new THREE.Vector3(Math.sin(hy), 0, Math.cos(hy));
  const right = new THREE.Vector3().crossVectors(up, hf).normalize();
  const hfo = new THREE.Vector3().crossVectors(right, up).normalize();
  const hq = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, hfo));
  hq.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.sin((t / R.walkDur) * Math.PI * 4 + 0.6) * 0.04 * walkW(t) + shockK * 0.08));
  const hsq = 1 - (sy - 1) * 0.5 + shockK * 0.05;
  const e = exprAt(t);
  const face = getFace(e, e !== "shocked" && blinkAt(t), talkAt(t));
  const sp = spadeXform(P, yaw, walkW(t), R.spadeLen * 0.85);
  const limbR = 0.022;
  return (
    <group>
      <group position={headC} quaternion={hq} scale={[1 / Math.sqrt(hsq), hsq * 1.04, 0.9 / Math.sqrt(hsq)]}>
        <mesh geometry={G.head} material={M.head} castShadow receiveShadow />
        <mesh geometry={G.head} material={M.hull} scale={1.055} userData={{ outline: false }} />
        <mesh geometry={G.face} material={faceMat(face)} userData={{ outline: false }} />
        {/* flat cap: a low dome + a brim over the face, its own ink hull */}
        <group position={[0, HEAD_R * 0.6, -0.03]} rotation={[-0.12, 0, 0]}>
          <mesh geometry={G.capTop} material={M.cap} scale={[HEAD_R * 1.0, HEAD_R * 0.42, HEAD_R * 1.04]} castShadow />
          <mesh geometry={G.capTop} material={M.hull} scale={[HEAD_R * 1.06, HEAD_R * 0.47, HEAD_R * 1.1]} userData={{ outline: false }} />
          <mesh geometry={G.capBrim} material={M.cap} position={[0, 0.005, 0.04]} scale={[HEAD_R * 1.1, 0.02, HEAD_R * 1.2]} castShadow />
        </group>
      </group>
      <group position={bmid} quaternion={bq} scale={[sxz, blen * sy, sxz]}>
        <mesh geometry={G.pill} material={M.body} castShadow receiveShadow />
        <mesh geometry={G.pill} material={M.hull} scale={[1.09, 1.04, 1.09]} userData={{ outline: false }} />
      </group>
      {(["Left", "Right"] as const).map((s) => (
        <group key={s}>
          <Stick a={P[s + "Arm"]} b={P[s + "ForeArm"]} r={limbR} />
          <Stick a={P[s + "ForeArm"]} b={P[s + "HandMiddle1"]} r={limbR} />
          <Dot p={P[s + "ForeArm"]} r={limbR} />
          <Dot p={P[s + "HandMiddle1"]} r={0.045} />
          <Stick a={P[s + "UpLeg"]} b={P[s + "Leg"]} r={limbR * 1.1} />
          <Stick a={P[s + "Leg"]} b={P[s + "Foot"]} r={limbR * 1.1} />
          <Dot p={P[s + "Leg"]} r={limbR * 1.1} />
          <Dot p={P[s + "Foot"].clone().lerp(P[s + "ToeBase"], 0.5).add(new THREE.Vector3(0, -0.01, 0))} r={0.06} s={[0.7, 0.45, 1.25]} />
        </group>
      ))}
      <group position={sp.pos} quaternion={sp.q} scale={0.85}>
        <primitive object={R.spade} />
      </group>
      <mesh position={[P.Hips.x, 0.004, P.Hips.z]} rotation={[-Math.PI / 2, 0, 0]} userData={{ outline: false }}>
        <circleGeometry args={[0.32, 32]} />
        <meshBasicMaterial color="#3a2a5a" transparent opacity={0.22} depthWrite={false} />
      </mesh>
    </group>
  );
};

// ---------------------------------------------------------------- loader + shot
let cardTexOne: THREE.Texture | null = null;
const useAll = () => {
  const [, bump] = React.useState(0);
  const pending = React.useRef<number | null>(null);
  const L = getLoaded();
  const ready = !!(L && rig && cardTexOne);
  if (!ready && pending.current === null) {
    pending.current = delayRender("stickdig assets");
    Promise.all([loadAll(), loadRig(), cardTex(1).then((t) => (cardTexOne = t))]).then(() => bump((x) => x + 1));
  }
  React.useLayoutEffect(() => {
    if (ready && pending.current !== null && pending.current >= 0) {
      const h = pending.current;
      pending.current = -1;
      requestAnimationFrame(() => continueRender(h));
    }
  });
  return ready ? { L: L!, R: rig!, tex: cardTexOne! } : null;
};
const ss = (a: number, b: number, x: number) => {
  const u = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1);
  return u * u * (3 - 2 * u);
};

export const StickDig: React.FC<{ sub?: boolean }> = ({ sub = false }) => {
  const g = useCurrentFrame();
  const { fp } = sub ? subFrame(g) : { fp: g };
  const A = useAll();
  if (!A) return <AbsoluteFill style={{ background: "#2a2040" }} />;
  const t = fp / 30;
  const { L, R, tex } = A;
  const SCALE = 0.8;
  const v = R.speed * SCALE;
  // root motion: walk speed x walk weight, integrated (no foot slide while the clips cross-fade)
  const u = THREE.MathUtils.clamp(t - T_STOP, 0, X_FADE);
  const dist = v * (Math.min(t, T_STOP) + u - (u * u) / (2 * X_FADE));
  const x = -2.4 + dist;
  const at: V3 = [x, 0, 2.2];
  // turns a little toward the camera as he starts to dig
  const yaw = Math.PI / 2 - 0.7 * ss(T_STOP, T_STOP + 0.6, t);
  // camera: orbit while he walks, settle front-on for the dig, punch in on the shock, ease back for the smug end
  const k = ss(0, 3.2, t);
  const ang = 1.1 - 1.2 * k + 0.35 * ss(3.2, 7.5, t);
  const punch = ss(T_SHOCK - 0.05, T_SHOCK + 0.25, t) * (1 - 0.6 * ss(T_SMUG, T_SMUG + 0.8, t));
  const d = 3.3 - 0.4 * k - 1.2 * punch;
  const look: V3 = [x + 0.1, 1.0 + 0.25 * punch, 2.2];
  const cam = { pos: [look[0] + Math.sin(ang) * d, 0.8 + 0.4 * k + 0.2 * punch, look[2] + Math.cos(ang) * d] as V3, look, fov: 42, roll: 0 };
  const T = L.track;
  const sun = T.lights.find((l) => l.kind === "SUN");
  const mood = sunriseMood(sun ? sun.dir : [0.4, 0.6, 0.5]);
  const F = T.frames[0];
  return (
    <AbsoluteFill style={{ background: "#2a2040" }}>
      <View mood={mood} cam={cam} t={t} focus={look} blur={1.4} near={0.15} far={250}>
        <primitive object={L.scene} />
        <Card tex={tex} pos={F.cards[0].pos} scale={F.cards[0].scale} cam={cam.pos} spec={T.card} item={T.card.list[0]} />
        <StickMan R={R} t={t} at={at} yaw={yaw} cam={cam.pos} scale={SCALE} />
      </View>
    </AbsoluteFill>
  );
};
