"""Section 2 sets: stair shaft -> small conference room -> dining room (one connected bunker interior).
Z up, the camera travels mostly along +Y. Layout (metres):
  shaft     x [-0.8, 0.8], top landing y [-12.5, -9] at z 2.7, 15 steps down to y -4.5 (z 0), opens into the room at y -4
  conference x [-2.6, 2.6], y [-4, 2.2], ceiling 3.0; doorway to the dining room in the back wall x [1.0, 2.0]
  dining    x [-2.6, 2.6], y [2.3, 7.9], ceiling 2.9; dark doorway in the back wall x [-0.6, 0.3] (section end),
            dark side door in the right wall y [4.85, 5.75] (staff exit)
"""
import bpy, math
from mathutils import Vector
import lib, sets
from lib import mat, box, add_mesh, rgb, light, emissive

TEX = lib.HERE / "tex"
def tx(n): return TEX / f"{n}.png"

SEAT = 0.29                      # seat height that fits the seated cards (hip bottom of Seated_Idle_front / Sit_To_Stand)
TABLE_H = 0.60                   # table top: the seated cards' hands rest on it

L = dict(
    SHAFT_X=0.8, LAND_Y=-9.0, LAND_Z=2.7, STAIR_END=-4.5, ROOM0=-4.0,
    WALL1=2.2, DOOR1=(1.0, 2.0), WALL2=7.9, DOOR2=(-0.6, 0.3), SIDE=(4.85, 5.75),
    C1=(-1.05, 4.7), R1=0.62, C2=(1.15, 6.0), R2=0.58,
)


def M():
    return dict(
        wall=mat("s2_wallM", "#ffffff", tx("s2_wall")),
        conc=mat("s2_concM", "#ffffff", tx("s2_concrete")),
        ceil=mat("s2_ceilM", "#ffffff", tx("s2_ceiling")),
        floor=mat("s2_floorM", "#ffffff", tx("s2_floor")),
        floor2=mat("s2_floor2M", "#ffffff", tx("s2_floor2")),
        wood=mat("s2_woodM", "#ffffff", tx("s2_wood")),
        dark=mat("s2_darkM", "#ffffff", tx("s2_darkwood")),
        cloth=mat("s2_clothM", "#ffffff", tx("s2_cloth")),
        black=mat("s2_black", "#000000", rough=1.0),
        brass=mat("s2_brass", "#b8893a", rough=0.5),
        iron=mat("s2_iron", "#2a2622", rough=0.7),
        plate=mat("s2_plate", "#f2efe6", rough=0.4),
    )


def tb(name, c, s, m, unit=1.0, ink=False):
    o = box(name, c, s, m, ink=ink); sets.tiled(o, unit); return o


def wall_y(name, y, x0, x1, z1, m, holes=(), th=0.2, unit=1.0):
    """wall in the XZ plane at y (centre of its thickness) with rectangular holes (xa, xb, za, zb)."""
    xs = sorted({x0, x1, *[h[0] for h in holes], *[h[1] for h in holes]})
    out = []
    for a, b in zip(xs, xs[1:]):
        hs = [h for h in holes if h[0] <= a and b <= h[1]]
        spans = [(0, z1)]
        for h in hs:
            spans = [s for sp in spans for s in ((sp[0], min(sp[1], h[2])), (max(sp[0], h[3]), sp[1])) if s[1] - s[0] > 1e-3]
        for i, (za, zb) in enumerate(spans):
            out.append(tb(f"{name}_{len(out)}", ((a + b) / 2, y, (za + zb) / 2), (b - a, th, zb - za), m, unit))
    return out


def wall_x(name, x, y0, y1, z1, m, holes=(), th=0.2, unit=1.0):
    ys = sorted({y0, y1, *[h[0] for h in holes], *[h[1] for h in holes]})
    out = []
    for a, b in zip(ys, ys[1:]):
        hs = [h for h in holes if h[0] <= a and b <= h[1]]
        spans = [(0, z1)]
        for h in hs:
            spans = [s for sp in spans for s in ((sp[0], min(sp[1], h[2])), (max(sp[0], h[3]), sp[1])) if s[1] - s[0] > 1e-3]
        for za, zb in spans:
            out.append(tb(f"{name}_{len(out)}", (x, (a + b) / 2, (za + zb) / 2), (th, b - a, zb - za), m, unit))
    return out


