"""Grave Bell - SNOW STREET set (shots 9-13): a snowy night street in a small 1890s town.
Two rows of colourful clapboard houses (built here: siding textures, front gables, porches with rails, lit windows),
the wife's dark purple Victorian house at the end (bay window), stylised snowy pines, hills with the graveyard,
snowy mountains, deep blue gradient sky, falling snow, warm porch lanterns (Poly Haven Lantern_01 / street_lamp_01 +
emissive + POINT lights).

Layout (Blender, Z up): street runs along +Y on x = 0 (half width 6 m). Left row fronts face +X at x = -7,
right row fronts face -X at x = +7. The wife's house sits across the end of the street at y = 58 facing -Y.
Houses are built with MeshBuilder (one mesh per house, one material slot per surface) so the set stays light.
"""
import bpy, math, random
from mathutils import Vector, Matrix
import lib, sets
from lib import mat, rgb, light, emissive

TEX = lib.HERE / "tex"
def tex(n): return TEX / f"{n}.png"

TRIM = "#f1ede4"
# house table: name, side (-1 left / +1 right / 0 end), y, siding, width, depth, wall h, roof rise, door colour
HOUSES = [   # name, side, y, siding, w, d, h, rise, door, porch fraction (1 = full-width porch)
    ("L0", -1, 2.0, "siding_teal", 6.4, 7.0, 5.3, 2.8, "#7a2a20", 1.0),
    ("L1", -1, 11.0, "siding_red", 6.0, 7.0, 5.5, 2.6, "#2b3b6a", 1.0),
    ("L2", -1, 20.0, "siding_yellow", 6.2, 7.0, 5.1, 2.6, "#4a2820", 0.55),
    ("L3", -1, 29.0, "siding_blue", 5.8, 7.0, 5.5, 2.8, "#7a2a20", 0.55),
    ("L4", -1, 38.0, "siding_teal", 6.0, 7.0, 5.3, 2.6, "#4a2820", 0.55),
    ("L5", -1, 47.0, "siding_red", 6.0, 7.0, 5.1, 2.6, "#2b3b6a", 0.55),
    ("R0", 1, 4.0, "siding_blue", 6.2, 7.0, 5.5, 2.8, "#4a2820", 0.55),
    ("R1", 1, 13.0, "siding_purple", 6.0, 7.0, 5.1, 2.6, "#e0c070", 0.55),
    ("R2", 1, 22.0, "siding_teal", 6.4, 7.0, 5.3, 2.8, "#7a2a20", 0.55),
    ("R3", 1, 31.0, "siding_yellow", 6.0, 7.0, 5.5, 2.6, "#2b3b6a", 0.55),
    ("DOC", 1, 44.0, "siding_cream", 6.6, 7.0, 5.5, 2.8, "#2f4a6a", 1.0),     # A. HALE PHYSICIAN
]
WIFE = dict(loc=(0.0, 62.0, 0.0), w=8.4, d=8.0, h=6.2, r=3.6)
STREET_HALF = 6.0
ROW_X = 7.0


# ------------------------------------------------------------------ fast mesh builder
class MB:
    """accumulates boxes / quads / tris into one mesh with planar world-size UVs per face."""
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
        self.uv.append([((p.y, p.z), (p.x, p.z), (p.x, p.y))[ax] for p in pts])
        self.uv[-1] = [(a / unit, b / unit) for a, b in self.uv[-1]]

    def box(self, c, s, material, unit=1.0, rot=None, skip_bottom=True):
        hx, hy, hz = s[0] / 2, s[1] / 2, s[2] / 2
        R = rot if rot is not None else Matrix.Identity(3)
        C = Vector(c)
        P = lambda x, y, z: C + R @ Vector((x * hx, y * hy, z * hz))
        faces = [((-1, -1, 1), (1, -1, 1), (1, 1, 1), (-1, 1, 1)),      # top
                 ((-1, -1, -1), (1, -1, -1), (1, -1, 1), (-1, -1, 1)),  # -y
                 ((1, 1, -1), (-1, 1, -1), (-1, 1, 1), (1, 1, 1)),      # +y
                 ((-1, 1, -1), (-1, -1, -1), (-1, -1, 1), (-1, 1, 1)),  # -x
                 ((1, -1, -1), (1, 1, -1), (1, 1, 1), (1, -1, 1))]      # +x
        if not skip_bottom: faces.append(((-1, 1, -1), (1, 1, -1), (1, -1, -1), (-1, -1, -1)))
        for fc in faces: self.poly([P(*q) for q in fc], material, unit)

    def build(self, parent=None, ink=0.03):
        me = bpy.data.meshes.new(self.name)
        me.from_pydata(self.v, [], self.f); me.update()
        for m_ in self.mats: me.materials.append(m_)
        for p, k in zip(me.polygons, self.mi): p.material_index = k
        uvl = me.uv_layers.new()
        li = 0
        for p, uvs in zip(me.polygons, self.uv):
            for j, li_ in enumerate(p.loop_indices): uvl.data[li_].uv = uvs[j]
        o = bpy.data.objects.new(self.name, me); bpy.context.scene.collection.objects.link(o)
        if parent: o.parent = parent
        if ink: lib.outline(o, ink)
        return o


