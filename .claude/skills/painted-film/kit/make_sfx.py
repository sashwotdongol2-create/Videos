"""python3 make_sfx.py: short effects from ElevenLabs sound generation -> sfx/<name>.mp3 (cached).
sfx.json: {"whoosh": ["a quick air whoosh, a fast whip pan, dry", 0.6], ...}   (0.5 s minimum)
Prints each file's peak. Set levels in the page's MIX by peak, never by a guessed multiplier.
Effects that already exist: ../sfx-library has room tones, clink, cricket, paper slide, pen tap, bounce."""
import os, json, re, subprocess, urllib.request, time
from pathlib import Path
HERE = Path(__file__).parent; D = HERE / "sfx"; D.mkdir(exist_ok=True)
def key():
    if os.environ.get("ELEVENLABS_API_KEY"): return os.environ["ELEVENLABS_API_KEY"]
    for p in [*[d / ".env" for d in HERE.resolve().parents], Path.home() / "Downloads/icloud-migration-audit-2026-05-25/repo-recovery-files/Desktop_stock_videos/.env.local"]:
        if p.exists():
            for l in open(p):
                if l.startswith("ELEVENLABS_API_KEY"): return l.split("=", 1)[1].strip().strip('"\'')
    raise SystemExit("no ELEVENLABS_API_KEY")
KEY = key()
for name, (text, sec) in json.load(open(HERE / "sfx.json")).items():
    out = D / f"{name}.mp3"
    if not out.exists():
        body = json.dumps({"text": text, "duration_seconds": max(0.5, sec), "prompt_influence": 0.6}).encode()
        for a in range(3):
            try: out.write_bytes(urllib.request.urlopen(urllib.request.Request("https://api.elevenlabs.io/v1/sound-generation", data=body, headers={"xi-api-key": KEY, "Content-Type": "application/json"}), timeout=120).read()); break
            except Exception as e: print("retry", name, e); time.sleep(3)
    r = subprocess.run(["ffmpeg", "-i", str(out), "-af", "volumedetect", "-f", "null", "-"], capture_output=True, text=True).stderr
    print(f"{name:12} peak {re.search(r'max_volume: (-?[\d.]+)', r).group(1)} dB")
