"""Writes the real-sound design: audio/sounddesign.json (top level) + audio/design/{war,foley,ambience,music}.json.
Every trim comes from a measured onset (audio/tools/onsets.py scans, earshot find; numbers in
out/audio-review/*.json) - the reason for each number is in the `_doc` / label next to it. Run from the project root:
  <py> audio/build_design.py
then render with the real-sound skill's mix.py (see audio/final_mix.py, which also adds the voice and masters)."""
import json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
A = "audio/assets/"
# --- war
RIFLE = A + "war/fs-710084_rifle-gunshot-one-shot-by-felix-blume.ogg"          # one clean rifle shot, attack 0.832
RIFLE_D = A + "war/fs-541164_distant-gunshot-by-resaural.ogg"                  # distant gunshot, main crack 0.197
THUNDER = A + "war/fs-581125_distant-thunder-4-by-fission9.ogg"              # far rolling rumble 4.3-7.5 s: the artillery
BOOM = A + "war/fs-108640_distant-explosion-wav-by-juskiddink.ogg"            # a real distant explosion, attack 0.171

CITYBOOM = A + "war/fs-613560_small-explosion-in-city-far-away-by-garu.ogg"    # a small explosion far away in a city, 5.648
PISTOL = A + "war/fs-803495_pocket-pistol-gunshot-2-indoor-by-maheci.ogg"      # one indoor pistol shot, attack 0.128
# --- foley
GRAVEL = A + "foley/fs-537837_footsteps-approach-from-left-on-gravel-a.ogg"
GATE = A + "foley/fs-452784_heavy-gate-metal-03-underground-bunker-o.ogg"       # a real civil-defence bunker gate
BIGDOOR = A + "foley/fs-845666_large-metal-bunker-doors-opening-and-clo.ogg"
SLAM = A + "foley/fs-406197_door-metal-big-heavy-close-kinda-slam-th.ogg"       # heavy metal door close, off-mic
STAIRS = A + "foley/fs-368835_footsteps-down-stairs-wav-by-georgisound.ogg"
CUTLERY = A + "foley/fs-450783_cutlery-utensil-spoon-fork-knife-down-pl.ogg"
CHAIR = A + "foley/fs-832998_chair-scrape-by-bangcorrupt.ogg"
CHAIR2 = A + "foley/fs-455673_chair-wood-old-push-slide-across-concret.ogg"
STEPS = A + "foley/fs-546270_footsteps-one-person-clean-wav-by-ragged.ogg"
DEBRIS = A + "foley/fs-569746_gravel-stone-dirt-debris-falling-small-1.ogg"
CHAIN = A + "foley/fs-862897_creaky-blinds-chain-by-lreeve.ogg"
CLOTH = A + "foley/fs-435289_cloth-rustle-3-wav-by-zazz-sound-design.ogg"
DOG = A + "foley/fs-642326_dog-sleeping-breathing-by-iainmccurdy.ogg"
# --- ambience
WIND = A + "ambience/fs-352436_forest-winter-light-wind-by-kinoton.ogg"
VENT = A + "ambience/fs-671456_arena-underground-ventilation-hum-and-ru.ogg"
ROOM = A + "ambience/fs-670070_room-tone-empty-hospital-by-kinoton.ogg"
STATIC = A + "ambience/fs-125392_radio-static-wav-by-thegoose09.ogg"
CROWD = A + "ambience/fs-384401_crowd-mob-riot-noise-voices-only-14-peop.ogg"
TRACK = A + "music/im-lost-time.mp3"

T = json.load(open(os.path.join(ROOT, "audio/trims.json")))   # door / misc trims measured with earshot find


def smp(file, s, e, **kw):
    d = {"file": file, "start": round(s, 3), "end": round(e, 3), "mono": True, "norm_peak_db": -6.0}
    d.update(kw)
    return d


# ------------------------------------------------------------------------------------------------------------- war
war = {"_doc": "War sounds, all heard from a distance or through concrete: rifle shots (710084 felix.blume, 541164 "
               "Resaural), artillery rumble bed (320788 Kostrava, placed as a free bed), shelter bangs (203260 "
               "metrostock99: real bangs recorded inside a shelter), the pistol through the steel door (402789).",
       "samples": {}, "pools": {}, "rules": [], "place": []}
