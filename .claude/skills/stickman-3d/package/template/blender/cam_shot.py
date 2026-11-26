# One shot camera authored IN BLENDER, exported frame by frame for three.js (world/blenderCam.ts). Generalised from
# _t_upgrade/blender/cam_test.py (2026-11-20). Run through the CLI (it takes the GPU lock, exports the stand-in paths):
#   python stickman3d.py cam s03                 # spec blender/cams/s03.json -> public/cams/s03.json
#   python stickman3d.py cam s03 --export-only   # re-export blender/cams/s03.blend after a hand tweak (keys, lens)
# Direct: blender -b --factory-startup --python-exit-code 1 -P blender/cam_shot.py -- <project> <shot> [--export-only]
#
# Spec blender/cams/<shot>.json (three.js coordinates, metres, y up; shot-local frames, 0 = the shot's first frame):
#   {
#     "set": "parlour_night",                  public/sets/<set>.glb (omit for no set)
#     "frames": 150,                           shot length (the CLI fills it from src/shots.gen.json when missing)
#     "fps": 30,
#     "lens": 50,                              vertical fov in degrees (or "mm": 35 on a 24 mm vertical sensor)
#     "keys": [                                ONE move: 2 keys (more only for a hold, never back and forth);
#                                              a key at f < 0 or f > frames-1 keeps that end moving (for a hard cut)
#       {"f": 0,   "pos": [1.0, 1.4, 2.85], "look": [0.15, 0.9, -0.1]},
#       {"f": 149, "pos": [0.5, 1.5, 2.3],  "look": [0.15, 0.95, -0.1]}
#     ],
#     "follow": {"name": "hero", "offset": [0, 1.3, 0], "mix": 0.5},   optional: the look point leans toward a stand-in
#     "standins": [                            fixed things; moving ones come from public/cams/paths/<shot>.json
#       {"name": "partner", "kind": "person", "at": [-0.35, 0, -0.15], "yaw": 0.6}
#     ],
#     "subject": "hero",                       the stand-in whose head size is reported (default: the first person)
#     "previews": [0, 75, 149]                 Workbench preview frames (default: first, middle, last)
#   }
# Keys are Bezier AUTO_CLAMPED (eased in and out), the lens tracks an empty with world-Z up (no roll), one fixed lens.
# Writes: public/cams/<shot>.json {fps, frames: [{t, p, l, fov, roll}], check}, blender/cams/<shot>.blend,
#         out/cams/<shot>_fNNN.png. Prints "CAM CHECK {json}" and "CAM FAIL ..." / "CAM WARN ..." lines.
import bpy, json, math, os, sys
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
PROJ, SHOT = argv[0], argv[1]
EXPORT_ONLY = "--export-only" in argv
SPEC_F = os.path.join(PROJ, "blender", "cams", f"{SHOT}.json")
BLEND_F = os.path.join(PROJ, "blender", "cams", f"{SHOT}.blend")
PATHS_F = os.path.join(PROJ, "public", "cams", "paths", f"{SHOT}.json")
OUT_F = os.path.join(PROJ, "public", "cams", f"{SHOT}.json")
spec = json.load(open(SPEC_F, encoding="utf-8"))
FPS = int(spec.get("fps", 30))
N = int(spec["frames"])
EASE_MIN = float(spec.get("ease_min", 0.4))


def b(v):  # three (x, y up, z) -> blender (x, -z, y)
    return Vector((v[0], -v[2], v[1]))


def t3(v):  # blender -> three
    return [round(v.x, 5), round(v.z, 5), round(-v.y, 5)]


def mat(name, rgb):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.diffuse_color = (*rgb, 1)
    return m


