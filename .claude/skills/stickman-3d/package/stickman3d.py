#!/usr/bin/env python3
"""stickman3d.py - a RicksClips-style Short with 3D stickmen: Blender BUILDS sets, three.js (Remotion + inkbeat engine) RENDERS.

  python stickman3d.py doctor                        # check tools, config, MCP/skill prerequisites
  python stickman3d.py config [--set KEY VALUE]      # machine config (package/config.json)
  python stickman3d.py install-skills [--earshot-dir D:/tools/earshot]   # bundled sister skills -> ~/.claude/skills
  python stickman3d.py new <project_dir>             # scaffold a project from package/template
  --- inside a project (or pass -p <project_dir>) ---
  python stickman3d.py ref <youtube_url>             # reference: video, transcript, 1 fps contact sheet
  python stickman3d.py voice [--takes 2] [--wpm 180] # ElevenLabs takes -> public/voice.wav + src/words.json + src/lip.json
  python stickman3d.py timing [--frames N | --end-s S]   # shots_plan.json -> SHOT_FRAMES.txt + src/shots.gen.json + src/film.json
                                                     #   (film length = last word + 0.7 s, or N frames / S seconds: a segment cut from a finished mix)
  python stickman3d.py clip Walking_IP Digging ...   # Mixamo FBX (mixamo_downloads) -> public/clips/<Clip>.glb
  python stickman3d.py prop shovel rusted_spade_01   # held prop: blender/assets/<id>.blend | file.blend | file.glb -> public/props/shovel.glb
  python stickman3d.py assets <polyhaven_id> ...     # CC0 Poly Haven models -> blender/assets/<id>.blend
  python stickman3d.py export <set> [--state night day ...] [--bake] [--light]   # blender/sets_<set>.py -> public/sets/<set>_<state>.glb + .json
                                                     #   (--bake: export.py bakes node-recoloured materials to plain textures first;
                                                     #    --light: bounce light + AO lightmaps -> public/sets/<set>_<state>_lm/)
  python stickman3d.py library list|save|use <set>   # the shared set library (config set_library), reused across films
  python stickman3d.py vehicle <id> [--from <asset_id>] [--yaw DEG] [--bake] [--still [--steer R --crumple C --lights]]
                                                     #   blender/assets/<asset_id>.blend -> public/vehicles/<id>.glb (world/vehicle.tsx)
  python stickman3d.py lookdev <set>:<state> [...] [--mood day] [--cams cams.json] [--figure x,y,z|auto|none] [--vehicle SPEC] [--props JSON --name N]
                                                     #   LookDev composition: 3 views at half size -> out/lookdev_<set>_<state>.jpg
  python stickman3d.py castsheet                     # out/castsheet.png: the 3D cast lineup
  python stickman3d.py cards [--meta-only]          # flat-card fallback: blender/cards_plan.json -> public/cards/<id>.png + src/cards.gen.json (world/Card.tsx)
  python stickman3d.py still <frame> [frame ...] [--scale 0.5] [--props JSON] [--tag old]   # Film stills at global frames -> out/stills (~10-20 s each)
                                                     #   (--props '{"up": {"agx": false, "hdri": false, "soft": false}}' = the old look, src/upgrade.ts)
  python stickman3d.py cam <shot> [--export-only] [--no-paths]   # camera authored in background Blender: spec blender/cams/<shot>.json
                                                     #   + ShotDef.paths stand-ins -> public/cams/<shot>.json (world/blenderCam.ts), blender/cams/<shot>.blend,
                                                     #   previews out/cams/<shot>_sheet.jpg; checks roll 0, no move/pan reversals, ease >= 0.4 s
  python stickman3d.py grips <frame> [frame ...] --who hero [--hand right|left|both] [--dist 0.9] [--scale 0.5]
                                                     #   grip close-ups (camera on that hand) -> out/stills/grip_<frame>.jpg + grip_sheet.jpg
  python stickman3d.py render [--draft] [--frames A-B]  # Film -> public/film.mp4 (motion blur; --draft: half size, sharp)
  python stickman3d.py final [--draft]               # film + one-word captions + mix -> out/final.mp4 (+ loudness)
  python stickman3d.py levels [--stems DIR] [--cues F] [--cue-offset N]   # mix vs voice levels report -> out/qa/levels.json
  python stickman3d.py qa [video]                    # flicker, critic (sync / static / caption edges), pacing, contact sheet, loudness, levels + the manual checklist
  python stickman3d.py status                        # what exists, what is missing, and the NEXT step to do

still / grips / render print every browser line with "LENS BLOCKED" (world/camera.ts lensClear) or "TAG OUTSIDE"
(Tag.tsx safe area) or "GRIP:" (grip camera found no joints) or "REACH:" / "ARM FAST:" (reach.tsx: a grabbing hand short of its target / an arm turning > 4 rad/s)
or "STAGE " (world/stage.tsx <StageQA/>: LENS_IN / BLOCKED / OVERLAP / INSIDE / FRAMING); they run Remotion with --log=verbose (the only level that forwards the page's console) and keep
the rest quiet; the full list goes to out/logs/qa_console_<command>.txt. Fix every one before the final render.
levels targets: -14 LUFS / <= -1 dBTP; bed ~14 dB under the voice with a ~3 dB duck; loudest 100 ms outside speech
<= -6 dB re speech RMS; one-shots ~8 dB under the voice peak (tools/levels.py --help).
"""
import argparse, json, os, re, shutil, subprocess, sys, time
from collections import deque
from pathlib import Path

# render workers: STICK_CONC overrides; default fits the machine's cores (BUILD_LESSONS / GOTCHAS -> Speed)
CONC = os.environ.get("STICK_CONC") or min(6, os.cpu_count() or 4)

PKG = Path(__file__).resolve().parent
TEMPLATE = PKG / "template"
TOOLS = PKG / "tools"
MACHINE = PKG / "config.json"
DEFAULTS = {
    "blender": r"C:\Program Files\Blender Foundation\Blender 5.3\blender.exe",
    "python": sys.executable,
    "node_modules_source_3d": "",
    "mixamo_downloads": "",
    "elevenlabs_env": "",
    "elevenlabs_voice_id": "nPczCjzI2devNBz1zQrb",
    "whisper_models": "",
    "lock_dir": str(Path(os.environ.get("TEMP", "/tmp")) / "stickman-locks"),
    "set_library": "",
    "wpm": 180,
}
WIN = os.name == "nt"


def sh(cmd, **kw):
    print("$", " ".join(str(c) for c in cmd)); return subprocess.run([str(c) for c in cmd], **kw)


def machine():
    cfg = dict(DEFAULTS)
    if MACHINE.exists(): cfg.update(json.loads(MACHINE.read_text()))
    return cfg


def proj(a):
    p = Path(a.project or ".").resolve()
    if not (p / "stickman.json").exists(): sys.exit(f"{p} is not a stickman3d project (no stickman.json); run `stickman3d.py new <dir>` first")
    cfg = machine(); cfg.update(json.loads((p / "stickman.json").read_text()))
    return p, cfg


class Lock:
    """one GPU job at a time across every agent and terminal (shared with stickman-short's Blender renders)"""
    def __init__(self, cfg): self.d = Path(cfg["lock_dir"]) / "blender.lock"
    @staticmethod
    def _alive(pid):
        if not WIN:
            try: os.kill(pid, 0); return True
            except OSError: return False
        r = subprocess.run(["tasklist", "/FI", f"PID eq {pid}", "/NH"], capture_output=True, text=True)
        return str(pid) in r.stdout
    def __enter__(self):
        self.d.parent.mkdir(parents=True, exist_ok=True); waited = False; n = 0
        while True:
            try:
                self.d.mkdir(); (self.d / "pid").write_text(str(os.getpid())); return self
            except FileExistsError:
                if not waited: print("waiting for the GPU lock (another render is running)..."); waited = True
                n += 1
                if n % 10 == 0:   # 2026-11-21: a killed agent left the lock behind and every job waited 4 h; break stale locks
                    try:
                        pf = self.d / "pid"
                        pid = int(pf.read_text()) if pf.exists() else None
                        age = time.time() - self.d.stat().st_mtime
                        if (pid and not self._alive(pid)) or (pid is None and age > 1800):
                            print(f"breaking a stale GPU lock (owner {pid} gone)"); shutil.rmtree(self.d, ignore_errors=True)
                    except Exception: pass
                time.sleep(3)
    def __exit__(self, *e):
        shutil.rmtree(self.d, ignore_errors=True)


def _has(mod):
    try: __import__(mod); return True
    except Exception: return False


def _env(cfg):
    return dict(os.environ, TEMP=cfg["lock_dir"], TMP=cfg["lock_dir"])


def _npx(p, cfg, args, check=True):
    Path(cfg["lock_dir"]).mkdir(parents=True, exist_ok=True)
    return sh(["npx", "remotion", *args], cwd=p, env=_env(cfg), check=check, shell=WIN)


