"""park: a city park on a sunny afternoon, four zones that read as different places (POSTED L6). State: day.
Blender coords (camera side = -Y). Three coords: x, z = -y.
  A  OAK LAWN      (0, 0):    the giant oak at (0, 2.2), lawn, flower clumps, a far bench, bushes
  B  ENTRANCE      (22, 0):   paved sidewalk along X, low brick wall at y = 1.6 (the cat sits on it), iron fence + gate,
                              lamp posts, trash can, the street and three shop facades behind
  C  FOUNTAIN      (-22, 0):  circular plaza of pavers, the fountain at (-22, 3), flower beds, lamps, bushes
  D  BENCH ROW     (0, -16):  three benches facing -Y along a path, the hot-dog cart, lamps, trees behind
Colour script: fresh greens + warm pavers + a blue sky; the hero's mustard hoodie pops against the greens.
Sketchfab CC-BY: Oak tree, Park Bench, Artemis Fountain, Victorian Street Lamp, Iron Fence, Modular brick Wall, Park
Trash Can, Stylized Bush, Flowers, New York Hot Dog Cart, Smartphone. Poly Haven CC0: grass, PBR ground."""
import bpy, math, random
import lib, sets
from lib import box, light
from sets_yard import ground, grass

A, B, C, D = (0.0, 0.0), (22.0, 0.0), (-22.0, 0.0), (0.0, -16.0)


def has(aid):
    return (lib.ASSETS / f"{aid}.blend").exists()


def put(aid, loc, yaw=0, h=None, ink=True):
    if has(aid): return sets.asset(aid, loc, yaw, height=h, ink=ink)
    return None


def pavers(name, cx, cy, w, d):
    o = box(name, (cx, cy, 0.01), (w, d, 0.04), sets.image_mat(name + "M", sets.TEX / "pavers.png"), ink=False)
    sets.tiled(o, 2.0)
    return o