def wainscot_y(name, y, x0, x1, m, holes=(), h=0.85, face=-1):
    """dark wood panel band + rail on the room side of a y-wall (face -1: room is at smaller y)."""
    xs = sorted({x0, x1, *[o[0] for o in holes], *[o[1] for o in holes]})
    for a, b in zip(xs, xs[1:]):
        if any(o[0] <= a and b <= o[1] and o[2] < 0.05 for o in holes): continue
        tb(f"{name}{a:.2f}", ((a + b) / 2, y + face * 0.02, h / 2), (b - a, 0.04, h), m, 0.6, ink=True)
        box(f"{name}r{a:.2f}", ((a + b) / 2, y + face * 0.045, h), (b - a, 0.05, 0.05), m)


def wainscot_x(name, x, y0, y1, m, holes=(), h=0.85, face=1):
    ys = sorted({y0, y1, *[o[0] for o in holes], *[o[1] for o in holes]})
    for a, b in zip(ys, ys[1:]):
        if any(o[0] <= a and b <= o[1] and o[2] < 0.05 for o in holes): continue
        tb(f"{name}{a:.2f}", (x + face * 0.02, (a + b) / 2, h / 2), (0.04, b - a, h), m, 0.6, ink=True)
        box(f"{name}r{a:.2f}", (x + face * 0.045, (a + b) / 2, h), (0.05, b - a, 0.05), m)


def door_frame_y(name, y, xa, xb, top, m, th=0.26):
    box(name + "L", (xa - 0.05, y, top / 2), (0.1, th, top), m); box(name + "R", (xb + 0.05, y, top / 2), (0.1, th, top), m)
    box(name + "T", ((xa + xb) / 2, y, top + 0.05), (xb - xa + 0.2, th, 0.1), m)


def door_frame_x(name, x, ya, yb, top, m, th=0.26):
    box(name + "L", (x, ya - 0.05, top / 2), (th, 0.1, top), m); box(name + "R", (x, yb + 0.05, top / 2), (th, 0.1, top), m)
    box(name + "T", (x, (ya + yb) / 2, top + 0.05), (th, yb - ya + 0.2, 0.1), m)


def pendant(name, loc, cord=0.5, r=0.24, glow="#ffd9a0", parent=None):
    """bowl lamp on a cord: returns (pivot empty at the ceiling, bulb world z)."""
    piv = bpy.data.objects.new(name, None); bpy.context.scene.collection.objects.link(piv); piv.location = (loc[0], loc[1], loc[2])
    m = mat("s2_shadeM", "#7a6a48", rough=0.6)
    cd = add_mesh("cyl", name + "_cord", (loc[0], loc[1], loc[2] - cord / 2), (0.008, 0.008, cord / 2), material=mat("s2_cord", "#1a1612"), ink=False, vertices=8)
    sh = add_mesh("cone", name + "_shade", (loc[0], loc[1], loc[2] - cord - 0.06), (1, 1, 1), material=m, ink=True,
                  radius1=r, radius2=0.035, depth=0.16, vertices=24, end_fill_type="NOTHING")
    bl = add_mesh("sphere", name + "_bulb", (loc[0], loc[1], loc[2] - cord - 0.1), (0.055,) * 3, material=emissive("s2_bulbM", glow, 12.0), ink=False, segments=12, ring_count=8)
    bl.visible_shadow = False
    bpy.context.view_layer.update()
    for o in (cd, sh, bl):
        o.parent = piv; o.matrix_parent_inverse = piv.matrix_world.inverted()
    return piv, loc[2] - cord - 0.1


def spot(name, loc, target, energy, col="#ffcf8a", cone=70, blend=0.35, size=0.08, cutoff=None, shadow=True):
    o = light("SPOT", name, loc, col, energy, size=size, target=target, spot=(cone, blend), shadow=shadow)
    if cutoff:
        try: o.data.use_custom_distance = True; o.data.cutoff_distance = cutoff
        except Exception: pass
    return o


def point(name, loc, energy, col="#ffcf8a", size=0.1, cutoff=None, shadow=True):
    o = light("POINT", name, loc, col, energy, size=size, shadow=shadow)
    if cutoff:
        try: o.data.use_custom_distance = True; o.data.cutoff_distance = cutoff
        except Exception: pass
    return o


