// THE METER FORMAT as a reusable overlay (2026-11-24). Films 69-77 all share it: the title card from the first
// frame, a labelled meter that falls on each failed try and rises on each trick, a TRICK chip once a trick is said, and
// an end card over the last line. Every number is keyed to the spoken words (film/cues.ts), so the bar moves with the
// bar sounds that the mix already carries. Use in Final.tsx: <MeterOverlay cfg={METER} /> with src/meter.ts:
//   export const METER: MeterCfg = { title: ["How to disagree", "with your boss"], label: "YOUR BOSS",
//     keys: [{ word: "me", edge: "end", offset: 0.85, v: 0.1 }, ...], tricks: [{ from: { word: "first" }, to: { word: "Yes" },
//     tag: "TRICK 1", text: "Agree with something first" }], endLine: "Practise saying it", endWord: "Practice" };
import React from "react";
import { staticFile, useCurrentFrame } from "remotion";
import { useFonts } from "./engine/core/frame";
import { onWords } from "./film/cues";
import type { WordBeat } from "./film/cues";

export type MeterKey = WordBeat & { v: number };
export type MeterCfg = {
  title: string[];
  label: string;
  /** the bar starts here (0..1) */
  start?: number;
  /** each key eases the bar to v, arriving at its word (+ offset); keys resolve in order */
  keys: MeterKey[];
  tricks: { from: WordBeat; to: WordBeat; tag: string; text: string }[];
  /** the end card's second line and the word that starts the ending line */
  endLine: string;
  endWord: string;
  /** the number beside the bar (default: a percentage). Films with their own device give their own: "58K", "3/10" */
  readout?: (v: number, t: number) => string;
  readoutW?: number;
  /** drawn in place of the bar (a sound wave, a name tag, a gift box); w / h = the size the bar would have */
  graphic?: (v: number, t: number, w: number, h: number) => React.ReactNode;
  /** anything else keyed to the film time: a count, arrows (use <Pop/>) */
  extra?: (t: number) => React.ReactNode;
};
/** a big chip that pops in at `at` for `dur` seconds (a silent count, an arrow), above the heads */
export const Pop: React.FC<{ t: number; at: number; dur?: number; text: string; top?: number; size?: number; color?: string; bg?: string }> = ({ t, at, dur = 0.55, text, top = 690, size = 150, color = "#17121a", bg = "#ffffff" }) => {
  if (t < at || t > at + dur) return null;
  const u = Math.min(1, (t - at) / 0.12);
  const k = 0.7 + 0.3 * u * u * (3 - 2 * u);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top, display: "flex", justifyContent: "center" }}>
      <div style={{ fontFamily: "Poppins", fontWeight: 800, fontSize: size, lineHeight: 1, color, background: bg, borderRadius: size * 0.22, padding: `${size * 0.1}px ${size * 0.26}px ${size * 0.14}px`, boxShadow: "0 8px 0 rgba(18,10,16,0.35)", transform: `scale(${k})`, whiteSpace: "nowrap" }}>{text}</div>
    </div>
  );
};
const ease = (u: number) => { const x = Math.min(1, Math.max(0, u)); return x * x * (3 - 2 * x); };
const sm = (t: number, a: number, b: number) => ease((t - a) / (b - a));
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
export const colorOf = (v: number) => (v < 0.25 ? "#e0483c" : v < 0.6 ? "#e6a12c" : "#2fa860");
const F = { fontFamily: "Poppins", fontWeight: 800 } as const;
/** top of the title card. 228 since 2026-11-26 (the owner: the title, meter and chip sat "too much towards the top" at
 *  138, under the apps' own top bar); the meter and the TRICK chip hang 180 px below it and move with it. */
export const STACK_TOP = 228;

export const Bar: React.FC<{ v: number; w: number; h: number; blink?: boolean }> = ({ v, w, h, blink }) => (
  <div style={{ display: "flex", alignItems: "center" }}>
    <div style={{ width: w, height: h, borderRadius: h * 0.32, border: "7px solid #17121a", background: "#ffffff", padding: 6, boxSizing: "border-box" }}>
      <div style={{ width: `${Math.max(4, v * 100)}%`, height: "100%", borderRadius: h * 0.2, background: colorOf(v), opacity: blink ? 0.45 : 1 }} />
    </div>
    <div style={{ width: h * 0.16, height: h * 0.42, background: "#17121a", borderRadius: "0 8px 8px 0" }} />
  </div>
);

