"""Section 4 sets: the farewell HALLWAY (red runner, wood wainscot, sconces, sideboard, oval frames), the grey concrete
CORRIDOR (checkered floor, ceiling lamps, heavy steel door at its end) and the dark STUDY behind that door (grey
tiles, spotlights, a sleeping German shepherd built here). All one connected space for the one-take camera.

Layout (Z up, metres). One long passage along +X:
  entrance passage (black)  x[-3.25,-2.15]  y[-4.6,-3.2]   -> double doors at y = -3.0 open into the hallway
  hallway                   x[-4.6,-1.2]    y[-3.0, 1.6]   (back wall y = 1.6, the staff line stands at y = 1.05)
  corridor                  x[-1.2, 0.4]    y[ 0.25,1.6]
  end wall + steel door     x[ 0.4, 0.6]    door opening y[0.45,1.45] z[0,2.1], hinge at y = 1.45 (swings into +X)
  study                     x[ 0.6, 4.6]    y[-1.6, 3.2]
"""
import bpy, math
from mathutils import Vector
import lib, sets
from lib import mat, box, add_mesh, rgb, light, emissive

TEX = lib.HERE / "tex"
def tex(n): return TEX / f"{n}.png"

HALL = dict(x0=-4.6, x1=-1.2, y0=-3.0, y1=1.6, h=2.7)
COR = dict(x0=-1.2, x1=0.4, y0=0.25, y1=1.6, h=2.6)
DOOR = dict(x=0.4, t=0.2, y0=0.45, y1=1.45, h=2.1)
STUDY = dict(x0=0.6, x1=4.6, y0=-1.6, y1=3.2, h=3.0)
ENT = dict(x0=-3.25, x1=-2.15, y=-3.0, h=2.2)


def tbox(name, c, s, m, unit=1.0, ink=False):
    o = box(name, c, s, m, ink=ink); sets.tiled(o, unit); return o


def black():
    m = bpy.data.materials.get("s4_black")
    if m: return m
    return mat("s4_black", "#000000", rough=1.0)


def keyv(sock, f, v):
    sock.default_value = v; sock.keyframe_insert("default_value", frame=f)


def emit_mat(name, col, strength):
    """emission material whose strength input can be keyed (returns mat, strength socket)."""
    m = emissive(name, col, strength)
    e = next(n for n in m.node_tree.nodes if n.type == "EMISSION")
    return m, e.inputs[1]