S = war["samples"]
FAR = {"hp": 180, "lp": 3200, "lp_order": 4, "highshelf": [1500, -4]}
S["wr.rifle.0"] = smp(RIFLE, 0.827, 2.60, eq=FAR, fade_out=0.6)
S["wr.rifle.1"] = smp(RIFLE, 0.827, 2.60, eq=FAR, fade_out=0.6, pitch=-1.5)
S["wr.rifle.d"] = smp(RIFLE_D, 0.185, 2.6, eq={"hp": 150, "lp": 4000}, fade_in=0.004, fade_out=0.6,
                      _why="starts 12 ms before the main crack (0.197); the soft pre-shots at 0.021 / 0.144 are left out (they made the peak land 200-290 ms late)")
war["pools"]["wr.p.rifle"] = ["wr.rifle.0", "wr.rifle.d", "wr.rifle.1"]
# 203260 (shelter bangs) and 320788 / 486027 / 542827 dropped: earshot realness only 'uncertain' / 'likely
# code-synthesized' on their trims. Shelling inside the bunker = real distant booms low-passed through concrete.
INSIDE = {"hp": 35, "lp": 750, "lp_order": 4}
S["wr.thud.0"] = smp(CITYBOOM, 5.62, 10.5, mono=False, eq=INSIDE, pitch=-4.5, fade_out=1.5,
                      _why="147584 (far-off boom) dropped: realness only uncertain (0.58) on its trim")
S["wr.thud.1"] = smp(CITYBOOM, 5.62, 10.5, mono=False, eq={"hp": 35, "lp": 900, "lp_order": 4}, pitch=-2.0, fade_out=1.5)
S["wr.thud.2"] = smp(BOOM, 0.15, 4.0, mono=False, eq=INSIDE, pitch=-5.0, fade_out=1.2)
war["pools"]["wr.p.thud"] = ["wr.thud.0", "wr.thud.1", "wr.thud.2"]
S["wr.shell"] = smp(BOOM, 0.15, 4.01, mono=False, eq={"hp": 30, "lp": 2200, "lp_order": 2, "lowshelf": [120, 3]},
                    pitch=-2.0, norm_peak_db=-3.0, fade_out=1.0, _why="the big shell on 'Soviet guns': close enough to shake the room")
war["pools"]["wr.p.shell"] = ["wr.shell"]
S["wr.pistol"] = smp(PISTOL, 0.118, 1.6, eq={"hp": 40, "lp": 800, "lp_order": 4, "peq": [[110, 1.0, 5.0]]},
                     norm_peak_db=-3.0, fade_out=0.5,
                     _why="through a closed steel door: everything above ~650 Hz gone, the body (+4 dB at 120 Hz) left")
war["pools"]["wr.p.pistol"] = ["wr.pistol"]
war["rules"] = [
    {"name": "wr.rifle", "match": {"kind": "rifle"}, "pool": "wr.p.rifle", "mode": "cycle", "gain_db": -10.0, "qa_ok": "low-passed far rifle: the body of the report swells ~140 ms after the crack, which is on the cue",
     "weight_db": 4.0, "jitter_db": 1.0, "pan": "cue"},
    {"name": "wr.thud", "match": {"kind": "thud"}, "pool": "wr.p.thud", "mode": "cycle", "gain_db": -3.0, "qa_ok": "a far boom through concrete swells for ~150 ms after its attack; the attack is on the cue",
     "weight_db": 6.0, "pan": "cue"},
    {"name": "wr.shell", "match": {"kind": "impact"}, "pool": "wr.p.shell", "gain_db": -4.0, "pan": 0.0},
    {"name": "wr.pistol", "match": {"kind": "gunshot"}, "pool": "wr.p.pistol", "gain_db": -1.0, "pan": 0.0},
]

