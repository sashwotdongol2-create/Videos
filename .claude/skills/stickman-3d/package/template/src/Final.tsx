// Final pass (the only Remotion job besides card export): Blender picture track + one-word captions + sound mix.
// public/film.mp4 comes from blender/post.py, public/mix.wav from the real-sound skill, src/words.json from the voice.
import React from "react";
import { AbsoluteFill, Audio, OffthreadVideo, staticFile } from "remotion";
import { Captions } from "./char/Captions";
import WORDS from "./words.json";
import FILM from "./film.json";

export const FINAL_FRAMES = (FILM as { frames: number }).frames;
export const Final: React.FC = () => (
  <AbsoluteFill style={{ background: "#000" }}>
    <OffthreadVideo src={staticFile("film.mp4")} />
    <Captions words={WORDS as { w: string; s: number; e: number }[]} y={0.76} fontSize={76} />
    <Audio src={staticFile("mix.wav")} />
  </AbsoluteFill>
);
