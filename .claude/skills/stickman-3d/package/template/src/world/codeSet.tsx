// CODE-BUILT SETS IN ONE LOOK (2026-11-24). Sets drawn in code with the engine kit (no Blender), styled so they belong
// with the flat inked stickmen:
//   - one PALETTE per place: a dominant hue for the big surfaces, ONE accent, a wood and a cream; every prop takes its
//     colours from it (books are 3 tones of the dominant + the accent + cream, never a rainbow);
//   - simple, chunky shapes with small bevels-free boxes and few objects (house rule: simple sets, few objects);
//   - ink outlines on the set too (`SET_VIEW.setInk`), so set and figures share one line;
//   - the cast's clothes come from the palette's `cast` pair, so people pop against the room without clashing.
// Use: const pal = PALETTES.library; <View {...SET_VIEW} mood={moodFor(pal)} ...><Room pal={pal} /><Shelf pal={pal} ... />
import React from "react";
import { boxG, coreMat, cylG, Label, M, sphG, torG } from "../engine/core/kit";
import type { V3 } from "../engine/types";
import { forSet } from "./moods";

export type Palette = {
  name: string;
  /** big surfaces: back wall, side walls, floor */
  wall: string;
  wall2: string;
  floor: string;
  /** furniture */
  wood: string;
  woodDark: string;
  /** the one accent (a lamp shade, a poster, one book in five) */
  accent: string;
  cream: string;
  /** 3 tones of the dominant hue for many small things (books, files, cushions) */
  tones: [string, string, string];
  /** two clothing colours that sit well in this room (hero, partner) */
  cast: [string, string];
  /** the light: an engine mood name and its sun direction */
  mood: string;
  sun: V3;
};
export const PALETTES: Record<string, Palette> = {
  library: { name: "library", wall: "#5a3d2e", wall2: "#e8dcc4", floor: "#3e6b60", wood: "#9a6a3c", woodDark: "#5e3f2a",
    accent: "#e0a02e", cream: "#efe6d2", tones: ["#1f7a8c", "#3fa0a8", "#8fd0c4"], cast: ["#c45a4a", "#d98fa0"], mood: "day", sun: [0.45, 0.7, 0.55] },
  classroom: { name: "classroom", wall: "#d8e4dc", wall2: "#c4d6cc", floor: "#8a7f76", wood: "#b9824a", woodDark: "#7a5236",
    accent: "#e0663a", cream: "#f4ede0", tones: ["#3f6f8f", "#6a94ad", "#b8cfdb"], cast: ["#2e8a86", "#d6a137"], mood: "day", sun: [0.5, 0.7, 0.5] },
  cafe: { name: "cafe", wall: "#e9d2b4", wall2: "#d8bc98", floor: "#6b4b3b", wood: "#8a5a32", woodDark: "#4a3327",
    accent: "#2e8a86", cream: "#f6efe0", tones: ["#b0503c", "#c97a5a", "#e6b89a"], cast: ["#3d5fbf", "#7c9868"], mood: "golden", sun: [0.6, 0.5, 0.4] },
  dorm: { name: "dorm", wall: "#c9c2e6", wall2: "#b6aedb", floor: "#7a6a5c", wood: "#a87a4e", woodDark: "#6e4e36",
    accent: "#e6a12c", cream: "#f4ede0", tones: ["#5d5aa8", "#8a86c8", "#d8d4f0"], cast: ["#2e8a86", "#c94a3a"], mood: "lamp", sun: [0.3, 0.6, 0.6] },
  // wood-panelled car (a steel one measured grey) with a brass rail
  elevator: { name: "elevator", wall: "#b47c48", wall2: "#a06c3e", floor: "#4f4a46", wood: "#d6b46a", woodDark: "#5e3f2a",
    accent: "#e0663a", cream: "#f2ece0", tones: ["#5d7f8f", "#86a3b0", "#c3d3da"], cast: ["#2e6f9a", "#c94a6a"], mood: "day", sun: [0.3, 0.9, 0.4] },
  // (a cream meeting room measured saturation 12.5, all "grey seconds": walls carry the colour)
  meeting: { name: "meeting", wall: "#8fcbbd", wall2: "#78b8a9", floor: "#3f5f73", wood: "#a8703c", woodDark: "#5e3f2a",
    accent: "#e6a12c", cream: "#f6f1e6", tones: ["#3d5fbf", "#6a86d0", "#b8c6ec"], cast: ["#2e6f9a", "#6b4b8a"], mood: "day", sun: [0.5, 0.7, 0.5] },
  homeWarm: { name: "homeWarm", wall: "#f0c9a0", wall2: "#e2b688", floor: "#7a5a44", wood: "#a87a4e", woodDark: "#6e4e36",
    accent: "#2e8a86", cream: "#f6efe0", tones: ["#c96a4a", "#e09a6a", "#f2cfa8"], cast: ["#2e6f9a", "#7c9868"], mood: "golden", sun: [0.6, 0.6, 0.5] },
  homeCool: { name: "homeCool", wall: "#bfd8e6", wall2: "#a9c8d9", floor: "#8a7f76", wood: "#b9824a", woodDark: "#7a5236",
    accent: "#e0663a", cream: "#f6efe0", tones: ["#5d7fae", "#8aa6cf", "#d0dcef"], cast: ["#6b4b8a", "#d6a137"], mood: "day", sun: [0.4, 0.7, 0.6] },
  office: { name: "office", wall: "#9fd2c4", wall2: "#86bfb0", floor: "#3f5f73", wood: "#34466e", woodDark: "#26344f",
    accent: "#d6a137", cream: "#f6efe0", tones: ["#2e6f7a", "#5a9aa0", "#bfe0d8"], cast: ["#b0503c", "#d6a137"], mood: "day", sun: [0.45, 0.7, 0.55] },
  // ten more places (2026-11-25, films 78-87): one wall hue each, none of them blue (the hero wears blue)
  interview: { name: "interview", wall: "#c6b8e6", wall2: "#b2a2d8", floor: "#5b5470", wood: "#b9824a", woodDark: "#7a5236",
    accent: "#e6a12c", cream: "#f6f1e6", tones: ["#6a56a8", "#9484c8", "#d6cef0"], cast: ["#2e6f9a", "#c94a6a"], mood: "day", sun: [0.5, 0.7, 0.5] },
  living: { name: "living", wall: "#a9cf9f", wall2: "#93bd89", floor: "#7a5a44", wood: "#a87a4e", woodDark: "#6e4e36",
    accent: "#e0663a", cream: "#f6efe0", tones: ["#3f7f5a", "#6aa684", "#c4e0c8"], cast: ["#2e6f9a", "#d6a137"], mood: "day", sun: [0.55, 0.65, 0.5] },
  lobby: { name: "lobby", wall: "#f0a48f", wall2: "#e08e78", floor: "#4f5a6e", wood: "#a8703c", woodDark: "#5e3f2a",
    accent: "#2e8a86", cream: "#f8efe4", tones: ["#b0503c", "#d07a64", "#f4cdbf"], cast: ["#2e6f9a", "#3f7f5a"], mood: "day", sun: [0.4, 0.7, 0.55] },
  butter: { name: "butter", wall: "#f2d680", wall2: "#e6c566", floor: "#55616e", wood: "#a8703c", woodDark: "#5e3f2a",
    accent: "#d8402f", cream: "#fbf5e4", tones: ["#b98a1e", "#d8b24a", "#f4e2a8"], cast: ["#2e6f9a", "#3f8f5a"], mood: "day", sun: [0.5, 0.7, 0.5] },
  kitchen: { name: "kitchen", wall: "#f2b6c4", wall2: "#e59fb0", floor: "#6a5a66", wood: "#b9824a", woodDark: "#7a5236",
    accent: "#2e8a86", cream: "#fbf2ee", tones: ["#b0506a", "#d0809a", "#f6d2dc"], cast: ["#2e6f9a", "#d6a137"], mood: "day", sun: [0.45, 0.7, 0.55] },
  aqua: { name: "aqua", wall: "#7fd0cf", wall2: "#68bfbe", floor: "#4a4f66", wood: "#b9824a", woodDark: "#7a5236",
    accent: "#e0663a", cream: "#f6f4ea", tones: ["#1f7a8c", "#4fa6b4", "#bfe6e8"], cast: ["#2e6f9a", "#c94a6a"], mood: "day", sun: [0.5, 0.7, 0.5] },
  hall: { name: "hall", wall: "#e8c89a", wall2: "#d9b684", floor: "#6b5a4e", wood: "#8a5a32", woodDark: "#4a3327",
    accent: "#2e8a86", cream: "#f8f0de", tones: ["#b0763c", "#cf9c62", "#f0d8b4"], cast: ["#2e6f9a", "#7c5ab0"], mood: "golden", sun: [0.6, 0.6, 0.5] },
  lime: { name: "lime", wall: "#cfe08a", wall2: "#bcd074", floor: "#5a5f52", wood: "#b9824a", woodDark: "#7a5236",
    accent: "#e0663a", cream: "#fafae8", tones: ["#6f8f2e", "#9ab654", "#e2efb4"], cast: ["#2e6f9a", "#c94a6a"], mood: "day", sun: [0.45, 0.7, 0.55] },
  mauve: { name: "mauve", wall: "#d0a0b8", wall2: "#bf8ca6", floor: "#4f4a5a", wood: "#a8703c", woodDark: "#5e3f2a",
    accent: "#e6a12c", cream: "#f8eef2", tones: ["#8a4a6e", "#b07a98", "#ecd0de"], cast: ["#2e6f9a", "#3f8f5a"], mood: "day", sun: [0.4, 0.7, 0.55] },
  apricot: { name: "apricot", wall: "#f5b56b", wall2: "#e8a356", floor: "#56506a", wood: "#8a5a32", woodDark: "#4a3327",
    accent: "#2e8a86", cream: "#fbf2e0", tones: ["#c0701e", "#dc964a", "#f8dcb0"], cast: ["#2e6f9a", "#7c5ab0"], mood: "day", sun: [0.5, 0.7, 0.5] },
  // ten scene places (2026-11-25, films 98-107): streets, a night road, back rooms. The dark ones use the
  // lamp mood; white heads and the overlay cards read best on them.
  bank: { name: "bank", wall: "#e0b97a", wall2: "#cfa765", floor: "#6b6f7a", wood: "#7a5236", woodDark: "#4a3327",
    accent: "#2e8a86", cream: "#f6efe0", tones: ["#8a6a3a", "#b8935a", "#e6d2a8"], cast: ["#2e6f9a", "#4a4f5c"], mood: "day", sun: [0.5, 0.7, 0.5] },
  nightroad: { name: "nightroad", wall: "#2c3e66", wall2: "#24335a", floor: "#3a3d46", wood: "#5a6a8a", woodDark: "#1f2a44",
    accent: "#e6a12c", cream: "#f2ece0", tones: ["#3d5fbf", "#6a86d0", "#b8c6ec"], cast: ["#2e6f9a", "#26344f"], mood: "lamp", sun: [0.3, 0.6, 0.6] },
  interro: { name: "interro", wall: "#5f7a70", wall2: "#506a60", floor: "#3c4244", wood: "#8a8f96", woodDark: "#5a5f66",
    accent: "#e6a12c", cream: "#f2ece0", tones: ["#3f5a52", "#6f8a80", "#b8cfc6"], cast: ["#2e6f9a", "#6a5a44"], mood: "lamp", sun: [0.2, 0.9, 0.4] },
  bazaar: { name: "bazaar", wall: "#e2a06a", wall2: "#d08c56", floor: "#b89a78", wood: "#8a5a32", woodDark: "#5e3f2a",
    accent: "#2e8a86", cream: "#f8f0de", tones: ["#b0503c", "#d6a137", "#f2cfa8"], cast: ["#2e6f9a", "#2e8a86"], mood: "golden", sun: [0.6, 0.6, 0.5] },
  tycoon: { name: "tycoon", wall: "#3f6b58", wall2: "#345c4a", floor: "#5a3f2e", wood: "#7a4a2a", woodDark: "#4a2c1a",
    accent: "#d6a137", cream: "#f6efe0", tones: ["#2f5a48", "#5a8a74", "#b8d6c8"], cast: ["#2e6f9a", "#e8dcc4"], mood: "day", sun: [0.5, 0.7, 0.5] },
  stage: { name: "stage", wall: "#2f3558", wall2: "#262c4a", floor: "#1f2238", wood: "#3b4270", woodDark: "#262c4a",
    accent: "#e6a12c", cream: "#f2ece0", tones: ["#4a5290", "#7a82c0", "#c8ccec"], cast: ["#2e6f9a", "#c94a6a"], mood: "lamp", sun: [0.3, 0.8, 0.5] },
  hotel: { name: "hotel", wall: "#b8566a", wall2: "#a4485c", floor: "#5a3a44", wood: "#7a4a2a", woodDark: "#4a2c1a",
    accent: "#d6a137", cream: "#f8efe4", tones: ["#8a3a4c", "#c07a8a", "#f0d0d8"], cast: ["#2e6f9a", "#26344f"], mood: "day", sun: [0.45, 0.7, 0.55] },
  dining: { name: "dining", wall: "#b5654a", wall2: "#a05840", floor: "#5e4636", wood: "#a8703c", woodDark: "#6e4e36",
    accent: "#2e8a86", cream: "#f6efe0", tones: ["#8a4a34", "#c88a6a", "#f0d0bc"], cast: ["#2e6f9a", "#4a6a4a"], mood: "golden", sun: [0.6, 0.6, 0.5] },
  bar: { name: "bar", wall: "#5a2f3a", wall2: "#4a2530", floor: "#2e2a30", wood: "#8a5a32", woodDark: "#4a3327",
    accent: "#e6a12c", cream: "#f2ece0", tones: ["#7a3a4a", "#b06a7a", "#e8c8d0"], cast: ["#2e6f9a", "#7a2f2f"], mood: "lamp", sun: [0.3, 0.8, 0.5] },
  // ten more scene places (2026-11-25, films 108-117). park and carlot are outdoors: the "wall" is the sky.
  club: { name: "club", wall: "#7a3b32", wall2: "#6a3129", floor: "#2e2630", wood: "#5a3a2a", woodDark: "#33211a",
    accent: "#e6a12c", cream: "#f2ece0", tones: ["#8a4a3a", "#b87a66", "#e8c8b8"], cast: ["#2e6f9a", "#4a6a4a"], mood: "lamp", sun: [0.3, 0.8, 0.5] },
  court: { name: "court", wall: "#9a6a44", wall2: "#885a38", floor: "#4a5568", wood: "#6e4428", woodDark: "#4a2c1a",
    accent: "#d6a137", cream: "#f6efe0", tones: ["#7a4e2e", "#b88a5e", "#e8d2b0"], cast: ["#2e6f9a", "#1f2230"], mood: "day", sun: [0.45, 0.7, 0.55] },
  school: { name: "school", wall: "#f0e4c4", wall2: "#e2d4b0", floor: "#8a8f96", wood: "#3f8a9a", woodDark: "#2c6a78",
    accent: "#e0483c", cream: "#fbf6ea", tones: ["#3f8a9a", "#6fb0bd", "#bfe0e6"], cast: ["#2e6f9a", "#b0503c"], mood: "day", sun: [0.5, 0.7, 0.5] },
  park: { name: "park", wall: "#8fcbe8", wall2: "#80bfde", floor: "#6fae5a", wood: "#9a6a3c", woodDark: "#5e3f2a",
    accent: "#e6a12c", cream: "#fbf6ea", tones: ["#4f8f4a", "#7fb86a", "#c8e6b0"], cast: ["#2e6f9a", "#c94a6a"], mood: "day", sun: [0.5, 0.7, 0.5] },
  carlot: { name: "carlot", wall: "#f2c890", wall2: "#e8b878", floor: "#6b6f7a", wood: "#8a8f96", woodDark: "#4a4f57",
    accent: "#e0483c", cream: "#fbf6ea", tones: ["#c94a3a", "#3d6fbf", "#f2d024"], cast: ["#2e6f9a", "#f6efe0"], mood: "golden", sun: [0.6, 0.6, 0.5] },
  gym: { name: "gym", wall: "#4a5a78", wall2: "#3f4e6a", floor: "#2e3038", wood: "#e6a12c", woodDark: "#33384a",
    accent: "#e6a12c", cream: "#f2ece0", tones: ["#33384a", "#6a7a9a", "#c0cce0"], cast: ["#2e6f9a", "#e6a12c"], mood: "day", sun: [0.45, 0.7, 0.55] },
  clubdoor: { name: "clubdoor", wall: "#7658a8", wall2: "#66499a", floor: "#565266", wood: "#5a4a7a", woodDark: "#241a36",
    accent: "#ff5fa2", cream: "#f2ece0", tones: ["#5a3f8a", "#8a6fc0", "#d0c0ec"], cast: ["#2e6f9a", "#1f2230"], mood: "lamp", sun: [0.3, 0.6, 0.6] },
  pageant: { name: "pageant", wall: "#7a2f6a", wall2: "#6a285c", floor: "#3a1f3f", wood: "#b0508a", woodDark: "#4a1f44",
    accent: "#f2c230", cream: "#fbf2ee", tones: ["#9a3f86", "#c878b4", "#f0c8e2"], cast: ["#2e6f9a", "#f2c230"], mood: "lamp", sun: [0.3, 0.8, 0.5] },
  vault: { name: "vault", wall: "#7f8a94", wall2: "#707a84", floor: "#454a52", wood: "#9aa2aa", woodDark: "#5a6068",
    accent: "#e0483c", cream: "#f2ece0", tones: ["#5a646e", "#8a949e", "#c8d0d8"], cast: ["#2e6f9a", "#3f7f5a"], mood: "day", sun: [0.3, 0.8, 0.5] },
  // thirteen more places (2026-11-26, films 118-137)
  polygraph: { name: "polygraph", wall: "#9ab8a0", wall2: "#88a88e", floor: "#4a5450", wood: "#8a8f96", woodDark: "#4a4f57",
    accent: "#e0483c", cream: "#f2ece0", tones: ["#4f6f5a", "#7fa08a", "#c8dccc"], cast: ["#2e6f9a", "#3f7f5a"], mood: "day", sun: [0.4, 0.75, 0.5] },
  cave: { name: "cave", wall: "#d8935a", wall2: "#c88248", floor: "#b08a5a", wood: "#8a5a32", woodDark: "#5e3f2a",
    accent: "#f2c230", cream: "#f6efe0", tones: ["#a8642e", "#d6a137", "#f2d890"], cast: ["#2e6f9a", "#35c9c0"], mood: "golden", sun: [0.5, 0.65, 0.55] },
  cockpit: { name: "cockpit", wall: "#d0c0a0", wall2: "#c0b090", floor: "#5a5f66", wood: "#6a7078", woodDark: "#3a3f47",
    accent: "#e0483c", cream: "#f2ece0", tones: ["#4a4f57", "#8a8f96", "#c8ccd2"], cast: ["#2e6f9a", "#f2ece0"], mood: "day", sun: [0.4, 0.8, 0.5] },
  cypher: { name: "cypher", wall: "#c8553c", wall2: "#b84a34", floor: "#4a4650", wood: "#8a8f96", woodDark: "#2b2d35",
    accent: "#f2c230", cream: "#f6efe0", tones: ["#2e8a86", "#f2c230", "#f6efe0"], cast: ["#2e6f9a", "#2b2d35"], mood: "day", sun: [0.5, 0.7, 0.5] },
  pitch: { name: "pitch", wall: "#8474c0", wall2: "#7464b0", floor: "#4f9a4a", wood: "#f2f2ee", woodDark: "#5a5f66",
    accent: "#f2d024", cream: "#f6f6f2", tones: ["#e0483c", "#f2d024", "#f6f6f2"], cast: ["#2e6f9a", "#f2d024"], mood: "day", sun: [0.45, 0.75, 0.5] },
  casino: { name: "casino", wall: "#3a9a8a", wall2: "#2f8a7a", floor: "#5a2f3a", wood: "#7a4a2a", woodDark: "#4a2c1a",
    accent: "#f2c230", cream: "#f6efe0", tones: ["#c9304a", "#2b2d35", "#f6efe0"], cast: ["#2e6f9a", "#c9304a"], mood: "day", sun: [0.3, 0.8, 0.5] },
  garage: { name: "garage", wall: "#a8b8c0", wall2: "#98a8b0", floor: "#6a6a6e", wood: "#a87a4e", woodDark: "#5e3f2a",
    accent: "#e0483c", cream: "#f2ece0", tones: ["#e0663a", "#5a6a72", "#d0d8dc"], cast: ["#2e6f9a", "#7c5a3a"], mood: "day", sun: [0.5, 0.7, 0.5] },
  beach: { name: "beach", wall: "#f59a7a", wall2: "#f0aa84", floor: "#e8c98a", wood: "#9a6a3c", woodDark: "#5e3f2a",
    accent: "#ffe08a", cream: "#fbf6ea", tones: ["#3f8fa8", "#5fb0c0", "#bfe0e6"], cast: ["#2e6f9a", "#2e8a86"], mood: "golden", sun: [0.3, 0.5, 0.6] },
  premiere: { name: "premiere", wall: "#e85a8a", wall2: "#d84a7a", floor: "#8a2f3a", wood: "#d6a137", woodDark: "#7a5a1a",
    accent: "#f2c230", cream: "#fbf2ee", tones: ["#b02a3a", "#f2c230", "#fbe0ea"], cast: ["#2e6f9a", "#f2c230"], mood: "day", sun: [0.4, 0.75, 0.5] },
  awards: { name: "awards", wall: "#d8a030", wall2: "#c89024", floor: "#4a3020", wood: "#7a4a2a", woodDark: "#4a2c1a",
    accent: "#f6e08a", cream: "#fbf6ea", tones: ["#c08a20", "#e8b848", "#f6e0a0"], cast: ["#2e6f9a", "#7a2f6a"], mood: "day", sun: [0.3, 0.8, 0.5] },
  cabin: { name: "cabin", wall: "#f2dcb8", wall2: "#e6cca4", floor: "#5a5f72", wood: "#2e8a86", woodDark: "#1f6a66",
    accent: "#e0663a", cream: "#fbf6ea", tones: ["#2e8a86", "#5fb0a8", "#c8e6e0"], cast: ["#2e6f9a", "#b0503c"], mood: "day", sun: [0.4, 0.8, 0.5] },
  ship: { name: "ship", wall: "#7fd6c8", wall2: "#6fc8ba", floor: "#9a6a3c", wood: "#8a5a32", woodDark: "#5e3f2a",
    accent: "#e0483c", cream: "#f6efe0", tones: ["#2f8a9a", "#5fb8c0", "#d8f0ec"], cast: ["#2e6f9a", "#8a2f2f"], mood: "day", sun: [0.5, 0.7, 0.5] },
  chalk: { name: "chalk", wall: "#3f7a5a", wall2: "#356a4e", floor: "#8a6a4a", wood: "#b9824a", woodDark: "#7a5236",
    accent: "#e0483c", cream: "#f2ece0", tones: ["#f2ece0", "#f2d890", "#bfe0d0"], cast: ["#2e6f9a", "#b0503c"], mood: "day", sun: [0.5, 0.7, 0.5] },
  // films 138-157 (2026-11-26): a voice booth, a Christmas living room, a bowling alley, a boot camp, a garden wedding,
  // a police station, a quiz studio, a Paris terrace, a coffee bar, a news desk, a campfire at dusk, a sunny classroom, a talent-show stage
  booth: { name: "booth", wall: "#6f78c8", wall2: "#5f68b8", floor: "#3a3f5a", wood: "#3a3f5a", woodDark: "#2b2d45",
    accent: "#e0483c", cream: "#f2ece0", tones: ["#525aa8", "#8a92d8", "#c8ccf0"], cast: ["#2e6f9a", "#b0503c"], mood: "day", sun: [0.5, 0.7, 0.5] },
  xmas: { name: "xmas", wall: "#b8455a", wall2: "#a83a50", floor: "#6a4a3a", wood: "#a8703c", woodDark: "#5e3f2a",
    accent: "#f2c230", cream: "#fbf6ea", tones: ["#2f8a5a", "#f2c230", "#fbf6ea"], cast: ["#2e6f9a", "#7c5a3a"], mood: "lamp", sun: [0.5, 0.7, 0.5] },
  bowl: { name: "bowl", wall: "#7a4fc0", wall2: "#6a42b0", floor: "#c89a5a", wood: "#f2ece0", woodDark: "#3a2a5a",
    accent: "#f2c230", cream: "#fbf6ea", tones: ["#e0483c", "#f2c230", "#5ac8d8"], cast: ["#2e6f9a", "#e05a8a"], mood: "day", sun: [0.5, 0.7, 0.5] },
  bootcamp: { name: "bootcamp", wall: "#e6c88a", wall2: "#d8b878", floor: "#b89a64", wood: "#6a7a4a", woodDark: "#4a5a34",
    accent: "#e0483c", cream: "#f2ece0", tones: ["#6a7a4a", "#8a9a64", "#c8d0a8"], cast: ["#2e6f9a", "#6a7a4a"], mood: "day", sun: [0.5, 0.7, 0.5] },
  garden: { name: "garden", wall: "#9fd8f0", wall2: "#8fcbe8", floor: "#7fc06a", wood: "#f6f6f2", woodDark: "#c8c8c0",
    accent: "#f06a9a", cream: "#fbf6ea", tones: ["#f06a9a", "#f6a8c8", "#fbe0ea"], cast: ["#2e6f9a", "#f6f6f2"], mood: "day", sun: [0.5, 0.7, 0.5] },
  precinct: { name: "precinct", wall: "#6a8fb8", wall2: "#5a7fa8", floor: "#4a4f57", wood: "#8a6a4a", woodDark: "#5a4030",
    accent: "#f2c230", cream: "#f2ece0", tones: ["#3f5f8a", "#8fb0d0", "#d8e4f0"], cast: ["#2e6f9a", "#3f5f8a"], mood: "day", sun: [0.5, 0.7, 0.5] },
  quiz: { name: "quiz", wall: "#6a5fd0", wall2: "#5a50c0", floor: "#2b2560", wood: "#8a80f0", woodDark: "#2b2560",
    accent: "#f2c230", cream: "#fbf6ea", tones: ["#8a80f0", "#b0a8f8", "#e0dcff"], cast: ["#2e6f9a", "#c9304a"], mood: "day", sun: [0.5, 0.7, 0.5] },
  paris: { name: "paris", wall: "#a8c8e0", wall2: "#98b8d0", floor: "#8a8a90", wood: "#2f5f4a", woodDark: "#1f4a38",
    accent: "#e0483c", cream: "#fbf6ea", tones: ["#e0483c", "#fbf6ea", "#2f5f4a"], cast: ["#2e6f9a", "#17121a"], mood: "day", sun: [0.5, 0.7, 0.5] },
  coffee: { name: "coffee", wall: "#e07a5a", wall2: "#d06a4a", floor: "#4a4046", wood: "#8a5a32", woodDark: "#4a3327",
    accent: "#2f8a86", cream: "#fbf6ea", tones: ["#f2d8c0", "#b85a40", "#fbf6ea"], cast: ["#2e6f9a", "#2f8a86"], mood: "day", sun: [0.5, 0.7, 0.5] },
  news: { name: "news", wall: "#3f7fd0", wall2: "#3470c0", floor: "#2b3a5a", wood: "#f2f2ee", woodDark: "#2b3a5a",
    accent: "#e0483c", cream: "#fbf6ea", tones: ["#2f5fa8", "#8ab8f0", "#dfeeff"], cast: ["#2e6f9a", "#c9304a"], mood: "day", sun: [0.5, 0.7, 0.5] },
  campfire: { name: "campfire", wall: "#5f6fc0", wall2: "#5060b0", floor: "#4a7a56", wood: "#7a5236", woodDark: "#4a3020",
    accent: "#f6a030", cream: "#fbf6ea", tones: ["#3f4f9a", "#8a98e0", "#f6e0a0"], cast: ["#2e6f9a", "#e0663a"], mood: "lamp", sun: [0.5, 0.7, 0.5] },
  sunclass: { name: "sunclass", wall: "#f2c860", wall2: "#e6b84e", floor: "#6a6f7a", wood: "#3f8a9a", woodDark: "#2c6a78",
    accent: "#e0483c", cream: "#fbf6ea", tones: ["#3f8a9a", "#8fc8d0", "#fbf6ea"], cast: ["#2e6f9a", "#e0663a"], mood: "day", sun: [0.5, 0.7, 0.5] },
  talent: { name: "talent", wall: "#c8324a", wall2: "#b82a40", floor: "#3a2a30", wood: "#2b2d35", woodDark: "#17121a",
    accent: "#f2c230", cream: "#fbf6ea", tones: ["#a02038", "#e05a70", "#f8c8d0"], cast: ["#2e6f9a", "#f2c230"], mood: "day", sun: [0.5, 0.7, 0.5] },
};
/** the engine mood for a palette */
export const moodFor = (p: Palette, exposure = 0.2) => forSet(p.mood, p.sun, { exposure });
/** View props that make the set share the figures' ink line (spread into <View>) */
export const SET_VIEW = { setInk: true, sky: false, blur: 0.8, near: 0.1, far: 60 } as const;

