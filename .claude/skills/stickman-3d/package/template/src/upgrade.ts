// Look / camera switches (tested in _t_upgrade 2026-11-20, default ON in the template since 2026-11-21). Each part can be
// turned off from the Remotion input props, so the OLD and NEW look render from the same code:
//   S still 120 --props '{"up": {"agx": false, "hdri": false, "soft": false}}'      (the pre-2026-11-21 look)
//   toon: 3D flat-toon figures (char3d/toon.tsx) instead of camera-facing cards (a Stickman's own `toon` prop wins)
//   agx:  Blender's AgX view transform in the post grade (engine/post/shaders.ts) + white point + 0.4 "Punchy",
//         instead of the old exposure + soft shoulder
//   hdri: the Poly Haven sky HDRI (public/env/sky_1k.hdr, world/ibl.ts) as a spherical-harmonics light probe that
//         REPLACES the mood's hemisphere light, + a 0.45 SH tint on the unlit 3D figures. Loaded once by Film/LookDev.
//   soft: soft sun shadows (radius 5, 16-tap PCF, bias -0.0003, normalBias 0.03; engine/core/shadows.ts)
//   bcam: shots that have a Blender-authored camera (public/cams/<shot>.json, `S cam`) use it; false = the shot's
//         hand-coded fallback (pattern: `UP().bcam ? blenderCam("s03", t) : beatCam(...)`)
import { getInputProps } from "remotion";

export type Up = { toon: boolean; agx: boolean; hdri: boolean; soft: boolean; bcam: boolean };
let cache: Up | null = null;
export const UP = (): Up => {
  if (cache) return cache;
  const u = (getInputProps() as { up?: Partial<Up> }).up ?? {};
  cache = { toon: u.toon ?? true, agx: u.agx ?? true, hdri: u.hdri ?? true, soft: u.soft ?? true, bcam: u.bcam ?? true };
  return cache;
};
