"""Section 3 sets: the bunker radio room (origin) and the Italian alley + square (far away at IO, reached only
through the newspaper photos = portals).  Z up, the room's back wall is +Y.  python tex_sec3.py first."""
import bpy, math, random
from mathutils import Vector
import lib, sets
from lib import mat, box, add_mesh, rgb, light, emissive

TEX = lib.HERE / "tex"
def T(n): return TEX / f"sec3_{n}.png"

# ------------------------------------------------------------------ room layout
WB, WF, WX, CEIL = 2.0, -2.6, 2.1, 2.7          # back wall inner face y, front wall inner face y, side walls |x|, ceiling
DESK = dict(x0=-0.95, x1=0.95, y0=0.5, y1=1.15, top=0.80)
HIT = (-0.15, 1.35, 0.0)                        # hitler card feet
EXIT = (1.525, 0.75)                            # exit doorway centre x, width (back wall)
NP = (0.55, 2.0)                                # newspaper centre x, z (0.6 x 0.8 m)
PH_W, PH_H = 0.225, 0.4                         # photo = 9:16, same as the frame
P1 = (NP[0] - 0.141, WB - 0.006, NP[1] - 0.072) # photo 1 (alley + duce) centre
P2 = (NP[0] + 0.141, WB - 0.006, NP[1] - 0.072) # photo 2 (the square) centre
LAMP = (-0.75, 0.8)                             # lamp pivot x, y (at the ceiling)
PISTOL = (0.42, 0.80)
RADIO = (-0.32, 0.86)
IO = Vector((100.0, 0.0, 0.0))                  # Italy origin

# italy layout (relative to IO)
ALLEY_W, ALLEY_END = 1.2, 4.5                   # alley half-width, alley mouth y
DUCE = (0.0, 1.0, 0.0)
CANOPY = dict(x0=-5.0, x1=5.0, y0=4.9, y1=8.9, z=4.45)


def uv_world(o, uu, vv, ox=0.0, oy=0.0):
    """world-size UVs: 1 texture repeat per uu metres across, vv metres up (walls), uu x uu on floors."""
    me = o.data
    if not me.uv_layers: me.uv_layers.new()
    uv = me.uv_layers.active.data; mw = o.matrix_world
    for poly in me.polygons:
        n = poly.normal; ax = max(range(3), key=lambda i: abs(n[i]))
        for li in poly.loop_indices:
            v = mw @ me.vertices[me.loops[li].vertex_index].co
            if ax == 0: a, b = (v.y - oy) / uu * (1 if n[0] > 0 else -1), v.z / vv
            elif ax == 1: a, b = (v.x - ox) / uu * (-1 if n[1] > 0 else 1), v.z / vv
            else: a, b = v.x / uu, v.y / uu
            uv[li].uv = (a, b)


def void_mat():
    return emissive("sec3_void", "#000000", 0.0)


def place_on(o, z):
    bpy.context.view_layer.update()
    zs = [(o.matrix_world @ Vector(c)).z for c in o.bound_box]
    o.location.z += z - min(zs)


