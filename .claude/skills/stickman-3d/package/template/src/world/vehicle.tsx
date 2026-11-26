// Vehicles: public/vehicles/<id>.glb from `stickman3d.py vehicle <id> [--from <asset_id>]`, drawn with <Vehicle/>.
//
// GLB convention (written by the vehicle export, package/tools/vehicle_build.py): metres; origin on the ground under
// the centre of the bounding box; FRONT toward three -Z (= Blender +Y, the asset convention of ASSETS.md); the car's
// LEFT toward three -X; wheel nodes named wheel_FL / wheel_FR / wheel_RL / wheel_RR (F/R = front/rear, L/R = the car's
// own left/right), origin at the wheel centre. Other names are found too (see findWheels), but name them like that.
//
// <Vehicle yaw> uses the Stickman convention: yaw 0 drives toward three +Z, heading = (sin yaw, 0, cos yaw) (`heading`).
// Positive yaw and positive steer turn LEFT (counter-clockwise seen from above). bodyRoll > 0 lowers the car's right
// side (the body leans out of a left turn), bodyPitch > 0 lifts the nose. Every prop is a pure function of the frame:
// pass `dist` (metres travelled, e.g. the same `walked(...)`-style integral that moves `at`), never accumulate.
//
// crumple 0..1: the front 35 % of the body is squashed toward the centre along its length (up to half of that zone at
// 1), the bonnet buckles up into a ridge, the front bulges sideways, small deterministic wrinkles; the front wheels and
// lamps move back with it. CPU vertex deformation on this instance's own geometry copy (the ink and shadow passes see
// it too), recomputed only when the value changes.
//
// Instances: one clone per (shot, name) like useSetScene (geometry and materials shared until crumple / tint need
// their own); two of the same car in one shot need different `name`s.
import React from "react";
import * as THREE from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { V3 } from "../engine/types";
import { got, loadGLB, toToon } from "./assets";
import type { Need } from "./assets";
import { ShotCtx } from "./registry";
import { NO_INK } from "./set";
import { Glow } from "./weather";

export type WheelKey = "FL" | "FR" | "RL" | "RR";
const WHEELS: WheelKey[] = ["FL", "FR", "RL", "RR"];

/** measured on load, GLB frame (front = -Z, left = -X, ground y = 0) */
export type VehicleDims = {
  length: number;
  width: number;
  height: number;
  /** z of the front / rear bumper (front < rear) */
  front: number;
  rear: number;
  /** wheel radius (mean of the four; 0.33 when no wheels were found) */
  wheelR: number;
  /** front axle z - rear axle z distance */
  wheelbase: number;
};
export type LoadedVehicle = {
  id: string;
  holder: THREE.Group;
  dims: VehicleDims;
  /** per wheel: radius and centre (GLB frame); null when no wheels were found (one-mesh wreck) */
  wheels: Record<WheelKey, { r: number; c: V3 }> | null;
  /** how the wheels were found: "names" (wheel_FL ...), "regex" (wheel/tyre/tire/whl by quadrant) or "none" */
  wheelHow: string;
  /** the material `tint` recolours by default (largest saturated body material) */
  paint: string | null;
  /** headlight / taillight centres (GLB frame) and where they came from ("materials" or "ray") */
  head: V3[];
  tail: V3[];
  lampHow: string;
  /** the steering-wheel node (`<id>_steering_wheel` / `*steering_wheel*`): name, rest rotation and its column axis
   *  (unit, parent frame, pointing from the hub toward the driver) measured as the rim's plane normal; null = none */
  steering: { name: string; axis: V3; rest: [number, number, number, number] } | null;
};
/** steering-wheel turns per front-wheel angle (rad / rad): <Vehicle steer/> turns the steering wheel by steer x this
 *  (a 1910 car needs ~1-1.5 turns lock to lock; 0.35 rad of steer = ~2 rad of wheel). Override per shot with `wheel`. */
export const STEER_RATIO = 6;
/** front-wheel steer angle (rad, + = left) for a turn of radius R (m, path radius at the car's centre) */
export const steerFor = (R: number, wheelbase: number, left = true) => (left ? 1 : -1) * Math.atan(wheelbase / Math.max(0.5, Math.abs(R)));

/** the steering wheel's column axis: the normal of its rim plane (smallest spread of its vertices, PCA) in the node's
 *  parent frame, oriented toward the driver (+Z in the GLB: the front is -Z) */