def _bundle(p, cfg):
    """bundle once per code/asset change (stills and renders reuse build/)"""
    b = p / "build" / "index.html"
    newest = max((f.stat().st_mtime for d in ("src", "public") for f in (p / d).rglob("*") if f.is_file()), default=0)
    if b.exists() and b.stat().st_mtime >= newest: return
    with Lock(cfg):   # 2026-11-21: never rewrite build/ while another agent's still/render reads it
        if b.exists() and b.stat().st_mtime >= max((f.stat().st_mtime for d in ("src", "public") for f in (p / d).rglob("*") if f.is_file()), default=0): return
        sh(["npx", "tsc", "--noEmit"], cwd=p, check=True, shell=WIN)          # typecheck gate: one syntax error breaks every bundle
        _npx(p, cfg, ["bundle", "src/index.ts", "--out-dir=build"])


RENDER = ["--gl=angle", "--timeout=240000"]
QA_TAGS = ("LENS BLOCKED", "TAG OUTSIDE", "GRIP:", "REACH:", "ARM FAST:", "STAGE ")
ANSI = re.compile(r"\x1b\[[0-9;]*[A-Za-z]")


def _npx_qa(p, cfg, args, tags=QA_TAGS, show=True):
    """npx remotion ... --log=verbose (the only level that forwards the page's console.error), printing only the QA
    tags (QA_TAGS, or `tags`), a progress line every ~15 s, and the tail of the output if it fails. Returns the unique
    tagged lines (show=False: returned, not printed)."""
    Path(cfg["lock_dir"]).mkdir(parents=True, exist_ok=True)
    cmd = ["npx", "remotion", *args, "--log=verbose"]
    print("$", " ".join(str(c) for c in cmd))
    pr = subprocess.Popen([str(c) for c in cmd], cwd=p, env=_env(cfg), shell=WIN, stdout=subprocess.PIPE,
                          stderr=subprocess.STDOUT, text=True, encoding="utf-8", errors="replace")
    tail, seen, qa, last = deque(maxlen=60), set(), [], time.time()
    for raw in pr.stdout:
        for line in ANSI.sub("", raw).replace("\r", "\n").splitlines():
            if not line.strip(): continue
            tail.append(line)
            i = min((line.find(t) for t in tags if t in line), default=-1)
            if i >= 0:
                msg = line[i:].split('", source:')[0].rstrip('"').strip()
                if msg not in seen:
                    seen.add(msg); qa.append(msg)
                    if show and len(qa) <= 40: print("  QA", msg)
                    elif show and len(qa) == 41: print("  QA ... (more: see the log file)")
            elif line.startswith(("Rendered", "Stitched", "Encoded")) and time.time() - last > 15:
                print("  " + line.strip()); last = time.time()
    rc = pr.wait()
    if rc:
        print("\n".join(tail)); sys.exit(f"remotion failed (exit {rc})")
    return qa


def _qa_log(p, label, qa):
    """out/logs/qa_console_<label>.txt: every QA console line of the command (removed when there are none)"""
    log = p / "out" / "logs" / f"qa_console_{label}.txt"
    if not qa:
        if log.exists(): log.unlink()
        return "QA console clean (no LENS BLOCKED / TAG OUTSIDE / GRIP: / REACH: / ARM FAST: / STAGE)"
    log.parent.mkdir(parents=True, exist_ok=True); log.write_text("\n".join(qa), encoding="utf-8")
    return (f"{len(qa)} QA console line(s) (" + ", ".join(f"{t}: {sum(t in q for q in qa)}" for t in QA_TAGS)
            + f"): fix them before the final render -> {log}")


# ------------------------------------------------------------------ setup
def cmd_doctor(a):
    cfg = machine(); ok = True
    def chk(name, good, fix=""):
        nonlocal ok; ok &= bool(good); print(("  OK   " if good else "  MISS ") + name + ("" if good else f"   -> {fix}"))
    print("machine config:", MACHINE if MACHINE.exists() else "(none yet: run `stickman3d.py config`)")
    chk("blender " + cfg["blender"], Path(cfg["blender"]).exists(), "install Blender 5.3+ and set 'blender' in config")
    for t in ("ffmpeg", "ffprobe", "node", "npx"):
        chk(t, shutil.which(t), "install it and put it on PATH (ffmpeg.org, nodejs.org LTS)")
    chk("yt-dlp (for `ref`)", shutil.which("yt-dlp") or _has("yt_dlp"), "pip install yt-dlp")
    py = cfg["python"]
    r = subprocess.run([py, "-c", "import numpy, PIL"], capture_output=True)
    chk(f"numpy + pillow in config python ({py})", r.returncode == 0, "pip install numpy pillow into that python")
    r = subprocess.run([py, "-c", "import scipy, soundfile"], capture_output=True)
    chk("scipy + soundfile in config python (for `levels`)", r.returncode == 0, "pip install scipy soundfile into that python")
    chk("ElevenLabs key file (elevenlabs_env) or env ELEVENLABS_API_KEY", os.environ.get("ELEVENLABS_API_KEY") or (cfg["elevenlabs_env"] and Path(cfg["elevenlabs_env"]).exists()),
        "create a .env with ELEVENLABS_API_KEY=... and set 'elevenlabs_env'")
    chk("Mixamo downloads folder (mixamo_downloads)", cfg["mixamo_downloads"] and Path(cfg["mixamo_downloads"]).exists(), "install the Mixamo MCP and set its downloads folder")
    nm = cfg.get("node_modules_source_3d")
    chk("node_modules_source_3d (optional: shared React 19 / three 0.186 node_modules)", nm and Path(nm, "remotion").exists(), "leave empty to npm ci per project")
    chk("set_library folder (optional)", cfg.get("set_library") and Path(cfg["set_library"]).exists(), "set 'set_library' to a folder for reusable sets")
    print("\nMCP servers / skills: blender (mcp-for-blender) for set building, mixamo for clips, real-sound + earshot for sound. See references/SETUP.md.")
    print("\nready" if ok else "\nNOT READY: fix the MISS lines (optional ones may stay)")


def cmd_config(a):
    cfg = machine()
    for k, v in (a.set or []): cfg[k] = int(v) if v.isdigit() else v
    MACHINE.write_text(json.dumps(cfg, indent=1)); print(json.dumps(cfg, indent=1)); print("saved", MACHINE)


def cmd_install_skills(a):
    dst = Path(a.dest or Path.home() / ".claude" / "skills"); dst.mkdir(parents=True, exist_ok=True)
    for s in sorted((PKG / "sister_skills").iterdir()):
        if s.name == "earshot": continue
        t = dst / s.name
        if t.exists(): print(f"  have {s.name} ({t})"); continue
        shutil.copytree(s, t); print(f"  installed {s.name} -> {t}")
    if a.earshot_dir:
        ear = Path(a.earshot_dir)
        if not ear.exists(): shutil.copytree(PKG / "sister_skills" / "earshot", ear)
        venv = ear / ".venv"
        if not venv.exists(): sh([sys.executable, "-m", "venv", venv], check=True)
        pyv = venv / ("Scripts/python.exe" if WIN else "bin/python")
        sh([pyv, "-m", "pip", "install", "-e", ear], check=True)
    print("restart Claude Code so new skills are listed")


def cmd_new(a):
    dst = Path(a.dir).resolve()
    if dst.exists() and any(dst.iterdir()): sys.exit(f"{dst} is not empty")
    shutil.copytree(TEMPLATE, dst, dirs_exist_ok=True, ignore=shutil.ignore_patterns("__pycache__", "node_modules", "build"))
    cfg = machine(); (dst / "stickman.json").write_text(json.dumps(cfg, indent=1))
    for d in ("public/sets", "public/clips", "public/props", "ref", "out/stills", "out/logs", "blender/assets", "blender/tex", "audio"):
        (dst / d).mkdir(parents=True, exist_ok=True)
    defaults = {"src/words.json": "[]", "src/lip.json": '{"fps": 30, "open": [], "round": [], "teeth": []}', "src/film.json": '{"frames": 150}', "src/shots.gen.json": '[{"id": 1, "a": 0, "b": 150, "words": ""}]',
                "src/edit.json": '{"xfade": 9, "cuts": [], "kinds": {}}', "src/clips.gen.json": "[]", "shots_plan.json": '[{"id": 1, "w": 0, "note": "example shot"}]'}
    for f, body in defaults.items():
        if not (dst / f).exists(): (dst / f).write_text(body)
    sh([cfg["python"], dst / "blender" / "tex.py"], cwd=dst / "blender", check=True)   # base painted textures -> blender/tex
    nm = cfg.get("node_modules_source_3d")
    if nm and Path(nm, "remotion").exists():
        if WIN: sh(["cmd", "/c", "mklink", "/J", str(dst / "node_modules"), nm])
        else: os.symlink(nm, dst / "node_modules")
    else:
        sh(["npm", "ci", "--no-audit", "--no-fund"], cwd=dst, shell=WIN, check=True)
    print("project ready:", dst, "\nnext: script (SCRIPT.md), then voice/vo.txt + voice/vo_tags.txt -> `stickman3d.py voice`")