# =================================================================== ROOM
def build_room():
    out = {}
    conc = mat("sec3_conc", "#d8d4cc", T("concrete"))
    floor_m = mat("sec3_floorM", "#ffffff", T("floor"))
    void = void_mat()
    fl = box("r_floor", (0, -0.3, -0.05), (2 * WX + 0.4, WB - WF + 0.8, 0.1), floor_m, ink=False); sets.tiled(fl, 2.4)
    ce = box("r_ceil", (0, -0.3, CEIL + 0.06), (2 * WX + 0.4, WB - WF + 0.8, 0.12), mat("sec3_ceilM", "#a9a59e", T("concrete")), ink=False); sets.tiled(ce, 2.4)
    for sx in (-1, 1):
        o = box(f"r_side{sx}", (sx * (WX + 0.1), -0.3, CEIL / 2), (0.2, WB - WF + 0.8, CEIL + 0.2), conc, ink=False); sets.tiled(o, 2.0)
    # back wall with the exit doorway (x EXIT +- w/2, h 2.05)
    ex0, ex1, eh = EXIT[0] - EXIT[1] / 2, EXIT[0] + EXIT[1] / 2, 2.05
    for nm, x0, x1, z0, z1 in (("bwL", -WX - 0.2, ex0, 0, CEIL), ("bwR", ex1, WX + 0.2, 0, CEIL), ("bwT", ex0, ex1, eh, CEIL)):
        o = box(f"r_{nm}", ((x0 + x1) / 2, WB + 0.1, (z0 + z1) / 2), (x1 - x0, 0.2, z1 - z0), conc, ink=False); sets.tiled(o, 2.0)
    # exit passage: unlit black void (x ex0-0.15 .. ex1+0.15, y WB+0.2 .. WB+3)
    px0, px1 = ex0 - 0.15, ex1 + 0.15
    for nm, c, s in (("xpL", (px0 - 0.05, WB + 1.6, 1.2), (0.1, 2.9, 2.6)), ("xpR", (px1 + 0.05, WB + 1.6, 1.2), (0.1, 2.9, 2.6)),
                     ("xpE", ((px0 + px1) / 2, WB + 3.05, 1.2), (px1 - px0 + 0.2, 0.1, 2.6)), ("xpF", ((px0 + px1) / 2, WB + 1.6, -0.048), (px1 - px0 + 0.2, 2.9, 0.1)),
                     ("xpC", ((px0 + px1) / 2, WB + 1.6, 2.45), (px1 - px0 + 0.2, 2.9, 0.1))):
        box(f"r_{nm}", c, s, void, ink=False)
    jm = mat("sec3_jamb", "#5b5f58")
    box("r_xjL", (ex0 - 0.04, WB - 0.03, eh / 2), (0.08, 0.08, eh + 0.04), jm); box("r_xjR", (ex1 + 0.04, WB - 0.03, eh / 2), (0.08, 0.08, eh + 0.04), jm)
    box("r_xjT", (EXIT[0], WB - 0.03, eh + 0.04), (EXIT[1] + 0.16, 0.08, 0.08), jm)
    # front wall with the entry doorway (x +-0.5, h 2.0) + entry passage (void) + gas curtain
    for nm, x0, x1, z0, z1 in (("fwL", -WX - 0.2, -0.5, 0, CEIL), ("fwR", 0.5, WX + 0.2, 0, CEIL), ("fwT", -0.5, 0.5, 2.0, CEIL)):
        o = box(f"r_{nm}", ((x0 + x1) / 2, WF - 0.1, (z0 + z1) / 2), (x1 - x0, 0.2, z1 - z0), conc, ink=False); sets.tiled(o, 2.0)
    for nm, c, s in (("epL", (-0.75, WF - 1.4, 1.2), (0.1, 2.6, 2.6)), ("epR", (0.75, WF - 1.4, 1.2), (0.1, 2.6, 2.6)),
                     ("epE", (0, WF - 2.75, 1.2), (1.6, 0.1, 2.6)), ("epF", (0, WF - 1.4, -0.048), (1.6, 2.6, 0.1)), ("epC", (0, WF - 1.4, 2.45), (1.6, 2.6, 0.1))):
        box(f"r_{nm}", c, s, void, ink=False)
    box("r_ejL", (-0.54, WF + 0.03, 1.0), (0.08, 0.08, 2.04), jm); box("r_ejR", (0.54, WF + 0.03, 1.0), (0.08, 0.08, 2.04), jm)
    box("r_ejT", (0, WF + 0.03, 2.04), (1.16, 0.08, 0.08), jm)
    add_mesh("cyl", "r_rail", (0, WF + 0.12, 2.12), (0.012, 0.012, 1.0), rot=(0, 90, 0), material=mat("sec3_steel", "#4a4c4a", rough=0.5), vertices=12)
    out["curtain"] = [curtain_half("r_curtL", -1), curtain_half("r_curtR", 1)]
    # skirting + a conduit pipe along the ceiling
    for sx in (-1, 1):
        box(f"r_skirt{sx}", (sx * (WX - 0.02), -0.3, 0.06), (0.04, WB - WF, 0.12), mat("sec3_skirt", "#4a4c48"), ink=False)
    add_mesh("cyl", "r_pipe", (-1.2, -0.3, CEIL - 0.12), (0.05, 0.05, (WB - WF) / 2), rot=(90, 0, 0), material=mat("sec3_pipe", "#6b6f62", rough=0.6), vertices=16)
    add_mesh("cyl", "r_pipe2", (1.85, -0.3, CEIL - 0.1), (0.035, 0.035, (WB - WF) / 2), rot=(90, 0, 0), material=mat("sec3_pipe2", "#7a5a3a", rough=0.6), vertices=12)

    # ---- desk
    wood = mat("sec3_woodM", "#b08872", T("wood"))
    D = DESK
    top = box("r_desktop", ((D["x0"] + D["x1"]) / 2, (D["y0"] + D["y1"]) / 2, D["top"] - 0.025), (D["x1"] - D["x0"], D["y1"] - D["y0"], 0.05), wood); sets.tiled(top, 1.0)
    for sx in (D["x0"] + 0.05, D["x1"] - 0.05):
        for sy in (D["y0"] + 0.05, D["y1"] - 0.05):
            box("r_leg", (sx, sy, (D["top"] - 0.05) / 2), (0.06, 0.06, D["top"] - 0.05), wood)
    o = box("r_modesty", ((D["x0"] + D["x1"]) / 2, D["y0"] + 0.03, 0.5), (D["x1"] - D["x0"] - 0.1, 0.03, 0.5), wood); sets.tiled(o, 1.0)
    dr = box("r_drawers", (D["x1"] - 0.25, (D["y0"] + D["y1"]) / 2, 0.47), (0.4, D["y1"] - D["y0"] - 0.06, 0.56), wood); sets.tiled(dr, 1.0)
    for k in range(3):
        z = 0.30 + k * 0.17
        box("r_drawerF", (D["x1"] - 0.25, D["y0"] - 0.0, z), (0.36, 0.02, 0.14), mat("sec3_drawerF", "#6a3f26"))
        add_mesh("sphere", "r_knob", (D["x1"] - 0.25, D["y0"] - 0.02, z), (0.015,) * 3, material=mat("sec3_brass", "#b08a3a", rough=0.4), ink=False, segments=10, ring_count=6)
    # ---- radio set (CC0 Poly Haven vintage_radio_transceiver), cable to the wall
    rad = sets.asset("vintage_radio_transceiver", (RADIO[0], RADIO[1], D["top"]), yaw=8, height=0.4, ink=False)
    lib.toonify([rad], width=0.006); place_on(rad, D["top"]); out["radio"] = rad
    cable("r_cable", [(RADIO[0] - 0.28, RADIO[1] + 0.12, D["top"] + 0.03), (D["x0"] + 0.06, RADIO[1] + 0.2, D["top"] + 0.012), (D["x0"] - 0.04, D["y1"] - 0.08, D["top"] - 0.05),
                      (D["x0"] - 0.08, D["y1"] - 0.02, 0.35), (D["x0"] - 0.06, D["y1"] + 0.15, 0.012), (D["x0"] - 0.1, WB - 0.25, 0.012), (D["x0"] - 0.12, WB - 0.03, 0.3),
                      (D["x0"] - 0.12, WB - 0.03, 0.62)], 0.011)
    box("r_jbox", (D["x0"] - 0.12, WB - 0.04, 0.7), (0.14, 0.06, 0.18), mat("sec3_jboxM", "#55604c"))
    # ---- the gold pistol (our own build), lying flat, muzzle toward the right wall
    out["pistol"] = pistol("r_pistol", (PISTOL[0], PISTOL[1], D["top"]))
    # ---- a plain wooden chair pushed back beside him (seat 0.46)
    chair("r_chair", (0.55, 1.66, 0.0), yaw=20)
    # ---- crates in the left corner, a helmet-free shelf of files
    sets.asset("wooden_military_crate", (-1.45, 1.62, 0), yaw=0, height=0.46)
    c2 = sets.asset("wooden_military_crate", (-1.5, 1.6, 0.46), yaw=-6, height=0.46); place_on(c2, 0.46 + 0.002)
    sets.asset("wooden_military_crate", (-1.75, -1.6, 0), yaw=90, height=0.46)
    # ---- wall papers: the map, notes, the newspaper (+ photo portals added by the shot)
    papers(out)
    # ---- the hanging lamp on a pivot (swings when the room shakes)
    piv = bpy.data.objects.new("r_lampPivot", None); bpy.context.scene.collection.objects.link(piv); piv.location = (LAMP[0], LAMP[1], CEIL)
    lamp = sets.asset("hanging_industrial_lamp", (0, 0, 0), height=0.85, ink=False); lib.toonify([lamp], width=0.006)
    lamp.parent = piv; lamp.location = (0, 0, -0.85)
    box("r_lampRose", (LAMP[0], LAMP[1], CEIL - 0.02), (0.12, 0.12, 0.04), mat("sec3_steel", "#4a4c4a"))
    bulb = add_mesh("sphere", "r_bulb", (0, 0, 0), (0.05,) * 3, material=emissive("sec3_bulbM", "#ffe2a8", 6.0), ink=False, segments=12, ring_count=8)
    bulb.parent = piv; bulb.location = (0, 0, -0.80)
    out["lamp_pivot"] = piv
    return out


