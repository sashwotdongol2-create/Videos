"""Section 1 sets: a ruined Berlin street (April 1945) that ends at a broken rubble wall, and behind it the Reich
Chancellery garden with a tree, a pink-grey Chancellery wing and the concrete bunker entrance block (heavy steel door,
dark entrance shaft).  All geometry built here; textures from tex_sec1.py (blender/tex/s1_*.png).

Layout (Blender, Z up, metres):
  street   x in [-4.2, 4.2], y from -16 to 6.2   (ruined facades at x = -/+4.2, facing the street)
  rubble wall across the street end at y = 6.2 .. 6.8, x in [-9, 13]
  garden   y from 6.8 to 21, x in [-8, 13]; Chancellery wing across the back at y = 21
  bunker block x 3.0 .. 7.5, y 9.5 .. 15.5, door in its -X face centred on y = 12.5 (opening 1.1 x 2.15)
  entrance shaft x 3.3 .. 7.2, y 11.75 .. 13.25 (floor z = 0), fades to black within 0.6 m of the door
"""
import bpy, math, random
from mathutils import Vector, Matrix
import lib
from lib import mat, rgb, light, emissive

TEX = lib.HERE / "tex"
def tex(n): return TEX / f"{n}.png"

# bunker entrance built in its own local frame (door centre at the origin, door facing local -X, shaft along local +X),
# then placed by a pivot: BUNKER = world position of the door centre, yaw 90 -> the door faces the garden (-Y), the
# shaft runs to +Y.
S1 = dict(DOOR_Y=0.0, DOOR_X=0.0, WALL_T=0.3, DOOR_W=1.1, DOOR_H=2.15, SHAFT_HW=0.75, SHAFT_H=2.3,
          HINGE=(0.125, -0.5), LEAF_W=1.05, BUNKER=(3.0, 14.0), HITLER=(2.3, 13.35), RUBBLE_Y=6.2)


# ------------------------------------------------------------------ mesh builder (planar world-size UVs)
class MB:
    def __init__(self, name):
        self.name, self.v, self.f, self.mi, self.uv, self.mats = name, [], [], [], [], []

    def m(self, material):
        if material not in self.mats: self.mats.append(material)
        return self.mats.index(material)

    def poly(self, pts, material, unit=1.0):
        pts = [Vector(p) for p in pts]
        n = (pts[1] - pts[0]).cross(pts[2] - pts[0])
        ax = max(range(3), key=lambda i: abs(n[i])) if n.length > 1e-9 else 2
        i0 = len(self.v); self.v += [tuple(p) for p in pts]
        self.f.append(tuple(range(i0, i0 + len(pts)))); self.mi.append(self.m(material))
        self.uv.append([(a / unit, b / unit) for a, b in [((p.y, p.z), (p.x, p.z), (p.x, p.y))[ax] for p in pts]])

    def box(self, c, s, material, unit=1.0, rot=None, bottom=False):
        hx, hy, hz = s[0] / 2, s[1] / 2, s[2] / 2
        R = rot if rot is not None else Matrix.Identity(3); C = Vector(c)
        P = lambda x, y, z: C + R @ Vector((x * hx, y * hy, z * hz))
        faces = [((-1, -1, 1), (1, -1, 1), (1, 1, 1), (-1, 1, 1)), ((-1, -1, -1), (1, -1, -1), (1, -1, 1), (-1, -1, 1)),
                 ((1, 1, -1), (-1, 1, -1), (-1, 1, 1), (1, 1, 1)), ((-1, 1, -1), (-1, -1, -1), (-1, -1, 1), (-1, 1, 1)),
                 ((1, -1, -1), (1, 1, -1), (1, 1, 1), (1, -1, 1))]
        if bottom: faces.append(((-1, 1, -1), (1, 1, -1), (1, -1, -1), (-1, -1, -1)))
        for fc in faces: self.poly([P(*q) for q in fc], material, unit)

    def prism(self, pts2, axis_pt, u, w, t, material, unit=1.0):
        """extrude a 2D outline (in the plane spanned by u (horizontal) and up) by thickness t along w."""
        u, w = Vector(u), Vector(w); up = Vector((0, 0, 1)); o = Vector(axis_pt)
        A = [o + u * a + up * b for a, b in pts2]; B = [p + w * t for p in A]
        self.poly(A, material, unit); self.poly(list(reversed(B)), material, unit)
        for i in range(len(A)):
            j = (i + 1) % len(A); self.poly([A[j], A[i], B[i], B[j]], material, unit)

    def build(self, ink=0.03, recalc=True):
        me = bpy.data.meshes.new(self.name)
        me.from_pydata(self.v, [], self.f); me.update()
        for m_ in self.mats: me.materials.append(m_)
        for p, k in zip(me.polygons, self.mi): p.material_index = k
        uvl = me.uv_layers.new()
        for p, uvs in zip(me.polygons, self.uv):
            for j, li in enumerate(p.loop_indices): uvl.data[li].uv = uvs[j]
        me.validate(); me.update()
        if recalc:
            import bmesh
            bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(me); bm.free()
        o = bpy.data.objects.new(self.name, me); bpy.context.scene.collection.objects.link(o)
        if ink: lib.outline(o, ink)
        return o


