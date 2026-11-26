"""Shared set helpers + one worked set (the parlour). Each build_<set>(state) makes one location in the current scene
and returns a dict of named anchors/objects the shots use. Z up, camera usually on -Y looking +Y. Poly Haven assets
come from blender/assets/<id>.blend (get_assets.py), Kenney GLBs from stickman.json "kenney_dir", the rest is built here.
New sets go in their own sets_<name>.py files that import this one.
"""
import bpy, math
from pathlib import Path
from mathutils import Vector
import lib
from lib import mat, box, add_mesh, rgb, light, emissive

TEX = lib.HERE / "tex"
KENNEY = Path(lib.CFG.get("kenney_dir") or ".")   # Kenney CC0 kits root: city-kit-suburban/, food-kit/, furniture-kit/ ...


def asset(aid, loc=(0, 0, 0), yaw=0.0, height=None, ink=True, sat=1.15, part=None):
    """append blender/assets/<aid>.blend and return ONE root object for the whole asset (cars: body + wheels).
    Multi-object assets get an empty root '<aid>' that every top-level object is parented to (libraries.load returns
    objects in no useful order, so never trust objs[0]). part='name' keeps only that object (and its children),
    e.g. asset('hero_tree_states', part='hero_stump'). height scales the whole asset to that world height."""
    objs = lib.append_blend(lib.ASSETS / f"{aid}.blend")
    if part:
        keep = {o for o in objs if o.name == part or o.name.startswith(part + ".")}
        keep |= {c for o in list(keep) for c in o.children_recursive}
        for o in objs:
            if o not in keep: bpy.data.objects.remove(o, do_unlink=True)
        objs = [o for o in objs if o in keep]
        if not objs: raise KeyError(f"{aid}.blend has no object named {part}")
    tops = [o for o in objs if o.parent is None or o.parent not in objs]
    if len(tops) == 1:
        root = tops[0]
    else:
        root = bpy.data.objects.new(aid, None); bpy.context.scene.collection.objects.link(root)
        for o in tops:
            mw = o.matrix_world.copy(); o.parent = root; o.matrix_world = mw
    bpy.context.view_layer.update()
    meshes = [o for o in objs if o.type == "MESH"]
    if height and meshes:
        zs = [(o.matrix_world @ Vector(c)).z for o in meshes for c in o.bound_box]
        k = height / max(max(zs) - min(zs), 1e-4); root.scale = tuple(x * k for x in root.scale)
    root.location = loc; root.rotation_euler.z = math.radians(yaw)
    if ink: lib.toonify(meshes, sat=sat)
    return root


def tex(name): return TEX / f"{name}.png"


def plane(name, w, h, material, loc, rot=(90, 0, 0), ink=False):
    o = add_mesh("plane", name, loc, (w / 2, h / 2, 1), rot, material, ink)
    return o


def image_mat(name, png, emit=0.0, alpha=False, col="#ffffff"):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial"); ti = nt.nodes.new("ShaderNodeTexImage"); ti.image = bpy.data.images.load(str(png), check_existing=True)
    p = nt.nodes.new("ShaderNodeBsdfPrincipled"); p.inputs["Roughness"].default_value = 0.9
    lib._set_in(p, "Specular IOR Level", 0.1)
    nt.links.new(ti.outputs[0], p.inputs["Base Color"])
    if emit:
        nt.links.new(ti.outputs[0], p.inputs["Emission Color"]); p.inputs["Emission Strength"].default_value = emit
    if alpha:
        nt.links.new(ti.outputs["Alpha"], p.inputs["Alpha"])
        try: m.surface_render_method = "DITHERED"
        except Exception: pass
    nt.links.new(p.outputs[0], out.inputs["Surface"])
    return m


