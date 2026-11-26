// The picture: every shot module in src/shots/index.ts at its frames, joined by the transition that ENTERS each shot
// (src/edit.json: "kinds" {"<id>": "dissolve" | "cut" | "push" | "whip" | "spin" | "vwhip" | "flip" | "through" | "dive" | "wipe"}, ids in "cuts" are hard cuts, default dissolve
// over EDIT.xfade frames centred on the boundary; film/transitions.ts). Both shots are drawn only inside the
// transition's own window; transitions are CSS on the shot layers (no WebGL cost). Each shot is wrapped in
// ShotCtx (world/registry.ts), so per-shot clones (sets, props) never fight over one THREE object while two shots render
// in two canvases. FilmSub renders SUB sub-frames per frame for motion blur (stickman3d.py render averages them with
// ffmpeg tmix); transitions follow the fractional frame position, so they blur too. Assets of the visible shots are
// loaded and the frame is blocked until they are ready (world/assets.ts).
import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { subFrame } from "../engine/core/frame";
import { SHOT_DEFS } from "../shots";
import type { ShotDef } from "../shots/types";
import { UP } from "../upgrade";
import { useNeeds } from "../world/assets";
import { needEnv } from "../world/ibl";
import { ShotCtx } from "../world/registry";
import { SHOTS } from "./time";
import { mergeLook, PLAIN, transIn } from "./transitions";
import type { Look } from "./transitions";

const visible = (fp: number, W: number) => {
  const out: { def: ShotDef; a: number; look: Look }[] = [];
  SHOTS.forEach((s, i) => {
    const def = SHOT_DEFS[s.id];
    if (!def) return;
    const next = SHOTS[i + 1];
    const tin = transIn(i === 0 ? null : s.id);
    const tout = transIn(next ? next.id : null);
    const end = next ? next.a : s.b;
    if (fp < s.a - tin.pre || fp >= end + tout.post) return;
    let look = PLAIN;
    const u = fp - s.a; // frames past the entering boundary
    if (i > 0 && u < tin.inTo) look = mergeLook(look, tin.in(u, W));
    const v = fp - end; // frames past the leaving boundary
    if (next && v >= -tout.outFrom) look = mergeLook(look, tout.out(v, W));
    out.push({ def, a: s.a, look }); // later shots sit on top
  });
  return out;
};

const r2 = (v: number) => Math.round(v * 100) / 100;
export const layerStyle = (l: Look, id: number): React.CSSProperties => {
  const dir = l.hblur > 0.05 || l.vblur > 0.05;
  const f = [dir ? `url(#film-dblur-${id})` : "", l.blur > 0.05 ? `blur(${r2(l.blur)}px)` : ""].filter(Boolean).join(" ");
  const parts: string[] = [];
  if (l.ry !== 0) parts.push(`perspective(1700px) rotateY(${r2(l.ry)}deg)`);
  if (l.x !== 0 || l.y !== 0) parts.push(`translate(${r2(l.x)}px, ${r2(l.y)}px)`);
  if (l.rot !== 0) parts.push(`rotate(${r2(l.rot)}deg)`);
  if (l.sx !== 1 || l.sy !== 1) parts.push(`scale(${l.sx}, ${l.sy})`);
  const m = l.mask < 1 ? `linear-gradient(to right, black ${r2(l.mask * 100)}%, transparent ${r2((l.mask + 0.15) * 100)}%)` : undefined;
  return { opacity: l.op, transform: parts.length ? parts.join(" ") : undefined, transformOrigin: l.ox !== 0.5 ? `${l.ox * 100}% 50%` : undefined, filter: f || undefined, WebkitMaskImage: m, maskImage: m };
};

/** the directional-blur SVG filters for the layers that need one */
export const BlurDefs: React.FC<{ vis: { id: number; look: Look }[] }> = ({ vis }) =>
  vis.some((v) => v.look.hblur > 0.05 || v.look.vblur > 0.05) ? (
    <svg width={0} height={0} style={{ position: "absolute" }}>
      <defs>
        {vis.map((v) => (
          <filter key={v.id} id={`film-dblur-${v.id}`} x="-50%" y="-50%" width="200%" height="200%" colorInterpolationFilters="sRGB">
            <feGaussianBlur stdDeviation={`${r2(v.look.hblur)} ${r2(v.look.vblur)}`} edgeMode="duplicate" />
          </filter>
        ))}
      </defs>
    </svg>
  ) : null;

export const Film: React.FC<{ sub?: boolean }> = ({ sub = false }) => {
  const g = useCurrentFrame();
  const { width } = useVideoConfig();
  const { fp } = sub ? subFrame(g) : { fp: g };
  const vis = visible(fp, width);
  // the sky HDRI (light probe, world/ibl.ts) is loaded ONCE here for every shot, not in each shot's needs
  const ready = useNeeds([...(UP().hdri ? [needEnv()] : []), ...vis.flatMap((v) => v.def.needs)]);
  if (!ready) return <AbsoluteFill style={{ background: "#000" }} />;
  return (
    <AbsoluteFill style={{ background: "#000", overflow: "hidden" }}>
      <BlurDefs vis={vis.map((v) => ({ id: v.def.id, look: v.look }))} />
      {vis.map((v) => (
        <AbsoluteFill key={v.def.id} style={layerStyle(v.look, v.def.id)}>
          <ShotCtx.Provider value={v.def.id}>
            <v.def.Comp t={(fp - v.a) / 30} tg={fp / 30} />
          </ShotCtx.Provider>
        </AbsoluteFill>
      ))}
    </AbsoluteFill>
  );
};
