// Moods for Blender-built sets. inkbeat's moods are tuned for its own procedural paint; Blender albedos are brighter and
// more saturated, so at inkbeat's light levels saturated colours clip to cream (the gold bell in the pilot). `forSet`
// rescales a mood to the levels that matched the Blender render (pilot shot 25: key ~1.7, hemi ~0.55) and points the
// key light along the set's exported sun. Night exteriors: `nightSet` (tuned on Grave Bell shot 6, _night3d test).
// Sunrise over snow: forSet("sunrise", sunDir(set)) (engine MOODS.sunrise, from the _gb3d Grave Bell ending).
import { mk, MOODS, moodOf } from "../engine/core/moods";
import type { MoodPreset } from "../engine/core/moods";
import type { V3 } from "../engine/types";
export { MOODS, moodOf };
export type { MoodPreset };

export type SetMoodOpts = {
  /** extra grade exposure (stops; default +0.15) */
  exposure?: number;
  /** fog density multiplier (default 0.5) */
  fog?: number;
  /** light multipliers (defaults = the day calibration: key 0.39, hemi 0.6, rim 0.45, fill 1.1, camFill 0.55) */
  key?: number;
  hemi?: number;
  rim?: number;
  fill?: number;
  camFill?: number;
  /** grade saturation multiplier (default 1.25; was 1.08 until 2026-11-19, which left films greyer than RicksClips: WORLD.md) */
  sat?: number;
  /** baked light (sets exported with --light): lightmap gain, how much hemisphere / unshadowed fill light stays, AO on
   *  the fills (engine/mat/materials BAKE_LOOK: 1 / 0.25 / 0.35 / 1) */
  bake?: { lmGain?: number; hemiKeep?: number; fillKeep?: number; aoFill?: number };
};

export const forSet = (m: MoodPreset | string, sun?: V3, o: SetMoodOpts = {}): MoodPreset => {
  const b = typeof m === "string" ? moodOf(m) : m;
  const L = b.lights;
  return {
    ...b,
    lights: {
      ...L,
      hemi: { ...L.hemi, intensity: L.hemi.intensity * (o.hemi ?? 0.6) },
      key: { ...L.key, intensity: L.key.intensity * (o.key ?? 0.39), dir: sun ?? L.key.dir, mapSize: 4096 },
      rim: { ...L.rim, intensity: L.rim.intensity * (o.rim ?? 0.45) },
      fill: { ...L.fill, intensity: L.fill.intensity * (o.fill ?? 1.1) },
    },
    toon: { ...b.toon, ...(o.bake ?? {}) },
    // the sky's sun / moon sit where the set's light really is (2026-11-19: the sky kept the mood's default sun, so a
    // front-lit set showed a cream halo + horizon glow in front of the lens and the day sky read pale lavender, WORLD.md 2)
    sky: sun ? { ...b.sky, sun: { ...b.sky.sun, dir: sun }, moon: { ...b.sky.moon, dir: sun } } : b.sky,
    fog: { ...b.fog, density: b.fog.density * (o.fog ?? 0.5) },
    camFill: { ...b.camFill, intensity: b.camFill.intensity * (o.camFill ?? 0.55) },
    post: {
      ...b.post,
      grade: { ...b.post.grade, exposure: b.post.grade.exposure + (o.exposure ?? 0.15), saturation: b.post.grade.saturation * (o.sat ?? 1.25) },
    },
  };
};