const h1 = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
const pick = (p: Palette, k: number) => {
  const u = h1(k);
  return u < 0.62 ? p.tones[Math.floor(h1(k + 9) * 3)] : u < 0.82 ? p.cream : u < 0.92 ? p.accent : p.woodDark;
};

/** a room open to the lens: floor, back wall at z = -d, side walls at x = +-w (the walls take no shadows: a head's
 *  shadow on the wall behind reads as a grey blob) */
export const Room: React.FC<{ pal: Palette; w?: number; d?: number; h?: number }> = ({ pal, w = 4.6, d = 2.5, h = 4.6 }) => (
  <group>
    <M g={boxG(2 * w + 10, 0.2, 20)} c={pal.floor} tex="fabric" p={[0, -0.1, 3]} cast={false} />
    <M g={boxG(2 * w + 0.4, h, 0.2)} c={pal.wall} tex="plaster" p={[0, h / 2, -d - 0.1]} cast={false} recv={false} />
    <M g={boxG(0.2, h, 14)} c={pal.wall2} tex="plaster" p={[-w - 0.1, h / 2, 4.5 - d]} cast={false} recv={false} />
    <M g={boxG(0.2, h, 14)} c={pal.wall2} tex="plaster" p={[w + 0.1, h / 2, 4.5 - d]} cast={false} recv={false} />
  </group>
);

