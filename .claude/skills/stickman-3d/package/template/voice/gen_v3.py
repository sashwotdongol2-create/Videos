# ElevenLabs v3 (audio tags) read of a tagged script; word timings from the character alignment, tags dropped.
# Key: env ELEVENLABS_API_KEY, else the .env file named by stickman.json "elevenlabs_env" (never printed).
# usage: python gen_v3.py <tagged.txt> <outdir> [stability 0|0.5|1] [seed]
import base64, json, os, re, subprocess, sys
from pathlib import Path

CFG = json.loads((Path(__file__).resolve().parent.parent / "stickman.json").read_text())
src, out = sys.argv[1], sys.argv[2]
STAB = float(sys.argv[3]) if len(sys.argv) > 3 else 0.0
SEED = int(sys.argv[4]) if len(sys.argv) > 4 else None
VOICE = CFG.get("elevenlabs_voice_id", "nPczCjzI2devNBz1zQrb")  # Brian
os.makedirs(out, exist_ok=True)
key = os.environ.get("ELEVENLABS_API_KEY") or next(
    l.split("=", 1)[1].strip().strip("\"'") for l in open(CFG["elevenlabs_env"], encoding="utf-8") if l.strip().startswith("ELEVENLABS_API_KEY"))
text = open(src, encoding="utf-8").read().strip()
body = {"text": text, "model_id": "eleven_v3", "voice_settings": {"stability": STAB, "similarity_boost": 0.8, "style": 0.0, "use_speaker_boost": True}}
if SEED is not None: body["seed"] = SEED
bp, rp = os.path.join(out, "_req.json"), os.path.join(out, "_resp.json")
json.dump(body, open(bp, "w", encoding="utf-8"))
code = subprocess.run(["curl", "-s", "-o", rp, "-w", "%{http_code}", "-X", "POST",
    f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE}/with-timestamps?output_format=mp3_44100_192",
    "-H", "xi-api-key: " + key, "-H", "Content-Type: application/json", "--data-binary", "@" + bp], capture_output=True, text=True, timeout=600).stdout
os.remove(bp)
if code != "200": print("HTTP", code, open(rp, encoding="utf-8", errors="replace").read()[:400]); sys.exit(1)
d = json.load(open(rp, encoding="utf-8")); os.remove(rp)
open(os.path.join(out, "voice.mp3"), "wb").write(base64.b64decode(d["audio_base64"]))
al = d["alignment"]; chars = al["characters"]; S = al["character_start_times_seconds"]; E = al["character_end_times_seconds"]
words, cur, depth = [], None, 0
for c, s, e in zip(chars, S, E):
    if c == "[": depth += 1; cur = None; continue
    if c == "]": depth -= 1; cur = None; continue
    if depth or c.isspace(): cur = None; continue
    if cur is None: cur = [c, s, e]; words.append(cur)
    else: cur[0] += c; cur[2] = e
ref = re.sub(r"\[[^\]]*\]", " ", text).split()
assert len(words) == len(ref), (len(words), len(ref))
json.dump([{"w": w, "s": round(a[1], 3), "e": round(a[2], 3)} for w, a in zip(ref, words)], open(os.path.join(out, "words.json"), "w"), indent=0)
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", os.path.join(out, "voice.mp3"), "-ar", "48000", "-ac", "1", os.path.join(out, "voice.wav")], check=True)
print(out, f"{len(ref)} words, ends {words[-1][2]:.2f} s, {len(ref) / (words[-1][2] - words[0][1]) * 60:.0f} wpm")
