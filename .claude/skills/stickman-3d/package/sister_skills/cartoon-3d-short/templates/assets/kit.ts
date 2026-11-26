// Free CC0 3D models (Kenney Nature Kit, Poly Haven props, Quaternius horse) loaded as GLB and turned into the film's
// two-tone materials. Skinned models (the horse) are cloned with SkeletonUtils and driven by a deterministic AnimationMixer.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as skClone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { staticFile } from "remotion";
import { twoTone } from "./shade";

export type Asset = { scene: THREE.Object3D; anims: THREE.AnimationClip[] };
export type Kit = Record<string, Asset>;
const KENNEY = ["campfire_stones", "fence_gate", "fence_simple", "fence_simpleLow", "flower_redA", "flower_yellowA", "grass", "grass_large", "log", "log_large", "plant_bush",
  "plant_bushDetailed", "plant_bushLarge", "rock_largeA", "rock_largeB", "rock_tallA", "stone_largeA", "stone_tallA", "stump_old", "stump_round", "tent_detailedOpen",
  "tree_default", "tree_detailed", "tree_fat", "tree_oak", "tree_pineDefaultA", "tree_pineRoundA", "tree_pineTallA", "tree_tall", "tree_thin"];
const PH: [string, string][] = [["wooden_barrels_01", "wooden_barrels_01_1k.gltf"], ["barrel_03", "barrel_03_1k.gltf"], ["wooden_crate_01", "wooden_crate_01_1k.gltf"],
  ["wooden_crate_02", "wooden_crate_02_1k.gltf"], ["wooden_bucket_01", "wooden_bucket_01_1k.gltf"], ["wooden_lantern_01", "wooden_lantern_01_1k.gltf"],
  ["vintage_oil_lamp", "vintage_oil_lamp_1k.gltf"], ["painted_wooden_table", "painted_wooden_table_1k.gltf"], ["painted_wooden_chair_01", "painted_wooden_chair_01_1k.gltf"],
  ["painted_wooden_bench", "painted_wooden_bench_1k.gltf"], ["wooden_picnic_table", "wooden_picnic_table_1k.gltf"], ["round_wooden_table_01", "round_wooden_table_01_1k.gltf"],
  ["wooden_bookshelf_worn", "wooden_bookshelf_worn_1k.gltf"], ["wooden_display_shelves_01", "wooden_display_shelves_01_1k.gltf"], ["metal_office_desk", "metal_office_desk_1k.gltf"],
  ["CashRegister_01", "CashRegister_01_1k.gltf"], ["vintage_grandfather_clock_01", "vintage_grandfather_clock_01_1k.gltf"], ["treasure_chest", "treasure_chest_1k.gltf"],
  ["wooden_ladder", "wooden_ladder_1k.gltf"], ["wooden_broom", "wooden_broom_1k.gltf"], ["service_pistol", "service_pistol_1k.gltf"], ["folding_wooden_stool", "folding_wooden_stool_1k.gltf"],
  ["WoodenChair_01", "WoodenChair_01_1k.gltf"], ["WoodenTable_01", "WoodenTable_01_1k.gltf"], ["Lantern_01", "Lantern_01_1k.gltf"], ["barrel_stove", "barrel_stove_1k.gltf"],
  ["wooden_military_crate", "wooden_military_crate_1k.gltf"], ["Shelf_01", "Shelf_01_1k.gltf"]];
let kitP: Promise<Kit> | null = null;
export const loadKit = (): Promise<Kit> => {
  if (!kitP) {
    const loader = new GLTFLoader();
    const jobs: [string, string][] = [
      ...KENNEY.map((n) => [n, staticFile(`assets/kenney/${n}.glb`)] as [string, string]),
      ...PH.map(([id, f]) => [id, staticFile(`assets/ph/${id}/${f}`)] as [string, string]),
      ["horse", staticFile("assets/animals/horse.glb")],
    ];
    kitP = Promise.all(jobs.map(([n, url]) => loader.loadAsync(url).then((g) => [n, { scene: g.scene, anims: g.animations }] as const).catch((e) => { console.warn("asset failed", n, String(e).slice(0, 80)); return [n, null] as const; })))
      .then((list) => Object.fromEntries(list.filter((e) => e[1]).map(([n, a]) => [n, a!])) as Kit);
  }
  return kitP;
};

// recolour Kenney's teal nature palette by material name (storybook prairie greens / browns)
const LEAVES = ["#7fa83c", "#8fb04a", "#6f9a3a"];
const RECOLOR: Record<string, string> = { grass: "#9cae52", leafsDark: "#6f8f38", woodBark: "#8a5a3c", woodInner: "#e8cfa4", wood: "#a8724a", woodDark: "#7a4f33", dirt: "#8a6a4a", stone: "#b7b0a2" };
const cache = new Map<string, THREE.MeshLambertMaterial>();
export const toon = (m: THREE.Material, tint?: THREE.Color, over?: string): THREE.Material => {
  const key = m.uuid + (tint ? tint.getHexString() : "") + (over ?? "");
  let l = cache.get(key);
  if (!l) {
    const s = m as THREE.MeshStandardMaterial;
    const rc = m.name === "leafsGreen" ? LEAVES[cache.size % 3] : RECOLOR[m.name];
    const color = over ? new THREE.Color(over) : rc ? new THREE.Color(rc) : s.color ? s.color.clone() : new THREE.Color("#ffffff");
    if (tint) color.multiply(tint);
    l = twoTone(new THREE.MeshLambertMaterial({ color, map: s.map ?? null, side: s.side, alphaTest: s.alphaTest || 0, vertexColors: false }));
    cache.set(key, l);
  }
  return l;
};

export type Inst = { group: THREE.Group; mixer?: THREE.AnimationMixer; clips: Record<string, THREE.AnimationClip>; height: number };
/** clone `name` from the kit, scale to height h (metres), put its base on y = 0, optionally tint, two-tone materials */
export const instantiate = (kit: Kit, name: string, h: number, tint?: THREE.Color, recolor?: Record<string, string>): Inst | null => {
  const a = kit[name];
  if (!a) return null;
  const obj = skClone(a.scene);
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const ov = (x: THREE.Material) => toon(x, tint, recolor?.[x.name]);
    m.material = Array.isArray(m.material) ? m.material.map(ov) : ov(m.material);
    m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
  });
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj, true);
  const size = box.getSize(new THREE.Vector3()), s = h / Math.max(0.001, size.y);
  const g = new THREE.Group(), pivot = new THREE.Group();
  obj.scale.multiplyScalar(s);
  obj.updateMatrixWorld(true);
  const b2 = new THREE.Box3().setFromObject(obj, true), c = b2.getCenter(new THREE.Vector3());
  obj.position.set(-c.x, -b2.min.y, -c.z);
  pivot.add(obj); g.add(pivot);
  const clips: Record<string, THREE.AnimationClip> = {};
  for (const cl of a.anims) clips[cl.name.replace("AnimalArmature|", "")] = cl;
  const inst: Inst = { group: g, clips, height: h };
  if (a.anims.length) inst.mixer = new THREE.AnimationMixer(obj);
  return inst;
};