def curtain_half(name, side, w=0.64, h=2.0, folds=7):
    """a folded canvas gas curtain half; origin at its outer edge (x = side*0.62), mesh runs toward the centre."""
    n = folds * 6; verts, faces = [], []
    for i in range(n + 1):
        t = i / n; x = -side * t * w; y = 0.035 * math.sin(t * folds * 2 * math.pi)
        verts += [(x, y, 0.0), (x, y, h)]
    for i in range(n): faces.append((2 * i, 2 * i + 2, 2 * i + 3, 2 * i + 1))
    me = bpy.data.meshes.new(name); me.from_pydata(verts, [], faces); me.update()
    for p in me.polygons: p.use_smooth = True
    o = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(o)
    o.location = (side * 0.62, WF + (0.14 if side > 0 else 0.1), 0.0)
    m = bpy.data.materials.get("sec3_curtM")
    if m is None:
        m = bpy.data.materials.new("sec3_curtM"); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
        outn = nt.nodes.new("ShaderNodeOutputMaterial"); p = nt.nodes.new("ShaderNodeBsdfPrincipled")
        p.inputs["Base Color"].default_value = rgb("#4c4a3a"); p.inputs["Roughness"].default_value = 1.0; lib._set_in(p, "Specular IOR Level", 0.0)
        blk = nt.nodes.new("ShaderNodeEmission"); blk.inputs[0].default_value = (0, 0, 0, 1)
        geo = nt.nodes.new("ShaderNodeNewGeometry"); mx = nt.nodes.new("ShaderNodeMixShader")
        # the passage side (back faces seen from the passage) is pure black
        nt.links.new(geo.outputs["Backfacing"], mx.inputs[0]); nt.links.new(p.outputs[0], mx.inputs[1]); nt.links.new(blk.outputs[0], mx.inputs[2])
        nt.links.new(mx.outputs[0], outn.inputs["Surface"])
    me.materials.append(m)
    o["no_ink"] = True
    return o


