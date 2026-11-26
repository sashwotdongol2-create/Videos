"""Garden shots (18, 20, 21): sunny flashback in the wife's front garden."""
from shotlib import *
import sets_garden as SG
from sets_garden import G


def _base(sid):
    s = Shot(sid)
    lib.reset(s.n, preview=bool(arg("--preview")))
    s.cam = lib.camera()
    o = SG.build_garden(); SG.garden_lights(); SG.garden_compositor()
    return s, o


def _cam_bake(s, cam, fstop):
    def dof(g):
        pos, look = cam(g)[:2]
        return (math.dist(pos, look), fstop(g) if callable(fstop) else fstop)
    bake_camera(s.cam, s.n, lambda f: cam(f + s.g0 - 1), dof=lambda f: dof(f + s.g0 - 1))


# ============================================================ 18: high wide, creditors queued down the path
def shot18(sid):
    s, o = _base(sid)
    r = random.Random(18)
    cards = []
    for i in range(10):
        y = 3.9 - i * 1.25
        x = SG.path_x(y) + (0.18 if i % 2 else -0.18) + r.uniform(-0.08, 0.08)
        h = r.uniform(1.6, 1.9)
        c = s.card(f"creditor{i}", h)
        c.base = (x, y, 0.0); c.i = i; cards.append(c)
    # queue shuffles forward a step on "lent" (word 155), tiny sway otherwise
    for c in cards:
        for g in s.frames():
            k = lib.ease((g - W(155)) / 10.0) * 0.32
            sway = 0.012 * math.sin(g * 0.21 + c.i * 1.7)
            c.at(s.L(g), (c.base[0] + sway, c.base[1] + k, 0.0))
        e0 = "angry" if c.i % 3 != 1 else "stern"
        def st(g, c=c, e0=e0):
            pose = "hold" if (g >= W(157) - c.i % 3 and c.i % 2 == 0) else "stand"   # waving tickets on "money"
            return (f"creditor{c.i}", e0, pose, dict(prop="ticket", blink=blink(g, 11 + c.i)))
        s.key_card(c, st)

    def cam(g):
        return push((8.8, -14.8, 4.0), (-0.6, -1.2, 1.5), g, s.a, 0.10) + (40,)
    _cam_bake(s, cam, 5.0)
    return s


# ============================================================ 20: CU husband buried to the nose among cabbages
def _bury_z(c, pose="stand", expr="smug"):
    H = c.head((0, 0, 0), "husband", expr, pose)
    return G["BED_TOP"] + 0.25 - H[2], H[2]


def shot20(sid):
    s, o = _base(sid)
    hx, hy = G["HOLE"]; T = G["BED_TOP"]
    hus = s.card("husband", 1.75); hus.exempt = True
    zb, hoff = _bury_z(hus)
    HC = (hx, hy, zb + hoff)
    for g in s.frames():
        hus.at(s.L(g), (hx, hy, zb + 0.008 * math.sin(g * 0.3)))
    s.key_card(hus, lambda g: ("husband", "grin" if g >= W(168) else "smug", "stand", dict(blink=blink(g, 21))))
    _mound(hx, hy, T, seed=20)
    sets.candy_cord("cord20", (hx + 0.12, hy - 0.22, T + 0.03), (hx + 0.85, hy - 1.9, T + 0.03), 0.032, stripes=14)
    sp = sets.asset("rusted_spade_01", (hx + 0.85, hy + 0.55, T - 0.25), height=1.3)
    sp.rotation_euler = (math.radians(-10), math.radians(14), math.radians(25))

    def cam(g):
        return push((HC[0] + 0.45, HC[1] - 2.75, HC[2] + 2.0), (HC[0], HC[1] + 0.05, HC[2] - 0.22), g, s.a, 0.13) + (36,)
    _cam_bake(s, cam, 1.4)
    return s


def _mound(hx, hy, T, seed=0, n=18):
    r = random.Random(seed); m = lib.mat("clodM", "#7a4a26", rough=0.95)
    for i in range(n):
        a = r.uniform(0, 2 * math.pi); d = r.uniform(0.3, 0.75)
        c = SG.clod_mesh(f"mound{i}", r.uniform(0.05, 0.09), seed=seed * 100 + i, m=m)
        c.location = (hx + d * math.cos(a), hy + d * math.sin(a) * 0.8, T + 0.02)
        c.rotation_euler.z = r.uniform(0, 6.28)