def pbr_mat(name, tid, tint="#ffffff", normal=1.0, rough=1.0, spec=0.35):
    """a Poly Haven PBR texture set (get_assets.py tex:<tid> -> blender/tex/ph/<tid>_diff/_nor/_rough.jpg) on a Principled
    BSDF: colour (x tint, glTF keeps image x constant), roughness map (x rough), OpenGL normal map (strength normal).
    All three survive the glTF export; the three.js toon material reads the normal map and a roughness-driven highlight
    (engine/mat/materials TOON_SPEC). UVs: tiled(o, unit) / B(..., unit) for boxes, so wood and plaster keep real size."""
    d = TEX / "ph"
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial"); p = nt.nodes.new("ShaderNodeBsdfPrincipled")
    lib._set_in(p, "Specular IOR Level", spec)
    def img(k, data):
        ti = nt.nodes.new("ShaderNodeTexImage"); ti.image = bpy.data.images.load(str(d / f"{tid}_{k}.jpg"), check_existing=True)
        if data: ti.image.colorspace_settings.name = "Non-Color"
        return ti
    tc = img("diff", False)
    if tint.lower() != "#ffffff":
        mx = nt.nodes.new("ShaderNodeMix"); mx.data_type = "RGBA"; mx.blend_type = "MULTIPLY"; mx.inputs[0].default_value = 1.0
        mx.inputs[6].default_value = rgb(tint); nt.links.new(tc.outputs[0], mx.inputs[7]); nt.links.new(mx.outputs[2], p.inputs["Base Color"])
    else:
        nt.links.new(tc.outputs[0], p.inputs["Base Color"])
    tr = img("rough", True)
    if rough != 1.0:
        mm = nt.nodes.new("ShaderNodeMath"); mm.operation = "MULTIPLY"; mm.inputs[1].default_value = rough
        nt.links.new(tr.outputs[0], mm.inputs[0]); nt.links.new(mm.outputs[0], p.inputs["Roughness"])
    else:
        nt.links.new(tr.outputs[0], p.inputs["Roughness"])
    tn = img("nor", True); nm = nt.nodes.new("ShaderNodeNormalMap"); nm.inputs["Strength"].default_value = normal
    nt.links.new(tn.outputs[0], nm.inputs["Color"]); nt.links.new(nm.outputs[0], p.inputs["Normal"])
    nt.links.new(p.outputs[0], out.inputs["Surface"])
    return m


def tiled(o, unit=1.0):
    """world-size UVs (1 texture repeat per `unit` metres) for boxes/planes."""
    lib_uv_box(o, unit)


def lib_uv_box(o, unit):
    me = o.data
    if not me.uv_layers: me.uv_layers.new()
    uv = me.uv_layers.active.data
    mw = o.matrix_world
    for poly in me.polygons:
        n = poly.normal; ax = max(range(3), key=lambda i: abs(n[i]))
        for li in poly.loop_indices:
            v = mw @ me.vertices[me.loops[li].vertex_index].co
            a, b = [(v.y, v.z), (v.x, v.z), (v.x, v.y)][ax]
            uv[li].uv = (a / unit, b / unit)


# =================================================================== PARLOUR
# layout (Blender coords): back wall y = +2.4, window x = -0.9, door x = 1.85, chair at (-0.75, 0.6)
# WebGL rules (export WARNs): parts that touch are offset >= 1 cm (trims 1 cm proud of what they cross, wainscot sunk
# 2 cm and the side wainscot 3.5 cm into the floor so no bottom faces share a plane), open shells get a SOLIDIFY wall,
# the moonbeam is a three.js light shaft (o["beam"]), not a Blender shader
P = dict(WALL=2.4, WIN_X=-0.9, DOOR_X=1.85, CHAIR=(-0.75, 0.6, 0.0), BELL=(0.62, 2.34, 1.78), SHOVEL=(1.12, 2.18, 0.0))
RUG_TOP = 0.011


def wall(o, t=0.012):
    """a SOLIDIFY wall (before the ink hull) for an open one-sided shell: WebGL culls back faces, so without it the
    inside of a bell, an open barrel or a frame's back is see-through"""
    th = o.modifiers.new("wall", "SOLIDIFY"); th.thickness = t; th.offset = 1.0
    o.modifiers.move(len(o.modifiers) - 1, 0)
    return o


