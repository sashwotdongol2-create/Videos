// The film's cast: one CharacterSpec per character, all NEW designs of our own (never another channel's characters).
// outfit.torso = "<colour> <pattern>" (plain stripes plaid buttons lapels vest belt poncho dress)
// outfit.hair  = "<colour> <style>[ streaks]" (bowl side quiff swoosh bun curly)
// outfit.hat   = none bowler cap tophat helmet bonnet chef pirate crown headband beanie cowboy police nightcap officer veil fieldcap
// outfit.accessory = space-separated: glasses sunglasses monocle moustache toothbrush beard tie bowtie apron badge scarf
// outfit.prop  = shovel lantern mirror ticket bag sword phone cup book bell revolver spear shield cards cash pot rifle capsule
// A costume change of the same person keeps the same id (seeded head wobble stays identical).
import type { CharacterSpec } from "./types";
export const CAST: Record<string, CharacterSpec> = {
  hero: { id: "hero", outfit: { torso: "#3d5f9a buttons", legs: "#2a2630", hair: "#6b4a2e side" } },
  partner: { id: "partner", outfit: { torso: "#6b2a55 dress", legs: "#6b2a55", hair: "#2a2430 bun streaks" } },
  extra1: { id: "extra1", outfit: { torso: "#c4302b buttons", legs: "#2a2630", hat: "bowler", accessory: "moustache" } },
  // test cast for the character rebuild (our own designs): every hat family, hair style, pattern and accessory
  banker: { id: "banker", outfit: { torso: "#e9e4d8 lapels", legs: "#e9e4d8", hat: "tophat", hair: "#3a2a22 side", accessory: "moustache bowtie" } },
  miner: { id: "miner", outfit: { torso: "#2fa58c plain", legs: "#39424e", hat: "beanie", hair: "#2a2430 bowl", accessory: "scarf" } },
  cook: { id: "cook", outfit: { torso: "#f4f1ea buttons", legs: "#f4f1ea", hat: "chef", hair: "#b0642a curly", accessory: "apron beard" } },
  ranger: { id: "ranger", outfit: { torso: "#b9a06a belt", legs: "#6a5a3a", hat: "cowboy", hair: "#6b4a2e quiff", accessory: "badge" } },
  clerk: { id: "clerk", outfit: { torso: "#d9a52e plaid", legs: "#4a3a2a", hair: "#8a8490 swoosh", accessory: "glasses tie" } },
  sleeper: { id: "sleeper", height: 1.55, outfit: { torso: "#cfd8f0 stripes", legs: "#cfd8f0", hat: "nightcap", hair: "#c8c2b8 side" } },
  guard: { id: "guard", height: 1.8, outfit: { torso: "#2e3f7a vest", legs: "#20263a", hat: "police", hair: "#1e1a20 bowl", accessory: "moustache" } },
};
