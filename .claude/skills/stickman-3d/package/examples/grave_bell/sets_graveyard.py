"""Graveyard set (shots 1, 2, 3, 6, 24, 25): a small country graveyard behind a white picket fence, bell post with a
shingled roof + brass bell + S. HOLT plaque, the open grave (dusk) or the snowy filled-in mound (night / sunrise),
headstones, the teal A-frame house + Kenney suburban houses (node-recoloured: export with --bake) behind, stylised
pines on the hills. Parts that touch keep same-facing faces >= 1 cm apart (WebGL z-fight -> black ink blobs).
States: "dusk" (pink-violet sky, amber autumn lawn), "night" (deep blue, snow, falling snow, lit windows),
"sunrise" (peach-pink sky, snow).  Z up, camera on -Y looking +Y.  build_graveyard(state) -> dict of anchors."""
import bpy, math, random
from pathlib import Path
from mathutils import Vector
import lib, sets
from lib import mat, box, add_mesh, rgb, light, emissive
from sets import tex, plane, image_mat, tiled, bell_mesh, candy_cord, coffin

KEN = Path(r"D:\resource\lowpoly\assets\kenney\city-kit-suburban\Models\GLB format")
# layout
G = dict(PIT=(1.0, 2.2, 1.5),            # pit width (x), length (y), depth; centred on the origin, head end at +Y
         PX=-0.45, PY=1.55,              # bell post base
         POST_H=2.6, BELL_R=0.19,
         FENCE_Y=5.6, HOUSE=(2.6, 15.5), WIFE_HOUSE=(-5.2, 15.0))
G["PIVOT"] = (G["PX"] + 0.58, G["PY"], 2.27)
G["PLAQUE"] = (G["PX"], G["PY"] - 0.14, 1.45)    # 1.5 cm proud of its back board (WebGL: 2 mm z-fought into a black blob)
G["RING_Y"] = G["PY"] - 0.165                     # the cord runs 1.4 cm in front of the plaque
G["ROOF_Z"] = G["POST_H"] + 0.05


def _mesh(name, verts, faces, material, ink=True, smooth=False):
    me = bpy.data.meshes.new(name); me.from_pydata(verts, [], faces); me.update()
    o = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(o); me.materials.append(material)
    if smooth:
        for p in me.polygons: p.use_smooth = True
    if ink: lib.outline(o)
    return o


def ico(name, loc, scale, material, sub=2, ink=True, smooth=False):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub, radius=1, location=loc)
    o = bpy.context.active_object; o.name = name; o.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(material)
    if smooth: bpy.ops.object.shade_smooth()
    if ink: lib.outline(o)
    return o


# ------------------------------------------------------------------ sky
def sky(stops, strength=1.0, haze=0.0, haze_col="#ffffff"):
    """vertical gradient world: stops = [(view z, hex), ...] from horizon (0) to zenith (1)."""
    w = bpy.data.worlds.new("Sky"); bpy.context.scene.world = w
    w.use_nodes = True; nt = w.node_tree; nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputWorld"); bg = nt.nodes.new("ShaderNodeBackground")
    tc = nt.nodes.new("ShaderNodeTexCoord"); sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    ramp = nt.nodes.new("ShaderNodeValToRGB"); cr = ramp.color_ramp
    for i, (p, c) in enumerate(stops):
        e = cr.elements[i] if i < 2 else cr.elements.new(p)
        e.position = p; e.color = rgb(c)
    nt.links.new(tc.outputs["Generated"], sep.inputs[0]); nt.links.new(sep.outputs["Z"], ramp.inputs[0])
    nt.links.new(ramp.outputs[0], bg.inputs[0]); bg.inputs[1].default_value = strength
    nt.links.new(bg.outputs[0], out.inputs["Surface"])
    if haze > 0:
        vs = nt.nodes.new("ShaderNodeVolumeScatter"); vs.inputs["Density"].default_value = haze
        vs.inputs["Color"].default_value = rgb(haze_col); vs.inputs["Anisotropy"].default_value = 0.4
        nt.links.new(vs.outputs[0], out.inputs["Volume"])
    return w