def build(state="day"):
    random.seed(11)
    g = box("ground", (0, 0, -0.05), (140, 120, 0.1), sets.pbr_mat("lawnM", "aerial_grass_rock", tint="#7fc25a"), ink=False); sets.tiled(g, 4.0)
    # ---------- A: oak lawn
    put("sf_oak", (A[0], A[1] + 2.2, 0), 30, h=9.5)
    for k, (x, y) in enumerate(((-4, 6), (5, 7), (-7, 3), (7, 2))):
        put("sf_bush", (x, y, 0), k * 70, h=1.2, ink=False)
    for k in range(10):
        put("sf_flowers", (random.uniform(-5, 5), random.uniform(3.5, 8), 0), random.uniform(0, 360), h=0.35, ink=False)
    put("sf_bench", (6.5, 5.5, 0), 200, h=0.9)
    grass(34, (-8, 8), (-4, 7), seed=5, keep=lambda x, y: math.hypot(x, y - 2.2) > 1.6)
    # ---------- B: entrance sidewalk
    pavers("walkB", B[0], B[1], 24, 3.0)
    box("curbB", (B[0], B[1] - 1.6, 0.06), (24, 0.2, 0.14), lib.mat("curbM", "#b8b0a0"), ink=False)
    box("streetB", (B[0], B[1] - 6.0, -0.02), (30, 8.5, 0.04), lib.mat("asphaltM", "#3a3a40", rough=0.9), ink=False)
    for x in range(-12, 13, 3):
        box(f"laneB{x}", (B[0] + x, B[1] - 6.0, 0.005), (1.6, 0.14, 0.01), lib.mat("laneM", "#f0e8c0"), ink=False)
    for k in range(5):
        put("sf_brickwall", (B[0] - 8 + k * 4.2, B[1] + 1.7, 0), 0, h=0.9)
    if not has("sf_brickwall"):
        box("wallB", (B[0], B[1] + 1.7, 0.45), (20, 0.4, 0.9), lib.mat("brickM", "#a85a44"))
    for k in range(4):
        put("sf_ironfence", (B[0] - 9 + k * 6, B[1] + 2.2, 0.9), 0, h=1.1)
    for x in (-9, -1, 7):
        put("sf_lamp", (B[0] + x, B[1] - 1.2, 0), 0, h=4.2)
    put("sf_trash", (B[0] + 4, B[1] - 1.0, 0), 10, h=0.95)
    for k in range(3):   # shop facades across the street (background of the sidewalk shots)
        sets.plane(f"facade{k}", 9.0, 9.0, sets.image_mat(f"facadeM{k}", sets.TEX / f"facade{k}.png"), (B[0] - 9 + k * 9.2, B[1] - 12.5, 4.5), rot=(90, 0, 180))
        box(f"facadeBack{k}", (B[0] - 9 + k * 9.2, B[1] - 13.0, 4.5), (9.0, 0.8, 9.0), lib.mat("facadeBackM", "#6a5a50"), ink=False)
    # ---------- C: fountain plaza
    plaza = lib.add_mesh("cyl", "plazaC", (C[0], C[1] + 3, 0.012), (7.0, 7.0, 0.02), material=sets.image_mat("plazaM", sets.TEX / "pavers.png"), ink=False, vertices=64)
    put("sf_fountain", (C[0], C[1] + 3, 0), 0, h=3.4)
    for a in range(6):
        ang = a / 6 * 6.283
        put("sf_flowers", (C[0] + math.cos(ang) * 6.2, C[1] + 3 + math.sin(ang) * 6.2, 0), a * 50, h=0.45, ink=False)
    for x in (-5, 5):
        put("sf_lamp", (C[0] + x, C[1] - 1.5, 0), 0, h=4.2)
    for k, (x, y) in enumerate(((-6, 9), (0, 10.5), (6, 9), (-8, 4), (8, 4))):
        put("sf_bush", (C[0] + x, C[1] + y, 0), k * 40, h=1.6, ink=False)
    put("sf_bench", (C[0] + 4.5, C[1] + 7.5, 0), 200, h=0.9)
    # ---------- D: bench row + hot-dog cart
    pavers("pathD", D[0], D[1] - 1.5, 18, 2.6)
    for x in (-4.5, 0, 4.5):
        put("sf_bench", (D[0] + x, D[1], 0), 180, h=0.9)
    put("sf_hotdog", (D[0] + 7.5, D[1] - 0.2, 0), 160, h=2.4)
    put("sf_trash", (D[0] - 7, D[1] + 0.2, 0), 0, h=0.95)
    for x in (-6.5, 6.5):
        put("sf_lamp", (D[0] + x, D[1] + 0.6, 0), 0, h=4.2)
    for k, x in enumerate((-9, -3, 3, 9)):
        put("sf_oak", (D[0] + x, D[1] + 7 + (k % 2), 0), k * 80, h=7.5)
        put("sf_bush", (D[0] + x + 1.5, D[1] + 3, 0), k * 30, h=1.3, ink=False)
    grass(28, (-10, 10), (-22, -12), seed=8, keep=lambda x, y: abs(y - (D[1] - 1.5)) > 1.6)
    dress()
    return {"anchor_oak": (A[0], A[1] + 2.2, 0), "anchor_walk": B, "anchor_fountain": (C[0], C[1] + 3, 0), "anchor_benches": D}


# ---------------------------------------------------------------------------------------------- RicksClips dressing
# (DESIGN_DETAIL D3b, user note "it feels like there is no surrounding"): no shot may show bare lawn to the horizon.
# Layers: mid-ground leafy trees + hedges + props between the zones, a dense PINE / leafy TREELINE ring, suburban HOUSES
# behind it, lamp posts + picnic tables + flowerbeds, grass tufts everywhere the lens goes low.
def pine(name, x, y, h):
    m1, m2 = lib.mat("pineM", "#2f6a3a"), lib.mat("pineM2", "#3f8446")
    lib.add_mesh("cyl", name + "t", (x, y, h * 0.12), (0.12 * h / 6, 0.12 * h / 6, h * 0.12), material=lib.mat("barkM", "#6a4a32"), ink=False)
    for k, (z, r) in enumerate(((0.32, 0.30), (0.55, 0.24), (0.76, 0.16))):
        lib.add_mesh("cone", f"{name}c{k}", (x, y, h * z), (h * r, h * r, h * 0.22), material=m1 if k % 2 == 0 else m2, ink=True, vertices=10)


def lod(o, ratio):
    """far dressing is decimated (the 7.4 M-poly first pass: BUILD_LESSONS #58)"""
    if o is None: return o
    for m in [o] + list(o.children_recursive):
        if m.type == "MESH" and len(m.data.polygons) > 400:
            d = m.modifiers.new("lod", "DECIMATE"); d.ratio = ratio
    return o


