"""Export one Blender set to three.js:  blender -b -P blender/export.py -- --set graveyard --state night [--bake]
(stickman3d.py export runs this). Builds the set with sets_<name>.py, then writes
  public/sets/<name>_<state>.glb   the set (real textures, modifiers applied, no ink hulls, no lights, no camera)
  public/sets/<name>_<state>.json  anchors (empties named anchor_* and points the build returns), lights, warnings

Set module contract (sets_<name>.py): build(state) -> dict of anchors/objects  (or build_<name>(state))
                                       lights(state) (optional; or <name>_lights(state)): only read for their directions
Object custom properties travel to three.js as userData (glTF extras):  o["no_ink"] = 1  -> no post ink on it
(striped decorations, snow caps, grass cards, anything thin or many-part).

--bake [--bake-res 1024]: glTF carries a colour only as "image" or "image x constant colour". Materials whose Base
Color (or emission) comes from other nodes (HSV recolours of a kit, procedural noise, math) are baked to textures
first (Cycles EMIT bake on the CPU, PNGs in blender/tex/baked/). Colour that depends only on UV (kit recolours) is
baked over the whole UV square, so atlases with collapsed UVs keep every swatch; colour that depends on position or
normals gets fresh non-overlapping UVs (layer "bake") per mesh. Emission keeps an emissive texture + strength.

--module <file.py> imports the build module from a file instead of sets_<name>.py, --out <path.glb> writes the GLB (and
the .json beside it) there instead of public/sets/<name>_<state>.glb: `stickman3d.py vehicle` uses both
(package/tools/vehicle_build.py -> public/vehicles/<id>.glb).

WebGL checks (WARN; fix every one):
  material that would lose its node colour (export with --bake)
  material without a Principled BSDF (Mix / Transparent shaders): exported opaque;  o["beam"] = 1 for light shafts
  open shell: holes and no wall thickness -> FrontSide culls its inside (give it a SOLIDIFY wall);  o["open_ok"] = 1
  coplanar faces: two objects' faces < 1 cm apart, same facing, overlapping -> z-fight + black ink blob;  o["coplanar_ok"] = 1
  more than 1.5 M polygons.  Real scale (1 unit = 1 m)."""
import bpy, sys, json, importlib, re, time
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
ARGV = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
def arg(name, default=None):
    return ARGV[ARGV.index(name) + 1] if name in ARGV else default

NAME = arg("--set"); STATE = arg("--state", "day")
BAKE = "--bake" in ARGV; BAKE_RES = int(arg("--bake-res", 1024))
LIGHT = "--light" in ARGV                                     # bake bounce light + AO into lightmaps (see light_bake)
LIGHT_RES = int(arg("--light-res", 1024)); LIGHT_SAMPLES = int(arg("--light-samples", 256))
LIGHT_DENSITY = float(arg("--light-density", 64))             # lightmap px per metre (sqrt of the surface area)
LIGHT_PX = float(arg("--light-px", 3.5e6))                    # pixel budget of the atlas (density drops to fit)
MODULE = arg("--module"); OUT_GLB = arg("--out")
if not NAME: sys.exit("usage: blender -b -P export.py -- --set <name> [--state <state>] [--bake [--bake-res 1024]] [--module f.py] [--out f.glb]")
OUT = Path(OUT_GLB).parent if OUT_GLB else HERE.parent / "public" / "sets"; OUT.mkdir(parents=True, exist_ok=True)
t0 = time.time()
import lib
bpy.ops.wm.read_homefile(use_empty=True)
if MODULE:     # a build module outside blender/ (e.g. package/tools/vehicle_build.py)
    import importlib.util
    _spec = importlib.util.spec_from_file_location(Path(MODULE).stem, MODULE)
    mod = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(mod)
else:
    mod = importlib.import_module(f"sets_{NAME}")
build = getattr(mod, "build", None) or getattr(mod, f"build_{NAME}")
lights_fn = getattr(mod, "lights", None) or getattr(mod, f"{NAME}_lights", None)
ret = build(STATE) or {}
if lights_fn: lights_fn(STATE)
bpy.context.view_layer.update()
t_build = time.time() - t0

def v3(v): v = Vector(v); return [round(v.x, 4), round(v.z, 4), round(-v.y, 4)]    # Blender Z-up -> three Y-up

anchors = {}
for k, v in ret.items():
    if isinstance(v, (tuple, list, Vector)) and len(v) == 3 and all(isinstance(x, (int, float)) for x in v): anchors[k] = v3(v)
    elif isinstance(v, bpy.types.Object): anchors[k] = v3(v.matrix_world.translation)
for o in bpy.data.objects:
    if o.type == "EMPTY" and o.name.startswith("anchor_"): anchors[o.name[7:]] = v3(o.matrix_world.translation)

lights = []
for o in bpy.data.objects:
    if o.type != "LIGHT": continue
    d = o.matrix_world.to_3x3() @ Vector((0, 0, 1))
    lights.append(dict(name=o.name, kind=o.data.type, color=[round(x, 4) for x in o.data.color], energy=round(o.data.energy, 3),
                       pos=v3(o.matrix_world.translation), dir=v3(d)))
    if o.data.type == "SPOT":   # WORLD2 2026-11-21: cone for three.js SetLights (dir points AWAY from the beam)
        lights[-1].update(angle=round(o.data.spot_size / 2, 4), blend=round(o.data.spot_blend, 3))

# strip what three.js does itself; drop hidden objects (lights stay until the --light bake has used them)
for o in list(bpy.data.objects):
    if (o.type == "LIGHT" and not LIGHT) or o.type == "CAMERA" or o.hide_render:
        bpy.data.objects.remove(o, do_unlink=True); continue
    if o.type == "MESH":
        for md in list(o.modifiers):
            if md.type == "SOLIDIFY" and md.name == "ink": o.modifiers.remove(md)
        if o.get("no_ink"): o["no_ink"] = 1
MESHES = [o for o in bpy.data.objects if o.type == "MESH"]
bpy.context.view_layer.update()

# ------------------------------------------------------------------ materials glTF cannot carry
warnings = []
def _src(sock):
    return sock.links[0].from_node if sock.is_linked else None

