// The film's cast: one CharacterSpec per character, all NEW designs of our own in the RicksClips STYLE (never another
// channel's or project's characters). The 3D stickman and the flat cards both draw from this spec.
// outfit.torso = "<colour> <pattern>" (plain stripes plaid buttons lapels vest belt poncho dress jacket wrap cardigan)
// outfit.hair  = "<colour> <style>[ streaks] keep" (bowl side quiff swoosh bun curly). Workshop default: NO hair
//                (drawCharacter.ts HAIR_DEFAULT); a hair string is ignored unless it ends with " keep".
// outfit.hat   = "<hat>[ #colour]" (pick the colour by hand): none bowler cap tophat helmet bonnet chef pirate crown headband beanie cowboy police nightcap officer veil fieldcap
// outfit.accessory = space-separated: glasses sunglasses monocle moustache toothbrush beard tie bowtie apron badge scarf
// outfit.prop  = shovel lantern mirror ticket bag sword phone cup book bell revolver spear shield cards cash pot rifle capsule
// A costume change of the same person keeps the same id (seeded head wobble stays identical).
import type { CharacterSpec } from "./types";
export const CAST: Record<string, CharacterSpec> = {
  hero: { id: "hero", outfit: { torso: "#2f8a84 jacket", legs: "#2a2630", hat: "cap #d39a3c" } },
  partner: { id: "partner", outfit: { torso: "#6b2a55 dress", legs: "#6b2a55", accessory: "scarf" } },
  extra1: { id: "extra1", outfit: { torso: "#c4302b buttons", legs: "#2a2630", hat: "bowler", accessory: "moustache" } },
};
