"""vault: 1920s bank vault (design sample for the master kit). State: lamp. Room 10 x 9 m, open toward -Y (camera).
Round steel vault door on the back wall at (0, 4.4); walls of brass safe-deposit boxes left/right; marble columns;
gold-bar stacks, coin piles and cash sacks around the door; a banker's desk with lamp front-left (foreground layer).
Colour script: teal-green walls + brass/gold + warm lamp key, cool fill. Sketchfab CC-BY: Bank Vault Door, Gold Bar
pile, Gold Coin Pile, Cash Sack, Vintage desk lamp, Doric Marble Column."""
import bpy, math, random
import lib, sets
from lib import box, light, emissive


def deposit_wall(name, x0, y0, yaw, cols, rows, w=0.42, h=0.3):
    brass = lib.mat(name + "brM", "#c89a48", rough=0.3); dark = lib.mat(name + "dkM", "#3a2a18", rough=0.6)
    knob = lib.mat(name + "knM", "#f0d488", rough=0.2)
    c, s = math.cos(math.radians(yaw)), math.sin(math.radians(yaw))
    for i in range(cols):
        for j in range(rows):
            u = (i - (cols - 1) / 2) * (w + 0.03)
            z = 0.25 + j * (h + 0.03) + h / 2
            x, y = x0 + c * u, y0 + s * u
            box(f"{name}_b{i}_{j}", (x, y, z), (w, 0.06, h), brass, rot=(0, 0, yaw), ink=True)
            nx, ny = -s * 0.04, c * 0.04  # toward the room
            box(f"{name}_k{i}_{j}", (x + nx * (1 if yaw == 0 else 1), y + ny, z), (0.08, 0.03, 0.05), knob, rot=(0, 0, yaw), ink=False)
            box(f"{name}_n{i}_{j}", (x + nx * 0.6, y + ny * 0.6, z + h * 0.3), (0.12, 0.02, 0.03), dark, rot=(0, 0, yaw), ink=False)


