// Flat-card fallback export: every card state in src/cards.gen.json (written by `stickman3d.py cards` from
// blender/cards_plan.json) as a transparent CARD_W x CARD_H PNG, frame i = entry i. The feet line of every card sits at
// ANCHOR (x centre 600, y 1230) and every card uses the same painter scale (headW 300), so world/Card.tsx places any card
// with one plane size (same numbers as stickman-short's CardExport + blender/lib.py Card); lie / dead cards rest on their
// lowest drawn pixel. Static states only: motion belongs to the 3D stickmen.
import React, { useEffect, useRef } from "react";
import { AbsoluteFill, continueRender, delayRender, useCurrentFrame } from "remotion";
import { CAST } from "./char/cast";
import { drawCharacterCard } from "./char/drawCharacter";
import type { AnyExpression } from "./char/drawCharacter";
import type { CharacterSpec } from "./char/types";
import { ANCHOR, CARD_H, CARD_W, CARDS, HEAD_W } from "./world/Card";
import type { CardEntry } from "./world/Card";

const specOf = (e: CardEntry): CharacterSpec => {
  const s = CAST[e.who];
  if (!s) throw new Error(`cast.ts has no character "${e.who}" (blender/cards_plan.json)`);
  return e.prop ? { ...s, outfit: { ...s.outfit, prop: e.prop } } : s;
};

export const CARD_COUNT = Math.max(1, CARDS.length);

export const CardExport: React.FC = () => {
  const f = useCurrentFrame();
  const ref = useRef<HTMLCanvasElement>(null);
  const [h] = React.useState(() => delayRender("card " + f));
  useEffect(() => {
    const g = ref.current!.getContext("2d")!;
    g.clearRect(0, 0, CARD_W, CARD_H);
    const e = CARDS[f];
    if (e) {
      const off = document.createElement("canvas");
      const m = drawCharacterCard(
        off.getContext("2d")!,
        specOf(e),
        { expr: e.expr as AnyExpression, pose: e.pose, facing: e.facing ?? 1, blink: e.blink, mouthOpen: e.mouth, walkPhase: 0 },
        { headW: HEAD_W },
      );
      // lying / dead: the painter's feet line is the torso's back edge and the bigger head hangs below it (it would be
      // clipped and sink ~18 cm into the floor): rest the lowest opaque pixel on the feet line instead
      let feet = m.feetY;
      if (e.pose === "lie" || e.pose === "dead") {
        const a = off.getContext("2d")!.getImageData(0, 0, m.w, m.h).data;
        let y = m.h - 1;
        const row = (yy: number) => {
          for (let x = 0; x < m.w; x++) if (a[(yy * m.w + x) * 4 + 3] > 128) return true;
          return false;
        };
        while (y > 0 && !row(y)) y--;
        feet = y + 1;
      }
      g.drawImage(off, ANCHOR.x - m.w / 2, ANCHOR.y - feet);
    }
    continueRender(h);
  }, [f, h]);
  return (
    <AbsoluteFill style={{ background: "transparent" }}>
      <canvas ref={ref} width={CARD_W} height={CARD_H} />
    </AbsoluteFill>
  );
};