const NIGHT_BASE = mk({
  note: "night on a Blender set: luminous ultramarine, warm windows",
  hemi: ["#4656d8", "#241e50", 0.3],
  key: ["#a0b0ff", 2.1, [-0.35, 0.75, -0.55]],
  rim: ["#d8e0ff", 0.9, [0.6, 0.45, -0.7]],
  fill: ["#5a6af0", 0.5, [0.1, 0.45, 1.0]],
  prac: ["#ffb050", 7, "#ffd890"],
  fog: ["#1a2680", 0.035],
  sky: {
    top: "#0a1250", mid: "#152276", bottom: "#24349c", cloudColor: "#1d2a80", cloudLit: "#5a6ad8", clouds: 0.2, stars: 0.35, rays: 0, horizon: 0.12,
    brush: 0.04, sun: { dir: [-0.6, 0.12, -1], color: "#ffd9a0", size: 7 }, sunOn: 0, moon: { dir: [-0.35, 0.55, -1], color: "#e6eaff", size: 3 }, moonOn: 0.9,
  },
  toon: { shadowTint: [0.86, 0.9, 1.12], hiTint: [0.98, 1.0, 1.04], rimColor: "#cdd6ff" },
  grade: { exposure: -0.55, contrast: 1.08, saturation: 1.25, shadowTint: "#2a3aa8", highlightTint: "#ffe6c0", gain: "#eef0ff" },
  bloomTint: "#ffd090",
  ink: "#0a0c2a",
  camFill: ["#9aa8ff", 0.25],
  cast: { rim: ["#d8e0ff", 1.8], fill: ["#ffc890", 0.6] },
});
/** NIGHT on a Blender set (LOOK.md: luminous ultramarine, never murky; unlit faces L* 25-35, big dark planes >= L* 15).
 *  Blue moon key + a strong blue fill from the lens side (the Blender set's 2200 W area fill), violet ground bounce,
 *  ultramarine distance haze (FogExp2 0.035: ~22 % at 14 m, ~50 % at 25 m, ~95 % at 50 m), navy sky with moon, stars and
 *  lit clouds (on since 2026-11-19, WORLD.md; pass a custom sky to turn them off), warm windows that bloom (bloom
 *  threshold 0.9: emissive windows glow, snow does not). Values are final: nightSet does not rescale them. */
export const NIGHT_SET: MoodPreset = {
  ...NIGHT_BASE,
  post: {
    ...NIGHT_BASE.post,
    bloom: { ...NIGHT_BASE.post.bloom, threshold: 0.9, strength: 0.75 },
    vignette: { amount: 0.3, softness: 0.8, color: "#1a1f6a" },
    grade: { ...NIGHT_BASE.post.grade, lift: "#1c2050" },
  },
};

/** night pointed along the set's exported moon (`sunDir(set)`); o.exposure / o.fog / light multipliers adjust it */
export const nightSet = (moon?: V3, o: SetMoodOpts = {}): MoodPreset =>
  forSet(NIGHT_SET, moon, { key: 1, hemi: 1, rim: 1, fill: 1, camFill: 1, fog: 1, exposure: 0, sat: 1, ...o });

// ------------------------------------------------------------------ round 2: REAL night (WORLD2, 2026-11-21)
// User note 17: "dark blue / moonlit with contrast and darks, not one flat bright blue". NIGHT_SET is luminous
// ultramarine (LOOK.md's old target); nightReal is a moonlit night: a cold moon KEY that carves form (lit side vs dark
// side), weak ambient + fill so the unlit side really goes dark, a desaturated deep-navy haze, crushed (near-black)
// lift, more contrast, warm practicals that bloom. Pair it with <NightSky/> (world/nightSky.tsx) and sky={false}.
const NIGHT_REAL_BASE = mk({
  note: "real moonlit night: deep navy, real darks, cold moon key, warm practicals",
  hemi: ["#3d5ab8", "#1a2034", 0.75],
  key: ["#b4c4ff", 2.8, [-0.35, 0.75, -0.55]],
  rim: ["#c8d6ff", 0.9, [0.6, 0.45, -0.7]],
  fill: ["#3a4c90", 0.6, [0.1, 0.45, 1.0]],
  prac: ["#ffa848", 8, "#ffd890"],
  fog: ["#18234a", 0.03],
  sky: {
    top: "#03060f", mid: "#08102a", bottom: "#101c40", cloudColor: "#0c1430", cloudLit: "#3a4a7a", clouds: 0.2, stars: 0.5, rays: 0, horizon: 0.1,
    brush: 0.02, sun: { dir: [-0.6, 0.12, -1], color: "#ffd9a0", size: 7 }, sunOn: 0, moon: { dir: [-0.35, 0.55, -1], color: "#eef0ff", size: 2.4 }, moonOn: 1,
  },
  toon: { shadowTint: [0.8, 0.86, 1.12], hiTint: [0.98, 1.0, 1.05], rimColor: "#c8d4ff" },
  grade: { exposure: 0.1, contrast: 1.12, saturation: 0.88, shadowTint: "#1c2a58", highlightTint: "#ffe2b8", gain: "#e6ecff" },
  bloomTint: "#ffc070",
  ink: "#05060f",
  camFill: ["#9aaae0", 0.4],
  cast: { rim: ["#c8d6ff", 1.9], fill: ["#ffb878", 0.5] },
});
export const NIGHT_REAL: MoodPreset = {
  ...NIGHT_REAL_BASE,
  post: {
    ...NIGHT_REAL_BASE.post,
    bloom: { ...NIGHT_REAL_BASE.post.bloom, threshold: 1.6, strength: 0.3, radiusPx: 24 },
    vignette: { amount: 0.3, softness: 0.8, color: "#02040c" },
    grade: { ...NIGHT_REAL_BASE.post.grade, lift: "#121a33", splitAmount: 0.14 },
  },
};
/** REAL moonlit night along the set's moon (`sunDir(set)`): use with <NightSky/> and View sky={false}. o.* adjust it
 *  (o.exposure +0.1..0.3 when a shot reads too dark; o.fog for aerial sets: nightsky ~0.08, woods ~0.6). */