def rot_z(a): return Matrix.Rotation(a, 3, "Z")


# ------------------------------------------------------------------ materials
_M = {}
def M(key):
    if key in _M: return _M[key]
    T = {"concrete": ("#ffffff", "s1_concrete"), "pa": ("#ffffff", "s1_plaster_a"), "pb": ("#ffffff", "s1_plaster_b"),
         "pc": ("#ffffff", "s1_plaster_c"), "chan": ("#ffffff", "s1_chancellery"), "brick": ("#ffffff", "s1_brick"),
         "street": ("#ffffff", "s1_street"), "grass": ("#ffffff", "s1_grass"), "sandbag": ("#ffffff", "s1_sandbag"),
         "steel": ("#ffffff", "s1_steel")}
    if key in T: m = mat("s1_" + key, T[key][0], tex(T[key][1]))
    elif key == "interior": m = mat("s1_interior", "#3a3634")
    elif key == "slab": m = mat("s1_slab", "#8a8682")
    elif key == "beam": m = mat("s1_beam", "#4a3a30")
    elif key == "winhole": m = mat("s1_winhole", "#1e1c1c", rough=1.0)
    elif key == "frame": m = mat("s1_frame", "#2a2a2c", rough=0.6)
    elif key == "trunk": m = mat("s1_trunk", "#5a4030")
    elif key == "leaf": m = mat("s1_leaf", "#4f8a4c")
    elif key == "leaf2": m = mat("s1_leaf2", "#3e7440")
    elif key == "fence": m = mat("s1_fence", "#6a4a34")
    elif key == "roof": m = mat("s1_roof", "#6a5a5a")
    elif key == "chunk": m = mat("s1_chunk", "#9a928a")
    elif key == "chunk2": m = mat("s1_chunk2", "#7a5a4a")
    elif key == "dust": m = mat("s1_dust", "#a8a094", tex("s1_street"))
    else: raise KeyError(key)
    _M[key] = m; return m


def shaft_mat():
    """the entrance shaft lining: dull concrete at the door, pure black from 0.6 m inside (world X)."""
    m = bpy.data.materials.new("s1_shaft"); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial"); p = nt.nodes.new("ShaderNodeBsdfPrincipled")
    p.inputs["Roughness"].default_value = 1.0; lib._set_in(p, "Specular IOR Level", 0.0)
    geo = nt.nodes.new("ShaderNodeTexCoord"); sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    mr = nt.nodes.new("ShaderNodeMapRange"); mr.inputs["From Min"].default_value = S1["DOOR_X"] + 0.3; mr.inputs["From Max"].default_value = S1["DOOR_X"] + 0.9
    cr = nt.nodes.new("ShaderNodeValToRGB"); el = cr.color_ramp
    el.elements[0].position = 0.0; el.elements[0].color = rgb("#3c3a38"); el.elements[1].position = 1.0; el.elements[1].color = (0, 0, 0, 1)
    nt.links.new(geo.outputs["Object"], sep.inputs[0]); nt.links.new(sep.outputs["X"], mr.inputs["Value"])
    nt.links.new(mr.outputs["Result"], cr.inputs["Fac"]); nt.links.new(cr.outputs["Color"], p.inputs["Base Color"])
    nt.links.new(p.outputs[0], out.inputs["Surface"])
    return m