# ------------------------------------------------------------------ reference + voice + timing
def cmd_ref(a):
    p, cfg = proj(a); r = p / "ref"
    ytdlp = shutil.which("yt-dlp")
    sh(([ytdlp] if ytdlp else [sys.executable, "-m", "yt_dlp"]) + ["-f", "bv*+ba/b", "-S", "vcodec:h264,res,fps", "--merge-output-format", "mp4", "--write-info-json", "-o", str(r / "ref.mp4"), a.url], check=True)
    sh(["ffmpeg", "-v", "error", "-y", "-i", r / "ref.mp4", "-vf", "fps=1,scale=216:384,tile=10x6", "-frames:v", "1", r / "sheet_1s.jpg"], check=True)
    (r / "frames").mkdir(exist_ok=True)
    sh(["ffmpeg", "-v", "error", "-y", "-i", r / "ref.mp4", "-vf", "fps=2,scale=216:384", r / "frames" / "f_%03d.jpg"], check=True)
    if _has("faster_whisper"):
        sh(["ffmpeg", "-v", "error", "-y", "-i", r / "ref.mp4", "-ac", "1", "-ar", "16000", r / "a16.wav"], check=True)
        from faster_whisper import WhisperModel
        m = WhisperModel("small.en", device="cpu", compute_type="int8", download_root=cfg.get("whisper_models") or None)
        seg, _ = m.transcribe(str(r / "a16.wav"), word_timestamps=True)
        lines = [f"{s.start:5.1f}-{s.end:5.1f} {s.text.strip()}" for s in seg]
        (r / "transcript.txt").write_text("\n".join(lines), encoding="utf-8"); print("\n".join(lines))
    print("reference ready: ref/ref.mp4, ref/sheet_1s.jpg, ref/frames/, ref/transcript.txt")


def cmd_voice(a):
    p, cfg = proj(a); v = p / "voice"
    tags, plain = v / "vo_tags.txt", v / "vo.txt"
    if not tags.exists() or not plain.exists(): sys.exit("write voice/vo.txt (plain script) and voice/vo_tags.txt (same words + [audio tags] + CAPS) first")
    best = None
    for k in range(1, a.takes + 1):
        sh([cfg["python"], v / "gen_v3.py", tags, v / f"take{k}", "0.0", k], check=True)
        sh([cfg["python"], v / "tighten_beats.py", v / f"take{k}", v / f"take{k}_tight", a.wpm or cfg["wpm"]], check=True)
        sd = _pitch_sd(v / f"take{k}_tight" / "voice.wav")
        print(f"take {k}: pitch SD {sd:.2f} st (higher = more expressive)")
        if best is None or sd > best[1]: best = (k, sd)
    t = v / f"take{best[0]}_tight"
    shutil.copy(t / "voice.wav", p / "public" / "voice.wav")
    W = json.loads((t / "words.json").read_text()); P = plain.read_text(encoding="utf-8").split()
    if len(P) != len(W): sys.exit(f"vo.txt has {len(P)} words but the take has {len(W)}: keep vo.txt and vo_tags.txt word-identical")
    (p / "src" / "words.json").write_text(json.dumps([{"w": w, "s": x["s"], "e": x["e"]} for w, x in zip(P, W)], indent=0))
    print(f"picked take {best[0]}; public/voice.wav, src/words.json ({len(P)} words, ends {W[-1]['e']:.2f} s)")
    sh([cfg["python"], v / "lip_track.py", p / "public" / "voice.wav", p / "src" / "words.json", p / "src" / "lip.json"], check=True)  # lip-sync for talk ranges
    for i, (w, x) in enumerate(zip(P, W)): print(f"{i}:{w}@{x['s']:.2f}", end="  ")
    print()


def _pitch_sd(wav):
    try:
        import librosa, numpy as np
        y, sr = librosa.load(str(wav), sr=16000); f, vv, _ = librosa.pyin(y, fmin=70, fmax=350, sr=sr, frame_length=1024); f = f[vv]
        return float((12 * np.log2(f / np.median(f))).std())
    except Exception: return 0.0


def cmd_timing(a):
    """shots_plan.json: [{"id": 1, "w": 0, "note": "..."}, ...]  (w = index of the shot's first word in src/words.json)"""
    p, cfg = proj(a)
    W = json.loads((p / "src" / "words.json").read_text()); plan = json.loads((p / "shots_plan.json").read_text())
    if not W: sys.exit("src/words.json is empty: run `voice` first")
    total = round((W[-1]["e"] + 0.7) * 30)          # picture ends ~0.7 s after the last word
    mix_f = _audio_frames(p / "public" / "mix.wav")
    if a.frames or a.end_s:
        total = a.frames or round(a.end_s * 30)
        print(f"film length overridden: {total} frames ({total / 30:.2f} s)")
    elif mix_f and abs(mix_f - total) > 1:
        print(f"NOTE public/mix.wav is {mix_f} frames ({mix_f / 30:.2f} s), the words give {total}: "
              f"if the film is cut to that mix, run `timing --frames {mix_f}`")
    f = lambda i: 0 if i == 0 else round(W[i]["s"] * 30) - 3
    starts = [f(s["w"]) for s in plan]
    if total <= max(starts): sys.exit(f"film length {total} frames ends before the last shot starts (frame {max(starts)})")
    rows, lines = [], []
    for k, s in enumerate(plan):
        a0 = f(s["w"]); b0 = f(plan[k + 1]["w"]) if k + 1 < len(plan) else total
        wend = plan[k + 1]["w"] if k + 1 < len(plan) else len(W)
        words = " ".join(x["w"] for x in W[s["w"]:wend])
        rows.append({"id": s["id"], "a": a0, "b": b0, "words": words}); lines.append(f'{s["id"]} {a0} {b0} {words}')
    (p / "SHOT_FRAMES.txt").write_text("\n".join(lines), encoding="utf-8")
    (p / "src" / "shots.gen.json").write_text(json.dumps(rows, indent=1))
    (p / "src" / "film.json").write_text(json.dumps({"frames": total}))
    print("\n".join(lines)); print("total frames", total)


def _audio_frames(wav):
    """length of an audio file in 30 fps frames (ffprobe), or None"""
    if not wav.exists(): return None
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(wav)], capture_output=True, text=True)
    try: return round(float(r.stdout.strip()) * 30)
    except ValueError: return None


# ------------------------------------------------------------------ motion, props, assets, sets
def cmd_clip(a):
    p, cfg = proj(a); src = Path(cfg["mixamo_downloads"]); gen = p / "src" / "clips.gen.json"
    have = json.loads(gen.read_text()) if gen.exists() else []
    for c in a.clips:
        fbx = src / f"{c}.fbx"
        if not fbx.exists(): sys.exit(f"missing {fbx}: download it with the Mixamo MCP first (in-place for walks/runs)")
        r = sh([cfg["blender"], "-b", "--factory-startup", "-P", TOOLS / "fbx2glb.py", "--", fbx, p / "public" / "clips" / f"{c}.glb"], capture_output=True, text=True)
        print("\n".join(l for l in r.stdout.splitlines() if l.startswith(("ARM", "DONE"))) or r.stderr[-800:])
        if c not in have: have.append(c)
    gen.write_text(json.dumps(have)); print("clips:", have)


def cmd_prop(a):
    p, cfg = proj(a); s = Path(a.src)
    if not s.suffix: s = p / "blender" / "assets" / f"{a.src}.blend"
    out = p / "public" / "props" / f"{a.id}.glb"
    if s.suffix.lower() == ".glb": shutil.copy(s, out)
    else:
        r = sh([cfg["blender"], "-b", "--factory-startup", "-P", TOOLS / "asset2glb.py", "--", s, out], capture_output=True, text=True)
        print("\n".join(l for l in r.stdout.splitlines() if l.startswith(("BBOX", "DONE"))) or r.stderr[-800:])
    print(f"{out}  -> add '{a.id}' to PROPS in src/char3d/props.ts if it is new (length, carry, two)")


def cmd_assets(a):
    p, cfg = proj(a)
    sh([cfg["blender"], "-b", "-P", p / "blender" / "get_assets.py", "--", *a.ids], check=True)


def cmd_export(a):
    if getattr(a, "draft", False): a.light_samples = min(a.light_samples, 64)
    p, cfg = proj(a); failed, warns = [], 0
    import contextlib
    for st in a.state:
      with (Lock(cfg) if a.light else contextlib.nullcontext()):     # the lightmap bake uses the GPU
        # --python-exit-code: a Python error in the set build makes Blender exit non-zero (by default it exits 0)
        r = sh([cfg["blender"], "-b", "--python-exit-code", "1", "-P", p / "blender" / "export.py", "--", "--set", a.set, "--state", st,
                *(["--bake", "--bake-res", str(a.bake_res)] if a.bake else []),
                *(["--light", "--light-res", str(a.light_res), "--light-samples", str(a.light_samples), "--light-density", str(a.light_density), "--light-px", str(a.light_px)] if a.light else [])],
               cwd=p, capture_output=True, text=True)
        log = r.stdout + r.stderr
        out = [l for l in log.splitlines() if l.startswith(("EXPORT", "WARN", "BAKED", "LIGHT", "SLIM")) or "Error" in l or "Traceback" in l or 'File "' in l]
        print("\n".join(out) or log[-1500:])
        warns += sum(l.startswith("WARN") for l in out)
        if r.returncode != 0 or not any(l.startswith("EXPORT") for l in out):
            failed.append(st)
            m = re.search(r"assets[\\/]+([\w.-]+)\.blend", log) if "failed to open blend file" in log else None
            if m: print(f"FAILED {a.set} {st}: blender/assets/{m.group(1)}.blend is missing -> `assets {m.group(1)}` (Poly Haven) or copy it in")
            else: print(f"FAILED {a.set} {st}: Blender exit {r.returncode} (see the Traceback above)")
    print(f"export {a.set}: {len(a.state) - len(failed)}/{len(a.state)} state(s) exported, {warns} WARN" + (" -> fix every WARN" if warns else ""))
    if failed: sys.exit(1)


