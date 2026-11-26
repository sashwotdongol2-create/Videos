"""Download CC0 Poly Haven models (1k glTF) and save each as blender/assets/<id>.blend (packed, centred, on the ground).
blender -b -P get_assets.py -- id1 id2 ...      (downloads are data only; nothing from them is executed)
PBR textures: tex:<id>[@2k] -> blender/tex/ph/<id>_diff.jpg, _nor.jpg (OpenGL normal), _rough.jpg (1k default); use them
with sets.pbr_mat(name, "<id>", unit) (normal + roughness survive the export; the three.js toon shader reads both)."""
import bpy, json, sys, urllib.request
from pathlib import Path
HERE = Path(__file__).resolve().parent
DL = HERE / "_dl"; OUT = HERE / "assets"; OUT.mkdir(exist_ok=True)
ids = sys.argv[sys.argv.index("--") + 1:]


def get(url, dst):
    dst.parent.mkdir(parents=True, exist_ok=True)
    if not dst.exists():
        req = urllib.request.Request(url, headers={"User-Agent": "stickman-assets"})
        dst.write_bytes(urllib.request.urlopen(req, timeout=120).read())
    return dst


def get_tex(spec):
    aid, _, res = spec[4:].partition("@"); res = res or "1k"
    td = HERE / "tex" / "ph"; td.mkdir(parents=True, exist_ok=True)
    if all((td / f"{aid}_{k}.jpg").exists() for k in ("diff", "nor", "rough")): print("have", spec); return
    info = json.loads(urllib.request.urlopen(urllib.request.Request(f"https://api.polyhaven.com/files/{aid}", headers={"User-Agent": "stickman-assets"}), timeout=60).read())
    for key, k in (("Diffuse", "diff"), ("nor_gl", "nor"), ("Rough", "rough")):
        e = info.get(key, {}).get(res) or info.get(key, {}).get("1k")
        if not e: print("FAIL", spec, "no", key); continue
        get(e["jpg"]["url"], td / f"{aid}_{k}.jpg")
    print("saved", spec)


for aid in ids:
    if aid.startswith("tex:"):
        try: get_tex(aid)
        except Exception as e: print("FAIL", aid, repr(e)[:200])
        continue
    if (OUT / f"{aid}.blend").exists(): print("have", aid); continue
    try:
        info = json.loads(urllib.request.urlopen(urllib.request.Request(f"https://api.polyhaven.com/files/{aid}", headers={"User-Agent": "grave-bell-assets"}), timeout=60).read())
        g = info["gltf"]["1k"]["gltf"]; d = DL / aid
        main = get(g["url"], d / Path(g["url"]).name)
        for rel, inc in g.get("include", {}).items(): get(inc["url"], d / rel)
        bpy.ops.wm.read_homefile(use_empty=True)
        bpy.ops.import_scene.gltf(filepath=str(main))
        objs = [o for o in bpy.data.objects]
        meshes = [o for o in objs if o.type == "MESH"]
        bpy.ops.object.select_all(action="DESELECT")
        for o in meshes: o.select_set(True)
        bpy.context.view_layer.objects.active = meshes[0]
        if len(meshes) > 1: bpy.ops.object.join()
        o = bpy.context.active_object; o.name = aid; o.parent = None
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        for x in list(bpy.data.objects):
            if x != o: bpy.data.objects.remove(x)
        bb = [o.matrix_world @ __import__("mathutils").Vector(c) for c in o.bound_box]
        cx = (min(v.x for v in bb) + max(v.x for v in bb)) / 2; cy = (min(v.y for v in bb) + max(v.y for v in bb)) / 2; z0 = min(v.z for v in bb)
        for v in o.data.vertices: v.co.x -= cx; v.co.y -= cy; v.co.z -= z0
        bpy.ops.file.pack_all()
        bpy.data.libraries.write(str(OUT / f"{aid}.blend"), {o}, fake_user=True, compress=True)
        print("saved", aid, tuple(round(x, 2) for x in o.dimensions))
    except Exception as e:
        print("FAIL", aid, repr(e)[:200])
