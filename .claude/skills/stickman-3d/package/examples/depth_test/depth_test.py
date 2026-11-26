"""5 s depth test (RicksClips-style 3D feel): two shots + 9-frame dissolve.
A (g 0-83): camera ARCS from behind-left to front-left of a walking column while pushing in, foreground bushes slide
past the lens (parallax), DOF on the men, background into warm haze.  B (g 74-149): low camera close to the grass
cranes up and pulls out, revealing the column and the valley layers.  Saturated toon grade, low warm sun as rim/key,
cool blue fill.  Run:  BELL_RES=540x960 blender -b -P depth_test.py [-- --stills g ...]
Reuses the Norfolks blender lib/cards/assets (read-only)."""
import sys, math, random
from pathlib import Path
NOR = Path("D:/resource/stickman/norfolks/blender"); TD = Path(__file__).resolve().parent
sys.path.insert(0, str(NOR))
import shotlib
shotlib.SHOTS[99] = (0, 150, "depth test")
shotlib.OUT = TD / "renders"; shotlib.OUT.mkdir(exist_ok=True)
from shotlib import *
from mathutils import Vector
import look, props
import sets_field15 as SF

s = Shot(99)
lib.reset(s.n)
look.setup(samples=10)
camA = lib.camera("CamA"); camB = lib.camera("CamB"); s.cam = camA

# ---------------------------------------------------------------- world + ground
look.world(strength=1.1, mist=(9.0, 50.0), hdri="qwantani_dusk_2_puresky.hdr", rot=150)
look.ground("sparse_grass", tint=1.0, sat=1.45, size=90)

R = random.Random(4)
LANE = 1.15                                              # |y| < LANE kept clear for the column
# midground grass tufts around the lane
for i in range(420):
    x = R.uniform(-16, 22); y = R.uniform(-11, 12)
    if abs(y) < LANE: continue
    look.inst("grass_medium_01", (x, y, 0), R.uniform(0, 360), height=R.uniform(0.22, 0.5), sat=1.7)
# foreground bushes along y ~ -2.9 (slide past camera A), small flowering shrubs
for x, aid, h in ((-4.2, "searsia_lucida", 0.95), (-1.3, "wild_rooibos_bush", 0.55), (1.5, "searsia_lucida", 0.85),
                  (4.4, "didelta_spinosa", 0.5), (7.2, "searsia_lucida", 0.9), (-6.8, "wild_rooibos_bush", 0.6)):
    look.inst(aid, (x, -2.9 + R.uniform(-0.2, 0.2), 0), R.uniform(0, 360), height=h, sat=1.5)
# far side of the lane: bushes and boulders right behind the men
for i in range(16):
    x = R.uniform(-10, 14); y = R.uniform(2.0, 5.5)
    look.inst(["searsia_lucida", "wild_rooibos_bush", "didelta_spinosa"][i % 3], (x, y, 0), R.uniform(0, 360), height=R.uniform(0.6, 1.3), sat=1.45)
for x, y, h in ((-3, 3.2, 0.7), (5.5, 2.6, 0.5), (11, 4.5, 0.9)):
    look.inst("namaqualand_boulder_02", (x, y, -0.1), R.uniform(0, 360), height=h, sat=1.2)
# background trees getting smaller/hazier with distance
for i in range(34):
    x = R.uniform(-30, 36); y = R.uniform(7, 34)
    look.inst("searsia_burchellii", (x, y, 0), R.uniform(0, 360), height=R.uniform(2.6, 4.6), sat=1.35)
# far ridge
for x, y, h, yaw in ((-45, 120, 30, 10), (15, 135, 36, 200), (70, 115, 26, 120)):
    look.inst("namaqualand_cliff_01", (x, y, -2), yaw, height=h, sat=1.1)

# ---------------------------------------------------------------- the column (walking at full fps)
H0 = 1.76; unit = H0 / lib.STAND_PX; V = SF.STRIDE_PX["Rifle_Walk_IP"] * unit       # m per frame
FRONT0 = -1.6; GAP = 1.55; N = 4
def cx(g): return FRONT0 - GAP * (N - 1) / 2 + V * g      # column centre x
for k in range(N):
    h = H0 + (0.04 if k % 2 else -0.02)
    c = s.card(f"m{k}", h, lit=0.22)
    n = SF.CLIP_N["Rifle_Walk_IP"]; off = [0, 17, 8, 29][k]
    s.key_card(c, lambda g, off=off: (f"nor{k % 4 + 1}", "stern", "rig", dict(clip="Rifle_Walk_IP", cf=(g - s.g0 + off) % n)))
    for g in s.frames(): c.at(s.L(g), (FRONT0 - GAP * k + V * g, 0.25 * (k % 2) - 0.1, 0.0))
    SF.plant_feet(s, c)
    r = props.load("bolt_action_rifle_7_62"); r["no_ground"] = True
    props.hold(c, r, n_frames=s.n, grip=0.36, angle=52, length=1.13, hand="hand")

# ---------------------------------------------------------------- cameras
def ez(u): return lib.ease(u)
def camA_at(g):
    u = ez(g / 90.0); lk = Vector((cx(g) + 0.3, 0.0, 1.05))
    a = math.radians(-114 + 54 * u); r = 10.0 - 3.0 * u; z = 1.25 + 0.4 * u
    return tuple(lk + Vector((math.cos(a) * r, math.sin(a) * r, z - lk.z))), tuple(lk)
def camB_at(g):
    u = ez((g - 74) / 76.0)
    lk = Vector((cx(g) + 0.4 + 1.8 * u, 0.4 + 6.0 * u, 1.0 - 0.1 * u))
    p = Vector((cx(g) + 2.0 + 1.4 * u, -2.6 - 6.4 * u, 0.35 + 2.9 * u))
    return tuple(p), tuple(lk)
def dof_of(fn):
    return lambda f: ((Vector((cx(f + s.g0 - 1), 0, 1.0)) - Vector(fn(f + s.g0 - 1)[0])).length, 2.2)
bake_camera(camA, s.n, lambda f: (*camA_at(f + s.g0 - 1), 40), dof=dof_of(camA_at))
bake_camera(camB, s.n, lambda f: (*camB_at(f + s.g0 - 1), 48), dof=dof_of(camB_at))

# ---------------------------------------------------------------- light + grade
sun = lib.light("SUN", "sun", (0, 0, 20), "#ffc07a", 6.0, size=0.3, rot=(64, 0, 215))     # low sun, behind-right: rim + long shadows
fill = lib.light("AREA", "fill", (0, -9, 4), "#6f8dff", 200, size=10, target=(0, 0, 1))  # cool fill from the camera side
lib.compositor(bloom=0.65, vign=0.55, vign_col="#3a2452", sat=1.3)
look.mist_fog("#c8a8dc", 0.42)

bad = lib.gate(s.cards, [s.L(g) for g in range(0, 150, 15)])
if bad: print("GATE", bad[:6])
import shots
shots.bake_static()

st = arg("--stills", True)
def retarget(cam):
    bpy.context.scene.camera = cam
    for c in s.cards: c.root.constraints[0].target = cam
if st:
    for g in map(int, st):
        retarget(camA if g < 80 else camB); lib.render(TD / "stills", still=[s.L(g)])
else:
    retarget(camA); lib.render(TD / "renders" / "A", frames=(s.L(0), s.L(83)))
    retarget(camB); lib.render(TD / "renders" / "B", frames=(s.L(74), s.L(149)))
print("DONE")
