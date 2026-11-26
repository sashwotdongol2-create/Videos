"""Graveyard shots (1, 2, 3 dusk; 6 night; 24, 25 sunrise)."""
from shotlib import *
from mathutils import Vector
import sets_graveyard as SG

G = SG.G

import inspect
if "clip" not in inspect.signature(lib.card_index).parameters:      # local fallback until lib.card_index takes clip/cf
    _ci = lib.card_index
    def _card_index(who, expr, pose, blink=0, mouth=0.0, prop=None, facing=1, clip=None, cf=0):
        if clip is None: return _ci(who, expr, pose, blink, mouth, prop, facing)
        c = [e for e in lib.MANIFEST if e["who"] == who and e["expr"] == expr and e["pose"] == pose and e.get("clip") == clip and (e["prop"] or None) == (prop or None)]
        return min(c, key=lambda e: abs(e["cf"] - cf))["id"]
    lib.card_index = _card_index
TINT = {"dusk": "#fff2e6", "night": "#c4c8f6", "sunrise": "#fff0ec"}


def lie_card(s, name, root_xy, z, tint):
    """husband lying face-up in the coffin: a flat card (no billboard), head toward +Y."""
    c = Card(s.dir, name, 1.75, tint, None, 0.15); s.cards.append(c); c.exempt = True
    c.plane.rotation_euler.x = 0.0
    c.root.rotation_euler.z = math.radians(-90)
    for g in s.frames(): c.at(s.L(g), (root_xy[0], root_xy[1], z))
    return c


def bell_angle(t, rings, amp=24.0, period=0.62, damp=2.2):
    """damped pendulum (degrees): each ring is an impulse that kicks the bell; t, rings in seconds."""
    a = 0.0
    for i, r in enumerate(rings):
        if t >= r:
            u = t - r; a += (amp if i % 2 == 0 else -amp) * math.exp(-damp * u) * math.sin(2 * math.pi * u / period)
    return a


def puff(name, loc, f0, n_frames, size=0.35, count=6, seed=1, col="#f6f6ff", alpha=0.55):
    """snow puff: soft spheres that expand, drift and fade (hidden after)."""
    r = random.Random(seed); m = lib.mat("puffM" + name, col, alpha=0.35, emit=1.0)
    try: m.surface_render_method = "BLENDED"
    except Exception: pass
    for i in range(count):
        o = lib.add_mesh("sphere", f"{name}{i}", loc, (1, 1, 1), material=m, ink=False, segments=14, ring_count=8)
        d = Vector((r.uniform(-1, 1), r.uniform(-0.4, 0.4), r.uniform(-0.2, 0.8))) * size
        for f, k in ((1, 0.0), (f0 - 1, 0.0), (f0, 0.15), (f0 + n_frames * 0.5, 0.8), (f0 + n_frames, 1.0)):
            o.location = Vector(loc) + d * (0.3 + k); sc = size * (0.01 if k == 0 else 0.35 + 0.6 * k) * r.uniform(0.7, 1.2)
            o.scale = (sc, sc * 0.8, sc * 0.8); o.keyframe_insert("location", frame=max(1, int(f))); o.keyframe_insert("scale", frame=max(1, int(f)))
        o.hide_render = True; o.keyframe_insert("hide_render", frame=1)
        o.hide_render = False; o.keyframe_insert("hide_render", frame=max(1, f0))
        o.hide_render = True; o.keyframe_insert("hide_render", frame=f0 + n_frames)