const cache = new Map<MeterCfg, { K: [number, number][]; tricks: { a: number; b: number; tag: string; text: string }[]; tEnd: number }>();
const resolve = (c: MeterCfg) => {
  let r = cache.get(c);
  if (!r) {
    const K: [number, number][] = [[0, c.start ?? 0.5], ...onWords(c.keys).map((k) => [k.at, k.v] as [number, number])];
    // tricks resolve in order (each searches after the previous one), so a word said earlier ("work") is skipped
    let cur = 0;
    const tricks = c.tricks.map((x) => {
      const a = onWords([x.from], cur)[0].at;
      const b = onWords([x.to], a)[0].at;
      cur = a;
      return { a, b, tag: x.tag, text: x.text };
    });
    const tEnd = onWords([{ word: c.endWord }], K[K.length - 1][0] - 1)[0].at;
    r = { K, tricks, tEnd };
    cache.set(c, r);
  }
  return r;
};
/** the meter level at film time t */
export const meterAt = (c: MeterCfg, t: number) => {
  const { K } = resolve(c);
  let v = K[0][1];
  for (let i = 1; i < K.length; i++) v = lerp(v, K[i][1], sm(t, K[i][0] - 0.7, K[i][0]));
  return v;
};
/** film time where the ending line starts (captions stop just before it) */
export const meterEnd = (c: MeterCfg) => resolve(c).tEnd;

export const MeterOverlay: React.FC<{ cfg: MeterCfg }> = ({ cfg }) => {
  const fonts = useFonts();
  const t = useCurrentFrame() / 30;
  if (!fonts) return null;
  const { tricks, tEnd } = resolve(cfg);
  const v = meterAt(cfg, t);
  const endU = (t - (tEnd - 0.2)) / 0.5;
  const blink = v < 0.25 && Math.sin(t * Math.PI * 2 * 1.5) > 0;
  const trick = tricks.find((x) => t >= x.a && t < x.b);
  return (
    <>
      {t < tEnd - 0.2 ? (
        <>
          <div style={{ position: "absolute", left: 0, right: 0, top: STACK_TOP, display: "flex", justifyContent: "center" }}>
            <div style={{ background: "#ffffff", borderRadius: 26, padding: "16px 34px 18px", boxShadow: "0 8px 0 rgba(18,10,16,0.35)", textAlign: "center" }}>
              {cfg.title.map((l) => <div key={l} style={{ ...F, fontSize: 48, lineHeight: 1.18, color: "#17121a", whiteSpace: "nowrap" }}>{l}</div>)}
            </div>
          </div>
          <div style={{ position: "absolute", left: 0, right: 0, top: STACK_TOP + 180, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
            <div style={{ background: "#ffffff", borderRadius: 24, padding: "14px 26px 16px", boxShadow: "0 6px 0 rgba(18,10,16,0.35)", display: "flex", alignItems: "center", gap: 22 }}>
              <div style={{ ...F, fontSize: 34, letterSpacing: 2, color: "#17121a", whiteSpace: "nowrap" }}>{cfg.label}</div>
              {cfg.graphic ? cfg.graphic(v, t, 300, 64) : <Bar v={v} w={300} h={64} blink={blink} />}
              <div style={{ ...F, fontSize: 38, color: colorOf(v), minWidth: cfg.readoutW ?? 118, textAlign: "right", whiteSpace: "nowrap" }}>{cfg.readout ? cfg.readout(v, t) : `${Math.round(v * 100)}%`}</div>
            </div>
            {trick ? (
              <div style={{ background: "#17121a", borderRadius: 22, padding: "12px 28px 14px", boxShadow: "0 6px 0 rgba(18,10,16,0.35)", display: "flex", alignItems: "center", gap: 18 }}>
                <div style={{ ...F, fontSize: 34, color: "#ffe066", letterSpacing: 2 }}>{trick.tag}</div>
                <div style={{ ...F, fontSize: 38, color: "#ffffff", whiteSpace: "nowrap" }}>{trick.text}</div>
              </div>
            ) : null}
          </div>
          {cfg.extra ? cfg.extra(t) : null}
        </>
      ) : null}
      {endU > 0 ? (
        <div style={{ position: "absolute", left: 130, width: 820, top: 1920 - 900 * ease(endU), height: 1200, background: "#ffffff", borderRadius: "44px 44px 0 0", textAlign: "center", boxShadow: "0 -10px 0 rgba(18,10,16,0.3)", paddingTop: 44, boxSizing: "border-box" }}>
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 24, marginBottom: 40 }}>
            {cfg.graphic ? cfg.graphic(1, t, 420, 84) : <Bar v={1} w={420} h={84} />}
            <div style={{ ...F, fontSize: 56, color: "#2fa860", whiteSpace: "nowrap" }}>{cfg.readout ? cfg.readout(1, t) : "100%"}</div>
          </div>
          <img src={staticFile("app_icon.png")} style={{ width: 190, height: 190, borderRadius: 44, boxShadow: "0 6px 0 rgba(18,10,16,0.18)" }} />
          <div style={{ ...F, fontSize: 76, lineHeight: 1.05, color: "#17121a", marginTop: 30 }}>Your App</div>
          <div style={{ fontFamily: "Poppins", fontWeight: 700, fontSize: 46, lineHeight: 1.2, color: "#6a6260", marginTop: 18 }}>{cfg.endLine}</div>
        </div>
      ) : null}
    </>
  );
};
