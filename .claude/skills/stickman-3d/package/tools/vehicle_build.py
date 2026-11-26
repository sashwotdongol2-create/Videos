"""Vehicle build module for blender/export.py (`stickman3d.py vehicle <id> [--from <asset_id>] [--yaw DEG]` runs
  blender -b -P blender/export.py -- --set <id> --state vehicle --module <this file> --out public/vehicles/<id>.glb
          --src blender/assets/<asset_id>.blend [--yaw DEG] [--bake]).

Normalises one vehicle asset to the convention world/vehicle.tsx reads:
  - metres; origin on the ground under the centre of the bounding box (x, y centred, lowest point z = 0)
  - FRONT toward Blender +Y (three -Z); the car's LEFT toward Blender -X. A source that faces another way is turned with
    --yaw DEG (about Z, before measuring). A model longer along X than Y is reported (it is lying sideways).
  - wheels: objects named <anything>wheel_FL / _FR / _RL / _RR (the ASSETS.md convention) are used as they are;
    otherwise the 4 lowest ROUND parts (side view nearly square, thinner than tall, 0.3-1.6 m, touching the ground) are
    taken, one per quadrant, and smaller round parts in the same quadrant (rims, brake discs) are parented to them.
    Each wheel gets its origin at its bounding-box centre and is renamed wheel_FL / wheel_FR / wheel_RL / wheel_RR.
    No wheels found -> printed; <Vehicle/> then has no wheel spin or steer (a one-mesh wreck).
  - materials are kept as they are; node-built colours need --bake (export.py WARNs and bakes them like a set).
  - car models are open one-sided shells (panels, tyres): every mesh gets a 1 cm inward SOLIDIFY wall (applied on
    export), so WebGL's FrontSide culling does not open holes into the car and flipped faces still show (--no-wall: off).
Prints VEHICLE / WHEEL lines; returns anchors (front / rear bumper, roof) for the .json."""
import bpy, math, re, sys
from mathutils import Matrix, Vector
import lib

ARGV = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
def _arg(n, d=None): return ARGV[ARGV.index(n) + 1] if n in ARGV else d

QUAD = re.compile(r"(?:^|[_\W])wheel[_\W]?(FL|FR|RL|RR)$", re.I)
KEYS = ("FL", "FR", "RL", "RR")


def _box(objs):
    pts = [o.matrix_world @ Vector(c) for o in objs if o.type == "MESH" for c in o.bound_box]
    if not pts: return None, None
    return (Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts))),
            Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts))))


def _tree(o): return [o] + list(o.children_recursive)


def _set_origin(o, c):
    """origin of mesh object o -> world point c, children stay where they are"""
    kids = [(ch, ch.matrix_world.copy()) for ch in o.children]
    if o.type == "MESH" and o.data.users > 1: o.data = o.data.copy()
    mw = o.matrix_world.copy(); loc = mw.inverted() @ c
    if o.type == "MESH": o.data.transform(Matrix.Translation(-loc))
    o.matrix_world = mw @ Matrix.Translation(loc)
    bpy.context.view_layer.update()
    for ch, m in kids: ch.matrix_world = m
    bpy.context.view_layer.update()


def build(state):
    src = _arg("--src"); vid = _arg("--set"); yaw = float(_arg("--yaw", 0) or 0)
    if not src: raise SystemExit("vehicle_build: --src <file.blend> missing")
    objs = lib.append_blend(src)
    for o in [o for o in objs if o.type in ("LIGHT", "CAMERA")]: bpy.data.objects.remove(o, do_unlink=True)
    objs = [o for o in bpy.context.scene.objects]
    tops = [o for o in objs if o.parent is None]
    if len(tops) == 1: root = tops[0]
    else:
        root = bpy.data.objects.new(vid, None); bpy.context.scene.collection.objects.link(root)
        for o in tops:
            mw = o.matrix_world.copy(); o.parent = root; o.matrix_world = mw
    if yaw: root.rotation_euler.z += math.radians(yaw)
    bpy.context.view_layer.update()
    meshes = [o for o in objs if o.type == "MESH" and not o.hide_render]
    lo, hi = _box(meshes)
    if lo is None: raise SystemExit(f"vehicle_build: {src} has no meshes")
    root.location -= Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z)); bpy.context.view_layer.update()
    lo, hi = _box(meshes); L, W, H = hi.y - lo.y, hi.x - lo.x, hi.z - lo.z
    if W > L * 1.05:
        print(f"WARN vehicle {vid} is longer across X ({W:.2f} m) than along Y ({L:.2f} m): it must face +Y -> pass --yaw 90 or -90")

    # ---- wheels
    named = {}
    for o in objs:
        m = QUAD.search(o.name)
        if m and m.group(1).upper() not in named: named[m.group(1).upper()] = o
    if len(named) == 4: wheels, how = named, "names"
    else:
        cand = []
        for o in meshes:
            a, b = _box([o]); d = b - a
            if not (0.3 <= d.z <= 1.6) or a.z > 0.03 + 0.04 * H: continue          # wheel-sized, on the ground
            if abs(d.y - d.z) / max(d.y, d.z) > 0.2 or d.x > 0.8 * d.z: continue    # round side view, thinner than tall
            if d.y > 0.5 * L: continue                                               # not the body
            c = (a + b) / 2
            cand.append((a.z, -d.z, o, c, a, b))
        cand.sort(key=lambda r: (round(r[0], 2), r[1]))
        wheels, how = {}, "round parts"
        for _, _, o, c, a, b in cand:
            k = ("F" if c.y > 0 else "R") + ("L" if c.x < 0 else "R")
            if k not in wheels: wheels[k] = o
        if len(wheels) == 4:
            for k, w in wheels.items():                       # rims / brake discs inside a tyre's box ride along
                a, b = _box([w])
                for o in meshes:
                    if o is w or o in wheels.values() or o.parent is w: continue
                    oa, ob = _box([o]); c = (oa + ob) / 2
                    if all(a[i] - 0.02 <= c[i] <= b[i] + 0.02 for i in range(3)) and (ob - oa).length < (b - a).length * 1.05:
                        mw = o.matrix_world.copy(); o.parent = w; o.matrix_world = mw
        else: wheels, how = {}, "none"
    rs = {}
    for k in KEYS:
        w = wheels.get(k)
        if not w: continue
        a, b = _box(_tree(w)); c = (a + b) / 2
        if w.type == "MESH": _set_origin(w, c)
        w.name = f"wheel_{k}"; rs[k] = (c, (b.z - a.z) / 2)
        print(f"WHEEL {k}: centre ({c.x:.3f}, {c.y:.3f}, {c.z:.3f}) r {rs[k][1]:.3f} m ({how})")
    if not rs: print(f"WHEEL none found ({how}): name them <id>_wheel_FL/FR/RL/RR in the asset to get spin and steer")
    if "--no-wall" not in ARGV:
        for o in meshes:
            md = o.modifiers.new("wall", "SOLIDIFY"); md.thickness = 0.01; md.offset = -1.0; md.use_rim = True
    print(f"VEHICLE {vid}: {L:.2f} x {W:.2f} x {H:.2f} m (length x width x height), {len(meshes)} meshes, "
          f"{sum(len(o.data.polygons) for o in meshes)} polys (before the wall), wheels: {how}, front +Y (three -Z), origin ground centre")
    return {"front": (0, hi.y, 0.5 * H), "rear": (0, lo.y, 0.5 * H), "roof": (0, 0, H)}
