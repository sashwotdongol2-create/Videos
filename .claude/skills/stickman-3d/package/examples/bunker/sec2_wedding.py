"""SECTION 2 (global frames 250-662): one continuous camera move inside the bunker.
black stair-shaft top -> down the concrete stairs past a swinging lamp -> small conference room, Hitler + Eva hand in hand
-> camera trucks behind a concrete pillar on "married" and they come out in wedding clothes (swap hidden by the wipe)
-> through the doorway into the dining room: wedding breakfast (couple + three staff seated at two clothed tables)
-> "grim": faces go sad, the staff stand up (Sit_To_Stand) and walk out (Walking_IP) -> couple alone
-> camera pushes into the dark back doorway to black (from ~656) for the join into section 3.
"""
from shotlib import *
import sets_sec2 as S2
from mathutils import Vector

U = 1.75 / lib.STAND_PX                      # metres per card pixel at height 1.75
OFF_FRONT = 0.31                             # Seated_Idle_front: hip bottom (y~913 px) dropped onto a SEAT-high seat
OFF_STS = (1230 - 1044) * U                  # Sit_To_Stand cards are drawn with the feet at y=1044
OFF_WALK = (1230 - 1207) * U                 # Walking_IP feet at y~1207
STS_HIP = 0.19                               # Sit_To_Stand cf0: hips sit ~0.19 m behind the feet (facing direction)
STS_LAST = {"staff1": 27, "staff2": 27, "staff3": 29}   # later cf are clipped at the card's top edge (head cut) -> switch to the walk
WALK_V = 1.2 / 32                            # m per frame: no foot slide (1.2 m per 32-frame cycle)

EVA_C, HIT_C = (-0.80, 0.59), (-0.40, 0.72)      # side by side, Eva a step behind: the arms hang at the sides, so the hands meet only when the bodies touch


def pp(x, n):
    """ping-pong clip frame: seamless idle loop."""
    m = x % (2 * (n - 1)); return m if m < n else 2 * (n - 1) - m


def hermite(keys, g):
    """C1 spline through (frame, value-tuple) keys (non-uniform Catmull-Rom); clamps outside."""
    ts = [k[0] for k in keys]
    if g <= ts[0]: return keys[0][1]
    if g >= ts[-1]: return keys[-1][1]
    i = max(j for j in range(len(ts) - 1) if ts[j] <= g)
    t0, t1 = ts[i], ts[i + 1]; p0, p1 = Vector(keys[i][1]), Vector(keys[i + 1][1]); h = t1 - t0
    def tan(j):
        if j == 0: return (Vector(keys[1][1]) - Vector(keys[0][1])) / (ts[1] - ts[0])
        if j == len(ts) - 1: return (Vector(keys[j][1]) - Vector(keys[j - 1][1])) / (ts[j] - ts[j - 1])
        return (Vector(keys[j + 1][1]) - Vector(keys[j - 1][1])) / (ts[j + 1] - ts[j - 1])
    m0, m1 = tan(i) * h, tan(i + 1) * h
    s = (g - t0) / h; s2, s3 = s * s, s * s * s
    v = (2 * s3 - 3 * s2 + 1) * p0 + (s3 - 2 * s2 + s) * m0 + (-2 * s3 + 3 * s2) * p1 + (s3 - s2) * m1
    return tuple(v)