# ============================================================ 21: the rehearsal (dig, burst out, pan to WEST + shovel)
def shot21(sid):
    s, o = _base(sid)
    hx, hy = G["HOLE"]; T = G["BED_TOP"]
    wx, wy = G["WIFE"]
    gB = W(177)                              # burst
    wife = s.card("wife", 1.6)
    hus = s.card("husband", 1.75); hus.exempt = True
    zb, _ = _bury_z(hus)
    _mound(hx, hy, T, seed=21, n=26)
    # wife digs with the Mixamo "Digging" motion cards (146-frame loop; scoop ~cf 40-56, throw ~cf 76)
    CF0 = 18                                        # clip phase at the shot head so one full scoop+throw lands before the burst
    cf = lambda g: (g - s.g0 + CF0) % 146
    for g in s.frames():
        k = lib.ease((g - gB) / 8) if g >= gB else 0.0
        wife.at(s.L(g), (wx - 0.08 * k, wy, 0.0))
    def wst(g):
        if g < gB: return ("wife", "effort", "rig", dict(prop="shovel", clip="Digging", cf=cf(g)))
        return ("wife", "bored" if g < W(181) else "smug", "stand", dict(prop="shovel", blink=blink(g, 31)))
    s.key_card(wife, wst)
    # husband: buried (smug) -> bursts out on "dig" with a hop -> stands in the bed, arms up
    for g in s.frames():
        if g < gB:
            z = zb
        else:
            u = (g - gB) / 7.0
            if u < 1: z = zb + (T + 0.35 - zb) * (1 - (1 - u) ** 2)
            else: z = T + 0.35 * max(0.0, 1 - (u - 1) / 0.9) ** 2 * (1 if u < 1.9 else 0)
            z = max(z, zb)
        hus.at(s.L(g), (hx, hy, z))
    def hst(g):
        if g < gB: return ("husband", "smug" if g < W(174) else "grin", "stand", dict(blink=blink(g, 22)))
        return ("husband", "laugh" if ((g - gB) // 8) % 2 == 0 else "grin", "armsUp", dict(blink=0))
    s.key_card(hus, hst)
    # flying clods: 3 per dig stroke + a big burst
    r = random.Random(210); m = lib.mat("clodM", "#7a4a26", rough=0.95)
    events = []
    for g in s.frames():
        if g >= gB - 2: break
        if cf(g) == 76:
            for _ in range(5): events.append((g, r.uniform(2.4, 3.4), r.uniform(0.06, 0.09)))
        if cf(g) == 50:
            for _ in range(2): events.append((g, r.uniform(1.2, 1.8), 0.05))
    for _ in range(16): events.append((gB, r.uniform(3.2, 5.0), r.uniform(0.07, 0.12)))
    for i, (g0, v, size) in enumerate(events):
        c = SG.clod_mesh(f"clod{i}", size, seed=500 + i, m=m)
        burst = g0 == gB
        a = r.uniform(0, 2 * math.pi) if burst else r.uniform(1.6, 3.6)        # strokes throw toward the wife's side
        hv = r.uniform(0.6, 1.6) if burst else r.uniform(0.5, 1.1)
        vx, vy = hv * math.cos(a), hv * math.sin(a) * 0.7
        spin = r.uniform(-12, 12)
        for g in s.frames():
            f = s.L(g)
            if g < g0:
                c.location = (hx, hy, -0.6)
            else:
                t = (g - g0) / FPS_
                x, y = hx + vx * t, hy + vy * t
                z = T + 0.05 + v * t - 4.9 * t * t
                xa, xb, ya, yb = G["BED_A"]
                floor = T + 0.02 if (xa < x < xb and ya < y < yb) else 0.04
                if z <= floor and t > 0.1:
                    tl = (v + math.sqrt(v * v + 4 * 4.9 * (T + 0.05 - floor))) / (2 * 4.9)
                    x, y, z = hx + vx * tl, hy + vy * tl, floor
                    t = tl
                c.location = (x, y, z)
                c.rotation_euler = (spin * t, spin * 0.7 * t, spin * 0.3 * t)
            c.keyframe_insert("location", frame=f); c.keyframe_insert("rotation_euler", frame=f)
    # camera: low on the bed looking toward the house; glides/pans left to the shovel + WEST sign on words 181-184
    A0 = ((-4.75, -8.8, 1.5), (-5.45, -2.3, 0.95))
    B0 = ((-4.85, -9.8, 1.75), (-6.45, -5.7, 1.2))
    def cam(g):
        up = 0.7 * lib.ease((g - gB) / 10)                    # tilt up to keep the burst in frame
        A = push((A0[0][0], A0[0][1] - up * 0.6, A0[0][2] + up * 0.5), (A0[1][0] + up * 0.35, A0[1][1], A0[1][2] + up), g, s.a, 0.08)
        B = push(B0[0], B0[1], g, W(181), 0.10)
        if g < W(180) + 2: return A + (40,)
        k = lib.ease((g - W(180) - 2) / (W(182) + 4 - W(180)))
        return glide(A, B, g, W(180) + 2, W(182) + 6) + (40 + 8 * k,)
    _cam_bake(s, cam, 2.8)
    return s


FPS_ = lib.FPS
BUILD = {18: shot18, 20: shot20, 21: shot21}