def chair(name, pos, yaw_deg, mm, seat=SEAT, back=0.55, w=0.42, d=0.40):
    """simple wooden chair, origin at the floor under the seat centre; front faces local -Y, rotated by yaw."""
    root = bpy.data.objects.new(name, None); bpy.context.scene.collection.objects.link(root)
    parts = [box(name + "_seat", (0, 0, seat - 0.025), (w, d, 0.05), mm["wood"])]
    for sx in (-1, 1):
        for sy in (-1, 1):
            hgt = seat - 0.05 if sy < 0 else seat + back
            parts.append(box(name + f"_leg{sx}{sy}", (sx * (w / 2 - 0.03), sy * (d / 2 - 0.03), hgt / 2), (0.04, 0.04, hgt), mm["dark"]))
    for k, z in enumerate((seat + back - 0.06, seat + back * 0.55)):
        parts.append(box(name + f"_slat{k}", (0, d / 2 - 0.03, z), (w - 0.04, 0.03, 0.08), mm["wood"]))
    parts.append(box(name + "_rail", (0, -d / 2 + 0.03, seat * 0.35), (w - 0.06, 0.025, 0.025), mm["dark"]))
    for p in parts: p.parent = root
    root.location = pos; root.rotation_euler.z = math.radians(yaw_deg)
    return root


def round_table(name, c, R, mm, h=TABLE_H):
    """pedestal table under a floor-length cloth (the seated cards have no drawn legs: the cloth hides the laps)."""
    root = bpy.data.objects.new(name, None); bpy.context.scene.collection.objects.link(root); root.location = (c[0], c[1], 0)
    cl = add_mesh("cone", name + "_cloth", (0, 0, h / 2), (1, 1, 1), material=mm["cloth"], ink=True,
                  radius1=R + 0.07, radius2=R + 0.015, depth=h, vertices=48, end_fill_type="NOTHING")
    top = add_mesh("cyl", name + "_top", (0, 0, h - 0.012), (R + 0.015, R + 0.015, 0.012), material=mm["cloth"], ink=True, vertices=48)
    hem = add_mesh("cyl", name + "_hem", (0, 0, 0.02), (R + 0.075, R + 0.075, 0.02), material=mm["cloth"], ink=False, vertices=48)
    for o in (cl, top, hem): o.parent = root
    return root


def plate(name, loc, r=0.11, mm=None):
    p = add_mesh("cyl", name, (loc[0], loc[1], loc[2] + 0.008), (r, r, 0.008), material=mm["plate"], ink=True, vertices=24)
    add_mesh("cyl", name + "_in", (loc[0], loc[1], loc[2] + 0.017), (r * 0.62, r * 0.62, 0.002), material=mat("s2_plateIn", "#e4dfd2"), ink=False, vertices=24)
    return p


def kenney(name, loc, width, yaw=0.0):
    path = sets.KENNEY / "food-kit" / "Models" / "GLB format" / f"{name}.glb"
    if not path.exists(): return None
    root, objs = lib.import_glb(path, loc=(0, 0, 0), yaw=yaw)
    bpy.context.view_layer.update()
    pts = [o.matrix_world @ Vector(v) for o in objs if o.type == "MESH" for v in o.bound_box]
    if not pts: return root
    xs = [p.x for p in pts]; ys = [p.y for p in pts]; zs = [p.z for p in pts]
    s = width / max(1e-4, max(max(xs) - min(xs), max(ys) - min(ys)))
    root.scale = (s,) * 3
    root.location = (loc[0] - (max(xs) + min(xs)) / 2 * s, loc[1] - (max(ys) + min(ys)) / 2 * s, loc[2] - min(zs) * s)
    return root