def build_parlour(state="night"):
    W = P["WALL"]; out = {}
    wallm = mat("wallpaper", "#ffffff", tex("wallpaper"))
    wain = mat("wainscot", "#6a3626", tex("planks"))
    floor = box("floor", (0, 0.6, -0.025), (7, 6, 0.05), mat("floorM", "#ffffff", tex("planks"))); tiled(floor, 2.0)
    # back wall with window + door holes, built from boxes
    segs = [(-3.2, P["WIN_X"] - 0.6, 0, 3.0), (P["WIN_X"] + 0.6, P["DOOR_X"] - 0.55, 0, 3.0), (P["DOOR_X"] + 0.55, 3.2, 0, 3.0),
            (P["WIN_X"] - 0.6, P["WIN_X"] + 0.6, 0, 0.85), (P["WIN_X"] - 0.6, P["WIN_X"] + 0.6, 2.45, 3.0), (P["DOOR_X"] - 0.55, P["DOOR_X"] + 0.55, 2.25, 3.0)]
    for i, (x0, x1, z0, z1) in enumerate(segs):
        o = box(f"wall{i}", ((x0 + x1) / 2, W + 0.05, (z0 + z1) / 2), (x1 - x0, 0.1, z1 - z0), wallm, ink=False); tiled(o, 0.9)
        if z0 < 1.0:
            wz = min(1.0, z1); o2 = box(f"wain{i}", ((x0 + x1) / 2, W - 0.02, (wz - 0.02) / 2), (x1 - x0, 0.05, wz + 0.02), wain); tiled(o2, 0.5)
    for sx in (-3.2, 3.2):
        o = box(f"side{sx}", (sx, 0.6, 1.5), (0.1, 6, 3), wallm, ink=False); tiled(o, 0.9)
        o2 = box(f"sidewain{sx}", (sx - 0.04 * (1 if sx > 0 else -1), 0.02, 0.4825), (0.05, 4.8, 1.035), wain); tiled(o2, 0.5)
    box("rail", (0, W - 0.06, 1.02), (6.32, 0.08, 0.08), mat("railM", "#3e1d16"))
    box("cornice", (0, W - 0.06, 2.9), (6.4, 0.12, 0.2), mat("corniceM", "#4a2a5e"))
    box("ceiling", (0, 0.6, 3.05), (7, 6, 0.1), mat("ceilM", "#3b2f6e"), ink=False)
    # window: view card behind, sash bars, dotted frame, lace
    view = plane("view", 1.4, 1.8, image_mat("viewM", tex("win_night" if state != "day" else "win_day"), emit=1.6 if state != "day" else 1.2), (P["WIN_X"], W + 0.35, 1.65))
    out["view"] = view
    frm = mat("frameM", "#6b5873")
    box("winTop", (P["WIN_X"], W - 0.045, 2.51), (1.42, 0.13, 0.14), frm); box("winSill", (P["WIN_X"], W - 0.085, 0.82), (1.5, 0.15, 0.1), frm)
    box("winL", (P["WIN_X"] - 0.66, W - 0.045, 1.66), (0.14, 0.13, 1.75), frm); box("winR", (P["WIN_X"] + 0.66, W - 0.045, 1.66), (0.14, 0.13, 1.75), frm)
    sash = mat("sashM", "#efe8f4"); box("sashH", (P["WIN_X"], W + 0.02, 1.65), (1.2, 0.05, 0.05), sash); box("sashV", (P["WIN_X"], W + 0.02, 1.65), (0.05, 0.07, 1.6), sash)
    dots = emissive("dotM", "#f2ecff", 1.5)
    for i in range(12):
        add_mesh("sphere", f"dot{i}", (P["WIN_X"] - 0.66 + (i % 2) * 1.32, W - 0.11, 0.95 + (i // 2) * 0.28), (0.02,) * 3, material=dots, ink=False, segments=8, ring_count=6)
    lace = mat("laceM", "#f4f2ff", alpha=0.45, emit=0.6)
    try: lace.surface_render_method = "BLENDED"
    except Exception: pass
    for s in (-1, 1):
        me = bpy.data.meshes.new("lace"); x0 = P["WIN_X"]
        me.from_pydata([(x0 + s * 0.6, W - 0.03, 2.42), (x0 + s * 0.05, W - 0.03, 2.42), (x0 + s * 0.6, W - 0.03, 1.0)], [], [(0, 1, 2)])
        o = bpy.data.objects.new(f"lace{s}", me); bpy.context.scene.collection.objects.link(o); me.materials.append(lace)
    # door + tally strip
    dm = mat("doorM", "#4a2820", tex("planks"))
    box("door", (P["DOOR_X"], W + 0.02, 1.1), (1.0, 0.08, 2.2), dm)
    for x, z, w, h in ((0, 0.55, 0.7, 0.75), (-0.18, 1.55, 0.26, 0.6), (0.18, 1.55, 0.26, 0.6)):
        box("dpanel", (P["DOOR_X"] + x, W - 0.03, z), (w, 0.03, h), mat("dpM", "#2c1612"))
    plane("doorPane", 0.36, 0.42, emissive("paneM", "#c8d2ff", 1.4), (P["DOOR_X"], W - 0.06, 1.62))
    jm = mat("jambM", "#2e1712")
    box("jambL", (P["DOOR_X"] - 0.56, W - 0.06, 1.15), (0.12, 0.1, 2.3), jm); box("jambR", (P["DOOR_X"] + 0.56, W - 0.06, 1.15), (0.12, 0.1, 2.3), jm)
    box("jambT", (P["DOOR_X"], W - 0.0575, 2.3), (1.22, 0.125, 0.12), jm)   # 1 cm proud of the jambs, ends 1 cm inside them
    plane("tally", 0.42, 1.68, image_mat("tallyM", tex("tally"), emit=0.8, alpha=True), (P["DOOR_X"] - 0.83, W - 0.015, 1.35))
    # practice bell + candy pull + dig note
    bell = bell_mesh("pbell", 0.11); bell.location = (P["BELL"][0], P["BELL"][1] - 0.12, P["BELL"][2] - 0.18); wall(bell)
    box("bellArm", (P["BELL"][0], P["BELL"][1] - 0.06, P["BELL"][2] + 0.02), (0.05, 0.16, 0.05), mat("armM", "#3a2a20"))
    candy_cord("pull", (P["BELL"][0] - 0.02, P["BELL"][1] - 0.12, P["BELL"][2] - 0.25), (P["BELL"][0] - 0.02, P["BELL"][1] - 0.12, P["BELL"][2] - 1.0), 0.012)
    plane("note", 0.36, 0.27, image_mat("noteM", tex("dig_note"), emit=0.5), (P["BELL"][0] - 0.2, W - 0.012, P["BELL"][2] - 0.6))
    out["bell"] = bell
    # assets: rocking chair, round table + tea set, stove, spade (shovel), portraits
    ch = asset("Rockingchair_01", (P["CHAIR"][0], P["CHAIR"][1], RUG_TOP), yaw=15, height=1.0); out["chair"] = ch   # on the rug
    asset("coffee_table_round_01", (-1.95, 0.75, 0), height=0.7)
    asset("tea_set_01", (-1.95, 0.72, 0.7), height=0.16)
    wall(asset("barrel_stove", (-2.6, 1.7, 0), yaw=90, height=1.0), 0.01)   # open top and bottom
    stovefire = plane("fire", 0.22, 0.14, emissive("fireM", "#ff7a2a", 6.0), (-2.45, 1.45, 0.45), rot=(90, 0, 0))
    sp = asset("rusted_spade_01", P["SHOVEL"], yaw=0, height=1.25); sp.rotation_euler = (math.radians(-10), math.radians(8), 0); out["shovel"] = sp
    for i, (x, z, hgt) in enumerate(((-2.25, 2.05, 0.4), (0.18, 2.15, 0.35))):
        # hung flush: the frame's open back sits ~1 cm off the wall (export sees the hole covered by the wall)
        pf = asset("fancy_picture_frame_01", (x, W - 0.015, z), height=hgt); pf.rotation_euler = (math.radians(90), 0, 0)
    # the rug is 1.2 cm thick: its top and bottom stay >= 1 cm from the floor top and the chair's rockers
    rugo = add_mesh("cyl", "rug", (P["CHAIR"][0] + 0.1, P["CHAIR"][1], RUG_TOP - 0.006), (1.25, 1.25, 0.006), material=image_mat("rugM", tex("rug")), ink=False, vertices=64)
    out["rug"] = rugo
    # day-only coffin on saw-horses (clear of the tea table by >= 1 cm)
    if state == "day":
        out["coffin"] = coffin("coffin", (-0.33, 1.05, 0.65), yaw=4, open_=True)   # on the horse tops
        hm = mat("horseM", "#6a4a2a")
        for s in (-0.7, 0.7):
            for t in (-1, 1):
                leg = box("horse", (-0.33 + s, 1.05 + t * 0.16, 0.31), (0.05, 0.05, 0.66), hm); leg.rotation_euler.x = math.radians(t * 18)
            box("horseTop", (-0.33 + s, 1.05, 0.62), (0.08, 0.5, 0.06), hm)
    return out


def light_beam(name, a, b, width=0.45, col="#c9d4ff", strength=1.2):
    """soft additive light shaft from a to b (reads like the reference's moon beam). The Blender material (emission x
    gradient alpha) is for Blender renders only: glTF cannot carry a Mix/Transparent shader (it arrives as an opaque
    emissive slab), so the object is tagged o["beam"] and world/set.ts draws it as an additive, unlit, ink-free shaft
    with the same across-the-width falloff (beam_color, beam_strength; u across the width, v along a -> b)."""
    a, b = Vector(a), Vector(b); d = b - a; L = d.length
    bpy.ops.mesh.primitive_plane_add(size=1); o = bpy.context.active_object; o.name = name
    o.scale = (width, L, 1); bpy.ops.object.transform_apply(scale=True)
    o.location = (a + b) / 2; o.rotation_euler = d.to_track_quat("Y", "Z").to_euler()
    m = bpy.data.materials.new(name + "M"); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial"); em = nt.nodes.new("ShaderNodeEmission"); em.inputs[0].default_value = rgb(col); em.inputs[1].default_value = strength
    tr = nt.nodes.new("ShaderNodeBsdfTransparent"); mx = nt.nodes.new("ShaderNodeMixShader"); add = nt.nodes.new("ShaderNodeAddShader")
    tc = nt.nodes.new("ShaderNodeTexCoord"); sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    gx = nt.nodes.new("ShaderNodeMath"); gx.operation = "PINGPONG"; gx.inputs[1].default_value = 0.5
    sx = nt.nodes.new("ShaderNodeMath"); sx.operation = "MULTIPLY"; sx.inputs[1].default_value = 2.0
    cx = nt.nodes.new("ShaderNodeMath"); cx.operation = "POWER"; cx.inputs[1].default_value = 2.0
    nt.links.new(tc.outputs["UV"], sep.inputs[0]); nt.links.new(sep.outputs[0], gx.inputs[0]); nt.links.new(gx.outputs[0], sx.inputs[0]); nt.links.new(sx.outputs[0], cx.inputs[0])
    fy = nt.nodes.new("ShaderNodeMath"); fy.operation = "MULTIPLY"; nt.links.new(cx.outputs[0], fy.inputs[0]); fy.inputs[1].default_value = 0.6
    nt.links.new(fy.outputs[0], mx.inputs[0]); nt.links.new(tr.outputs[0], mx.inputs[1]); nt.links.new(em.outputs[0], add.inputs[0]); nt.links.new(tr.outputs[0], add.inputs[1])
    nt.links.new(add.outputs[0], mx.inputs[2]); nt.links.new(mx.outputs[0], out.inputs["Surface"])
    try: m.surface_render_method = "BLENDED"
    except Exception: pass
    o.data.materials.append(m); o.visible_shadow = False; o["no_ink"] = 1; o["no_ground"] = 1
    o["beam"] = 1; o["beam_color"] = col; o["beam_strength"] = float(strength)
    return o


def parlour_lights(state):
    W = P["WALL"]
    if state == "day":
        lib.world("#fff3d8", 0.9, haze=0.0)
        light("SUN", "sun", (0, 0, 6), "#fff0d0", 3.5, size=0.3, rot=(50, 0, -150))
        light("AREA", "winfill", (P["WIN_X"], W - 0.3, 1.7), "#dff0ff", 120, size=1.4, target=(P["WIN_X"], 0, 1.0))
    else:
        night = state == "night"
        lib.world("#3a3a8a" if night else "#d9a0b6", 0.55 if night else 0.8, haze=0.04, haze_col="#a9b0ff" if night else "#ffc0c8")
        light("SPOT", "moon", (P["WIN_X"] + 0.1, W + 0.6, 2.4), "#c9d4ff" if night else "#ffc0a0", 2200 if night else 1600, size=0.08, target=(P["CHAIR"][0], P["CHAIR"][1], 1.0), spot=(26, 0.25))
        C = P["CHAIR"]
        light_beam("moonbeam", (P["WIN_X"] + 0.15, W - 0.1, 2.1), (C[0] - 0.1, C[1] - 1.2, 0.9), 0.5, "#c9d4ff" if night else "#ffc6a8", 1.6)
        light("AREA", "skyfill", (0, -1.5, 2.8), "#8b88ff" if night else "#ffb0b8", 150, size=4.0, target=(0, 1.5, 1.0))
        light("POINT", "stove", (-2.35, 1.3, 0.6), "#ff8a40", 160, size=0.2)
        light("SPOT", "doorglow", (P["DOOR_X"] - 0.6, W - 1.6, 1.9), "#b8c4ff", 260, size=0.3, target=(P["SHOVEL"][0], P["SHOVEL"][1], 0.6), spot=(35, 0.5))
        light("POINT", "lamp", (-1.9, 0.6, 1.2), "#ffae66", 40, size=0.1)


# =================================================================== shared props
def bell_mesh(name, r=0.12, col="#c98a2e"):
    prof = [(0.0, 0.0), (0.18, 0.02), (0.55, 0.12), (0.7, 0.45), (0.82, 0.78), (1.0, 0.98), (1.0, 1.0)]
    me = bpy.data.meshes.new(name); verts = []; faces = []; N = 28
    for i, (rr, z) in enumerate(prof):
        for k in range(N):
            a = 2 * math.pi * k / N; verts.append((rr * r * math.cos(a), rr * r * math.sin(a), (1 - z) * r * 1.6))
    for i in range(len(prof) - 1):
        for k in range(N):
            a, b = i * N + k, i * N + (k + 1) % N; faces.append((a, b, b + N, a + N))
    me.from_pydata(verts, [], faces); me.update()
    o = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(o)
    for p in me.polygons: p.use_smooth = True
    me.materials.append(mat(name + "M", col, rough=0.45, emit=0.15, emit_col="#5a3000"))
    lib.outline(o, 0.008)
    return o


def candy_cord(name, a, b, r=0.012, stripes=10):
    a, b = Vector(a), Vector(b); d = b - a; L = d.length
    red, white = mat("cordR", "#d8333a"), mat("cordW", "#f4f1ec")
    objs = []
    for i in range(stripes):
        c = a + d * ((i + 0.5) / stripes)
        bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=L / stripes, location=c, vertices=10)
        o = bpy.context.active_object; o.name = f"{name}{i}"
        o.rotation_euler = d.to_track_quat("Z", "Y").to_euler(); o.data.materials.append(red if i % 2 else white); objs.append(o)
    return objs


def coffin(name, loc, yaw=0, open_=True, lining="#d9c7ea"):
    """a 6-sided coffin box (top open) with lilac lining, origin at its floor centre."""
    root = bpy.data.objects.new(name, None); bpy.context.scene.collection.objects.link(root)
    wood = mat("coffinWood", "#c49a52", tex("coffin_wood"))
    outline_pts = [(-0.95, -0.24), (0.55, -0.32), (0.95, -0.22), (0.95, 0.22), (0.55, 0.32), (-0.95, 0.24)]
    bm_pts = [Vector((x, y, 0)) for x, y in outline_pts]
    lift = Vector((0, 0, 0.02))   # the lining floor sits 2 cm up inside the walls (not in the plane of what it stands on)
    # floor
    me = bpy.data.meshes.new(name + "_floor"); me.from_pydata([tuple(p + lift) for p in bm_pts], [], [tuple(range(len(bm_pts)))])
    fl = bpy.data.objects.new(name + "_floor", me); bpy.context.scene.collection.objects.link(fl); fl.parent = root; me.materials.append(mat("liningM", lining))
    # walls
    for i in range(len(bm_pts)):
        p0, p1 = bm_pts[i], bm_pts[(i + 1) % len(bm_pts)]
        c = (p0 + p1) / 2; L = (p1 - p0).length
        o = box(f"{name}_w{i}", (c.x, c.y, 0.18), (L, 0.05, 0.36), wood); o.rotation_euler.z = math.atan2(p1.y - p0.y, p1.x - p0.x); o.parent = root
        o.location = (c.x, c.y, 0.18)
    root.location = loc; root.rotation_euler.z = math.radians(yaw)
    return root