# camera: (global frame, position, look-at). Start/end inside darkness at ~1 m/s forward.
CAM = [
    (244, (0.0, -10.9, 4.30), (0.0, -6.7, 5.2), 40),       # black: top landing, looking at the unlit sloped ceiling
    (256, (0.0, -10.5, 4.28), (0.0, -6.4, 4.95), 40),
    (276, (0.0, -9.0, 3.95), (0.0, -5.5, 1.9), 42),       # tilt down: stairs + swinging lamp appear
    (298, (0.0, -7.0, 2.75), (-0.25, -1.0, 1.0), 44),     # descending into the room
    (318, (0.05, -4.8, 1.85), (-0.5, 0.6, 1.15), 45),
    (338, (0.55, -3.3, 1.6), (-0.58, 0.6, 1.05), 45),     # in the room, trucking right -> pillar wipe (~W34)
    (366, (0.85, -2.85, 1.5), (-0.58, 0.6, 1.0), 46),
    (398, (1.0, -2.2, 1.5), (-0.5, 0.75, 1.05), 48),      # wedding couple
    (424, (1.5, 0.9, 1.58), (1.0, 4.5, 1.2), 48),        # turn toward the doorway
    (442, (1.4, 2.45, 1.65), (-0.6, 5.2, 0.9), 52),       # through the doorway
    (472, (0.0, 2.65, 1.75), (-1.0, 5.0, 0.85), 55),      # wedding breakfast: the couple's table
    (505, (0.1, 2.75, 1.75), (-0.5, 5.4, 0.9), 55),
    (545, (1.1, 3.0, 1.75), (1.15, 6.3, 0.95), 52),       # staff at their table, standing up
    (585, (0.9, 3.0, 1.72), (0.9, 6.3, 1.0), 55),         # ... walking out (side door right, back door left)
    (603, (-0.45, 3.0, 1.6), (-1.05, 5.3, 0.95), 50),     # the couple alone
    (630, (-0.02, 4.3, 1.3), (-0.08, 7.0, 1.0), 44),        # push past them, sinking to door height
    (656, (-0.15, 5.9, 1.05), (-0.15, 9.0, 1.05), 36),   # black: the doorway fills the frame
    (668, (-0.15, 6.3, 1.05), (-0.15, 9.4, 1.05), 36),
]
VFOV = 40
WIPE = W(34) + 3                                         # "married": camera behind the pillar -> swap the outfits


def cam_at(g):
    return hermite([(k[0], k[1]) for k in CAM], g), hermite([(k[0], k[2]) for k in CAM], g)


def fov_at(g):
    return hermite([(k[0], (k[3], 0.0)) for k in CAM], g)[0]


def walk_path(pts, d):
    """position at arc length d along polyline pts and the segment direction."""
    for a, b in zip(pts, pts[1:]):
        a, b = Vector(a), Vector(b); L = (b - a).length
        if d <= L: return a + (b - a) * (d / max(L, 1e-6)), (b - a)
        d -= L
    a, b = Vector(pts[-2]), Vector(pts[-1]); return b, (b - a)