def rot_y(a): return Matrix.Rotation(a, 3, "Y")
def rot_z(a): return Matrix.Rotation(a, 3, "Z")


# ------------------------------------------------------------------ materials
_M = {}
def M(key):
    if key in _M: return _M[key]
    if key.startswith("siding_"):
        m = mat("st_" + key, "#ffffff", tex(key))
    elif key == "trim": m = mat("st_trim", TRIM)
    elif key == "snow": m = mat("st_snow", "#e6ebff", tex("snow"), rough=1.0)
    elif key == "roofsnow": m = mat("st_roofsnow", "#eef0ff", rough=1.0)
    elif key == "planks": m = mat("st_planks", "#c48a5a", tex("planks"))
    elif key == "dark": m = mat("st_dark", "#2a2238")
    elif key == "ceil": m = mat("st_ceil", "#b8c2e6", tex("siding_cream"))
    elif key == "brick": m = mat("st_brick", "#9a3a2c")
    elif key == "pine": m = mat("st_pine", "#1f5a5c", rough=1.0)
    elif key == "trunk": m = mat("st_trunk", "#4a3020")
    elif key == "glass_dark": m = mat("st_glassdark", "#141a46", rough=0.3)
    elif key == "rug": m = mat("st_rug", "#8a2a2a")
    elif key.startswith("door"): m = mat("st_" + key, key[4:])
    else: raise KeyError(key)
    _M[key] = m; return m


def window_mat(name, lit=True, strength=8.0):
    """per-house window glass: dark navy, warm emission keyed by `lit_window`."""
    m = bpy.data.materials.new("win_" + name); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial"); p = nt.nodes.new("ShaderNodeBsdfPrincipled")
    p.inputs["Base Color"].default_value = rgb("#10153c"); p.inputs["Roughness"].default_value = 0.6
    lib._set_in(p, "Specular IOR Level", 0.08)
    p.inputs["Emission Color"].default_value = rgb("#ffb35c")
    p.inputs["Emission Strength"].default_value = strength if lit else 0.0
    nt.links.new(p.outputs[0], out.inputs["Surface"])
    m["emit_full"] = strength
    return m


def key_window(m, f, on):
    p = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    s = p.inputs["Emission Strength"]; s.default_value = m["emit_full"] if on else 0.0
    s.keyframe_insert("default_value", frame=f)