def standin(name, kind, height=1.7, size=None):
    """a rig empty (location = the thing's ground point, rot Z = yaw) with a shape parented to it"""
    rig = bpy.data.objects.new(f"SI_{name}", None); bpy.context.scene.collection.objects.link(rig)
    if kind == "person":
        k = height / 1.7
        bpy.ops.mesh.primitive_cylinder_add(radius=0.22, depth=1.1 * k, location=(0, 0, 0.75 * k))
        o = bpy.context.object; o.name = f"SI_{name}_body"; o.parent = rig; o.data.materials.append(mat("si_body", (0.15, 0.2, 0.35)))
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.25, location=(0, 0, 1.48 * k))   # RicksClips head: 0.5 m wide
        h = bpy.context.object; h.name = f"SI_{name}_head"; h.parent = rig; h.data.materials.append(mat("si_head", (0.95, 0.95, 0.95)))
        bpy.ops.mesh.primitive_cube_add(size=0.12, location=(0, -0.26, 1.48 * k))        # nose: facing (three +z = blender -y)
        n = bpy.context.object; n.name = f"SI_{name}_nose"; n.parent = rig; n.data.materials.append(mat("si_nose", (0.9, 0.2, 0.2)))
    else:
        w, hh, d = size or ((1.75, 1.3, 4.4) if kind == "car" else (1, 1, 1))
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, hh / 2 + (0.1 if kind == "car" else 0)))
        o = bpy.context.object; o.name = f"SI_{name}_box"; o.scale = (w, d, hh); o.parent = rig
        o.data.materials.append(mat("si_car" if kind == "car" else "si_box", (0.1, 0.45, 0.2) if kind == "car" else (0.6, 0.5, 0.3)))
        bpy.ops.mesh.primitive_cube_add(size=0.3, location=(0, -d / 2, hh * 0.8))       # front marker
        n = bpy.context.object; n.name = f"SI_{name}_front"; n.parent = rig; n.data.materials.append(mat("si_nose", (0.9, 0.2, 0.2)))
    return rig


def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.fps = FPS
    sc.frame_start, sc.frame_end = 1, N
    if spec.get("set"):
        bpy.ops.import_scene.gltf(filepath=os.path.join(PROJ, "public", "sets", f"{spec['set']}.glb"))
    things = {}
    # moving things exported from three.js (CamPaths.tsx): keyed every frame
    if os.path.exists(PATHS_F):
        P = json.load(open(PATHS_F, encoding="utf-8"))
        for name, th in P.get("things", {}).items():
            rig = standin(name, th.get("kind", "person"), th.get("height") or 1.7, th.get("size"))
            for f in range(N):
                k = min(f, len(th["p"]) - 1)
                rig.location = b(th["p"][k]); rig.rotation_euler = (0, 0, th["yaw"][k])
                rig.keyframe_insert("location", frame=f + 1); rig.keyframe_insert("rotation_euler", frame=f + 1)
            things[name] = rig
    for s in spec.get("standins", []):
        rig = standin(s["name"], s.get("kind", "person"), s.get("height", 1.7), s.get("size"))
        rig.location = b(s["at"]); rig.rotation_euler = (0, 0, s.get("yaw", 0))
        things[s["name"]] = rig
    # the camera: keyed location, Track To an eased look empty (up = world Z: no roll), one lens
    cd = bpy.data.cameras.new("ShotCam")
    cd.sensor_fit = "VERTICAL"; cd.sensor_height = 24.0
    cd.lens = spec["mm"] if "mm" in spec else 12.0 / math.tan(math.radians(spec.get("lens", 50)) / 2)
    cd.clip_start, cd.clip_end = 0.05, 600
    cam = bpy.data.objects.new("ShotCam", cd); sc.collection.objects.link(cam); sc.camera = cam
    tgt = bpy.data.objects.new("ShotCam_look", None); sc.collection.objects.link(tgt)
    for k in spec["keys"]:
        f = int(k["f"]) + 1
        cam.location = b(k["pos"]); cam.keyframe_insert("location", frame=f)
        tgt.location = b(k["look"]); tgt.keyframe_insert("location", frame=f)
    for ob in (cam, tgt):
        act = ob.animation_data.action
        curves = list(getattr(act, "fcurves", []) or [])
        if not curves:   # Blender 5 layered actions: action.layers[].strips[].channelbags[].fcurves
            for L in getattr(act, "layers", []):
                for st in L.strips:
                    for cb in getattr(st, "channelbags", []): curves += list(cb.fcurves)
        for fc in curves:
            for kp in fc.keyframe_points:
                kp.interpolation = "BEZIER"; kp.handle_left_type = kp.handle_right_type = "AUTO_CLAMPED"
            fc.update()
    con = cam.constraints.new("TRACK_TO"); con.target = tgt
    con.track_axis = "TRACK_NEGATIVE_Z"; con.up_axis = "UP_Y"
    sc.render.resolution_x, sc.render.resolution_y = 1080, 1920
    os.makedirs(os.path.dirname(BLEND_F), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=BLEND_F)
    return sc


sc = build() if not EXPORT_ONLY else (bpy.ops.wm.open_mainfile(filepath=BLEND_F) or bpy.context.scene)
sc = bpy.context.scene
cam = sc.camera; tgt = bpy.data.objects["ShotCam_look"]
follow = spec.get("follow")
fol = bpy.data.objects.get(f"SI_{follow['name']}") if follow else None
if follow and not fol: print(f"CAM WARN follow: no stand-in {follow['name']}")