# ------------------------------------------------------------------------------------------------------------ foley
fo = {"_doc": "Foley: gravel steps (537837), the bunker gate (452784 / 845666), the corridor door slam (406197), "
              "concrete stairs (368835), cutlery (450783), chairs (832998, 455673), corridor steps (546270), dust "
              "(569746), the lamp chain (862897), cloth (435289), the sleeping dog (642326). Trims = onset scans "
              "and earshot find (audio/trims.json).",
      "samples": {}, "pools": {}, "rules": []}
F = fo["samples"]
F["fo.gravel"] = smp(GRAVEL, 8.55, 11.35, eq={"hp": 120}, fade_in=0.05, fade_out=0.25)
F["fo.door.open"] = smp(T["door_open"]["file"], *T["door_open"]["trim"], mono=False, eq={"hp": 60, "lp": 7000},
                        fade_in=0.03, fade_out=0.3)
F["fo.door.close"] = smp(T["door_close"]["file"], *T["door_close"]["trim"], mono=False, eq={"hp": 45},
                         fade_out=0.6)
F["fo.door.hall"] = smp(SLAM, 0.29, 2.96, eq={"hp": 45, "lp": 6000}, fade_out=0.6, norm_peak_db=-4.0)
F["fo.stairs"] = smp(STAIRS, 1.95, 4.95, eq={"hp": 110}, fade_in=0.02, fade_out=0.25,
                     _why="steps 1.98-4.74 down concrete; stops before the clipped step at 5.19")
F["fo.clink.0"] = smp(CUTLERY, 0.995, 1.75, eq={"hp": 300}, fade_out=0.15)
F["fo.clink.1"] = smp(CUTLERY, 2.135, 2.95, eq={"hp": 300}, fade_out=0.15)
F["fo.clink.2"] = smp(CUTLERY, 3.46, 3.80, eq={"hp": 300}, fade_out=0.06)
F["fo.clink.3"] = smp(CUTLERY, 5.675, 6.30, eq={"hp": 300}, fade_out=0.15)
F["fo.chair.0"] = smp(CHAIR, 0.66, 1.50, eq={"hp": 120}, fade_out=0.08)
F["fo.chair.1"] = smp(CHAIR2, 1.19, 1.95, eq={"hp": 120}, fade_out=0.15)
F["fo.leave"] = smp(STEPS, 12.33, 14.75, eq={"hp": 120}, fade_in=0.02, fade_out=0.2,
                    _why="RaggedyAngst clean steps 12.37 / 12.97 / 13.54 / 14.77 cut before the 4th")
F["fo.walk"] = smp(STEPS, 21.53, 23.85, eq={"hp": 120}, fade_in=0.02, fade_out=0.2,
                   _why="steps 21.56 / 22.11 / 22.70 / 23.31: two people walking slowly")
F["fo.dust"] = smp(DEBRIS, 0.0, 3.2, eq={"hp": 900}, fade_in=0.01, fade_out=0.5, norm_peak_db=-8.0)
F["fo.lamp"] = smp(*[T["lamp"]["file"]], *T["lamp"]["trim"], eq={"hp": 400}, fade_in=0.03, fade_out=0.3)
for k, (s0, s1) in enumerate([(7.45, 8.25), (10.60, 11.30), (12.62, 13.30)]):
    F[f"fo.cloth.{k}"] = smp(CLOTH, s0, s1, eq={"hp": 200, "highshelf": [6000, -3]}, fade_in=0.03, fade_out=0.2)
F["fo.dog"] = smp(DOG, *T["dog"]["trim"], eq={"hp": 120}, fade_in=0.1, fade_out=0.4)
P = fo["pools"]
P["fo.p.clink"] = [f"fo.clink.{k}" for k in range(4)]
P["fo.p.chair"] = ["fo.chair.0", "fo.chair.1"]
P["fo.p.cloth"] = [f"fo.cloth.{k}" for k in range(3)]
for one in ("gravel", "door.open", "door.close", "door.hall", "stairs", "leave", "walk", "dust", "lamp", "dog"):
    P[f"fo.p.{one}"] = [f"fo.{one}"]
