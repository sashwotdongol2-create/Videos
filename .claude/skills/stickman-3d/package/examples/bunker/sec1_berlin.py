"""SECTION 1 (global frames 0-250): ruined Berlin street -> over the rubble wall -> Chancellery garden -> Hitler walks
into the bunker entrance -> the camera follows him into the black shaft (join into section 2).  One continuous take.
Storyboard: ref 0.0-8.0 s.  Set: sets_sec1.py, textures: tex_sec1.py."""
from shotlib import *
import sets_sec1 as S


def catmull(keys, g):
    """C1-smooth interpolation through (frame, value-tuple) keys (time-scaled Catmull-Rom; ends extrapolate linearly)."""
    ks = list(keys)
    def at(i):
        if 0 <= i < len(ks): return ks[i]
        a, b = (ks[0], ks[1]) if i < 0 else (ks[-1], ks[-2])
        return (2 * a[0] - b[0], tuple(2 * x - y for x, y in zip(a[1], b[1])))
    if g <= ks[0][0]: i = 0
    elif g >= ks[-1][0]: i = len(ks) - 2
    else: i = max(j for j in range(len(ks) - 1) if ks[j][0] <= g)
    (t0, p0), (t1, p1), (t2, p2), (t3, p3) = at(i - 1), at(i), at(i + 1), at(i + 2)
    h = t2 - t1; u = (g - t1) / h
    out = []
    for a, b, c, d in zip(p0, p1, p2, p3):
        m1 = (c - a) / (t2 - t0) * h; m2 = (d - b) / (t3 - t1) * h
        h00, h10, h01, h11 = 2 * u ** 3 - 3 * u ** 2 + 1, u ** 3 - 2 * u ** 2 + u, -2 * u ** 3 + 3 * u ** 2, u ** 3 - u ** 2
        out.append(h00 * b + h10 * m1 + h01 * c + h11 * m2)
    return tuple(out)


# camera keys: frame, (pos xyz, look xyz, vfov)
CAM = [
    (-6, (1.3, -3.9, 1.8, -0.9, 4.2, 2.3, 50)),
    (40, (1.1, -2.4, 2.0, -0.8, 5.0, 2.5, 48)),
    (85, (0.8, 0.6, 3.4, 0.4, 9.0, 2.8, 44)),
    (120, (0.6, 4.6, 4.6, 1.8, 13.0, 1.6, 40)),
    (150, (1.3, 8.9, 2.1, 2.2, 13.3, 1.25, 38)),
    (172, (1.9, 10.3, 1.7, 2.7, 13.5, 1.25, 38)),
    (198, (2.8, 10.7, 1.58, 3.0, 15.0, 1.35, 40)),
    (222, (3.0, 11.5, 1.5, 3.0, 17.0, 1.3, 40)),
    (256, (3.0, 12.75, 1.45, 3.0, 20.0, 1.15, 40)),
]

WALK0 = 152                     # "So how did he spend..." -> he turns and walks to the door
HH = 1.7                        # Hitler card height
VW = 1.2 * HH / 1.75 / 32       # walk speed (m / frame) so the feet don't slide