# ------------------------------------------------------------------ hallway
def build_hall():
    H = HALL; out = {}
    plast = mat("s4_plasterM", "#ffffff", tex("s4_plaster"))
    panel = mat("s4_panelM", "#ffffff", tex("s4_panels"))
    floor = mat("s4_floorM", "#ffffff", tex("s4_floor"))
    tbox("h_floor", ((H["x0"] + H["x1"]) / 2, (H["y0"] + H["y1"]) / 2, -0.05), (H["x1"] - H["x0"] + 0.4, H["y1"] - H["y0"] + 0.4, 0.1), floor, 1.6)
    tbox("h_ceil", ((H["x0"] + H["x1"]) / 2, (H["y0"] + H["y1"]) / 2, H["h"] + 0.05), (H["x1"] - H["x0"] + 0.4, H["y1"] - H["y0"] + 0.4, 0.1), mat("s4_ceilM", "#8c8578", tex("s4_plaster")), 2.0)
    WZ = 1.1
    def wall(name, c, s, normal_axis, sign):
        """plaster wall + wood wainscot strip on its room face."""
        tbox(name, c, s, plast, 1.5)
        cx, cy, cz = c; sx, sy, sz = s
        if normal_axis == "y":
            tbox(name + "_w", (cx, cy + sign * (sy / 2 + 0.015), WZ / 2), (sx, 0.03, WZ), panel, 1.0)
            box(name + "_rail", (cx, cy + sign * (sy / 2 + 0.04), WZ + 0.02), (sx, 0.06, 0.07), mat("s4_railM", "#4a2a16"))
            box(name + "_skirt", (cx, cy + sign * (sy / 2 + 0.035), 0.06), (sx, 0.05, 0.12), mat("s4_railM", "#4a2a16"))
        else:
            tbox(name + "_w", (cx + sign * (sx / 2 + 0.015), cy, WZ / 2), (0.03, sy, WZ), panel, 1.0)
            box(name + "_rail", (cx + sign * (sx / 2 + 0.04), cy, WZ + 0.02), (0.06, sy, 0.07), mat("s4_railM", "#4a2a16"))
            box(name + "_skirt", (cx + sign * (sx / 2 + 0.035), cy, 0.06), (0.05, sy, 0.12), mat("s4_railM", "#4a2a16"))
    T = 0.2
    # back wall (hallway part), left wall
    wall("h_back", ((H["x0"] + H["x1"]) / 2, H["y1"] + T / 2, H["h"] / 2), (H["x1"] - H["x0"], T, H["h"]), "y", -1)
    wall("h_left", (H["x0"] - T / 2, (H["y0"] + H["y1"]) / 2, H["h"] / 2), (T, H["y1"] - H["y0"], H["h"]), "x", 1)
    # right wall (ends where the corridor's front wall begins)
    wall("h_right", (H["x1"] + T / 2, (H["y0"] + COR["y0"]) / 2, H["h"] / 2), (T, COR["y0"] - H["y0"], H["h"]), "x", -1)
    # header over the corridor mouth (corridor ceiling is lower)
    tbox("h_mouth_top", (H["x1"] + T / 2, (COR["y0"] + COR["y1"]) / 2, (COR["h"] + H["h"]) / 2 + 0.05), (T, COR["y1"] - COR["y0"], H["h"] - COR["h"] + 0.1), plast, 1.5)
    # front wall with the entrance doorway
    E = ENT; fy = H["y0"] - T / 2
    wall("h_frontL", ((H["x0"] + E["x0"]) / 2, fy, H["h"] / 2), (E["x0"] - H["x0"], T, H["h"]), "y", 1)
    wall("h_frontR", ((E["x1"] + H["x1"]) / 2, fy, H["h"] / 2), (H["x1"] - E["x1"], T, H["h"]), "y", 1)
    tbox("h_frontT", ((E["x0"] + E["x1"]) / 2, fy, (E["h"] + H["h"]) / 2), (E["x1"] - E["x0"], T, H["h"] - E["h"]), plast, 1.5)
    jm = mat("s4_jambM", "#3a2212")
    box("ent_jL", (E["x0"] + 0.04, H["y0"] + 0.02, E["h"] / 2), (0.08, 0.08, E["h"]), jm); box("ent_jR", (E["x1"] - 0.04, H["y0"] + 0.02, E["h"] / 2), (0.08, 0.08, E["h"]), jm)
    box("ent_jT", ((E["x0"] + E["x1"]) / 2, H["y0"] + 0.02, E["h"] - 0.04), (E["x1"] - E["x0"], 0.08, 0.08), jm)
    # the black entrance passage (camera starts in here)
    bm = black()
    px0, px1, py0, py1 = E["x0"] - 0.1, E["x1"] + 0.1, -4.8, H["y0"] - T
    box("pass_floor", ((px0 + px1) / 2, (py0 + py1) / 2, -0.05), (px1 - px0, py1 - py0, 0.1), bm, ink=False)
    box("pass_ceil", ((px0 + px1) / 2, (py0 + py1) / 2, E["h"] + 0.05), (px1 - px0, py1 - py0, 0.1), bm, ink=False)
    box("pass_L", (px0 - 0.05, (py0 + py1) / 2, E["h"] / 2), (0.1, py1 - py0, E["h"] + 0.2), bm, ink=False)
    box("pass_R", (px1 + 0.05, (py0 + py1) / 2, E["h"] / 2), (0.1, py1 - py0, E["h"] + 0.2), bm, ink=False)
    box("pass_B", ((px0 + px1) / 2, py0 - 0.05, E["h"] / 2), (px1 - px0 + 0.2, 0.1, E["h"] + 0.2), bm, ink=False)
    # double doors (hinged at the jambs, swing into the hallway)
    dm = mat("s4_entDoorM", "#5a3420", tex("s4_panels"))
    leaves = []
    w = (E["x1"] - E["x0"]) / 2 + 0.02
    for side, hx in ((-1, E["x0"]), (1, E["x1"])):
        piv = bpy.data.objects.new(f"ent_hinge{side}", None); bpy.context.scene.collection.objects.link(piv)
        piv.location = (hx, H["y0"] + (0.06 if side < 0 else 0.11), 0)     # leaves overlap in depth: no light seam
        lf = box(f"ent_leaf{side}", (-side * w / 2, 0, E["h"] / 2), (w, 0.05, E["h"] - 0.01), dm, ink=False)   # no ink: the ink line would show in the black join
        lf.parent = piv
        kn = add_mesh("sphere", f"ent_knob{side}", (-side * (w - 0.1), 0.04, 1.0), (0.03,) * 3, material=mat("s4_brassM", "#c9a046", rough=0.4), segments=12, ring_count=8)
        kn.parent = piv
        leaves.append((piv, side))
    out["ent_leaves"] = leaves
    # red runner along the staff line (its top is 8 mm above the floor)
    cp = plane_uv("h_runner", (H["x0"] + 0.15, 0.35), (H["x1"] - 0.05, 1.35), 0.008, mat("s4_carpetM", "#ffffff", tex("s4_carpet")), 1.0)
    # sideboard at the left end of the back wall
    sb = mat("s4_sideM", "#6b3f22", tex("s4_panels")); dk = mat("s4_sideDk", "#3e2212")
    sx0, sx1 = -4.45, -3.75; sy = H["y1"] - 0.24
    box("sb_body", ((sx0 + sx1) / 2, sy, 0.42), (sx1 - sx0, 0.44, 0.76), sb)
    box("sb_top", ((sx0 + sx1) / 2, sy - 0.01, 0.825), (sx1 - sx0 + 0.06, 0.5, 0.05), dk)
    for i in range(3):
        zc = 0.66 - i * 0.22
        box(f"sb_dr{i}", ((sx0 + sx1) / 2, sy - 0.23, zc), (sx1 - sx0 - 0.08, 0.03, 0.18), mat("s4_drawerM", "#7a4a28"))
        for kx in (-0.17, 0.17):
            add_mesh("sphere", f"sb_k{i}{kx}", ((sx0 + sx1) / 2 + kx, sy - 0.26, zc), (0.022,) * 3, material=mat("s4_brassM", "#c9a046", rough=0.4), segments=10, ring_count=6)
    # a brass lamp + a book on the sideboard
    add_mesh("cyl", "sb_lampbase", (-4.25, sy, 0.87), (0.07, 0.07, 0.02), material=mat("s4_brassM", "#c9a046", rough=0.4), vertices=20)
    add_mesh("cyl", "sb_lampstem", (-4.25, sy, 1.0), (0.012, 0.012, 0.13), material=mat("s4_brassM", "#c9a046", rough=0.4), vertices=10)
    shade_m, _ = emit_mat("s4_shadeM", "#ffcf8a", 2.5)
    add_mesh("cone", "sb_lampshade", (-4.25, sy, 1.18), (0.12, 0.12, 0.1), material=shade_m, vertices=24, radius1=1, radius2=0.55)
    box("sb_book", (-3.95, sy, 0.87), (0.22, 0.16, 0.04), mat("s4_bookM", "#2f4a3a"))
    light("POINT", "sb_lamp_l", (-4.25, sy - 0.15, 1.15), "#ffb870", 35, size=0.1)
    # oval frames on the back wall
    for i, (x, z, s) in enumerate(((-4.1, 1.75, 0.95), (-3.1, 1.85, 1.0), (-2.0, 1.85, 1.0))):
        oval_frame(f"oval{i}", (x, H["y1"] - 0.03, z), 0.26 * s, 0.34 * s, f"s4_paint{i}")
    # wall sconces between the frames + on the left wall
    for i, x in enumerate((-3.6, -2.55, -1.5)):
        sconce(f"sc{i}", (x, H["y1"] - 0.02, 1.85))
    return out