TX = "a texture / run laid from its start; its loudest moment is not the sync point"
fo["rules"] = [
    {"name": "fo.gravel", "match": {"kind": "steps", "id": "^garden:"}, "pool": "fo.p.gravel", "gain_db": -12.0, "align": "start", "pan": "cue", "qa_ok": TX},
    {"name": "fo.door.open", "match": {"kind": "door", "id": "^garden:door:open"}, "pool": "fo.p.door.open", "gain_db": -7.0, "align": "start", "qa_ok": TX},
    {"name": "fo.door.close", "match": {"kind": "door", "id": "^garden:door:close"}, "pool": "fo.p.door.close", "gain_db": -5.0, "align": "peak", "qa_ok": "a two-stage slam (latch then body): its loudest moment is on the cut into black"},
    {"name": "fo.stairs", "match": {"kind": "steps", "id": "^bunker:stairs"}, "pool": "fo.p.stairs", "gain_db": -11.0, "align": "start", "qa_ok": TX},
    {"name": "fo.clink", "match": {"kind": "clink"}, "pool": "fo.p.clink", "mode": "cycle", "gain_db": -14.0, "weight_db": 4.0, "jitter_db": 1.0, "pan": "cue"},
    {"name": "fo.chair", "match": {"kind": "scrape"}, "pool": "fo.p.chair", "mode": "cycle", "gain_db": -13.0, "weight_db": 4.0, "pan": "cue", "align": "start", "qa_ok": TX},
    {"name": "fo.leave", "match": {"kind": "steps", "id": "^breakfast:leave"}, "pool": "fo.p.leave", "gain_db": -9.0, "align": "start", "pan": "cue", "qa_ok": TX},
    {"name": "fo.dust", "match": {"kind": "debris"}, "pool": "fo.p.dust", "gain_db": -10.0, "align": "start", "pan": "cue", "qa_ok": TX},
    {"name": "fo.lamp", "match": {"kind": "creak"}, "pool": "fo.p.lamp", "gain_db": -11.0, "align": "start", "pan": "cue", "qa_ok": TX},
    {"name": "fo.cloth", "match": {"kind": "cloth"}, "pool": "fo.p.cloth", "mode": "cycle", "gain_db": -12.0, "pan": "cue", "align": "start", "qa_ok": TX},
    {"name": "fo.walk", "match": {"kind": "steps", "id": "^hall:walk"}, "pool": "fo.p.walk", "gain_db": -9.0, "align": "start", "qa_ok": TX},
    {"name": "fo.door.hall", "match": {"kind": "door", "id": "^hall:door"}, "pool": "fo.p.door.hall", "gain_db": -10.0},
    {"name": "fo.dog", "match": {"kind": "dog"}, "pool": "fo.p.dog", "gain_db": -20.0, "align": "start", "pan": "cue", "qa_ok": TX},
]

# --------------------------------------------------------------------------------------------------------- ambience
am = {"_doc": "One bed per place, cut on the section joins (inside the black doorways). Street: wind + far artillery; "
              "garden: the wind drops 6 dB; bunker (sections 2-3): ventilation hum; radio room adds static; "
              "the Mussolini photo's crowd is band-limited 'through the photo'; the study is a quieter room tone.",
      "ambience": [
    {"name": "am.wind", "file": WIND, "src_start": 4.0, "src_end": 50.0, "at": 0.0, "until": 8.35, "fade_in": 0.02,
     "fade_out": 0.25, "gain_db": 6.0, "eq": {"hp": 90}, "width": 1.0, "auto": [[0, 0], [4.6, 0], [5.6, -6], [8.35, -8]]},
    {"name": "am.arty", "file": THUNDER, "src_start": 3.3, "src_end": 12.5, "at": 0.0, "until": 8.35, "fade_in": 0.02,
     "fade_out": 0.25, "gain_db": -8.0, "eq": {"hp": 30, "lp": 450, "lp_order": 4}, "width": 1.0,
     "_why": "a real far thunder roll, below 450 Hz, is the artillery rumble behind the street (peak roll at film ~1.6-2.4)"},
    {"name": "am.vent", "file": VENT, "src_start": 0.5, "src_end": 34.0, "at": 8.25, "until": 38.95, "fade_in": 0.3,
     "fade_out": 0.4, "gain_db": 20.0, "eq": {"hp": 40}, "width": 0.8},
    {"name": "am.static", "file": STATIC, "src_start": 2.0, "src_end": 14.5, "at": 22.05, "until": 38.95, "fade_in": 0.4,
     "fade_out": 0.4, "gain_db": 5.0, "eq": {"hp": 400, "lp": 5000}, "width": 0.3,
     "auto": [[22.05, 0], [30.2, 0], [30.6, -6], [33.4, -6], [33.9, 0]]},
    {"name": "am.crowd", "file": CROWD, "src_start": 40.0, "src_end": 50.0, "at": 30.30, "until": 33.75, "fade_in": 0.5,
     "fade_out": 0.6, "gain_db": 2.0, "eq": {"hp": 350, "hp_order": 4, "lp": 1800, "lp_order": 4}, "width": 0.4,
     "_why": "the crowd at Mussolini's end, heard 'through the photo': telephone-band, narrow, under the voice"},
    {"name": "am.room", "file": ROOM, "src_start": 10.0, "src_end": 60.0, "at": 38.85, "until": 52.94, "fade_in": 0.3,
     "fade_out": 1.2, "gain_db": 12.0, "eq": {"hp": 60}, "width": 0.7,
     "auto": [[38.85, 0], [43.9, 0], [44.3, -4], [52.94, -4]]},
    {"name": "am.vent.study", "file": VENT, "src_start": 2.0, "src_end": 34.0, "at": 38.85, "until": 52.94, "fade_in": 0.3,
     "fade_out": 1.5, "gain_db": 14.0, "eq": {"hp": 40, "lp": 2500}, "width": 0.6},
]}

