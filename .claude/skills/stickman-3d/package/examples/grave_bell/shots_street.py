"""Snow street shots (9, 10, 11, 12, 13): the whole street on its porches, the porch argument, the doctor hauled
out and sitting in the snow with the certificate, the wife's dark house."""
from shotlib import *
import sets_street as ST
from mathutils import Vector

import inspect
if "clip" not in inspect.signature(lib.card_index).parameters:
    # lib.Card.key passes clip/cf but lib.card_index does not take them yet: local fallback (nearest exported cf)
    def _card_index(who, expr, pose, blink=0, mouth=0.0, prop=None, facing=1, clip=None, cf=0):
        best, bd = None, 1e9
        for e in lib.MANIFEST:
            if e["who"] == who and e["expr"] == expr and e["pose"] == pose and e["blink"] == blink and abs(e["mouth"] - mouth) < 1e-3                     and (e["prop"] or None) == (prop or None) and e["facing"] == facing and e.get("clip") == clip:
                d = abs(e.get("cf", 0) - cf)
                if d < bd: best, bd = e["id"], d
        if best is None: raise KeyError(f"no card {who} {expr} {pose} b{blink} m{mouth} {prop} {clip}")
        return best
    lib.card_index = _card_index

E = lambda i: round(lib.WORDS[i]["e"] * lib.FPS) - 1          # global frame where word i ends
NIGHT_TINT = "#e2e4ff"
WARM_TINT = "#fff0e0"


