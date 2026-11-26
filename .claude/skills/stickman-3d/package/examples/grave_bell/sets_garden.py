"""Garden (sunny flashback) + certificate insert sets (shots 18-21).
Layout (Blender, Z up, camera on -Y looking +Y):
  purple Victorian house front at y = G.HY (porch y 6..8, steps at x 0), stone path from the steps (y 5.2) down to the
  front gate (y -10) wobbling around x = 0; picket fence along y = -10 and the sides (x = -7.5 / +9);
  hero vegetable bed A (x -5.6..-3.4, y -6..2, top 0.32) on the left with the husband's burial spot G.HOLE,
  beds B/C on the right of the path, WEST signpost + stuck shovel on the grass strip left of bed A, sunflowers.
"""
import bpy, bmesh, math, random
from pathlib import Path
from mathutils import Vector, Matrix, Euler
import lib, sets
from lib import mat, box, add_mesh, rgb, light, emissive
from sets import asset, tex, plane, image_mat, tiled

KENNEY = Path(r"D:\resource\lowpoly\assets\kenney")
CABBAGE = KENNEY / "food-kit" / "Models" / "GLB format" / "cabbage.glb"

# lib.card_index compat: the lead's clip/cf extension (Mixamo 'rig' cards) may not be in lib yet -> local fallback
import inspect as _insp
if "clip" not in _insp.signature(lib.card_index).parameters:
    def _card_index(who, expr, pose, blink=0, mouth=0.0, prop=None, facing=1, clip=None, cf=0):
        best, bd = None, 1e9
        for e in lib.MANIFEST:
            if e["who"] == who and e["expr"] == expr and e["pose"] == pose and e["blink"] == blink and abs(e["mouth"] - mouth) < 1e-3                     and (e["prop"] or None) == (prop or None) and e["facing"] == facing and e.get("clip") == clip:
                d = abs(e.get("cf", 0) - cf)
                if d < bd: best, bd = e["id"], d
        if best is None: raise KeyError(f"no card {who} {expr} {pose} b{blink} m{mouth} {prop} {clip}")
        return best
    lib.card_index = _card_index


G = dict(HY=8.0, PORCH=(6.0, 8.0), DECK=0.7, GATE_Y=-10.0, LFENCE=-7.5, RFENCE=9.0,
         BED_A=(-5.6, -3.4, -6.0, 2.0), BED_TOP=0.32, HOLE=(-4.5, -2.0),
         SIGN=(-6.85, -6.1), SHOVEL=(-6.35, -6.35), WIFE=(-5.95, -2.6))


def path_x(y):
    return 0.55 * math.sin((y + 10.0) * 0.32)


def _mesh(name, verts, faces, m, ink=True):
    me = bpy.data.meshes.new(name); me.from_pydata(verts, [], faces); me.update()
    o = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(o); me.materials.append(m)
    if ink: lib.outline(o)
    return o