# ------------------------------------------------------------------ house
def house(name, loc, yaw, w, d, h, r, siding, door_col, win_m, porch=True, bay=False, attic_arch=False, pd=2.6, ridge_x=True, pfrac=1.0):
    """local frame: front faces -Y, origin = body centre on the ground. Returns dict of world anchors."""
    root = bpy.data.objects.new(name, None); bpy.context.scene.collection.objects.link(root)
    root.location = loc; root.rotation_euler.z = math.radians(yaw)
    b = MB(name + "_mesh"); S = M(siding); T = M("trim"); RS = M("roofsnow")
    fy, by_ = -d / 2, d / 2
    # body + gables: ridge_x = ridge along the front (row houses: gable ends face up/down the street, like the
    # reference); otherwise a front gable (the wife's house)
    b.box((0, 0, h / 2), (w, d, h), S, unit=2.0)
    oh = 0.45; th = 0.22
    if ridge_x:
        b.poly([(-w / 2, by_, h), (-w / 2, fy, h), (-w / 2, 0, h + r)], S, unit=2.0)
        b.poly([(w / 2, fy, h), (w / 2, by_, h), (w / 2, 0, h + r)], S, unit=2.0)
        a = math.atan2(r, d / 2); L = math.hypot(d / 2, r) + oh
        for sgn in (-1, 1):
            mid = Vector((0, sgn * (d / 4 + oh * math.cos(a) / 2), h + r / 2 - oh * math.sin(a) / 2))
            nrm = Vector((0, sgn * math.sin(a), math.cos(a)))
            b.box(mid + nrm * th / 2, (w + 0.9, L, th), RS, rot=Matrix.Rotation(-sgn * a, 3, "X"), skip_bottom=False)
        b.box((0, fy - oh * 0.9, h - 0.05), (w + 0.9, 0.1, 0.22), T)
    else:
        b.poly([(-w / 2, fy, h), (w / 2, fy, h), (0, fy, h + r)], S, unit=2.0)
        b.poly([(w / 2, by_, h), (-w / 2, by_, h), (0, by_, h + r)], S, unit=2.0)
        a = math.atan2(r, w / 2); L = math.hypot(w / 2, r) + oh
        for sgn in (-1, 1):
            mid = Vector((sgn * (w / 4 + oh * math.cos(a) / 2), 0, h + r / 2 - oh * math.sin(a) / 2))
            nrm = Vector((sgn * math.sin(a), 0, math.cos(a)))
            b.box(mid + nrm * th / 2, (L, d + 0.9, th), RS, rot=rot_y(sgn * a), skip_bottom=False)
            b.box(mid - nrm * 0.02 + Vector((0, -(d + 0.9) / 2, 0)), (L, 0.08, 0.16), T, rot=rot_y(sgn * a))
    # chimney
    b.box((w * 0.22, d * 0.12, h + r * 0.75), (0.55, 0.55, r * 1.1), M("brick"))
    # trims
    for sx in (-1, 1):
        for sy in (-1, 1):
            b.box((sx * (w / 2 + 0.02), sy * (d / 2 + 0.02), h / 2), (0.18, 0.18, h), T)
    b.box((0, fy - 0.04, h - 0.1), (w + 0.1, 0.08, 0.2), T)
    # windows
    def win(cx, cz, face, ww=0.95, wh=1.45, m_=win_m):
        if face == "front":
            y = fy - 0.03
            b.poly([(cx - ww / 2, y, cz - wh / 2), (cx + ww / 2, y, cz - wh / 2), (cx + ww / 2, y, cz + wh / 2), (cx - ww / 2, y, cz + wh / 2)], m_)
            for (x, z, sx_, sz_) in ((cx, cz + wh / 2 + 0.06, ww + 0.3, 0.14), (cx, cz - wh / 2 - 0.06, ww + 0.36, 0.12),
                                     (cx - ww / 2 - 0.06, cz, 0.12, wh + 0.1), (cx + ww / 2 + 0.06, cz, 0.12, wh + 0.1),
                                     (cx, cz, 0.06, wh), (cx, cz + wh * 0.08, ww, 0.06)):
                b.box((x, y - 0.04, z), (sx_, 0.1, sz_), T)
        else:
            s = -1 if face == "left" else 1; x = s * (w / 2 + 0.03); cy = cx
            b.poly([(x, cy + s * ww / 2, cz - wh / 2), (x, cy - s * ww / 2, cz - wh / 2), (x, cy - s * ww / 2, cz + wh / 2), (x, cy + s * ww / 2, cz + wh / 2)], m_)
            for (y, z, sy_, sz_) in ((cy, cz + wh / 2 + 0.06, ww + 0.3, 0.14), (cy, cz - wh / 2 - 0.06, ww + 0.36, 0.12),
                                     (cy - ww / 2 - 0.06, cz, 0.12, wh + 0.1), (cy + ww / 2 + 0.06, cz, 0.12, wh + 0.1),
                                     (cy, cz, 0.06, wh), (cy, cz + wh * 0.08, ww, 0.06)):
                b.box((x + s * 0.04, y, z), (0.1, sy_, sz_), T)
    if not bay and pfrac >= 1:
        win(-w * 0.3, 2.1, "front"); win(w * 0.3, 2.1, "front")
    elif not bay:
        win(w * 0.12, 1.9, "front", 0.85, 1.4); win(w * 0.36, 1.9, "front", 0.85, 1.4)
    if ridge_x:
        win(0, h + r * 0.36, "left", 0.8, 1.0); win(0, h + r * 0.36, "right", 0.8, 1.0)
    else:
        win(0, h + r * 0.38, "front", 0.8, 1.0)
    for cy in (-d * 0.18, d * 0.25):
        win(cy, 2.1, "left"); win(cy, 2.1, "right")
        if h > 5: win(cy, 4.4, "left", 0.85, 1.2); win(cy, 4.4, "right", 0.85, 1.2)
    if h > 5 and not bay:
        win(-w * 0.3, 4.4, "front", 0.85, 1.2); win(w * 0.3, 4.4, "front", 0.85, 1.2)
    # door (+ glass pane lit like the windows)
    pw_half = w * 0.55
    dx = w * 0.12 if bay else (0.0 if pfrac >= 1 else -w / 2 + pw_half / 2 - 0.1)
    b.box((dx, fy - 0.03, 1.15 + 0.6 * porch), (1.05, 0.08, 2.3), M("door" + door_col))
    b.poly([(dx - 0.25, fy - 0.08, 1.75 + 0.6 * porch), (dx + 0.25, fy - 0.08, 1.75 + 0.6 * porch), (dx + 0.25, fy - 0.08, 2.15 + 0.6 * porch), (dx - 0.25, fy - 0.08, 2.15 + 0.6 * porch)], win_m)
    for x, z, sx_, sz_ in ((dx - 0.6, 1.2 + 0.6 * porch, 0.14, 2.45), (dx + 0.6, 1.2 + 0.6 * porch, 0.14, 2.45), (dx, 2.42 + 0.6 * porch, 1.34, 0.16)):
        b.box((x, fy - 0.05, z), (sx_, 0.1, sz_), T)
    out = dict(root=root, door=(dx, fy - 0.3, 0.6 if porch else 0.0), w=w, d=d, h=h, porch_y=fy - pd / 2, pd=pd)
    # bay window (front-left): 3-faced box with windows, snow cap
    if bay:
        bw, bd, bh = 2.6, 1.1, 3.4; bx = -w * 0.22; z0 = 0.4
        p0 = Vector((bx - bw / 2, fy, 0)); p1 = Vector((bx - bw / 2 + 0.45, fy - bd, 0)); p2 = Vector((bx + bw / 2 - 0.45, fy - bd, 0)); p3 = Vector((bx + bw / 2, fy, 0))
        for A, B in ((p0, p1), (p1, p2), (p2, p3)):
            b.poly([A, B, B + Vector((0, 0, bh)), A + Vector((0, 0, bh))], S, unit=2.0)
            c = (A + B) / 2; t = (B - A).normalized(); n = Vector((t.y, -t.x, 0)); L_ = (B - A).length
            gw = L_ * 0.72; z1, z2 = z0 + 0.6, bh - 0.35
            q = [c - t * gw / 2 + n * 0.03, c + t * gw / 2 + n * 0.03]
            b.poly([q[0] + Vector((0, 0, z1)), q[1] + Vector((0, 0, z1)), q[1] + Vector((0, 0, z2)), q[0] + Vector((0, 0, z2))], win_m)
            ang = math.atan2(t.y, t.x)
            for off, zz, sw, sh in ((0, z1 - 0.07, gw + 0.2, 0.14), (0, z2 + 0.07, gw + 0.2, 0.14), (-gw / 2 - 0.05, (z1 + z2) / 2, 0.1, z2 - z1),
                                    (gw / 2 + 0.05, (z1 + z2) / 2, 0.1, z2 - z1), (0, (z1 + z2) / 2, 0.07, z2 - z1), (0, z1 + (z2 - z1) * 0.55, gw, 0.07)):
                cc = c + t * off + n * 0.07; b.box((cc.x, cc.y, zz), (sw, 0.1, sh), T, rot=rot_z(ang))
        # bay roof cap
        b.poly([p0 + Vector((-0.15, 0, bh)), p1 + Vector((-0.15, -0.2, bh)), p2 + Vector((0.15, -0.2, bh)), p3 + Vector((0.15, 0, bh))], RS)
        b.box(((p1.x + p2.x) / 2, fy - bd - 0.12, bh + 0.08), (bw - 0.6, 0.12, 0.25), T)
        out["bay"] = (bx, fy - bd, z0 + bh * 0.55)
    # porch
    if porch:
        pz = 0.6; py0 = fy - pd; pw = w + 0.3 if not bay else w * 0.5
        pcx = 0 if not bay else w * 0.2
        if not bay and pfrac < 1: pw, pcx = pw_half + 0.3, dx
        b.box((pcx, fy - pd / 2, pz / 2), (pw, pd, pz), M("planks"), unit=1.5)
        for k in range(3):
            top = pz * (1 - (k + 1) / 4)
            b.box((dx, py0 - 0.17 - k * 0.32, top / 2), (1.6, 0.34, top), M("planks"), unit=1.5)
        ph = 3.0
        posts = [pcx - pw / 2 + 0.12, dx - 0.95, dx + 0.95, pcx + pw / 2 - 0.12]
        for x in posts:
            b.box((x, py0 + 0.12, pz + ph / 2), (0.16, 0.16, ph), T)
        b.box((pcx - pw / 2 + 0.12, fy - 0.15, pz + ph / 2), (0.16, 0.16, ph), T)
        b.box((pcx + pw / 2 - 0.12, fy - 0.15, pz + ph / 2), (0.16, 0.16, ph), T)
        # roof (planked ceiling + snow top + fascia)
        b.box((pcx, fy - pd / 2 - 0.1, pz + ph + 0.08), (pw + 0.5, pd + 0.4, 0.14), M("ceil"), unit=1.5, skip_bottom=False)
        b.box((pcx, fy - pd / 2 - 0.1, pz + ph + 0.22), (pw + 0.55, pd + 0.45, 0.16), RS)
        b.box((pcx, py0 - 0.12, pz + ph - 0.02), (pw + 0.5, 0.08, 0.26), T)
        # railings: front (gap for steps) + sides, balusters
        def rail(x0, x1, y0, y1):
            Lr = math.hypot(x1 - x0, y1 - y0); cx_, cy_ = (x0 + x1) / 2, (y0 + y1) / 2; ang = math.atan2(y1 - y0, x1 - x0)
            for z, hh in ((pz + 0.95, 0.09), (pz + 0.15, 0.07)):
                b.box((cx_, cy_, z), (Lr, 0.09, hh), T, rot=rot_z(ang))
            n = max(2, int(Lr / 0.22))
            for i in range(1, n):
                u = i / n; b.box((x0 + (x1 - x0) * u, y0 + (y1 - y0) * u, pz + 0.55), (0.045, 0.045, 0.8), T)
        rail(posts[0], posts[1], py0 + 0.12, py0 + 0.12); rail(posts[2], posts[3], py0 + 0.12, py0 + 0.12)
        rail(posts[0], posts[0], py0 + 0.12, fy - 0.15); rail(posts[3], posts[3], py0 + 0.12, fy - 0.15)
        out.update(porch_z=pz, porch_c=(pcx, fy - pd / 2), lantern=(dx + 0.95, fy - 0.25, pz + 2.25), porch_w=pw)
    o = b.build(root)
    out["obj"] = o
    return out