def sky_dome(center=(2, 4, 0), r=90, h=60):
    """cylinder of painted overcast sky (emission, no shading) around everything + gradient world above it."""
    w = bpy.data.worlds.new("S1Sky"); bpy.context.scene.world = w
    w.use_nodes = True; nt = w.node_tree; nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputWorld"); bg = nt.nodes.new("ShaderNodeBackground")
    bg.inputs[0].default_value = rgb("#96aaba"); bg.inputs[1].default_value = 1.0
    nt.links.new(bg.outputs[0], out.inputs["Surface"])
    N = 48; verts, faces, uvs = [], [], []
    for i in range(N + 1):
        a = 2 * math.pi * i / N
        verts += [(center[0] + r * math.cos(a), center[1] + r * math.sin(a), -2), (center[0] + r * math.cos(a), center[1] + r * math.sin(a), h)]
    for i in range(N):
        faces.append((2 * i, 2 * i + 1, 2 * i + 3, 2 * i + 2))
    me = bpy.data.meshes.new("s1_sky"); me.from_pydata(verts, [], faces); me.update()
    uvl = me.uv_layers.new()
    for p, (i) in zip(me.polygons, range(N)):
        u0, u1 = (i / N) * 3, ((i + 1) / N) * 3
        for li, (uu, vv) in zip(p.loop_indices, ((u0, 0), (u0, 1), (u1, 1), (u1, 0))): uvl.data[li].uv = (uu, 1 - vv if False else vv)
    o = bpy.data.objects.new("s1_sky", me); bpy.context.scene.collection.objects.link(o)
    m = bpy.data.materials.new("s1_skyM"); m.use_nodes = True; t = m.node_tree; t.nodes.clear()
    o_ = t.nodes.new("ShaderNodeOutputMaterial"); e = t.nodes.new("ShaderNodeEmission"); ti = t.nodes.new("ShaderNodeTexImage")
    ti.image = bpy.data.images.load(str(tex("s1_sky")), check_existing=True); ti.extension = "REPEAT"
    # sky texture: v=0 bottom of image is the horizon; image rows go top->bottom, flip v
    tc = t.nodes.new("ShaderNodeTexCoord"); mp = t.nodes.new("ShaderNodeMapping"); mp.inputs["Scale"].default_value = (1, 1.0, 1)
    t.links.new(tc.outputs["UV"], mp.inputs[0]); t.links.new(mp.outputs[0], ti.inputs[0])
    t.links.new(ti.outputs[0], e.inputs[0]); e.inputs[1].default_value = 1.0; t.links.new(e.outputs[0], o_.inputs["Surface"])
    m.use_backface_culling = False
    me.materials.append(m); o.visible_shadow = False; o["no_ground"] = True
    try: o.visible_diffuse = False; o.visible_glossy = False
    except Exception: pass
    return o