# ---- export every frame (three.js coordinates)
frames = []
for f in range(sc.frame_start, sc.frame_end + 1):
    sc.frame_set(f)
    M = cam.matrix_world
    pos = M.translation.copy()
    fwd = -(M.to_3x3() @ Vector((0, 0, 1))).normalized()
    upv = (M.to_3x3() @ Vector((0, 1, 0))).normalized()
    look = tgt.matrix_world.translation.copy()
    if fol:  # the look point leans toward the followed stand-in (baked: the .blend keeps the plain keyed target)
        off = follow.get("offset", [0, 1.3, 0])
        look = look.lerp(fol.matrix_world.translation + b(off), float(follow.get("mix", 0.5)))
        fwd = (look - pos).normalized()
        upv = Vector((0, 0, 1)) - fwd * fwd.dot(Vector((0, 0, 1))); upv.normalize()
    dist = max(0.5, (look - pos).length)
    lookp = pos + fwd * dist
    z = Vector((0, 0, 1)); nr = (z - fwd * fwd.dot(z)).normalized()
    roll = math.degrees(math.atan2(fwd.dot(nr.cross(upv)), nr.dot(upv)))
    vfov = math.degrees(2 * math.atan(cam.data.sensor_height / 2 / cam.data.lens))
    frames.append({"t": round((f - sc.frame_start) / FPS, 5), "p": t3(pos), "l": t3(lookp), "fov": round(vfov, 4), "roll": round(roll, 4)})

# ---- checks: no roll, one direction (no move / pan reversals), eased start and stop (>= EASE_MIN s)
EPS = 1e-5
def sub(a, c): return [x - y for x, y in zip(a, c)]
def norm(v): return math.sqrt(sum(x * x for x in v))
steps = [sub(frames[i + 1]["p"], frames[i]["p"]) for i in range(len(frames) - 1)]
rev = sum(1 for a, c in zip(steps, steps[1:]) if norm(a) > EPS and norm(c) > EPS and sum(x * y for x, y in zip(a, c)) < 0)
def ang(fr):
    d = sub(fr["l"], fr["p"]); return math.atan2(d[0], d[2]), math.atan2(d[1], math.hypot(d[0], d[2]))
yp = [ang(fr) for fr in frames]
def reversals(vals):
    dv = [math.atan2(math.sin(b2 - a2), math.cos(b2 - a2)) for a2, b2 in zip(vals, vals[1:])]   # wrapped (yaw crosses +-pi)
    dv = [x for x in dv if abs(x) > 2e-5]          # ignore numerical noise at rest
    return sum(1 for a2, c2 in zip(dv, dv[1:]) if a2 * c2 < 0)
pan_rev = reversals([y for y, _ in yp])
tilt_rev = reversals([p for _, p in yp])
def ease(speeds):
    """seconds from the move's start to 90 % of its top speed, and from 90 % down to its end"""
    top = max(speeds) if speeds else 0
    if top < 1e-4: return None, None
    on = [i for i, s in enumerate(speeds) if s > 0.02 * top]
    hi = [i for i, s in enumerate(speeds) if s >= 0.9 * top]
    return round((hi[0] - on[0]) / FPS, 3), round((on[-1] - hi[-1]) / FPS, 3)
sp_pos = [norm(s) * FPS for s in steps]
def wrap(x): return math.atan2(math.sin(x), math.cos(x))
sp_pan = [math.hypot(wrap(yp[i + 1][0] - yp[i][0]), yp[i + 1][1] - yp[i][1]) * FPS for i in range(len(yp) - 1)]
e_in, e_out = ease(sp_pos)
p_in, p_out = ease(sp_pan)
check = {"max_roll_deg": max(abs(fr["roll"]) for fr in frames), "move_reversals": rev, "pan_reversals": pan_rev, "tilt_reversals": tilt_rev,
         "move_ease_in_s": e_in, "move_ease_out_s": e_out, "pan_ease_in_s": p_in, "pan_ease_out_s": p_out,
         "travel_m": round(norm(sub(frames[-1]["p"], frames[0]["p"])), 3), "top_speed_mps": round(max(sp_pos or [0]), 3)}
fails, warns = [], []
if check["max_roll_deg"] > 0.01: fails.append(f"roll {check['max_roll_deg']} deg (must be 0)")
if rev: fails.append(f"{rev} move reversal(s): the lens changes direction (one move, one direction)")
if pan_rev: fails.append(f"{pan_rev} pan reversal(s): the aim swings back (no re-aims)")
if tilt_rev: warns.append(f"{tilt_rev} tilt reversal(s): the aim goes up then down (fine when the lens trucks past a fixed look point; a bob is a re-aim)")
# a key before frame 0 / after the last frame = the move is already running at the cut (hard cuts only while moving,
# CAMERA_STUDY): that end is not eased on purpose, so its ease check is skipped
kf = [int(k["f"]) for k in spec["keys"]]
for k in ("move_ease_in_s", "move_ease_out_s", "pan_ease_in_s", "pan_ease_out_s"):
    if (k.endswith("in_s") and min(kf) < 0) or (k.endswith("out_s") and max(kf) > N - 1): continue
    if check[k] is not None and check[k] < EASE_MIN: fails.append(f"{k} {check[k]} < {EASE_MIN} s (ease the start/stop)")