def section1(sid):
    s = Shot(sid)
    lib.reset(s.n, preview=bool(arg("--preview")))
    s.cam = lib.camera()
    S.sky_dome()
    o = S.build(s.cam, s.n); S.lights()
    lib.compositor(bloom=0.35, vign=0.45, vign_col="#2c2c34", sat=1.0)
    D = S.S1

    # ---------------- Soviet soldiers: two in the foreground firing over the sandbags, others small at the back
    sold = []
    for name, who, pos, off, h in (("sov1", "soviet1", (-1.75, 2.3, 0), 0, 1.7), ("sov2", "soviet2", (-1.35, 4.1, 0), 4, 1.66),
                                   ("sov3", "soviet1", (-2.7, 4.6, 0), 2, 1.68), ("sov4", "soviet2", (2.2, 4.25, 0), 6, 1.7)):
        c = s.card(name, h, tint="#f4f2ee", lit=0.25)
        s.key_card(c, lambda g, who=who, off=off: (who, "angry", "rig", dict(prop="rifle", clip="Firing_Rifle", cf=(g + off) % 9)))
        for g in s.frames(): c.at(s.L(g), pos)
        sold.append((c, off, h))
    ext = s.card("sov5", 1.68, tint="#f0eeea", lit=0.25)
    s.key_card(ext, lambda g: ("soviet1", "stern", "hold", dict(prop="rifle", blink=blink(g, 11))))
    ext.at(1, (-3.1, 3.9, 0))
    # muzzle flashes at the rifle tip (card px 1085, 652) on the recoil frames
    fl_m = lib.emissive("s1_flash", "#ffd27a", 30.0)
    for c, off, h in sold:
        u = h / lib.STAND_PX
        fl = lib.add_mesh("sphere", c.name + "_flash", (0, 0, 0), (0.07, 0.07, 0.07), material=fl_m, ink=False, segments=10, ring_count=6)
        fl.parent = c.plane; fl.location = ((1095 - 600) * u, (1230 - 652) * u, 0.0); fl.scale = (1, 1, 1)
        fl.visible_shadow = False; fl["no_ground"] = True
        for g in s.frames():
            on = ((g + off) % 9) in (0, 1)
            fl.hide_render = not on; fl.keyframe_insert("hide_render", frame=s.L(g))
    # smoke over the ruins
    for i, (x, y, z, sz) in enumerate(((-7, 2, 8, 7), (6.5, -3, 9, 8), (-2, 26, 9, 9), (12, 18, 8, 7), (-12, 10, 10, 9), (5, 30, 12, 11), (-6, 32, 11, 10))):
        S.smoke_plume(f"smoke{i}", (x, y, z), sz, s.cam, s.n, rise=0.25, seed=i)

    # ---------------- Hitler: grim sad idle in the garden, then walks to the steel door and into the dark shaft
    hx0, hy = D["HITLER"]
    hit = s.card("hitler", HH, tint="#ffffff", lit=0.2)
    def hit_state(g):
        if g < WALK0: return ("hitler", "sad", "rig", dict(clip="Sad_Idle_front", cf=(g - s.g0) % 85))
        return ("hitler", "sad", "rig", dict(clip="Walking_IP", cf=(g - WALK0) % 32))
    s.key_card(hit, hit_state)
    DX, DY = D["BUNKER"]
    def hit_p(g):
        d = max(0, g - WALK0) * VW; a = DX - hx0
        return (hx0 + d, hy) if d <= a else (DX, hy + (d - a))
    for g in s.frames(): hit.at(s.L(g), hit_p(g) + (0.0,))
    # into the dark: his card darkens as he walks into the unlit shaft, then is hidden (fully black by then)
    tint = next(n for n in hit.mat.node_tree.nodes if n.type == "MIX" and getattr(n, "blend_type", "") == "MULTIPLY")
    for g in s.frames():
        k = max(0.0, min(1.0, (hit_p(g)[1] - (DY + 0.2)) / 0.6))
        v = (1 - k) ** 1.5
        tint.inputs[7].default_value = (v, v, v, 1); tint.inputs[7].keyframe_insert("default_value", frame=s.L(g))
    hit.hide(1, False)
    g_hide = next(g for g in s.frames() if hit_p(g)[1] > DY + 0.95)
    hit.hide(s.L(g_hide), True)
    # the door: he pulls it by the handle as he reaches it, it swings outward 95 deg (hinge on the right jamb), clear of his path
    g_touch = next(g for g in s.frames() if hit_p(g)[0] >= DX - 0.55)
    hinge = o["hinge"]
    for g in s.frames():
        u = lib.ease((g - g_touch) / 18.0)
        hinge.rotation_euler.z = math.radians(95 * u); hinge.keyframe_insert("rotation_euler", frame=s.L(g))
    print("SEC1 door touch", g_touch, "hitler hidden", g_hide)

    # ---------------- camera: one continuous move
    def cam(g):
        v = catmull(CAM, g); return (v[0:3], v[3:6], v[6])
    bake_camera(s.cam, s.n, lambda f: cam(f + s.g0 - 1))
    return s


BUILD = {1: section1}