def cable(name, pts, r=0.01, col="#2c3328"):
    cu = bpy.data.curves.new(name, "CURVE"); cu.dimensions = "3D"; cu.bevel_depth = r; cu.bevel_resolution = 3
    sp = cu.splines.new("BEZIER"); sp.bezier_points.add(len(pts) - 1)
    for bp, p in zip(sp.bezier_points, pts):
        bp.co = p; bp.handle_left_type = bp.handle_right_type = "AUTO"
    o = bpy.data.objects.new(name, cu); bpy.context.scene.collection.objects.link(o)
    cu.materials.append(mat(name + "M", col, rough=0.6))
    return o


def pistol(name, loc):
    """stylised engraved gold pocket pistol (~0.2 m) lying flat on its side; muzzle +x, grip toward -y. Our own build."""
    root = bpy.data.objects.new(name, None); bpy.context.scene.collection.objects.link(root)
    gold = mat("sec3_gold", "#ffd870", T("engrave"), rough=0.3, emit=0.25, emit_col="#9a6a10")
    try:
        p = next(n for n in gold.node_tree.nodes if n.type == "BSDF_PRINCIPLED"); p.inputs["Metallic"].default_value = 0.35
    except Exception: pass
    ivory = mat("sec3_ivory", "#efe4c8", rough=0.5)
    dark = mat("sec3_gunDark", "#2a2016", rough=0.5)
    T_ = 0.024
    objs = [box(name + "_slide", (0.02, 0.0, T_ / 2), (0.16, 0.032, T_), gold),
            box(name + "_frame", (0.005, -0.02, T_ * 0.45), (0.12, 0.016, T_ * 0.9), gold),
            box(name + "_grip", (-0.042, -0.06, T_ * 0.47), (0.042, 0.09, T_ * 0.94), gold, rot=(0, 0, -12)),
            box(name + "_panel", (-0.042, -0.064, T_ * 0.94 + 0.0008), (0.03, 0.068, 0.0016), ivory, rot=(0, 0, -12), ink=False),
            box(name + "_hammer", (-0.064, 0.004, T_ / 2), (0.012, 0.014, T_ * 0.6), gold),
            box(name + "_trigger", (0.012, -0.034, T_ / 2), (0.005, 0.014, T_ * 0.4), gold, ink=False)]
    bpy.ops.mesh.primitive_torus_add(major_radius=0.015, minor_radius=0.0032, location=(0.014, -0.036, T_ / 2), major_segments=24, minor_segments=8)
    tg = bpy.context.active_object; tg.name = name + "_guard"; tg.data.materials.append(gold); bpy.ops.object.shade_smooth(); objs.append(tg)
    mz = add_mesh("cyl", name + "_muzzle", (0.1005, 0.0, T_ / 2), (0.0055, 0.0055, 0.002), rot=(0, 90, 0), material=dark, ink=False, vertices=16); objs.append(mz)
    for k in range(7):
        objs.append(box(name + f"_ser{k}", (-0.05 + k * 0.006, 0, T_ + 0.0004), (0.0018, 0.03, 0.001), dark, ink=False))   # slide serrations
    for o in objs:
        o.parent = root
        for m in o.modifiers:
            if m.name == "ink": m.thickness = 0.002
    lib.outline(tg, 0.002)
    root.location = loc; root.rotation_euler.z = math.radians(10)
    return root