/** a wall of shelves full of books in the palette: chunky spines, a gap now and then */
export const Shelf: React.FC<{ pal: Palette; z: number; x0?: number; x1?: number; y0?: number; rows?: number; rowH?: number; seed?: number }> = ({ pal, z, x0 = -4.4, x1 = 4.4, y0 = 0.55, rows = 6, rowH = 0.62, seed = 1 }) => {
  const books = React.useMemo(() => {
    const out: { x: number; w: number; h: number; c: string; r: number }[] = [];
    for (let r = 0; r < rows; r++) {
      let x = x0;
      let k = seed * 1000 + r * 97 + 3;
      while (x < x1) {
        // chunky books (0.2-0.32 m): thin spines turned a wide shot into a barcode behind the heads
        const w = [0.2, 0.26, 0.32][Math.floor(h1(k) * 3)];
        if (h1(k + 5) > 0.1) out.push({ x: x + w / 2, w, h: rowH * [0.66, 0.74, 0.82][Math.floor(h1(k + 1) * 3)], c: pick(pal, k + 2), r });
        x += w + 0.02;
        k++;
      }
    }
    return out;
  }, [pal, x0, x1, rows, seed]);
  return (
    <group>
      <M g={boxG(x1 - x0 + 0.4, rows * rowH + 0.3, 0.06)} c={pal.woodDark} tex="wood" p={[(x0 + x1) / 2, y0 + (rows * rowH) / 2, z - 0.16]} cast={false} recv={false} />
      {Array.from({ length: rows + 1 }, (_, r) => (
        <M key={r} g={boxG(x1 - x0 + 0.4, 0.06, 0.32)} c={pal.wood} tex="wood" p={[(x0 + x1) / 2, y0 - 0.03 + r * rowH, z]} cast={false} recv={false} />
      ))}
      {books.map((b, i) => (
        <M key={i} g={boxG(b.w, b.h, 0.22)} c={b.c} tex="paper" p={[b.x, y0 + b.r * rowH + b.h / 2, z]} cast={false} recv={false} />
      ))}
    </group>
  );
};