const findSteering = (scene: THREE.Object3D): LoadedVehicle["steering"] => {
  let node: THREE.Object3D | null = null;
  scene.traverse((o) => { if (!node && /steering_?wheel/i.test(o.name)) node = o; });
  if (!node) return null;
  const n = node as THREE.Object3D;
  n.updateMatrix();
  const pts: THREE.Vector3[] = [];
  const toParent = new THREE.Matrix4();
  n.updateMatrixWorld(true);
  const parentInv = n.parent ? n.parent.matrixWorld.clone().invert() : new THREE.Matrix4();
  n.traverse((o) => {
    const me = o as THREE.Mesh;
    if (!me.isMesh) return;
    toParent.multiplyMatrices(parentInv, me.matrixWorld);
    const pos = me.geometry.attributes.position as THREE.BufferAttribute;
    const step = Math.max(1, Math.floor(pos.count / 4000));
    for (let i = 0; i < pos.count; i += step) pts.push(new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(toParent));
  });
  if (pts.length < 3) return null;
  const c = pts.reduce((a, b) => a.add(b), new THREE.Vector3()).divideScalar(pts.length);
  const C = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (const p of pts) {
    const d = [p.x - c.x, p.y - c.y, p.z - c.z];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) C[i * 3 + j] += d[i] * d[j];
  }
  const mul = (v: THREE.Vector3) => new THREE.Vector3(C[0] * v.x + C[1] * v.y + C[2] * v.z, C[3] * v.x + C[4] * v.y + C[5] * v.z, C[6] * v.x + C[7] * v.y + C[8] * v.z);
  const power = (v: THREE.Vector3, not?: THREE.Vector3) => {
    for (let i = 0; i < 60; i++) {
      v = mul(v);
      if (not) v.addScaledVector(not, -v.dot(not));
      v.normalize();
    }
    return v;
  };
  const e1 = power(new THREE.Vector3(0.6, 0.5, 0.62).normalize());
  const e2 = power(new THREE.Vector3(-0.3, 0.8, 0.2).normalize(), e1);
  const axis = new THREE.Vector3().crossVectors(e1, e2).normalize();
  if (axis.z < 0) axis.negate();
  const q = n.quaternion;
  return { name: n.name, axis: [axis.x, axis.y, axis.z], rest: [q.x, q.y, q.z, q.w] };
};

// ------------------------------------------------------------------ small math
const smooth = (a: number, b: number, x: number) => {
  const u = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return u * u * (3 - 2 * u);
};
/** heading of a vehicle (or Stickman) at yaw: (sin yaw, 0, cos yaw) */
export const heading = (yaw: number): V3 => [Math.sin(yaw), 0, Math.cos(yaw)];
/** the point `d` metres ahead of `at` along yaw */
export const along = (at: V3, yaw: number, d: number): V3 => [at[0] + Math.sin(yaw) * d, at[1], at[2] + Math.cos(yaw) * d];
/** wheel rotation (rad about the axle) after `dist` metres; forward = negative about the car's +X in the GLB frame */
export const wheelAngle = (dist: number, r: number) => -dist / Math.max(0.05, r);

/** crumple deformation of one point (GLB frame). Pure; the same position always moves the same way (seams stay shut). */
export const crumplePoint = (d: VehicleDims, c: number, x: number, y: number, z: number): V3 => {
  if (c <= 0) return [x, y, z];
  c = Math.min(1, c);
  const zone = 0.35 * d.length;
  const z0 = d.front + zone;
  if (z >= z0) return [x, y, z];
  const u = Math.min(1, (z0 - z) / zone); // 0 where the crumple zone starts, 1 at the bumper
  const b = 0.42 * c; // g(u) = u - b u^2: monotonic (no folding through itself) while 2b + the dent slope < 1
  const hw = Math.max(0.3, d.width * 0.5);
  const dent = 0.25 * c * Math.pow(u, 1.5) * Math.exp(-((x / (0.45 * hw)) ** 2)); // the centre (pole / tree) goes in deepest
  const z2 = z0 - zone * (u - b * u * u) + dent;
  const yy = y / Math.max(0.5, d.height);
  const hood = smooth(0.4, 0.6, yy); // bonnet / wings, not the sills
  const lat = Math.max(0, Math.cos((x / hw) * Math.PI * 0.5));
  const tent = Math.pow(1 - Math.abs(2 * Math.min(1, u * 1.1) - 1), 1.2); // the bonnet folds up along one crease
  let y2 = y + c * 0.36 * tent * hood * (0.4 + 0.6 * lat);
  y2 -= c * 0.07 * u * u * (1 - hood); // bumper pushed down
  y2 += c * u * 0.05 * Math.sin(u * 17 + x * 5.3); // wrinkles
  const x2 = x * (1 + c * 0.1 * Math.sin(Math.PI * u)) + c * u * 0.035 * Math.sin(u * 13 + y * 7.1) * Math.sign(x);
  return [x2, y2, z2];
};