def flap(g, words):
    """mouth 0 / 0.5 / 0.9 cycling every 3 frames while one of `words` is being spoken."""
    for i in words:
        if W(i) <= g <= E(i):
            return (0.5, 0.9, 0.5, 0.0)[((g - W(i)) // 3) % 4]
    return 0.0


def setup(s, lit_all=True, snow_c=(0, 10, 3), snow_s=(14, 14, 8), flakes=500, sky=1.6, sun=3.0, bloom=0.85):
    lib.reset(s.n, preview=bool(arg("--preview")))
    s.cam = lib.camera()
    ST._M.clear(); ST._LANTERN.clear(); ST._CORE.clear(); ST._PINE.clear()
    o = ST.build_street(lit_all=lit_all)
    ST.street_lights(sun=sun)
    ST.sky_world(strength=sky, haze=0.0)
    nt = lib.compositor(bloom=bloom, vign=0.55, vign_col="#28307a", sat=1.08)
    fog_glow(nt)
    ST.snowfall(s.n, snow_c, snow_s, count=int(flakes * 0.45), seed=s.sid, flake=0.018)
    return o


def fog_glow(nt):
    """lib.compositor leaves the 5.x Glare node on its default 'Streaks' (Type is a menu input now): use Fog Glow."""
    for n in nt.nodes:
        if n.bl_idname != "CompositorNodeGlare": continue
        for sock in n.inputs:
            if sock.name == "Type":
                for v in ("Fog Glow", "FOG_GLOW", "Bloom", "BLOOM"):
                    try: sock.default_value = v; break
                    except Exception: pass
                print("GLARE", sock.default_value)
            if sock.name == "Quality":
                try: sock.default_value = "High"
                except Exception: pass


def W2(h, p): return ST.local_to_world(h, p)


def porch_spot(h, u, v=0.0):
    """world point on house h's porch deck: u = along the front (local x), v = 0 middle .. -1 front edge."""
    pcx, pcy = h["porch_c"]
    return W2(h, (pcx + u, pcy + v * h["pd"] / 2, h["porch_z"] + 0.03))     # +3 cm: the deck's ink hull


def dofn(cam_fn, fstop, focus=None):
    def f(g):
        pos, look = cam_fn(g)[:2]
        return (math.dist(pos, focus if focus is not None else look), fstop)
    return f


# ============================================================ 9: the whole street, lights on one by one
def shot9(sid):
    s = Shot(sid)
    o = setup(s, lit_all=False, snow_c=(0, 4, 4), snow_s=(16, 22, 9), flakes=700)
    H = o["houses"]
    order = ["R0", "L1", "R2", "L0", "R1", "L3", "R3", "L2", "DOC", "L4", "L5"]
    t0, t1 = W(74), W(81)
    for k, nm in enumerate(order):
        gon = t0 + round((t1 - t0) * k / (len(order) - 1))
        m = H[nm]["win_mat"]; ST.key_window(m, 1, False); ST.key_window(m, max(2, s.L(gon) - 1), False); ST.key_window(m, s.L(gon), True)
        lan = o["lanterns"][nm]
        L = lan[2]; L.data.energy = 0; L.data.keyframe_insert("energy", frame=1); L.data.keyframe_insert("energy", frame=s.L(gon))
        L.data.energy = 60; L.data.keyframe_insert("energy", frame=s.L(gon + 2))
        core = lan[1]
        for f_, sc_ in ((1, 0.0001), (s.L(gon), 0.0001), (s.L(gon + 2), 1.0)):
            core.scale = (0.42 * 0.17 * sc_,) * 3; core.keyframe_insert("scale", frame=f_)
    # people step out onto their porches (door -> porch front), a beat after their lights
    cast = [("R0", "yellow", ("yellow", "worried", "stand", dict(prop="lantern")), 0.8),
            ("L1", "nightcap", ("nightcap", "angry", "stand", {}), -0.9),
            ("R2", "redcoat", ("redcoat", "nervous", "hold", {}), 1.0),
            ("L0", "shawl", ("shawl", "angry", "hold", {}), -1.0),
            ("L3", "creditor2", ("creditor2", "stern", "stand", dict(prop="ticket")), 0.7),
            ("R3", "creditor5", ("creditor5", "stern", "stand", dict(prop="ticket")), -0.8)]
    for k, (nm, cn, st, u) in enumerate(cast):
        h = H[nm]; c = s.card(cn, 1.75, tint=NIGHT_TINT, lit=0.25)
        gon = t0 + round((t1 - t0) * order.index(nm) / (len(order) - 1)) + 8
        a = porch_spot(h, h["door"][0] + 0.2 * (1 if u > 0 else -1), 0.75); b = porch_spot(h, u, -0.55)
        for g in s.frames():
            k_ = lib.ease((g - gon) / 14)
            c.at(s.L(g), tuple(x + (y - x) * k_ for x, y in zip(a, b)))
        c.hide(1, True); c.hide(max(2, s.L(gon)), False)
        s.key_card(c, lambda g, st=st, k=k: (st[0], st[1], st[2], dict(st[3], blink=blink(g, 20 + k))))
    def cam(g):
        return push((0.0, -3.0, 5.0), (0.0, 40.0, 1.2), g, s.a, 0.08) + (68,)
    bake_camera(s.cam, s.n, lambda f: cam(f + s.g0 - 1), dof=dofn(cam, 6.0))
    return s


# ============================================================ 10: porch argument
def shot10(sid):
    s = Shot(sid)
    o = setup(s, snow_c=(-5.2, 6, 2.5), snow_s=(6, 10, 5), flakes=260, sun=2.0, bloom=0.9)
    h = o["houses"]["L0"]; hn = o["houses"]["L1"]
    # extra porch dressing: hanging lantern near camera, doormat, warm fill
    ST.lantern("hang10", (-4.95, 0.35, 3.05), height=0.5, light_w=90)
    ST.M("rug")
    mb = ST.MB("doormat"); mb.box((0, 0, 0.005), (1.1, 1.6, 0.01), ST.M("rug")); mo = mb.build(ink=0.0); mo.location = (-6.3, 2.0, 0.6)
    light("POINT", "porchWarm", (-6.0, 2.4, 3.1), "#ffb070", 260, size=0.4, shadow=True)
    light("POINT", "porchWarm2", (-5.0, 0.0, 2.0), "#ff9a60", 80, size=0.6, shadow=False)
    R = (-5.95, 3.1, 0.63); S_ = (-5.0, 2.75, 0.63)
    N = porch_spot(hn, -0.6, -0.3)
    red = s.card("redcoat", 1.75, tint=WARM_TINT, lit=0.2)
    shw = s.card("shawl", 1.62, tint=WARM_TINT, lit=0.2)
    nc = s.card("nightcap", 1.75, tint=NIGHT_TINT, lit=0.25)
    for g in s.frames():
        f = s.L(g); bob = 0.012 * math.sin(g * 0.35)
        red.at(f, (R[0], R[1], R[2]), scale=1.0 + bob)
        shw.at(f, (S_[0] + 0.02 * math.sin(g * 0.21), S_[1], S_[2]), scale=1.0 + 0.01 * math.sin(g * 0.4 + 1))
        nc.at(f, N)
    end = E(90) + 4
    def red_st(g):
        e = "shocked" if g >= end else "nervous"
        return ("redcoat", e, "hold", dict(blink=0 if e == "shocked" else blink(g, 31), mouth=flap(g, (84, 85, 86))))
    def shw_st(g):
        e = "shocked" if g >= end else "angry"
        return ("shawl", e, "hold", dict(blink=0 if e == "shocked" else blink(g, 32), mouth=flap(g, (87, 88, 89, 90))))
    def nc_st(g):
        e = "shocked" if g >= end else "angry"
        return ("nightcap", e, "stand", dict(blink=0 if e == "shocked" else blink(g, 33)))
    s.key_card(red, red_st); s.key_card(shw, shw_st); s.key_card(nc, nc_st)
    RH = red.head(R, "redcoat", "nervous", "hold"); SH = shw.head(S_, "shawl", "angry", "hold")
    mid = ((RH[0] + SH[0]) / 2, (RH[1] + SH[1]) / 2, (RH[2] + SH[2]) / 2 - 0.25)
    def cam(g):
        return spike(spike(push((-5.55, -1.5, 1.85), mid, g, s.a, 0.07), g, W(87), 0.12), g, end, 0.15) + (40,)
    bake_camera(s.cam, s.n, lambda f: cam(f + s.g0 - 1), dof=dofn(cam, 1.8))
    return s


# ============================================================ 11: shawl hauls the doctor out through the snow
def shot11(sid):
    s = Shot(sid)
    o = setup(s, snow_c=(1, 38, 3), snow_s=(12, 16, 7), flakes=500)
    hd = o["houses"]["DOC"]
    # physician sign on a bracket at the porch corner, facing up the street
    corner = W2(hd, (hd["porch_c"][0] - hd["porch_w"] / 2 + 0.12, hd["porch_c"][1] - hd["pd"] / 2 + 0.12, 0))
    sm = sets.image_mat("physM", sets.tex("physician"), emit=0.6)
    sets.plane("physSign", 1.5, 0.5, sm, (corner[0] - 0.75, corner[1] - 0.02, 3.0), rot=(90, 0, 0))
    lib.box("physBar", (corner[0] - 0.75, corner[1] - 0.02, 3.32), (1.7, 0.06, 0.06), ST.M("trim"))
    # open, lit doorway with the redcoat in it
    door = W2(hd, (0, -hd["d"] / 2 - 0.1, 0.6))
    sets.plane("doorGlow", 1.0, 2.25, lib.emissive("doorGlowM", "#ffbe6a", 2.2), (door[0] - 0.05, door[1], 0.6 + 1.13), rot=(90, 0, -90))
    light("POINT", "doorL", (door[0] - 1.0, door[1], 1.9), "#ffa860", 200, size=0.5)
    red = s.card("redcoat", 1.75, tint=WARM_TINT, lit=0.2)
    rp = (door[0] - 0.35, door[1], 0.63)
    shw = s.card("shawl", 1.62, tint=NIGHT_TINT, lit=0.25)
    doc = s.card("doctor", 1.7, tint=NIGHT_TINT, lit=0.25); doc.exempt = True
    doc.plane.scale.x = -1                                     # mirror: head away from her, feet in her hand
    x0, x1, y = 0.6, -0.3, 37.5
    for g in s.frames():
        f = s.L(g); u = (g - s.g0) / s.n
        x = x0 + (x1 - x0) * u
        shw.at(f, (x, y, 0.0), scale=1.0 + 0.015 * abs(math.sin(g * 0.45)))
        doc.at(f, (x + 1.3, y + 0.25, 0.0), tilt=-22 + 2.5 * math.sin(g * 0.45))
        red.at(f, rp)
    s.key_card(shw, lambda g: ("shawl", "angry", "rig", dict(prop=None, clip="Pull_Heavy_Object", cf=(g - s.g0) % 34)))
    s.key_card(doc, lambda g: ("doctor", "sleepy", "lie", dict(blink=blink(g, 42))))
    s.key_card(red, lambda g: ("redcoat", "nervous", "hold", dict(blink=blink(g, 43))))
    def cam(g):
        return push((0.2, 27.5, 2.2), (3.4, 50.0, 2.0), g, s.a, 0.08) + (52,)
    bake_camera(s.cam, s.n, lambda f: cam(f + s.g0 - 1), dof=dofn(cam, 4.0, focus=(0.5, 37.5, 0.8)))
    return s


# ============================================================ 12: doctor in the snow, "I signed that paper myself"
def shot12(sid):
    s = Shot(sid)
    o = setup(s, snow_c=(2.0, 44, 2.5), snow_s=(8, 9, 5), flakes=300, bloom=0.9)
    hd = o["houses"]["DOC"]
    door = W2(hd, (0, -hd["d"] / 2 - 0.1, 0.6))
    sets.plane("doorGlow", 1.0, 2.25, lib.emissive("doorGlowM", "#ffbe6a", 2.2), (door[0] - 0.05, door[1], 0.6 + 1.13), rot=(90, 0, -90))
    light("POINT", "doorL", (door[0] - 1.2, door[1], 1.9), "#ffa860", 220, size=0.5)
    # lanterns stuck in the snow around him
    for i, (x, y) in enumerate(((1.2, 42.4), (1.0, 44.4), (2.6, 41.5), (2.7, 45.4), (0.5, 43.3))):
        ST.lantern(f"snowLan{i}", (x, y, -0.05), height=0.45, light_w=45, radius=2.5)
    light("POINT", "warmFill", (1.4, 44.2, 1.6), "#ffb070", 120, size=0.8, shadow=False)
    SINK = 0.58
    dp = (2.1, 43.35, -SINK)
    doc = s.card("doctor", 1.7, tint=WARM_TINT, lit=0.2); doc.exempt = True
    yel = s.card("yellow", 1.75, tint=WARM_TINT, lit=0.2)
    red = s.card("redcoat", 1.75, tint=WARM_TINT, lit=0.2)
    yp, rp = (3.0, 42.0, 0.0), (3.1, 44.75, 0.0)
    for g in s.frames():
        f = s.L(g)
        doc.at(f, (dp[0], dp[1], dp[2] + 0.01 * math.sin(g * 0.3)))
        yel.at(f, yp); red.at(f, rp)
    s.key_card(doc, lambda g: ("doctor", "stern", "sit", dict(blink=1, mouth=flap(g, range(101, 110)))))
    s.key_card(yel, lambda g: ("yellow", "worried", "hold", dict(prop="lantern", blink=blink(g, 51))))
    s.key_card(red, lambda g: ("redcoat", "nervous", "hold", dict(blink=blink(g, 52))))
    DH = doc.head(dp, "doctor", "stern", "sit")
    # the death certificate: held up beside him at "paper"
    cm = sets.image_mat("certM", sets.tex("certificate"), emit=0.35)
    cert = sets.plane("cert", 0.48, 0.6, cm, (0, 0, 0), rot=(90, 0, -90))
    cert.hide_render = True; cert.keyframe_insert("hide_render", frame=1)
    up = (DH[0] + 0.1, DH[1] - 0.62, DH[2] + 0.05); low = (up[0], up[1] - 0.1, up[2] - 0.7)
    gc = W(108) - 3
    cert.hide_render = False; cert.keyframe_insert("hide_render", frame=s.L(gc))
    for g in range(gc, s.g0 + s.n):
        k = lib.ease((g - gc) / 6)
        cert.location = tuple(a + (b - a) * k for a, b in zip(low, up)); cert.rotation_euler.y = math.radians(8 * (1 - k) - 4)
        cert.keyframe_insert("location", frame=s.L(g)); cert.keyframe_insert("rotation_euler", frame=s.L(g))
    look = (DH[0] + 0.6, DH[1] - 0.1, DH[2] - 0.3)
    def cam(g):
        return spike(push((DH[0] - 5.6, DH[1] - 0.2, DH[2] - 0.05), look, g, s.a, 0.10), g, W(108), 0.18) + (38,)
    bake_camera(s.cam, s.n, lambda f: cam(f + s.g0 - 1), dof=dofn(cam, 2.0, focus=None))
    return s


# ============================================================ 13: the wife's dark house, fast push to the bay window
def shot13(sid):
    s = Shot(sid)
    o = setup(s, snow_c=(0, 46, 3), snow_s=(12, 14, 7), flakes=500)
    hw = o["houses"]["WIFE"]
    bay = W2(hw, hw["bay"])
    yel = s.card("yellow", 1.75, tint=NIGHT_TINT, lit=0.25)
    shw = s.card("shawl", 1.62, tint=NIGHT_TINT, lit=0.25)
    yp, sp = (0.3, 41.0, 0.0), (-1.4, 41.2, 0.0)
    for g in s.frames():
        yel.at(s.L(g), yp); shw.at(s.L(g), sp)
    s.key_card(yel, lambda g: ("yellow", "worried", "hold", dict(prop="lantern", blink=blink(g, 61))))
    s.key_card(shw, lambda g: ("shawl", "angry", "hold", dict(blink=blink(g, 62))))
    def cam(g):
        tgt = (bay[0], bay[1], bay[2] + 0.15)
        pos, _ = push((-0.5, 37.0, 2.5), tgt, g, s.a, 0.48)
        k = lib.ease((g - s.g0) / s.n)
        look = tuple(a + (b - a) * k for a, b in zip((0.0, 58.0, 3.2), tgt))
        return pos, look, 46
    bake_camera(s.cam, s.n, lambda f: cam(f + s.g0 - 1), dof=dofn(cam, 4.0))
    return s


BUILD = {9: shot9, 10: shot10, 11: shot11, 12: shot12, 13: shot13}