# ------------------------------------------------------------------ ruins
def ruin_block(name, xf, side, y0, y1, depth, hmin, hmax, plaster, seed, ink=0.035):
    """a bombed-out multi-storey building: the street facade (x = xf, facing the street: side = -1 for the left row
    (faces +X), +1 right row) with window holes, jagged broken top, party walls, a dark back wall, broken floor slabs."""
    r = random.Random(seed); b = MB(name); P = M(plaster); T = 0.35
    s = -side                        # +1: facade normal +X
    xb = xf + side * depth           # back wall plane
    bay = 2.4; n = max(1, int(round((y1 - y0) / bay))); bay = (y1 - y0) / n
    tops = [r.uniform(hmin, hmax) for _ in range(n)]
    for k in range(n):
        ya, yb = y0 + k * bay, y0 + (k + 1) * bay; top = tops[k]
        ww = bay * 0.48; wy0, wy1 = (ya + yb) / 2 - ww / 2, (ya + yb) / 2 + ww / 2
        xc = xf + side * T / 2
        for (p0, p1) in ((ya, wy0), (wy1, yb)):                      # piers up to the bay top
            b.box((xc, (p0 + p1) / 2, top / 2), (T, p1 - p0, top), P, unit=3.0)
        wins, z = [], 0.0                                             # window column: solid between the openings
        while z + 0.9 < top - 0.4:
            wins.append((z + 0.9 if z > 0 else 0.0, min(z + 2.5, top - 0.3))); z += 3.2
        zc = 0.0
        for w0, w1 in wins + [(top, top)]:
            if w0 - zc > 0.02: b.box((xc, (wy0 + wy1) / 2, (zc + w0) / 2), (T, ww, w0 - zc), P, unit=3.0)
            zc = w1
        for zf in [3.2 * k for k in range(1, 6) if 3.2 * k < top - 0.5]:
            if r.random() < 0.75:                                     # broken floor slabs inside
                L = r.uniform(0.6, 1.0) * depth
                b.box((xf + side * (T + L / 2), (ya + yb) / 2, zf - 0.1), (L, bay - 0.05, 0.2), M("slab"), unit=2.0, bottom=True)
        # jagged broken top: a shard on top of each pier
        for (p0, p1) in ((ya, wy0), (wy1, yb)):
            hgt = r.uniform(0.4, 1.8); apex = r.uniform(0.2, 0.8)
            u = Vector((0, 1, 0)); w = Vector((side, 0, 0))
            b.prism([(p0, top), (p1, top), (p0 + (p1 - p0) * apex, top + hgt)], (xf, 0, 0), u, w, T, P, unit=3.0)
        # dark interior behind the window holes (back wall), lower and jagged too
        bt = max(2.6, top - r.uniform(1.0, 3.0))
        b.box((xb, (ya + yb) / 2, bt / 2), (0.3, bay, bt), M("interior"), unit=3.0)
    # party walls at both ends + a mid one
    for yy in (y0, y1):
        hh = min(tops[0] if yy == y0 else tops[-1], 9.0)
        b.prism([(0, 0), (depth, 0), (depth, hh * 0.55), (depth * 0.5, hh * r.uniform(0.6, 0.9)), (0, hh)], (xf, yy, 0),
                Vector((side, 0, 0)), Vector((0, 1, 0)) * (1 if yy == y0 else -1), 0.3, P, unit=3.0)
    o = b.build(ink)
    # rubble inside the shell + a beam or two hanging out
    return o, tops


def rubble_pile(name, c, rx, ry, h, seed, n=40, ink=0.02):
    """a mound (squashed sphere, dusty) with brick chunks and slabs scattered on it."""
    r = random.Random(seed)
    mound = lib.add_mesh("sphere", name + "_mound", (c[0], c[1], 0), (rx, ry, h), material=M("dust"), ink=False, segments=24, ring_count=12)
    lib.outline(mound, ink)
    mound["no_ground"] = True
    b = MB(name + "_chunks")
    for i in range(n):
        a = r.random() * math.tau; d = math.sqrt(r.random()) * 0.85
        x, y = c[0] + rx * d * math.cos(a), c[1] + ry * d * math.sin(a)
        z = h * math.sqrt(max(0.0, 1 - d * d)) - 0.05
        sz = (r.uniform(0.15, 0.55), r.uniform(0.12, 0.4), r.uniform(0.08, 0.25))
        R = Matrix.Rotation(r.uniform(-0.5, 0.5), 3, "X") @ Matrix.Rotation(r.uniform(-0.5, 0.5), 3, "Y") @ rot_z(r.random() * math.tau)
        b.box((x, y, z), sz, M("chunk") if r.random() < 0.6 else M("chunk2"), unit=1.0, rot=R, bottom=True)
    o = b.build(ink); o["no_ground"] = True
    return mound, o


def sandbag_row(name, a, b_, rows=3, bag=(0.55, 0.32, 0.17)):
    a, b_ = Vector(a), Vector(b_); d = b_ - a; L = d.length; t = d.normalized(); ang = math.atan2(t.y, t.x)
    objs = []
    n = max(1, int(L / (bag[0] * 0.95)))
    sb = M("sandbag")
    for rr in range(rows):
        for i in range(n - (rr % 2)):
            k = (i + 0.5 + (rr % 2) * 0.5) / n
            p = a + d * k
            o = lib.add_mesh("sphere", f"{name}_{rr}_{i}", (p.x, p.y, bag[2] * 0.5 + rr * bag[2] * 0.92), (bag[0] / 2, bag[1] / 2, bag[2] / 2 + 0.01),
                             rot=(0, 0, math.degrees(ang)), material=sb, ink=False, segments=14, ring_count=8)
            lib.outline(o, 0.012); objs.append(o)
    return objs


