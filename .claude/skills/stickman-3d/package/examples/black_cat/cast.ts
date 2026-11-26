// Black-cat Short cast (our own designs in the RicksClips style; role costumes via drawCostume).
import type { CharacterSpec } from "./types";
export const CAST: Record<string, CharacterSpec> = {
  hero: { id: "hero", height: 1.72, skin: "#c8946a", outfit: { torso: "#e3a93a", legs: "#3e5e8e", hair: "#1a1514 curly", hat: "beanie", costume: "hoodie" } },
  granny: { id: "granny", height: 1.5, skin: "#f2dcc8", outfit: { torso: "#a88cc8", legs: "#f2d8e0", hair: "#d8d8dc bun", accessory: "glasses", costume: "granny" } },
  jogger: { id: "jogger", height: 1.8, skin: "#5a3a26", outfit: { torso: "#d2363a", legs: "#20242e", hair: "#141010", hat: "headband", costume: "jogger" } },
  teen: { id: "teen", height: 1.62, skin: "#e8c8a0", outfit: { torso: "#2e6a4a", legs: "#3a3a44", hair: "#141010 swoosh", costume: "varsity" } },
  vendor: { id: "vendor", height: 1.7, skin: "#c89a72", outfit: { torso: "#c8323a", legs: "#2a2a30", hair: "#3a2a1a", hat: "chef", accessory: "moustache", costume: "vendor" } },
};