def plane_uv(name, a, b, z, m, unit):
    me = bpy.data.meshes.new(name)
    me.from_pydata([(a[0], a[1], z), (b[0], a[1], z), (b[0], b[1], z), (a[0], b[1], z)], [], [(0, 1, 2, 3)])
    uv = me.uv_layers.new()
    L = (b[0] - a[0]) / unit
    for li, (u, v) in enumerate(((0, 0), (L, 0), (L, 1), (0, 1))): uv.data[li].uv = (u, v)
    o = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(o); me.materials.append(m)
    return o


def oval_frame(name, loc, rx, rz, paint):
    x, y, z = loc
    bpy.ops.mesh.primitive_torus_add(major_radius=1.0, minor_radius=0.09, major_segments=40, minor_segments=8, location=(x, y - 0.03, z), rotation=(math.radians(90), 0, 0))
    t = bpy.context.active_object; t.name = name + "_ring"; t.scale = (rx, rz, 0.5); bpy.ops.object.transform_apply(scale=True)
    t.data.materials.append(mat("s4_frameM", "#7a5a2a", rough=0.5)); bpy.ops.object.shade_smooth(); lib.outline(t, 0.008)
    bpy.ops.mesh.primitive_circle_add(vertices=40, radius=1.0, fill_type="NGON", location=(x, y - 0.025, z), rotation=(math.radians(90), 0, 0))
    c = bpy.context.active_object; c.name = name + "_paint"; c.scale = (rx * 0.96, rz * 0.96, 1); bpy.ops.object.transform_apply(scale=True)
    me = c.data; uv = me.uv_layers.new()
    for poly in me.polygons:
        for li in poly.loop_indices:
            v = me.vertices[me.loops[li].vertex_index].co
            uv.data[li].uv = (v.x / (2 * rx * 0.96) + 0.5, v.y / (2 * rz * 0.96) + 0.5)
    me.materials.append(sets.image_mat(name + "_pm", tex(paint)))
    return t


