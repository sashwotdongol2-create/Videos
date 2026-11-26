"""Append every mesh from a .blend asset and export it as GLB (real textures), printing its bounding box.
blender -b --factory-startup -P asset2glb.py -- in.blend out.glb"""
import bpy, sys
from mathutils import Vector
a = sys.argv[sys.argv.index("--") + 1:]
src, dst = a[0], a[1]
bpy.ops.wm.read_homefile(use_empty=True)
with bpy.data.libraries.load(src, link=False) as (f, t):
    t.objects = list(f.objects)
for o in t.objects:
    if o is not None and o.type == "MESH": bpy.context.scene.collection.objects.link(o)
ms = [o for o in bpy.context.scene.objects if o.type == "MESH"]
bpy.context.view_layer.update()
pts = [o.matrix_world @ Vector(c) for o in ms for c in o.bound_box]
lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
print("BBOX", [round(x, 3) for x in lo], [round(x, 3) for x in hi], "objects", [o.name for o in ms], "polys", sum(len(o.data.polygons) for o in ms))
bpy.ops.export_scene.gltf(filepath=dst, export_format="GLB", export_apply=True, export_yup=True)
print("DONE", dst)