def dress():
    random.seed(21)
    X0, X1, Y0, Y1 = -42.0, 42.0, -34.0, 28.0
    # treeline ring (pines + oaks + big bushes), two staggered rows
    def ring(step, inset):
        pts = []
        x = X0
        while x <= X1: pts += [(x, Y1 - inset), (x, Y0 + inset)]; x += step
        y = Y0
        while y <= Y1: pts += [(X0 + inset, y), (X1 - inset, y)]; y += step
        return pts
    for k, (x, y) in enumerate(ring(3.4, 0) + ring(4.1, 3.5)):
        if 8 < x < 36 and y < -8: continue          # the street + shop facades side of the entrance
        x += random.uniform(-1, 1); y += random.uniform(-1, 1); r = random.random()
        if r < 0.55: pine(f"pine{k}", x, y, random.uniform(6, 10))
        elif r < 0.68: lod(put("sf_oak", (x, y, 0), random.uniform(0, 360), h=random.uniform(7, 10)), 0.06)
        else: lod(put("sf_bush", (x, y, 0), random.uniform(0, 360), h=random.uniform(2.2, 3.4), ink=False), 0.3)
    # suburban houses beyond the treeline (the RicksClips suburb backdrop)
    for k, x in enumerate(range(-40, 41, 11)):
        lod(put("sf_house", (x + random.uniform(-1, 1), Y1 + 9, 0), 180 + random.uniform(-8, 8), h=7.5), 0.25)
    for k, y in enumerate(range(-28, 26, 12)):
        lod(put("sf_house", (X0 - 9, y, 0), 90, h=7.5), 0.25)
        lod(put("sf_house", (X1 + 9, y, 0), -90, h=7.5), 0.25)
    # mid-ground: leafy trees + pines scattered between the zones (never inside a staging area)
    zones = [(0, 0, 7), (22, 0, 8), (-22, 3, 9), (0, -16, 8), (22, -6, 7)]
    free = lambda x, y: all(math.hypot(x - a, y - b) > r for a, b, r in zones)
    made = 0
    while made < 22:
        x, y = random.uniform(X0 + 6, X1 - 6), random.uniform(Y0 + 6, Y1 - 6)
        if not free(x, y): continue
        if random.random() < 0.45: lod(put("sf_oak", (x, y, 0), random.uniform(0, 360), h=random.uniform(6, 9)), 0.15)
        else: pine(f"mpine{made}", x, y, random.uniform(5, 8))
        made += 1
    # hedges along the paths, flowerbeds, picnic tables, lamps, a fence round the oak lawn
    for k in range(9):
        put("sf_bush", (-8 + k * 2.0, 10.5, 0), k * 37, h=1.1, ink=False)
        put("sf_bush", (-8 + k * 2.0, -10.5, 0), k * 53, h=1.1, ink=False)
    for k in range(24):
        x, y = random.uniform(X0 + 5, X1 - 5), random.uniform(Y0 + 5, Y1 - 5)
        if free(x, y): put("sf_flowers", (x, y, 0), random.uniform(0, 360), h=0.45, ink=False)
    for k, (x, y, a) in enumerate(((9, 9, 20), (-10, 8, -15), (12, -22, 60), (-12, -24, 10))):
        put("WoodenTable_01", (x, y, 0), a, h=0.8)
    for k, (x, y) in enumerate(((-11, 1), (11, 1), (0, 11), (30, 9))):
        put("sf_lamp", (x, y, 0), 0, h=4.2)
    for k in range(5):
        put("sf_fence", (-9 + k * 4.5, 12.5, 0), 0, h=1.0)
    # grass tufts: denser everywhere the lens goes low (the oak lawn, the plaza edge, the bench row, between)
    grass(70, (-12, 12), (-6, 12), seed=31, keep=lambda x, y: math.hypot(x - 1.1, y - 2.6) > 1.2 and not (abs(x) < 2.5 and -1 < y < 3.5))
    grass(40, (-34, -10), (-8, 14), seed=32, keep=lambda x, y: math.hypot(x + 22, y - 3) > 7.4)
    grass(30, (-12, 12), (-28, -18), seed=33)


def lights(state="day"):
    lib.world("#8ec0f0", 1.0, haze=0.018, haze_col="#d6e8f6")
    light("SUN", "sun", (12, -10, 14), "#fff0d8", 4.0, size=0.5, target=(0, 0, 0))
    light("AREA", "fill", (-6, -12, 6), "#a8c8f0", 260, size=8.0, target=(0, 0, 1.0))
