import json, os, sys, urllib.request, zipfile, io
ROOT = os.path.join('public', 'assets')
UA = {'User-Agent': 'Mozilla/5.0 (asset fetch for a personal video project)'}
def get(url, timeout=120):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout).read()
# 1. Poly Haven (CC0): gltf 1k + its bin/textures, each model in its own folder
PH = ['wooden_barrels_01','barrel_03','wooden_crate_01','wooden_crate_02','wooden_bucket_01','wooden_lantern_01','vintage_oil_lamp','painted_wooden_table',
      'painted_wooden_chair_01','painted_wooden_bench','wooden_picnic_table','round_wooden_table_01','wooden_bookshelf_worn','wooden_display_shelves_01',
      'metal_office_desk','CashRegister_01','vintage_grandfather_clock_01','treasure_chest','wooden_ladder','wooden_broom','service_pistol','folding_wooden_stool',
      'WoodenChair_01','WoodenTable_01','Lantern_01','barrel_stove','wooden_military_crate','Shelf_01']
ok = []
for mid in PH:
    try:
        f = json.loads(get(f'https://api.polyhaven.com/files/{mid}'))
        g = f['gltf']['1k']['gltf']
        out = os.path.join(ROOT, 'ph', mid); os.makedirs(out, exist_ok=True)
        files = [(os.path.basename(g['url']), g['url'])] + [(k, v['url']) for k, v in g.get('include', {}).items()]
        total = 0
        for rel, url in files:
            assert url.startswith('https://dl.polyhaven.org/'), url
            p = os.path.normpath(os.path.join(out, rel)); assert os.path.abspath(p).startswith(os.path.abspath(out))
            os.makedirs(os.path.dirname(p), exist_ok=True)
            data = get(url); open(p, 'wb').write(data); total += len(data)
        ok.append((mid, os.path.basename(g['url']), round(total / 1e6, 2)))
        print('ok', mid, round(total / 1e6, 2), 'MB', flush=True)
    except Exception as e:
        print('FAIL', mid, repr(e)[:120], flush=True)
json.dump(ok, open('assets/ph_ok.json', 'w'))
# 2. Kenney Nature Kit (CC0) from OpenGameArt: keep a handful of GLB models
z = zipfile.ZipFile(io.BytesIO(get('https://opengameart.org/sites/default/files/Nature%20Kit%20%282.1%29.zip', 300)))
names = [n for n in z.namelist() if n.lower().endswith('.glb')]
print('nature kit glb files:', len(names))
want = ['tree_oak','tree_default','tree_fat','tree_detailed','tree_thin','tree_tall','tree_pineDefaultA','tree_pineRoundA','tree_pineTallA','rock_largeA','rock_largeB','rock_tallA','stone_largeA','stone_tallA',
        'fence_simple','fence_simpleLow','fence_gate','log','log_large','stump_old','stump_round','campfire_stones','plant_bush','plant_bushLarge','plant_bushDetailed','grass','grass_large','flower_redA','flower_yellowA','tent_detailedOpen','hanging_moss']
n_ok = 0
for n in names:
    b = os.path.basename(n)[:-4]
    if b in want:
        out = os.path.join(ROOT, 'kenney', b + '.glb'); open(out, 'wb').write(z.read(n)); n_ok += 1
print('kept', n_ok, sorted(os.listdir(os.path.join(ROOT, 'kenney'))))
