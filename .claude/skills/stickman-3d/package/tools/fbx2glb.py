"""Mixamo FBX -> GLB (skeleton + animation only) for the three.js 3D stickman test.
blender -b --factory-startup -P fbx2glb.py -- in.fbx out.glb"""
import bpy, sys
a = sys.argv[sys.argv.index("--") + 1:]
src, dst = a[0], a[1]
bpy.ops.wm.read_homefile(use_empty=True)
bpy.ops.import_scene.fbx(filepath=src, automatic_bone_orientation=False)
arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
# drop any skinned mesh (we only need the bones)
for o in list(bpy.data.objects):
    if o.type == "MESH": bpy.data.objects.remove(o, do_unlink=True)
act = arm.animation_data.action if arm.animation_data else None
print("ARM", arm.name, "scale", tuple(round(x, 4) for x in arm.scale), "bones", len(arm.data.bones),
      "frames", tuple(act.frame_range) if act else None, "fps", bpy.context.scene.render.fps)
print("BONES", [b.name for b in arm.data.bones][:30])
bpy.ops.export_scene.gltf(filepath=dst, export_format="GLB", export_animations=True, export_yup=True, export_skins=False,
                          export_def_bones=False, export_frame_range=False, export_force_sampling=True)
print("DONE", dst)