// ------------------------------------------------------------------ load
const HEAD_RE = /head.?l(igh|am)p|headlight|front.?light/i;
const TAIL_RE = /tail.?l(igh|am)p|taillight|brake.?light|rear.?light/i;
const NOT_PAINT = /glass|window|wind|tire|tyre|rubber|chrome|interior|seat|light|lamp|plate|badge|mirror|grill|black|dark|bottom|under|carpet|leather|plastic|metal|rim|wheel/i;

const srcOf = new WeakMap<THREE.Material, THREE.Material>(); // toon -> the GLB material it came from

const box = (o: THREE.Object3D) => new THREE.Box3().setFromObject(o);
const v3 = (v: THREE.Vector3): V3 => [v.x, v.y, v.z];

/** wheel nodes: exact names wheel_FL/FR/RL/RR first (also `<id>_wheel_FL`, `wheel.FL`, `Wheel_FL_1`), else nodes whose
 *  name matches wheel / whl / tyre / tire, one per quadrant by position (the largest in each) */
const findWheels = (scene: THREE.Object3D): { w: Record<WheelKey, THREE.Object3D> | null; how: string } => {
  const named: Partial<Record<WheelKey, THREE.Object3D>> = {};
  scene.traverse((o) => {
    const m = /(?:^|[_\W])wheel[_\W]?(FL|FR|RL|RR)$/i.exec(o.name);
    if (m && !named[m[1].toUpperCase() as WheelKey]) named[m[1].toUpperCase() as WheelKey] = o;
  });
  if (WHEELS.every((k) => named[k])) return { w: named as Record<WheelKey, THREE.Object3D>, how: "names" };
  const cand: { o: THREE.Object3D; b: THREE.Box3 }[] = [];
  scene.traverse((o) => {
    if (o === scene || !/wheel|whl|tyre|tire/i.test(o.name)) return;
    if (cand.some((c) => o.parent && isAncestor(c.o, o))) return; // keep the topmost match
    const b = box(o);
    if (!b.isEmpty()) cand.push({ o, b });
  });
  const best: Partial<Record<WheelKey, { o: THREE.Object3D; s: number }>> = {};
  for (const c of cand) {
    const ctr = c.b.getCenter(new THREE.Vector3());
    const k = `${ctr.z < 0 ? "F" : "R"}${ctr.x < 0 ? "L" : "R"}` as WheelKey;
    const s = c.b.getSize(new THREE.Vector3()).y;
    if (!best[k] || s > best[k]!.s) best[k] = { o: c.o, s };
  }
  if (WHEELS.every((k) => best[k])) {
    const w = {} as Record<WheelKey, THREE.Object3D>;
    WHEELS.forEach((k) => (w[k] = best[k]!.o));
    return { w, how: "regex" };
  }
  return { w: null, how: "none" };
};
const isAncestor = (a: THREE.Object3D, o: THREE.Object3D) => {
  for (let p = o.parent; p; p = p.parent) if (p === a) return true;
  return false;
};

const triArea = (g: THREE.BufferGeometry, m: THREE.Matrix4) => {
  const p = g.attributes.position as THREE.BufferAttribute;
  const idx = g.index;
  const n = idx ? idx.count : p.count;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  let s = 0;
  for (let i = 0; i + 2 < n; i += 3) {
    const i0 = idx ? idx.getX(i) : i, i1 = idx ? idx.getX(i + 1) : i + 1, i2 = idx ? idx.getX(i + 2) : i + 2;
    a.fromBufferAttribute(p, i0).applyMatrix4(m);
    b.fromBufferAttribute(p, i1).applyMatrix4(m);
    c.fromBufferAttribute(p, i2).applyMatrix4(m);
    s += b.sub(a).cross(c.sub(a)).length() / 2;
  }
  return s;
};