def smoke_plume(name, loc, size, cam, n_frames, rise=0.25, seed=1):
    """soft smoke billboard (alpha-blended painted puff) slowly rising and growing."""
    bpy.ops.mesh.primitive_plane_add(size=1); o = bpy.context.active_object; o.name = name
    o.rotation_euler.x = math.radians(90); bpy.ops.object.transform_apply(rotation=True)
    m = bpy.data.materials.get("s1_smokeM")
    if m is None:
        m = bpy.data.materials.new("s1_smokeM"); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
        out = nt.nodes.new("ShaderNodeOutputMaterial"); ti = nt.nodes.new("ShaderNodeTexImage"); ti.image = bpy.data.images.load(str(tex("s1_smoke")))
        em = nt.nodes.new("ShaderNodeEmission"); em.inputs[1].default_value = 0.85
        tr = nt.nodes.new("ShaderNodeBsdfTransparent"); mx = nt.nodes.new("ShaderNodeMixShader")
        nt.links.new(ti.outputs[0], em.inputs[0]); nt.links.new(ti.outputs["Alpha"], mx.inputs[0])
        nt.links.new(tr.outputs[0], mx.inputs[1]); nt.links.new(em.outputs[0], mx.inputs[2]); nt.links.new(mx.outputs[0], out.inputs["Surface"])
        try: m.surface_render_method = "BLENDED"
        except Exception: pass
    o.data.materials.append(m); o.visible_shadow = False; o["no_ink"] = True; o["no_ground"] = True
    c = o.constraints.new("LOCKED_TRACK"); c.target = cam; c.track_axis = "TRACK_NEGATIVE_Y"; c.lock_axis = "LOCK_Z"
    for f in (1, n_frames):
        k = (f - 1) / 30.0
        o.location = (loc[0], loc[1], loc[2] + rise * k); s = size * (1 + 0.04 * k); o.scale = (s, s, s)
        o.keyframe_insert("location", frame=f); o.keyframe_insert("scale", frame=f)
    if o.animation_data and o.animation_data.action:
        try:
            for fc in o.animation_data.action.fcurves:
                for kp in fc.keyframe_points: kp.interpolation = "LINEAR"
        except Exception:
            pass
    return o


def tree(name, loc, h=5.0, seed=3):
    r = random.Random(seed); x, y, _ = loc
    tr = lib.add_mesh("cyl", name + "_trunk", (x, y, h * 0.3), (0.16, 0.16, h * 0.3), material=M("trunk"), ink=False, vertices=12)
    lib.outline(tr, 0.02)
    for i, (dx, dy, dz) in enumerate(((0.5, 0.1, 0.45), (-0.45, -0.1, 0.5))):
        br = lib.add_mesh("cyl", f"{name}_br{i}", (x + dx * 0.5, y + dy * 0.5, h * dz + 0.2), (0.07, 0.07, 0.55), rot=(dy * 50, -dx * 70, 0), material=M("trunk"), ink=False, vertices=8)
        lib.outline(br, 0.015)
    for i in range(9):
        a = i / 9 * math.tau; rr = r.uniform(0.5, 1.2)
        cx, cy, cz = x + rr * math.cos(a), y + rr * math.sin(a) * 0.8, h * 0.62 + r.uniform(-0.3, 0.9)
        s = r.uniform(0.9, 1.35)
        bl = lib.add_mesh("sphere", f"{name}_leaf{i}", (cx, cy, cz), (s, s, s * 0.85), material=M("leaf" if i % 3 else "leaf2"), ink=False, segments=16, ring_count=10)
        lib.outline(bl, 0.03)
    top = lib.add_mesh("sphere", f"{name}_leafT", (x, y, h * 0.62 + 1.2), (1.2, 1.2, 1.0), material=M("leaf"), ink=False, segments=16, ring_count=10)
    lib.outline(top, 0.03)