/** a long table seen from the front: a closed block wider than any framing (seated staging: the people's feet sink
 *  behind it), with a top that overhangs */
export const Table: React.FC<{ pal: Palette; y?: number; z?: number; w?: number; d?: number }> = ({ pal, y = 0.6, z = 0.42, w = 8.6, d = 0.62 }) => (
  <group>
    <M g={boxG(w, y - 0.05, d)} c={pal.woodDark} tex="wood" p={[0, (y - 0.05) / 2, z]} cast={false} />
    <M g={boxG(w + 0.1, 0.06, d + 0.12)} c={pal.wood} tex="wood" p={[0, y - 0.03, z]} />
  </group>
);

/** a lit window on the back wall */
export const Window: React.FC<{ pal: Palette; p: V3; w?: number; h?: number; sky?: string }> = ({ pal, p, w = 1.2, h = 1.4, sky = "#cfe8f6" }) => (
  <group position={p}>
    <mesh geometry={boxG(w, h, 0.02)} material={coreMat(sky, 0.95)} />
    {[[0, h / 2 + 0.035, w + 0.14, 0.07], [0, -h / 2 - 0.035, w + 0.14, 0.07]].map(([x, y, ww, hh], i) => (
      <M key={i} g={boxG(ww, hh, 0.05)} c={pal.cream} p={[x, y, 0.02]} cast={false} recv={false} />
    ))}
    {[-w / 2 - 0.035, 0, w / 2 + 0.035].map((x, i) => (
      <M key={i} g={boxG(0.07, h, 0.05)} c={pal.cream} p={[x, 0, 0.02]} cast={false} recv={false} />
    ))}
  </group>
);