def bar_stack(name, x0, y0, yaw, layers, z0=0.0):
    """pyramid of bevelled trapezoid gold bars (alternating directions), metallic gold"""
    m = bpy.data.materials.get("barGold") or lib.mat("barGold", "#f4c445", rough=0.18)
    b = m.node_tree.nodes.get("Principled BSDF")
    if b: b.inputs["Metallic"].default_value = 0.9
    c, s_ = math.cos(math.radians(yaw)), math.sin(math.radians(yaw))
    L, W, H = 0.25, 0.09, 0.05; n = 0
    for j in range(layers):
        rows = max(1, 4 - j // 2); cols = max(1, 6 - j)
        for r in range(rows):
            for i in range(cols):
                u = (i - (cols - 1) / 2) * (W + 0.008); v = (r - (rows - 1) / 2) * (L + 0.01)
                x, y = x0 + c * u - s_ * v, y0 + s_ * u + c * v
                o = box(f"{name}_{n}", (x, y, z0 + H / 2 + j * H), (W, L, H), m, rot=(0, 0, yaw), ink=True)
                bv = o.modifiers.new("bev", "BEVEL"); bv.width = 0.01; bv.segments = 2
                n += 1


def vault_door(x, y, zc):
    """round steel vault door (open 0 deg): thick ring frame set into the wall, door slab with radial bolts, a
    spoked handwheel, three hinge barrels on the left, a time-lock panel. Door slab = object 'vaultdoor' (pivot at
    the hinge) so shots can swing it."""
    steel = lib.mat("vSteel", "#9aa4ac", rough=0.28); dark = lib.mat("vDark", "#4a5258", rough=0.35)
    brass = lib.mat("vBrass", "#d8aa50", rough=0.22); chrome = lib.mat("vChrome", "#e4eaee", rough=0.12)
    for m in (steel, dark, brass, chrome):
        bb = m.node_tree.nodes.get("Principled BSDF")
        if bb: bb.inputs["Metallic"].default_value = 0.9
    R = 1.55
    # cut the doorway through the back wall, wainscot and rail so the open door shows the vault room behind
    cut = lib.add_mesh("cyl", "vcut", (x, y + 0.3, zc), (R + 0.02, R + 0.02, 0.6), rot=(90, 0, 0), ink=False, vertices=64)
    for nm in ("back", "wains", "rail"):
        o = bpy.data.objects.get(nm)
        if not o: continue
        md = o.modifiers.new("door", "BOOLEAN"); md.object = cut; md.operation = "DIFFERENCE"
        bpy.context.view_layer.objects.active = o; bpy.ops.object.modifier_apply(modifier="door")
    bpy.data.objects.remove(cut)
    ring = lib.add_mesh("cyl", "vframe", (x, y, zc), (R + 0.32, R + 0.32, 0.11), rot=(90, 0, 0), material=dark, vertices=64)
    hole = lib.add_mesh("cyl", "vhole", (x, y - 0.02, zc), (R + 0.02, R + 0.02, 0.3), rot=(90, 0, 0), material=dark, ink=False, vertices=64)
    md = ring.modifiers.new("cut", "BOOLEAN"); md.object = hole; md.operation = "DIFFERENCE"
    bpy.context.view_layer.objects.active = ring; bpy.ops.object.modifier_apply(modifier="cut"); bpy.data.objects.remove(hole)
    piv = bpy.data.objects.new("vaultdoor", None); bpy.context.scene.collection.objects.link(piv); piv.location = (x - R, y - 0.12, zc)
    parts = [lib.add_mesh("cyl", "vslab", (x, y - 0.12, zc), (R, R, 0.14), rot=(90, 0, 0), material=steel, vertices=64)]
    parts.append(lib.add_mesh("cyl", "vslabface", (x, y - 0.265, zc), (R * 0.82, R * 0.82, 0.01), rot=(90, 0, 0), material=chrome, ink=False, vertices=64))
    for k in range(20):  # radial locking bolts around the rim
        a = k / 20 * 6.283
        parts.append(lib.add_mesh("cyl", f"vbolt{k}", (x + math.cos(a) * (R - 0.16), y - 0.28, zc + math.sin(a) * (R - 0.16)), (0.07, 0.07, 0.03), rot=(90, 0, 0), material=brass, ink=True, vertices=16))
    parts.append(lib.add_mesh("cyl", "vhub", (x, y - 0.32, zc), (0.16, 0.16, 0.08), rot=(90, 0, 0), material=brass, vertices=24))
    for k in range(6):  # handwheel spokes + rim
        a = k / 6 * 6.283
        parts.append(box(f"vspoke{k}", (x + math.cos(a) * 0.3, y - 0.36, zc + math.sin(a) * 0.3), (0.6, 0.04, 0.05), chrome, rot=(0, -math.degrees(a), 0), ink=False))
    wr = lib.add_mesh("torus", "vwheel", (x, y - 0.38, zc), (1, 1, 1), rot=(90, 0, 0), material=chrome, ink=True, major_radius=0.6, minor_radius=0.04) if True else None
    parts.append(wr)
    parts.append(box("vtimelock", (x + 0.75, y - 0.3, zc + 0.75), (0.42, 0.06, 0.3), brass))
    for k in range(3):
        parts.append(lib.add_mesh("cyl", f"vdial{k}", (x + 0.62 + k * 0.13, y - 0.34, zc + 0.75), (0.045, 0.045, 0.02), rot=(90, 0, 0), material=lib.mat("dialM", "#f4ecd8"), ink=False, vertices=16))
    for dz in (-0.9, 0, 0.9):  # hinge barrels
        parts.append(lib.add_mesh("cyl", f"vhinge{dz}", (x - R - 0.12, y - 0.2, zc + dz), (0.12, 0.12, 0.32), material=dark, vertices=20))
    bpy.context.view_layer.update()
    # the handwheel spins on its own pivot (object 'vwheelpiv', axis = door normal) inside the swinging door
    wp = bpy.data.objects.new("vwheelpiv", None); bpy.context.scene.collection.objects.link(wp); wp.location = (x, y - 0.36, zc)
    for o in [o for o in parts if o.name.startswith(("vspoke", "vwheel", "vhub"))]:
        mw = o.matrix_world.copy(); o.parent = wp; o.matrix_world = mw
        parts.remove(o)
    parts.append(wp)
    bpy.context.view_layer.update()
    for o in parts:
        mw = o.matrix_world.copy(); o.parent = piv; o.matrix_world = mw
    # vault interior visible through the gap: dark back + gold glow (when the door swings)
    box("vinside", (x, y + 2.2, zc), (2 * R + 1, 0.1, 2 * R + 1), lib.mat("vinsideM", "#3a2a18"), ink=False)
    for sx in (-1, 1):
        box(f"vtunnel{sx}", (x + sx * (R + 0.05), y + 1.2, zc), (0.1, 2.0, 2 * R), lib.mat("vtunM", "#5a6268", rough=0.3), ink=False)
    box("vtunfloor", (x, y + 1.2, zc - R + 0.05), (2 * R, 2.0, 0.1), lib.mat("vtunF", "#4a5258", rough=0.3), ink=False)
    for k in range(3):
        bar_stack(f"vin{k}", x - 0.8 + k * 0.8, y + 1.5, 0, 7, zc - R + 0.1)  # heaped gold inside, glowing under its own light
    lib.add_mesh("sphere", "vinglow", (x, y + 1.6, zc + 0.9), (0.18, 0.18, 0.12), material=emissive("vinglowM", "#ffd070", 8.0), ink=False)


def coin_heaps(heaps):
    gold = lib.mat("coinM", "#f2c040", rough=0.22)
    for mm in (gold,):
        bb = mm.node_tree.nodes.get("Principled BSDF")
        if bb: bb.inputs["Metallic"].default_value = 0.85; edge = lib.mat("coinE", "#b8862a", rough=0.3)
    n = 0
    for (cx, cy, r, h) in heaps:
        for k in range(int(1800 * r)):
            a = random.uniform(0, 6.283); d = r * math.sqrt(random.random())
            z = h * (1 - (d / r) ** 1.3) * random.uniform(0.75, 1.0)
            o = lib.add_mesh("cyl", f"coin{n}", (cx + math.cos(a) * d, cy + math.sin(a) * d, z + 0.006), (0.017, 0.017, 0.003),
                             rot=(random.uniform(-35, 35), random.uniform(-35, 35), 0), material=gold if k % 4 else edge, ink=False, vertices=12)
            n += 1


def dressing():
    brass = lib.mat("brassD", "#d8a850", rough=0.25); wood = sets.pbr_mat("darkwood", "wood_floor", tint="#5a2e1a")
    # bank sign above the door (gold letters on black lacquer)
    sg = sets.plane("signbank", 3.4, 0.425, sets.image_mat("signBankM", sets.TEX / "sign_bank.png"), (0, 4.5, 4.15))
    # wall sconces with glow on the side walls and back wall
    for (x, y) in ((-4.85, 0.0), (4.85, 0.0), (-4.85, 3.4), (4.85, 3.4), (-2.6, 4.55), (2.6, 4.55)):
        box(f"scb{x}{y}", (x, y, 2.6), (0.12, 0.12, 0.3), brass)
        lib.add_mesh("sphere", f"scg{x}{y}", (x * 0.97 if abs(x) > 4 else x, y * 0.98 if y > 4 else y, 2.85), (0.1, 0.1, 0.13), material=emissive("scgM", "#ffcf80", 6.0), ink=False)
    # wall clock + founder portrait on the back wall, above the deposit boxes (read in wides and two-shots)
    lib.add_mesh("cyl", "clockrim", (3.1, 4.47, 3.75), (0.5, 0.5, 0.04), rot=(90, 0, 0), material=brass)
    sets.plane("clockface", 0.9, 0.9, sets.image_mat("clockM", sets.TEX / "clock_face.png"), (3.1, 4.42, 3.75))
    box("pframe", (-3.1, 4.48, 3.75), (0.95, 0.06, 1.2), lib.mat("pframeM", "#c89a48", rough=0.25))
    sets.plane("portrait", 0.78, 1.04, sets.image_mat("portraitM", sets.TEX / "portrait.png"), (-3.1, 4.44, 3.75))
    # trolley with cash sacks (mid-right)
    box("trolley", (2.3, 1.4, 0.42), (0.9, 0.55, 0.06), wood); box("trolleyh", (2.78, 1.4, 0.75), (0.04, 0.5, 0.04), brass)
    for dx in (-0.35, 0.35):
        for dy in (-0.22, 0.22):
            lib.add_mesh("cyl", f"tw{dx}{dy}", (2.3 + dx, 1.4 + dy, 0.12), (0.1, 0.1, 0.02), rot=(90, 0, 0), material=lib.mat("whM", "#2a2a2a"), vertices=16)
    sets.asset("sf_cashsack", (2.15, 1.35, 0.45), 30, height=0.5, ink=True)
    sets.asset("sf_cashsack", (2.5, 1.45, 0.45), -40, height=0.45, ink=True)
    # ledgers stacked on the desk + on the floor by the door
    for i in range(5):
        box(f"ldg{i}", (-2.45, -0.75, 0.84 + i * 0.05), (0.32, 0.24, 0.045), lib.mat(f"ldgM{i%3}", ("#2a3a6a", "#6a1e22", "#2a5a3a")[i % 3]), rot=(0, 0, random.uniform(-10, 10)))
    # more dressing (every surface carries something)
    paper = lib.mat("paperM", "#f2ead6")
    for i in range(4):
        box(f"papers{i}", (-1.55 + i * 0.05, -1.05, 0.83 + i * 0.012), (0.3, 0.22, 0.01), paper, rot=(0, 0, random.uniform(-14, 14)), ink=False)
    lib.add_mesh("cyl", "stamp", (-1.75, -0.65, 0.88), (0.035, 0.035, 0.07), material=lib.mat("stampM", "#3a2014"))
    box("stamppad", (-1.85, -0.62, 0.82), (0.14, 0.09, 0.02), lib.mat("padM", "#1a2a6a"))
    bench = sets.pbr_mat("benchM", "wood_floor", tint="#6a3a20")
    box("bench", (4.3, 0.6, 0.45), (0.5, 1.8, 0.08), bench); box("benchback", (4.55, 0.6, 0.8), (0.06, 1.8, 0.6), bench)
    for dy in (-0.8, 0.8): box(f"benchleg{dy}", (4.3, 0.6 + dy, 0.22), (0.45, 0.06, 0.44), bench)
    for i, (x, y) in enumerate(((-4.4, 3.8), (-4.4, 3.2), (4.4, 3.8))):
        for j in range(3):
            box(f"strongbox{i}_{j}", (x, y, 0.18 + j * 0.34), (0.5, 0.42, 0.32), lib.mat("sboxM", "#3a4a44", rough=0.4))
            box(f"sboxlock{i}_{j}", (x + 0.26, y, 0.2 + j * 0.34), (0.02, 0.1, 0.1), brass, ink=False)
    lib.add_mesh("cyl", "spittoon", (1.2, 0.2, 0.12), (0.14, 0.14, 0.12), material=brass)
    # ceiling coffers
    for i in range(-4, 5):
        box(f"beamx{i}", (i * 1.2, 1.0, 4.68), (0.12, 8, 0.12), wood, ink=True)
    for j in range(-3, 5):
        box(f"beamy{j}", (0, j * 1.2, 4.66), (11, 0.12, 0.1), wood, ink=True)
    # door frame: thick steel ring around the vault door + bolts
    steel = lib.mat("steelR", "#8a9098", rough=0.3)


def build(state="lamp"):
    random.seed(7)
    # marble checker floor
    tA = lib.mat("tileA", "#efe6d2", rough=0.15); tB = lib.mat("tileB", "#1f3a34", rough=0.15)
    for i in range(-10, 10):
        for j in range(-8, 10):
            box(f"tile{i}_{j}", (i * 0.5 + 0.25, j * 0.5 + 0.25, -0.02), (0.49, 0.49, 0.04), tA if (i + j) % 2 == 0 else tB, ink=False)
    box("grout", (0, 0.5, -0.03), (10, 9, 0.02), lib.mat("groutM", "#b8a888"), ink=False)
    wall = sets.pbr_mat("vwallM", "plastered_wall", tint="#3f8a78")
    for name, c, s in (("back", (0, 4.7, 2.4), (11, 0.2, 4.8)), ("left", (-5.0, 1.0, 2.4), (0.2, 8, 4.8)), ("right", (5.0, 1.0, 2.4), (0.2, 8, 4.8))):
        o = box(name, c, s, wall, ink=False); sets.tiled(o, 2.0)
    box("ceil", (0, 1.0, 4.8), (11, 8, 0.15), lib.mat("vceilM", "#2a3a34"), ink=False)
    # wainscot + brass rail
    box("wains", (0, 4.58, 0.6), (10, 0.05, 1.2), sets.pbr_mat("vwainM", "wood_floor", tint="#6a3a22"), ink=True)
    box("rail", (0, 4.55, 1.22), (10, 0.06, 0.05), lib.mat("railM", "#d8a850", rough=0.25), ink=False)
    # the vault door: big, centred on the back wall, with a steel ring frame
    vault_door(0, 4.42, 1.75)
    # deposit-box walls left and right of the door
    deposit_wall("depL", -3.1, 4.5, 0, 6, 9)
    deposit_wall("depR", 3.1, 4.5, 0, 6, 9)
    deposit_wall("depS", -4.85, 2.2, 90, 7, 9)
    # marble columns framing the door
    for x in (-1.95, 1.95):
        sets.asset("sf_column", (x, 4.1, 0), 0, height=4.8, ink=True)
    # treasure: gold bar stacks, coin piles, cash sacks
    for k, (x, y, yaw, h) in enumerate(((-1.2, 3.3, 15, 0.45), (1.3, 3.4, -20, 0.55), (-2.4, 2.6, 40, 0.35), (2.2, 2.4, -35, 0.4))):
        bar_stack(f"gs{k}", x, y, yaw, int(3 + h * 6))
    coin_heaps(((0.6, 3.0, 0.45, 0.32), (-0.5, 2.7, 0.35, 0.22), (2.7, 3.1, 0.4, 0.28), (-1.6, 2.2, 0.25, 0.14)))
    for k, (x, y, yaw) in enumerate(((-2.9, 3.4, 10), (-3.3, 3.0, 70), (3.4, 2.7, -30), (1.9, 3.6, 5))):
        sets.asset("sf_cashsack", (x, y, 0), yaw, height=0.6, ink=True)
    # foreground: banker's desk with green lamp, ledger, inkwell (front-left, blurred layer)
    desk = sets.pbr_mat("deskM", "wood_floor", tint="#7a3e22")
    box("desk_top", (-1.9, -0.9, 0.78), (1.6, 0.8, 0.06), desk); box("desk_body", (-1.9, -0.9, 0.38), (1.5, 0.7, 0.76), desk)
    sets.asset("sf_desklamp", (-1.4, -0.85, 0.81), 160, height=0.48, ink=True)
    box("ledger", (-2.1, -0.95, 0.83), (0.42, 0.3, 0.05), lib.mat("ledgerM", "#7a1e22"), rot=(0, 0, 12))
    box("ledger_pg", (-2.1, -0.95, 0.857), (0.38, 0.27, 0.005), lib.mat("pageM", "#f2e8d0"), rot=(0, 0, 12), ink=False)
    lib.add_mesh("cyl", "inkwell", (-2.5, -0.8, 0.85), (0.04, 0.04, 0.05), material=lib.mat("inkM", "#1a2a40", rough=0.1))
    # hanging pendant lamps (emissive globes on brass rods)
    for x in (-2.8, 2.8):
        box(f"rod{x}", (x, 2.2, 4.2), (0.02, 0.02, 1.2), lib.mat("rodM", "#c89a48", rough=0.3), ink=False)
        lib.add_mesh("sphere", f"globe{x}", (x, 2.2, 3.5), (0.22, 0.22, 0.18), material=emissive("globeM", "#ffd08a", 5.0), ink=False)
    # velvet rope barrier (mid layer)
    velvet = lib.mat("velM", "#9a1a2a", rough=0.6); brass = lib.mat("postM", "#d8a850", rough=0.25)
    for x in (-1.0, 1.0):
        lib.add_mesh("cyl", f"post{x}", (x, 1.6, 0.5), (0.04, 0.04, 0.5), material=brass)
        lib.add_mesh("sphere", f"postk{x}", (x, 1.6, 1.03), (0.06, 0.06, 0.06), material=brass, ink=False)
    box("rope", (0, 1.6, 0.85), (2.0, 0.05, 0.05), velvet)
    dressing()
    # dust motes are added in three.js; light shafts:
    sets.light_beam("beam", (0, 2.2, 3.5), (0, 3.6, 0), width=1.4, col="#ffd9a0", strength=0.6)
    return {"anchor_banker": (-0.7, 0.6, 0), "anchor_clerk": (0.7, 0.9, 0), "anchor_door": (0, 4.3, 1.7)}


def lights(state="lamp"):
    lib.world("#1e2a2a", 0.4, haze=0.02, haze_col="#ffd9a0")
    light("SPOT", "key", (0.5, 2.2, 3.4), "#ffcf8a", 900, size=0.4, target=(0, 3.8, 1.2))
    light("POINT", "desklamp", (-1.4, -0.85, 1.15), "#ffd08a", 60, size=0.08)
    light("AREA", "fill", (2.5, -5, 3), "#7aa0d0", 350, size=4.0, target=(0, 1.5, 1.2))
    light("AREA", "rim", (-2.5, 4.0, 3.5), "#ffe2b0", 300, size=2.0, target=(0, 0.8, 1.6))
