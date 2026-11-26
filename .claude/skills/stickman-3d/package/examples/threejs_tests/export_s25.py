"""Pilot: build Grave Bell shot 25 with the real Blender shot code, then export the set as GLB + per-frame tracks
(camera, cards, animated props, lights) for the three.js (inkbeat) re-render.
blender -b -P export_s25.py"""
import sys, json, math, time
from pathlib import Path
BL = Path(r"D:\resource\stickman\grave_bell\blender")
sys.path.insert(0, str(BL))
OUT = Path(r"D:\resource\inkbeat-test\public\pilot25"); OUT.mkdir(parents=True, exist_ok=True)
import bpy
from mathutils import Vector, Matrix
t0 = time.time()
import shotlib
shotlib.OUT = OUT / "bl"; shotlib.OUT.mkdir(exist_ok=True)      # card sequences land here, not in the real project
import lib
import shots_graveyard as SGS

SID = 25
s = SGS.graveyard_shot(SID)
sc = bpy.context.scene
print("BUILD", round(time.time() - t0, 1), "s")

C = Matrix(((1, 0, 0, 0), (0, 0, 1, 0), (0, -1, 0, 0), (0, 0, 0, 1)))   # Blender Z-up -> glTF Y-up
Ci = C.inverted()
def v3(v): return [round(v.x, 5), round(v.z, 5), round(-v.y, 5)]
def m4(m): return [round(x, 6) for col in (C @ m @ Ci).transposed() for x in col]   # column-major like three

# ---- tracks
cards = s.cards
anim = [o for o in bpy.data.objects if o.parent is None and o.animation_data and o.type in ("MESH", "EMPTY")
        and o.name != s.cam.name and not any(o is c.root for c in cards)]
frames = []
for f in range(1, s.n + 1):
    sc.frame_set(f)
    mw = s.cam.matrix_world
    pos = mw.translation.copy(); fwd = -(mw.to_3x3() @ Vector((0, 0, 1))); up = mw.to_3x3() @ Vector((0, 1, 0))
    cd = s.cam.data
    fr = dict(cam=dict(pos=v3(pos), look=v3(pos + fwd * 5.0), up=v3(up), fov=round(math.degrees(2 * math.atan(12.0 / cd.lens)), 4),
                       focus=round(cd.dof.focus_distance, 4), fstop=round(cd.dof.aperture_fstop, 3)),
              cards=[dict(name=c.name, pos=v3(c.root.matrix_world.translation), scale=round(c.root.scale[0], 5),
                          hidden=bool(c.root.hide_render)) for c in cards],
              props={o.name: dict(m=m4(o.matrix_world), hidden=bool(o.hide_render)) for o in anim})
    frames.append(fr)
sc.frame_set(1)

sun = next((o for o in bpy.data.objects if o.type == "LIGHT" and o.data.type == "SUN"), None)
lights = []
for o in bpy.data.objects:
    if o.type != "LIGHT": continue
    d = o.matrix_world.to_3x3() @ Vector((0, 0, 1))      # toward the light
    lights.append(dict(name=o.name, kind=o.data.type, color=[round(x, 4) for x in o.data.color], energy=o.data.energy,
                       pos=v3(o.matrix_world.translation), dir=v3(d)))
track = dict(sid=SID, a=s.a, b=s.b, g0=s.g0, n=s.n, fps=lib.FPS,
             card=dict(W=lib.CARD_W, H=lib.CARD_H, anchor=list(lib.ANCHOR), stand_px=lib.STAND_PX,
                       list=[dict(name=c.name, height=c.height, tint=c.tint, unit=c.unit) for c in cards]),
             anim=[o.name for o in anim], lights=lights, frames=frames)
(OUT / "track.json").write_text(json.dumps(track))
print("TRACK", len(frames), "frames,", len(anim), "animated props:", [o.name for o in anim])

# ---- strip what three.js does itself: cards, ink hulls, lights, camera
for c in cards:
    for o in (c.plane, c.root): bpy.data.objects.remove(o, do_unlink=True)
for o in list(bpy.data.objects):
    if o.type in ("LIGHT", "CAMERA"): bpy.data.objects.remove(o, do_unlink=True); continue
    if o.type == "MESH":
        for m in list(o.modifiers):
            if m.type == "SOLIDIFY" and m.name == "ink": o.modifiers.remove(m)
        o.hide_render = False; o.hide_viewport = False
t1 = time.time()
bpy.ops.export_scene.gltf(filepath=str(OUT / "scene.glb"), export_format="GLB", export_apply=True, export_yup=True,
                          export_cameras=False, export_lights=False, export_animations=False, use_selection=False)
print("EXPORT", round(time.time() - t1, 1), "s; total", round(time.time() - t0, 1), "s")