/** a framed poster in the accent colour */
export const Poster: React.FC<{ pal: Palette; p: V3; w?: number; h?: number }> = ({ pal, p, w = 0.6, h = 0.8 }) => (
  <group position={p}>
    <M g={boxG(w + 0.06, h + 0.06, 0.02)} c={pal.woodDark} cast={false} recv={false} />
    <M g={boxG(w, h, 0.02)} c={pal.accent} tex="paper" p={[0, 0, 0.012]} cast={false} recv={false} />
    <M g={boxG(w * 0.6, h * 0.12, 0.01)} c={pal.cream} tex="paper" p={[0, h * 0.24, 0.024]} cast={false} recv={false} />
    <M g={cylG(w * 0.18, w * 0.18, 0.01, 20)} c={pal.cream} p={[0, -h * 0.1, 0.024]} r={[Math.PI / 2, 0, 0]} cast={false} recv={false} />
  </group>
);

/** a pot plant (keep it low and at the frame edge: tall props drift across faces) */
export const Plant: React.FC<{ pal: Palette; p: V3; s?: number }> = ({ pal, p, s = 1 }) => (
  <group position={p} scale={s}>
    <M g={cylG(0.16, 0.12, 0.3, 14)} c={pal.accent} tex="stone" p={[0, 0.15, 0]} />
    {[0, 1, 2, 3].map((i) => (
      <M key={i} g={sphG(0.17, 12)} c={i % 2 ? "#4a8a4a" : "#5aa04a"} p={[Math.sin(i * 1.7) * 0.12, 0.5 + (i % 2) * 0.16 + i * 0.05, Math.cos(i * 1.7) * 0.1]} />
    ))}
  </group>
);

