"""Stickman 3D - Blender toolkit. In this skill Blender only BUILDS sets (and optionally plans legacy cameras): sets_<name>.py
build(state) + lights(state) -> export.py -> public/sets/<name>_<state>.glb (+ anchors json). three.js renders.
Used headless (blender -b -P export.py -- ...) and from the live Blender (MCP) while building sets.
Machine paths come from the project's stickman.json. The card helpers (Card, card_index, gate) are kept only for the
legacy shot modules in package/examples; new films don't use them.
"""
import bpy, json, math, os, shutil
from pathlib import Path
from mathutils import Vector, Matrix

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
CARDS = HERE / "cards"                      # element-000.png ... (CardExport, 1200x1300, feet anchor at 600,1230)
CFG = json.loads((ROOT / "stickman.json").read_text())       # per-project machine config written by stickman.py new
_j = lambda p, d: json.loads(p.read_text()) if p.exists() else d
MANIFEST = _j(HERE / "cards_manifest.json", [])      # legacy (flat cards); empty in 3D projects
META = _j(HERE / "cards_meta.json", {})
DIGITS = int((HERE / "cards_digits.txt").read_text()) if (HERE / "cards_digits.txt").exists() else 4   # Remotion pads 3 or 4
WORDS = _j(ROOT / "src" / "words.json", [])
FPS = 30
CARD_W, CARD_H, ANCHOR = 1200, 1300, (600, 1230)
STAND_PX = 3.2 * 490 * (300 / 512)           # standing figure height in card px (HEADS_TALL * REF_HH * headW/512)
ASSETS = HERE / "assets"
INK = (0.03, 0.02, 0.04, 1)


# ------------------------------------------------------------------ timing
def wf(i, lead=2):
    """frame (1-based for Blender) where word i starts, minus `lead` frames."""
    return max(1, round(WORDS[i]["s"] * FPS) - lead + 1)


def rgb(h, a=1.0):
    h = h.lstrip("#"); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c) + (a,)


def ease(u):
    u = max(0.0, min(1.0, u)); return u * u * u * (u * (6 * u - 15) + 10)


# ------------------------------------------------------------------ scene
# DRAFT mode (STICK_DRAFT=1, set by `stickman.py render --draft`): first look for the user, fast over pretty.
# 360x640, 4 samples, cheap shadows/volumes, no depth of field, every 2nd frame rendered (post.py holds it twice).
DRAFT = bool(os.environ.get("STICK_DRAFT"))