def local_to_world(h, p):
    bpy.context.view_layer.update()
    return tuple(h["root"].matrix_world @ Vector(p))


# ------------------------------------------------------------------ props
_LANTERN = {}
def lantern(name, loc, height=0.42, glow="#ffb860", strength=8.0, light_w=60, lit=True, radius=4.0):
    """Poly Haven Lantern_01 (shared mesh) with an emissive core + a warm POINT light."""
    if "src" not in _LANTERN:
        o = sets.asset("Lantern_01", (0, 0, -100), height=height)
        for i, m_ in enumerate(o.data.materials):
            if m_ and "glass" in m_.name.lower():
                o.data.materials[i] = emissive("lanternGlass", "#ffcf80", strength)
        _LANTERN["src"] = o
    src = _LANTERN["src"]
    o = src.copy(); bpy.context.scene.collection.objects.link(o); o.name = name; o.location = loc
    core = bpy.data.objects.new(name + "_core", _core_mesh()); bpy.context.scene.collection.objects.link(core)
    core.location = (loc[0], loc[1], loc[2] + height * 0.42); core.scale = (height * 0.17,) * 3
    core.data.materials.clear(); core.data.materials.append(emissive("lanternCore", glow, strength))
    L = light("POINT", name + "_L", (loc[0], loc[1], loc[2] + height * 0.45), glow, light_w if lit else 0.0, size=0.08, shadow=False)
    try: L.data.use_custom_distance = True; L.data.cutoff_distance = radius * 3
    except Exception: pass
    return o, core, L