def sconce(name, loc):
    x, y, z = loc
    br = mat("s4_brassM", "#c9a046", rough=0.4)
    box(name + "_plate", (x, y - 0.01, z - 0.05), (0.1, 0.02, 0.2), br)
    add_mesh("cyl", name + "_arm", (x, y - 0.08, z - 0.06), (0.012, 0.012, 0.07), rot=(90, 0, 0), material=br, vertices=8)
    sm, _ = emit_mat("s4_sconceM", "#ffd08a", 3.0)
    add_mesh("cone", name + "_shade", (x, y - 0.15, z + 0.02), (0.08, 0.08, 0.09), material=sm, vertices=20, radius1=0.6, radius2=1.0)
    light("POINT", name + "_l", (x, y - 0.22, z + 0.05), "#ffb070", 55, size=0.12)


# ------------------------------------------------------------------ corridor + steel door
def build_corridor():
    C = COR; D = DOOR; out = {}
    conc = mat("s4_concM", "#ffffff", tex("s4_concrete"))
    tbox("c_floor", ((C["x0"] + D["x"]) / 2, (C["y0"] + C["y1"]) / 2, -0.05), (D["x"] - C["x0"] + 0.05, C["y1"] - C["y0"], 0.1), mat("s4_checkM", "#ffffff", tex("s4_checker")), 2.0)
    tbox("c_ceil", ((C["x0"] + D["x"]) / 2, (C["y0"] + C["y1"]) / 2, C["h"] + 0.05), (D["x"] - C["x0"] + 0.2, C["y1"] - C["y0"] + 0.4, 0.1), mat("s4_cceilM", "#7a7a76", tex("s4_concrete")), 2.0)
    T = 0.2
    tbox("c_front", ((C["x0"] + D["x"]) / 2, C["y0"] - T / 2, C["h"] / 2), (D["x"] - C["x0"] + T, T, C["h"]), conc, 2.0)
    tbox("c_back", ((C["x0"] + D["x"]) / 2, C["y1"] + T / 2, C["h"] / 2), (D["x"] - C["x0"] + T, T, C["h"]), conc, 2.0)
    # concrete ribs where hallway meets corridor (a hard edge between the two looks)
    for yy, sy in ((C["y0"] + 0.06, 0.12), (C["y1"] - 0.06, 0.12)):
        tbox("c_rib", (C["x0"] + 0.06, yy, C["h"] / 2), (0.12, sy, C["h"]), conc, 2.0)
    # end wall with the door opening (spans the whole study width on its far side)
    S = STUDY; wx = D["x"] + D["t"] / 2
    tbox("e_wallA", (wx, (S["y0"] + D["y0"]) / 2, S["h"] / 2), (D["t"], D["y0"] - S["y0"], S["h"]), conc, 2.0)
    tbox("e_wallB", (wx, (D["y1"] + S["y1"]) / 2, S["h"] / 2), (D["t"], S["y1"] - D["y1"], S["h"]), conc, 2.0)
    tbox("e_wallT", (wx, (D["y0"] + D["y1"]) / 2, (D["h"] + S["h"]) / 2), (D["t"], D["y1"] - D["y0"], S["h"] - D["h"]), conc, 2.0)
    # heavy steel frame around the opening (corridor face)
    fr = mat("s4_frameSteel", "#8d9096", tex("s4_steel"), rough=0.6)
    box("d_frL", (D["x"] - 0.04, D["y0"] - 0.06, D["h"] / 2 + 0.03), (0.08, 0.12, D["h"] + 0.06), fr)
    box("d_frR", (D["x"] - 0.04, D["y1"] + 0.06, D["h"] / 2 + 0.03), (0.08, 0.12, D["h"] + 0.06), fr)
    box("d_frT", (D["x"] - 0.04, (D["y0"] + D["y1"]) / 2, D["h"] + 0.06), (0.08, D["y1"] - D["y0"] + 0.24, 0.12), fr)
    # the door leaf, hinged at (x = 0.5, y = 1.45); 0 deg = closed, + swings into the study
    hinge = bpy.data.objects.new("d_hinge", None); bpy.context.scene.collection.objects.link(hinge)
    hinge.location = (D["x"] + 0.1, D["y1"], 0)
    sm = mat("s4_steelM", "#a3a6ab", tex("s4_steel"), rough=0.55)
    W = D["y1"] - D["y0"] - 0.01; GAP = 0.04
    def part(o): o.parent = hinge; return o
    part(box("d_leaf", (-0.05, -W / 2, GAP + (D["h"] - GAP) / 2), (0.08, W, D["h"] - GAP - 0.01), sm))
    part(box("d_panel", (-0.1, -W / 2, GAP + (D["h"] - GAP) / 2), (0.03, W - 0.18, D["h"] - GAP - 0.2), mat("s4_panelSteel", "#8f9297", tex("s4_steel"), rough=0.6)))
    rv = mat("s4_rivetM", "#5e6066", rough=0.5)
    for i in range(6):
        for zz in (0.17, D["h"] - 0.1):
            part(add_mesh("sphere", "d_rv", (-0.12, -0.1 - i * (W - 0.2) / 5, zz), (0.014,) * 3, material=rv, segments=8, ring_count=6, ink=False))
    wc = (-0.15, -W / 2, 1.2)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.15, minor_radius=0.018, location=wc, rotation=(0, math.radians(90), 0), major_segments=32, minor_segments=8)
    wh = bpy.context.active_object; wh.name = "d_wheel"; wh.data.materials.append(mat("s4_wheelM", "#3c3e44", rough=0.4)); lib.outline(wh, 0.008); part(wh)
    for a in (0, 90):
        sp = box("d_spoke", wc, (0.02, 0.3, 0.025), mat("s4_wheelM", "#3c3e44"), rot=(a, 0, 0)); part(sp)
    part(add_mesh("sphere", "d_hub", (wc[0] - 0.01, wc[1], wc[2]), (0.045,) * 3, material=mat("s4_hubM", "#c8ccd2", rough=0.3), segments=16, ring_count=10))
    out["hinge"] = hinge
    # ceiling lamps: V-shaped fluorescent pairs (ref corridor); the one by the door flickers on the gunshot
    lamps = []
    for i, x in enumerate((-1.0, -0.45)):
        lm, ls = emit_mat(f"s4_tube{i}", "#e8ecff", 5.0)
        for s in (-1, 1):
            add_mesh("cyl", f"c_tube{i}{s}", (x + s * 0.12, (C["y0"] + C["y1"]) / 2, C["h"] - 0.04), (0.025, 0.025, 0.25), rot=(0, 90 - s * 25, 0), material=lm, vertices=10, ink=False)
        box(f"c_lampbase{i}", (x, (C["y0"] + C["y1"]) / 2, C["h"] - 0.01), (0.55, 0.12, 0.02), mat("s4_lampbaseM", "#45474c"))
        L = light("AREA", f"c_lamp{i}", (x, (C["y0"] + C["y1"]) / 2, C["h"] - 0.08), "#dfe4ff", 380, size=0.6, rot=(0, 0, 0))
        lamps.append((ls, L))
    out["lamps"] = lamps
    out["doorfill"] = light("AREA", "c_doorfill", (-0.7, 0.93, 2.35), "#dfe4ff", 160, size=0.8, target=(D["x"], 0.95, 0.9))
    # warm spill under the door (study side strip + a corridor floor glow), flickers on the gunshot
    stm, sts = emit_mat("s4_understrip", "#ffb050", 0.0)
    strip = box("d_understrip", (D["x"] + 0.27, (D["y0"] + D["y1"]) / 2, 0.006), (0.1, D["y1"] - D["y0"], 0.004), stm, ink=False)
    strip["no_ground"] = True
    out["under"] = (sts, light("POINT", "d_spill", (D["x"] - 0.08, (D["y0"] + D["y1"]) / 2, 0.06), "#ffa040", 0.0, size=0.3),
                    light("POINT", "d_spillIn", (D["x"] + 0.5, (D["y0"] + D["y1"]) / 2, 0.4), "#ffa040", 0.0, size=0.3))
    return out