# ------------------------------------------------------------------ batched primitives (no bpy.ops: fast for hundreds of parts)
class Batch:
    """collect primitive parts per material in bmesh, then emit ONE object per material (ink outlined)."""
    def __init__(self, name):
        self.name, self.parts = name, {}

    def _bm(self, m):
        if m.name not in self.parts: self.parts[m.name] = (bmesh.new(), m)
        return self.parts[m.name][0]

    @staticmethod
    def _M(loc, scale, rot):
        return Matrix.Translation(loc) @ Euler([math.radians(r) for r in rot]).to_matrix().to_4x4() @ Matrix.Diagonal((*scale, 1.0))

    def put(self, m, kind, M, n=10, rings=6, smooth=True):
        bm = self._bm(m)
        if kind == "sphere": r = bmesh.ops.create_uvsphere(bm, u_segments=n, v_segments=rings, radius=1.0, matrix=M)
        elif kind == "cyl": r = bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=n, radius1=1.0, radius2=1.0, depth=2.0, matrix=M)
        else: r = bmesh.ops.create_cube(bm, size=2.0, matrix=M); smooth = False
        if smooth:
            for v in r["verts"]:
                for f in v.link_faces: f.smooth = True

    def sphere(self, m, loc, scale, rot=(0, 0, 0), seg=10, rings=6):
        self.put(m, "sphere", self._M(loc, scale, rot), seg, rings)

    def cyl(self, m, loc, scale, rot=(0, 0, 0), verts=10, smooth=True):
        self.put(m, "cyl", self._M(loc, scale, rot), verts, smooth=smooth)

    def box(self, m, center, size, rot=(0, 0, 0)):
        self.put(m, "box", self._M(center, [x / 2 for x in size], rot))

    def finish(self, ink=True, width=0.012):
        objs = []
        for k, (bm, m) in self.parts.items():
            me = bpy.data.meshes.new(f"{self.name}_{k}"); bm.to_mesh(me); bm.free()
            o = bpy.data.objects.new(f"{self.name}_{k}", me); bpy.context.scene.collection.objects.link(o); me.materials.append(m)
            if ink: lib.outline(o, width)
            objs.append(o)
        self.parts = {}
        return objs


# ------------------------------------------------------------------ instancing helpers
class Template:
    """import a GLB once (hidden), then place linked copies (shared mesh data, own outline modifier)."""
    def __init__(self, path, material=None):
        root, new = lib.import_glb(path, ink=False)
        self.meshes = [o for o in new if o.type == "MESH"]
        for o in self.meshes:
            o.parent = None; o.matrix_world = o.matrix_world.copy()
            if material is not None:
                o.data.materials.clear(); o.data.materials.append(material)
            lib.outline(o, 0.006)
            o.hide_render = True; o.hide_viewport = True
        bpy.data.objects.remove(root)
        self.n = 0

    def place(self, loc, yaw=0.0, scale=1.0):
        self.n += 1
        r = bpy.data.objects.new(f"inst{self.n}", None); bpy.context.scene.collection.objects.link(r)
        for o in self.meshes:
            c = o.copy(); c.hide_render = False; c.hide_viewport = False
            bpy.context.scene.collection.objects.link(c); c.parent = r
        r.location = loc; r.rotation_euler.z = math.radians(yaw); r.scale = (scale,) * 3
        return r


