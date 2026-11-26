"""Scaffold a meter-format film from a film voiced in the inkbeat kit.

  python meter_film.py <film id> <project dir> --shots 1,4,5,6,7,9,10,11,12 --kit <inkbeat kit folder>

<film id> is a key of FILMS in the kit's films.py, already voiced with `python3 make_film.py <film id>` (that gives
vo/<id>/timings.json, vo/<id>/vo.wav and out/<id>/mix.wav). --shots lists the turn each shot starts on (turn 1 first).

What it does (safe to run again after a re-voice: it never touches src/shots/scene.tsx, src/meter.tsx or cast.ts):
  1. `stickman3d.py new <project dir>` when the folder does not exist
  2. public/voice.wav, public/mix.wav, src/words.json, src/turns.json, src/lip.json
  3. shots_plan.json (from --shots), src/edit.json (hard cuts; a whip into every aside), `stickman3d.py timing`
  4. src/Final.tsx (captions + <MeterOverlay cfg={METER}/> from src/meter.tsx) and src/shots/index.ts (SHOTS from
     src/shots/scene.tsx, built with shots/duo.tsx)
Then write src/char/cast.ts, src/meter.tsx and src/shots/scene.tsx, and `stickman3d.py -p <dir> render`, `final`.
"""
import argparse, json, shutil, subprocess, sys
from pathlib import Path

PKG = Path(__file__).resolve().parents[1]
REPO = PKG.parents[3]
ap = argparse.ArgumentParser()
ap.add_argument("film"); ap.add_argument("dir"); ap.add_argument("--shots", required=True)
ap.add_argument("--kit", required=True)
a = ap.parse_args()
kit = Path(a.kit); dst = Path(a.dir).resolve()
cfg = json.loads((PKG / "config.json").read_text()); py = cfg.get("python") or sys.executable
S = [py, str(PKG / "stickman3d.py")]
if not dst.exists(): subprocess.run(S + ["new", str(dst)], check=True)

tim = json.loads((kit / "vo" / a.film / "timings.json").read_text())
words, turns = [], []
for tr in tim["turns"]:
    i0 = len(words)
    words += [{"w": w["w"], "s": w["t"], "e": w["end"]} for w in tr["words"]]
    turns.append({"n": tr["turn"], "spk": tr["speaker"], "mode": tr["mode"], "i0": i0, "i1": len(words) - 1,
                  "t0": tr["words"][0]["t"], "t1": tr["words"][-1]["end"]})
(dst / "src" / "words.json").write_text(json.dumps(words, indent=0))
(dst / "src" / "turns.json").write_text(json.dumps(turns, indent=1))
shutil.copy(kit / "vo" / a.film / "vo.wav", dst / "public" / "voice.wav")
shutil.copy(kit / "out" / a.film / "mix.wav", dst / "public" / "mix.wav")
subprocess.run([py, str(dst / "voice" / "lip_track.py"), str(dst / "public" / "voice.wav"), str(dst / "src" / "words.json"), str(dst / "src" / "lip.json")], check=True)

first = [int(x) for x in a.shots.split(",")]
assert first[0] == 1 and first == sorted(set(first)) and first[-1] <= len(turns), "--shots: turn numbers in order, starting at 1"
plan = [{"id": k + 1, "w": turns[n - 1]["i0"], "note": " ".join(w["w"] for w in words[turns[n - 1]["i0"]:turns[n - 1]["i0"] + 4])} for k, n in enumerate(first)]
(dst / "shots_plan.json").write_text(json.dumps(plan, indent=1))
whip = {str(k + 1): "whip" for k, n in enumerate(first) if k and turns[n - 1]["mode"] == "cam" and turns[n - 2]["mode"] != "cam"}
cuts = [k + 1 for k in range(1, len(first)) if str(k + 1) not in whip]
(dst / "src" / "edit.json").write_text(json.dumps({"xfade": 9, "cuts": cuts, "kinds": whip}))
dur = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(dst / "public" / "mix.wav")]))
subprocess.run(S + ["-p", str(dst), "timing", "--frames", str(round(dur * 30))], check=True)

(dst / "src" / "Final.tsx").write_text('''// Final pass of a meter-format film: the picture, one-word captions, the meter overlay (src/meter.tsx), the mix.
import React from "react";
import { AbsoluteFill, Audio, OffthreadVideo, staticFile } from "remotion";
import { Captions } from "./char/Captions";
import { MeterOverlay, meterEnd } from "./MeterOverlay";
import { METER } from "./meter";
import WORDS from "./words.json";
import FILM from "./film.json";

export const FINAL_FRAMES = (FILM as { frames: number }).frames;
export const Final: React.FC = () => (
  <AbsoluteFill style={{ background: "#000" }}>
    <OffthreadVideo src={staticFile("film.mp4")} />
    {/* captions stop before the ending line, which the end card carries */}
    <Captions words={(WORDS as { w: string; s: number; e: number }[]).filter((w) => w.s < meterEnd(METER) - 0.25)} y={0.78} fontSize={76} />
    <MeterOverlay cfg={METER} />
    <Audio src={staticFile("mix.wav")} />
  </AbsoluteFill>
);
''')
(dst / "src" / "shots" / "index.ts").write_text('''import type { ShotDef } from "./types";
import { SHOTS } from "./scene";

export const SHOT_DEFS: Record<number, ShotDef> = Object.fromEntries(SHOTS.map((s) => [s.id, s]));
''')
print("\nturns:")
for t in turns: print(f'{t["n"]:2d} {t["spk"]:6s} {t["mode"]:5s} {t["t0"]:6.2f}-{t["t1"]:6.2f}  ' + " ".join(w["w"] for w in words[t["i0"]:t["i1"] + 1]))
print("\nnext: src/char/cast.ts, src/meter.tsx, src/shots/scene.tsx, then render + final")