def _gltf_ok(sock):
    """unlinked, an image, or an image x constant colour (lib.mat's MULTIPLY mix): glTF keeps it"""
    n = _src(sock)
    if n is None or n.type == "TEX_IMAGE": return True
    if n.type in ("MIX", "MIX_RGB") and n.blend_type == "MULTIPLY" and not n.inputs[0].is_linked:
        linked = [s for s in n.inputs if s.enabled and s.type == "RGBA" and s.is_linked]
        return len(linked) == 1 and linked[0].links[0].from_node.type == "TEX_IMAGE"
    return False

def _emits(b):
    s, c = b.inputs["Emission Strength"], b.inputs["Emission Color"]
    if not s.is_linked and s.default_value <= 0: return False
    if not c.is_linked and max(c.default_value[:3]) <= 0: return False
    return True

used = {s.material for o in MESHES for s in o.material_slots if s.material}
todo = {}          # material -> {"base": bool, "emit": bool, "bsdf": node}
for m in sorted(used, key=lambda m: m.name):
    if not m.use_nodes or m.name == "INK": continue
    nt = m.node_tree
    b = next((n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"), None)
    if not b:
        # glTF only reads a Principled BSDF (or a bare Emission): Mix / Transparent / Add shaders arrive as an opaque,
        # double-sided slab (black base + emission), e.g. a fake light shaft drawn over the whole frame
        users = [o for o in MESHES if any(sl.material is m for sl in o.material_slots)]
        if users and all(o.get("beam") for o in users): continue          # three.js draws beams itself (world/set.ts)
        out = next((n for n in nt.nodes if n.type == "OUTPUT_MATERIAL" and n.is_active_output), None)
        if out is None or not out.inputs["Surface"].is_linked or _src(out.inputs["Surface"]).type == "EMISSION": continue  # glow: fine
        kinds = sorted({n.type for n in nt.nodes if n.type not in ("OUTPUT_MATERIAL", "TEX_COORD", "MAPPING", "UVMAP")})[:4]
        warnings.append(f"material {m.name} ({', '.join(o.name for o in users[:3])}): no Principled BSDF ({'/'.join(kinds)}) -> glTF "
                        f"exports it opaque (black base + emission); rebuild it on a Principled BSDF (Alpha + BLENDED for "
                        f"see-through) or, for a light shaft, tag the object o['beam'] = 1 (sets.py light_beam)")
        continue
    n = _src(b.inputs["Base Color"])
    # lib.toonify's saturation boost sits between the texture and the shader: glTF would lose the texture; the three.js
    # grade does saturation anyway, so link the texture straight through
    if n is not None and n.type == "HUE_SAT" and n.inputs["Color"].is_linked:
        nt.links.new(n.inputs["Color"].links[0].from_socket, b.inputs["Base Color"]); nt.nodes.remove(n)
    base = not _gltf_ok(b.inputs["Base Color"])
    emit = _emits(b) and not (_gltf_ok(b.inputs["Emission Color"]) and not b.inputs["Emission Strength"].is_linked)
    if base or emit: todo[m] = dict(base=base, emit=emit, bsdf=b)
    if not BAKE:
        if base:
            warnings.append(f"material {m.name}: Base Color comes from a {_src(b.inputs['Base Color']).type} node -> three.js "
                            f"gets only a flat colour; export with --bake (or bake it in the set file)")
        if emit:
            warnings.append(f"material {m.name}: emission comes from nodes -> three.js gets a flat or no glow; export with --bake")

# ------------------------------------------------------------------ --bake
NOT_UV = {"NEW_GEOMETRY", "OBJECT_INFO", "ATTRIBUTE", "VERTEX_COLOR", "AMBIENT_OCCLUSION", "BEVEL", "LAYER_WEIGHT",
          "FRESNEL", "LIGHT_PATH", "PARTICLE_INFO", "WIREFRAME", "TANGENT", "CAMERA"}
PROCEDURAL = {"TEX_NOISE", "TEX_VORONOI", "TEX_WAVE", "TEX_MUSGRAVE", "TEX_GRADIENT", "TEX_MAGIC", "TEX_BRICK",
              "TEX_CHECKER", "TEX_WHITE_NOISE", "TEX_GABOR", "TEX_ENVIRONMENT", "TEX_SKY"}

def _uv_names(sock):
    """the UV maps the colour reaching `sock` reads ("" = the active one), or None when it also depends on position,
    normals, attributes or procedural coordinates. Colour that reads one UV map only is baked once over the UV square,
    which fits every mesh that uses the material, whatever its UV layout (glTF imports name theirs in a UV Map node)"""
    seen, stack, names = set(), [sock], set()
    while stack:
        for l in stack.pop().links:
            n = l.from_node
            if n.type == "TEX_COORD":
                if l.from_socket.name != "UV": return None
                names.add("")
            if n.type == "UVMAP": names.add(n.uv_map)
            if n.type in NOT_UV: return None
            if n.type in PROCEDURAL and not n.inputs["Vector"].is_linked: return None
            if n.type == "TEX_IMAGE" and not n.inputs["Vector"].is_linked: names.add("")
            if n.name not in seen:
                seen.add(n.name); stack += [i for i in n.inputs if i.is_linked]
    return names

def _lin2srgb(x):
    x = np.clip(x, 0, 1)
    return np.where(x <= 0.0031308, x * 12.92, 1.055 * np.power(x, 1 / 2.4) - 0.055)

def _safe(s): return re.sub(r"[^A-Za-z0-9_-]+", "_", s)

def bake_all(todo):
    """bake every todo material's base colour / emission to PNGs and wire them in; returns [(material, kind, file, px, strength)]"""
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"; sc.cycles.device = "CPU"; sc.cycles.samples = 1
    for k, v in (("use_denoising", False), ("use_adaptive_sampling", False)):
        if hasattr(sc.cycles, k): setattr(sc.cycles, k, v)
    bdir = HERE / "tex" / "baked"; bdir.mkdir(parents=True, exist_ok=True)
    done, cards = [], []
    dummy = bpy.data.images.new("_bake_dummy", 8, 8, float_buffer=True)

    users = {m: {} for m in todo}         # material -> {mesh: object} (linked copies share one bake)
    for o in MESHES:
        for s in o.material_slots:
            if s.material in users: users[s.material].setdefault(o.data, o)
    card_mats, card_uv, on_mesh = [], {}, {}    # card_uv: material -> UV map name;  on_mesh: material -> (mesh, object)
    for m, job in list(todo.items()):
        b = job["bsdf"]
        socks = ([b.inputs["Base Color"]] if job["base"] else []) + \
                ([b.inputs["Emission Color"], b.inputs["Emission Strength"]] if job["emit"] else [])
        uvs = [_uv_names(s) for s in socks]
        if None not in uvs and len(set().union(*uvs)) <= 1:
            card_mats.append(m); card_uv[m] = (set().union(*uvs) or {""}).pop(); continue
        for i, (me, o) in enumerate(users[m].items()):     # position-dependent: one copy per mesh
            mm = m
            if i:
                mm = m.copy(); mm.name = f"{m.name}_{_safe(me.name)}"
                todo[mm] = dict(job, bsdf=next(n for n in mm.node_tree.nodes if n.type == "BSDF_PRINCIPLED"))
                for oo in MESHES:
                    if oo.data is me:
                        for s in oo.material_slots:
                            if s.material is m: s.material = mm
            on_mesh[mm] = (me, o)
    for me, o in {me: o for me, o in on_mesh.values()}.items():   # fresh non-overlapping UVs ("bake")
        act = me.uv_layers.active_index if len(me.uv_layers) else -1
        me.uv_layers.active = me.uv_layers.get("bake") or me.uv_layers.new(name="bake")
        bpy.ops.object.select_all(action="DESELECT"); o.hide_viewport = False; o.hide_set(False); o.select_set(True)
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.uv.smart_project(island_margin=0.01); bpy.ops.object.mode_set(mode="OBJECT")
        if act >= 0: me.uv_layers.active_index = act
        else: me.uv_layers["bake"].active_render = True
    for m in card_mats:                   # UV-only: bake on a card that covers the whole UV square
        me = bpy.data.meshes.new("_card_" + m.name)
        me.from_pydata([(0, 0, -900), (1, 0, -900), (1, 1, -900), (0, 1, -900)], [], [(0, 1, 2, 3)])
        uv = me.uv_layers.new(name=card_uv[m] or "UVMap")
        for li, c in enumerate(((0, 0), (1, 0), (1, 1), (0, 1))): uv.data[li].uv = c
        me.materials.append(m)
        o = bpy.data.objects.new("_card_" + m.name, me); sc.collection.objects.link(o); cards.append(o)

    def res_for(m):
        src = max([max(n.image.size) for n in m.node_tree.nodes if n.type == "TEX_IMAGE" and n.image] or [0])
        return BAKE_RES if not src else min(BAKE_RES, max(512, src))

    def one_pass(kind):
        targets = [m for m, j in todo.items() if j[kind]]
        if not targets: return
        imgs, swaps, tmp = {}, [], []
        for m in targets:
            nt = m.node_tree; b = todo[m]["bsdf"]; r = res_for(m)
            src_ti = next((n for n in nt.nodes if n.type == "TEX_IMAGE" and n.image), None)
            im = bpy.data.images.new(f"_bk_{m.name}_{kind}", r, r, float_buffer=True)
            ti = nt.nodes.new("ShaderNodeTexImage"); ti.image = im; nt.nodes.active = ti
            em = nt.nodes.new("ShaderNodeEmission"); tmp += [(nt, ti), (nt, em)]
            if kind == "base":
                nt.links.new(b.inputs["Base Color"].links[0].from_socket, em.inputs["Color"]); em.inputs["Strength"].default_value = 1.0
            else:
                for a, z in (("Emission Color", "Color"), ("Emission Strength", "Strength")):
                    if b.inputs[a].is_linked: nt.links.new(b.inputs[a].links[0].from_socket, em.inputs[z])
                    else: em.inputs[z].default_value = b.inputs[a].default_value
            out = next((n for n in nt.nodes if n.type == "OUTPUT_MATERIAL" and n.is_active_output), None) or \
                next(n for n in nt.nodes if n.type == "OUTPUT_MATERIAL")
            prev = out.inputs["Surface"].links[0].from_socket if out.inputs["Surface"].is_linked else None
            nt.links.new(em.outputs[0], out.inputs["Surface"]); swaps.append((nt, out, prev))
            imgs[m] = (im, src_ti)
        for objs, uvl in (([o for o in cards if o.data.materials[0] in imgs], None),
                          (list(dict.fromkeys(on_mesh[m][1] for m in imgs if m in on_mesh)), "bake")):
            if not objs: continue
            dummies = []
            for o in objs:                    # Cycles wants an active image in every slot: a throwaway one
                for s in o.material_slots:
                    m = s.material
                    if m and m not in imgs and m.use_nodes and all(d[0] != m.node_tree for d in dummies):
                        d = m.node_tree.nodes.new("ShaderNodeTexImage"); d.image = dummy; m.node_tree.nodes.active = d
                        dummies.append((m.node_tree, d))
            bpy.ops.object.select_all(action="DESELECT")
            for o in objs: o.hide_viewport = False; o.hide_set(False); o.select_set(True)
            bpy.context.view_layer.objects.active = objs[0]
            bpy.ops.object.bake(type="EMIT", margin=4, margin_type="EXTEND", use_clear=True, target="IMAGE_TEXTURES",
                                **(dict(uv_layer=uvl) if uvl else {}))
            for nt, d in dummies: nt.nodes.remove(d)
        for nt, out, prev in swaps:
            if prev is not None: nt.links.new(prev, out.inputs["Surface"])
        for nt, n in tmp: nt.nodes.remove(n)
        for m, (im, src_ti) in imgs.items():  # float bake -> sRGB PNG, wired into the BSDF
            w, h = im.size
            px = np.empty(w * h * 4, np.float32); im.pixels.foreach_get(px); px = px.reshape(h, w, 4)[..., :3]
            k = 1.0
            if kind == "emit":
                k = float(px.max())
                if k > 1e-5: px = px / k
                else: k = 0.0
            fn = bdir / f"{_safe(NAME)}_{_safe(STATE)}_{_safe(m.name)}_{kind}.png"
            png = bpy.data.images.new(fn.stem, w, h, alpha=False)
            png.pixels.foreach_set(np.concatenate([_lin2srgb(px), np.ones((h, w, 1), np.float32)], -1).astype(np.float32).ravel())
            png.filepath_raw = str(fn); png.file_format = "PNG"; png.save()
            bpy.data.images.remove(png); bpy.data.images.remove(im)
            nt = m.node_tree; b = todo[m]["bsdf"]
            tex = nt.nodes.new("ShaderNodeTexImage"); tex.image = bpy.data.images.load(str(fn), check_existing=False)
            if src_ti: tex.interpolation = src_ti.interpolation
            uvn = "bake" if m in on_mesh and len(on_mesh[m][0].uv_layers) > 1 else card_uv.get(m, "")
            if uvn:                           # the baked texture reads the UV map its colour came from
                um = nt.nodes.new("ShaderNodeUVMap"); um.uv_map = uvn; nt.links.new(um.outputs[0], tex.inputs[0])
            if kind == "base":
                nt.links.new(tex.outputs[0], b.inputs["Base Color"])
            else:
                for l in list(b.inputs["Emission Strength"].links): nt.links.remove(l)
                b.inputs["Emission Strength"].default_value = k
                nt.links.new(tex.outputs[0], b.inputs["Emission Color"])
            done.append((m.name, kind, fn.name, w, round(k, 3), "mesh UVs" if m in on_mesh else "UV square"))

    one_pass("base"); one_pass("emit")
    # a mesh whose textures all read "bake" now keeps only that UV map (TEXCOORD_0: no second UV channel in three.js)
    def old_tex(m):
        return m.use_nodes and any(n.type == "TEX_IMAGE" and n.image and "tex/baked" not in n.image.filepath.replace("\\", "/")
                                   and any(s.is_linked for s in n.outputs) for n in m.node_tree.nodes)
    for me in {me for me, _ in on_mesh.values()}:
        mats = {s.material for o in MESHES if o.data is me for s in o.material_slots if s.material and s.material.name != "INK"}
        if len(me.uv_layers) < 2 or any(old_tex(m) for m in mats): continue
        for m in mats:
            for n in [n for n in m.node_tree.nodes if n.type == "UVMAP" and n.uv_map == "bake"]: m.node_tree.nodes.remove(n)
        for name in [uv.name for uv in me.uv_layers if uv.name != "bake"]: me.uv_layers.remove(me.uv_layers[name])
        me.uv_layers.active = me.uv_layers["bake"]; me.uv_layers["bake"].active_render = True
    for o in cards:
        me = o.data; bpy.data.objects.remove(o, do_unlink=True); bpy.data.meshes.remove(me)
    bpy.data.images.remove(dummy)
    return done

t1 = time.time(); baked = []
if BAKE and todo:
    baked = bake_all(todo)
    for mname, kind, fn, r, k, how in baked:
        print(f"BAKED {mname} {kind} -> tex/baked/{fn} ({r} px over the {how}{', strength ' + str(k) if kind == 'emit' else ''})")
t_bake = time.time() - t1

# ------------------------------------------------------------------ slim: polygon + texture budget by object size
# Poly Haven / Sketchfab assets keep their normal + roughness maps now (three.js reads them), so a 20 cm candlestick
# arrived with 213 k polygons and three 1k maps. Budget per object from its largest dimension D (m): polygons
# max(6000, 100000 x D^2) (DECIMATE collapse, ratio >= 0.1); texture side 256 px (D < 0.35 m), 512 (< 1 m), else up to
# --tex-max (1024). Objects with o["keep_poly"] / o["keep_tex"] are left alone. --no-slim turns the pass off.
SLIM = "--no-slim" not in ARGV; TEX_MAX = int(arg("--tex-max", 1024))
def slim():
    dg = bpy.context.evaluated_depsgraph_get(); dec = []; p0 = p1 = 0
    img_need = {}
    for o in MESHES:
        D = max(o.dimensions) if max(o.dimensions) > 0 else 1.0
        ev = o.evaluated_get(dg); me = ev.to_mesh(); n = len(me.polygons); ev.to_mesh_clear()
        budget = max(6000, int(100000 * D * D))
        if n > budget and not o.get("keep_poly") and not o.get("beam"):
            if o.data.users > 1: o.data = o.data.copy()
            md = o.modifiers.new("slim", "DECIMATE"); md.ratio = max(0.1, budget / n); md.use_collapse_triangulate = False
            dec.append(o.name); p0 += n; p1 += int(n * md.ratio)
        side = 256 if D < 0.35 else 512 if D < 1.0 else TEX_MAX
        if o.get("keep_tex"): side = 1 << 30
        for sl in o.material_slots:
            m = sl.material
            if not m or not m.use_nodes: continue
            for nd in m.node_tree.nodes:
                if nd.type == "TEX_IMAGE" and nd.image and nd.image.size[0] > 0:
                    img_need[nd.image] = max(img_need.get(nd.image, 0), side)
    q0 = q1 = 0; nimg = 0
    for im, side in img_need.items():
        w, h = im.size
        if max(w, h) <= side or "tex/baked" in im.filepath.replace("\\", "/"): continue
        k = side / max(w, h); q0 += w * h
        try:
            im.scale(max(1, int(w * k)), max(1, int(h * k))); q1 += im.size[0] * im.size[1]; nimg += 1
        except Exception as e: print("SLIM keep", im.name, e)
    print(f"SLIM {len(dec)} objects decimated ({p0 / 1e3:.0f} k -> {p1 / 1e3:.0f} k polys), {nimg} textures downscaled ({q0 / 1e6:.1f} -> {q1 / 1e6:.1f} Mpx)")
if SLIM: slim()

# ------------------------------------------------------------------ --light: baked bounce light + ambient occlusion
def _sanitize(n):            # three.js PropertyBinding.sanitizeNodeName (GLTFLoader node names)
    return re.sub(r"[\[\]\.:/]", "", re.sub(r"\s", "_", n))

def _glow_only(m):
    """a material that only glows (window view cards, lamp shades lit from inside): drawn unlit, nothing to bake"""
    if not m or not m.use_nodes: return False
    nt = m.node_tree
    out = next((n for n in nt.nodes if n.type == "OUTPUT_MATERIAL" and n.is_active_output), None)
    src = _src(out.inputs["Surface"]) if out else None
    if src is not None and src.type == "EMISSION": return True
    b = next((n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"), None)
    if b is None or not _emits(b): return False
    bc = b.inputs["Base Color"]
    return (not bc.is_linked and max(bc.default_value[:3]) < 0.05) or b.inputs["Emission Strength"].default_value >= 1.0

def _gpu(sc):
    try:
        prefs = bpy.context.preferences.addons["cycles"].preferences
    except Exception as e:
        print("LIGHT no cycles prefs:", e); return "CPU"
    for kind in ("OPTIX", "CUDA", "HIP", "METAL", "ONEAPI"):
        try:
            prefs.compute_device_type = kind; prefs.get_devices()
        except Exception: continue
        if any(d.type == kind for d in prefs.devices):
            for d in prefs.devices: d.use = d.type == kind
            sc.cycles.device = "GPU"; return kind
    sc.cycles.device = "CPU"; return "CPU"

def light_bake():
    """Cycles bake of the state's light (its lights + world) into one lightmap per static mesh, on a new UV layer
    "lightmap" (smart project per object, margins). Bakes DIFFUSE irradiance (no albedo) = the light three.js does not
    draw itself: every bounce, the world / sky, emissive surfaces, area / point / spot lights. The SUN's direct light is
    left out (three.js draws it live with its shadow map; its bounce stays in) through a light-path node on the sun.
    Then AO (1 m) into the alpha channel. PNG RGBA per object: rgb = sRGB(irradiance / k), a = AO; k per object in the
    JSON. Skipped: o["no_bake"] (animated nodes: doors, propellers; or a parent with it), beams, glow-only materials,
    objects under 0.01 m2."""
    import math
    sc = bpy.context.scene; tl = time.time()
    sc.render.engine = "CYCLES"
    dev = _gpu(sc)
    sc.cycles.samples = LIGHT_SAMPLES
    for k, v in (("use_denoising", False), ("use_adaptive_sampling", False), ("max_bounces", 6), ("diffuse_bounces", 4),
                 ("glossy_bounces", 1), ("transmission_bounces", 2), ("transparent_max_bounces", 4), ("sample_clamp_indirect", 6.0),
                 ("blur_glossy", 1.0), ("caustics_reflective", False), ("caustics_refractive", False)):
        if hasattr(sc.cycles, k): setattr(sc.cycles, k, v)
    dg = bpy.context.evaluated_depsgraph_get()
    def no_bake(o):
        while o is not None:
            if o.get("no_bake"): return True
            o = o.parent
        return False
    objs = []
    for o in MESHES:
        if no_bake(o) or o.get("beam"): continue
        mats = [sl.material for sl in o.material_slots if sl.material]
        if not mats or all(_glow_only(m) for m in mats): continue
        ev = o.evaluated_get(dg); me = ev.to_mesh()
        pa = np.empty(len(me.polygons)); me.polygons.foreach_get("area", pa)
        s3 = o.matrix_world.to_scale(); area = float(pa.sum()) * (abs(s3.x * s3.y) + abs(s3.y * s3.z) + abs(s3.x * s3.z)) / 3
        ev.to_mesh_clear()
        if area < 0.01: continue
        objs.append((o, area))
    if not objs: return {}, None, dev
    # modifiers first (arrays / mirrors / walls would share lightmap texels), own mesh data per object
    for o, _ in objs:
        if o.data.users > 1: o.data = o.data.copy()
        if o.modifiers:
            bpy.ops.object.select_all(action="DESELECT"); o.hide_set(False); o.hide_viewport = False; o.select_set(True)
            bpy.context.view_layer.objects.active = o
            for md in list(o.modifiers):
                try: bpy.ops.object.modifier_apply(modifier=md.name)
                except Exception as e: print("LIGHT keep modifier", o.name, md.name, e)
    # texel density: LIGHT_DENSITY px/m, lowered until the whole set fits the pixel budget (bake time ~ px x samples)
    dens = LIGHT_DENSITY
    need = sum(min(LIGHT_RES, max(32, math.sqrt(ar) * dens)) ** 2 for _, ar in objs)
    while need > LIGHT_PX and dens > 8:
        dens *= 0.9; need = sum(min(LIGHT_RES, max(32, math.sqrt(ar) * dens)) ** 2 for _, ar in objs)
    res_of = {o.name: min(LIGHT_RES, max(32, math.sqrt(ar) * dens)) for o, ar in objs}
    tot = sum(r * r for r in res_of.values())
    shrink = min(1.0, math.sqrt(LIGHT_PX / tot)) if tot > 0 else 1.0      # big sets: every map shrinks to the budget
    tu = time.time()
    for o, area in objs:
        me = o.data
        while len(me.uv_layers) >= 8: me.uv_layers.remove(me.uv_layers[-1])
        act = me.uv_layers.active_index if len(me.uv_layers) else -1
        rnd = next((i for i, u in enumerate(me.uv_layers) if u.active_render), act)
        uv = me.uv_layers.new(name="lightmap"); me.uv_layers.active = uv
        res = int(max(16, round(res_of[o.name] * shrink / 8) * 8))
        o["_lm_res"] = res
        bpy.ops.object.select_all(action="DESELECT"); o.hide_set(False); o.hide_viewport = False; o.select_set(True)
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=min(0.08, 4.0 / res), area_weight=0.0)
        bpy.ops.object.mode_set(mode="OBJECT")
        if act >= 0: me.uv_layers.active_index = act
        if rnd >= 0: me.uv_layers[rnd].active_render = True
    t_uv = time.time() - tu
    # one atlas: shelf-pack every object's square (res + 8 px gap); scale down until it fits 4096 x 4096
    def pack(scale):
        items = sorted(((max(16, int(o["_lm_res"] * scale) // 4 * 4), o) for o, _ in objs), key=lambda t: -t[0])
        for W in (512, 1024, 2048, 4096):
            x = y = sh = 0; rects = {}
            for r, o in items:
                if r + 8 > W: break
                if x + r + 8 > W: x = 0; y += sh; sh = 0
                rects[o.name] = (x + 4, y + 4, r); x += r + 8; sh = max(sh, r + 8)
            else:
                if y + sh <= W: return W, (y + sh + 7) // 8 * 8, rects
        return None
    sc_ = 1.0
    while (pk := pack(sc_)) is None: sc_ *= 0.85
    AW, AH, rects = pk
    # originals: lightmap UVs into their atlas rect (three.js reads one shared texture)
    for o, _ in objs:
        x, y, r = rects[o.name]; uvd = o.data.uv_layers["lightmap"].data
        a = np.empty(len(uvd) * 2, np.float32); uvd.foreach_get("uv", a); a = a.reshape(-1, 2)
        a[:, 0] = (x + np.clip(a[:, 0], 0, 1) * r) / AW; a[:, 1] = (y + np.clip(a[:, 1], 0, 1) * r) / AH
        uvd.foreach_set("uv", a.ravel())
    # bake object: a joined copy of every baked mesh (one Cycles bake instead of one per object); originals hidden
    dups = []
    for o, _ in objs:
        d = o.copy(); d.data = o.data.copy(); sc.collection.objects.link(d); d.parent = None; d.matrix_world = o.matrix_world.copy()
        dups.append(d); o.hide_render = True
    bpy.ops.object.select_all(action="DESELECT")
    for d in dups: d.hide_set(False); d.hide_viewport = False; d.select_set(True)
    bpy.context.view_layer.objects.active = dups[0]; bpy.ops.object.join(); J = bpy.context.active_object; J.name = "_lm_bake"
    J.data.uv_layers.active = J.data.uv_layers["lightmap"]
    atlas = bpy.data.images.new("_lm_atlas", AW, AH, float_buffer=True)
    tnodes = []
    for m in {s.material for s in J.material_slots if s.material}:
        m.use_nodes = True; ti = m.node_tree.nodes.new("ShaderNodeTexImage"); ti.image = atlas; m.node_tree.nodes.active = ti
        tnodes.append((m, ti))
    if not J.material_slots:
        J.data.materials.append(None)
    # sun: direct light off at the baked surface (ray depth 0), its bounce kept
    for o in [o for o in bpy.data.objects if o.type == "LIGHT" and o.data.type == "SUN"]:
        L_ = o.data; L_.use_nodes = True; nt = L_.node_tree
        em = next((n for n in nt.nodes if n.type == "EMISSION"), None)
        if em is None: print("LIGHT sun without an emission node:", o.name); continue
        lp = nt.nodes.new("ShaderNodeLightPath"); gt = nt.nodes.new("ShaderNodeMath"); gt.operation = "GREATER_THAN"
        gt.inputs[1].default_value = 0.5; nt.links.new(lp.outputs["Ray Depth"], gt.inputs[0])
        nt.links.new(gt.outputs[0], em.inputs["Strength"])
    w = sc.world; vol = None
    if w and w.use_nodes:                      # world haze makes the bake slow and murky: off while baking
        wo = next((n for n in w.node_tree.nodes if n.type == "OUTPUT_WORLD"), None)
        if wo and wo.inputs["Volume"].is_linked:
            vol = wo.inputs["Volume"].links[0].from_socket; w.node_tree.links.remove(wo.inputs["Volume"].links[0])
    bpy.ops.object.select_all(action="DESELECT"); J.select_set(True); bpy.context.view_layer.objects.active = J
    def bake(kind, **kw):
        a = dict(type=kind, margin=3, margin_type="EXTEND", use_clear=True, target="IMAGE_TEXTURES", uv_layer="lightmap", **kw)
        try: bpy.ops.object.bake(**a)
        except RuntimeError as e:
            if sc.cycles.device != "GPU": raise
            print("LIGHT GPU bake failed, CPU:", e); sc.cycles.device = "CPU"; bpy.ops.object.bake(**a)
    def grab(im):
        a = np.empty(AW * AH * 4, np.float32); im.pixels.foreach_get(a); return a.reshape(AH, AW, 4)
    tb = time.time(); bake("DIFFUSE", pass_filter={"DIRECT", "INDIRECT"}); t_lm = time.time() - tb
    lmpx = grab(atlas)[..., :3].copy()
    if w: w.light_settings.distance = 1.0
    sc.cycles.samples = max(16, LIGHT_SAMPLES // 4)
    ta = time.time(); bake("AO"); t_ao = time.time() - ta
    aopx = grab(atlas)[..., 0].copy()
    if vol is not None: w.node_tree.links.new(vol, next(n for n in w.node_tree.nodes if n.type == "OUTPUT_WORLD").inputs["Volume"])
    for m, ti in tnodes: m.node_tree.nodes.remove(ti)
    me = J.data; bpy.data.objects.remove(J, do_unlink=True); bpy.data.meshes.remove(me); bpy.data.images.remove(atlas)
    for o, _ in objs: o.hide_render = False
    # light smoothing inside each rect (Cycles bakes are not denoised): 3x3 box on the irradiance, edge texels kept
    from numpy.lib.stride_tricks import sliding_window_view as swv
    pad = np.pad(lmpx, ((1, 1), (1, 1), (0, 0)), mode="edge")
    lmpx = 0.5 * lmpx + 0.5 * swv(pad, (3, 3), axis=(0, 1)).mean(axis=(-1, -2))
    stem = Path(OUT_GLB).stem if OUT_GLB else f"{NAME}_{STATE}"
    for f in OUT.glob(f"{stem}_lm*.png"): f.unlink()
    k = max(float(np.percentile(lmpx.max(-1)[lmpx.max(-1) > 0], 99.8)) * 1.05, 1e-6)
    out = np.concatenate([_lin2srgb(np.clip(lmpx / k, 0, 1)), np.clip(aopx, 0, 1)[..., None]], -1).astype(np.float32)
    fn = OUT / f"{stem}_lm.png"
    png = bpy.data.images.new(fn.stem, AW, AH, alpha=True); png.alpha_mode = "STRAIGHT"
    png.pixels.foreach_set(out.ravel()); png.filepath_raw = str(fn); png.file_format = "PNG"; png.save(); bpy.data.images.remove(png)
    entries = {}
    for o, area in objs:
        uvi = [u.name for u in o.data.uv_layers].index("lightmap")
        entries[_sanitize(o.name)] = dict(uv=uvi, rect=list(rects[o.name]))
    info = dict(file=fn.name, size=[AW, AH], k=round(k, 5), device=dev, samples=LIGHT_SAMPLES, density=round(dens * sc_, 1),
                objects=len(entries), px=AW * AH, sun_direct=False,
                direct=[o.name for o in bpy.data.objects if o.type == "LIGHT" and o.data.type != "SUN"],
                times=dict(uv=round(t_uv, 1), light=round(t_lm, 1), ao=round(t_ao, 1), total=round(time.time() - tl, 1)))
    return entries, info, dev

lm_entries, lm_info = {}, None
if LIGHT:
    lm_entries, lm_info, _dev = light_bake()
    if lm_info:
        print(f"LIGHT {len(lm_entries)} objects baked ({lm_info['px'] / 1e6:.2f} Mpx, {_dev}, {LIGHT_SAMPLES} spp): "
              f"uv {lm_info['times']['uv']} s, light {lm_info['times']['light']} s, ao {lm_info['times']['ao']} s")
for o in list(bpy.data.objects):
    if o.type == "LIGHT": bpy.data.objects.remove(o, do_unlink=True)
MESHES = [o for o in bpy.data.objects if o.type == "MESH"]

# ------------------------------------------------------------------ geometry checks (evaluated meshes, world space)
t2 = time.time()
dg = bpy.context.evaluated_depsgraph_get()
TRI_V, TRI_I, TRI_O, CEN, holes, nv0 = [], [], [], [], [], 0
for oi, o in enumerate(MESHES):
    ev = o.evaluated_get(dg)
    me = ev.to_mesh()
    nv = len(me.vertices)
    if nv == 0 or len(me.polygons) == 0: ev.to_mesh_clear(); continue
    co = np.empty(nv * 3, np.float64); me.vertices.foreach_get("co", co)
    M = np.array(o.matrix_world, np.float64); co = co.reshape(-1, 3) @ M[:3, :3].T + M[:3, 3]      # world space
    # open shell: holes (boundary loops, after merging the split vertices glTF imports have at seams) in a bent surface.
    # Not counted: flat planes/decals (seen from the front only), holes under 30 cm round (rod ends), covered holes (below)
    if not o.get("open_ok"):
        _, vid = np.unique(np.round(co / 1e-4).astype(np.int64), axis=0, return_inverse=True); vid = vid.ravel()
        ed = np.empty(len(me.edges) * 2, np.int64); me.edges.foreach_get("vertices", ed); ed = vid[ed.reshape(-1, 2)]
        le = np.empty(len(me.loops), np.int64); me.loops.foreach_get("edge_index", le)
        cnt = np.bincount(le, minlength=len(me.edges))
        keep = ed[:, 0] != ed[:, 1]; ek = np.sort(ed[keep], 1)
        _, first, inv = np.unique(ek[:, 0] * (nv + 1) + ek[:, 1], return_index=True, return_inverse=True)
        bnd = ek[first][np.bincount(inv.ravel(), weights=cnt[keep]) == 1]
        if len(bnd):
            pa = np.empty(len(me.polygons)); me.polygons.foreach_get("area", pa)
            pn = np.empty(len(me.polygons) * 3); me.polygons.foreach_get("normal", pn); pn = pn.reshape(-1, 3)
            bent = pa[np.abs(pn @ pn[np.argmax(pa)]) < 0.95].sum() / max(pa.sum(), 1e-12)
            if bent > 0.02:
                P = np.zeros((int(vid.max()) + 1, 3)); P[vid] = co
                par = list(range(len(P)))
                def root(x):
                    while par[x] != x: par[x] = par[par[x]]; x = par[x]
                    return x
                for u, w in bnd.tolist(): par[root(u)] = root(w)
                loops = {}
                for u, w in bnd.tolist(): loops.setdefault(root(u), []).append((u, w))
                for hl in loops.values():
                    per = float(sum(np.linalg.norm(P[u] - P[w]) for u, w in hl))
                    if per >= 0.3: holes.append((oi, per, P[sorted({x for e in hl for x in e})]))
    me.calc_loop_triangles()                  # world-space triangles for the coplanar check
    tv = np.empty(len(me.loop_triangles) * 3, np.int64); me.loop_triangles.foreach_get("vertices", tv)
    TRI_V.append(co); TRI_I.append(tv.reshape(-1, 3) + nv0); TRI_O.append(np.full(len(tv) // 3, oi)); nv0 += nv
    if not o.get("coplanar_ok"):              # quad/ngon centres: a box face's centre sits on its triangles' diagonal
        ns = np.empty(len(me.polygons), np.int64); me.polygons.foreach_get("loop_total", ns)
        pc = np.empty(len(me.polygons) * 3); me.polygons.foreach_get("center", pc)
        pn = np.empty(len(me.polygons) * 3); me.polygons.foreach_get("normal", pn)
        pa = np.empty(len(me.polygons)); me.polygons.foreach_get("area", pa)
        big = np.nonzero(ns > 3)[0]; big = big[np.argsort(-pa[big])][:300]
        wn = pn.reshape(-1, 3)[big] @ np.linalg.inv(M[:3, :3]); wn /= np.maximum(np.linalg.norm(wn, axis=1), 1e-12)[:, None]
        CEN.append((oi, pc.reshape(-1, 3)[big] @ M[:3, :3].T + M[:3, 3], wn))
    ev.to_mesh_clear()

pairs, open_shells = {}, {}                   # (object i, object j) -> smallest gap;  object -> biggest hole
if TRI_V:
    V = np.concatenate(TRI_V); T = np.concatenate(TRI_I); TO = np.concatenate(TRI_O)
    A, B, C = V[T[:, 0]], V[T[:, 1]], V[T[:, 2]]
    cr = np.cross(B - A, C - A); area = np.linalg.norm(cr, axis=1) / 2
    N = cr / np.maximum(2 * area, 1e-12)[:, None]
    good = area > 1e-4                         # faces under 1 cm^2 cannot show a blob
    gidx = np.nonzero(good)[0]
    bvh = BVHTree.FromPolygons(V.tolist(), T[good].tolist(), all_triangles=True)
    # a flat hole is fine when another object's parallel surface covers it within 2 cm (picket tip on its picket,
    # a house on the ground, a frame on the wall); a bell mouth or a bent hole is not
    for oi, per, lp in holes:
        c0 = lp.mean(0); _, sv, vt = np.linalg.svd(lp - c0); hn = vt[2]
        flat = np.abs((lp - c0) @ hn).max() < 0.01
        pts = [c0] + [c0 + 0.7 * (q - c0) for q in lp[np.linspace(0, len(lp) - 1, min(8, len(lp))).astype(int)]]
        if flat and all(any(TO[gidx[i]] != oi and abs(float(N[gidx[i]] @ hn)) > 0.9 for _, _, i, _ in bvh.find_nearest_range(Vector(p), 0.02))
                        for p in pts):
            continue
        open_shells[oi] = max(open_shells.get(oi, 0.0), per)
    order = np.lexsort((-area, TO))            # per object, largest faces first; sample the 300 largest
    so = TO[order]
    def samples():
        for oi in np.unique(TO):
            if MESHES[oi].get("coplanar_ok"): continue
            for t in order[np.searchsorted(so, oi):np.searchsorted(so, oi, side="right")][:300]:
                if not good[t]: break
                ctr = (A[t] + B[t] + C[t]) / 3       # centroid + 3 points toward the corners (all inside the face)
                for p in (ctr, ctr + 0.6 * (A[t] - ctr), ctr + 0.6 * (B[t] - ctr), ctr + 0.6 * (C[t] - ctr)): yield oi, p, N[t]
        for oi, pts, nrm in CEN:
            for p, n in zip(pts, nrm): yield oi, p, n
    for oi, p, n in samples():
        for loc, _n, idx, _d in bvh.find_nearest_range(Vector(p), 0.0099):
            j = gidx[idx]; oj = TO[j]
            # same object, or not facing the same way (crossing at > 2 degrees is an edge, not a blob)
            if oj == oi or float(N[j] @ n) < 0.9994 or MESHES[oj].get("coplanar_ok"): continue
            d = np.array(loc) - p; along = float(d @ n)
            if np.linalg.norm(d - along * n) > 1e-3: continue      # beside it, not over it
            k = (min(oi, oj), max(oi, oj)); pairs[k] = min(pairs.get(k, 1.0), abs(along))
            if __import__('os').environ.get('COPL_DBG'): print('COPL', MESHES[oi].name, MESHES[oj].name, [round(float(x),3) for x in p], [round(float(x),3) for x in n], round(along*1000,1))
for oi, per in open_shells.items():
    warnings.append(f"open shell {MESHES[oi].name}: a {per:.1f} m hole and no wall -> WebGL culls its inside; give it a "
                    f"SOLIDIFY (>= 1 cm) or close it (o['open_ok'] = 1 if its inside is never seen)")
for (i, j), gap in sorted(pairs.items(), key=lambda kv: kv[1])[:12]:
    warnings.append(f"coplanar faces {MESHES[i].name} / {MESHES[j].name}: {gap * 1000:.0f} mm apart, same facing -> "
                    f"z-fight + black ink blob in WebGL; move one >= 1 cm proud (o['coplanar_ok'] = 1 to accept)")
if len(pairs) > 12: warnings.append(f"coplanar faces: {len(pairs) - 12} more object pairs")
t_check = time.time() - t2

glb = Path(OUT_GLB) if OUT_GLB else OUT / f"{NAME}_{STATE}.glb"
# WEBP textures (alpha kept, ~4x smaller than the PNGs glTF writes for packed roughness/metal and edited images;
# three.js GLTFLoader reads EXT_texture_webp); --png keeps the old PNG/JPEG choice
_img = {} if "--png" in ARGV else dict(export_image_format="WEBP", export_image_quality=85)
bpy.ops.export_scene.gltf(filepath=str(glb), export_format="GLB", export_apply=True, export_yup=True, export_extras=True, **_img,
                          export_cameras=False, export_lights=False, export_animations=False, use_selection=False)
meshes = sum(1 for o in bpy.data.objects if o.type == "MESH")
polys = sum(len(o.data.polygons) for o in bpy.data.objects if o.type == "MESH")
if polys > 1_500_000: warnings.append(f"set has {polys} polygons: decimate heavy assets (WebGL memory, render speed)")
info = dict(set=NAME, state=STATE, anchors=anchors, lights=lights, warnings=warnings, meshes=meshes, polys=polys,
            baked=[dict(material=m, kind=k, file=f) for m, k, f, *_ in baked],
            lightmap=(dict(lm_info, entries=lm_entries) if lm_info else None),
            coplanar=[[MESHES[i].name, MESHES[j].name, round(g * 1000, 1)] for (i, j), g in sorted(pairs.items(), key=lambda kv: kv[1])])
glb.with_suffix(".json").write_text(json.dumps(info, indent=1))
print(f"EXPORT {glb.name}: {meshes} meshes, {polys} polys, {len(anchors)} anchors, {len(lights)} lights, "
      f"{glb.stat().st_size / 1e6:.1f} MB, {time.time() - t0:.0f} s (build {t_build:.0f}, bake {t_bake:.0f}, checks {t_check:.1f})"
      + (f", {len(baked)} textures baked" if baked else ""))
for w in warnings: print("WARN", w)