def reset(frames, res=(1080, 1920), preview=False):
    bpy.ops.wm.read_homefile(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = "BLENDER_EEVEE"
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.resolution_percentage = 50 if preview else 100
    if DRAFT and not preview: sc.render.resolution_x, sc.render.resolution_y = 360, 640
    if os.environ.get("BELL_RES") and not preview: sc.render.resolution_x, sc.render.resolution_y = map(int, os.environ["BELL_RES"].split("x"))
    sc.render.fps = FPS
    sc.frame_start, sc.frame_end = 1, frames
    sc.view_settings.view_transform = "Standard"
    sc.view_settings.look = "None"
    sc.render.film_transparent = False
    ee = sc.eevee
    for k, v in (("taa_render_samples", 12 if not preview else 8), ("use_shadows", True), ("use_raytracing", False),
                 ("shadow_ray_count", 2), ("shadow_step_count", 8), ("volumetric_tile_size", "16"), ("use_volumetric_shadows", True)):
        if hasattr(ee, k):
            try: setattr(ee, k, v)
            except Exception: pass
    if DRAFT:
        for k, v in (("taa_render_samples", 4), ("shadow_ray_count", 1), ("shadow_step_count", 4), ("volumetric_samples", 16),
                     ("volumetric_tile_size", "16"), ("use_volumetric_shadows", False)):
            if hasattr(ee, k):
                try: setattr(ee, k, v)
                except Exception: pass
    sc.render.image_settings.file_format = "PNG"
    return sc


def world(col, strength=1.0, haze=0.0, haze_col="#ffffff"):
    w = bpy.data.worlds.new("World"); bpy.context.scene.world = w
    w.use_nodes = True; nt = w.node_tree; nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputWorld"); bg = nt.nodes.new("ShaderNodeBackground")
    bg.inputs[0].default_value = rgb(col); bg.inputs[1].default_value = strength
    nt.links.new(bg.outputs[0], out.inputs["Surface"])
    if haze > 0:
        vs = nt.nodes.new("ShaderNodeVolumeScatter"); vs.inputs["Density"].default_value = haze
        vs.inputs["Color"].default_value = rgb(haze_col); vs.inputs["Anisotropy"].default_value = 0.5
        nt.links.new(vs.outputs[0], out.inputs["Volume"])
    return w


def compositor(bloom=0.6, vign=0.5, vign_col="#2a1f3d", sat=1.05):
    """bloom (glare fog-glow on bright pixels) + coloured oval vignette + saturation, like the reference grade."""
    sc = bpy.context.scene
    sc.use_nodes = True
    nt = sc.compositing_node_group if hasattr(sc, "compositing_node_group") and sc.compositing_node_group else None
    if nt is None:
        if hasattr(sc, "compositing_node_group"):
            nt = bpy.data.node_groups.new("Comp", "CompositorNodeTree"); sc.compositing_node_group = nt
        else:
            nt = sc.node_tree
    nt.nodes.clear()
    rl = nt.nodes.new("CompositorNodeRLayers")
    try:
        out = nt.nodes.new("NodeGroupOutput"); nt.interface.new_socket("Image", in_out="OUTPUT", socket_type="NodeSocketColor")
    except Exception:
        out = nt.nodes.new("CompositorNodeComposite")
    gl = nt.nodes.new("CompositorNodeGlare")
    for k, v in (("glare_type", "FOG_GLOW"), ("quality", "HIGH"), ("threshold", 1.0), ("size", 8), ("mix", bloom - 1.0)):
        try: setattr(gl, k, v)
        except Exception: pass
    _set_in(gl, "Threshold", 1.0); _set_in(gl, "Strength", bloom); _set_in(gl, "Size", 0.6)
    for sock in gl.inputs:                       # Blender 5.x: glare type / quality are menu inputs
        if sock.name == "Type":
            for v in ("Fog Glow", "FOG_GLOW", "Bloom"):
                try: sock.default_value = v; break
                except Exception: pass
        if sock.name == "Quality":
            try: sock.default_value = "High"
            except Exception: pass
    hs = nt.nodes.new("CompositorNodeHueSat"); _set_in(hs, "Saturation", sat)
    em = nt.nodes.new("CompositorNodeEllipseMask")
    for k, v in (("width", 0.95), ("height", 0.75)):
        try: setattr(em, k, v)
        except Exception: _set_in(em, k.capitalize(), v)
    _set_in(em, "Size", (0.95, 0.75))
    bl = nt.nodes.new("CompositorNodeBlur")
    for k, v in (("size_x", 300), ("size_y", 300), ("filter_type", "FAST_GAUSS")):
        try: setattr(bl, k, v)
        except Exception: pass
    _set_in(bl, "Size", (300, 300))
    mix = nt.nodes.new("CompositorNodeMixRGB") if hasattr(bpy.types, "CompositorNodeMixRGB") else nt.nodes.new("ShaderNodeMix")
    try: mix.blend_type = "MULTIPLY"
    except Exception: pass
    try: mix.data_type = "RGBA"
    except Exception: pass
    vc = rgb(vign_col)
    L = nt.links.new
    L(rl.outputs["Image"], gl.inputs[0] if gl.inputs[0].name != "Threshold" else gl.inputs["Image"])
    L(gl.outputs[0], hs.inputs["Image"])
    L(em.outputs[0], bl.inputs[0] if bl.inputs[0].type != "VALUE" else bl.inputs["Image"])
    # vignette colour: lerp(vign_col*1.6, white, mask) multiplied over the image
    mv = nt.nodes.new("CompositorNodeMixRGB") if hasattr(bpy.types, "CompositorNodeMixRGB") else nt.nodes.new("ShaderNodeMix")
    try: mv.data_type = "RGBA"
    except Exception: pass
    _mix_inputs(mv, factor_link=bl.outputs[0], a=tuple(min(1, c * 1.6) for c in vc[:3]) + (1,), b=(1, 1, 1, 1), nt=nt)
    _mix_inputs(mix, factor=vign, a_link=hs.outputs["Image"], b_link=_mix_out(mv), nt=nt)
    L(_mix_out(mix), out.inputs[0])
    return nt


def _set_in(node, name, val):
    for s in node.inputs:
        if s.name.lower() == name.lower():
            try: s.default_value = val
            except Exception: pass
            return True
    return False


def _mix_inputs(node, nt, factor=None, factor_link=None, a=None, b=None, a_link=None, b_link=None):
    ins = [s for s in node.inputs if s.enabled]
    fac = ins[0]; cols = [s for s in ins[1:] if s.type in ("RGBA", "VECTOR")][:2]
    if factor_link is not None: nt.links.new(factor_link, fac)
    elif factor is not None: fac.default_value = factor
    for s, v, l in ((cols[0], a, a_link), (cols[1], b, b_link)):
        if l is not None: nt.links.new(l, s)
        elif v is not None: s.default_value = v


def _mix_out(node):
    for s in node.outputs:
        if s.enabled and s.type == "RGBA": return s
    return node.outputs[0]


# ------------------------------------------------------------------ materials
def mat(name, col="#ffffff", tex=None, rough=0.85, emit=0.0, emit_col=None, alpha=None, repeat=(1, 1)):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial"); p = nt.nodes.new("ShaderNodeBsdfPrincipled")
    p.inputs["Base Color"].default_value = rgb(col); p.inputs["Roughness"].default_value = rough
    _set_in(p, "Specular IOR Level", 0.15)
    if tex:
        ti = nt.nodes.new("ShaderNodeTexImage"); ti.image = bpy.data.images.load(str(tex), check_existing=True)
        if repeat != (1, 1):
            tc = nt.nodes.new("ShaderNodeTexCoord"); mp = nt.nodes.new("ShaderNodeMapping"); mp.inputs["Scale"].default_value = (repeat[0], repeat[1], 1)
            nt.links.new(tc.outputs["UV"], mp.inputs[0]); nt.links.new(mp.outputs[0], ti.inputs[0])
        mx = nt.nodes.new("ShaderNodeMix"); mx.data_type = "RGBA"; mx.blend_type = "MULTIPLY"; mx.inputs[0].default_value = 1.0
        mx.inputs[6].default_value = rgb(col); nt.links.new(ti.outputs[0], mx.inputs[7]); nt.links.new(mx.outputs[2], p.inputs["Base Color"])
    if emit > 0:
        p.inputs["Emission Color"].default_value = rgb(emit_col or col); p.inputs["Emission Strength"].default_value = emit
    if alpha is not None:
        p.inputs["Alpha"].default_value = alpha
    nt.links.new(p.outputs[0], out.inputs["Surface"])
    return m


def emissive(name, col, strength=4.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial"); e = nt.nodes.new("ShaderNodeEmission")
    e.inputs[0].default_value = rgb(col); e.inputs[1].default_value = strength
    nt.links.new(e.outputs[0], out.inputs["Surface"]); return m


def ink_material():
    m = bpy.data.materials.get("INK")
    if m: return m
    m = bpy.data.materials.new("INK"); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial"); e = nt.nodes.new("ShaderNodeEmission"); e.inputs[0].default_value = INK
    nt.links.new(e.outputs[0], out.inputs["Surface"])
    m.use_backface_culling = True
    try: m.use_backface_culling_shadow = True
    except Exception: pass
    return m


def outline(o, width=0.012):
    """inverted-hull ink line: solidify with flipped normals + a back-face-culled black material."""
    if o.type != "MESH" or o.get("no_ink"): return
    ink = ink_material()
    if ink.name not in [m.name for m in o.data.materials if m]: o.data.materials.append(ink)
    s = o.modifiers.new("ink", "SOLIDIFY"); s.thickness = width; s.offset = 1.0; s.use_flip_normals = True
    s.use_rim = False; s.material_offset = len(o.data.materials) - 1


def toonify(objs, width=0.012, sat=1.15, rough=0.9, pbr=True):
    """make imported (Poly Haven / Kenney) props read like the reference: matte, saturated, ink outlined.
    pbr=True (default since 2026-11-17): the asset's normal and roughness maps stay linked (wear, small highlights in the
    three.js toon shader); metallic / specular maps are dropped. pbr=False = the old flat look (all maps unlinked)."""
    for o in objs:
        if o.type != "MESH": continue
        for m in o.data.materials:
            if not m or not m.use_nodes or m.name == "INK": continue
            for n in m.node_tree.nodes:
                if n.type == "BSDF_PRINCIPLED":
                    if not (pbr and n.inputs["Roughness"].is_linked): n.inputs["Roughness"].default_value = rough
                    for k in ("Metallic",):
                        if not n.inputs[k].is_linked: n.inputs[k].default_value = min(n.inputs[k].default_value, 0.3)
                    _set_in(n, "Specular IOR Level", 0.15)
                    drop = ("Metallic", "Specular IOR Level") + (() if pbr else ("Normal", "Roughness"))
                    for l in list(m.node_tree.links):
                        if l.to_node == n and l.to_socket.name in drop:
                            m.node_tree.links.remove(l)
                    if n.inputs["Base Color"].is_linked and sat != 1.0:
                        src = n.inputs["Base Color"].links[0].from_socket
                        hs = m.node_tree.nodes.new("ShaderNodeHueSaturation"); hs.inputs["Saturation"].default_value = sat
                        m.node_tree.links.new(src, hs.inputs["Color"]); m.node_tree.links.new(hs.outputs[0], n.inputs["Base Color"])
        outline(o, width)


# ------------------------------------------------------------------ geometry
def add_mesh(kind, name, loc=(0, 0, 0), scale=(1, 1, 1), rot=(0, 0, 0), material=None, ink=True, **kw):
    fn = {"cube": bpy.ops.mesh.primitive_cube_add, "plane": bpy.ops.mesh.primitive_plane_add, "cyl": bpy.ops.mesh.primitive_cylinder_add,
          "sphere": bpy.ops.mesh.primitive_uv_sphere_add, "cone": bpy.ops.mesh.primitive_cone_add, "torus": bpy.ops.mesh.primitive_torus_add}[kind]
    fn(location=loc, rotation=[math.radians(r) for r in rot], **kw)
    o = bpy.context.active_object; o.name = name; o.scale = scale
    if material: o.data.materials.append(material)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if kind in ("cyl", "sphere", "cone", "torus"): bpy.ops.object.shade_smooth()
    if ink: outline(o)
    return o


def box(name, center, size, material, rot=(0, 0, 0), ink=True):
    return add_mesh("cube", name, center, (size[0] / 2, size[1] / 2, size[2] / 2), rot, material, ink)


def append_blend(path, collection=None):
    """append every object (or one collection) from an asset .blend; returns the new objects."""
    with bpy.data.libraries.load(str(path), link=False) as (src, dst):
        if collection: dst.collections = [c for c in src.collections if c == collection]
        else: dst.objects = list(src.objects)
    new = []
    if collection:
        for c in dst.collections: bpy.context.scene.collection.children.link(c); new += list(c.all_objects)
    else:
        for o in dst.objects:
            if o: bpy.context.scene.collection.objects.link(o); new.append(o)
    return new


def import_glb(path, loc=(0, 0, 0), yaw=0.0, scale=1.0, ink=True):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    new = [o for o in bpy.data.objects if o not in before]
    root = bpy.data.objects.new(Path(path).stem, None); bpy.context.scene.collection.objects.link(root)
    for o in new:
        if o.parent is None: o.parent = root
    root.location = loc; root.rotation_euler.z = math.radians(yaw); root.scale = (scale,) * 3
    if ink: toonify(new)
    return root, new


# ------------------------------------------------------------------ characters (flat cards)
def card_index(who, expr, pose, blink=0, mouth=0.0, prop=None, facing=1, clip=None, cf=0):
    """pose 'rig' + clip (Mixamo motion: Digging, Pull_Heavy_Object) + cf (clip frame, nearest exported one)."""
    if clip:
        cands = [e for e in MANIFEST if e.get("clip") == clip and e["who"] == who and e["expr"] == expr and (e["prop"] or None) == (prop or None)]
        if cands: return min(cands, key=lambda e: abs(e["cf"] - cf))["id"]
    for e in MANIFEST:
        if e.get("clip"): continue
        if e["who"] == who and e["expr"] == expr and e["pose"] == pose and e["blink"] == blink and abs(e["mouth"] - mouth) < 1e-3                 and (e["prop"] or None) == (prop or None) and e["facing"] == facing:
            return e["id"]
    raise KeyError(f"no card {who} {expr} {pose} b{blink} m{mouth} {prop}")


class Card:
    """a flat character: plane with a per-frame image sequence (hard-linked manifest PNGs), yaw-billboarded to the
    camera, lightly lit by the scene (emission x tint + a little diffuse) so it stays flat like the reference."""
    def __init__(self, shot_dir, name, height=1.75, tint="#ffffff", cam=None, lit=0.25):
        self.name, self.height = name, height
        self.unit = height / STAND_PX
        self.seq = Path(shot_dir) / "cards" / name; shutil.rmtree(self.seq, ignore_errors=True); self.seq.mkdir(parents=True)
        self.frames = {}
        self.root = bpy.data.objects.new(name, None); bpy.context.scene.collection.objects.link(self.root)
        bpy.ops.mesh.primitive_plane_add(size=1)
        p = bpy.context.active_object; p.name = name + "_card"
        p.scale = (CARD_W * self.unit, CARD_H * self.unit, 1); bpy.ops.object.transform_apply(scale=True)
        # anchor (feet) at the origin: shift the plane so its anchor pixel sits at 0
        ax = (ANCHOR[0] / CARD_W - 0.5) * CARD_W * self.unit; ay = (0.5 - ANCHOR[1] / CARD_H) * CARD_H * self.unit
        for v in p.data.vertices: v.co.x -= ax; v.co.y -= ay
        p.rotation_euler.x = math.radians(90); p.parent = self.root
        p["no_ink"] = True
        self.plane = p
        self.tint, self.lit = tint, lit
        if cam is not None:
            c = self.root.constraints.new("LOCKED_TRACK"); c.target = cam; c.track_axis = "TRACK_NEGATIVE_Y"; c.lock_axis = "LOCK_Z"
            # the plane faces -Y after the 90 deg X rotation, so track -Y... flip if it renders mirrored
        self.mat = None

    def key(self, f, who, expr, pose, blink=0, mouth=0.0, prop=None, facing=1, clip=None, cf=0):
        self.frames[f] = card_index(who, expr, pose, blink, mouth, prop, facing, clip, cf)

    def finish(self, n_frames):
        """fill every frame from the last keyed state, hard-link the PNGs as a sequence, build the material."""
        cur = None
        for f in range(1, n_frames + 1):
            cur = self.frames.get(f, cur)
            if cur is None: cur = next(iter(sorted(self.frames.items())))[1]
            dst = self.seq / f"{f:04d}.png"
            src = CARDS / f"element-{cur:0{DIGITS}d}.png"
            try: os.link(src, dst)
            except Exception: shutil.copyfile(src, dst)
        img = bpy.data.images.load(str(self.seq / "0001.png")); img.source = "SEQUENCE"
        m = bpy.data.materials.new(self.name + "_m"); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
        out = nt.nodes.new("ShaderNodeOutputMaterial"); ti = nt.nodes.new("ShaderNodeTexImage"); ti.image = img
        iu = ti.image_user; iu.frame_duration = n_frames; iu.frame_start = 1; iu.frame_offset = 0; iu.use_auto_refresh = True; iu.use_cyclic = False
        ti.interpolation = "Cubic"
        em = nt.nodes.new("ShaderNodeEmission"); df = nt.nodes.new("ShaderNodeBsdfDiffuse")
        tint = nt.nodes.new("ShaderNodeMix"); tint.data_type = "RGBA"; tint.blend_type = "MULTIPLY"; tint.inputs[0].default_value = 1.0
        tint.inputs[7].default_value = rgb(self.tint)
        nt.links.new(ti.outputs["Color"], tint.inputs[6])
        nt.links.new(tint.outputs[2], em.inputs[0]); nt.links.new(ti.outputs["Color"], df.inputs[0])
        add = nt.nodes.new("ShaderNodeAddShader")
        em.inputs[1].default_value = 1.0 - self.lit
        sc = nt.nodes.new("ShaderNodeMixShader"); sc.inputs[0].default_value = self.lit
        nt.links.new(em.outputs[0], sc.inputs[1]); nt.links.new(df.outputs[0], sc.inputs[2])
        tr = nt.nodes.new("ShaderNodeBsdfTransparent"); mixa = nt.nodes.new("ShaderNodeMixShader")
        clipa = nt.nodes.new("ShaderNodeMath"); clipa.operation = "GREATER_THAN"; clipa.inputs[1].default_value = 0.5   # hard cut-out edge
        nt.links.new(ti.outputs["Alpha"], clipa.inputs[0]); nt.links.new(clipa.outputs[0], mixa.inputs[0]); nt.links.new(tr.outputs[0], mixa.inputs[1])
        if self.lit > 0:
            add2 = nt.nodes.new("ShaderNodeAddShader"); nt.links.new(em.outputs[0], add2.inputs[0]); nt.links.new(df.outputs[0], add2.inputs[1])
            em.inputs[1].default_value = 1.0 - self.lit
            dfw = nt.nodes.new("ShaderNodeMixShader"); dfw.inputs[0].default_value = self.lit
            nt.links.new(em.outputs[0], dfw.inputs[1]); nt.links.new(add2.outputs[0], dfw.inputs[2])
            nt.links.new(dfw.outputs[0], mixa.inputs[2])
        else:
            nt.links.new(em.outputs[0], mixa.inputs[2])
        nt.links.new(mixa.outputs[0], out.inputs["Surface"])
        try: m.surface_render_method = "DITHERED"
        except Exception: pass
        m.use_backface_culling = False
        self.plane.data.materials.append(m); self.mat = m
        self.plane.visible_shadow = False
        return self

    def at(self, f, loc, scale=1.0, tilt=0.0):
        self.root.location = loc; self.root.scale = (scale,) * 3; self.plane.rotation_euler.y = math.radians(tilt)
        self.root.keyframe_insert("location", frame=f); self.root.keyframe_insert("scale", frame=f); self.plane.keyframe_insert("rotation_euler", frame=f)

    def hide(self, f, hidden=True):
        for o in (self.root, self.plane):
            o.hide_render = hidden; o.keyframe_insert("hide_render", frame=f)

    def head(self, loc, who, expr, pose, prop=None, scale=1.0):
        """head-centre world position of that card state with its feet at loc (measured from the PNG, cards_meta.json)."""
        m = META[str(card_index(who, expr, pose, 0, 0.0, prop))]
        return (loc[0], loc[1], loc[2] + (ANCHOR[1] - m["hy"]) * self.unit * scale)


# ------------------------------------------------------------------ camera
def camera(name="Cam", lens=35):
    c = bpy.data.cameras.new(name); c.lens = lens; c.sensor_fit = "VERTICAL"; c.sensor_height = 24
    c.clip_start, c.clip_end = 0.05, 400
    o = bpy.data.objects.new(name, c); bpy.context.scene.collection.objects.link(o); bpy.context.scene.camera = o
    return o


def fov_to_lens(vfov_deg): return 12.0 / math.tan(math.radians(vfov_deg) / 2)


def look_at(o, pos, look, roll=0.0):
    o.location = pos
    d = Vector(look) - Vector(pos)
    q = d.to_track_quat("-Z", "Y"); o.rotation_euler = q.to_euler()
    if roll: o.rotation_euler.rotate_axis("Z", roll)


def push(pos, look, f, f0, rate=0.128):
    """the channel's default dolly-in toward `look`: 0.128 log-zoom/s ~ 14 %/s closer."""
    k = math.exp(-rate * max(0, f - f0) / FPS)
    return tuple(l + (p - l) * k for p, l in zip(pos, look)), look


def arc(look, f, f0, f1, a0, a1, r0, r1, z0, z1):
    """THE DEFAULT MOVE (LOOK.md -> Depth): orbit around `look` from angle a0 to a1 (degrees, 0 = +X, -90 = camera
    on -Y looking +Y) while the radius closes r0 -> r1 and the height goes z0 -> z1, eased. Returns (pos, look)."""
    u = ease((f - f0) / max(1, f1 - f0)); a = math.radians(a0 + (a1 - a0) * u); r = r0 + (r1 - r0) * u
    return (look[0] + math.cos(a) * r, look[1] + math.sin(a) * r, z0 + (z1 - z0) * u), tuple(look)


def glide(a, b, f, f0, f1):
    k = ease((f - f0) / max(1, f1 - f0))
    return tuple(x + (y - x) * k for x, y in zip(a[0], b[0])), tuple(x + (y - x) * k for x, y in zip(a[1], b[1]))


def spike(pl, f, fc, k, dur=9):
    pos, look = pl; u = ease((f - (fc - dur / 2)) / dur); s = math.exp(-k * u)
    return tuple(l + (p - l) * s for p, l in zip(pos, look)), look


def bake_camera(cam, n, fn, vfov=40, dof=None):
    """fn(f) -> (pos, look[, vfov[, roll]]) for every frame 1..n; dof(f) -> (focus_distance, fstop) or None."""
    cam.animation_data_clear(); cam.data.animation_data_clear()
    for f in range(1, n + 1):
        r = fn(f); pos, look = r[0], r[1]; fv = r[2] if len(r) > 2 else vfov; roll = r[3] if len(r) > 3 else 0.0
        look_at(cam, pos, look, roll); cam.data.lens = fov_to_lens(fv)
        cam.keyframe_insert("location", frame=f); cam.keyframe_insert("rotation_euler", frame=f); cam.data.keyframe_insert("lens", frame=f)
        if dof:
            d = None if DRAFT else dof(f)
            cam.data.dof.use_dof = bool(d)
            if d:
                cam.data.dof.focus_distance, cam.data.dof.aperture_fstop = d
                cam.data.dof.keyframe_insert("focus_distance", frame=f); cam.data.dof.keyframe_insert("aperture_fstop", frame=f)


# ------------------------------------------------------------------ lights
def light(kind, name, loc, col="#ffffff", energy=100, size=0.5, rot=None, target=None, spot=None, shadow=True):
    d = bpy.data.lights.new(name, kind); d.color = rgb(col)[:3]; d.energy = energy
    if hasattr(d, "shadow_soft_size"): d.shadow_soft_size = size
    if kind == "SPOT" and spot: d.spot_size = math.radians(spot[0]); d.spot_blend = spot[1]
    if kind == "SUN": d.angle = math.radians(size * 10)
    d.use_shadow = shadow
    o = bpy.data.objects.new(name, d); bpy.context.scene.collection.objects.link(o); o.location = loc
    if target: look_at(o, loc, target)
    elif rot: o.rotation_euler = [math.radians(r) for r in rot]
    return o


# ------------------------------------------------------------------ QA (placement gate)
def ground_z(x, y, z0=5.0, ignore=()):
    dg = bpy.context.evaluated_depsgraph_get()
    hit, loc, n, i, obj, mtx = bpy.context.scene.ray_cast(dg, Vector((x, y, z0)), Vector((0, 0, -1)))
    while hit and (obj.name.endswith("_card") or obj in ignore or obj.get("no_ground")):
        hit, loc, n, i, obj, mtx = bpy.context.scene.ray_cast(dg, loc - Vector((0, 0, 0.001)), Vector((0, 0, -1)))
    return loc.z if hit else 0.0


def gate(cards, frames, exempt=()):
    """every visible card's feet must sit on the surface under it (within 3 cm) unless exempt (sitting, buried...)."""
    bad = []
    sc = bpy.context.scene
    for f in frames:
        sc.frame_set(f)
        for c in cards:
            if c.name in exempt or c.root.hide_render: continue
            p = c.root.matrix_world.translation
            g = ground_z(p.x, p.y, p.z + 1.0)
            if abs(p.z - g) > 0.03: bad.append((f, c.name, round(p.z - g, 3)))
    return bad


# ------------------------------------------------------------------ render
def render(out_dir, frames=None, still=None):
    sc = bpy.context.scene
    out_dir = Path(out_dir); out_dir.mkdir(parents=True, exist_ok=True)
    if still is not None:
        for f in still:
            sc.frame_set(f); sc.render.filepath = str(out_dir / f"still_{f:04d}.png"); bpy.ops.render.render(write_still=True)
        return
    sc.render.filepath = str(out_dir / "f_")
    if frames: sc.frame_start, sc.frame_end = frames
    elif DRAFT: sc.frame_step = 2                              # odd local frames only; post.py --draft holds each twice
    bpy.ops.render.render(animation=True)