# ------------------------------------------------------------------------------------------------------------ music
mu = {"_doc": "Kevin MacLeod 'Lost Time' (CC BY 4.0): violas, cellos, basses, 55 BPM, 'Somber, Dark'. Played at its own "
              "tempo (the picture is word-locked, not on a grid), from its opening, so its own slow swell carries the "
              "film; the bus ride thins it from the farewell and it is gone by the gunshot (49.96) but for a soft tail.",
      "music": {"file": TRACK, "src_bpm": 55.0, "target_bpm": 55.0, "stretch": "none", "gain_db": 0.0, "segments": [
          {"label": "src 0.00-50.60 = film 0.00-50.60: the opening of the piece; tail_fade over its last 3.4 s so it "
                    "is ~-20 dB at the gunshot (49.96) and silent by 50.6",
           "src_from": 0.0, "src_to": 50.6, "at": 0.0, "fade_in": 0.004, "fade_in_at_start": False, "fade_out": 0.05,
           "tail_fade": 3.4},
      ]}}

top = {"_doc": "Hitler's last days (bunker one-take) - soundtrack from real recordings (real-sound skill). mix.py renders "
               "music + sfx + ambience; audio/final_mix.py adds the unchanged narration (public/voice.wav), ducks the "
               "music under speech and masters to -14 LUFS.",
       "duration": 52.9333, "cues": "out/cues.json",
       "include": ["audio/design/music.json", "audio/design/ambience.json", "audio/design/war.json", "audio/design/foley.json"],
       "_buses_doc": "music: a little under the street's gunfire (0-3 s, -2), full through sections 2-3, -2 dB from the "
                     "handshakes, -5 dB from the door into the study (44.0), so the segment's own tail fade finishes "
                     "the thinning before the shot.",
       "buses": {"music": {"gain_db": 0.0, "auto": [[0, -2], [3.2, -2], [4.5, 0], [38.6, 0], [39.6, -2], [43.8, -2],
                                                     [45.0, -5], [52.94, -5]]},
                 "amb": {"gain_db": 0.0}, "sfx": {"gain_db": 0.0}},
       "master": {"lufs": -14, "ceiling": 0.77, "no_glue": True}}

os.makedirs(os.path.join(ROOT, "audio/design"), exist_ok=True)
for name, d in (("war", war), ("foley", fo), ("ambience", am), ("music", mu)):
    json.dump(d, open(os.path.join(ROOT, f"audio/design/{name}.json"), "w"), indent=1)
json.dump(top, open(os.path.join(ROOT, "audio/sounddesign.json"), "w"), indent=1)
print("wrote audio/sounddesign.json + 4 fragments")
