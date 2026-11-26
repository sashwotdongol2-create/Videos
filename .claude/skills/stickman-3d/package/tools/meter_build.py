"""Write the three film files of scaffolded meter films from a spec file, with every cue on a word that was said.

  python meter_build.py <spec.py> [film id ...]          (after meter_film.py has made each project)

Why (films 138-157, 2026-11-26): in the batches before, a typed cue word that the voice had merged or dropped
stopped the build ("Flat line" -> "Flatline"), and twenty films are sixty hand-written files. Here a film is one record:
the turns, who reacts how at the end of each line, the meter values per turn, the cameras and the set. The beats are
written from src/words.json and src/turns.json, so each one names a word that exists (`after: t0(n)` keeps it on the
right turn), and the imports are worked out from what the code uses.

The spec file is plain Python and defines
  ROOT   the folder that holds the projects
  FILMS  a list of dicts: n, title, slug, fid, o (the partner's speaker name), end (the ending line), and
         turns = [(speaker, mode, text, gap), ...] exactly as in films.py (without the ending turn)
  S      a dict fid -> spec:
    pal, title (two lines), label, device (a comment), start, readoutW, v {turn: value or (value, offset)},
    readout (TS: "(v) => ...") or steps [(time as TS, text), ...], mconsts (TS put before the meter),
    dip (the turn where the second mistake starts: TRICK 1 ends there), win (the turn whose last word ends TRICK 2),
    castnote, note (one line each), jay (outfit, optional), hero {x, extra}, other {id, h, x, outfit, extra} or none,
    h0 / o0 (the first listening beat, "emote:expr"), act {turn: (speaker "emote:expr", listener "emote:expr:mark")},
    x [(who "h" | "o", turn, word index, "emote:expr:mark", edge, offset)] for beats inside a line,
    shots [(first turn, camera as TS | "A1" | "A2" | "END")], consts (TSX before the set), set (TSX inside <group>),
    duo (extra duo() fields, e.g. "fill: 0.58,")
An asides's two beats (sheepish, then talk on "Trick") and the wave on the ending are added for you.
Digits in words.json stop the build: put the words
back first (a token may hold two words, "nine hundred.").
"""
import importlib.util, json, re, sys
from pathlib import Path
_sp = importlib.util.spec_from_file_location("meter_spec", sys.argv[1]); _m = importlib.util.module_from_spec(_sp); _sp.loader.exec_module(_m)
ROOT = Path(_m.ROOT); SPEC = _m.S; F = {f["fid"]: f for f in _m.FILMS}
strip = lambda s: re.sub(r"\[[^\]]*\] *", "", s)
norm = lambda s: re.sub(r"[^a-z0-9']", "", s.lower())
q = lambda s: json.dumps(s, ensure_ascii=False)
KIT = ["boxG", "cylG", "sphG", "coneG", "torG", "M", "Label", "Flame", "Smoke"]
CS = ["Room", "Shelf", "Table", "Window", "Poster", "Plant", "Book", "Whiteboard", "ElevatorCar", "Door", "Counter", "Fridge", "StickyBoard", "Laptop", "PhoneStand", "Mug", "Clipboard", "Crate", "Bike", "Sign"]
PR = ["HOLD_R", "HOLD_L", "Mic", "Sheet", "Phone", "Trophy", "RingBox", "Ladle", "Booklet", "Stack", "Board", "CardProp", "Cone"]
JAY = 'torso: "#2e6f9a buttons", legs: "#2b2d35"'
A1, A2 = "{ hero: 3, w: 0.35 }", "{ hero: -3, w: 0.35 }"