# ------------------------------------------------------------------ props
def picket_fence(name, a, b, h=1.0, pitch=0.2, gap=None):
    """white picket fence from a to b (2D), pointed pickets + two rails + posts every 2 m; gap=(x0, x1) leaves a gate."""
    wm = mat("picketM", "#fbfbff", rough=0.8)
    a, b = Vector((a[0], a[1], 0)), Vector((b[0], b[1], 0)); d = b - a; L = d.length; u = d / L
    yaw = math.atan2(u.y, u.x); n = int(L / pitch)
    me_v, me_f = [], []
    def add_box(c, sx, sy, sz, pointed=False):
        base = len(me_v)
        hx, hy = sx / 2, sy / 2
        cs, sn = math.cos(yaw), math.sin(yaw)
        def P(x, y, z): return (c.x + x * cs - y * sn, c.y + x * sn + y * cs, z)
        z0, z1 = c.z - sz / 2, c.z + sz / 2
        pts = [P(-hx, -hy, z0), P(hx, -hy, z0), P(hx, hy, z0), P(-hx, hy, z0), P(-hx, -hy, z1), P(hx, -hy, z1), P(hx, hy, z1), P(-hx, hy, z1)]
        me_v.extend(pts)
        f = [(0, 1, 2, 3), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
        if pointed:
            me_v.append(P(0, -hy, z1 + sx * 0.7)); me_v.append(P(0, hy, z1 + sx * 0.7))
            f += [(4, 5, 8), (7, 6, 9), (4, 8, 9, 7), (5, 6, 9, 8)]
        else:
            f.append((4, 5, 6, 7))
        me_f.extend(tuple(base + i for i in q) for q in f)
    for i in range(n + 1):
        p = a + u * (i * pitch)
        if gap and gap[0] < p.x < gap[1] and abs(u.x) > 0.5: continue
        add_box(Vector((p.x, p.y, (h - 0.1) / 2)), 0.1, 0.035, h - 0.1, pointed=True)
    for zr in (0.3, h - 0.3):
        segs = [(0.0, L)]
        if gap and abs(u.x) > 0.5:
            t0, t1 = (gap[0] - a.x) / u.x, (gap[1] - a.x) / u.x
            segs = [(0.0, min(t0, t1)), (max(t0, t1), L)]
        for s0, s1 in segs:
            if s1 - s0 < 0.05: continue
            c = a + u * ((s0 + s1) / 2); add_box(Vector((c.x, c.y, zr)), s1 - s0, 0.03, 0.07)
    return _mesh(name, me_v, me_f, wm)


def sunflower(B, loc, h=1.9, face=(0, -1), seed=0):
    r = random.Random(seed)
    stem = mat("sfStem", "#3f9a2c"); leaf = mat("sfLeaf", "#4fb83a"); pet = mat("sfPetal", "#ffc21a", rough=0.7); disc = mat("sfDisc", "#5a3416")
    x, y = loc[0], loc[1]
    B.cyl(stem, (x, y, h / 2), (0.035, 0.035, h / 2), verts=8)
    for k in range(3):
        z = h * (0.3 + 0.2 * k); a = r.uniform(0, 6.28)
        B.sphere(leaf, (x + 0.16 * math.cos(a), y + 0.16 * math.sin(a), z), (0.18, 0.07, 0.03), (r.uniform(-20, 20), 20, math.degrees(a)))
    yaw = math.atan2(face[0], -face[1]) + math.radians(r.uniform(-25, 25)); pitch = math.radians(-15 + r.uniform(-8, 8))
    HM = Matrix.Translation((x, y, h + 0.05)) @ Euler((pitch, 0, yaw)).to_matrix().to_4x4()
    B.put(disc, "cyl", HM @ Batch._M((0, 0, 0), (0.13, 0.13, 0.03), (90, 0, 0)), 20)
    for k in range(14):
        a = 2 * math.pi * k / 14
        B.put(pet, "sphere", HM @ Batch._M((0.21 * math.cos(a), -0.012, 0.21 * math.sin(a)), (0.1, 0.012, 0.045), (0, -math.degrees(a), 0)), 8, 5)


def round_tree(B, loc, h=5.0, seed=0):
    r = random.Random(seed)
    B.cyl(mat("trunkM", "#7a5236"), (loc[0], loc[1], h * 0.3), (0.16, 0.16, h * 0.3), verts=10)
    lm = mat(f"leafM{seed % 3}", ["#55b33a", "#64c444", "#4aa634"][seed % 3])
    for k in range(5):
        rr = h * r.uniform(0.17, 0.24)
        B.sphere(lm, (loc[0] + r.uniform(-0.5, 0.5) * h * 0.25, loc[1] + r.uniform(-0.3, 0.3), h * r.uniform(0.62, 0.85)), (rr, rr, rr * 0.9), seg=14, rings=10)


def toon_pine(B, loc, h=9.0, seed=0):
    r = random.Random(seed)
    B.cyl(mat("trunkM", "#7a5236"), (loc[0], loc[1], h * 0.12), (0.22, 0.22, h * 0.12), verts=8)
    gm = mat(f"pineM{seed % 2}", ["#2f8a4a", "#3a9a52"][seed % 2])
    for k in range(4):
        z0 = h * (0.15 + 0.2 * k); rr = h * (0.3 - 0.06 * k) * r.uniform(0.9, 1.05); hh = h * 0.34
        bm = B._bm(gm)
        res = bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=12, radius1=rr, radius2=0.0, depth=hh,
                                    matrix=Matrix.Translation((loc[0], loc[1], z0 + hh / 2)))