/** a small object lying on a table: a closed book (two tones) */
export const Book: React.FC<{ pal: Palette; p: V3; yaw?: number; c?: string }> = ({ pal, p, yaw = 0, c }) => (
  <group position={p} rotation={[0, yaw, 0]}>
    <M g={boxG(0.24, 0.04, 0.32)} c={c ?? pal.tones[0]} tex="paper" p={[0, 0.02, 0]} cast={false} />
    <M g={boxG(0.22, 0.03, 0.3)} c={pal.cream} tex="paper" p={[0.008, 0.055, 0]} cast={false} />
  </group>
);

/** a whiteboard on the back wall with up to three lines of marker text (and an optional line struck through) */
export const Whiteboard: React.FC<{ pal: Palette; p: V3; w?: number; h?: number; lines: string[]; strike?: number; ink?: string }> = ({ pal, p, w = 1.6, h = 1.0, lines, strike, ink = "#2b4fa0" }) => (
  <group position={p}>
    <M g={boxG(w + 0.08, h + 0.08, 0.04)} c="#b9bcc2" tex="metal" cast={false} recv={false} />
    <M g={boxG(w, h, 0.02)} c="#fbfbf7" p={[0, 0, 0.022]} cast={false} recv={false} />
    {lines.map((l, i) => (
      <Label key={i} text={l} p={[0, h * 0.28 - i * h * 0.28, 0.036]} w={w * 0.86} h={h * 0.24} fg={ink} bg="none" />
    ))}
    {strike !== undefined ? <M g={boxG(w * 0.6, 0.025, 0.01)} c="#d8402f" p={[0, h * 0.28 - strike * h * 0.28, 0.042]} r={[0, 0, 0.06]} cast={false} recv={false} /> : null}
    <M g={boxG(w * 0.8, 0.04, 0.08)} c="#9a9da3" tex="metal" p={[0, -h / 2 - 0.06, 0.05]} cast={false} recv={false} />
  </group>
);

/** an elevator car seen from the doors: back wall with a mirror band, side walls, a brass handrail, and a floor display
 *  (a lit panel over the lens side is not visible, so the display sits on the back wall above the mirror) */