def _lib(cfg):
    d = Path(cfg.get("set_library") or (PKG / "library"))
    d.mkdir(parents=True, exist_ok=True); return d


def cmd_library(a):
    p, cfg = proj(a); L = _lib(cfg)
    if a.action == "list":
        for d in sorted(x for x in L.iterdir() if x.is_dir()):
            sheet = d / "SET.md"; desc = sheet.read_text(encoding="utf-8").splitlines()[0] if sheet.exists() else ""
            print(f"  {d.name:24s} {' '.join(sorted(f.stem.split('_', 1)[-1] for f in d.glob('*.glb')))}   {desc}")
        return
    if not a.set: sys.exit("give a set name")
    d = L / a.set
    if a.action == "save":
        d.mkdir(exist_ok=True)
        for f in (p / "public" / "sets").glob(f"{a.set}_*"): shutil.copy(f, d / f.name)
        for f in (p / "blender").glob(f"sets_{a.set}.py"):
            shutil.copy(f, d / f.name)
            if re.search(r"^\s*from ready import", f.read_text(encoding="utf-8"), re.M) and (p / "blender" / "ready.py").exists():
                shutil.copy(p / "blender" / "ready.py", d / "ready.py")   # ready-made-set helpers (place / scatter / sky_dome)
        for f in [*(p / "out" / "stills").glob(f"lookdev_{a.set}*"), *(p / "out").glob(f"lookdev_{a.set}*")]: shutil.copy(f, d / f.name)
        sheet = p / "blender" / f"SET_{a.set}.md"
        if sheet.exists(): shutil.copy(sheet, d / "SET.md")
        elif not (d / "SET.md").exists():
            (d / "SET.md").write_text(f"{a.set}: <one line>\n\nSet sheet: ground, buildings, 10-15 props, materials, light states.\nAssets + licences: see ASSETS.md of the film that built it.\n", encoding="utf-8")
        print("saved", d, [f.name for f in d.iterdir()])
    else:
        if not d.exists(): sys.exit(f"no set {a.set} in {L}")
        for f in d.glob("*.glb"): shutil.copy(f, p / "public" / "sets" / f.name)
        for f in d.glob("*_lm*.png"): shutil.copy(f, p / "public" / "sets" / f.name)   # baked lightmaps (a render 404s without them)
        for f in d.glob("*_lm"):
            if f.is_dir(): shutil.copytree(f, p / "public" / "sets" / f.name, dirs_exist_ok=True)
        (p / "out" / "library").mkdir(parents=True, exist_ok=True)   # saved look-dev cameras: `lookdev ... --cams out/library/<file>`
        for f in d.glob("*.json"): shutil.copy(f, p / ("out/library" if f.name.startswith("lookdev_") else "public/sets") / f.name)
        for f in d.glob("sets_*.py"): shutil.copy(f, p / "blender" / f.name)
        if (d / "ready.py").exists() and not (p / "blender" / "ready.py").exists(): shutil.copy(d / "ready.py", p / "blender" / "ready.py")
        for m in re.findall(r"^\s*(?:from|import)\s+(sets_\w+)", "".join(f.read_text(encoding="utf-8") for f in d.glob("sets_*.py")), re.M):
            if not (p / "blender" / f"{m}.py").exists(): print(f"WARN blender/sets_{a.set}.py imports {m}: `library use {m[5:]}` too before re-exporting")
        print(f"using {a.set} from the library (public/sets + blender/sets_{a.set}.py); credit its assets in ASSETS.md")


def cmd_vehicle(a):
    """blender/assets/<asset>.blend -> public/vehicles/<id>.glb through blender/export.py --module tools/vehicle_build.py:
    origin on the ground under the centre, front +Y in Blender (three -Z), wheels renamed wheel_FL/FR/RL/RR (pivot at
    the wheel centre), materials kept; --bake bakes node-built colours like `export --bake`. --still renders it with
    LookDev (wheels steered, crumple, lights) -> out/lookdev_vehicle_<id>.jpg."""
    p, cfg = proj(a)
    s = a.src or a.id
    src = Path(s) if s.lower().endswith(".blend") else p / "blender" / "assets" / f"{s}.blend"
    if not src.exists(): sys.exit(f"missing {src}: import the asset first (ASSETS.md) or pass --from <asset_id | file.blend>")
    exp = p / "blender" / "export.py"
    if "--module" not in exp.read_text(encoding="utf-8"):
        sys.exit(f"{exp} predates vehicles (no --module): copy {TEMPLATE / 'blender' / 'export.py'} over it")
    out = p / "public" / "vehicles" / f"{a.id}.glb"; out.parent.mkdir(parents=True, exist_ok=True)
    t = time.time()
    r = sh([cfg["blender"], "-b", "--python-exit-code", "1", "-P", exp, "--", "--set", a.id, "--state", "vehicle",
            "--module", TOOLS / "vehicle_build.py", "--out", out, "--src", src, *(["--yaw", str(a.yaw)] if a.yaw else []), *(["--no-wall"] if a.no_wall else []),
            *(["--bake", "--bake-res", str(a.bake_res)] if a.bake else [])], cwd=p, capture_output=True, text=True)
    log = r.stdout + r.stderr
    keep = [l for l in log.splitlines() if l.startswith(("VEHICLE", "WHEEL", "EXPORT", "WARN", "BAKED")) or "Error" in l or "Traceback" in l or 'File "' in l]
    print("\n".join(keep) or log[-1500:])
    if r.returncode != 0 or not out.exists(): sys.exit(f"vehicle {a.id}: Blender exit {r.returncode} (see above)")
    print(f"vehicle {a.id}: {out} ({out.stat().st_size / 1e6:.1f} MB, {time.time() - t:.0f} s). Shots: needVehicle('{a.id}') + <Vehicle id='{a.id}' .../> (world/vehicle.tsx)")
    if a.still:
        spec = dict(id=a.id, at=[0, 0, 0], yaw=a.still_yaw, steer=a.steer, crumple=a.crumple, dist=a.dist, lights=bool(a.lights))
        _lookdev(p, cfg, [], a.mood, None, "auto", [spec], f"vehicle_{a.id}", a.scale, a.exposure)


def _vspec(txt):
    """--vehicle "car_sedan,at=0:0:4,yaw=0.6,steer=0.4,crumple=0.6,dist=1.2,lights=1,tint=#ffffff" -> LookDev vehicle"""
    parts = txt.split(","); v = {"id": parts[0]}
    for kv in parts[1:]:
        k, _, x = kv.partition("=")
        if k == "at": v["at"] = [float(q) for q in x.split(":")]
        elif k == "lights": v["lights"] = x not in ("0", "false", "")
        elif k in ("tint", "name"): v[k] = x
        else: v[k] = float(x)
    return v


def _lookdev(p, cfg, sets, mood, cams, figure, vehicles, name, scale, exposure=0.0, extra=None):
    """LookDev composition: one still per camera (half size) -> labelled tile out/lookdev_<name>.jpg + the cameras it
    used as out/lookdev_<name>_cams.json (edit it and pass it back with --cams)"""
    props = dict(sets=sets, mood=mood, figure=figure, vehicles=vehicles)
    if cams: props["cams"] = cams
    if exposure: props["exposure"] = exposure
    props.update(extra or {})   # e.g. {"up": {"agx": false, "hdri": false, "soft": false}} (src/upgrade.ts: the old look)
    n = len(cams) if cams else 3
    _bundle(p, cfg)
    sd = p / "out" / "stills"; sd.mkdir(parents=True, exist_ok=True)
    pf = p / "out" / "logs" / "lookdev_props.json"; pf.parent.mkdir(parents=True, exist_ok=True)
    outs, qa, used, t0 = [], [], {}, time.time()
    with Lock(cfg):
        for i in range(n):
            props["cam"] = i; pf.write_text(json.dumps(props))
            o = sd / f"lookdev_{name}_{i}.jpg"; t = time.time()
            got = _npx_qa(p, cfg, ["still", "build", "LookDev", str(o), "--frame=0", f"--scale={scale}", *RENDER, f"--props={pf}"],
                          tags=QA_TAGS + ("LOOKDEV CAM",), show=False)
            for l in got:
                m = re.match(r"LOOKDEV CAM (\d+) (\{.*\})", l)
                if m: used[int(m.group(1))] = json.loads(m.group(2))
                elif l not in qa:
                    qa.append(l); print("  QA", l)
            print(f"  cam {i}: {time.time() - t:.1f} s"); outs.append(o)
    labels = []
    for i in range(n):
        c = used.get(i, {})
        pos = " ".join(f"{x:g}" for x in c.get("pos", [])); look = " ".join(f"{x:g}" for x in c.get("look", []))
        labels.append((f"cam {i}  {c.get('kind', '')}  fov {c.get('fov', '')}".replace("/", "-"), f"pos {pos}   look {look}"))
    ins = sum((["-i", str(o)] for o in outs), [])
    dt = "drawtext=fontfile=public/fonts/Poppins-Bold.ttf:fontcolor=white:box=1:boxcolor=black@0.6:boxborderw=6:x=12"
    fc = ";".join(f"[{i}]{dt}:y=12:fontsize=20:text='{labels[i][0]}',{dt}:y=44:fontsize=15:text='{labels[i][1]}'[v{i}]" for i in range(n))
    fc += (";" + "".join(f"[v{i}]" for i in range(n)) + f"hstack={n}[o]") if n > 1 else ";[v0]null[o]"
    tile = p / "out" / f"lookdev_{name}.jpg"
    sh(["ffmpeg", "-v", "error", "-y", *ins, "-filter_complex", fc, "-map", "[o]", "-q:v", "3", tile], cwd=p, check=True)
    cj = p / "out" / f"lookdev_{name}_cams.json"
    cj.write_text(json.dumps([dict(pos=used[i]["pos"], look=used[i]["look"], fov=used[i]["fov"]) for i in sorted(used)], indent=1))
    print(f"lookdev: {n} views in {time.time() - t0:.0f} s -> {tile}\n  cameras: {cj} (edit, pass back with --cams)")
    print(_qa_log(p, "lookdev", qa))