# ===================================================================== builders
def build_shaft(mm):
    X = L["SHAFT_X"]; out = {}
    # top landing + 15 solid steps (rise 0.18, tread 0.3) down to the room floor
    tb("s2_landing", (0, -10.75, L["LAND_Z"] / 2), (2 * X, 3.5, L["LAND_Z"]), mm["conc"], 0.8)
    for i in range(15):
        top = 0.18 * (i + 1); y1 = -4.5 - 0.3 * i; y0 = y1 - 0.3
        o = tb(f"s2_step{i}", (0, (y0 + y1) / 2, top / 2), (2 * X, 0.3, top), mm["conc"], 0.8)
        lib.outline(o, 0.008)
    tb("s2_shaftFloor", (0, -4.25, -0.05), (2 * X, 0.5, 0.1), mm["conc"])
    # side walls, back wall, flat ceiling over the landing, sloped ceiling over the flight
    for sx in (-1, 1):
        tb(f"s2_shaftWall{sx}", (sx * (X + 0.1), -8.25, 2.9), (0.2, 8.5, 5.8), mm["conc"], 0.9)
    tb("s2_shaftBack", (0, -12.6, 2.9), (2 * X + 0.4, 0.2, 5.8), mm["conc"], 0.9)
    tb("s2_shaftCeil", (0, -10.5, 5.4), (2 * X + 0.4, 4.2, 0.2), mm["conc"], 0.9)
    a = Vector((0, -8.5, 5.3)); b = Vector((0, -4.0, 5.3 - 0.6 * 4.5)); c = (a + b) / 2; Lg = (b - a).length
    sc = tb("s2_shaftSlope", (0, c.y, c.z + 0.1), (2 * X + 0.4, Lg + 0.4, 0.2), mm["conc"], 0.9)
    sc.rotation_euler.x = -math.atan2(0.6 * 4.5, 4.5)
    # handrail on the left wall
    hr = add_mesh("cyl", "s2_handrail", (-X + 0.06, -6.75, 0.9 + 1.35), (0.025, 0.025, 2.65), rot=(0, 0, 0), material=mm["iron"], ink=True, vertices=10)
    hr.rotation_euler.x = math.radians(90) - math.atan2(2.7, 4.5)
    # swinging lamp halfway down
    piv, bz = pendant("s2_shaftLamp", (0, -5.9, 5.3 - 0.6 * 2.6), cord=0.45, r=0.2)
    sp = spot("s2_shaftSpot", (0, -5.9, bz), (0, -5.9, -1), 260, "#ffd29a", cone=120, blend=0.6, size=0.05)
    bpy.context.view_layer.update()
    sp.parent = piv; sp.matrix_parent_inverse = piv.matrix_world.inverted()
    out["lamp"] = piv
    return out


def build_conference(mm):
    out = {}; X0, X1, Y0, Y1, H = -2.6, 2.6, L["ROOM0"], L["WALL1"], 3.0
    d1 = L["DOOR1"]
    tb("s2_confFloor", (0, (Y0 + Y1) / 2, -0.05), (X1 - X0, Y1 - Y0, 0.1), mm["floor"], 1.6)
    tb("s2_confCeil", (0, (Y0 + Y1) / 2, H + 0.1), (X1 - X0 + 0.4, Y1 - Y0 + 0.4, 0.2), mm["ceil"], 1.2)
    wall_y("s2_confFront", Y0 - 0.1, X0 - 0.2, X1 + 0.2, H, mm["wall"], holes=[(-L["SHAFT_X"], L["SHAFT_X"], 0, 2.6)])
    wall_y("s2_confBack", Y1, X0 - 0.2, X1 + 0.2, H, mm["wall"], holes=[(d1[0], d1[1], 0, 2.2)])
    wall_x("s2_confL", X0 - 0.1, Y0, Y1, H, mm["wall"]); wall_x("s2_confR", X1 + 0.1, Y0, Y1, H, mm["wall"])
    wainscot_y("s2_cwB", Y1 - 0.1, X0, X1, mm["dark"], holes=[(d1[0] - 0.1, d1[1] + 0.1, 0, 2.2)], face=-1)
    wainscot_y("s2_cwF", Y0, X0, X1, mm["dark"], holes=[(-L["SHAFT_X"], L["SHAFT_X"], 0, 2.6)], face=1)
    wainscot_x("s2_cwL", X0, Y0, Y1, mm["dark"], face=1); wainscot_x("s2_cwR", X1, Y0, Y1, mm["dark"], face=-1)
    door_frame_y("s2_door1", Y1, d1[0], d1[1], 2.2, mm["dark"])
    box("s2_shaftLintel", (0, Y0 - 0.1, 2.65), (2 * L["SHAFT_X"] + 0.2, 0.26, 0.1), mm["dark"])
    # wall cone lamps along the back wall (the reference's cones of light on the beige wall)
    for i, x in enumerate((-1.95, -0.55, 0.45)):
        piv, bz = pendant(f"s2_cLamp{i}", (x, Y1 - 0.65, H), cord=0.55, r=0.2)
        spot(f"s2_cSpot{i}", (x, Y1 - 0.6, bz), (x, Y1 - 0.05, 0.4), 450, "#ffd6a0", cone=75, blend=0.45, size=0.06)
    spot("s2_cSpotD", (1.5, Y1 - 0.7, H - 0.05), (1.5, Y1 + 1.0, 0.0), 120, "#ffd6a0", cone=60, blend=0.5)
    light("AREA", "s2_cFill", (0, -1.0, H - 0.1), "#c9b48c", 420, size=4.0, rot=(0, 0, 0), shadow=False)
    light("AREA", "s2_cFront", (-2.2, Y0 + 0.3, 2.7), "#b8a888", 160, size=1.5, target=(0, 1.0, 0.8), shadow=False)
    # set dressing: wall map (left), a bench, a filing cabinet (right front corner), a concrete pillar (placed by the shot)
    mp = sets.plane("s2_map", 1.3, 0.95, sets.image_mat("s2_mapM", tx("s2_map")), (X0 + 0.03, -1.4, 1.75), rot=(90, 0, 90))
    box("s2_mapFrame", (X0 + 0.02, -1.4, 1.75), (0.02, 1.4, 1.05), mm["dark"])
    for k, y in enumerate((-2.4, -0.2)):
        chair(f"s2_cChair{k}", (X0 + 0.35, y, 0), -90, mm)
    cab = box("s2_cabinet", (X1 - 0.35, Y0 + 0.45, 0.65), (0.5, 0.6, 1.3), mat("s2_cabM", "#5c6052", rough=0.6))
    for k in range(3): box(f"s2_cabDr{k}", (X1 - 0.61, Y0 + 0.45, 0.25 + k * 0.4), (0.02, 0.5, 0.3), mat("s2_cabD", "#6a6e5e", rough=0.6))
    return out


