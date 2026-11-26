// Deterministic physics for Remotion (every frame is rendered on its own, in any order, in several tabs): nothing is
// stepped across frames. Each function re-simulates from a fixed start with a FIXED time step (1/240 s) up to the
// asked time, or solves the motion in closed form, so frame N is always the same picture. Randomness comes only from
// hash(seed) (no Math.random).
//   spring()    - a damped spring following a driver signal: secondary motion (antennae, bags, straps, hanging tags)
//   bounce()    - a drop with gravity, restitution and friction: lands, bounces, settles; squash on every impact
//   burst()     - a particle burst (dust, debris, crumbs, sparks): ballistic with drag, ground collision, fade
//   wobble()    - the damped jiggle after an impact
export const G = 9.81;
export const DT = 1 / 240;

/** 0..1, stable per integer/float seed */
export const h01 = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/**
 * A damped spring x'' = w^2 (drive(t) - x) - 2 z w x', started at rest on the driver `win` seconds before t and
 * stepped at DT. Returns [x, v] at t. lag = x - drive(t) is the secondary motion (it trails, overshoots, settles).
 */
export const spring = (drive: (t: number) => number, t: number, hz = 2.2, zeta = 0.22, win = 1.6): [number, number] => {
  const w = 2 * Math.PI * hz;
  const n = Math.ceil(win / DT);
  let tt = t - n * DT;
  let x = drive(tt), v = 0;
  for (let i = 0; i < n; i++) {
    const a = w * w * (drive(tt) - x) - 2 * zeta * w * v;
    v += a * DT; // semi-implicit Euler: stable for these stiffnesses at 240 Hz
    x += v * DT;
    tt += DT;
  }
  return [x, v];
};
/** the lag of a spring behind its driver (0 when the driver is still) */
export const lag = (drive: (t: number) => number, t: number, hz = 2.2, zeta = 0.22, win = 1.6) => spring(drive, t, hz, zeta, win)[0] - drive(t);

export type Bounce = { y: number; vy: number; squash: number; landed: boolean; impacts: { t: number; v: number }[] };
/**
 * A body dropped from height h0 (m, its bottom above the ground) at tau = 0 with vertical speed v0. e = restitution,
 * stops bouncing under vmin. squash = 0..~0.35, a short squash-and-recover after each impact (scaled by the impact
 * speed). impacts lists every touch-down before tau (time, speed) for dust bursts.
 */
export const bounce = (tau: number, h0: number, o: { v0?: number; e?: number; vmin?: number; g?: number; squashK?: number } = {}): Bounce => {
  const g = o.g ?? G, e = o.e ?? 0.35, vmin = o.vmin ?? 0.4, k = o.squashK ?? 0.05;
  const impacts: { t: number; v: number }[] = [];
  if (tau <= 0) return { y: h0, vy: o.v0 ?? 0, squash: 0, landed: false, impacts };
  let t0 = 0, y0 = h0, v0 = o.v0 ?? 0;
  for (let i = 0; i < 12; i++) {
    // y(t) = y0 + v0 t - g t^2 / 2 hits 0 at:
    const tl = (v0 + Math.sqrt(v0 * v0 + 2 * g * y0)) / g;
    if (tau < t0 + tl) {
      const s = tau - t0;
      return { y: y0 + v0 * s - 0.5 * g * s * s, vy: v0 - g * s, squash: squashAfter(tau, impacts, k), landed: impacts.length > 0, impacts };
    }
    const vImp = g * tl - v0;
    impacts.push({ t: t0 + tl, v: vImp });
    t0 += tl;
    y0 = 0;
    v0 = vImp * e;
    if (v0 < vmin) break;
  }
  return { y: 0, vy: 0, squash: squashAfter(tau, impacts, k), landed: true, impacts };
};
const squashAfter = (tau: number, imp: { t: number; v: number }[], k: number) => {
  let s = 0;
  for (const i of imp) {
    const d = tau - i.t;
    if (d >= 0 && d < 0.4) s = Math.max(s, Math.min(0.35, k * i.v) * Math.exp(-d * 14) * Math.cos(d * 26));
  }
  return s;
};
/** damped jiggle after an impact at t0 (amplitude a, frequency hz, decay per s) */
export const wobble = (t: number, t0: number, a: number, hz = 6, decay = 7) => (t < t0 ? 0 : a * Math.exp(-(t - t0) * decay) * Math.sin(2 * Math.PI * hz * (t - t0)));