# ------------------------------------------------------------------ study + dog
def build_study():
    S = STUDY; out = {}
    tbox("s_floor", ((S["x0"] + S["x1"]) / 2, (S["y0"] + S["y1"]) / 2, -0.05), (S["x1"] - S["x0"] + 0.4, S["y1"] - S["y0"] + 0.4, 0.1), mat("s4_tileM", "#ffffff", tex("s4_tiles")), 2.0)
    dark = mat("s4_studyWall", "#3a2c24", tex("s4_panels"))
    T = 0.2
    tbox("s_ceil", ((S["x0"] + S["x1"]) / 2, (S["y0"] + S["y1"]) / 2, S["h"] + 0.05), (S["x1"] - S["x0"] + 0.4, S["y1"] - S["y0"] + 0.4, 0.1), dark, 2.0)
    tbox("s_far", (S["x1"] + T / 2, (S["y0"] + S["y1"]) / 2, S["h"] / 2), (T, S["y1"] - S["y0"] + 0.4, S["h"]), dark, 1.5)
    tbox("s_L", ((S["x0"] + S["x1"]) / 2, S["y1"] + T / 2, S["h"] / 2), (S["x1"] - S["x0"] + 0.4, T, S["h"]), dark, 1.5)
    tbox("s_R", ((S["x0"] + S["x1"]) / 2, S["y0"] - T / 2, S["h"] / 2), (S["x1"] - S["x0"] + 0.4, T, S["h"]), dark, 1.5)
    return out