def build_dining(mm):
    out = {}; X0, X1, Y0, Y1, H = -2.6, 2.6, L["WALL1"] + 0.1, L["WALL2"], 2.9
    d1, d2, sd = L["DOOR1"], L["DOOR2"], L["SIDE"]
    tb("s2_dinFloor", (0, (Y0 + Y1) / 2, -0.05), (X1 - X0, Y1 - Y0, 0.1), mm["floor2"], 1.6)
    tb("s2_dinCeil", (0, (Y0 + Y1) / 2, H + 0.1), (X1 - X0 + 0.4, Y1 - Y0 + 0.4, 0.2), mm["ceil"], 1.2)
    wall_y("s2_dinBack", Y1 + 0.1, X0 - 0.2, X1 + 0.2, H, mm["wall"], holes=[(d2[0], d2[1], 0, 2.1)])
    wall_x("s2_dinL", X0 - 0.1, Y0 - 0.1, Y1, H, mm["wall"])
    wall_x("s2_dinR", X1 + 0.1, Y0 - 0.1, Y1, H, mm["wall"], holes=[(sd[0], sd[1], 0, 2.1)])
    # the conference back wall is shared; add its dining-side wainscot
    wainscot_y("s2_dwF", Y0, X0, X1, mm["dark"], holes=[(d1[0] - 0.1, d1[1] + 0.1, 0, 2.2)], face=1)
    wainscot_y("s2_dwB", Y1, X0, X1, mm["dark"], holes=[(d2[0] - 0.1, d2[1] + 0.1, 0, 2.1)], face=-1)
    wainscot_x("s2_dwL", X0, Y0, Y1, mm["dark"], face=1)
    wainscot_x("s2_dwR", X1, Y0, Y1, mm["dark"], holes=[(sd[0] - 0.1, sd[1] + 0.1, 0, 2.1)], face=-1)
    door_frame_y("s2_door2", Y1 + 0.1, d2[0], d2[1], 2.1, mm["dark"])
    door_frame_x("s2_door3", X1 + 0.1, sd[0], sd[1], 2.1, mm["dark"])
    # dining-side door leaf of doorway 1, swung open against the wall
    box("s2_leaf1", (d1[1] + 0.06, Y0 + 0.5, 1.08), (0.05, 0.92, 2.14), mm["dark"])
    box("s2_leaf3", (X1 - 0.05, sd[0] - 0.55, 1.04), (0.05, 0.9, 2.06), mm["dark"])
    # unlit passages behind the two dark doorways (pure black, closed boxes)
    blk = mm["black"]
    cx = (d2[0] + d2[1]) / 2
    box("s2_corrF", (cx, Y1 + 2.2, -0.05), (2.0, 4.0, 0.1), blk, ink=False); box("s2_corrC", (cx, Y1 + 2.2, 2.25), (2.0, 4.0, 0.1), blk, ink=False)
    for s in (-1, 1): box(f"s2_corrW{s}", (cx + s * 0.75, Y1 + 2.2, 1.1), (0.1, 4.0, 2.4), blk, ink=False)
    box("s2_corrE", (cx, Y1 + 4.2, 1.1), (1.6, 0.1, 2.4), blk, ink=False)
    box("s2_sideF", (X1 + 1.2, (sd[0] + sd[1]) / 2, -0.05), (2.2, 2.0, 0.1), blk, ink=False)
    box("s2_sideC", (X1 + 1.2, (sd[0] + sd[1]) / 2, 2.25), (2.2, 2.0, 0.1), blk, ink=False)
    for s in (-1, 1): box(f"s2_sideW{s}", (X1 + 1.2, (sd[0] + sd[1]) / 2 + s * 1.0, 1.1), (2.2, 0.1, 2.4), blk, ink=False)
    box("s2_sideE", (X1 + 2.3, (sd[0] + sd[1]) / 2, 1.1), (0.1, 2.0, 2.4), blk, ink=False)
    # sideboard + candlesticks + wall clock + picture on the back-left wall
    sbx = -1.7
    box("s2_sideboard", (sbx, Y1 - 0.25, 0.42), (1.5, 0.46, 0.84), mm["wood"])
    box("s2_sbTop", (sbx, Y1 - 0.26, 0.86), (1.6, 0.52, 0.04), mm["dark"])
    for k in range(3): box(f"s2_sbDoor{k}", (sbx - 0.48 + k * 0.48, Y1 - 0.49, 0.42), (0.42, 0.02, 0.66), mm["dark"])
    box("s2_sbRunner", (sbx, Y1 - 0.26, 0.885), (1.2, 0.3, 0.01), mat("s2_runner", "#c8a860"), ink=False)
    try: sets.asset("brass_candleholders", (sbx + 0.35, Y1 - 0.28, 0.89), height=0.32)
    except Exception as e: print("asset brass_candleholders", e)
    try: sets.asset("mantel_clock_01", (sbx - 0.45, Y1 - 0.28, 0.89), height=0.24)
    except Exception as e: print("asset mantel_clock_01", e)
    add_mesh("cyl", "s2_clockRim", (-0.95, Y1 - 0.03, 2.05), (0.22, 0.22, 0.025), rot=(90, 0, 0), material=mm["dark"], ink=True, vertices=32)
    sets.plane("s2_clockFace", 0.4, 0.4, sets.image_mat("s2_clockM", tx("s2_clock"), alpha=False), (-0.95, Y1 - 0.057, 2.05))
    for k, (x, w, h) in enumerate(((-2.0, 0.7, 0.5), (1.55, 0.8, 0.58))):
        box(f"s2_picFrame{k}", (x, Y1 - 0.02, 1.85), (w + 0.08, 0.03, h + 0.08), mm["dark"])
        sets.plane(f"s2_pic{k}", w, h, sets.image_mat(f"s2_picM{k}", tx("s2_map")), (x, Y1 - 0.037, 1.85))
    # tables + chairs are placed by the shot (they depend on the seated cards)
    for k, (x, y) in enumerate(((-1.35, 3.0), (1.55, 3.0))):
        pass
    # lights: pendant over each table, cone lamps on the back wall, candle glow
    for k, (c, e) in enumerate(((L["C1"], 300), (L["C2"], 260))):
        piv, bz = pendant(f"s2_dLamp{k}", (c[0], c[1], H), cord=0.75, r=0.26)
        spot(f"s2_dSpot{k}", (c[0], c[1], bz), (c[0], c[1], 0), e, "#ffd09a", cone=95, blend=0.6, size=0.08)
    for k, x in enumerate((-2.2, 1.1, 2.2)):
        spot(f"s2_dWall{k}", (x, Y1 - 0.5, H - 0.05), (x, Y1 + 0.2, 0.6), 160, "#ffd6a0", cone=70, blend=0.45, size=0.06)
    point("s2_candle", (sbx + 0.35, Y1 - 0.35, 1.3), 18, "#ffb060", size=0.05, shadow=False)
    light("AREA", "s2_dFill", (0, 4.5, H - 0.1), "#c9b48c", 380, size=4.0, shadow=False)
    light("AREA", "s2_dFront", (0.3, Y0 + 0.3, 2.2), "#b8a888", 200, size=3.0, target=(0, 6.0, 0.8), shadow=False)
    return out


def build_all():
    mm = M(); out = {"mm": mm}
    out.update(build_shaft(mm)); out.update(build_conference(mm)); out.update(build_dining(mm))
    return out