def build(fid):
    f, sp = F[fid], SPEC[fid]; d = ROOT / f["slug"]
    W = json.loads((d / "src/words.json").read_text()); T = json.loads((d / "src/turns.json").read_text())
    nT = len(f["turns"])
    assert len(T) == nT + 1, (fid, len(T), nT)
    for w in W: assert not re.search(r"\d", w["w"]), f"{fid}: digits in words.json: {w['w']}"
    tw = lambda n: W[T[n - 1]["i0"]:T[n - 1]["i1"] + 1]
    def ref(n, k):
        """cue fields for word k of turn n (k < 0 counts from the end)"""
        ws = tw(n); k = k if k >= 0 else len(ws) + k; w = ws[k]
        first = next(i for i, x in enumerate(ws) if norm(x["w"]) == norm(w["w"]))
        after = f"t0({n})" if first == k else f"t0({n}) + {w['s'] - T[n - 1]['t0'] - 0.03:.2f}"
        return f"word: {q(w['w'])}, after: {after}", w
    def beat(n, k, a, edge=None, off=None):
        """-> [(time, text)]; a = "emote:expr:mark" (any part may be empty)"""
        em, ex, mk = (a.split(":") + ["", "", ""])[:3]; r, w = ref(n, k)
        at = (w["e"] if edge == "end" else w["s"]) + (off or 0)
        base = r + (', edge: "end"' if edge == "end" else "") + (f", offset: {off}" if off else "")
        out = []
        if em or ex: out.append((at, "{ " + base + (f', emote: "{em}"' if em else "") + (f', e: "{ex}"' if ex else "") + " }"))
        if mk:
            o2 = round((off or 0) + 0.4, 2)
            out.append((at + 0.4, "{ " + r + (', edge: "end"' if edge == "end" else "") + f', offset: {o2}, mark: "{mk}"' + " }"))
        return out
    hero_spk = "JAY"; hb, ob = [], []
    h0, o0 = sp.get("h0", "listen:neutral"), sp.get("o0", "listen:neutral")
    first_spk = f["turns"][0][0]
    if first_spk != hero_spk: hb += beat(1, 0, h0)
    else: ob += beat(1, 0, o0)
    for n, (spk, mode, text, gap) in enumerate(f["turns"], 1):
        S, L = sp["act"].get(n, ("", ""))
        if spk == hero_spk:
            if mode == "cam":
                hb += beat(n, 0, "sheepish")
                k = next(i for i, x in enumerate(tw(n)) if norm(x["w"]) == "trick")
                hb += beat(n, k, "talk")
            else:
                hb += beat(n, 0, S or "talk:neutral")
                if L: ob += beat(n, -1, L, "end", 0.1)
        else:
            ob += beat(n, 0, S or "talk:neutral")
            if L: hb += beat(n, -1, L, "end", 0.1)
    for who, n, k, a, edge, off in sp.get("x", []): (hb if who == "h" else ob).extend(beat(n, k, a, edge, off))
    r, _ = ref(nT + 1, 0); hb.append((1e9, "{ " + r + ', emote: "wave", e: "eager" }'))
    hb.sort(key=lambda x: x[0]); ob.sort(key=lambda x: x[0])
    said = {n: strip(t[2]) for n, t in enumerate(f["turns"], 1)}
    # ---- meter
    cams = [n for n, t in enumerate(f["turns"], 1) if t[1] == "cam"]
    keys = []
    for n, v in sorted(sp["v"].items()):
        v, off = v if isinstance(v, tuple) else (v, 0); r, _ = ref(n, -1)
        keys.append("    { " + r + ', edge: "end"' + (f", offset: {off}" if off else "") + f", v: {v} }},")
    tricks = []
    for i, c in enumerate(cams):
        ws = tw(c); k = next(j for j, x in enumerate(ws) if norm(x["w"]) == "trick") + 2
        text = re.split(r"Trick (?:one|two)\.\s*", said[c])[1]
        fr, _ = ref(c, k); to, _ = ref(sp["dip"], 0) if i == 0 else ref(sp["win"], -1)
        tricks.append(f"    {{ from: {{ {fr} }}, to: {{ {to} }}, tag: \"TRICK {i + 1}\", text: {q(text)} }},")
    m = ['import type { MeterCfg } from "./MeterOverlay";', 'import TURNS from "./turns.json";']
    body = [sp["mconsts"]] if sp.get("mconsts") else []
    if "steps" in sp:
        body.append("const STEPS: [number, string][] = [" + ", ".join(f"[{a}, {q(b)}]" for a, b in sp["steps"]) + "];")
        readout = "(_v, t) => STEPS.filter(([a]) => t >= a).pop()![1]"
    else: readout = sp["readout"]
    body += [f"// {sp['device']}", "export const METER: MeterCfg = {", f"  title: {q(sp['title'])},", f"  label: {q(sp['label'])},", f"  start: {sp.get('start', 0.4)},",
             "  keys: [", *keys, "  ],", f"  readout: {readout},", f"  readoutW: {sp.get('readoutW', 200)},", "  tricks: [", *tricks, "  ],",
             f"  endLine: {q(f['end'].replace(' on Your App.', ''))},", '  endWord: "Practice",', "};"]
    bt = "\n".join(body)
    m.append("const T = TURNS as { t0: number; t1: number }[];")
    if re.search(r"\bt0\(", bt): m.append("const t0 = (n: number) => T[n - 1].t0;")
    if re.search(r"\bt1\(", bt): m.append("const t1 = (n: number) => T[n - 1].t1;")
    if not re.search(r"\bt[01]\(", bt): m.pop()
    if re.search(r"\bwordAt\(", bt): m.insert(0, 'import { wordAt } from "./film/cues";')
    (d / "src/meter.tsx").write_text("\n".join(m) + "\n" + bt + "\n")
    # ---- cast
    o = sp.get("other")
    cast = [f"// Film {f['n']} {q(f['title'])}: {sp['castnote']}", 'import type { CharacterSpec } from "./types";', "export const CAST: Record<string, CharacterSpec> = {",
            f"  jay: {{ id: \"jay\", height: 1.76, outfit: {{ {sp.get('jay', JAY)} }} }},"]
    if o: cast.append(f"  {o['id']}: {{ id: \"{o['id']}\", height: {o['h']}, outfit: {{ {o['outfit']} }} }},")
    (d / "src/char/cast.ts").write_text("\n".join(cast) + "\n};\n")
    # ---- scene
    def person(id, spk, x, h, extra, beats):
        L = [f"    id: \"{id}\", spk: \"{spk}\", x: {x}, h: {h}," + (f" {extra}" if extra else ""), "    beats: ["] + [f"      {b}," for _, b in beats] + ["    ],"]
        return "\n".join(L)
    hero = sp.get("hero", {})
    shots = []
    starts = [s for s, _ in sp["shots"]]
    for i, (s, c) in enumerate(sp["shots"]):
        e = starts[i + 1] - 1 if i + 1 < len(starts) else nT + 1
        c = {"A1": A1, "A2": A2, "END": '"end"'}.get(c, c)
        note = "the ending" if s == nT + 1 else ("aside: trick " + ("one" if s == cams[0] else "two") if s in cams else " ".join(q(said[n]) for n in range(s, e + 1)))
        shots.append(f"    {c}, // {note}")
    sc = f"""const PAL = PALETTES.{sp['pal']};
{sp.get('consts', '').strip()}
const Set: React.FC<{{ tg: number }}> = (SETARGS) => (
  <group>
{sp['set'].strip(chr(10))}
  </group>
);

export const SHOTS = duo({{
  pal: PAL,
  Set,{(' ' + sp['duo']) if sp.get('duo') else ''}
  hero: {{
{person('jay', 'JAY', hero.get('x', -0.68), 1.76, hero.get('extra', ''), hb)}
  }},
""" + (f"""  other: {{
{person(o['id'], f['o'], o.get('x', 0.68), o['h'], o.get('extra', ''), ob)}
  }},
""" if o else "") + "  shots: [\n" + "\n".join(shots) + "\n  ],\n});\n"
    sc = sc.replace("(SETARGS)", "({ tg })" if re.search(r"\btg\b", sp["set"]) else "()").replace("\n\nconst Set", "\nconst Set")
    code = re.sub(r"/\*.*?\*/", "", re.sub(r"//.*", "", sc), flags=re.S)  # the said lines in the shot comments are not code
    code = re.sub(r'"(?:[^"\\]|\\.)*"', '""', code)  # nor are the cue words
    used = lambda names: [x for x in names if re.search(rf"(?<![\w.]){x}\b", code)]
    imp = ['import React from "react";']
    k = used(KIT)
    if k: imp.append("import { " + ", ".join(sorted(k, key=str.lower)) + ' } from "../engine/core/kit";')
    if re.search(r"\bV3\b", sc): imp.append('import type { V3 } from "../engine/types";')
    if re.search(r"\bwordAt\(", sc): imp.append('import { wordAt } from "../film/cues";')
    imp.append("import { " + ", ".join(sorted(["PALETTES"] + used(CS), key=str.lower)) + ' } from "../world/codeSet";')
    p = used(PR)
    if p: imp.append("import { " + ", ".join(sorted(p, key=str.lower)) + ' } from "../world/props";')
    imp.append("import { " + ", ".join(["duo"] + [x for x in ("t0", "t1") if re.search(rf"\b{x}\(", sc)]) + ' } from "./duo";')
    head = f"// Film {f['n']} {q(f['title'])} (stickman-3d, 2026-11-26). {sp['note']}\n"
    (d / "src/shots/scene.tsx").write_text(head + "\n".join(imp) + "\n\n" + sc)
    return ",".join(str(s) for s in starts)

if __name__ == "__main__":
    for fid in (sys.argv[2:] or list(F)):
        print(fid, build(fid))