def cmd_lookdev(a):
    """look-dev stills of exported sets: `lookdev road:day tree:tree --mood day`; no set + --vehicle draws a plain ground"""
    p, cfg = proj(a); sets = []
    for s in a.sets:
        n, _, st = s.partition(":"); st = st or "day"
        if not (p / "public" / "sets" / f"{n}_{st}.glb").exists(): sys.exit(f"public/sets/{n}_{st}.glb missing: `export {n} --state {st}` first")
        sets.append([n, st])
    veh = [_vspec(v) for v in a.vehicle or []]
    for v in veh:
        if not (p / "public" / "vehicles" / f"{v['id']}.glb").exists(): sys.exit(f"public/vehicles/{v['id']}.glb missing: `vehicle {v['id']}` first")
    if not sets and not veh: sys.exit("give at least one <set>:<state> (or a --vehicle)")
    cams = json.loads(Path(a.cams).read_text()) if a.cams else None
    fig = a.figure if a.figure in ("auto", "none") else [float(x) for x in a.figure.split(",")]
    name = a.name or ("_".join(f"{n}_{st}" for n, st in sets) if sets else "vehicle_" + "_".join(v["id"] for v in veh))
    extra = json.loads(Path(a.props).read_text(encoding="utf-8") if Path(a.props).exists() else a.props) if a.props else None
    _lookdev(p, cfg, sets, a.mood, cams, None if fig == "none" else fig, veh, name, a.scale, a.exposure, extra)


# ------------------------------------------------------------------ pictures
def cmd_castsheet(a):
    p, cfg = proj(a); _bundle(p, cfg)
    with Lock(cfg): _npx(p, cfg, ["still", "build", "Cast", "out/castsheet.png", *RENDER, "--log=error"])
    print(p / "out" / "castsheet.png")