const discGeo = new THREE.CircleGeometry(0.09, 20);
const headMat = new THREE.MeshBasicMaterial({ color: new THREE.Color("#fff3d8").multiplyScalar(1.6), toneMapped: false, fog: false });
const tailMat = new THREE.MeshBasicMaterial({ color: new THREE.Color("#ff2414").multiplyScalar(1.25), toneMapped: false, fog: false });
const BEAM_LEN = 16;
// open cone, apex (r 0.09) at the origin, opening along -Z (the GLB front) to r 2.4; uv.y = 1 at the lamp
const beamGeo = (() => {
  const g = new THREE.CylinderGeometry(0.09, 2.4, BEAM_LEN, 28, 1, true);
  g.translate(0, -BEAM_LEN / 2, 0);
  g.rotateX(-Math.PI / 2 - 0.06); // -Y -> -Z, tipped ~3.4 degrees down
  return g;
})();
const beamMats = new Map<number, THREE.ShaderMaterial>();
const beamMat = (k: number) => {
  let m = beamMats.get(k);
  if (!m) {
    m = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: { uCol: { value: new THREE.Color("#fff0d0") }, uK: { value: k } },
      vertexShader: "varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv=uv; vec4 w=modelViewMatrix*vec4(position,1.); vN=normalize(normalMatrix*normal); vV=normalize(-w.xyz); gl_Position=projectionMatrix*w; }",
      fragmentShader: "uniform vec3 uCol; uniform float uK; varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ float e=pow(abs(dot(vN,vV)),1.5); float a=uK*e*pow(vUv.y,2.2)*smoothstep(1.0,0.97,vUv.y); gl_FragColor=vec4(uCol*a,1.); }",
    });
    beamMats.set(k, m);
  }
  return m;
};
const noInk = (o: THREE.Object3D) => {
  o.userData.outline = false;
  o.castShadow = false;
  o.receiveShadow = false;
};