export const ElevatorCar: React.FC<{ pal: Palette; floor: string; w?: number; d?: number; h?: number }> = ({ pal, floor, w = 1.9, d = 1.6, h = 2.6 }) => (
  <group>
    <M g={boxG(w + 2, 0.2, d + 6)} c={pal.floor} tex="stone" p={[0, -0.1, 1.5]} cast={false} />
    <M g={boxG(w + 0.4, h, 0.2)} c={pal.wall} tex="wood" p={[0, h / 2, -d / 2 - 0.1]} cast={false} recv={false} />
    {[-1, 1].map((s) => <M key={s} g={boxG(0.2, h, d + 10)} c={pal.wall2} tex="wood" p={[s * (w / 2 + 0.1), h / 2, 3.5]} cast={false} recv={false} />)}
    <M g={boxG(w + 0.4, 0.2, d + 10)} c={pal.woodDark} p={[0, h + 0.1, 3.5]} cast={false} recv={false} />
    {/* steel panels with seams */}
    {[-0.5, 0, 0.5].map((x) => <M key={x} g={boxG(0.015, h - 0.2, 0.01)} c={pal.woodDark} p={[x * w * 0.66, h / 2, -d / 2 + 0.006]} cast={false} recv={false} />)}
    {/* brass handrail at hip height on the back wall */}
    <M g={cylG(0.025, 0.025, w - 0.2, 12)} c={pal.wood} tex="metal" p={[0, 0.95, -d / 2 + 0.08]} r={[0, 0, Math.PI / 2]} cast={false} />
    {/* the floor display: dark panel, accent digits */}
    <M g={boxG(0.5, 0.26, 0.03)} c="#1d1f26" p={[0, h - 0.32, -d / 2 + 0.02]} cast={false} recv={false} />
    <Label text={floor} p={[0, h - 0.32, -d / 2 + 0.04]} w={0.42} h={0.2} fg={pal.accent} bg="none" font={0.8} />
    {/* the ceiling light */}
    <mesh geometry={boxG(w * 0.7, 0.02, 0.5)} material={coreMat("#fff6e0", 1.1)} position={[0, h - 0.01, 0]} />
  </group>
);