export type Particle = { p: [number, number, number]; v: [number, number, number]; age: number; life: number; size: number; seed: number; grounded: boolean };
/**
 * A burst of n particles emitted at time t0 from p0 (spread r) with speed in [s0, s1] around direction up (cone
 * half-angle `cone` rad, 0 = straight up, PI/2 = a flat ring), drag per second, gravity scale gk, ground at y = gy
 * (they stop and slide to a halt there). Closed form per axis with linear drag; deterministic in seed.
 */
export const burst = (t: number, t0: number, p0: [number, number, number], o: { n: number; seed: number; s0: number; s1: number; cone?: number; dir?: [number, number, number]; drag?: number; gk?: number; life?: [number, number]; r?: number; gy?: number; size?: [number, number] }): Particle[] => {
  const age = t - t0;
  if (age < 0) return [];
  const out: Particle[] = [];
  const drag = o.drag ?? 2.0, gk = o.gk ?? 1, cone = o.cone ?? 0.6, gy = o.gy ?? -1e9;
  const d = o.dir ?? [0, 1, 0];
  // a basis around dir
  const up = Math.abs(d[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0];
  const ax = norm(cross(up as V, d)), ay = norm(cross(d, ax));
  for (let i = 0; i < o.n; i++) {
    const s = o.seed * 1000 + i * 7.13;
    const life = (o.life?.[0] ?? 0.8) + h01(s + 1) * ((o.life?.[1] ?? 1.6) - (o.life?.[0] ?? 0.8));
    if (age > life) continue;
    const th = h01(s + 2) * Math.PI * 2, ph = Math.sqrt(h01(s + 3)) * cone;
    const sp = o.s0 + (o.s1 - o.s0) * h01(s + 4);
    const dirv: V = [
      (ax[0] * Math.cos(th) + ay[0] * Math.sin(th)) * Math.sin(ph) + d[0] * Math.cos(ph),
      (ax[1] * Math.cos(th) + ay[1] * Math.sin(th)) * Math.sin(ph) + d[1] * Math.cos(ph),
      (ax[2] * Math.cos(th) + ay[2] * Math.sin(th)) * Math.sin(ph) + d[2] * Math.cos(ph),
    ];
    const r = (o.r ?? 0) * Math.sqrt(h01(s + 5));
    const st: V = [p0[0] + Math.cos(th) * r, p0[1], p0[2] + Math.sin(th) * r];
    // linear drag k: x(t) = x0 + v0 (1 - e^-kt)/k ; with gravity: y adds -g (t/k - (1-e^-kt)/k^2)
    const k = drag, E = Math.exp(-k * age), f = (1 - E) / k;
    const gg = G * gk;
    let x = st[0] + sp * dirv[0] * f, z = st[2] + sp * dirv[2] * f;
    let y = st[1] + sp * dirv[1] * f - gg * (age / k - f / k);
    let vy = sp * dirv[1] * E - (gg / k) * (1 - E);
    let vx = sp * dirv[0] * E, vz = sp * dirv[2] * E;
    let grounded = false;
    if (y < gy) {
      // clamp to the ground (it has landed; horizontal motion already decays with drag)
      y = gy;
      vy = 0;
      vx *= 0.3;
      vz *= 0.3;
      grounded = true;
      x = x * 1; // keep x, z where they are (friction)
      z = z * 1;
    }
    const sz = (o.size?.[0] ?? 0.01) + h01(s + 6) * ((o.size?.[1] ?? 0.03) - (o.size?.[0] ?? 0.01));
    out.push({ p: [x, y, z], v: [vx, vy, vz], age, life, size: sz, seed: s, grounded });
  }
  return out;
};
type V = [number, number, number];
const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V): V => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