def clod_mesh(name, size=0.08, seed=0, m=None):
    r = random.Random(seed)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=size)
    o = bpy.context.active_object; o.name = name
    for v in o.data.vertices: v.co *= r.uniform(0.75, 1.15)
    o.scale = (1.0, r.uniform(0.8, 1.1), r.uniform(0.6, 0.85)); bpy.ops.object.transform_apply(scale=True)
    o.data.materials.append(m or mat("clodM", "#7a4a26", rough=0.95)); lib.outline(o, 0.008)
    return o


def window(name, x, z, w=1.0, hgt=1.6, y=8.0, glass="#9fc4e8"):
    wt = mat("trimM", "#fbfaff")
    plane(name + "_glass", w - 0.1, hgt - 0.1, mat("glassM", glass, rough=0.3, emit=0.25, emit_col="#cfe6ff"), (x, y - 0.02, z))
    box(name + "_t", (x, y - 0.06, z + hgt / 2), (w + 0.3, 0.12, 0.14), wt); box(name + "_b", (x, y - 0.08, z - hgt / 2), (w + 0.3, 0.16, 0.12), wt)
    box(name + "_l", (x - w / 2, y - 0.06, z), (0.12, 0.12, hgt), wt); box(name + "_r", (x + w / 2, y - 0.06, z), (0.12, 0.12, hgt), wt)
    box(name + "_h", (x, y - 0.04, z), (w, 0.05, 0.05), wt, ink=False); box(name + "_v", (x, y - 0.04, z), (0.05, 0.05, hgt), wt, ink=False)
    box(name + "_cap", (x, y - 0.1, z + hgt / 2 + 0.16), (w + 0.45, 0.2, 0.08), wt)


