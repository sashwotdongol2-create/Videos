"""Camera QA against CAMERA_STUDY.md (RicksClips measured on 12 hits). Run on a project (and its rendered film):
    python camqa.py <project dir> [video.mp4]
Checks (PASS / FAIL with the RicksClips target):
  plan  : shot changes per minute (target 10-20), median shot length (2-5 s), changes on a word onset +-4 frames
          (>= 75 %), continuous share of transitions from src/edit.json (>= 60 %)
  video : camera moving (>= 90 % of frames), push rate when pushing (6-15 %/s), roll share of moving frames (<= 25 %),
          cuts made while moving on both sides (>= 80 %)"""
import json, statistics as st, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

def check(name, val, ok, target):
    print(f"{'PASS' if ok else 'FAIL'}  {name:42s} {val!s:>10}   target {target}"); return ok

def plan(P: Path):
    S = json.load(open(P / "src/shots.gen.json")); W = json.load(open(P / "src/words.json"))
    E = json.load(open(P / "src/edit.json")) if (P / "src/edit.json").exists() else {"cuts": [], "kinds": {}}
    dur = S[-1]["b"] / 30; n = len(S) - 1
    lens = [(s["b"] - s["a"]) / 30 for s in S]
    on = [w["s"] * 30 for w in W]
    near = sum(min(abs(s["a"] - o) for o in on) <= 4 for s in S[1:]) / max(1, n) * 100
    kinds = [("cut" if s["id"] in E.get("cuts", []) else E.get("kinds", {}).get(str(s["id"]), "dissolve")) for s in S[1:]]
    soft = sum(k != "cut" for k in kinds) / max(1, n) * 100
    r = [check("shot changes per minute", round(n / dur * 60, 1), 10 <= n / dur * 60 <= 20, "10-20 (RC 14.1)"),
         check("median shot length s", round(st.median(lens), 2), 2 <= st.median(lens) <= 5, "2-5 (RC 3.5)"),
         check("changes on a word onset (+-4 f) %", round(near, 1), near >= 75, ">= 75 (RC 78)"),
         check("continuous transitions %", round(soft, 1), soft >= 60, ">= 60 (RC 76)")]
    print("      transition kinds:", {k: kinds.count(k) for k in set(kinds)})
    return all(r)

def video(v: str):
    import analyze_motion, stats
    p = Path(v); analyze_motion.run(p) if not p.with_suffix(".frames.csv").exists() else None
    o, ev = stats.analyse(p.with_suffix(".frames.csv"))
    mm = o["motion_mix"]
    r = [check("camera moving % of frames", o["pct_time_moving"], o["pct_time_moving"] >= 90, ">= 90 (RC 96)"),
         check("push rate %/s", o["push_med_per_s"], 6 <= o["push_med_per_s"] <= 15, "6-15 (RC 10.8)"),
         check("roll share of moving frames %", mm["roll"], mm["roll"] <= 25, "<= 25 (RC 20)"),
         check("cuts while moving both sides %", o["cuts_with_motion_both_sides_pct"], o["kinds"]["cut"] == 0 or o["cuts_with_motion_both_sides_pct"] >= 80, ">= 80 (RC 100)")]
    print("      measured:", json.dumps({k: o[k] for k in ("events_per_min", "shot_med", "pct_soft", "kinds", "speed_med")}))
    return all(r)

if __name__ == "__main__":
    P = Path(sys.argv[1]); ok = True
    if (P / "src/shots.gen.json").exists(): print("== plan"); ok &= plan(P)
    if len(sys.argv) > 2: print("== video"); ok &= video(sys.argv[2])
    print("CAMQA", "PASS" if ok else "FAIL"); sys.exit(0 if ok else 1)