const build = (id: string, g: GLTF): LoadedVehicle => {
  const scene = g.scene;
  const conv = new Map<THREE.Material, THREE.Material>();
  scene.traverse((o) => {
    const me = o as THREE.Mesh;
    if (!me.isMesh) return;
    me.castShadow = true;
    me.receiveShadow = true;
    const c = (m: THREE.Material) => {
      if (!conv.has(m)) {
        const t = toToon(m);
        srcOf.set(t, m);
        conv.set(m, t);
      }
      return conv.get(m)!;
    };
    me.material = Array.isArray(me.material) ? me.material.map(c) : c(me.material);
    if (me.userData.no_ink || me.parent?.userData.no_ink || NO_INK.test(me.name)) me.userData.outline = false;
  });
  scene.updateMatrixWorld(true);
  const { w, how } = findWheels(scene);

  const holder = new THREE.Group();
  holder.name = `vehicle:${id}`;
  const pivot = new THREE.Group();
  pivot.name = "bodyPivot";
  const body = new THREE.Group();
  body.name = "body";
  holder.add(pivot);
  pivot.add(body);
  holder.updateMatrixWorld(true);

  let wheels: LoadedVehicle["wheels"] = null;
  if (w) {
    wheels = {} as Record<WheelKey, { r: number; c: V3 }>;
    for (const k of WHEELS) {
      const b = box(w[k]);
      const c = b.getCenter(new THREE.Vector3());
      const s = b.getSize(new THREE.Vector3());
      wheels[k] = { r: s.y / 2, c: v3(c) };
      const wp = new THREE.Group();
      wp.name = `wheelPivot_${k}`;
      wp.position.copy(c);
      holder.add(wp);
      wp.updateMatrixWorld(true);
      wp.attach(w[k]); // keeps its world transform; leaves the body
    }
  }
  body.add(scene);
  holder.updateMatrixWorld(true);
  const bb = box(body);
  const size = bb.getSize(new THREE.Vector3());
  const wheelR = wheels ? WHEELS.reduce((s, k) => s + wheels![k].r, 0) / 4 : 0.33;
  const dims: VehicleDims = {
    length: size.z,
    width: size.x,
    height: bb.max.y,
    front: bb.min.z,
    rear: bb.max.z,
    wheelR,
    wheelbase: wheels ? (wheels.RL.c[2] + wheels.RR.c[2] - wheels.FL.c[2] - wheels.FR.c[2]) / 2 : size.z * 0.6,
  };
  // the body (and the lamps on it) roll / pitch about the point under the centre at axle height
  pivot.position.set(0, wheelR, 0);
  body.position.set(0, -wheelR, 0);

  // paint: the largest saturated body material that is not glass / tyre / trim
  const meshes: THREE.Mesh[] = [];
  body.traverse((o) => (o as THREE.Mesh).isMesh && meshes.push(o as THREE.Mesh));
  holder.updateMatrixWorld(true);
  const score = new Map<THREE.Material, number>();
  for (const me of meshes) {
    const m = me.material as THREE.Material;
    if (Array.isArray(me.material) || NOT_PAINT.test(m.name)) continue;
    const col = (m as THREE.MeshToonMaterial).color;
    const hsl = { h: 0, s: 0, l: 0 };
    col.getHSL(hsl);
    if (hsl.l < 0.03) continue;
    const k = (hsl.s > 0.2 ? 3 : 1) * ((m as THREE.MeshToonMaterial).map ? 0.5 : 1);
    score.set(m, (score.get(m) ?? 0) + k * triArea(me.geometry, me.matrixWorld));
  }
  let paint: THREE.Material | null = null;
  score.forEach((s, m) => {
    if (!paint || s > score.get(paint)!) paint = m;
  });

  // lamps: from materials named like headlights / taillights, else a ray onto the front / rear at 42 % of the height
  const side = (re: RegExp) => {
    const out: V3[] = [];
    for (const sgn of [-1, 1]) {
      const b = new THREE.Box3();
      for (const me of meshes) if (!Array.isArray(me.material) && re.test((me.material as THREE.Material).name)) {
        const mb = box(me);
        if ((mb.getCenter(new THREE.Vector3()).x < 0 ? -1 : 1) === sgn) b.union(mb);
      }
      if (!b.isEmpty()) out.push(v3(b.getCenter(new THREE.Vector3())));
    }
    return out.length === 2 ? out : null;
  };
  const ray = new THREE.Raycaster();
  const shoot = (front: boolean): V3[] =>
    [-1, 1].map((sgn) => {
      const x = sgn * dims.width * 0.3;
      const y = dims.height * 0.42;
      const z0 = front ? dims.front - 1 : dims.rear + 1;
      ray.set(new THREE.Vector3(x, y, z0), new THREE.Vector3(0, 0, front ? 1 : -1));
      const hit = ray.intersectObjects(meshes, false)[0];
      const z = hit ? hit.point.z : front ? dims.front : dims.rear;
      return [x, y, z + (front ? -0.015 : 0.015)] as V3;
    });
  const hm = side(HEAD_RE);
  const tm = side(TAIL_RE);
  const head = hm ?? shoot(true);
  const tail = tm ?? shoot(false);
  const lamps = new THREE.Group();
  lamps.name = "lamps";
  body.add(lamps);
  head.forEach((p, i) => {
    const d = new THREE.Mesh(discGeo, headMat);
    d.name = `lampHead_${i}`;
    d.position.set(...p);
    d.rotation.y = Math.PI; // the disc faces +Z: turn it to face the front (-Z)
    d.visible = !hm; // lamps found by material glow themselves
    noInk(d);
    lamps.add(d);
    const beam = new THREE.Mesh(beamGeo, beamMat(0.14));
    beam.name = `lampBeam_${i}`;
    beam.position.set(...p);
    beam.renderOrder = 3;
    noInk(beam);
    lamps.add(beam);
  });
  tail.forEach((p, i) => {
    const d = new THREE.Mesh(discGeo, tailMat);
    d.name = `lampTail_${i}`;
    d.position.set(...p);
    d.visible = !tm;
    noInk(d);
    lamps.add(d);
  });
  const rest = new Map<string, THREE.Vector3>();
  lamps.children.forEach((c) => rest.set(c.name, c.position.clone()));
  lampRest.set(id, rest);
  return { id, holder, dims, wheels, wheelHow: how, paint: paint ? (paint as THREE.Material).name : null, head, tail, lampHow: hm ? "materials" : "ray", steering: findSteering(scene) };
};
const lampRest = new Map<string, Map<string, THREE.Vector3>>();

export const vehicleKey = (id: string) => `vehicle:${id}`;
/** list in a shot's needs: loads public/vehicles/<id>.glb (toon materials, hierarchy kept, wheels found) */
export const needVehicle = (id: string): Need => [vehicleKey(id), () => loadGLB(`vehicles/${id}.glb`).then((g) => build(id, g))];
export const getVehicle = (id: string) => got<LoadedVehicle>(vehicleKey(id));
/** measured size, wheels, lamps and paint material of a loaded vehicle */
export const vehicleInfo = (id: string): Omit<LoadedVehicle, "holder"> => {
  const { holder: _h, ...rest } = getVehicle(id);
  void _h;
  return rest;
};