# ------------------------------------------------------------------ house
def build_house():
    HY = G["HY"]; P0, P1 = G["PORCH"]; DK = G["DECK"]
    sid = mat("sidingPurple", "#ffffff", tex("siding_purple"))
    wt = mat("trimM", "#fbfaff")
    body = box("house", (0, HY + 3.5, 3.0), (10, 7, 6.0), sid); tiled(body, 1.4)
    # gable roof (ridge along Y) + front gable wall
    rf = mat("roofM", "#3c3f6a", rough=0.9)
    x0, x1, zE, zR, y0, y1 = -5.5, 5.5, 5.9, 8.3, HY - 0.5, HY + 7.4
    v = [(x0, y0, zE), (0, y0, zR), (x1, y0, zE), (x0, y1, zE), (0, y1, zR), (x1, y1, zE)]
    _mesh("roof", v, [(0, 1, 4, 3), (1, 2, 5, 4)], rf)
    for s, (xa, xb) in enumerate(((x0, 0), (0, x1))):
        th = 0.12
        _mesh(f"roofT{s}", [(xa, y0, (zE if xa == x0 else zR) - th), (xb, y0, (zR if xb == 0 else zE) - th), (xb, y1, (zR if xb == 0 else zE) - th), (xa, y1, (zE if xa == x0 else zR) - th)],
              [(0, 1, 2, 3)], rf, ink=False)
    g = _mesh("gable", [(-5, HY, 6.0), (5, HY, 6.0), (0, HY, 8.1)], [(0, 1, 2)], sid, ink=False)
    g.data.uv_layers.new(); tiled(g, 1.4)
    # fascia boards along the gable edges + gable vent
    for s in (-1, 1):
        L = math.hypot(5.5, zR - zE); a = math.atan2(zR - zE, 5.5)
        b = box(f"fascia{s}", (s * 2.75, y0 - 0.02, (zE + zR) / 2 - 0.05), (L + 0.1, 0.12, 0.22), wt); b.rotation_euler.y = s * a
    window("gwin", 0, 6.85, 0.7, 0.9, HY)
    # trim: corner boards, floor band, frieze
    for s in (-1, 1): box(f"corner{s}", (s * 5.0, HY - 0.03, 3.0), (0.3, 0.14, 6.0), wt)
    box("band", (0, HY - 0.03, 3.25), (10.2, 0.14, 0.18), wt); box("frieze", (0, HY - 0.05, 5.85), (10.4, 0.18, 0.3), wt)
    box("foundation", (0, HY + 3.5, 0.2), (10.3, 7.2, 0.4), mat("stoneM", "#8d8a9a"))
    for x in (-3.0, 0.0, 3.0): window(f"uw{x}", x, 4.55, 1.0, 1.6, HY)
    for x in (-3.0, 3.0): window(f"lw{x}", x, 1.95, 1.1, 1.7, HY)
    # door
    box("door", (0, HY - 0.02, DK + 1.15), (1.1, 0.08, 2.3), mat("doorM2", "#f6f4fa"))
    box("doorWin", (0, HY - 0.07, DK + 1.6), (0.5, 0.03, 0.7), mat("doorGreen", "#3f7a52"))
    for zz in (DK + 0.45,): box("doorPanel", (0, HY - 0.07, zz), (0.6, 0.03, 0.5), mat("doorPan", "#e6e2ee"))
    box("doorFrame", (0, HY - 0.05, DK + 2.4), (1.4, 0.1, 0.16), wt)
    add_mesh("sphere", "knob", (0.4, HY - 0.12, DK + 1.1), (0.04,) * 3, material=mat("brassM", "#d9a640", rough=0.4), segments=10, ring_count=6)
    # porch: deck, lattice skirt, posts, roof (teal ceiling), railing with balusters, steps
    deck = box("deck", (0, (P0 + P1) / 2, DK - 0.06), (8.6, P1 - P0, 0.12), mat("deckM", "#b9b2c8", tex("planks")))
    plane("lattice", 8.5, DK - 0.12, image_mat("latticeM", tex("lattice")), (0, P0 + 0.02, (DK - 0.12) / 2))
    for s in (-1, 1):
        o = plane(f"latticeS{s}", P1 - P0, DK - 0.12, bpy.data.materials["latticeM"], (s * 4.28, (P0 + P1) / 2, (DK - 0.12) / 2), rot=(90, 0, 90))
    for x in (-4.1, -1.2, 1.2, 4.1):
        box(f"post{x}", (x, P0 + 0.12, (DK + 3.3) / 2), (0.18, 0.18, 3.3 - DK), wt)
        box(f"postcap{x}", (x, P0 + 0.12, 3.15), (0.3, 0.3, 0.14), wt)
    box("porchRoof", (0, (P0 + P1) / 2 - 0.1, 3.4), (8.9, P1 - P0 + 0.5, 0.18), mat("porchRoofM", "#3c3f6a"))
    box("porchCeil", (0, (P0 + P1) / 2, 3.28), (8.6, P1 - P0, 0.06), mat("ceilTeal", "#7fd0d6"), ink=False)
    box("porchFascia", (0, P0 - 0.1, 3.25), (8.9, 0.1, 0.25), wt)
    HB = Batch("houseParts"); HBn = Batch("houseNoInk")
    for i in range(22):                                                      # scallop brackets under the fascia
        HBn.sphere(wt, (-4.2 + i * 0.4, P0 - 0.1, 3.1), (0.12, 0.04, 0.08), seg=8, rings=5)
    bal = []
    for xa, xb in ((-4.1, -1.2), (1.2, 4.1)):
        box(f"rail{xa}", ((xa + xb) / 2, P0 + 0.12, DK + 0.95), (xb - xa, 0.1, 0.08), wt)
        box(f"railB{xa}", ((xa + xb) / 2, P0 + 0.12, DK + 0.12), (xb - xa, 0.08, 0.06), wt)
        n = int((xb - xa) / 0.16)
        for k in range(1, n):
            HB.box(wt, (xa + k * (xb - xa) / n, P0 + 0.12, DK + 0.53), (0.045, 0.045, 0.8))
    for s in (-1, 1):
        box(f"railSide{s}", (s * 4.1, (P0 + P1) / 2, DK + 0.95), (0.08, P1 - P0, 0.08), wt)
    sm = mat("stepM", "#d8d2e2")
    for k in range(3):
        h = DK * (3 - k) / 3
        box(f"step{k}", (0, P0 - 0.3 - k * 0.3 + 0.15, h / 2), (2.0, 0.3 + 0.0, h), sm)
    # flower boxes / planters on porch for colour
    for x in (-3.0, 3.0):
        box(f"pbox{x}", (x, HY - 0.25, 1.1 - 0.15), (1.3, 0.25, 0.22), mat("pboxM", "#a2552e"))
        for k in range(5):
            HB.sphere(mat(f"pflM{k % 3}", ["#e8435a", "#ffffff", "#f0a020"][k % 3]), (x - 0.5 + k * 0.25, HY - 0.25, 1.07), (0.11,) * 3, seg=8, rings=6)
    HB.finish(width=0.008); HBn.finish(ink=False)


