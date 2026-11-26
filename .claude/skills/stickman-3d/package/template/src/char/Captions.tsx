import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { useFonts } from '../engine/core/frame';
import type { WordTiming } from './types';

/** Word-by-word caption like the reference: one word (two if both are short) at a time, instant swap, no animation. */
export const Captions: React.FC<{ words: WordTiming[]; y?: number; fontSize?: number }> = ({ words, y = 0.72, fontSize = 80 }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;
  const groups = React.useMemo(() => groupWords(words), [words]);
  const fonts = useFonts(); // Poppins 800: the same face as tags and on-screen cards (one type family per film)
  const g = groups.find((x) => t >= x.s && t < x.e);
  if (!g || !fonts) return null;
  return (
    <div
      style={{
        position: 'absolute', left: 0, top: height * y - fontSize * 0.7, width, textAlign: 'center',
        fontFamily: 'Poppins, "Arial Rounded MT Bold", Arial, sans-serif', fontWeight: 800, fontSize,
        color: '#fff', WebkitTextStroke: `${fontSize * 0.11}px #000`, paintOrder: 'stroke fill', letterSpacing: 1,
        textShadow: '0 4px 0 rgba(0,0,0,0.35)', pointerEvents: 'none',
      }}
    >
      {g.text}
    </div>
  );
};

export function groupWords(words: WordTiming[]): { text: string; s: number; e: number }[] {
  const out: { text: string; s: number; e: number }[] = [];
  let i = 0;
  while (i < words.length) {
    const a = words[i]; const b = words[i + 1];
    // pair two short words when they are adjacent (< 120 ms gap) and together ≤ 9 chars
    if (b && a.w.length + b.w.length <= 9 && b.s - a.e < 0.12 && !/[.!?,]$/.test(a.w)) {
      out.push({ text: `${a.w} ${b.w}`, s: a.s, e: Math.max(b.e, a.e) + 0.08 }); i += 2;
    } else {
      out.push({ text: a.w, s: a.s, e: a.e + 0.08 }); i += 1;
    }
  }
  // close gaps: a word stays until the next one starts (reference never shows an empty caption mid-speech)
  for (let k = 0; k < out.length - 1; k++) {
    if (out[k + 1].s - out[k].e < 0.6) out[k].e = out[k + 1].s;
  }
  return out;
}