def wedding(sid):
    s = Shot(sid)
    lib.reset(s.n, preview=bool(arg("--preview")))
    s.cam = lib.camera()
    lib.world("#000000", 0.0)
    o = S2.build_all(); mm = o["mm"]
    lib.compositor(bloom=0.55, vign=0.5, vign_col="#2a2016", sat=1.05)
    sc = bpy.context.scene

    # ---------------------------------------------------------------- swinging shaft lamp
    lamp = o["lamp"]
    for g in s.frames():
        lamp.rotation_euler = (math.radians(7 * math.sin(2 * math.pi * g / 78)), math.radians(2.5 * math.sin(2 * math.pi * g / 111 + 1)), 0)
        lamp.keyframe_insert("rotation_euler", frame=s.L(g))

    # ---------------------------------------------------------------- pillar: on the line camera -> couple at the wipe frame
    cp, _ = cam_at(WIPE); mid = Vector(((EVA_C[0] + HIT_C[0]) / 2, (EVA_C[1] + HIT_C[1]) / 2, 0))
    dvec = (mid - Vector((cp[0], cp[1], 0))).normalized()
    pc = Vector((cp[0], cp[1], 0)) + dvec * 0.62
    pil = S2.tb("s2_pillar", (pc.x, pc.y, 1.5), (0.46, 0.46, 3.0), mm["conc"], 0.8, ink=True)
    pil.rotation_euler.z = math.atan2(dvec.y, dvec.x)
    lib.box("s2_pillarCap", (pc.x, pc.y, 2.93), (0.6, 0.6, 0.14), mm["conc"])
    lib.box("s2_pillarFoot", (pc.x, pc.y, 0.05), (0.56, 0.56, 0.1), mm["dark"])
    print("PILLAR", tuple(round(v, 2) for v in pc), "WIPE", WIPE)

    # ---------------------------------------------------------------- conference couple (standing, hand in hand)
    tint = "#fff3e2"
    eva = s.card("evaC", 1.75, tint); hit = s.card("hitC", 1.75, tint)
    s.key_card(eva, lambda g: ("eva", "neutral", "stand", dict(blink=blink(g, 2))) if g < WIPE else ("evaWed", "happy", "stand", dict(blink=blink(g, 2))))
    s.key_card(hit, lambda g: ("hitler", "neutral", "stand", dict(blink=blink(g, 1))) if g < WIPE else ("hitlerWed", "happy", "stand", dict(blink=blink(g, 1))))
    for g in (s.g0,):
        eva.at(s.L(g), (EVA_C[0], EVA_C[1], 0)); hit.at(s.L(g), (HIT_C[0], HIT_C[1], 0))

    # ---------------------------------------------------------------- dining: tables, chairs, seated cards
    C1, R1, C2, R2 = S2.L["C1"], S2.L["R1"], S2.L["C2"], S2.L["R2"]
    S2.round_table("s2_table1", C1, R1, mm); S2.round_table("s2_table2", C2, R2, mm)

    def seat(c, ring, ang, view):
        """the card is a billboard: its chair sits straight behind it as seen from the shot's main camera position."""
        a = math.radians(ang); p = Vector((c[0] + ring * math.cos(a), c[1] + ring * math.sin(a), 0))
        out = (p - Vector((view[0], view[1], 0))).normalized()
        ch = p + out * 0.31
        S2.chair(f"s2_ch{ang}_{c[0]:.1f}", tuple(ch), math.degrees(math.atan2(-out.x, out.y)), mm)
        return p
    V1, V2 = (-0.3, 3.0), (1.15, 3.1)
    P = {"evaWed": seat(C1, 0.9, 118, V1), "hitlerWed": seat(C1, 0.9, 62, V1),
         "staff1": seat(C2, 0.85, 40, V2), "staff2": seat(C2, 0.85, 90, V2), "staff3": seat(C2, 0.85, 130, V2)}
    # breakfast props
    for k, a in enumerate((118, 62, 200, 330)):
        r = R1 - 0.2; S2.plate(f"s2_pl1{k}", (C1[0] + r * math.cos(math.radians(a)), C1[1] + r * math.sin(math.radians(a)), S2.TABLE_H), mm=mm)
    for k, a in enumerate((40, 90, 130)):
        r = R2 - 0.2; S2.plate(f"s2_pl2{k}", (C2[0] + r * math.cos(math.radians(a)), C2[1] + r * math.sin(math.radians(a)), S2.TABLE_H), mm=mm)
    try: sets.asset("tea_set_01", (C1[0] - 0.05, C1[1] - 0.05, S2.TABLE_H), height=0.14)
    except Exception as e: print("tea set", e)
    for nm, loc, w in (("croissant", (C1[0] - 0.33, C1[1] + 0.26), 0.11), ("croissant", (C1[0] + 0.3, C1[1] + 0.27), 0.11),
                       ("cup-saucer", (C2[0] + 0.28, C2[1] + 0.2), 0.1), ("cup-saucer", (C2[0] - 0.3, C2[1] + 0.22), 0.1),
                       ("bread", (C2[0], C2[1] - 0.05), 0.2), ("cake", (C1[0] + 0.05, C1[1] - 0.3), 0.2)):
        S2.kenney(nm, (loc[0], loc[1], S2.TABLE_H + 0.017 if "cup" not in nm else S2.TABLE_H), w)

    # couple at table 1
    def couple_state(who):
        def fn(g):
            e = "sad" if g >= W(48) else "neutral"
            return (who, e, "rig", dict(clip="Seated_Idle_front", cf=pp(g - s.g0 + (0 if who == "hitlerWed" else 40), 150)))
        return fn
    seated = {}
    for who in ("evaWed", "hitlerWed"):
        c = s.card(who + "D", 1.75, tint); s.key_card(c, couple_state(who)); seated[who] = c
        p = P[who]; c.at(1, (p.x, p.y, 0)); c.plane.location.z = -OFF_FRONT

    # staff: seated idle -> Sit_To_Stand -> walk out
    STAFF = {
        "staff2": dict(stand=W(49), face=1, path=[(1.58, 6.62), (1.95, 6.3), (2.3, 5.95), (2.5, 5.3), (3.6, 5.3)], hide=lambda v: v.x > 2.95, dark=lambda v: (v.x - 2.45) / 0.5),
        "staff1": dict(stand=W(55), face=1, path=[(2.35, 6.0), (2.5, 5.3), (3.6, 5.3)], hide=lambda v: v.x > 2.95, dark=lambda v: (v.x - 2.45) / 0.5),
        "staff3": dict(stand=W(51), face=-1, path=[(0.0, 6.45), (-0.10, 6.95), (-0.10, 9.0)], hide=lambda v: v.y > 8.35, dark=lambda v: (v.y - 7.7) / 0.6),
    }
    for who, st in STAFF.items():
        p = P[who]; T0 = st["stand"]; T1 = T0 + STS_LAST[who]; f = st["face"]
        root_sts = Vector((p.x + STS_HIP * f, p.y, 0))
        pts = [tuple(root_sts)[:2]] + st["path"]
        st["pts"] = pts
        c = s.card(who, 1.75, tint); st["card"] = c
        ph = {"staff1": 0, "staff2": 55, "staff3": 100}[who]
        def state(g, who=who, T0=T0, T1=T1, ph=ph):
            if g < T0: return (who, "sad", "rig", dict(clip="Seated_Idle_front", cf=pp(g - s.g0 + ph, 150)))
            if g < T1: return (who, "sad", "rig", dict(clip="Sit_To_Stand", cf=g - T0))
            return (who, "sad", "rig", dict(clip="Walking_IP", cf=(g - T1) % 32))
        s.key_card(c, state)
        face = f; hidden = False; c.hide(1, False)
        tn = next(n for n in c.mat.node_tree.nodes if n.type == "MIX" and n.blend_type == "MULTIPLY")
        base = lib.rgb(tint)
        for g in s.frames():
            F = s.L(g)
            if g < T0:
                loc, off, sx = Vector((p.x, p.y, 0)), OFF_FRONT, 1
            elif g < T1:
                loc, off, sx = root_sts, OFF_STS, face
            else:
                loc, dv = walk_path(pts, (g - T1) * WALK_V)
                if abs(dv.x) > 0.25 * dv.length: face = 1 if dv.x > 0 else -1
                off, sx = OFF_WALK, face
                if st["hide"](loc) and not hidden: c.hide(F, True); hidden = True
            k = 1.0 - (lib.ease(st["dark"](loc)) if g >= T1 else 0.0)        # walking into the unlit doorway: fade to dark
            tn.inputs[7].default_value = (base[0] * k, base[1] * k, base[2] * k, 1); tn.inputs[7].keyframe_insert("default_value", frame=F)
            c.at(F, (loc.x, loc.y, 0))
            c.plane.location.z = -off; c.plane.keyframe_insert("location", frame=F)
            c.plane.scale.x = sx; c.plane.keyframe_insert("scale", frame=F)

    # ---------------------------------------------------------------- camera
    def cam(g):
        pos, look = cam_at(g); return pos, look, fov_at(g)
    bake_camera(s.cam, s.n, lambda f: cam(f + s.g0 - 1))
    top = arg("--top")
    if top:                                   # contact-check debug view: orthographic top-down (ceilings/lamps hidden) or side view
        for ob in bpy.data.objects:
            if any(k in ob.name for k in ("Ceil", "ceil", "Lamp", "lamp", "Slope")): ob.hide_render = True
        d = bpy.data.cameras.new("top"); d.type = "ORTHO"
        ob = bpy.data.objects.new("top", d); sc.collection.objects.link(ob); sc.camera = ob
        if top == "dining": d.ortho_scale = 6.2; lib.look_at(ob, (0.0, 5.1, 9), (0.0, 5.1, 0))
        elif top == "dside": d.ortho_scale = 5.5; lib.look_at(ob, (0.0, 1.0, 0.8), (0.0, 9, 0.8))
        else: d.ortho_scale = 4.0; lib.look_at(ob, (-0.3, 0.0, 9), (-0.3, 0.0, 0))
        d.clip_end = 50
        red = lib.emissive("dbgRed", "#ff2020", 3.0)
        for c in s.cards:                     # card footprint (body + arms, ~0.62 m) as a red bar that turns with the billboard
            bar = lib.box("dbg_" + c.name, (0, 0, 0), (0.62, 0.03, 0.02), red, ink=False)
            bar.parent = c.root; bar.location = (0, 0, 1.0); bar.hide_render = False
    s.stage = dict(P=P, STAFF=STAFF)
    return s


BUILD = {2: wedding}