PAL = {
    "dusk": dict(sky=[(0.0, "#f4a7a8"), (0.12, "#d98ccc"), (0.35, "#9a78e0"), (1.0, "#5f58c8")], sky_k=1.0,
                 hill="#8a7a46", pine="#3b4a36", roof="#8a3f36", stone="#c9c4cc", fence="#f0e6dc", tint="#fff4ea",
                 win="#3a3f7a", win_emit=0.0, ground="gy_grass"),
    "night": dict(sky=[(0.0, "#3248b8"), (0.12, "#1d2c8e"), (0.4, "#121c66"), (1.0, "#0a1048")], sky_k=1.0,
                  hill="#dfe4ff", pine="#1f2c4a", roof="#6a4f4a", stone="#d8dcf0", fence="#eef0ff", tint="#c9cdfa",
                  win="#ffb24a", win_emit=3.2, ground="gy_snow"),
    "sunrise": dict(sky=[(0.0, "#ffc7a6"), (0.1, "#f7a6c6"), (0.32, "#d79ae8"), (1.0, "#6f86e8")], sky_k=1.0,
                    hill="#f6e6ec", pine="#3a4a50", roof="#7a5a52", stone="#efe6ea", fence="#fff2ea", tint="#fff3ee",
                    win="#5a4a7a", win_emit=0.0, ground="gy_snow"),
}


def graveyard_lights(state):
    p = PAL[state]
    if state == "dusk":
        sky(p["sky"], 1.0)
        light("SUN", "sun", (0, 0, 8), "#fff0d8", 4.5, size=0.4, rot=(62, 0, -140))
        light("AREA", "fill", (0, -6, 5), "#d9a8ff", 900, size=8, target=(0, 2, 0))
    elif state == "night":
        sky(p["sky"], 1.1, haze=0.004, haze_col="#8a9cff")
        light("SUN", "moon", (0, 0, 8), "#b0bcff", 5.0, size=0.5, rot=(55, 0, -25))
        light("AREA", "fill", (0, -6, 5), "#7a88ff", 2200, size=8, target=(0, 2, 0))
    else:
        sky(p["sky"], 1.0)
        light("SUN", "sun", (0, 0, 8), "#ffd6b8", 4.0, size=0.4, rot=(68, 0, 150))
        light("AREA", "fill", (0, -6, 5), "#ffc0e0", 900, size=8, target=(0, 2, 0))