_CORE = {}
def _core_mesh():
    if "m" not in _CORE:
        bpy.ops.mesh.primitive_uv_sphere_add(radius=1, segments=12, ring_count=8, location=(0, 0, -200))
        s = bpy.context.active_object; _CORE["m"] = s.data; s.name = "_core_src"; s.hide_render = True
    return _CORE["m"]


_PINE = {}
def pine(loc, height=6.0, snow=True):
    """stylised snowy pine like the reference: trunk + 3 stacked cones (dark teal) with white tips."""
    if "m" not in _PINE:
        b = MB("pine_src"); P_ = M("pine"); SN = M("roofsnow")
        N = 7
        def cone(z0, z1, r, m_):
            for k in range(N):
                a0, a1 = 2 * math.pi * k / N, 2 * math.pi * (k + 1) / N
                b.poly([(r * math.cos(a0), r * math.sin(a0), z0), (r * math.cos(a1), r * math.sin(a1), z0), (0, 0, z1)], m_)
        b.box((0, 0, 0.1), (0.12, 0.12, 0.25), M("trunk"))
        for (z0, z1, r) in ((0.15, 0.62, 0.36), (0.38, 0.85, 0.28), (0.6, 1.0, 0.19)):
            cone(z0, z1, r, P_)
            cone(z1 - (z1 - z0) * 0.32, z1 + 0.005, r * 0.33, SN)
        o = b.build(ink=0.0); o.location = (0, 0, -300); _PINE["m"] = o.data
    o = bpy.data.objects.new("pine", _PINE["m"]); bpy.context.scene.collection.objects.link(o)
    o.location = loc; o.scale = (height, height, height); o.rotation_euler.z = random.uniform(0, 6.28)
    return o


