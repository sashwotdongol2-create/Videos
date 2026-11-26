"""python3 make_vo.py: every voice line in voice.json → vo/<id>.wav, trimmed, levelled to -21 dB mean, checked with
Scribe (speech-to-text), durations and word timings in vo/lines.json. RETAKE=a1,q2 redoes those lines.
voice.json: {"model": "eleven_v4", "speed": 1.05,
  "lines": [{"id": "q1", "voice": "<voice id>", "text": "[matter-of-fact] Tell me about yourself.", "stab": 0.5}],
  "cut":   [{"id": "n0", "from": "../other/vo.wav", "start": 1.44, "end": 2.88}]}   (reuse part of an existing take)
Key: $ELEVENLABS_API_KEY, else ELEVENLABS_API_KEY in the repo's .env or in the pipeline's .env.local."""
import os, json, re, subprocess, urllib.request, time, uuid
from pathlib import Path
HERE = Path(__file__).parent; VO = HERE / "vo"; VO.mkdir(exist_ok=True)
def key():
    if os.environ.get("ELEVENLABS_API_KEY"): return os.environ["ELEVENLABS_API_KEY"]
    for p in [*[d / ".env" for d in HERE.resolve().parents], Path.home() / "Downloads/icloud-migration-audit-2026-05-25/repo-recovery-files/Desktop_stock_videos/.env.local"]:
        if p.exists():
            for l in open(p):
                if l.startswith("ELEVENLABS_API_KEY"): return l.split("=", 1)[1].strip().strip('"\'')
    raise SystemExit("no ELEVENLABS_API_KEY")
KEY = key(); CFG = json.load(open(HERE / "voice.json")); RETAKE = set(os.environ.get("RETAKE", "").split(","))
def post(url, data, ctype):
    for a in range(4):
        try: return urllib.request.urlopen(urllib.request.Request(url, data=data, headers={"xi-api-key": KEY, "Content-Type": ctype}), timeout=120).read()
        except Exception as e: print("  retry", e); time.sleep(3)
    raise SystemExit("failed: " + url)
def mean_db(p): return float(re.search(r"mean_volume: (-?[\d.]+)", subprocess.run(["ffmpeg", "-i", str(p), "-af", "volumedetect", "-vn", "-f", "null", "-"], capture_output=True, text=True).stderr).group(1))
def dur(p): return float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(p)]))
def level(src, dst, pre=""):
    tmp = dst.with_suffix(".tmp.wav")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-af", pre + "silenceremove=start_periods=1:start_threshold=-42dB:start_silence=0.03,areverse,silenceremove=start_periods=1:start_threshold=-42dB:start_silence=0.08,areverse", "-ar", "48000", "-ac", "1", str(tmp)], check=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(tmp), "-af", f"volume={-21.0 - mean_db(tmp):.2f}dB", str(dst)], check=True); tmp.unlink()
def scribe(p):
    b = uuid.uuid4().hex
    data = (f'--{b}\r\nContent-Disposition: form-data; name="model_id"\r\n\r\nscribe_v1\r\n--{b}\r\nContent-Disposition: form-data; name="file"; filename="a.wav"\r\nContent-Type: audio/wav\r\n\r\n').encode() + p.read_bytes() + f"\r\n--{b}--\r\n".encode()
    j = json.loads(post("https://api.elevenlabs.io/v1/speech-to-text", data, f"multipart/form-data; boundary={b}"))
    return j["text"], [(w["text"], round(w["start"], 2), round(w["end"], 2)) for w in j["words"] if w["type"] == "word"]
info = {}
for L in CFG.get("lines", []):
    mp3 = VO / f"{L['id']}.mp3"
    if not mp3.exists() or L["id"] in RETAKE:
        body = json.dumps({"text": L["text"], "model_id": CFG.get("model", "eleven_v4"), "voice_settings": {"stability": L.get("stab", 0.5), "similarity_boost": 0.8, "speed": CFG.get("speed", 1.05)}}).encode()
        mp3.write_bytes(post(f"https://api.elevenlabs.io/v1/text-to-speech/{L['voice']}?output_format=mp3_44100_192", body, "application/json"))
    level(mp3, VO / f"{L['id']}.wav")
for C in CFG.get("cut", []):
    level(HERE / C["from"], VO / f"{C['id']}.wav", pre=f"atrim={C['start']:.3f}:{C['end']:.3f},asetpts=PTS-STARTPTS,")
for L in CFG.get("lines", []) + CFG.get("cut", []):
    p = VO / f"{L['id']}.wav"; text, words = scribe(p)
    info[L["id"]] = {"dur": round(dur(p), 3), "heard": text, "words": words}
    print(f"{L['id']:6} {info[L['id']]['dur']:6.2f}s  {text}")
(VO / "lines.json").write_text(json.dumps(info, indent=1))