# ------------------------------------------------------------------ garden
def build_garden(cabbage_tpl=None):
    """the whole sunny garden; returns dict of anchors and objects."""
    out = {}
    r = random.Random(7)
    gr = add_mesh("plane", "ground", (0, 5, 0), (70, 70, 1), material=mat("grassM", "#ffffff", tex("grass")), ink=False); tiled(gr, 2.5)
    sky = plane("sky", 260, 110, image_mat("skyM", tex("sky_day"), emit=1.0), (0, 95, 22))
    sky.visible_shadow = False
    build_house()
    # path: flagstones
    sm = [mat("flagA", "#c9c4d4"), mat("flagB", "#b5b0c2"), mat("flagC", "#d8d4e0")]
    y = 5.0; k = 0; PB = Batch("flags")
    while y > G["GATE_Y"] - 1.0:
        cx = path_x(y)
        for j in range(3):
            if r.random() < 0.12: continue
            rr = r.uniform(0.18, 0.27)
            PB.cyl(sm[k % 3], (cx + (j - 1) * 0.42 + r.uniform(-0.06, 0.06), y + r.uniform(-0.06, 0.06), 0.006), (rr, rr * r.uniform(0.75, 1.0), 0.008),
                   (0, 0, r.uniform(0, 180)), verts=7, smooth=False); k += 1
        y -= 0.42
    PB.finish(width=0.008)
    # fences
    gx = path_x(G["GATE_Y"])
    picket_fence("fenceFront", (G["LFENCE"], G["GATE_Y"]), (G["RFENCE"], G["GATE_Y"]), gap=(gx - 0.85, gx + 0.85))
    picket_fence("fenceL", (G["LFENCE"], G["GATE_Y"]), (G["LFENCE"], G["HY"] + 1.0))
    picket_fence("fenceR", (G["RFENCE"], G["GATE_Y"]), (G["RFENCE"], G["HY"] + 1.0))
    wt = mat("picketM", "#fbfbff")
    for s in (-1, 1):
        box(f"gatepost{s}", (gx + s * 0.9, G["GATE_Y"], 0.65), (0.16, 0.16, 1.3), wt)
        add_mesh("sphere", f"gateball{s}", (gx + s * 0.9, G["GATE_Y"], 1.38), (0.11,) * 3, material=wt, segments=10, ring_count=8)
    # beds
    wood = mat("bedWood", "#9a6236", tex("planks"))
    dirt = mat("dirtM", "#ffffff", tex("dirt"))
    beds = {"A": G["BED_A"], "B": (2.0, 5.0, -8.0, -3.2), "C": (2.0, 5.0, -2.2, 3.0)}
    T = G["BED_TOP"]
    for k_, (xa, xb, ya, yb) in beds.items():
        d = box(f"bedDirt{k_}", ((xa + xb) / 2, (ya + yb) / 2, T / 2 - 0.02), (xb - xa, yb - ya, T - 0.04), dirt, ink=False); tiled(d, 1.6)
        d["no_ground"] = False
        for (cx, cy, sx, sy) in (((xa + xb) / 2, ya, xb - xa + 0.16, 0.08), ((xa + xb) / 2, yb, xb - xa + 0.16, 0.08), (xa, (ya + yb) / 2, 0.08, yb - ya), (xb, (ya + yb) / 2, 0.08, yb - ya)):
            b = box(f"bedRim{k_}{cx:.1f}{cy:.1f}", (cx, cy, T / 2 + 0.02), (sx, sy, T + 0.04), wood); tiled(b, 0.8)
    out["beds"] = beds
    # cabbages (Kenney food kit, recoloured lime)
    tpl = cabbage_tpl or Template(CABBAGE, mat("cabbageM", "#8fdc4e", rough=0.85))
    out["cab_tpl"] = tpl
    hx, hy = G["HOLE"]
    xa, xb, ya, yb = G["BED_A"]
    for cx in (xa + 0.45, xb - 0.45):
        yy = ya + 0.5
        while yy < yb - 0.3:
            if not (abs(yy - hy) < 0.55 and abs(cx - hx) < 0.75) and yy > hy - 1.6:
                tpl.place((cx + r.uniform(-0.05, 0.05), yy, T - 0.03), r.uniform(0, 360), r.uniform(0.95, 1.15))
            yy += 0.95
    for k_ in ("B", "C"):
        xa2, xb2, ya2, yb2 = beds[k_]
        for i in range(3):
            for j in range(int((yb2 - ya2) / 0.9)):
                tpl.place((xa2 + 0.55 + i * (xb2 - xa2 - 1.1) / 2, ya2 + 0.5 + j * 0.9, T - 0.03), r.uniform(0, 360), r.uniform(0.95, 1.3))
    # WEST signpost + shovel stuck in the grass
    sx, sy = G["SIGN"]
    pm = mat("postWood", "#8a5a34", tex("planks"))
    box("signPost", (sx, sy, 1.05), (0.12, 0.12, 2.1), pm)
    sg = plane("westSign", 1.1, 0.34, image_mat("westM", tex("west")), (sx + 0.32, sy - 0.08, 1.8))
    box("westBack", (sx + 0.32, sy - 0.03, 1.8), (1.14, 0.06, 0.38), pm)
    arrow = _mesh("westArrow", [(sx - 0.25, sy - 0.03 - 0.03, 1.8 + 0.19), (sx - 0.48, sy - 0.06, 1.8), (sx - 0.25, sy - 0.06, 1.8 - 0.19)], [(0, 1, 2)], pm)
    box("signCap", (sx, sy, 2.15), (0.2, 0.2, 0.06), pm)
    out["sign"] = sg
    sp = asset("rusted_spade_01", (G["SHOVEL"][0], G["SHOVEL"][1], -0.22), yaw=-20, height=1.3)
    sp.rotation_euler = (math.radians(8), math.radians(-12), math.radians(-20)); out["shovel"] = sp
    # sunflowers along the fence + house side
    k = 0; B = Batch("garden")
    for x in (-6.9, -6.3, 5.6, 6.6, 7.6, 8.4):
        sunflower(B, (x, G["GATE_Y"] + 0.45 + r.uniform(-0.1, 0.2)), r.uniform(1.6, 2.2), seed=k); k += 1
    for y_ in (3.0, 4.2, 5.4, 6.6):
        sunflower(B, (-6.9 + r.uniform(-0.1, 0.2), y_), r.uniform(1.8, 2.4), seed=k); k += 1
    for y_ in (-6.0, -4.0, 0.5, 4.5):
        sunflower(B, (8.4, y_), r.uniform(1.7, 2.3), seed=k); k += 1
    # trees: toon pines behind (the Poly Haven pine/fir .blends are 300-650 MB: far too heavy), round toon trees at the sides
    for i, (x, y_, h) in enumerate(((-11, 18, 9), (12, 20, 10), (-16, 30, 12), (17, 32, 11), (-4, 30, 10), (7, 34, 12), (-22, 24, 10), (22, 26, 9))):
        toon_pine(B, (x, y_), h, seed=i)
    for i, (x, y_, h) in enumerate(((-11.5, 4, 6.5), (-12.5, -6, 5.5), (12.5, 2, 6.0), (13.0, -8, 5.0), (-9.5, 12, 6.5), (10, 13, 7))):
        round_tree(B, (x, y_), h, seed=i)
    # distant fences / hedges
    for i in range(14):
        B.sphere(mat("hedgeM", "#4fa83a"), (-24 + i * 3.8, 26 + r.uniform(-2, 2), 0.5), (2.0, 1.2, 1.0), seg=12, rings=8)
    B.finish()
    return out