def sky_world(top="#14207a", mid="#3346b8", horizon="#8d8cf0", strength=1.0, haze=0.0, haze_col="#9aa6ff"):
    w = bpy.data.worlds.new("StreetSky"); bpy.context.scene.world = w
    w.use_nodes = True; nt = w.node_tree; nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputWorld"); bg = nt.nodes.new("ShaderNodeBackground")
    tc = nt.nodes.new("ShaderNodeTexCoord"); sp = nt.nodes.new("ShaderNodeSeparateXYZ")
    cr = nt.nodes.new("ShaderNodeValToRGB"); el = cr.color_ramp
    el.elements[0].position = 0.0; el.elements[0].color = rgb(horizon)
    el.elements[1].position = 0.55; el.elements[1].color = rgb(top)
    e = el.elements.new(0.18); e.color = rgb(mid)
    nt.links.new(tc.outputs["Generated"], sp.inputs[0]); nt.links.new(sp.outputs["Z"], cr.inputs["Fac"])
    nt.links.new(cr.outputs["Color"], bg.inputs[0]); bg.inputs[1].default_value = strength
    nt.links.new(bg.outputs[0], out.inputs["Surface"])
    if haze > 0:
        vs = nt.nodes.new("ShaderNodeVolumeScatter"); vs.inputs["Density"].default_value = haze
        vs.inputs["Color"].default_value = rgb(haze_col); vs.inputs["Anisotropy"].default_value = 0.3
        nt.links.new(vs.outputs[0], out.inputs["Volume"])
    return w


