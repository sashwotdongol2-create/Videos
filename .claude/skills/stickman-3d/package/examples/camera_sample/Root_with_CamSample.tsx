import React from "react";
import { Composition } from "remotion";
import { CardExport, CARD_COUNT } from "./CardExport";
import { Cast } from "./Cast";
import { SUB } from "./engine/core/frame";
import { Film } from "./film/Film";
import { Final, FINAL_FRAMES } from "./Final";
import { LookDev, LOOKDEV_DEFAULTS } from "./LookDev";
import { CamSample, CS_FRAMES } from "./CamSample";

// Film: the picture (sharp; also used for stills and --draft). FilmSub: SUB sub-frames per frame for motion blur.
// Final: film.mp4 + one-word captions + mix. Cast: the 3D cast lineup (look check before any shot).
// CardExport: the flat-card fallback states (src/cards.gen.json) as transparent PNGs (`stickman3d.py cards`).
// LookDev: exported sets (+ vehicles, a 1.7 m stand-in) under a mood from one camera (`stickman3d.py lookdev`).
export const Root: React.FC = () => (
  <>
    <Composition id="Film" component={Film} durationInFrames={FINAL_FRAMES} fps={30} width={1080} height={1920} defaultProps={{ sub: false }} />
    <Composition id="FilmSub" component={Film} durationInFrames={FINAL_FRAMES * SUB} fps={30 * SUB} width={1080} height={1920} defaultProps={{ sub: true }} />
    <Composition id="Final" component={Final} durationInFrames={FINAL_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="Cast" component={Cast} durationInFrames={1} fps={30} width={1920} height={1080} />
    <Composition id="CardExport" component={CardExport} durationInFrames={CARD_COUNT} fps={30} width={1200} height={1300} />
    <Composition id="CamSample" component={CamSample} durationInFrames={CS_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="LookDev" component={LookDev} durationInFrames={1} fps={30} width={1080} height={1920} defaultProps={LOOKDEV_DEFAULTS} />
  </>
);
