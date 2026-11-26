// Gold coins pouring out (MOTION_EXPRESSION M4): each coin is emitted from a source over a time window, flies a
// ballistic arc (g = 9.8), spins, hits the floor with restitution 0.35 (2-3 bounces), slides with friction, settles
// flat. Closed-form per coin (pure function of t), one InstancedMesh, metallic gold.
import React from "react";
import * as THREE from "three";
import type { V3 } from "../engine/types";

const G = 9.8, E = 0.35, MU = 2.2;
const h = (i: number) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const geo = new THREE.CylinderGeometry(0.02, 0.02, 0.005, 14);
const mat = new THREE.MeshStandardMaterial({ color: "#f2c040", metalness: 0.92, roughness: 0.22, emissive: "#3a2000", emissiveIntensity: 0.25 });
const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), S = new THREE.Vector3(1, 1, 1), Eu = new THREE.Euler();

/** one coin's state at time since its launch */
const coinAt = (i: number, tt: number, p0: V3, dir: V3, speed: number, spread: number, floor: number) => {
  const a = (h(i) - 0.5) * spread, up = 0.35 + h(i + 7) * 0.9;
  const sp = speed * (0.55 + h(i + 3) * 0.7);
  const dx = dir[0] * Math.cos(a) - dir[2] * Math.sin(a), dz = dir[0] * Math.sin(a) + dir[2] * Math.cos(a);
  let vx = dx * sp, vz = dz * sp, vy = up * sp * 0.6;
  let x = p0[0], y = p0[1] + (h(i + 11) - 0.5) * 0.3, z = p0[2], t = tt, bounces = 0;
  while (t > 0 && bounces < 4) {
    // time to hit the floor: y + vy t - g t^2 / 2 = floor
    const disc = vy * vy + 2 * G * (y - floor);
    const th = (vy + Math.sqrt(Math.max(0, disc))) / G;
    if (t < th) { x += vx * t; z += vz * t; y += vy * t - 0.5 * G * t * t; return { x, y, z, flat: 0, spin: tt * (14 + h(i) * 10) }; }
    x += vx * th; z += vz * th; y = floor; t -= th; vy = -(vy - G * th) * E; vx *= 0.6; vz *= 0.6; bounces++;
    if (vy < 0.25) break;
  }
  // slide to rest
  const v = Math.hypot(vx, vz), ts = v / MU, tc = Math.min(Math.max(0, t), ts);
  if (v > 0) { const d = v * tc - 0.5 * MU * tc * tc; x += (vx / v) * d; z += (vz / v) * d; }
  return { x, y: floor + 0.003, z, flat: 1, spin: h(i + 5) * 6 };
};

export const Coins3D: React.FC<{ t: number; t0: number; dur: number; n: number; p0: V3; dir: V3; speed?: number; spread?: number; floor?: number }> = ({ t, t0, dur, n, p0, dir, speed = 4.5, spread = 1.4, floor = 0 }) => {
  const ref = React.useRef<THREE.InstancedMesh>(null);
  const list: [number, number, number, number, number][] = [];
  for (let i = 0; i < n; i++) {
    const tl = t0 + (i / n) * dur * (0.6 + 0.4 * h(i + 21)); // launch time (denser at the start = a burst)
    if (t < tl) continue;
    const c = coinAt(i, t - tl, p0, dir, speed, spread, floor);
    list.push([c.x, c.y, c.z, c.flat, c.spin]);
  }
  React.useLayoutEffect(() => {
    const m = ref.current; if (!m) return;
    list.forEach(([x, y, z, flat, spin], i) => {
      P.set(x, y, z);
      Eu.set(flat ? 0 : spin, flat ? spin : spin * 0.7, flat ? 0 : spin * 0.4); Q.setFromEuler(Eu);
      M.compose(P, Q, S); m.setMatrixAt(i, M);
    });
    m.count = list.length; m.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={ref} args={[geo, mat, n]} castShadow frustumCulled={false} userData={{ outline: false }} />;
};