# ------------------------------------------------------------------ falling snow
def snowfall(n_frames, center, size, count=420, seed=7, fall=1.1, flake=0.035, name="snow"):
    """deterministic snow: a flake cloud spanning 2x the box height, translated down (mod height) each frame,
    with gentle sideways drift. Flakes are small emissive icospheres in one mesh."""
    rnd = random.Random(seed)
    cx, cy, cz = center; sx, sy, sz = size
    verts, faces = [], []
    ico_v = [(0, 0, 1), (0.894, 0, 0.447), (0.276, 0.851, 0.447), (-0.724, 0.526, 0.447), (-0.724, -0.526, 0.447), (0.276, -0.851, 0.447),
             (0.724, 0.526, -0.447), (-0.276, 0.851, -0.447), (-0.894, 0, -0.447), (-0.276, -0.851, -0.447), (0.724, -0.526, -0.447), (0, 0, -1)]
    ico_f = [(0, 1, 2), (0, 2, 3), (0, 3, 4), (0, 4, 5), (0, 5, 1), (1, 6, 2), (2, 7, 3), (3, 8, 4), (4, 9, 5), (5, 10, 1),
             (6, 7, 2), (7, 8, 3), (8, 9, 4), (9, 10, 5), (10, 6, 1), (11, 7, 6), (11, 8, 7), (11, 9, 8), (11, 10, 9), (11, 6, 10)]
    pts = []
    for i in range(count):
        p = (rnd.uniform(-sx / 2, sx / 2), rnd.uniform(-sy / 2, sy / 2), rnd.uniform(0, sz)); r = flake * rnd.uniform(0.6, 1.4)
        pts.append((p, r))
    for (p, r) in pts:
        for dz in (0.0, sz):
            i0 = len(verts)
            verts += [(p[0] + v[0] * r, p[1] + v[1] * r, p[2] + dz + v[2] * r) for v in ico_v]
            faces += [tuple(i0 + k for k in f) for f in ico_f]
    me = bpy.data.meshes.new(name); me.from_pydata(verts, [], faces); me.update()
    me.materials.append(emissive("flakeM", "#f4f6ff", 2.2))
    o = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(o); o.visible_shadow = False
    for f in range(1, n_frames + 1):
        t = f / lib.FPS
        dz = (t * fall) % sz
        o.location = (cx + 0.25 * math.sin(t * 0.7), cy + 0.15 * math.sin(t * 0.43), cz - sz / 2 - dz)
        o.keyframe_insert("location", frame=f)
    if o.animation_data and o.animation_data.action:
        try:
            for fc in o.animation_data.action.fcurves:
                for k in fc.keyframe_points: k.interpolation = "LINEAR"
        except Exception: pass
    return o


