"""Check a meter film's scene before the first still: every cue word must be spoken, and nothing may be unused.

  python check_cues.py <project dir> [<project dir> ...]

Why: `still` and `render` start with `tsc --noEmit`, which stops on an unused import or constant (TS6133), and a cue
word that is not in src/words.json throws only when its shot is drawn. Twenty films at once (films 118-137)
lost three still runs to that. This reads src/shots/scene.tsx and src/meter.tsx and prints, per project:
  - words.json tokens that hold a digit (the speech check wrote a spoken number as digits: put the words back)
  - `word: "X"` / `wordAt("X")` cues whose word is not spoken (after the turn given by `after: t0(n)` when there is one)
  - imported names and `t0` / `t1` helpers that are never used
It does not replace a still: it only looks at words and imports.
"""
import json, re, sys
from pathlib import Path

norm = lambda s: re.sub(r"[^a-z0-9']", "", s.lower().replace("’", "'"))
bad = 0
for d in map(Path, sys.argv[1:]):
    W = json.loads((d / "src/words.json").read_text()); T = json.loads((d / "src/turns.json").read_text())
    toks = [norm(w["w"]) for w in W]; out = []
    digits = [w["w"] for w in W if re.search(r"\d", w["w"])]
    if digits: out.append(f"digits in words.json: {digits}")
    for fn in ("src/shots/scene.tsx", "src/meter.tsx"):
        s = (d / fn).read_text(); body = re.sub(r"^import .*$", "", s, flags=re.M)
        for m in re.finditer(r'word: "([^"]+)"(?:, after: t0\((\d+)\))?|wordAt\("([^"]+)"(?:, t0\((\d+)\))?', s):
            w = m.group(1) or m.group(3); n = m.group(2) or m.group(4)
            if norm(w) not in (toks[T[int(n) - 1]["i0"]:] if n else toks): out.append(f"{fn}: \"{w}\" is not spoken" + (f" from turn {n} on" if n else ""))
        for m in re.finditer(r"^import (?:type )?\{([^}]*)\} from", s, flags=re.M):
            for name in (x.strip() for x in m.group(1).split(",")):
                if name and not re.search(r"\b" + re.escape(name) + r"\b", body): out.append(f"{fn}: import {name} is unused")
        for h in ("t0", "t1"):
            if re.search(r"^const " + h + r" = ", s, flags=re.M) and not re.search(r"\b" + h + r"\(", s): out.append(f"{fn}: const {h} is unused")
    print(d.name, "ok" if not out else "", f"({W[-1]['e']:.1f} s of speech)")
    for o in out: print("  " + o)
    bad += len(out)
sys.exit(1 if bad else 0)