def build_dog(loc, yaw=0.0):
    """stylised low-poly German shepherd lying down asleep: head resting on its front paws, eyes closed, tail curled.
    Built facing -Y (head toward -Y) in local space; origin on the floor under its middle."""
    root = bpy.data.objects.new("dog", None); bpy.context.scene.collection.objects.link(root)
    tan, saddle, darkm, cream = mat("dog_tan", "#b9823f", rough=0.9), mat("dog_saddle", "#2b2420", rough=0.9), mat("dog_dark", "#1e1814"), mat("dog_cream", "#d8b07a")
    def P(o): o.parent = root; return o
    def ell(name, c, r, m, rot=(0, 0, 0)):
        return P(add_mesh("sphere", name, c, r, rot=rot, material=m, segments=14, ring_count=9))
    # cushion
    P(add_mesh("cyl", "dog_bed", (0, 0.02, 0.04), (0.42, 0.62, 0.04), material=mat("dog_bedM", "#6a2f2a"), vertices=28))
    Z = 0.08
    ell("dog_body", (0, 0.08, Z + 0.15), (0.17, 0.36, 0.15), tan)
    ell("dog_back", (0, 0.12, Z + 0.22), (0.15, 0.27, 0.085), saddle)
    ell("dog_hip", (0.02, 0.32, Z + 0.13), (0.16, 0.16, 0.13), tan)
    ell("dog_chest", (0, -0.2, Z + 0.13), (0.15, 0.14, 0.13), cream)
    # folded legs + front paws stretched forward (-Y)
    for s in (-1, 1):
        P(add_mesh("cyl", "dog_fleg", (s * 0.08, -0.36, Z + 0.035), (0.04, 0.04, 0.13), rot=(90, 0, 0), material=tan, vertices=10))
        ell("dog_paw", (s * 0.08, -0.5, Z + 0.035), (0.05, 0.065, 0.035), cream)
        ell("dog_haunch", (s * 0.12, 0.34, Z + 0.07), (0.07, 0.16, 0.07), tan)
        ell("dog_hpaw", (s * 0.13, 0.13, Z + 0.03), (0.045, 0.07, 0.03), cream)
    # head resting on the paws
    hx, hy, hz = 0.0, -0.42, Z + 0.15
    ell("dog_head", (hx, hy, hz), (0.11, 0.12, 0.095), tan)
    ell("dog_cap", (hx, hy + 0.03, hz + 0.05), (0.09, 0.09, 0.05), saddle)
    ell("dog_snout", (hx, hy - 0.13, hz - 0.03), (0.055, 0.1, 0.05), tan)
    ell("dog_muzzle", (hx, hy - 0.17, hz - 0.02), (0.045, 0.06, 0.04), darkm)
    ell("dog_nose", (hx, hy - 0.225, hz - 0.005), (0.022, 0.018, 0.016), darkm)
    for s in (-1, 1):
        P(add_mesh("cone", "dog_ear", (s * 0.065, hy + 0.04, hz + 0.12), (0.045, 0.03, 0.08), rot=(-15, s * 18, 0), material=saddle, vertices=8))
        # closed eyes: thin dark arcs (sleeping)
        P(add_mesh("cyl", "dog_eye", (s * 0.085, hy - 0.07, hz + 0.025), (0.004, 0.004, 0.022), rot=(0, 90, s * 20), material=darkm, vertices=6, ink=False))
    # tail curled around the hip
    for i in range(6):
        a = math.radians(-20 + i * 32)
        P(add_mesh("sphere", "dog_tail", (0.2 * math.cos(a) * (1 if i < 3 else 1), 0.42 + 0.14 * math.sin(a), Z + 0.035), (0.04 - i * 0.003,) * 3, material=saddle if i < 4 else tan, segments=10, ring_count=6))
    root.location = loc; root.rotation_euler.z = math.radians(yaw)
    for o in root.children: o["no_ground"] = True
    return root