// ------------------------------------------------------------------ per-shot instances
type Inst = {
  obj: THREE.Group;
  /** meshes under body: original material and (after the first crumple) rest positions / normals of the own geometry */
  meshes: { me: THREE.Mesh; mat: THREE.Material | THREE.Material[]; rest?: Float32Array; restN?: Float32Array; M?: THREE.Matrix4; Mi?: THREE.Matrix4 }[];
  crumple: number;
  targets: THREE.Object3D[];
};
const MAX_INST = 16;
const insts = new Map<string, Inst>();
const instanceFor = (v: LoadedVehicle, shot: number, name: string): Inst => {
  const k = `${v.id}#${shot}#${name}`;
  let it = insts.get(k);
  if (it) insts.delete(k);
  else {
    const obj = v.holder.clone(true);
    const meshes: Inst["meshes"] = [];
    obj.getObjectByName("body")!.traverse((o) => {
      const me = o as THREE.Mesh;
      if (me.isMesh && me.parent?.name !== "lamps") meshes.push({ me, mat: me.material });
    });
    it = { obj, meshes, crumple: 0, targets: [new THREE.Object3D(), new THREE.Object3D()] };
  }
  insts.set(k, it);
  while (insts.size > MAX_INST) {
    const old = insts.keys().next().value as string;
    insts.get(old)!.meshes.forEach((m) => m.rest && m.me.geometry.dispose()); // own crumple copies only
    insts.delete(old);
  }
  return it;
};

const tinted = new Map<string, THREE.Material>();
const tintOf = (m: THREE.Material, color: string) => {
  const k = `${m.uuid}|${color}`;
  let t = tinted.get(k);
  if (!t) {
    const s = (srcOf.get(m) ?? m).clone() as THREE.MeshStandardMaterial;
    s.color = new THREE.Color(color);
    t = toToon(s);
    tinted.set(k, t);
  }
  return t;
};

const applyCrumple = (v: LoadedVehicle, it: Inst, c: number) => {
  if (Math.abs(c - it.crumple) < 1e-4) return;
  const body = it.obj.getObjectByName("body")!;
  const pivot = it.obj.getObjectByName("bodyPivot")!;
  const q = pivot.quaternion.clone();
  pivot.quaternion.identity();
  it.obj.updateMatrixWorld(true);
  const bodyInv = body.matrixWorld.clone().invert();
  for (const m of it.meshes) {
    const me = m.me;
    if (!m.rest) {
      if (c <= 0) continue;
      me.geometry = me.geometry.clone(); // this instance's own copy
      m.rest = Float32Array.from((me.geometry.attributes.position as THREE.BufferAttribute).array as ArrayLike<number>);
      const n = me.geometry.attributes.normal as THREE.BufferAttribute | undefined;
      m.restN = n ? Float32Array.from(n.array as ArrayLike<number>) : undefined;
      m.M = bodyInv.clone().multiply(me.matrixWorld); // mesh -> body (= GLB) frame
      m.Mi = m.M.clone().invert();
    }
    const pos = me.geometry.attributes.position as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    if (c <= 0) {
      arr.set(m.rest);
      if (m.restN && me.geometry.attributes.normal) ((me.geometry.attributes.normal as THREE.BufferAttribute).array as Float32Array).set(m.restN);
    } else {
      const p = new THREE.Vector3();
      for (let i = 0; i < arr.length; i += 3) {
        p.set(m.rest[i], m.rest[i + 1], m.rest[i + 2]).applyMatrix4(m.M!);
        const d = crumplePoint(v.dims, c, p.x, p.y, p.z);
        p.set(d[0], d[1], d[2]).applyMatrix4(m.Mi!);
        arr[i] = p.x;
        arr[i + 1] = p.y;
        arr[i + 2] = p.z;
      }
      if (me.geometry.attributes.normal) me.geometry.computeVertexNormals();
    }
    pos.needsUpdate = true;
    if (me.geometry.attributes.normal) (me.geometry.attributes.normal as THREE.BufferAttribute).needsUpdate = true;
    me.geometry.computeBoundingBox();
    me.geometry.computeBoundingSphere();
  }
  pivot.quaternion.copy(q);
  it.crumple = c;
};