def cmd_cards(a):
    """flat-card FALLBACK (crowds, extras, poses Mixamo cannot do). blender/cards_plan.json:
       {"static": [{"who": "extra1", "exprs": ["sad", "neutral"], "poses": ["stand", "lie"], "prop": null, "mouth": false}]}
       every entry -> exprs x poses x blink 0/1 (x mouth 0/0.5/0.9 when mouth is true) -> src/cards.gen.json (manifest),
       CardExport -> public/cards/<id>.png (1200x1300, feet at 600,1230), heads measured -> public/cards/meta.json
       + the manifest's "m" fields (world/Card.tsx cardHead, shadow width; head numbers are for upright poses only)."""
    p, cfg = proj(a); man = p / "src" / "cards.gen.json"; out = p / "public" / "cards"
    if not a.meta_only:
        plan = json.loads((p / "blender" / "cards_plan.json").read_text())
        if plan.get("motion"): print("WARN cards_plan.json 'motion' is ignored here: moving characters are 3D stickmen (Mixamo)")
        L = []
        for s in plan.get("static", []):
            for e in s["exprs"]:
                for po in s["poses"]:
                    for bl in (0, 1):
                        for mo in ([0, 0.5, 0.9] if s.get("mouth") else [0]):
                            L.append(dict(id=len(L), who=s["who"], expr=e, pose=po, blink=bl, mouth=mo, prop=s.get("prop"), facing=s.get("facing", 1)))
        if not L: sys.exit("blender/cards_plan.json has no static entries")
        man.write_text(json.dumps(L, indent=0)); print(len(L), "card states ->", man)
        shutil.rmtree(out, ignore_errors=True); tmp = p / "out" / "cards_seq"; shutil.rmtree(tmp, ignore_errors=True)
        _bundle(p, cfg); t = time.time()
        with Lock(cfg):
            _npx(p, cfg, ["render", "build", "CardExport", str(tmp), "--sequence", "--image-format=png", *RENDER, "--concurrency=3", "--log=error"])
        files = sorted(tmp.glob("element-*.png"))
        if len(files) != len(L): sys.exit(f"CardExport wrote {len(files)} PNGs for {len(L)} states")
        out.mkdir(parents=True, exist_ok=True)
        for e, f in zip(L, files): shutil.move(str(f), out / f"{e['id']}.png")
        shutil.rmtree(tmp, ignore_errors=True); print(f"rendered {len(L)} cards in {time.time() - t:.0f} s -> {out}")
    try: import numpy, PIL  # noqa: F401
    except ImportError:   # measure with the config python (numpy + pillow)
        sh([cfg["python"], __file__, "-p", p, "cards", "--meta-only"], check=True); return
    import numpy as np
    from PIL import Image
    L = json.loads(man.read_text())
    def meta(e):
        al = np.array(Image.open(out / f"{e['id']}.png").convert("RGBA"))[:, :, 3]
        ys, xs = np.nonzero(al > 128); top = int(ys.min())
        if e["pose"] in ("stand", "walk", "run", "pointR", "pointL", "armsUp", "wave", "hold"):
            cy = 1230 - 919 + 144                       # upright: head centre = feet - STAND_PX + half a head (hat brims fool the widest-row search)
        else:
            band = al[top:top + 330] > 128; cy = top + int(np.argmax(band.sum(1)))
        row = np.nonzero(al[cy] > 128)[0]
        return dict(top=top, hx=int((row.min() + row.max()) // 2), hy=int(cy), x0=int(xs.min()), x1=int(xs.max()))
    M = {str(e["id"]): meta(e) for e in L}
    for e in L: e["m"] = M[str(e["id"])]
    (out / "meta.json").write_text(json.dumps(M)); man.write_text(json.dumps(L, indent=0))
    print("public/cards/meta.json:", len(M), "cards measured (also in src/cards.gen.json)")


def _stills(p, cfg, frames, scale, name, sheet_name, label, props=None):
    """Film stills at global frames (+ a side-by-side sheet); QA console tags printed per frame"""
    _bundle(p, cfg); outs, qa = [], []
    extra = [f"--props={props}"] if props else []
    with Lock(cfg):
        for f in frames:
            o = p / "out" / "stills" / name.format(f=f); t = time.time()
            qa += _npx_qa(p, cfg, ["still", "build", "Film", str(o), f"--frame={f}", f"--scale={scale}", *RENDER, *extra])
            print(f"  frame {f}: {time.time() - t:.0f} s"); outs.append(o)
    if len(outs) > 1:
        sheet = p / "out" / "stills" / sheet_name
        ins = sum((["-i", str(o)] for o in outs), [])
        sh(["ffmpeg", "-v", "error", "-y", *ins, "-filter_complex", f"hstack={len(outs)},scale={min(2400, 540 * len(outs))}:-1", sheet], check=True)
        print(sheet)
    for o in outs: print(o)
    print(_qa_log(p, label, qa))


def _props_file(p, txt, name):
    """--props: inline JSON or a JSON file -> out/logs/<name>.json (Remotion --props takes a file)"""
    if not txt: return None
    data = json.loads(Path(txt).read_text(encoding="utf-8") if Path(txt).exists() else txt)
    f = p / "out" / "logs" / f"{name}.json"; f.parent.mkdir(parents=True, exist_ok=True); f.write_text(json.dumps(data))
    return f


def cmd_still(a):
    p, cfg = proj(a)
    tag = f"_{a.tag}" if a.tag else ""
    _stills(p, cfg, a.frames, a.scale, "f_{f:05d}" + tag + ".jpg", f"sheet{tag}.jpg", "still", props=_props_file(p, a.props, "still_props"))


def _shot_len(p, sid):
    try:
        for s in json.loads((p / "src" / "shots.gen.json").read_text()):
            if int(s["id"]) == sid: return int(s["b"]) - int(s["a"])
    except Exception: pass
    return None


def cmd_cam(a):
    """camera authored in BACKGROUND Blender (never the user's open Blender): blender/cams/<shot>.json (spec, see
    blender/cam_shot.py) + the shot's ShotDef.paths exported from three.js (CamPaths composition) -> keyed stand-ins,
    ONE eased move (Bezier auto-clamped, Track To, no roll), every frame -> public/cams/<shot>.json for
    world/blenderCam.ts, the scene -> blender/cams/<shot>.blend, Workbench previews -> out/cams/."""
    p, cfg = proj(a)
    m = re.search(r"\d+", a.shot)
    if not m: sys.exit("shot name like s03")
    sid, shot = int(m.group()), a.shot
    spec_f = p / "blender" / "cams" / f"{shot}.json"; spec_f.parent.mkdir(parents=True, exist_ok=True)
    n = _shot_len(p, sid)
    if not spec_f.exists():
        sets = sorted(f.stem for f in (p / "public" / "sets").glob("*.glb"))
        N = n or 150
        spec_f.write_text(json.dumps({"set": sets[0] if sets else None, "frames": N, "fps": 30, "lens": 50,
            "keys": [{"f": 0, "pos": [0, 1.5, 6], "look": [0, 1.1, 0]}, {"f": N - 1, "pos": [0.8, 1.6, 5.2], "look": [0, 1.15, 0]}],
            "standins": [], "previews": [0, N // 2, N - 1]}, indent=1))
        sys.exit(f"wrote a starter spec {spec_f}: set the set, keys (three coords) and lens, then run `cam {shot}` again")
    spec = json.loads(spec_f.read_text(encoding="utf-8"))
    if n and spec.get("frames") != n:
        if spec.get("frames"): print(f"WARN spec frames {spec.get('frames')} != shot length {n} (src/shots.gen.json): using {n}")
        spec["frames"] = n; spec_f.write_text(json.dumps(spec, indent=1))
    if not spec.get("frames"): sys.exit("spec has no frames and the shot is not in src/shots.gen.json")
    if spec.get("set") and not (p / "public" / "sets" / f"{spec['set']}.glb").exists(): sys.exit(f"public/sets/{spec['set']}.glb missing")
    paths_f = p / "public" / "cams" / "paths" / f"{shot}.json"
    if not a.export_only and not a.no_paths:
        # three.js side: the shot's ShotDef.paths at every frame (CAMPATH console lines from the CamPaths composition)
        _bundle(p, cfg)
        pf = p / "out" / "logs" / "campaths_props.json"; pf.parent.mkdir(parents=True, exist_ok=True)
        pf.write_text(json.dumps({"shot": sid, "n": spec["frames"], "fps": spec.get("fps", 30)}))
        with Lock(cfg):
            got = _npx_qa(p, cfg, ["still", "build", "CamPaths", str(p / "out" / "logs" / "campaths.png"), "--frame=0", *RENDER, f"--props={pf}"],
                          tags=("CAMPATH",), show=False)
        things, done = {}, None
        for l in got:
            d = json.loads(l[len("CAMPATH "):])
            if "error" in d: sys.exit(d["error"])
            if "done" in d: done = d; continue
            t = things.setdefault(d["name"], {"kind": d["kind"], "height": d.get("height"), "size": d.get("size"), "p": [], "yaw": [], "_c": {}})
            t["_c"][d["f0"]] = (d["p"], d["yaw"])
        for t in things.values():
            for k in sorted(t["_c"]): t["p"] += t["_c"][k][0]; t["yaw"] += t["_c"][k][1]
            del t["_c"]
        if done is None: sys.exit("CamPaths gave no 'CAMPATH done' line (see the Remotion output)")
        if things:
            paths_f.parent.mkdir(parents=True, exist_ok=True)
            paths_f.write_text(json.dumps({"fps": spec.get("fps", 30), "n": spec["frames"], "things": things}))
            print("stand-in paths: " + ", ".join(f"{k} ({v['kind']}, {len(v['p'])} f)" for k, v in things.items()) + f" -> {paths_f}")
        else:
            if paths_f.exists(): paths_f.unlink()
            print("the shot has no ShotDef.paths: only the spec's fixed stand-ins (add paths for moving characters / vehicles)")
    script = p / "blender" / "cam_shot.py"
    if not script.exists(): script = TEMPLATE / "blender" / "cam_shot.py"
    for old in (p / "out" / "cams").glob(f"{shot}_f*.png"): old.unlink()
    with Lock(cfg):
        r = sh([cfg["blender"], "-b", "--factory-startup", "--python-exit-code", "1", "-P", script, "--", p, shot, *(["--export-only"] if a.export_only else [])],
               capture_output=True, text=True, encoding="utf-8", errors="replace")
    log = r.stdout + r.stderr
    (p / "out" / "logs").mkdir(parents=True, exist_ok=True); (p / "out" / "logs" / f"cam_{shot}.txt").write_text(log, encoding="utf-8")
    lines = [l for l in log.splitlines() if l.startswith("CAM ") or "Error" in l or "Traceback" in l or 'File "' in l]
    print("\n".join(lines) or log[-2000:])
    prev = sorted((p / "out" / "cams").glob(f"{shot}_f*.png"))
    if prev:
        sheet = p / "out" / "cams" / f"{shot}_sheet.jpg"
        ins = sum((["-i", str(o)] for o in prev), [])
        sh(["ffmpeg", "-v", "error", "-y", *ins, "-filter_complex", f"hstack={len(prev)}" if len(prev) > 1 else "null", sheet])
        print("previews:", sheet)
    if r.returncode != 0 or any(l.startswith("CAM FAIL") for l in lines) or not any(l.startswith("CAM EXPORT") for l in lines):
        sys.exit(f"cam {shot}: FAILED (fix the CAM FAIL lines / Traceback; log out/logs/cam_{shot}.txt)")
    print(f'cam {shot}: OK -> public/cams/{shot}.json; in the shot: needs [needCam("{shot}")], cam = UP().bcam ? blenderCam("{shot}", t) : <fallback>')


def cmd_grips(a):
    """grip close-ups: Film with input props {"grip": {who, hand, dist}}; the engine View swaps the camera for a 35 deg
    lens aimed at that hand (world/registry JOINTS) from the camera side. One still per frame + grip_sheet.jpg."""
    p, cfg = proj(a)
    props = p / "out" / "stills" / "grip_props.json"; props.parent.mkdir(parents=True, exist_ok=True)
    props.write_text(json.dumps({"grip": {"who": a.who, "hand": a.hand, "dist": a.dist}}))
    _stills(p, cfg, a.frames, a.scale, "grip_{f}.jpg", "grip_sheet.jpg", "grips", props=props)
    print("check: the prop sits on its grip point in the hand, no fingers/sticks through it, the whole action reads")


def _splice_shots(p, cfg, film, ids, scale):
    """speed-up (user 2026-11-19): re-render only the changed shots' frame ranges and splice them into the existing draft
    film (same scale), instead of re-rendering the whole film (~30 min -> a few minutes per shot)."""
    if not film.exists(): sys.exit("--shots needs an existing out/film_draft.mp4 (run `render --draft` once)")
    shots = {s["id"]: s for s in json.loads((p / "src" / "shots.gen.json").read_text())}
    total = json.loads((p / "src" / "film.json").read_text()).get("frames") if (p / "src" / "film.json").exists() else None
    patches, qa = [], None
    for i in sorted(ids):
        sh_ = shots[i]; a0, b0 = sh_["a"], sh_["b"] - 1
        part = p / "out" / f"patch_s{i:02d}.mp4"
        qa = _npx_qa(p, cfg, ["render", "build", "Film", str(part), *RENDER, f"--scale={scale}", f"--concurrency={CONC}", "--codec=h264", "--crf=20", "--muted", f"--frames={a0}-{b0}"])
        patches.append((a0, b0, part))
    # rebuild: original segments between patches + the patches, re-encoded once
    ins, parts, cur, k = ["-i", str(film)], [], 0, 1
    for (a0, b0, part) in patches:
        if a0 > cur: parts.append(f"[0:v]trim=start_frame={cur}:end_frame={a0},setpts=PTS-STARTPTS[s{len(parts)}]")
        ins += ["-i", str(part)]; parts.append(f"[{k}:v]setpts=PTS-STARTPTS[s{len(parts)}]"); k += 1; cur = b0 + 1
    parts.append(f"[0:v]trim=start_frame={cur}" + (f":end_frame={total}" if total else "") + f",setpts=PTS-STARTPTS[s{len(parts)}]")
    fc = ";".join(parts) + ";" + "".join(f"[s{j}]" for j in range(len(parts))) + f"concat=n={len(parts)}:v=1:a=0[v]"
    tmp = film.with_name("film_draft_spliced.mp4")
    sh(["ffmpeg", "-v", "error", "-y", *ins, "-filter_complex", fc, "-map", "[v]", "-r", "30", "-c:v", "libx264", "-crf", "20", "-pix_fmt", "yuv420p", str(tmp)], check=True)
    shutil.move(str(tmp), str(film))
    print("spliced shots", ids, "into", film)
    return qa


def cmd_render(a):
    p, cfg = proj(a); _bundle(p, cfg); pub = p / "public"; mark = pub / ".film_draft"
    rng = ["--frames=" + a.frames] if a.frames else []
    t = time.time()
    with Lock(cfg):
        if a.draft:
            out = p / "out" / "film_draft.mp4"
            if a.shots:
                qa = _splice_shots(p, cfg, out, [int(x) for x in a.shots.split(",") if x.strip()], a.scale)
            else:
                qa = _npx_qa(p, cfg, ["render", "build", "Film", str(out), *RENDER, f"--scale={a.scale}", f"--concurrency={CONC}", "--codec=h264", "--crf=20", "--muted", *rng])
        else:
            sub = p / "out" / "film_sub.mp4"; out = p / "out" / "film_blur.mp4"
            # output frame f = sub-frames 4f..4f+3 (tmix of 4, keep every 4th): film frames A-B -> sub-frames 4A..4B+3
            ab = [int(x) for x in a.frames.split("-")] if a.frames else []
            subr = [f"--frames={ab[0] * 4}-{ab[-1] * 4 + 3}"] if ab else []
            qa = _npx_qa(p, cfg, ["render", "build", "FilmSub", str(sub), *RENDER, f"--concurrency={CONC}", "--codec=h264", "--crf=12", "--pixel-format=yuv420p",
                                  "--muted", *subr])
            sh(["ffmpeg", "-v", "error", "-y", "-i", sub, "-vf", "tmix=frames=4:weights='1 1 1 1',select='eq(mod(n\\,4)\\,3)',setpts=N/30/TB",
                "-r", "30", "-c:v", "libx264", "-crf", "16", "-pix_fmt", "yuv420p", out], check=True)
    print(f"render: {time.time() - t:.0f} s;", _qa_log(p, "render", qa))
    if a.frames: print("partial render (review only, public/film.mp4 untouched):", out); return
    shutil.copy(out, pub / "film.mp4")
    if a.draft: mark.write_text("public/film.mp4 is the DRAFT picture")
    elif mark.exists(): mark.unlink()
    print("public/film.mp4" + (" (draft)" if a.draft else " (motion blur)"), "-> next: `qa public/film.mp4`, then sound, then `final`")


def _draft_mix(p):
    pub = p / "public"; mix = pub / "mix.wav"; mark = pub / ".mix_draft"
    if mix.exists() and not (mark.exists() and mark.read_text() == str(mix.stat().st_size)): return False
    ins = ["-i", pub / "voice.wav"]; fc = "[0]anull[v]"
    if (pub / "bed.wav").exists():
        ins += ["-stream_loop", "-1", "-i", pub / "bed.wav"]; fc = "[1]volume=-16dB[b];[0][b]amix=inputs=2:duration=first:normalize=0[v]"
    sh(["ffmpeg", "-v", "error", "-y", *ins, "-filter_complex", fc + ";[v]loudnorm=I=-16:TP=-1.5[o]", "-map", "[o]", "-ar", "48000", mix], check=True)
    mark.write_text(str(mix.stat().st_size)); return True


def cmd_final(a):
    p, cfg = proj(a); pub = p / "public"
    if not (pub / "film.mp4").exists(): sys.exit("public/film.mp4 missing: `render` first")
    if a.draft:
        if (pub / "voice.wav").exists() and _draft_mix(p): print("draft sound: voice (+ bed.wav) -> public/mix.wav")
    else:
        if (pub / ".film_draft").exists(): sys.exit("public/film.mp4 is the draft picture: `render` without --draft first")
        m = pub / ".mix_draft"
        if m.exists() and (pub / "mix.wav").exists() and m.read_text() == str((pub / "mix.wav").stat().st_size):
            sys.exit("public/mix.wav is the draft voice-only mix: build the soundtrack with the real-sound skill first")
        if m.exists(): m.unlink()
    if not (pub / "mix.wav").exists(): sys.exit("public/mix.wav missing: real-sound skill (or `final --draft` with public/voice.wav)")
    _bundle(p, cfg); out = p / "out" / ("draft.mp4" if a.draft else "final.mp4")
    q = ["--scale=0.5", "--crf=23"] if a.draft else ["--crf=16"]
    _npx(p, cfg, ["render", "build", "Final", str(out), "--codec=h264", *q, "--concurrency=2", "--timeout=180000"])
    r = subprocess.run(["ffmpeg", "-nostats", "-i", str(out), "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True)
    print("\n".join(l for l in r.stderr.splitlines() if l.strip().startswith(("I:", "Peak:")))); print(out)


def cmd_qa(a):
    p, cfg = proj(a)
    v = Path(a.video) if a.video else next((x for x in (p / "out" / "final.mp4", p / "public" / "film.mp4") if x.exists()), None)
    if not v or not v.exists(): sys.exit("nothing to check: give a video or render first")
    py = cfg["python"]
    print("== flicker (one-frame spikes; exit 3 = broken render tab)"); sh([py, "-I", TOOLS / "flicker.py", v])
    print("== critic (timing vs words, hard-cut sync, static runs >= 2 s, caption edges, audio streams)")
    sh([py, "-I", TOOLS / "critic.py", p, v, "--json", p / "out" / "qa" / "critic.json"])
    print("== pacing (beats/min, % still, % fast, hard cuts, mean L*) - targets: FORMULA.md (camera moving ~96 %, L* >= 50)")
    sh([py, "-I", TOOLS / "analyze_pacing.py", v])
    print("== world colour (WORLD.md: mean saturation >= 25, grey seconds <= 20 %; hue by eye)")
    sh([py, "-I", TOOLS / "world_colour.py", v])
    sheet = p / "out" / "qa_sheet.jpg"
    sh(["ffmpeg", "-v", "error", "-y", "-i", v, "-vf", "fps=2,scale=135:-1,tile=12x8:padding=2", "-frames:v", "1", sheet], check=True)
    r = subprocess.run(["ffmpeg", "-nostats", "-i", str(v), "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True)
    loud = [l.strip() for l in r.stderr.splitlines() if l.strip().startswith(("I:", "Peak:"))]
    print("== loudness (target -14 LUFS, <= -1 dBTP):", " | ".join(loud) or "no audio")
    if (p / "public" / "voice.wav").exists() and (p / "public" / "mix.wav").exists():
        print("== levels (public/mix.wav vs public/voice.wav)"); _levels(p, cfg, [])
    print(f"== contact sheet (2 fps): {sheet}\n   Check by eye, then read it MUTED:")
    for c in ("nothing passes through anything; nothing floats; feet on surfaces (fix list -> contact sheet of the fixed parts)",
              "shadows sit UNDER objects on a surface, never drawn over them; contact shadow under every character and prop",
              "the main character is always sharp (focus on the hero, never blur the people in front)",
              "all text and tags fully in frame, clear of edges, captions and the YouTube buttons; long text on 2 lines",
              "props in the hand (grip point on the hand), never through the legs or body; whole actions shown (reach, grab, lift)",
              "the story reads with the sound off (key-fact tags where it does not)",
              "no empty first frame: frame 0 shows the strangest moment of the hook",
              "WORLD.md: coloured sky with clouds / sun / moon in every exterior and window; grass areas covered; 4 coloured depth layers, no grey boxes",
              "WORLD.md: >= 3 saturated accents per frame, night ultramarine (not lavender), hero props / inserts sharp and in the cartoon style"):
        print("   [ ]", c)


def _levels(p, cfg, extra):
    sh([cfg["python"], "-I", TOOLS / "levels.py", p, *extra])


def cmd_levels(a):
    """Phase 5 levels report: public/mix.wav vs public/voice.wav (+ stems, + the real-sound cue list)"""
    p, cfg = proj(a)
    for f in ("voice.wav", "mix.wav"):
        if not (p / "public" / f).exists(): sys.exit(f"public/{f} missing")
    extra = [*(["--stems", a.stems] if a.stems else []), *(["--cues", a.cues] if a.cues else []),
             *(["--cue-offset", str(a.cue_offset)] if a.cue_offset else []), *(["--json", a.json] if a.json else [])]
    _levels(p, cfg, extra)


def cmd_status(a):
    """every step in order, [x] when its output exists, then the first open step as NEXT (approvals stay the
    user's: a file existing does not mean it was approved)"""
    p, cfg = proj(a); pub, out = p / "public", p / "out"
    ex = lambda f: (p / f).exists()
    new = lambda f, *srcs: ex(f) and all(not ex(s) or (p / f).stat().st_mtime >= (p / s).stat().st_mtime for s in srcs)
    W = json.loads((p / "src" / "words.json").read_text()) if ex("src/words.json") else []
    shots = json.loads((p / "src" / "shots.gen.json").read_text()) if ex("src/shots.gen.json") else []
    idx = (p / "src" / "shots" / "index.ts").read_text(encoding="utf-8") if ex("src/shots/index.ts") else ""
    missing = [s["id"] for s in shots if not re.search(rf"\bs0*{s['id']}\b", idx)]
    draft_pic, mixw = ex("public/.film_draft"), pub / "mix.wav"
    draft_mix = ex("public/.mix_draft") and mixw.exists() and (pub / ".mix_draft").read_text() == str(mixw.stat().st_size)
    steps = [
        ("script (voice/vo.txt + voice/vo_tags.txt)", all(ex(f"voice/{f}") and not (p / "voice" / f).read_text(encoding="utf-8").startswith("Replace this file")
                                                           for f in ("vo.txt", "vo_tags.txt")),
         "write the script per SCRIPT.md + FORMULA.md (push-back check), STOP for approval, then voice/vo.txt + voice/vo_tags.txt"),
        ("plan (PLAN.md)", ex("PLAN.md"), "write PLAN.md: shot table, cast, sets, sound beats (SKILL.md step 3), STOP"),
        ("voice (public/voice.wav + src/words.json)", ex("public/voice.wav") and len(W) > 0, "S voice --takes 2"),
        ("timing (SHOT_FRAMES.txt newer than words + plan)", new("SHOT_FRAMES.txt", "src/words.json", "shots_plan.json"),
         "shots_plan.json (first word per shot), then S timing [--frames N when cut to a finished mix]; src/edit.json"),
        ("clips (public/clips)", any((pub / "clips").glob("*.glb")), "download Mixamo clips (Mixamo MCP, in-place walks), then S clip <Clip> ..."),
        ("castsheet (out/castsheet.png)", ex("out/castsheet.png"), "src/char/cast.ts + props, then S castsheet, STOP for the cast look"),
        ("sets (public/sets)", any((pub / "sets").glob("*.glb")),
         "S library use <set>, or blender/sets_<name>.py + S export <set> --state ... (fix every WARN), STOP"),
        ("shots registered (src/shots/index.ts)" + (f": missing {missing}" if missing else ""), bool(shots) and not missing,
         f"write src/shots/sNN.tsx for shots {missing} and register them in src/shots/index.ts"),
        ("stills (out/stills/f_*.jpg)", any((out / "stills").glob("f_*.jpg")),
         "S still <frames> (one per shot, lens clear), S grips <frames> --who <id> for every held prop"),
        ("picture (public/film.mp4)" + (" DRAFT" if draft_pic else ""), ex("public/film.mp4"),
         "S render --draft, S final --draft, deliver the DRAFT with weak spots, STOP for notes"),
        ("sound (public/mix.wav from real-sound)", mixw.exists() and not draft_mix,
         "real-sound skill with references/SOUND_BRIEF_TEMPLATE.md -> public/mix.wav"),
        ("levels report (out/qa/levels.json newer than the mix)", mixw.exists() and new("out/qa/levels.json", "public/mix.wav", "public/voice.wav"),
         "S levels: fix the WARN lines with the sound agent"),
        ("final picture (motion blur)", ex("public/film.mp4") and not draft_pic, "S render, then S qa public/film.mp4"),
        ("final (out/final.mp4 newer than picture + mix)", new("out/final.mp4", "public/film.mp4", "public/mix.wav"), "S final, then S qa"),
    ]
    nxt = None
    for name, done, todo in steps:
        print(("  [x] " if done else "  [ ] ") + name)
        if not done and nxt is None: nxt = todo
    print("  (reference ref/ref.mp4: " + ("yes" if ex("ref/ref.mp4") else "none; optional: S ref <url>") + ")")
    print("\nNEXT: " + (nxt or "deliver out/final.mp4 with credits and the weak-spot list, then write what this film fixed into the skill"))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("-p", "--project")
    sp = ap.add_subparsers(dest="cmd", required=True)
    sp.add_parser("doctor")
    c = sp.add_parser("config"); c.add_argument("--set", nargs=2, action="append", metavar=("KEY", "VALUE"))
    c = sp.add_parser("install-skills"); c.add_argument("--dest"); c.add_argument("--earshot-dir")
    c = sp.add_parser("new"); c.add_argument("dir")
    c = sp.add_parser("ref"); c.add_argument("url")
    c = sp.add_parser("voice"); c.add_argument("--takes", type=int, default=2); c.add_argument("--wpm", type=int)
    c = sp.add_parser("timing"); g = c.add_mutually_exclusive_group()
    g.add_argument("--frames", type=int, help="film length in frames (e.g. the length of a finished mix)")
    g.add_argument("--end-s", type=float, help="film length in seconds")
    c = sp.add_parser("clip"); c.add_argument("clips", nargs="+")
    c = sp.add_parser("prop"); c.add_argument("id"); c.add_argument("src")
    c = sp.add_parser("assets"); c.add_argument("ids", nargs="+")
    c = sp.add_parser("export"); c.add_argument("set"); c.add_argument("--state", nargs="+", default=["day"])
    c.add_argument("--bake", action="store_true", help="bake node-recoloured materials to plain textures (blender/export.py --bake)")
    c.add_argument("--bake-res", type=int, default=1024, help="max bake resolution (px)")
    c.add_argument("--light", action="store_true", help="bake bounce light + AO of the state's lights/world into lightmaps (Cycles GPU)")
    c.add_argument("--light-res", type=int, default=1024, help="max lightmap size per object (px)")
    c.add_argument("--light-samples", type=int, default=256, help="Cycles samples for the lightmap bake (AO: a quarter)")
    c.add_argument("--draft", action="store_true", help="draft bake: --light-samples 64 (~4x faster; full samples for the final)")
    c.add_argument("--light-density", type=float, default=64, help="lightmap px per metre")
    c.add_argument("--light-px", type=float, default=3.5e6, help="pixel budget of the lightmap atlas (density drops to fit; bake time ~ px x samples)")
    c = sp.add_parser("library"); c.add_argument("action", choices=["list", "save", "use"]); c.add_argument("set", nargs="?")
    c = sp.add_parser("vehicle"); c.add_argument("id"); c.add_argument("--from", dest="src", help="asset id in blender/assets or a .blend (default: id)")
    c.add_argument("--yaw", type=float, default=0, help="turn the source about Z first (degrees) so its front faces +Y")
    c.add_argument("--bake", action="store_true"); c.add_argument("--bake-res", type=int, default=1024)
    c.add_argument("--no-wall", action="store_true", help="no 1 cm SOLIDIFY wall on the (open-shell) meshes")
    c.add_argument("--still", action="store_true", help="then a LookDev still of it -> out/lookdev_vehicle_<id>.jpg")
    c.add_argument("--steer", type=float, default=0.45); c.add_argument("--crumple", type=float, default=0.0)
    c.add_argument("--dist", type=float, default=0.0); c.add_argument("--still-yaw", type=float, default=0.0)
    c.add_argument("--lights", action="store_true"); c.add_argument("--mood", default="day")
    c.add_argument("--scale", default="0.5"); c.add_argument("--exposure", type=float, default=0)
    c = sp.add_parser("lookdev"); c.add_argument("sets", nargs="*", help="<set>:<state> (state defaults to day)")
    c.add_argument("--mood", default="day", help="day dusk night sunrise golden lamp cold")
    c.add_argument("--cams", help="JSON file: [{pos, look, fov}] (three coords); default = 3 views from the first set")
    c.add_argument("--figure", default="auto", help="x,y,z of a 1.7 m stand-in (three coords), auto or none")
    c.add_argument("--vehicle", action="append", help='e.g. "car_sedan,at=0:0:4,yaw=0.6,steer=0.4,crumple=0.6,lights=1"')
    c.add_argument("--name", help="output name (default <set>_<state>[_<set>_<state>])")
    c.add_argument("--scale", default="0.5"); c.add_argument("--exposure", type=float, default=0)
    c.add_argument("--props", help='extra input props JSON (inline or a file), e.g. \'{"up": {"agx": false, "hdri": false, "soft": false}}\' = the old look (use with --name)')
    sp.add_parser("castsheet")
    c = sp.add_parser("cards"); c.add_argument("--meta-only", action="store_true")
    c = sp.add_parser("still"); c.add_argument("frames", type=int, nargs="+"); c.add_argument("--scale", default="0.5")
    c.add_argument("--props", help='input props JSON (inline or a file), e.g. \'{"up": {"agx": false, "hdri": false, "soft": false}}\' = the old look')
    c.add_argument("--tag", help="suffix for the output names (f_00120_<tag>.jpg), e.g. old / new")
    c = sp.add_parser("cam"); c.add_argument("shot", help="shot name, e.g. s03 (spec blender/cams/s03.json)")
    c.add_argument("--export-only", action="store_true", help="re-export blender/cams/<shot>.blend (after tweaking it by hand) without rebuilding")
    c.add_argument("--no-paths", action="store_true", help="skip the three.js stand-in path export (reuse public/cams/paths/<shot>.json)")
    c = sp.add_parser("grips"); c.add_argument("frames", type=int, nargs="+"); c.add_argument("--who", required=True)
    c.add_argument("--hand", choices=["right", "left", "both"], default="right"); c.add_argument("--dist", type=float, default=0.9)
    c.add_argument("--scale", default="0.5")
    c = sp.add_parser("render"); c.add_argument("--draft", action="store_true"); c.add_argument("--frames")
    c.add_argument("--scale", type=float, default=0.5, help="draft scale (0.25 = quarter size, ~2x faster)")
    c.add_argument("--shots", help="draft only: re-render just these shot ids (e.g. 3,5) and splice them into out/film_draft.mp4")
    c = sp.add_parser("final"); c.add_argument("--draft", action="store_true")
    c = sp.add_parser("levels"); c.add_argument("--stems"); c.add_argument("--cues"); c.add_argument("--json")
    c.add_argument("--cue-offset", type=float, default=0, help="frames to subtract from cue frames (segment of a longer film)")
    c = sp.add_parser("qa"); c.add_argument("video", nargs="?")
    sp.add_parser("status")
    a = ap.parse_args()
    try: sys.stdout.reconfigure(line_buffering=True)   # our lines stay in order with the tools' output
    except Exception: pass
    globals()["cmd_" + a.cmd.replace("-", "_")](a)


if __name__ == "__main__":
    main()