def chair(name, loc, yaw=0, seat=0.46):
    root = bpy.data.objects.new(name, None); bpy.context.scene.collection.objects.link(root)
    w = mat("sec3_chairW", "#7a4a2c", T("wood"))
    objs = [box(name + "_seat", (0, 0, seat - 0.02), (0.44, 0.42, 0.04), w)]
    for sx in (-0.19, 0.19):
        for sy in (-0.18, 0.18):
            h = seat - 0.04 if sy < 0 else 0.98
            objs.append(box(name + "_leg", (sx, sy, h / 2), (0.04, 0.04, h), w))
    objs += [box(name + "_back", (0, 0.18, 0.82), (0.42, 0.03, 0.2), w), box(name + "_rung", (0, 0.18, 0.62), (0.38, 0.025, 0.05), w)]
    for o in objs: o.parent = root
    root.location = loc; root.rotation_euler.z = math.radians(yaw)
    return root


def papers(out):
    z = WB - 0.004
    sets.plane("r_map", 0.92, 0.72, sets.image_mat("sec3_mapM", T("map")), (-1.05, z, 1.75))
    spots = [(-1.75, 2.25, 0.21, 0.28, 0, 4), (-0.45, 2.3, 0.21, 0.28, 1, -3), (-0.2, 1.62, 0.21, 0.28, 2, 5), (-1.62, 1.12, 0.21, 0.28, 3, -6),
             (-0.62, 1.15, 0.18, 0.24, 1, 3), (-1.3, 2.35, 0.18, 0.24, 2, -2), (0.06, 2.3, 0.18, 0.24, 0, 6)]
    pin = mat("sec3_pin", "#c2282c", rough=0.4)
    for i, (x, zz, w, h, t, rot) in enumerate(spots):
        sets.plane(f"r_paper{i}", w, h, sets.image_mat(f"sec3_paperM{t}", T(f"paper{t}")), (x, z - 0.001 * (i % 3), zz), rot=(90, rot, 0))
        add_mesh("sphere", f"r_pin{i}", (x, z - 0.012, zz + h / 2 - 0.025), (0.011,) * 3, material=pin, ink=False, segments=10, ring_count=6)
    for x, zz in ((-1.45, 2.08), (-0.65, 2.08), (-1.45, 1.42), (-0.65, 1.42)):
        add_mesh("sphere", "r_mpin", (x, z - 0.012, zz), (0.012,) * 3, material=pin, ink=False, segments=10, ring_count=6)
    # side-wall notes
    for i, (y, zz) in enumerate(((0.2, 1.7), (-0.4, 1.55), (0.9, 1.9))):
        sets.plane(f"r_spaper{i}", 0.21, 0.28, sets.image_mat(f"sec3_paperM{i}", T(f"paper{i}")), (-WX + 0.004, y, zz), rot=(90, 0, 90))
    # newspaper (its photo windows are covered by the photo portal planes)
    sets.plane("r_news", 0.6, 0.8, sets.image_mat("sec3_newsM", T("newspaper")), (NP[0], WB - 0.003, NP[1]))
    for x, zz in ((NP[0] - 0.27, NP[1] + 0.37), (NP[0] + 0.27, NP[1] + 0.37), (NP[0] - 0.27, NP[1] - 0.37), (NP[0] + 0.27, NP[1] - 0.37)):
        add_mesh("sphere", "r_npin", (x, WB - 0.014, zz), (0.012,) * 3, material=pin, ink=False, segments=10, ring_count=6)