export const nightReal = (moon?: V3, o: SetMoodOpts = {}): MoodPreset =>
  forSet(NIGHT_REAL, moon, { key: 1, hemi: 1, rim: 1, fill: 1, camFill: 1, fog: 1, exposure: 0, sat: 1, ...o });

// Cabin at night (cabin:night state): the cabin lights are OFF; the light is the aisle strip / ceiling pools along the
// walking path, the reading lights, the galley + EXIT glow (all baked + <SetLights/>). Ambient is a faint cold blue
// (moonlight through the windows), the grade crushes the darks, the warm pools bloom.
const CABIN_NIGHT_BASE = mk({
  note: "cabin at night: blue-black, warm aisle pools + reading lights only",
  hemi: ["#3a4880", "#14141e", 0.4],
  key: ["#7f90d0", 0.6, [-0.6, 0.75, -0.3]],
  rim: ["#ffd0a0", 0.15, [0.2, 0.8, 0.6]],
  fill: ["#6070b0", 0.05, [0.0, 1.0, 0.2]],
  prac: ["#ffb060", 8, "#ffe0a8"],
  fog: ["#05070f", 0.03],
  sky: NIGHT_REAL_BASE.sky,
  toon: { shadowTint: [0.78, 0.84, 1.15], hiTint: [1.06, 1.0, 0.92], rimColor: "#ffd8b0" },
  grade: { exposure: 0.15, contrast: 1.12, saturation: 0.92, shadowTint: "#0c1438", highlightTint: "#ffd8a8", gain: "#f4f0ff" },
  bloomTint: "#ffc070",
  ink: "#07060c",
  camFill: ["#8a9ad8", 0.06],
  cast: { rim: ["#ffd0a0", 1.2], fill: ["#6a7ab8", 0.3] },
});
export const CABIN_NIGHT: MoodPreset = {
  ...CABIN_NIGHT_BASE,
  post: {
    ...CABIN_NIGHT_BASE.post,
    bloom: { ...CABIN_NIGHT_BASE.post.bloom, threshold: 0.75, strength: 0.9 },
    vignette: { amount: 0.38, softness: 0.75, color: "#05040a" },
    grade: { ...CABIN_NIGHT_BASE.post.grade, lift: "#100e16", splitAmount: 0.14 },
  },
};
/** cabin:night mood: View mood={cabinNight(sunDir(set))} sky={false} + <SetLights set={set} /> (the pools on people) */
export const cabinNight = (moon?: V3, o: SetMoodOpts = {}): MoodPreset =>
  forSet(CABIN_NIGHT, moon, { key: 1, hemi: 1, rim: 1, fill: 1, camFill: 1, fog: 1, exposure: 0, sat: 1, ...o });

/** woods under the canopy (WORLD2): the canopy shadows the moon key, so the forest floor needs more sky ambient + fill
 *  to read (still dark, cold); use instead of nightReal(sun, {fog: 0.6}) in S26-S28. o.* adjust on top. */
export const nightWoods = (moon?: V3, o: SetMoodOpts = {}): MoodPreset =>
  nightReal(moon, { fog: 0.5, hemi: 10, fill: 6, camFill: 3, exposure: 0.6, ...o });
