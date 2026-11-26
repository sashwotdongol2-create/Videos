import React from "react";
import { Composition } from "remotion";
import { CamPaths } from "./CamPaths";
import { CardExport, CARD_COUNT } from "./CardExport";
import { Cast } from "./Cast";
import { SUB } from "./engine/core/frame";
import { Film } from "./film/Film";
import { Final, FINAL_FRAMES } from "./Final";
import { LookDev, LOOKDEV_DEFAULTS } from "./LookDev";

// Film: the picture (sharp; also used for stills and --draft). FilmSub: SUB sub-frames per frame for motion blur.
// Final: film.mp4 + one-word captions + mix. Cast: the 3D cast lineup (look check before any shot).
// CardExport: the flat-card fallback states (src/cards.gen.json) as transparent PNGs (`stickman3d.py cards`).
// CamPaths: a shot's ShotDef.paths as CAMPATH console lines (`stickman3d.py cam`, Blender camera stand-ins).
// LookDev: exported sets (+ vehicles, a 1.7 m stand-in) under a mood from one camera (`stickman3d.py lookdev`).
export const Root: React.FC = () => (
  <>
    <Composition id="Film" component={Film} durationInFrames={FINAL_FRAMES} fps={30} width={1080} height={1920} defaultProps={{ sub: false }} />
    <Composition id="FilmSub" component={Film} durationInFrames={FINAL_FRAMES * SUB} fps={30 * SUB} width={1080} height={1920} defaultProps={{ sub: true }} />
    <Composition id="Final" component={Final} durationInFrames={FINAL_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="Cast" component={Cast} durationInFrames={1} fps={30} width={1920} height={1080} />
    <Composition id="CastAnim" component={Cast} durationInFrames={90} fps={30} width={1920} height={1080} />
    <Composition id="CardExport" component={CardExport} durationInFrames={CARD_COUNT} fps={30} width={1200} height={1300} />
    <Composition id="LookDev" component={LookDev} durationInFrames={1} fps={30} width={1080} height={1920} defaultProps={LOOKDEV_DEFAULTS} />
    <Composition id="CamPaths" component={CamPaths} durationInFrames={1} fps={30} width={64} height={64} />
  </>
);