# ---- framing: the subject's head width in % of the frame width, in frame, the view not blocked by the set
heads = {o.name[3:-5]: o for o in bpy.data.objects if o.name.startswith("SI_") and o.name.endswith("_head")}
subj = spec.get("subject") or (next(iter(heads)) if heads else None)
deps = bpy.context.evaluated_depsgraph_get()
setobjs = [o for o in sc.objects if o.type == "MESH" and not o.name.startswith("SI_")]
frame_info, blocked = [], []
ar = sc.render.resolution_x / sc.render.resolution_y
for f in range(sc.frame_start, sc.frame_end + 1, 5):
    sc.frame_set(f); deps = bpy.context.evaluated_depsgraph_get()
    cpos = cam.matrix_world.translation
    if subj and subj in heads:
        hp = heads[subj].matrix_world.translation
        d = (hp - cpos).length
        hf = math.radians(frames[f - sc.frame_start]["fov"])
        hfov_w = 2 * math.atan(math.tan(hf / 2) * ar)
        pct = 100 * 0.5 / (2 * d * math.tan(hfov_w / 2))
        v = world_to_camera_view(sc, cam, hp)
        frame_info.append({"f": f - 1, "head_pct": round(pct, 1), "head_xy": [round(v.x, 2), round(1 - v.y, 2)], "in_frame": bool(0 < v.x < 1 and 0 < v.y < 1 and v.z > 0)})
        # set blocking the line of sight to the head
        hit, loc, _n, _i, ob, _m = sc.ray_cast(deps, cpos, (hp - cpos).normalized(), distance=max(0.0, d - 0.35))
        if hit and ob and not ob.name.startswith("SI_"): blocked.append((f - 1, ob.name))
if frame_info:
    pcts = [x["head_pct"] for x in frame_info]
    check["subject"] = subj
    check["head_pct_min_max"] = [min(pcts), max(pcts)]
    if max(pcts) > 25: warns.append(f"head up to {max(pcts)} % of the frame width (RicksClips 12-18 %, no face-filling close-ups)")
    if min(pcts) < 8: warns.append(f"head down to {min(pcts)} % of the frame width (RicksClips 12-18 %)")
    out_f = [x["f"] for x in frame_info if not x["in_frame"]]
    if out_f: warns.append(f"subject head out of frame at shot frames {out_f[:8]}")
if blocked: warns.append(f"set blocks the subject at shot frames {[f for f, _ in blocked][:8]} ({blocked[0][1]})")
check["ok"] = not fails

out = {"fps": FPS, "source": f"blender/cams/{SHOT}.blend (ShotCam, Track To ShotCam_look)", "frames": frames, "check": check}
os.makedirs(os.path.dirname(OUT_F), exist_ok=True)
with open(OUT_F, "w") as fh: json.dump(out, fh)
print("CAM EXPORT", len(frames), "frames ->", OUT_F)
print("CAM CHECK " + json.dumps(check))
for w in warns: print("CAM WARN " + w)
for x in fails: print("CAM FAIL " + x)

# ---- Workbench previews of the camera view
od = os.path.join(PROJ, "out", "cams"); os.makedirs(od, exist_ok=True)
try: sc.render.engine = "BLENDER_WORKBENCH"
except TypeError as e: print("engine", e)
if not sc.world: sc.world = bpy.data.worlds.new("CamPreviewSky")
sc.world.color = (0.55, 0.66, 0.82)   # Workbench draws the world colour as the sky
shd = sc.display.shading
shd.light = "STUDIO"; shd.color_type = "TEXTURE"; shd.show_shadows = True; shd.show_cavity = True
sc.render.resolution_percentage = 50
sc.render.image_settings.file_format = "PNG"
pv = spec.get("previews") or [0, N // 2, N - 1]
for f in pv:
    f = max(0, min(N - 1, int(f)))
    sc.frame_set(f + 1)
    sc.render.filepath = os.path.join(od, f"{SHOT}_f{f:03d}.png")
    bpy.ops.render.render(write_still=True)
    print("CAM PREVIEW", sc.render.filepath)
if fails: sys.exit(3)