def photo_plane(name, center, img_path_holder):
    """the portal photo: emission-only (exactly the still's pixels at strength 1) with a sepia/dim mix whose factor
    the shot keys from the camera distance (0 = true colour when the frame is filled)."""
    m = bpy.data.materials.new(name + "M"); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
    outn = nt.nodes.new("ShaderNodeOutputMaterial"); ti = nt.nodes.new("ShaderNodeTexImage"); ti.interpolation = "Linear"
    ti.extension = "EXTEND"
    bw = nt.nodes.new("ShaderNodeRGBToBW"); sep = nt.nodes.new("ShaderNodeMix"); sep.data_type = "RGBA"; sep.blend_type = "MULTIPLY"
    sep.inputs[0].default_value = 1.0; sep.inputs[7].default_value = rgb("#d9b98a")
    nt.links.new(ti.outputs[0], bw.inputs[0]); nt.links.new(bw.outputs[0], sep.inputs[6])
    k = nt.nodes.new("ShaderNodeValue"); k.name = "sepiaK"; k.outputs[0].default_value = 0.0
    mx = nt.nodes.new("ShaderNodeMix"); mx.data_type = "RGBA"
    nt.links.new(k.outputs[0], mx.inputs[0]); nt.links.new(ti.outputs[0], mx.inputs[6]); nt.links.new(sep.outputs[2], mx.inputs[7])
    dim = nt.nodes.new("ShaderNodeMath"); dim.operation = "MULTIPLY_ADD"; dim.inputs[1].default_value = -0.3; dim.inputs[2].default_value = 1.0
    nt.links.new(k.outputs[0], dim.inputs[0])
    em = nt.nodes.new("ShaderNodeEmission"); nt.links.new(mx.outputs[2], em.inputs[0]); nt.links.new(dim.outputs[0], em.inputs[1])
    nt.links.new(em.outputs[0], outn.inputs["Surface"])
    o = sets.plane(name, PH_W, PH_H, m, center)
    o["no_ink"] = True
    img_path_holder[name] = (ti, k)
    return o