# ------------------------------------------------------------------ props
def bell_post(state, out):
    PX, PY, H = G["PX"], G["PY"], G["POST_H"]
    wood = mat("postWood", "#ffffff", tex("gy_postwood"))
    dark = mat("postDark", "#9a6a40")
    o = box("post", (PX, PY, H / 2), (0.2, 0.2, H), wood); tiled(o, 0.5)
    box("postCap", (PX, PY, H - 0.055), (0.28, 0.28, 0.13), dark)          # top 1 cm above the post top (no coplanar faces)
    beam = box("beam", (PX + 0.34, PY, 2.42), (0.86, 0.16, 0.14), wood); tiled(beam, 0.5)
    br = box("brace", (PX + 0.17, PY, 2.18), (0.48, 0.08, 0.08), dark); br.rotation_euler.y = math.radians(-38)
    # small shingled gable roof (ridge along X) on a plank base
    R = G["ROOF_Z"]; x0, x1, hw, rh = PX - 0.42, PX + 0.98, 0.46, 0.3
    box("roofBase", ((x0 + x1) / 2, PY, R + 0.04), (x1 - x0 + 0.06, 2 * hw + 0.06, 0.08), dark)
    sh = mat("shingle", PAL[state]["roof"] if state == "dusk" else "#9a7a70", tex("gy_shingles"), repeat=(3, 2))
    v = [(x0, PY - hw, R + 0.08), (x1, PY - hw, R + 0.08), (x1, PY + hw, R + 0.08), (x0, PY + hw, R + 0.08),
         (x0, PY, R + 0.08 + rh), (x1, PY, R + 0.08 + rh)]
    roof = _mesh("roof", v, [(0, 1, 5, 4), (3, 4, 5, 2), (0, 4, 3), (1, 2, 5), (0, 3, 2, 1)], sh)
    roof.data.uv_layers.new()
    for poly in roof.data.polygons:
        for li in poly.loop_indices:
            c = v[roof.data.loops[li].vertex_index]; roof.data.uv_layers.active.data[li].uv = (c[0] * 2, (c[1] - PY) * 2 + c[2] * 2)
    out["roof"] = roof
    if state != "dusk":                                  # snow cap on the roof (falls in shot 6)
        snowm = mat("snowCap", "#f6f6ff", rough=0.95)
        cap = _mesh("snowcap", [(x0 - 0.04, PY - hw - 0.05, R + 0.12), (x1 + 0.04, PY - hw - 0.05, R + 0.12), (x1 + 0.04, PY + hw + 0.05, R + 0.12),
                                (x0 - 0.04, PY + hw + 0.05, R + 0.12), (x0 - 0.04, PY, R + 0.24 + rh), (x1 + 0.04, PY, R + 0.24 + rh)],
                    [(0, 1, 5, 4), (3, 4, 5, 2), (0, 4, 3), (1, 2, 5), (0, 3, 2, 1)], snowm, smooth=False)
        bpy.ops.object.select_all(action="DESELECT"); cap.select_set(True); bpy.context.view_layer.objects.active = cap
        bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")
        out["snowcap"] = cap
    # bell on a pivot (swings about Y), yoke + lever toward the post where the cord ties on
    piv = bpy.data.objects.new("bellPivot", None); bpy.context.scene.collection.objects.link(piv); piv.location = G["PIVOT"]
    r = G["BELL_R"]
    bell = bell_mesh("bell", r, col="#f0c040"); bell.parent = piv; bell.location = (0, 0, -r * 1.6 - 0.05)
    th = bell.modifiers.new("wall", "SOLIDIFY"); th.thickness = 0.012; th.offset = 1.0   # WebGL culls back faces: an open
    bell.modifiers.move(len(bell.modifiers) - 1, 0)                                      # shell needs a real wall (before ink)
    yoke = box("yoke", (0, 0, -0.03), (0.14, 0.08, 0.08), dark); yoke.parent = piv; yoke.location = (0, 0, -0.03)
    lev = box("lever", (0, 0, 0), (0.42, 0.05, 0.05), dark); lev.parent = piv; lev.location = (-0.2, -0.06, -0.12); lev.rotation_euler.y = math.radians(28)
    clap = add_mesh("sphere", "clapper", (0, 0, 0), (0.045,) * 3, material=mat("clapM", "#5a3a1a"), segments=12, ring_count=8)
    clap.parent = piv; clap.location = (0, 0, -r * 1.6 - 0.02)
    bm = bell.data.materials[0]; bp = next(n for n in bm.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    bp.inputs["Emission Color"].default_value = rgb("#e0a830"); bp.inputs["Emission Strength"].default_value = 0.4
    out["pivot"] = piv; out["bell"] = bell
    out["lever_tip"] = Vector(G["PIVOT"]) + Vector((-0.38, -0.06, -0.22))
    # plaque
    plane("plaque", 0.38, 0.19, image_mat("plaqueM", tex("plaque"), emit=0.25), G["PLAQUE"])
    box("plaqueBack", (G["PLAQUE"][0], PY - 0.1125, G["PLAQUE"][2]), (0.41, 0.025, 0.22), dark)   # on the post face, 1.5 cm behind the plaque


def cord_path(pts, r=0.011, name="cord"):
    objs = []
    for i in range(len(pts) - 1):
        L = (Vector(pts[i + 1]) - Vector(pts[i])).length
        objs += candy_cord(f"{name}{i}_", pts[i], pts[i + 1], r, stripes=max(2, int(L / 0.05)))
    for o in objs: lib.outline(o, 0.004)
    return objs


def headstone(name, loc, w=0.5, h=0.62, yaw=0, snow=False, col="#c9c4cc"):
    st = mat("stoneM_" + col, col, tex("gy_stone"))
    b = box(name, (loc[0], loc[1], h / 2 - 0.05), (w, 0.16, h), st)          # 1 cm proud of the round top (coplanar -> ink blobs)
    t = add_mesh("cyl", name + "_top", (loc[0], loc[1], h - 0.05), (w / 2, w / 2, 0.07), (90, 0, 0), st, vertices=24)
    t.scale = (1, 0.6, 1)
    parts = [b, t]
    if snow:
        s = add_mesh("cyl", name + "_snow", (loc[0], loc[1], h - 0.05 + w * 0.3), (w / 2 + 0.02, w / 2 + 0.02, 0.06), (0, 0, 0), mat("snowCap", "#f6f6ff"), vertices=20)
        s.scale = (1, 0.18, 1); parts.append(s)
    for o in parts: o.rotation_euler.z += math.radians(yaw)          # the snow turns with its stone
    sets.lib_uv_box(b, w)
    return b


def cross(name, loc, h=0.8, snow=False):
    wd = mat("crossM", "#b08a5a")
    box(name, (loc[0], loc[1], h / 2), (0.07, 0.06, h), wd)
    box(name + "_x", (loc[0], loc[1], h * 0.75), (0.42, 0.08, 0.07), wd)       # 1 cm proud of the post (coplanar -> ink blobs)
    if snow:
        box(name + "_s", (loc[0], loc[1], h * 0.75 + 0.05), (0.44, 0.1, 0.03), mat("snowCap", "#f6f6ff"))


def fence(state, y, x0=-14, x1=14, h=1.05):
    col = PAL[state]["fence"]; fm = mat("fenceM", col)
    n = int((x1 - x0) / 0.17)
    pk = box("picket", (x0, y, h / 2), (0.08, 0.04, h), fm)
    a = pk.modifiers.new("arr", "ARRAY"); a.count = n; a.relative_offset_displace = (0.17 / 0.08, 0, 0)
    pk.modifiers.move(len(pk.modifiers) - 1, 0)
    # pointed tops
    tip = _mesh("pickTip", [(x0 - 0.04, y - 0.02, h), (x0 + 0.04, y - 0.02, h), (x0, y - 0.02, h + 0.07), (x0 - 0.04, y + 0.02, h), (x0 + 0.04, y + 0.02, h), (x0, y + 0.02, h + 0.07)],
                [(0, 1, 2), (3, 5, 4), (0, 2, 5, 3), (1, 4, 5, 2)], fm)
    a2 = tip.modifiers.new("arr", "ARRAY"); a2.use_relative_offset = False; a2.use_constant_offset = True; a2.constant_offset_displace = (0.17, 0, 0); a2.count = n
    tip.modifiers.move(len(tip.modifiers) - 1, 0)
    for z in (0.3, 0.8):
        box(f"rail{z}", ((x0 + x1) / 2, y + 0.04, z), (x1 - x0, 0.03, 0.07), fm)
    if state != "dusk":
        box("fenceSnow", ((x0 + x1) / 2, y + 0.04, 0.86), (x1 - x0, 0.06, 0.04), mat("snowCap", "#f6f6ff"), ink=False)


def pine(name, h=3.0, col="#3b4a36", snow=False):
    """stylised pine: 3 stacked cones + trunk, one mesh (instanced via linked copies)."""
    gm = mat("pineM_" + col, col, rough=1.0); tm = mat("trunkM", "#4a3020")
    parts = [add_mesh("cyl", name + "_t", (0, 0, h * 0.08), (h * 0.04, h * 0.04, h * 0.08), material=tm, ink=False, vertices=8)]
    for i, (z, r, hh) in enumerate(((0.32, 0.30, 0.42), (0.55, 0.24, 0.36), (0.78, 0.16, 0.3))):
        parts.append(add_mesh("cone", f"{name}_c{i}", (0, 0, h * z), (h * r, h * r, h * hh / 2), material=gm, ink=False, vertices=10))
    if snow:
        sm = mat("snowCap", "#f6f6ff")
        for i, (z, r) in enumerate(((0.45, 0.19), (0.66, 0.14), (0.88, 0.08))):
            parts.append(add_mesh("cone", f"{name}_s{i}", (0, 0, h * z), (h * r, h * r, h * 0.07), material=sm, ink=False, vertices=10))
    bpy.ops.object.select_all(action="DESELECT")
    for p in parts: p.select_set(True)
    bpy.context.view_layer.objects.active = parts[1]; bpy.ops.object.join()
    o = bpy.context.active_object; o.name = name
    lib.outline(o, 0.03)
    return o


def forest(state, seed=11):
    r = random.Random(seed); p = PAL[state]; snow = state != "dusk"
    base = pine("pineBase", 1.0, p["pine"], snow)
    base.location = (0, -500, 0)
    spots = []
    for i in range(70):                                  # band of pines on the far hill
        x = r.uniform(-45, 45); y = r.uniform(30, 52); s = r.uniform(4.5, 8.0)
        spots.append((x, y, hill_z(x, y) - 0.4, s))
    for x, y in ((-9, 21), (-15.5, 23), (5.5, 22), (13, 24), (-3.5, 25), (22, 26)):
        spots.append((x, y, 0, r.uniform(5, 7)))
    for i, (x, y, z, s) in enumerate(spots):
        o = base.copy(); bpy.context.scene.collection.objects.link(o)
        o.location = (x, y, z); o.scale = (s * r.uniform(0.85, 1.1), s, s); o.rotation_euler.z = r.random() * 6.28
        o["coplanar_ok"] = 1                         # far forest: random overlaps between trees (and trunk bases under the ground)


def hill_z(x, y):
    # height of the far hill surface (matches the hill ellipsoids below), rough
    z = 0.0
    for cx, cy, cz, sx, sy, sz in HILLS:
        u = ((x - cx) / sx) ** 2 + ((y - cy) / sy) ** 2
        if u < 1: z = max(z, cz + sz * math.sqrt(1 - u))
    return z


HILLS = [(-20, 70, -10, 60, 40, 22), (30, 80, -14, 55, 45, 26), (0, 110, -20, 120, 50, 40)]


def hills(state):
    p = PAL[state]; hm = mat("hillM", p["hill"], tex("gy_snow" if state != "dusk" else "gy_grass"), repeat=(6, 6))
    for i, (cx, cy, cz, sx, sy, sz) in enumerate(HILLS):
        add_mesh("sphere", f"hill{i}", (cx, cy, cz), (sx, sy, sz), material=hm, ink=False, segments=48, ring_count=24)


# ------------------------------------------------------------------ houses
def window(name, loc, w, h, state, rot_z=0):
    p = PAL[state]; trim = mat("trimM", "#f4f0f0")
    if p["win_emit"]:
        wm = emissive("winLit", p["win"], p["win_emit"])
    else:
        wm = mat("winDark", p["win"], rough=0.3)
    g = plane(name, w, h, wm, loc)
    g.rotation_euler.z = math.radians(rot_z)
    # frame parts that overlap keep their front and back faces >= 1 cm apart (y offsets from the glass; WebGL rule):
    # sides -6..0 cm, head -8..-2, sill -10..-2, mullion -3..-1, transom -4.5..-2
    fr = [box(name + "_t", (loc[0], loc[1] - 0.05, loc[2] + h / 2), (w + 0.16, 0.06, 0.08), trim),
          box(name + "_b", (loc[0], loc[1] - 0.06, loc[2] - h / 2), (w + 0.22, 0.08, 0.08), trim),
          box(name + "_l", (loc[0] - w / 2, loc[1] - 0.03, loc[2]), (0.08, 0.06, h), trim),
          box(name + "_r", (loc[0] + w / 2, loc[1] - 0.03, loc[2]), (0.08, 0.06, h), trim),
          box(name + "_v", (loc[0], loc[1] - 0.02, loc[2]), (0.04, 0.02, h), trim), box(name + "_h", (loc[0], loc[1] - 0.0325, loc[2]), (w, 0.025, 0.04), trim)]
    return g


def aframe(state, loc, siding="siding_teal", w=4.2, d=4.0, h=2.0, ridge=4.6, chimney=False, name="aframe"):
    """steep-gabled house (the reference's teal A-frame): gable faces -Y."""
    x, y = loc; p = PAL[state]
    wall = mat(name + "Wall", "#ffffff", tex(siding))
    b = box(name + "_body", (x, y, h / 2), (w, d, h), wall); tiled(b, 1.6)
    v = [(x - w / 2, y - d / 2, h), (x + w / 2, y - d / 2, h), (x, y - d / 2, ridge), (x - w / 2, y + d / 2, h), (x + w / 2, y + d / 2, h), (x, y + d / 2, ridge)]
    gab = _mesh(name + "_gable", v, [(0, 1, 2), (3, 5, 4)], wall); tiled(gab, 1.6)
    roofm = mat(name + "Roof", "#f4f4ff" if state != "dusk" else p["roof"], tex("gy_shingles") if state == "dusk" else tex("gy_snow"), repeat=(4, 4))
    over = 0.35; th = 0.14
    for s in (-1, 1):
        a = Vector((x + s * (w / 2 + over * 0.6), 0, h - over * (ridge - h) / (w / 2) * 0.6)); bpt = Vector((x, 0, ridge + 0.08))
        c = (a + bpt) / 2; L = (bpt - a).length
        rf = box(f"{name}_roof{s}", (c.x, y, c.z), (L, d + 2 * over, th), roofm)
        rf.rotation_euler.y = s * math.atan2(bpt.z - a.z, abs(bpt.x - a.x)) * 1.0
        tiled(rf, 1.0)
    window(name + "_w0", (x, y - d / 2 - 0.02, h + 0.9), 0.8, 1.0, state)
    window(name + "_w1", (x - w / 4, y - d / 2 - 0.02, 1.0), 0.7, 0.9, state)
    window(name + "_w2", (x + w / 4, y - d / 2 - 0.02, 1.0), 0.7, 0.9, state)
    out = {}
    if chimney:
        out["chimney_top"] = (x + w / 4, y + 0.6, ridge + 0.3)
        box(name + "_chim", (x + w / 4, y + 0.6, (h + ridge) / 2 + 0.35), (0.45, 0.45, ridge - h + 0.6), mat("chimM", "#b8423a"))
    if p["win_emit"]:
        light("POINT", name + "_glow", (x, y - d / 2 - 1.2, 1.2), "#ffb050", 60, size=0.6)
    return out


def kenney_house(state, kind, loc, yaw, scale, wall, roof, name):
    """Kenney suburban building recoloured: white atlas walls x wall colour, green roof -> roof colour, blue windows ->
    dark / lit (night)."""
    root, objs = lib.import_glb(KEN / f"building-type-{kind}.glb", loc, yaw, scale, ink=False)
    p = PAL[state]
    for o in objs:
        if o.type != "MESH": continue
        for m in o.data.materials:
            if not m or m.get("recol"): continue
            m["recol"] = 1; nt = m.node_tree
            bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"); ti = next(n for n in nt.nodes if n.type == "TEX_IMAGE")
            sep = nt.nodes.new("ShaderNodeSeparateColor"); sep.mode = "HSV"; nt.links.new(ti.outputs[0], sep.inputs[0])
            def mth(op, a, b, c=None):
                n = nt.nodes.new("ShaderNodeMath"); n.operation = op
                for i, v in enumerate((a, b, c)):
                    if v is None: continue
                    if isinstance(v, (int, float)): n.inputs[i].default_value = v
                    else: nt.links.new(v, n.inputs[i])
                return n.outputs[0]
            S, Hh, V = sep.outputs[1], sep.outputs[0], sep.outputs[2]
            sat = mth("GREATER_THAN", S, 0.22)
            roofm = mth("MULTIPLY", mth("COMPARE", Hh, 0.40, 0.10), sat)
            winm = mth("MULTIPLY", mth("COMPARE", Hh, 0.62, 0.07), sat)
            def mix(fac, a, b):
                n = nt.nodes.new("ShaderNodeMix"); n.data_type = "RGBA"; n.blend_type = "MIX"
                nt.links.new(fac, n.inputs[0]) if not isinstance(fac, float) else None
                for sock, v in ((n.inputs[6], a), (n.inputs[7], b)):
                    if isinstance(v, tuple): sock.default_value = v
                    else: nt.links.new(v, sock)
                return n.outputs[2]
            wallc = nt.nodes.new("ShaderNodeMix"); wallc.data_type = "RGBA"; wallc.blend_type = "MULTIPLY"; wallc.inputs[0].default_value = 1
            nt.links.new(V, wallc.inputs[6]); wallc.inputs[7].default_value = rgb(wall)
            c = mix(roofm, wallc.outputs[2], rgb(roof if state == "dusk" else "#f2f2ff"))
            c = mix(winm, c, rgb(p["win"]))
            nt.links.new(c, bsdf.inputs["Base Color"])
            bsdf.inputs["Roughness"].default_value = 0.9
            if p["win_emit"]:
                nt.links.new(winm, bsdf.inputs["Emission Strength"]); bsdf.inputs["Emission Color"].default_value = rgb(p["win"])
                em = mth("MULTIPLY", winm, p["win_emit"]); nt.links.new(em, bsdf.inputs["Emission Strength"])
    lib.toonify([o for o in objs if o.type == "MESH"], width=0.012 / scale, sat=1.0)
    for o in objs:
        if o.type == "MESH": o["open_ok"] = 1      # low-poly kit: open under the eaves; background only, never seen from below
    return root


# ------------------------------------------------------------------ snow (deterministic, geometry nodes)
def snowfall(name, center, size, count=900, speed=0.55, radius=0.018, seed=3):
    """falling flakes: random points in a box, z = wrap(z0 - speed * t), small sideways sway; frame-deterministic."""
    me = bpy.data.meshes.new(name); o = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(o)
    o.location = center; o["no_ground"] = True
    ng = bpy.data.node_groups.new(name + "GN", "GeometryNodeTree")
    ng.interface.new_socket("Geometry", in_out="INPUT", socket_type="NodeSocketGeometry")
    ng.interface.new_socket("Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")
    N = ng.nodes; Lk = ng.links.new
    gin = N.new("NodeGroupInput"); gout = N.new("NodeGroupOutput")
    pts = N.new("GeometryNodePoints"); pts.inputs["Count"].default_value = count
    rnd = N.new("FunctionNodeRandomValue"); rnd.data_type = "FLOAT_VECTOR"
    vv = [x for x in rnd.inputs if x.type == "VECTOR"]
    vv[0].default_value = (-size[0] / 2, -size[1] / 2, 0); vv[1].default_value = (size[0] / 2, size[1] / 2, size[2])
    next(x for x in rnd.inputs if x.name == "Seed").default_value = int(seed)
    Lk(next(x for x in rnd.outputs if x.type == "VECTOR"), pts.inputs["Position"])
    t = N.new("GeometryNodeInputSceneTime")
    pos = N.new("GeometryNodeInputPosition"); sep = N.new("ShaderNodeSeparateXYZ"); Lk(pos.outputs[0], sep.inputs[0])
    def m(op, a, b=None, c=None):
        n = N.new("ShaderNodeMath"); n.operation = op
        for i, v in enumerate((a, b, c)):
            if v is None: continue
            if isinstance(v, (int, float)): n.inputs[i].default_value = v
            else: Lk(v, n.inputs[i])
        return n.outputs[0]
    z = m("WRAP", m("SUBTRACT", sep.outputs["Z"], m("MULTIPLY", t.outputs["Seconds"], speed)), size[2], 0.0)
    sway = m("MULTIPLY", m("SINE", m("ADD", m("MULTIPLY", t.outputs["Seconds"], 1.3), m("MULTIPLY", sep.outputs["Z"], 3.0))), 0.08)
    x = m("ADD", sep.outputs["X"], sway)
    cmb = N.new("ShaderNodeCombineXYZ"); Lk(x, cmb.inputs[0]); Lk(sep.outputs["Y"], cmb.inputs[1]); Lk(z, cmb.inputs[2])
    sp = N.new("GeometryNodeSetPosition"); Lk(pts.outputs[0], sp.inputs["Geometry"]); Lk(cmb.outputs[0], sp.inputs["Position"])
    ico_n = N.new("GeometryNodeMeshIcoSphere"); ico_n.inputs["Radius"].default_value = radius; ico_n.inputs["Subdivisions"].default_value = 1
    inst = N.new("GeometryNodeInstanceOnPoints"); Lk(sp.outputs[0], inst.inputs["Points"]); Lk(ico_n.outputs[0], inst.inputs["Instance"])
    rs = N.new("FunctionNodeRandomValue"); rs.data_type = "FLOAT"
    fl = [x for x in rs.inputs if x.type == "VALUE" and x.name in ("Min", "Max")]
    fl[0].default_value = 0.5; fl[1].default_value = 1.6
    Lk(next(x for x in rs.outputs if x.type == "VALUE"), inst.inputs["Scale"])
    sm = N.new("GeometryNodeSetMaterial"); sm.inputs["Material"].default_value = emissive("flakeM", "#f4f6ff", 0.95)
    Lk(inst.outputs[0], sm.inputs["Geometry"]); Lk(sm.outputs[0], gout.inputs[0])
    mod = o.modifiers.new("snow", "NODES"); mod.node_group = ng
    return o


# ------------------------------------------------------------------ build
def build_graveyard(state="dusk"):
    out = {}; p = PAL[state]
    PW, PL, PD = G["PIT"]
    gm = mat("groundM", "#ffffff", tex(p["ground"]))
    if state == "dusk":
        # ground slabs around the pit hole, 1.5 cm back from the pit walls (WebGL: no coplanar faces; the ink rim hides it)
        e = 0.015
        for nm, (x0, x1, y0, y1) in (("gL", (-40, -PW / 2 - e, -40, 60)), ("gR", (PW / 2 + e, 40, -40, 60)),
                                     ("gF", (-PW / 2 - e, PW / 2 + e, -40, -PL / 2 - e)), ("gB", (-PW / 2 - e, PW / 2 + e, PL / 2 + e, 60))):
            o = box(nm, ((x0 + x1) / 2, (y0 + y1) / 2, -0.03), (x1 - x0, y1 - y0, 0.06), gm, ink=False); tiled(o, 3.0)
        pit = mat("pitM", "#ffffff", tex("gy_pit"))
        # walls end 1-1.5 cm short of the ground top and of each other's faces (WebGL: no coplanar faces)
        for nm, c, s in (("pwL", (-PW / 2 - 0.05, 0, -PD / 2 - 0.0075), (0.1, PL + 0.18, PD - 0.015)), ("pwR", (PW / 2 + 0.05, 0, -PD / 2 - 0.0075), (0.1, PL + 0.18, PD - 0.015)),
                         ("pwF", (0, -PL / 2 - 0.05, -PD / 2 - 0.0075), (PW + 0.18, 0.1, PD - 0.015)), ("pwB", (0, PL / 2 + 0.05, -PD / 2 - 0.0075), (PW + 0.18, 0.1, PD - 0.015))):
            o = box(nm, c, s, pit, ink=False); tiled(o, 1.4)
        box("pitFloor", (0, 0, -PD - 0.03), (PW, PL, 0.06), mat("pitFloorM", "#8a4a2a", tex("gy_pit")), ink=False)
        # ink rim of the hole
        rim = mat("INKrim", "#120a10")
        for nm, c, s in (("rL", (-PW / 2, 0, 0.0), (0.03, PL, 0.02)), ("rR", (PW / 2, 0, 0.0), (0.03, PL, 0.02)),
                         ("rF", (0, -PL / 2, 0.0), (PW + 0.05, 0.03, 0.02)), ("rB", (0, PL / 2, 0.0), (PW + 0.05, 0.03, 0.02))):
            box(nm, c, s, rim, ink=False)
        # coffin + leaning lid (lilac lining)
        out["coffin"] = coffin("coffin", (0.05, 0.0, -PD + 0.015), yaw=90, open_=True)   # its floor 1.5 cm above the pit floor
        lidw = mat("coffinWood", "#c49a52", tex("coffin_wood"))
        lid = box("lid", (-PW / 2 + 0.14, 0, -PD + 0.34), (0.05, 1.9, 0.62), lidw); lid.rotation_euler.y = math.radians(-14)
        lin = box("lidLining", (-PW / 2 + 0.17, 0, -PD + 0.34), (0.02, 1.8, 0.54), mat("liningM2", "#d9c7ea")); lin.rotation_euler.y = math.radians(-14)
        # dirt pile (faceted)
        dm = mat("dirtM", "#ffffff", tex("gy_pit"))
        pile = ico("dirtPile", (-1.2, -0.7, -0.1), (0.62, 1.2, 0.62), dm, sub=2)
        out["pile"] = pile
        sp = sets.asset("rusted_spade_01", (-1.25, -1.2, 0.0), yaw=30, height=1.1)
        sp.rotation_euler = (math.radians(-28), math.radians(10), math.radians(30)); sp.location.z = 0.35
    else:
        o = box("ground", (0, 10, -0.03), (80, 100, 0.06), gm, ink=False); tiled(o, 3.0)
        snowm = mat("moundM", "#ffffff", tex("gy_snow"))
        mound = ico("mound", (0.0, 0.0, -0.12), (0.95, 1.55, 0.42), snowm, sub=3, smooth=False)
        out["mound"] = mound
    bell_post(state, out)
    # candy cord: bell lever -> post ring -> down the post -> into the grave (to the husband's hand)
    PX, PY = G["PX"], G["PY"]
    top = out["lever_tip"]
    ring = (PX + 0.07, G["RING_Y"], 1.95)
    if state == "dusk":
        pts = [tuple(top), ring, (PX + 0.07, G["RING_Y"], 0.05), (-0.3, PL / 2 - 0.03, 0.02), (-0.44, 0.7, -0.4), (-0.42, 0.35, -0.95), (-0.1, 0.05, -PD + 0.1)]
    else:
        pts = [tuple(top), ring, (PX + 0.07, G["RING_Y"], 0.0)]
    out["cord"] = cord_path(pts)
    out["cord_pts"] = pts
    add_mesh("sphere", "ringKnot", ring, (0.025,) * 3, material=mat("ringM", "#c9a040"), segments=10, ring_count=6)
    # headstones / crosses
    snow = state != "dusk"; sc = p["stone"]
    for i, (x, y, w, h, yaw) in enumerate(((-2.6, 2.4, 0.5, 0.65, 8), (2.3, 3.2, 0.55, 0.7, -6), (3.6, 1.2, 0.45, 0.55, 12), (-3.9, 4.4, 0.5, 0.6, -10),
                                           (0.9, 4.2, 0.42, 0.55, 4), (-1.6, 4.6, 0.4, 0.5, 0), (4.6, 4.0, 0.5, 0.62, -4), (-5.0, 2.0, 0.5, 0.6, 6))):
        headstone(f"stone{i}", (x, y), w, h, yaw, snow, sc)
    for i, (x, y) in enumerate(((-2.1, 3.6), (1.6, 2.2), (3.0, 4.8), (-4.4, 3.2))):
        cross(f"cross{i}", (x, y), 0.85, snow)
    fence(state, G["FENCE_Y"])
    # houses
    out.update(aframe(state, G["HOUSE"], w=5.0, d=4.6, h=2.4, ridge=6.2))
    wh = aframe(state, G["WIFE_HOUSE"], siding="siding_purple", w=4.6, d=4.4, h=2.6, ridge=4.4, chimney=True, name="wifeHouse")
    out["chimney_top"] = wh["chimney_top"]
    kenney_house(state, "h", (9.5, 18.0, 0), 180, 4.6, "#c44a4a", "#5a3a3a", "redHouse")
    kenney_house(state, "a", (-12.5, 19.0, 0), 180, 4.6, "#efd2a8", "#7a4a3a", "creamHouse")
    kenney_house(state, "m", (17.0, 22.0, 0), 200, 4.6, "#7ab0d0", "#6a3a3a", "blueHouse")
    hills(state); forest(state)
    return out


def bluebird(name, loc, yaw=0):
    blue = mat("birdBlue", "#2f5fd0"); belly = mat("birdBelly", "#f0a060"); beak = mat("birdBeak", "#f2b640")
    root = bpy.data.objects.new(name, None); bpy.context.scene.collection.objects.link(root)
    parts = [add_mesh("sphere", name + "_b", (0, 0, 0.06), (0.085, 0.055, 0.055), material=blue, segments=16, ring_count=10),
             add_mesh("sphere", name + "_h", (0.07, 0, 0.11), (0.042,) * 3, material=blue, segments=14, ring_count=8),
             add_mesh("sphere", name + "_y", (0.035, 0, 0.045), (0.05, 0.045, 0.035), material=belly, segments=12, ring_count=8, ink=False),
             add_mesh("cone", name + "_k", (0.12, 0, 0.11), (0.014, 0.014, 0.025), (0, 90, 0), beak, vertices=8),
             add_mesh("cube", name + "_t", (-0.1, 0, 0.09), (0.05, 0.02, 0.008), (0, -25, 0), blue),
             add_mesh("sphere", name + "_e", (0.09, -0.035, 0.125), (0.009,) * 3, material=mat("birdEye", "#101010"), ink=False, segments=8, ring_count=6)]
    for o in parts: o.parent = root
    root.location = loc; root.rotation_euler.z = math.radians(yaw)
    return root