// ------------------------------------------------------------------ more pieces (2026-11-25, films 78-87)
/** a door on the back wall (p = centre of its foot); an optional small sign on it */
export const Door: React.FC<{ pal: Palette; p: V3; w?: number; h?: number; c?: string; panel?: string; sign?: string }> = ({ pal, p, w = 0.95, h = 2.1, c, panel, sign }) => (
  <group position={p}>
    <M g={boxG(w + 0.16, h + 0.08, 0.04)} c={pal.cream} p={[0, h / 2 + 0.04, 0]} cast={false} recv={false} />
    <M g={boxG(w, h, 0.04)} c={c ?? pal.tones[0]} tex="wood" p={[0, h / 2, 0.016]} cast={false} recv={false} />
    <M g={boxG(w * 0.62, h * 0.3, 0.012)} c={panel ?? pal.tones[1]} p={[0, h * 0.72, 0.04]} cast={false} recv={false} />
    <M g={sphG(0.045, 12)} c={pal.accent} tex="metal" p={[w * 0.36, h * 0.47, 0.07]} cast={false} />
    {sign ? <Label text={sign} p={[0, h * 0.72, 0.05]} w={w * 0.56} h={h * 0.12} fg={pal.cream} bg="none" /> : null}
  </group>
);
/** a counter block along the back wall with a top (kitchen, reception) */
export const Counter: React.FC<{ pal: Palette; p: V3; w?: number; h?: number; d?: number; c?: string }> = ({ pal, p, w = 2.4, h = 0.92, d = 0.6, c }) => (
  <group position={p}>
    <M g={boxG(w, h - 0.05, d)} c={c ?? pal.tones[0]} tex="wood" p={[0, (h - 0.05) / 2, 0]} cast={false} />
    <M g={boxG(w + 0.08, 0.06, d + 0.08)} c={pal.cream} tex="stone" p={[0, h - 0.03, 0]} cast={false} />
  </group>
);
/** a fridge (keep it at the frame edge, against the back wall) */
export const Fridge: React.FC<{ pal: Palette; p: V3; w?: number; h?: number }> = ({ pal, p, w = 0.8, h = 1.95 }) => (
  <group position={p}>
    <M g={boxG(w, h, 0.6)} c={pal.cream} tex="metal" p={[0, h / 2, 0]} cast={false} />
    <M g={boxG(w + 0.01, 0.02, 0.61)} c={pal.tones[2]} p={[0, h * 0.64, 0]} cast={false} recv={false} />
    <M g={boxG(0.04, h * 0.2, 0.04)} c="#9a9da3" tex="metal" p={[-w * 0.36, h * 0.8, 0.32]} cast={false} />
    <M g={boxG(0.04, h * 0.3, 0.04)} c="#9a9da3" tex="metal" p={[-w * 0.36, h * 0.42, 0.32]} cast={false} />
    <M g={boxG(0.16, 0.2, 0.01)} c={pal.accent} tex="paper" p={[w * 0.18, h * 0.84, 0.305]} r={[0, 0, 0.08]} cast={false} recv={false} />
  </group>
);
/** a board of sticky notes in three columns (a stand-up board) */
export const StickyBoard: React.FC<{ pal: Palette; p: V3; w?: number; h?: number; heads?: [string, string, string] }> = ({ pal, p, w = 1.7, h = 1.05, heads = ["TO DO", "DOING", "DONE"] }) => (
  <group position={p}>
    <M g={boxG(w + 0.08, h + 0.08, 0.04)} c="#b9bcc2" tex="metal" cast={false} recv={false} />
    <M g={boxG(w, h, 0.02)} c="#fbfbf7" p={[0, 0, 0.022]} cast={false} recv={false} />
    {[-1, 0, 1].map((cx) => (
      <group key={cx}>
        <Label text={heads[cx + 1]} p={[cx * w * 0.31, h * 0.38, 0.036]} w={w * 0.26} h={h * 0.14} fg="#2b4fa0" bg="none" />
        {[0, 1, 2].slice(0, cx === 0 ? 2 : 3).map((r) => (
          <M key={r} g={boxG(w * 0.2, h * 0.17, 0.008)} c={[pal.accent, pal.tones[1], "#f2d680"][(r + cx + 2) % 3]} tex="paper" p={[cx * w * 0.31 + (r % 2 ? 0.03 : -0.02), h * 0.16 - r * h * 0.22, 0.038]} r={[0, 0, (r - 1) * 0.05]} cast={false} recv={false} />
        ))}
      </group>
    ))}
    {[-0.5, 0.5].map((x) => <M key={x} g={boxG(0.012, h * 0.92, 0.006)} c="#c8cbd0" p={[x * w * 0.31, 0, 0.034]} cast={false} recv={false} />)}
  </group>
);
/** an open laptop on a table (p = on the table top) */
export const Laptop: React.FC<{ p: V3; yaw?: number; screen?: string }> = ({ p, yaw = 0, screen = "#bfe0ff" }) => (
  <group position={p} rotation={[0, yaw, 0]}>
    <M g={boxG(0.34, 0.018, 0.24)} c="#3b3d46" tex="metal" p={[0, 0.009, 0]} cast={false} />
    <group position={[0, 0.018, -0.12]} rotation={[-0.32, 0, 0]}>
      <M g={boxG(0.34, 0.22, 0.014)} c="#3b3d46" tex="metal" p={[0, 0.11, 0]} cast={false} />
      <mesh geometry={boxG(0.3, 0.18, 0.004)} material={coreMat(screen, 0.9)} position={[0, 0.11, 0.009]} />
    </group>
  </group>
);
/** a phone propped on a small stand, its lit screen to the lens, with the caller's name (a call on speaker) */
export const PhoneStand: React.FC<{ pal: Palette; p: V3; yaw?: number; name: string; s?: number }> = ({ pal, p, yaw = 0, name, s = 1 }) => (
  <group position={p} rotation={[0, yaw, 0]} scale={s}>
    <M g={boxG(0.14, 0.03, 0.12)} c={pal.woodDark} p={[0, 0.015, 0]} cast={false} />
    <group position={[0, 0.03, -0.02]} rotation={[-0.3, 0, 0]}>
      <M g={boxG(0.17, 0.33, 0.02)} c="#22242c" tex="metal" p={[0, 0.165, 0]} cast={false} />
      <mesh geometry={boxG(0.15, 0.3, 0.004)} material={coreMat("#2c3a4e", 0.9)} position={[0, 0.165, 0.012]} />
      <mesh geometry={cylG(0.04, 0.04, 0.004, 20)} material={coreMat("#8fd0c4", 1)} position={[0, 0.215, 0.016]} rotation={[Math.PI / 2, 0, 0]} />
      <Label text={name} p={[0, 0.13, 0.016]} w={0.14} h={0.045} fg="#ffffff" bg="none" />
      <mesh geometry={cylG(0.022, 0.022, 0.004, 16)} material={coreMat("#e0483c", 1)} position={[0, 0.055, 0.016]} rotation={[Math.PI / 2, 0, 0]} />
    </group>
  </group>
);
/** a mug (p = its foot; held: put it at the drawn hand) */
export const Mug: React.FC<{ p: V3; c: string }> = ({ p, c }) => (
  <group position={p}>
    <M g={cylG(0.045, 0.04, 0.1, 16)} c={c} p={[0, 0.03, 0]} cast={false} />
    <M g={torG(0.028, 0.008)} c={c} p={[0.05, 0.03, 0]} cast={false} />
  </group>
);
/** a clipboard with a sheet, held upright in a hand (the sheet faces the holder) */
export const Clipboard: React.FC<{ pal: Palette; p: V3; yaw?: number }> = ({ pal, p, yaw = 0 }) => (
  <group position={p} rotation={[-0.25, yaw, 0]}>
    <M g={boxG(0.2, 0.27, 0.012)} c={pal.woodDark} tex="wood" p={[0, 0.02, 0]} cast={false} />
    <M g={boxG(0.17, 0.22, 0.006)} c={pal.cream} tex="paper" p={[0, 0.015, -0.01]} cast={false} recv={false} />
    <M g={boxG(0.08, 0.025, 0.02)} c="#9a9da3" tex="metal" p={[0, 0.15, 0]} cast={false} />
  </group>
);
/** a taped cardboard box (moving day) */
export const Crate: React.FC<{ p: V3; s?: number; yaw?: number }> = ({ p, s = 1, yaw = 0 }) => (
  <group position={p} rotation={[0, yaw, 0]} scale={s}>
    <M g={boxG(0.5, 0.36, 0.4)} c="#c69a62" tex="paper" p={[0, 0.18, 0]} />
    <M g={boxG(0.1, 0.362, 0.402)} c="#e6d2a8" p={[0, 0.18, 0]} cast={false} recv={false} />
  </group>
);
/** a bicycle seen from the side, leaning on the back wall (p = on the floor under its middle) */
export const Bike: React.FC<{ p: V3; c: string; s?: number }> = ({ p, c, s = 1 }) => {
  const R = 0.3;
  const tube = (a: [number, number], b: [number, number], k: number) => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    return <M key={k} g={boxG(Math.hypot(dx, dy), 0.035, 0.035)} c={c} tex="metal" p={[(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0]} r={[0, 0, Math.atan2(dy, dx)]} cast={false} />;
  };
  const A: [number, number] = [-0.5, R]; // rear hub
  const B: [number, number] = [0.52, R]; // front hub
  const C: [number, number] = [-0.08, R + 0.02]; // pedals
  const D: [number, number] = [-0.2, R + 0.5]; // seat post top
  const E: [number, number] = [0.36, R + 0.52]; // head tube
  return (
    <group position={p} scale={s}>
      {[A, B].map((h, i) => (
        <group key={i} position={[h[0], h[1], 0]}>
          <M g={torG(R, 0.028)} c="#2b2d35" cast={false} />
          <M g={cylG(0.03, 0.03, 0.05, 10)} c="#9a9da3" r={[Math.PI / 2, 0, 0]} cast={false} />
        </group>
      ))}
      {tube(A, C, 0)}
      {tube(C, D, 1)}
      {tube(A, D, 2)}
      {tube(D, E, 3)}
      {tube(C, E, 4)}
      {tube(E, B, 5)}
      <M g={boxG(0.2, 0.04, 0.09)} c="#2b2d35" p={[D[0] - 0.02, D[1] + 0.06, 0]} cast={false} />
      <M g={boxG(0.035, 0.16, 0.035)} c="#9a9da3" tex="metal" p={[E[0] + 0.01, E[1] + 0.08, 0]} cast={false} />
      <M g={boxG(0.06, 0.035, 0.42)} c="#2b2d35" p={[E[0] + 0.03, E[1] + 0.16, 0]} cast={false} />
    </group>
  );
};
/** a sign on the back wall: light text on a dark plate, or the other way round */
export const Sign: React.FC<{ pal: Palette; text: string; p: V3; w?: number; h?: number; dark?: boolean }> = ({ pal, text, p, w = 1.2, h = 0.3, dark = true }) => (
  <group position={p}>
    <M g={boxG(w + 0.06, h + 0.06, 0.03)} c={dark ? pal.woodDark : pal.cream} cast={false} recv={false} />
    <Label text={text} p={[0, 0, 0.02]} w={w} h={h} fg={dark ? pal.cream : "#1a1416"} bg="none" />
  </group>
);