# =================================================================== ITALY
def build_italy():
    out = {}
    I = IO
    rnd = random.Random(31)
    cob = mat("sec3_cobM", "#ffffff", T("cobbles"))
    g = box("i_ground", (I.x, I.y + 6, I.z - 0.05), (60, 60, 0.1), cob, ink=False); sets.tiled(g, 2.0)
    facs = [mat(f"sec3_fac_{n}", "#ffffff", T(f"facade_{n}")) for n in ("ochre", "terra", "cream", "rose")]
    def block(nm, x0, x1, y0, y1, h, fi):
        o = box(nm, (I.x + (x0 + x1) / 2, I.y + (y0 + y1) / 2, h / 2), (x1 - x0, y1 - y0, h), facs[fi % 4], ink=False)
        uv_world(o, 6.0, h, ox=I.x, oy=I.y); return o
    # alley sides: 6 m segments of different houses
    k = 0
    for side in (-1, 1):
        y = -14.0
        while y < ALLEY_END - 0.01:
            y1 = min(ALLEY_END, y + 6.0); h = rnd.choice((9.5, 10.5, 11.0, 12.0))
            x0, x1 = (-16, -ALLEY_W) if side < 0 else (ALLEY_W, 16)
            block(f"i_alley{side}_{k}", x0, x1, y, y1, h, k + (side > 0)); y = y1; k += 1
    # square enclosure (y ALLEY_END .. 22, x +-14)
    for i, x in enumerate(range(-20, 20, 6)):
        block(f"i_back{i}", x, x + 6, 22, 28, rnd.choice((9.0, 10.0, 11.5)), i + 2)
    for side in (-1, 1):
        for i, y in enumerate(range(int(ALLEY_END), 22, 6)):
            x0, x1 = (-20, -14) if side < 0 else (14, 20)
            block(f"i_sq{side}_{i}", x0, x1, y, min(22, y + 6), rnd.choice((9.0, 10.5, 12.0)), i + 1 + (side > 0))
    # sky dome (dusk), emission only
    sky = add_mesh("sphere", "i_sky", (I.x, I.y + 6, 0), (70, 70, 70), material=None, ink=False, segments=48, ring_count=24)
    sm = bpy.data.materials.new("sec3_skyM"); sm.use_nodes = True; nt = sm.node_tree; nt.nodes.clear()
    o_ = nt.nodes.new("ShaderNodeOutputMaterial"); ti = nt.nodes.new("ShaderNodeTexImage"); ti.image = bpy.data.images.load(str(T("sky")), check_existing=True)
    em = nt.nodes.new("ShaderNodeEmission"); em.inputs[1].default_value = 1.0
    nt.links.new(ti.outputs[0], em.inputs[0]); nt.links.new(em.outputs[0], o_.inputs["Surface"])
    sky.data.materials.append(sm); sky.visible_shadow = False; sky["no_ground"] = True
    try: sky.visible_diffuse = False
    except Exception: pass
    # overhead wires + a laundry line across the alley
    wm = mat("sec3_wire", "#1c1a20")
    for i, (y, z) in enumerate(((-1.5, 5.6), (0.4, 6.2), (2.2, 5.3), (-3.5, 6.6))):
        cable(f"i_wire{i}", [(I.x - ALLEY_W, y, z), (I.x, y + 0.2, z - 0.45), (I.x + ALLEY_W, y + 0.4, z)], 0.012, "#1c1a20")
    cable("i_line", [(I.x - ALLEY_W, -0.6, 4.3), (I.x, -0.6, 4.0), (I.x + ALLEY_W, -0.6, 4.3)], 0.006, "#ece6da")
    for i, (x, w, h, c) in enumerate(((-0.95, 0.42, 0.55, "#c94a3a"), (-0.35, 0.36, 0.7, "#f1ece0"), (0.25, 0.5, 0.45, "#3f6aa8"), (0.85, 0.34, 0.6, "#e0b840"))):
        zt = 4.0 + 0.3 * (abs(x) / ALLEY_W) ** 2 * 1.0
        o = sets.plane(f"i_cloth{i}", w, h, mat(f"sec3_cloth{i}", c), (I.x + x, -0.6, zt - h / 2 - 0.01), ink=True)
    # props: wall lanterns, barrels, crates, a drain
    for i, (x, y, yaw) in enumerate(((-ALLEY_W, -1.0, -90), (ALLEY_W, 2.0, 90))):
        sets.asset("street_lamp_02", (I.x + x * 0.98, I.y + y, 2.4), yaw=yaw, height=1.0)
        light("POINT", f"i_lantern{i}", (I.x + x * 0.8, I.y + y, 3.0), "#ffb060", 60, size=0.1)
    sets.asset("Barrel_01", (I.x - 0.8, I.y - 0.4, 0), height=0.88)
    sets.asset("wooden_crate_01", (I.x + 0.8, I.y - 1.2, 0), yaw=12, height=0.5)
    sets.asset("wooden_crate_01", (I.x + 0.8, I.y + 2.6, 0), yaw=-8, height=0.45)
    # the gas-station canopy at the square (steel roof on girders) + two pumps -- empty
    C = CANOPY; steel = mat("sec3_canopySteel", "#8a8f94", rough=0.6); fascia = mat("sec3_fascia", "#e9e2cf")
    box("i_canRoof", (I.x + (C["x0"] + C["x1"]) / 2, I.y + (C["y0"] + C["y1"]) / 2, C["z"] + 0.15), (C["x1"] - C["x0"], C["y1"] - C["y0"], 0.3), steel)
    box("i_canFascia", (I.x, I.y + C["y1"], C["z"] + 0.12), (C["x1"] - C["x0"] + 0.1, 0.12, 0.5), fascia)
    box("i_canStripe", (I.x, I.y + C["y1"] + 0.065, C["z"] + 0.05), (C["x1"] - C["x0"] + 0.1, 0.01, 0.1), mat("sec3_stripe", "#b8322c"), ink=False)
    for yy in (C["y0"] + 0.1, C["y0"] + 1.0, C["y0"] + 2.0, C["y0"] + 3.0, C["y1"] - 0.2):
        box("i_girderX", (I.x, I.y + yy, C["z"] - 0.12), (C["x1"] - C["x0"], 0.12, 0.24), steel)
    for xx in (C["x0"] + 0.3, -2.5, 2.5, C["x1"] - 0.3):
        box("i_girderY", (I.x + xx, I.y + (C["y0"] + C["y1"]) / 2, C["z"] - 0.18), (0.1, C["y1"] - C["y0"], 0.12), steel)
        for j in range(8):                                          # lattice diagonals
            y0 = C["y0"] + j * 0.5
            o = box("i_lat", (I.x + xx, I.y + y0 + 0.25, C["z"] - 0.22), (0.03, 0.55, 0.03), steel, ink=False); o.rotation_euler.x = math.radians(18 if j % 2 else -18)
    for xx in (C["x0"] + 0.4, C["x1"] - 0.4):
        box("i_canCol", (I.x + xx, I.y + C["y1"] - 0.5, C["z"] / 2), (0.22, 0.22, C["z"]), steel)
    for xx in (-2.0, 2.0):
        box("i_pump", (I.x + xx, I.y + C["y1"] - 1.0, 0.75), (0.45, 0.35, 1.5), mat("sec3_pumpM", "#b73a30"))
        add_mesh("sphere", "i_globe", (I.x + xx, I.y + C["y1"] - 1.0, 1.66), (0.17,) * 3, material=emissive("sec3_globeM", "#fff1d0", 1.5), segments=16, ring_count=10)
        box("i_pumpFace", (I.x + xx, I.y + C["y1"] - 1.18, 1.1), (0.3, 0.01, 0.3), mat("sec3_pumpFace", "#f4ecd8"), ink=False)
    out["canopy"] = C
    return out