# ------------------------------------------------------------------ the set
def build(cam, n_frames):
    out = {}
    D = S1
    # ground: dusty street up to the rubble wall, grass in the garden, dust everywhere else out to the sky
    g = lib.box("s1_ground", (2, 0, -0.05), (240, 240, 0.1), M("street"), ink=False);
    import sets; sets.tiled(g, 2.2)
    gr = lib.box("s1_grass", (2.5, 14.9, -0.004), (21.6, 16.2, 0.01), M("grass"), ink=False); sets.tiled(gr, 3.0)
    # ---------------- street ruins (both sides) + distant ruined skyline
    ruin_block("ruinL1", -3.4, -1, -16, -4.0, 6.0, 7.0, 11.0, "pa", 11)
    ruin_block("ruinL2", -3.4, -1, -4.0, 6.2, 6.0, 6.0, 12.5, "pb", 12)
    ruin_block("ruinR1", 3.4, 1, -16, -5.0, 6.0, 7.5, 12.0, "pc", 13)
    ruin_block("ruinR2", 3.4, 1, -5.0, 6.2, 5.0, 6.5, 10.5, "pa", 14)
    r = random.Random(5)
    fb = MB("farRuins")
    for i in range(30):                                      # far skyline ring: broken shells, jagged tops, facing the centre
        a = math.radians(-75 + i * 9.0); R_ = r.uniform(30, 42)
        cx, cy = 2 + R_ * math.sin(a), 6 + R_ * math.cos(a)
        t = Vector((math.cos(a), -math.sin(a), 0)); nrm = Vector((-math.sin(a), -math.cos(a), 0))
        W_ = r.uniform(7, 11); H_ = r.uniform(9, 19); pts = [(-W_ / 2, 0), (W_ / 2, 0)]
        k = 7
        for j in range(k, -1, -1):
            pts.append((-W_ / 2 + W_ * j / k, H_ * r.uniform(0.55, 1.0) if j % 2 else H_ * r.uniform(0.3, 0.75)))
        base = Vector((cx, cy, 0)) - t * 0.0
        fb.prism(pts, base, t, -nrm, 4.0, M(("pa", "pb", "pc")[i % 3]), unit=4.0)
        for wx in range(-int(W_ / 2) + 1, int(W_ / 2), 2):           # dark window holes on the face
            for wz in (2.0, 5.2, 8.4):
                if wz + 1.2 < H_ * 0.5:
                    c = base + t * wx + nrm * 0.03 + Vector((0, 0, wz))
                    q = [c - t * 0.4, c + t * 0.4, c + t * 0.4 + Vector((0, 0, 1.4)), c - t * 0.4 + Vector((0, 0, 1.4))]
                    fb.poly(q, M("winhole"))
    fb.build(0.06)
    # ---------------- debris along the street
    for i, (x, y, rx, ry, h) in enumerate(((-2.9, -9, 1.3, 2.6, 1.1), (2.9, -6, 1.2, 2.0, 0.9), (-2.8, 0.2, 1.1, 1.8, 1.1), (3.0, 1.5, 1.1, 1.8, 1.2),
                                           (-2.6, 5.8, 2.0, 0.6, 1.4), (2.4, 5.8, 2.2, 0.6, 1.5), (0.2, 5.9, 1.8, 0.55, 1.0))):
        rubble_pile(f"rub{i}", (x, y), rx, ry, h, 200 + i, n=int(30 * rx))
    # sandbag barricade the soldiers fire over + one across the back
    sandbag_row("sbA", (-0.75, 1.6), (-0.6, 4.9), rows=3)
    sandbag_row("sbB", (1.2, 4.6), (3.6, 4.9), rows=2)
    # a wrecked tram/telegraph pole leaning + a broken beam
    pole = lib.add_mesh("cyl", "pole", (2.6, -1.5, 2.6), (0.09, 0.09, 2.8), rot=(0, -14, 0), material=M("beam"), ink=False, vertices=10); lib.outline(pole, 0.02)
    beam = lib.box("beamA", (-2.9, -2.5, 1.2), (0.25, 3.2, 0.25), M("beam"), rot=(32, 0, 0))
    # ---------------- rubble wall across the street end (ruined garden wall of the Chancellery)
    b = MB("rubbleWall"); RY = D["RUBBLE_Y"]
    prof = [(-9, 0), (13, 0), (13, 3.0), (8, 3.0), (5, 2.4), (3.6, 2.7), (2.6, 1.7), (1.6, 2.1), (0.6, 1.5), (-0.6, 1.9), (-1.6, 1.4), (-2.6, 2.2), (-3.4, 2.9), (-9, 3.2)]
    b.prism(prof, (0, RY, 0), Vector((1, 0, 0)), Vector((0, 1, 0)), 0.6, M("brick"), unit=3.0)
    b.build(0.035)
    # ---------------- garden: enclosure walls, Chancellery wing, fence, tree
    b = MB("gardenWalls")
    b.box((-8.2, 14.9, 1.6), (0.4, 17.4, 3.2), M("brick"), unit=3.0)                       # left wall
    b.box((13.2, 14.9, 1.6), (0.4, 17.4, 3.2), M("brick"), unit=3.0)                       # right wall
    b.build(0.035)
    b = MB("chancellery")
    CH = M("chan"); WH = M("winhole")
    b.box((2.5, 24.5, 3.4), (24, 3.0, 6.8), CH, unit=4.0)
    b.box((2.5, 24.5, 6.95), (24.6, 3.4, 0.3), M("roof"), unit=4.0, bottom=True)
    for i in range(9):
        for j, z in enumerate((1.9, 4.9)):
            x = -8.0 + i * 2.6
            b.box((x, 22.98, z), (1.1, 0.06, 1.8), WH)
            b.box((x, 22.94, z - 1.0), (1.4, 0.14, 0.14), M("slab"))
    b.box((14.5, 14.0, 3.5), (3.0, 18, 7), M("pb"), unit=4.0)                             # right wing behind the wall
    b.box((-9.8, 14.0, 3.8), (3.0, 18, 7.6), M("pa"), unit=4.0)                             # left wing
    b.build(0.05)
    b = MB("fence")
    for i in range(30):
        x = -7.6 + i * 0.36
        if x > 2.2: break
        b.box((x, 21.0, 0.75), (0.16, 0.05, 1.5), M("fence"), unit=1.0)
    b.box((-2.7, 21.05, 1.25), (10.0, 0.06, 0.12), M("fence")); b.box((-2.7, 21.05, 0.35), (10.0, 0.06, 0.12), M("fence"))
    b.build(0.015)
    tree("tree", (-2.4, 12.4, 0), h=4.4)
    tree("tree3", (-3.6, 17.0, 0), h=5.4, seed=5)
    tree("tree2", (9.8, 18.4, 0), h=4.6, seed=8)
    # ---------------- bunker entrance block (concrete) with the heavy steel door
    X0, T = D["DOOR_X"], D["WALL_T"]; Y = D["DOOR_Y"]; hw = D["DOOR_W"] / 2; sh = D["SHAFT_HW"]; dh = D["DOOR_H"]; SH = D["SHAFT_H"]
    X1, YA, YB, HB = 4.5, -3.0, 3.5, 3.0
    piv = bpy.data.objects.new("bunkerPivot", None); bpy.context.scene.collection.objects.link(piv)
    piv.location = (D["BUNKER"][0], D["BUNKER"][1], 0); piv.rotation_euler.z = math.radians(90)
    C = M("concrete"); b = MB("bunker")
    b.box((X0 + T / 2, (YA + Y - hw) / 2, HB / 2), (T, Y - hw - YA, HB), C, unit=2.5)              # front wall left of the door
    b.box((X0 + T / 2, (Y + hw + YB) / 2, HB / 2), (T, YB - Y - hw, HB), C, unit=2.5)              # right of the door
    b.box((X0 + T / 2, Y, (dh + HB) / 2), (T, 2 * hw, HB - dh), C, unit=2.5)                       # lintel
    b.box(((X0 + T + X1) / 2, (YA + Y - sh) / 2, HB / 2), (X1 - X0 - T, Y - sh - YA, HB), C, unit=2.5)
    b.box(((X0 + T + X1) / 2, (Y + sh + YB) / 2, HB / 2), (X1 - X0 - T, YB - Y - sh, HB), C, unit=2.5)
    b.box(((X0 + T + X1) / 2, Y, (SH + HB) / 2), (X1 - X0 - T, 2 * sh, HB - SH), C, unit=2.5)
    b.box((X1 - 0.15, Y, SH / 2), (0.3, 2 * sh, SH), C, unit=2.5)
    b.box(((X0 + X1) / 2 - 0.1, (YA + YB) / 2, HB + 0.15), (X1 - X0 + 0.6, YB - YA + 0.6, 0.3), C, unit=2.5, bottom=True)   # roof slab
    b.build(0.035).parent = piv
    # steel door frame + threshold
    fr = MB("doorFrame"); F = M("frame")
    fr.box((X0 - 0.04, Y - hw - 0.06, dh / 2), (0.1, 0.12, dh + 0.02), F); fr.box((X0 - 0.04, Y + hw + 0.06, dh / 2), (0.1, 0.12, dh + 0.02), F)
    fr.box((X0 - 0.04, Y, dh + 0.06), (0.1, 2 * hw + 0.24, 0.12), F)
    fr.box((X0 - 0.1, Y, 0.01), (0.22, 2 * hw + 0.36, 0.02), F, bottom=True)
    fr.build(0.015).parent = piv
    # shaft lining: floor / walls / ceiling / end wall, dull at the door, black within 0.6 m
    sm = shaft_mat(); ln = MB("shaft")
    xa, xb = X0 + 0.0, X1 - 0.3
    ln.poly([(xa, Y - sh, 0.002), (xb, Y - sh, 0.002), (xb, Y + sh, 0.002), (xa, Y + sh, 0.002)], sm)
    ln.poly([(xa, Y + sh, SH - 0.002), (xb, Y + sh, SH - 0.002), (xb, Y - sh, SH - 0.002), (xa, Y - sh, SH - 0.002)], sm)
    ln.poly([(xa, Y - sh + 0.002, 0), (xa, Y - sh + 0.002, SH), (xb, Y - sh + 0.002, SH), (xb, Y - sh + 0.002, 0)], sm)
    ln.poly([(xb, Y + sh - 0.002, 0), (xb, Y + sh - 0.002, SH), (xa, Y + sh - 0.002, SH), (xa, Y + sh - 0.002, 0)], sm)
    ln.poly([(xb - 0.002, Y - sh, 0), (xb - 0.002, Y - sh, SH), (xb - 0.002, Y + sh, SH), (xb - 0.002, Y + sh, 0)], sm)
    # door reveal faces inside the wall thickness (x 3.0 .. 3.3): the shaft material too, so no lit seam
    ln.poly([(X0, Y - hw + 0.001, 0), (X0 + T, Y - hw + 0.001, 0), (X0 + T, Y - hw + 0.001, dh), (X0, Y - hw + 0.001, dh)], sm)
    ln.poly([(X0 + T, Y + hw - 0.001, 0), (X0, Y + hw - 0.001, 0), (X0, Y + hw - 0.001, dh), (X0 + T, Y + hw - 0.001, dh)], sm)
    ln.poly([(X0, Y - hw, dh - 0.001), (X0 + T, Y - hw, dh - 0.001), (X0 + T, Y + hw, dh - 0.001), (X0, Y + hw, dh - 0.001)], sm)
    o = ln.build(0, recalc=False); o["no_ink"] = True; o.parent = piv
    # the steel door leaf on its hinge (hinge on the far jamb, swings inward into the shaft)
    hx, hy = D["HINGE"]; LW = D["LEAF_W"]
    hinge = bpy.data.objects.new("doorHinge", None); bpy.context.scene.collection.objects.link(hinge); hinge.location = (hx, hy, 0.01); hinge.parent = piv
    dl = MB("doorLeaf"); ST = M("steel")
    dl.box((0, LW / 2, (dh - 0.03) / 2), (0.09, LW, dh - 0.03), ST, unit=2.2, bottom=True)
    for z in (0.35, dh / 2, dh - 0.4):                                                   # heavy reinforcing bands (outside)
        dl.box((-0.06, LW / 2, z), (0.035, LW - 0.12, 0.09), M("frame"))
    dl.box((-0.07, LW - 0.14, 1.05), (0.04, 0.05, 0.32), M("frame"))                       # lever handle
    leaf = dl.build(0.015); leaf.parent = hinge
    out["hinge"] = hinge
    return out


def lights():
    light("SUN", "s1_sun", (0, 0, 20), "#f1ece2", 2.6, size=0.6, rot=(48, 0, -35))
    light("AREA", "s1_fill_street", (0, -6, 9), "#cfd8e2", 900, size=10, target=(0, 2, 0))
    light("AREA", "s1_fill_garden", (-2, 6, 7), "#d8e2d6", 700, size=8, target=(2, 12.5, 0))