export type VehicleLights = {
  /** visible SpotLight cones on the road: intensity in cd per lamp (default 180; 0 = none) */
  spot?: number;
  /** spot reach in m (default 60) */
  distance?: number;
  /** visible additive beam cones (fog / night): strength (default 0.14; 0 = none) */
  beams?: number;
  /** camera-facing glare halo per headlight: size in m (default 0.9; 0 = none) */
  halo?: number;
  /** red taillights (default true) */
  tail?: boolean;
};
export type VehicleProps = {
  id: string;
  /** ground contact centre (three coords) */
  at: V3;
  /** Stickman convention: 0 drives toward +Z; + turns left */
  yaw?: number;
  /** metres travelled (wheel spin = dist / wheel radius); a pure function of t in the shot */
  dist?: number;
  /** front wheel steer angle in rad (+ = LEFT, i.e. yaw increasing along the path; steerFor(R, wheelbase)); the
   *  steering-wheel node turns with it (x STEER_RATIO, counter-clockwise for the driver on a left turn) */
  steer?: number;
  /** steering-wheel angle in rad (+ = counter-clockwise seen by the driver); default steer x STEER_RATIO */
  wheel?: number;
  /** 0..1 front crush (deterministic) */
  crumple?: number;
  /** rad: + lowers the right side */
  bodyRoll?: number;
  /** rad: + lifts the nose */
  bodyPitch?: number;
  /** headlights on: true or options (emissive lamps + SpotLights + beams + halos) */
  lights?: boolean | VehicleLights;
  /** recolour the paint: a colour (the auto-picked paint material) or {color, material: name or regex} */
  tint?: string | { color: string; material: string | RegExp };
  /** instance name: two of the same vehicle in one shot need different names */
  name?: string;
  /** cast shadows (default true) */
  shadows?: boolean;
  /** named animatable nodes of the GLB (h67: b727 `stair` / `gear_nose` / `gear_L` / `gear_R`, heli `rotor` /
   *  `tailRotor` / `searchlight`): `rot` = XYZ euler (rad) applied on top of the node's rest rotation in its own
   *  frame, `pos` = metres added to its rest position (parent frame), `visible`; every frame starts from the rest pose */
  nodes?: Record<string, { rot?: V3; pos?: V3; visible?: boolean }>;
};

const nodeRests = new WeakMap<THREE.Object3D, Map<string, { o: THREE.Object3D; q: THREE.Quaternion; p: THREE.Vector3 }>>();
const applyNodes = (root: THREE.Object3D, nodes?: VehicleProps["nodes"]) => {
  let m = nodeRests.get(root);
  if (!m) { m = new Map(); nodeRests.set(root, m); }
  for (const r of m.values()) { r.o.quaternion.copy(r.q); r.o.position.copy(r.p); r.o.visible = true; }
  if (!nodes) return;
  for (const [name, n] of Object.entries(nodes)) {
    let r = m.get(name);
    if (!r) {
      const o = root.getObjectByName(name);
      if (!o) continue;
      r = { o, q: o.quaternion.clone(), p: o.position.clone() };
      m.set(name, r);
    }
    if (n.rot) r.o.quaternion.copy(r.q).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(n.rot[0], n.rot[1], n.rot[2], "XYZ")));
    if (n.pos) r.o.position.copy(r.p).add(new THREE.Vector3(n.pos[0], n.pos[1], n.pos[2]));
    if (n.visible !== undefined) r.o.visible = n.visible;
  }
};