def garden_lights():
    lib.world("#bfe0ff", 0.85, haze=0.0)
    light("SUN", "sun", (0, 0, 20), "#fff0d4", 4.2, size=0.25, rot=(48, 0, -35))
    light("SUN", "skyfill", (0, 0, 20), "#cfe4ff", 0.6, size=2.0, rot=(-30, 0, 160), shadow=False)


def garden_compositor():
    lib.compositor(bloom=0.3, vign=0.28, vign_col="#5a4a80", sat=1.18)


# ------------------------------------------------------------------ certificate insert (shot 19)
I = dict(HUS=(0.0, 0.45, 0.0), BOARD=(0.0, 0.16, 0.86))


def build_insert():
    out = {}
    wall = box("iwall", (0, 1.6, 1.5), (8, 0.1, 4), mat("wallWarm", "#ffffff", tex("wall_warm")), ink=False); tiled(wall, 0.8)
    box("iwain", (0, 1.53, 0.45), (8, 0.06, 0.9), mat("iwainM", "#7a3f26", tex("planks")))
    box("irail", (0, 1.5, 0.92), (8, 0.08, 0.06), mat("irailM", "#4a2216"))
    fl = box("ifloor", (0, 0, -0.025), (8, 6, 0.05), mat("ifloorM", "#ffffff", tex("planks"))); tiled(fl, 2.0)
    pf = asset("fancy_picture_frame_01", (-0.95, 1.53, 1.95), height=0.5); pf.rotation_euler = (math.radians(90), 0, 0)
    # clipboard + certificate + $20 + clip (parented to one empty so the shot can bob it)
    root = bpy.data.objects.new("board", None); bpy.context.scene.collection.objects.link(root)
    bd = box("clipboard", (0, 0, 0), (0.62, 0.025, 0.82), mat("boardM", "#b27a42", tex("planks"))); bd.parent = root
    cert = plane("cert", 0.52, 0.65, image_mat("certM", tex("certificate"), emit=0.0), (0, -0.016, -0.03)); cert.parent = root
    bill = plane("bill", 0.3, 0.133, image_mat("billM", tex("bill20"), emit=0.0), (0.16, -0.022, 0.37)); bill.parent = root
    bill.rotation_euler = (math.radians(90), math.radians(-9), 0)
    clip = box("clip", (0, -0.03, 0.38), (0.26, 0.05, 0.1), mat("clipM", "#e2b13c", rough=0.35)); clip.parent = root
    box("clipBar", (0, -0.05, 0.36), (0.16, 0.02, 0.03), mat("clipD", "#9a7420")).parent = root
    root.location = I["BOARD"]; root.rotation_euler = (math.radians(-6), 0, math.radians(2))
    out["board"] = root
    return out


def insert_lights():
    lib.world("#ffe2c0", 0.4, haze=0.0)
    light("AREA", "key", (-1.6, -2.0, 2.6), "#ffe7c8", 110, size=2.0, target=(0, 0.3, 1.2))
    light("AREA", "fill", (1.8, -1.5, 1.4), "#ffd4a0", 40, size=2.0, target=(0, 0.3, 1.2))
    light("POINT", "rim", (0.8, 1.2, 2.4), "#fff0d0", 60, size=0.3)