def italy_lights():
    """dusk: low warm sun from beyond the square (behind the crowd) + violet sky fill. Keyed on only in Italy frames."""
    sun = light("SUN", "i_sun", (IO.x, IO.y + 20, 10), "#ffb27a", 3.2, size=0.4, target=(IO.x, IO.y - 2, 0.0))
    fill = light("AREA", "i_fill", (IO.x, IO.y - 4, 12), "#9a88ff", 3000, size=20, target=(IO.x, IO.y + 6, 0))
    fill2 = light("AREA", "i_fill2", (IO.x, IO.y + 1, 3.5), "#ffcf9a", 250, size=2.5, target=(IO.x, IO.y + 1.0, 1.2))
    under = light("POINT", "i_under", (IO.x, IO.y + CANOPY["y1"] - 1.2, 2.2), "#ffd9a8", 400, size=0.5)
    return [sun, fill, fill2, under]


def room_lights(lamp_pivot):
    bulb = light("POINT", "r_lamp", (0, 0, 0), "#ffcf8a", 70, size=0.06)
    bulb.parent = lamp_pivot; bulb.location = (0, 0, -0.82)
    fill = light("AREA", "r_fill", (0.2, -1.8, 2.5), "#b9c3d6", 140, size=2.2, target=(0, 1.5, 1.0))
    wash = light("AREA", "r_wash", (-0.2, 0.7, 2.55), "#ffe0b0", 60, size=1.6, target=(-0.4, WB, 1.6))
    desk = light("POINT", "r_deskglow", (0.3, 0.3, 1.3), "#ffd8a0", 15, size=0.3)
    return [bulb, fill, wash, desk]