def graveyard_shot(sid):
    s = Shot(sid)
    state = "dusk" if sid in (1, 2, 3) else ("night" if sid == 6 else "sunrise")
    lib.reset(s.n, preview=bool(arg("--preview")))
    s.cam = lib.camera()
    o = SG.build_graveyard(state); SG.graveyard_lights(state)
    if state == "night":
        lib.compositor(bloom=0.75, vign=0.6, vign_col="#1a1f6a", sat=1.08)
    elif state == "dusk":
        lib.compositor(bloom=0.45, vign=0.5, vign_col="#5a3a6a", sat=1.0)
    else:
        lib.compositor(bloom=0.45, vign=0.4, vign_col="#8a5a8a", sat=1.05)
    tint = TINT[state]
    PX, PY = G["PX"], G["PY"]; PIV = Vector(G["PIVOT"]); PD = G["PIT"][2]
    fstop = {1: 2.8, 2: 1.8, 3: 2.4, 6: 2.4, 24: 1.6, 25: 2.4}[sid]
    focus = [None]

    if sid == 1:
        hus = s.card("husband", 1.75, tint); hus.exempt = True             # standing in the open grave: legs hidden
        HA = (0.02, -0.15, -0.72)
        s.key_card(hus, lambda g: ("husband", "grin", "stand", dict(blink=blink(g, 1))))
        for g in s.frames(): hus.at(s.L(g), (HA[0], HA[1], HA[2] + 0.015 * math.sin(g * 0.35)))
        dig = s.card("digger", 1.8, tint)
        DA = (0.8, -1.25, 0.0)
        s.key_card(dig, lambda g: ("digger", "neutral", "stand", dict(prop="shovel", blink=blink(g, 2))))
        for g in s.frames(): dig.at(s.L(g), DA)
        HH = hus.head(HA, "husband", "grin", "stand")
        focus[0] = Vector(HH)
        def cam(g):
            return push((0.2, -5.0, 1.45), (0.1, 0.6, 0.55), g, s.a - 6, 0.10) + (46,)

    elif sid in (2, 3):
        lie_card(s, "husbandLie", (-0.08, 0.12), -PD + 0.07, tint)
        s.key_card(s.cards[-1], lambda g: ("husband", "smug", "lie", dict(blink=blink(g, 4))))
        CU = ((0.08, 0.0, 1.5), (0.05, 0.3, -PD))
        if sid == 2:
            HI = ((0.0, -2.6, 4.2), (0.0, 0.25, -PD))
            UP = ((0.35, -0.6, 0.55), (0.0, 0.9, -0.6))
            focus[0] = Vector((0.0, 0.5, -PD))
            def cam(g):
                if g < W(6): return glide(HI, CU, g, s.a - 4, W(6)) + (44,)
                pl = push(CU[0], CU[1], g, W(6), 0.12)
                if g < W(9): return pl + (44,)
                return glide(pl, UP, g, W(9), s.b + 6) + (44,)
        else:
            A = ((PX + 0.9, PY - 2.0, 1.3), (PX + 0.1, PY - 0.2, 0.25))
            B = ((PX + 1.3, PY - 3.0, 3.6), (PX + 0.35, PY, 2.1))
            focus[0] = Vector((PX + 0.3, PY, 1.8))
            def cam(g):
                if g < W(13): return glide(A, B, g, s.a - 6, W(13)) + (40,)
                return push(B[0], B[1], g, W(13), 0.10) + (40,)

    elif sid == 6:
        rings = [(W(i) - s.g0) / lib.FPS for i in (53, 54, 55)]
        piv = o["pivot"]
        for g in s.frames():
            t = (g - s.g0) / lib.FPS
            piv.rotation_euler.y = math.radians(bell_angle(t, rings)); piv.keyframe_insert("rotation_euler", frame=s.L(g))
        # the third swing knocks the snow cap off the roof
        cap = o["snowcap"]; fall = s.L(W(55)) + 5; c0 = cap.location.copy()
        cap.keyframe_insert("location", frame=fall); cap.keyframe_insert("rotation_euler", frame=fall)
        cap.keyframe_insert("scale", frame=fall)
        for k in range(1, 9):
            u = k / 8.0
            cap.location = c0 + Vector((0.5 * u, 0.1 * u, -0.9 * u * u)); cap.rotation_euler = (0, math.radians(25 * u), 0)
            cap.scale = (1 - 0.7 * u,) * 3
            cap.keyframe_insert("location", frame=fall + k); cap.keyframe_insert("rotation_euler", frame=fall + k); cap.keyframe_insert("scale", frame=fall + k)
        cap.hide_render = False; cap.keyframe_insert("hide_render", frame=1)
        cap.hide_render = True; cap.keyframe_insert("hide_render", frame=fall + 9)
        puff("capPuff", (PX + 0.4, PY, G["ROOF_Z"] + 0.25), fall + 1, 30, size=0.25, count=9, seed=6)
        o["mound"].hide_render = True
        SG.snowfall("snow", (PX + 1.5, PY + 2.6, 0.0), (11, 6.5, 5), count=1500, speed=0.5, radius=0.014)
        focus[0] = PIV
        A = ((PX + 0.8, PY - 4.2, 2.1), (PX + 0.3, PY, 2.25))
        B = ((PX + 2.4, PY - 3.4, 2.6), (G["HOUSE"][0] - 0.2, G["HOUSE"][1], 2.4))
        def cam(g):
            pa = push(A[0], A[1], g, s.a - 6, 0.12)
            if g < W(56): return pa + (42,)
            return glide(pa, B, g, W(56), s.b + 6) + (42,)

    elif sid == 24:
        focus[0] = PIV
        A = ((PX + 1.6, PY - 3.4, 3.0), (PX + 0.5, PY, 2.0))
        def cam(g):
            return push(A[0], A[1], g, s.a - 6, 0.06) + (40,)

    else:  # 25 - the wife on the snowy mound
        wife = s.card("wife", 1.62, tint)
        bpy.context.view_layer.update(); WA = Vector((0.42, 0.25, 0.0)); WA.z = lib.ground_z(WA.x, WA.y, 3.0)
        HD = Vector(wife.head(tuple(WA), "wife", "bored", "stand", prop="shovel"))
        drop, dig0, dig1, smug = W(219), W(220), W(225), W(229) - 3
        def wstate(g):
            if g < drop: return ("wife", "bored", "stand", dict(prop="shovel", blink=blink(g, 7)))
            if g < dig0: return ("wife", "bored", "hold", dict(prop="shovel", blink=blink(g, 7)))
            if g < dig1: return ("wife", "effort", "rig", dict(prop="shovel", clip="Digging", cf=min(144, 10 + 2 * (g - dig0))))
            if g < smug: return ("wife", "bored", "stand", dict(prop="shovel", blink=blink(g, 7)))
            return ("wife", "smug", "stand", dict(prop="shovel", blink=blink(g, 8)))
        s.key_card(wife, wstate)
        for g in s.frames():
            f = s.L(g); bob = 0.0; tilt = 0.0
            wife.at(f, (WA.x, WA.y, WA.z + bob), tilt=tilt)
        # IOUs fall from her hand onto the mound, then the shovelled snow lump grows over them
        r = random.Random(4); land = []
        for i in range(6):
            pm = sets.image_mat(f"iouM{i}", sets.tex(f"iou{i}"), emit=0.3)
            pg = sets.plane(f"iou{i}", 0.28, 0.18, pm, (0, 0, 0), rot=(0, 0, 0))
            st = s.L(drop) + i * 2; end = st + 14
            hx, hy, hz = WA.x - 0.15, WA.y - 0.15, WA.z + 0.85
            lx, ly = -0.12 + r.uniform(-0.2, 0.2), -0.3 + r.uniform(-0.15, 0.15); lz = lib.ground_z(lx, ly, 3.0, ignore=[o for o in bpy.data.objects if o.name.startswith("iou")]) + 0.012 + i * 0.002
            land.append((lx, ly, lz))
            pg.hide_render = True; pg.keyframe_insert("hide_render", frame=1); pg.hide_render = False; pg.keyframe_insert("hide_render", frame=st)
            for k in range(0, 15):
                u = k / 14.0
                pg.location = (hx + (lx - hx) * u + 0.05 * math.sin(u * 9 + i), hy + (ly - hy) * u, hz + (lz - hz) * u)
                pg.rotation_euler = (math.radians(60 * math.sin(u * 7 + i) * (1 - u)), math.radians(40 * math.cos(u * 5 + i) * (1 - u)), math.radians(r.uniform(-1, 1) * 40 + i * 50))
                pg.keyframe_insert("location", frame=st + k); pg.keyframe_insert("rotation_euler", frame=st + k)
        lump = SG.ico("snowLump", (-0.12, -0.3, land[0][2]), (0.42, 0.36, 0.22), lib.mat("lumpM", "#ffffff", sets.tex("gy_snow")), sub=2)
        for f, k in ((1, 0.001), (s.L(dig0) + 6, 0.001), (s.L(dig0) + 14, 0.45), (s.L(dig0) + 30, 0.7), (s.L(dig0) + 46, 0.9), (s.L(dig1), 1.0)):
            lump.scale = (k,) * 3; lump.keyframe_insert("scale", frame=f)
        # bluebird on the post roof; chimney smoke from her house
        R = G["ROOF_Z"] + 0.08 + 0.3 + 0.08
        bird = SG.bluebird("bird", (PX + 0.15, PY, R), yaw=-60)
        for g in s.frames():
            hop = ((g // 40) % 2 == 1) and (g % 40) < 6
            bird.location.z = R + (0.06 * math.sin((g % 40) / 6 * math.pi) if hop else 0); bird.keyframe_insert("location", frame=s.L(g))
        ct = o["chimney_top"]
        sm = lib.mat("smokeM", "#f4eef6", alpha=0.45, emit=0.5)
        try: sm.surface_render_method = "BLENDED"
        except Exception: pass
        for i in range(7):
            p = lib.add_mesh("sphere", f"smoke{i}", ct, (1, 1, 1), material=sm, ink=False, segments=12, ring_count=8)
            for g in s.frames():
                u = ((g * 0.012) + i / 7.0) % 1.0
                p.location = (ct[0] + 0.5 * u + 0.12 * math.sin(u * 8 + i), ct[1], ct[2] + 3.0 * u); k = 0.15 + 0.6 * u
                p.scale = (k,) * 3; p.keyframe_insert("location", frame=s.L(g)); p.keyframe_insert("scale", frame=s.L(g))
        focus[0] = HD
        A = ((-0.9, -5.0, 1.0), (0.2, 0.6, 1.0))
        B = ((-0.5, -3.3, 1.05), (0.15, 0.2, 0.85))
        C = ((1.0, -4.6, 1.2), (-0.6, 1.5, 1.4))
        CF = ((HD.x + 1.2, HD.y - 3.8, HD.z - 0.1), (HD.x - 0.15, HD.y, HD.z - 0.3))
        def cam(g):
            if g < W(218): return push(A[0], A[1], g, s.a - 6, 0.08) + (40,)
            if g < W(225): return glide(push(A[0], A[1], g, s.a - 6, 0.08), B, g, W(218), W(219) + 2) + (40,)
            if g < W(229): return glide(B, C, g, W(225), W(227)) + (40,)
            look = glide(C, (C[0], (HD.x - 0.35, HD.y, HD.z - 0.35)), g, W(229), W(229) + 24)[1]
            return push(C[0], look, g, W(229), 0.10) + (40,)

    def dof(g):
        pos = cam(g)[0]
        return (max(0.3, (Vector(pos) - focus[0]).length), fstop)
    bake_camera(s.cam, s.n, lambda f: cam(f + s.g0 - 1), dof=lambda f: dof(f + s.g0 - 1))
    return s


BUILD = {i: graveyard_shot for i in (1, 2, 3, 6, 24, 25)}