# ------------------------------------------------------------------ the set
def build_street(lit_all=True, flakes=None):
    """lit_all: all windows on (shot 9 animates them itself). Returns anchors + per-house window materials."""
    random.seed(11)
    out = {"houses": {}}
    # ground: snow plane + street tracks + side banks
    gm = M("snow")
    g = MB("ground"); g.poly([(-120, -40, 0), (120, -40, 0), (120, 260, 0), (-120, 260, 0)], gm, unit=6.0); go = g.build(ink=0.0)
    trk = mat("st_track", "#c3c8f4", rough=1.0)
    t = MB("tracks")
    for x in (-3.1, -1.9, 1.4, 2.6, -0.2):
        t.poly([(x - 0.18, -40, 0.01), (x + 0.18, -40, 0.01), (x + 0.18, 54, 0.01), (x - 0.18, 54, 0.01)], trk)
    t.build(ink=0.0)
    # houses
    for (nm, side, y, sid, w, d, h, r, dc, pf) in HOUSES:
        wm = window_mat(nm, lit=lit_all)
        yaw = 90 if side < 0 else -90
        hs = house(nm, (side * (ROW_X + d / 2), y, 0), yaw, w, d, h, r, sid, dc, wm, pfrac=pf)
        hs["win_mat"] = wm; hs["side"] = side
        out["houses"][nm] = hs
    # wife's dark purple Victorian house (windows dark), picket fence, street lamp
    W_ = WIFE
    wm = window_mat("WIFE", lit=False)
    hw = house("WIFE", W_["loc"], 0, W_["w"], W_["d"], W_["h"], W_["r"], "siding_purple", "#2a1830", wm, bay=True, pd=2.2, ridge_x=False)
    hw["win_mat"] = wm; out["houses"]["WIFE"] = hw
    f = MB("fence"); T = M("trim")
    fy = W_["loc"][1] - W_["d"] / 2 - 4.2
    for (x0, x1) in ((-7.5, -1.0), (1.0, 7.5)):
        f.box(((x0 + x1) / 2, fy, 0.55), (x1 - x0, 0.06, 0.08), T); f.box(((x0 + x1) / 2, fy, 0.2), (x1 - x0, 0.06, 0.08), T)
        x = x0
        while x <= x1: f.box((x, fy, 0.4), (0.07, 0.04, 0.8), T); x += 0.2
    f.build(ink=0.015)
    lamp = sets.asset("street_lamp_01", (2.2, fy - 0.6, 0), height=3.6)
    for i, m_ in enumerate(lamp.data.materials):
        if m_ and ("glass" in m_.name or "bulb" in m_.name): lamp.data.materials[i] = emissive("lampGlass", "#ffd090", 9.0)
    light("POINT", "lampL", (2.2, fy - 0.6, 3.3), "#ffbf70", 250, size=0.1, shadow=False)
    # porch lanterns for the lit houses
    out["lanterns"] = {}
    for nm, hs in out["houses"].items():
        if nm == "WIFE": continue
        p = local_to_world(hs, hs["lantern"])
        out["lanterns"][nm] = lantern(nm + "_lan", p, lit=lit_all)
    # hills (with the graveyard crosses), mountains, pines
    hm = mat("st_hill", "#dfe2ff", tex("snow"), rough=1.0)
    for (x, y, sx, sy, sz) in ((-40, 95, 70, 30, 14), (25, 105, 80, 30, 18), (70, 90, 50, 25, 10), (-80, 110, 60, 30, 20)):
        o = lib.add_mesh("sphere", "hill", (x, y, -sz * 0.35), (sx, sy, sz), material=hm, ink=False, segments=48, ring_count=24)
    mm = mat("st_mount", "#c9cdf8", rough=1.0); mr = mat("st_rock", "#5a63b8", rough=1.0)
    for (x, y, rr, hh) in ((-110, 280, 60, 48), (-25, 300, 55, 40), (60, 285, 65, 55), (150, 290, 60, 42), (-190, 285, 55, 38)):
        lib.add_mesh("cone", "mount", (x, y, hh / 2), (rr, rr * 0.7, hh / 2), material=mm, ink=False, vertices=7)
        lib.add_mesh("cone", "mountR", (x + rr * 0.15, y - rr * 0.25, hh * 0.38), (rr * 0.6, rr * 0.4, hh * 0.38), material=mr, ink=False, vertices=6)
    rnd = random.Random(5)
    for i in range(70):
        x = rnd.uniform(-90, 90); y = rnd.uniform(70, 115)
        z = 0.0
        for (hx, hy, sx, sy, sz) in ((-40, 95, 70, 30, 14), (25, 105, 80, 30, 18), (70, 90, 50, 25, 10), (-80, 110, 60, 30, 20)):
            u = ((x - hx) / sx) ** 2 + ((y - hy) / sy) ** 2
            if u < 1: z = max(z, -sz * 0.35 + sz * math.sqrt(1 - u))
        pine((x, y, z - 0.2), rnd.uniform(5, 9))
    for (x, y) in ((-16, 50), (-14, 56), (15, 52), (17, 62), (-18, 66), (14, 70), (-11, 70), (20, 40), (-20, 30), (-19, 12), (21, 18), (22, 30), (-22, 44), (9, 74), (-6, 76)):
        pine((x, y, 0), rnd.uniform(6, 9))
    # graveyard crosses on the near hill
    cm = mat("st_cross", "#8d93d8")
    for i in range(24):
        x = rnd.uniform(-30, 10); y = rnd.uniform(80, 88)
        cb = MB(f"cross{i}"); cb.box((0, 0, 0.6), (0.14, 0.14, 1.2), cm); cb.box((0, 0, 0.85), (0.6, 0.14, 0.14), cm)
        co = cb.build(ink=0.0); co.location = (x, y, 2.5 + (y - 80) * 0.35)
    return out


def street_lights(sun=1.6, warm=1.0):
    light("SUN", "moon", (0, 0, 30), "#a4b0ff", sun, size=0.4, rot=(50, 0, 200))
    light("SUN", "rim", (0, 0, 30), "#c8b8ff", sun * 0.35, size=1.0, rot=(60, 0, -30), shadow=False)