/** a vehicle from public/vehicles/<id>.glb (list needVehicle(id) in the shot's needs) */
export const Vehicle: React.FC<VehicleProps> = (p) => {
  const v = getVehicle(p.id);
  const shot = React.useContext(ShotCtx);
  const it = instanceFor(v, shot, p.name ?? "0");
  const o = it.obj;
  const yaw = p.yaw ?? 0;
  o.position.set(...p.at);
  o.rotation.set(0, yaw + Math.PI, 0); // the GLB front is -Z; yaw 0 = drive toward +Z
  const c = Math.min(1, Math.max(0, p.crumple ?? 0));
  const pivot = o.getObjectByName("bodyPivot")!;
  pivot.quaternion.identity();
  applyCrumple(v, it, c);
  // body: pitch about the car's +X (nose = -Z goes up), roll about the forward axis (-Z): + lowers the right (+X) side
  pivot.quaternion
    .setFromAxisAngle(new THREE.Vector3(0, 0, -1), p.bodyRoll ?? 0)
    .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), p.bodyPitch ?? 0));
  // wheels: spin about the axle, front ones steered about +Y; front wheels follow the crumple
  if (v.wheels) {
    for (const k of WHEELS) {
      const wp = o.getObjectByName(`wheelPivot_${k}`)!;
      const W = v.wheels[k];
      const front = k[0] === "F";
      const cp = front ? crumplePoint(v.dims, c, W.c[0], W.c[1], W.c[2]) : W.c;
      wp.position.set(cp[0], W.c[1], cp[2]);
      wp.quaternion
        .setFromAxisAngle(new THREE.Vector3(0, 1, 0), front ? p.steer ?? 0 : 0)
        .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), wheelAngle(p.dist ?? 0, W.r)));
    }
  }
  // steering wheel: about its column axis from its rest rotation
  if (v.steering) {
    const sw = o.getObjectByName(v.steering.name);
    if (sw) {
      const r = v.steering.rest;
      sw.quaternion.setFromAxisAngle(new THREE.Vector3(...v.steering.axis), p.wheel ?? (p.steer ?? 0) * STEER_RATIO).multiply(new THREE.Quaternion(r[0], r[1], r[2], r[3]));
    }
  }
  applyNodes(o, p.nodes);
  // materials: tint, emissive lamps
  const L: Required<VehicleLights> & { on: boolean } = {
    on: !!p.lights,
    spot: 180,
    distance: 60,
    beams: 0.14,
    halo: 0.9,
    tail: true,
    ...(typeof p.lights === "object" ? p.lights : {}),
  };
  const tint = typeof p.tint === "string" ? { color: p.tint, material: v.paint ?? "(no paint material)" } : p.tint;
  const tre = tint ? (typeof tint.material === "string" ? new RegExp(`^${tint.material.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`) : tint.material) : null;
  const shadows = p.shadows ?? true;
  for (const m of it.meshes) {
    const swap = (x: THREE.Material) => {
      if (L.on && HEAD_RE.test(x.name)) return headMat;
      if (L.on && L.tail && TAIL_RE.test(x.name)) return tailMat;
      if (tint && tre && tre.test(x.name)) return tintOf(x, tint.color);
      return x;
    };
    m.me.material = Array.isArray(m.mat) ? m.mat.map(swap) : swap(m.mat);
    m.me.castShadow = shadows;
  }
  const lamps = o.getObjectByName("lamps")!;
  const rest = lampRest.get(v.id)!;
  lamps.children.forEach((ch) => {
    const r = rest.get(ch.name)!;
    const d = crumplePoint(v.dims, c, r.x, r.y, r.z);
    ch.position.set(d[0], d[1], d[2]);
    if (ch.name.startsWith("lampHead")) ch.visible = L.on && v.lampHow === "ray";
    if (ch.name.startsWith("lampTail")) ch.visible = L.on && L.tail && v.lampHow === "ray";
    if (ch.name.startsWith("lampBeam")) {
      ch.visible = L.on && L.beams > 0;
      (ch as THREE.Mesh).material = beamMat(Math.round(L.beams * 1000) / 1000);
    }
  });
  // world positions of the headlights (SpotLights, halos)
  o.updateMatrixWorld(true);
  const heads = lamps.children.filter((ch) => ch.name.startsWith("lampHead"));
  const fwd = new THREE.Vector3(0, -0.06, -1).normalize().transformDirection(lamps.matrixWorld);
  const wpos = heads.map((h) => h.getWorldPosition(new THREE.Vector3()));
  wpos.forEach((wp, i) => {
    const tg = it.targets[i];
    tg.position.copy(wp).addScaledVector(fwd, 20);
    tg.updateMatrixWorld();
  });
  return (
    <>
      <primitive object={o} />
      {L.on && L.halo > 0 ? wpos.map((w, i) => <Glow key={`h${i}`} at={[w.x + fwd.x * 0.05, w.y, w.z + fwd.z * 0.05]} size={L.halo} color="#fff2d6" strength={0.6} />) : null}
      {L.on && L.spot > 0
        ? wpos.map((w, i) => (
            <spotLight key={`s${i}`} position={[w.x, w.y, w.z]} target={it.targets[i]} color="#fff1d6" intensity={L.spot} distance={L.distance} decay={2} angle={0.42} penumbra={0.55} castShadow={false} />
          ))
        : null}
    </>
  );
};
