"""SECTION 4 - the farewell (global frames 1167-1588, words 115-153). One continuous camera move:
black entrance passage -> double doors open -> hallway: Hitler shakes hands with staff1, then staff2 (staff3 and Eva
wait) -> Hitler and Eva walk down the grey concrete corridor into the steel door -> the camera follows through the
closing door gap into the dark study -> Eva in a soft spotlight holding the capsule (Sad_Idle_front) -> the light
widens onto the German shepherd asleep on its cushion -> the camera pulls back out through the gap -> the door shuts ->
gunshot (word 150): one warm flicker under the door + the corridor lamp flickers -> slow fade to black.
Non-graphic: nobody is hurt on screen; the shot is only heard (light flicker under a closed door)."""
from shotlib import *
import os, shutil
import sets_sec4 as S4
from sets_sec4 import keyv
from mathutils import Vector

SID = 4
V = 1.2 / 32                      # walk speed (m per frame) at card height 1.75
HH = 1.75                         # Hitler + handshake staff height
EH = 1.65                         # Eva height
HAND, HAND_Z = 0.50, 0.76         # side-view handshake: hand reach in front of the card centre / height at the clasp
YS, YH, YE = 1.05, 0.8503, 1.0003   # staff line / Hitler / Eva lane
HX = -2.5                         # Hitler stands here for both handshakes (staff1 on his right, staff2 on his left)
S3 = -4.2                         # staff3 waits at the far end (no side-view handshake card for him)
EX = -0.95                        # Eva waits here, just inside the corridor mouth
SH1 = 1160                        # shake 1 starts; each shake = 44 frames (see shake_cf)
SHN = 44
SH2 = SH1 + SHN + 2               # he turns to his left and shakes staff2

# side-view Shaking_Hands cards rendered for this section (src/CardExportS4.tsx -> blender/cards_s4)
S4MAN = json.loads((lib.HERE / "cards_s4_manifest.json").read_text())
S4IDX = {(e["who"], e["cf"]): e["id"] for e in S4MAN}
S4DIR = lib.HERE / "cards_s4"


class Card4(lib.Card):
    """lib.Card that also takes the section-4 side-view handshake states (clip 'Shaking_Hands')."""
    def __init__(self, *a, **k):
        super().__init__(*a, **k); self.s4 = {}
    def key(self, f, who, expr, pose, blink=0, mouth=0.0, prop=None, facing=1, clip=None, cf=0):
        if clip == "Shaking_Hands":
            self.s4[f] = S4IDX[(who, int(cf))]; self.frames[f] = None
        else:
            self.s4.pop(f, None); super().key(f, who, expr, pose, blink, mouth, prop, facing, clip, cf)
    def finish(self, n):
        full, cur = {}, None
        for f in range(1, n + 1):
            if f in self.frames: cur = ("s4", self.s4[f]) if self.frames[f] is None else ("m", self.frames[f])
            full[f] = cur
        first_m = next((v[1] for v in full.values() if v and v[0] == "m"), 0)
        self.frames = {f: (v[1] if v and v[0] == "m" else first_m) for f, v in full.items()}
        super().finish(n)
        for f, v in full.items():
            if v and v[0] == "s4":
                dst = self.seq / f"{f:04d}.png"; dst.unlink()
                src = S4DIR / f"element-{v[1]:04d}.png"
                try: os.link(src, dst)
                except Exception: shutil.copyfile(src, dst)
        return self


def shake_cf(t):
    """clip frame t frames after a shake starts: idle (hands down) -> reverse 92..70 (hand comes forward to the clasp)
    -> 70..82 (pump) -> 82..92 (release) -> idle. One clip frame per film frame throughout."""
    if t < 0: return 92 + pp(-t, 0, 12)
    if t < 22: return 92 - t
    if t < 34: return 70 + (t - 22)
    if t < 44: return 82 + (t - 34)
    return 92 + pp(t - 44, 0, 12)


def hermite(keys, g, vel0=None):
    """non-uniform Catmull-Rom through keys [(g, vec), ...]; vel0 = start velocity (units/frame)."""
    ts = [k[0] for k in keys]; P = [Vector(k[1]) for k in keys]
    if g <= ts[0]: return P[0] + (vel0 or Vector((0, 0, 0))) * (g - ts[0])
    if g >= ts[-1]: return P[-1]
    i = max(j for j in range(len(ts) - 1) if ts[j] <= g)
    def m(j):
        if j == 0: return vel0 if vel0 is not None else (P[1] - P[0]) / (ts[1] - ts[0]) * 0
        if j == len(ts) - 1: return Vector((0, 0, 0))
        return (P[j + 1] - P[j - 1]) / (ts[j + 1] - ts[j - 1])
    h = ts[i + 1] - ts[i]; u = (g - ts[i]) / h
    h00, h10, h01, h11 = 2 * u**3 - 3 * u**2 + 1, u**3 - 2 * u**2 + u, -2 * u**3 + 3 * u**2, u**3 - u**2
    return h00 * P[i] + h10 * h * m(i) + h01 * P[i + 1] + h11 * h * m(i + 1)


# camera path: (global frame, position, look target, vertical fov)
CAMK = [
    (1161, (-2.72, -3.80, 1.50), (-2.70, 0.0, 1.38), 42),
    (1176, (-2.71, -3.30, 1.47), (-2.68, 0.6, 1.22), 42),
    (1196, (-2.15, -2.70, 1.40), (-2.02, 1.0, 1.00), 40),
    (1228, (-2.85, -2.55, 1.38), (-2.98, 1.0, 1.00), 40),
    (1262, (-2.85, -1.40, 1.40), (-1.60, 1.0, 1.05), 42),
    (1292, (-3.05, 0.10, 1.45), (0.40, 0.95, 1.10), 44),
    (1318, (-1.80, 0.42, 1.45), (1.20, 0.85, 1.05), 50),
    (1339, (-0.55, 0.60, 1.42), (2.00, 0.80, 1.05), 50),
    (1356, (0.45, 0.62, 1.40), (2.80, 0.75, 1.10), 46),
    (1371, (1.00, 0.66, 1.34), (3.60, 0.75, 1.05), 40),
    (1398, (1.55, 0.70, 1.26), (3.60, 0.75, 1.02), 38),
    (1422, (1.40, 0.82, 1.30), (3.20, 1.12, 0.62), 58),
    (1440, (1.40, 0.82, 1.30), (3.20, 1.12, 0.62), 58),
    (1458, (0.75, 0.64, 1.36), (3.0, 0.85, 0.95), 44),
    (1478, (-0.50, 0.70, 1.45), (0.50, 0.95, 1.10), 44),
    (1522, (-1.15, 0.55, 1.40), (0.45, 0.95, 1.00), 58),
    (1594, (-1.30, 0.55, 1.40), (0.45, 0.95, 1.00), 60),
]


def cam(g):
    pk = [(k[0], k[1]) for k in CAMK]; lk = [(k[0], k[2]) for k in CAMK]; fk = [(k[0], (k[3], 0, 0)) for k in CAMK]
    pos = hermite(pk, g, Vector((0, 1 / 30, 0)))
    look = hermite(lk, g, Vector((0, 0, 0)))
    fv = hermite(fk, g, Vector((0, 0, 0))).x
    return tuple(pos), tuple(look), fv


def right(C, p):
    f = Vector((C.x - p.x, C.y - p.y, 0)).normalized(); return Vector((-f.y, f.x, 0))


def partner_x(hx, dh, g):
    """x of the staff member (lane YS, facing -dh) whose handshake hand, seen from the camera at g, lands exactly on
    Hitler's hand (Hitler at hx in lane YH, facing dh = +1 right / -1 left, hand HAND in front of his card)."""
    C = Vector(cam(g)[0]); H = Vector((hx, YH, 0))
    hh = H + right(C, H) * (dh * HAND) + Vector((0, 0, HAND_Z))
    p = Vector((hx + dh * 2 * HAND, YS, 0)); dp = -dh
    for _ in range(6):
        r = right(C, p); ty = YS + dp * r.y * HAND
        t = (ty - C.y) / (hh.y - C.y); hp = C + (hh - C) * t
        p = Vector((hp.x - dp * r.x * HAND, YS, 0))
    return p.x


def pp(k, lo, hi):
    """ping-pong clip frame (k frames after lo, bouncing between lo and hi)."""
    n = hi - lo; k = k % (2 * n); return lo + (k if k <= n else 2 * n - k)


def tint_node(c):
    return next(n for n in c.mat.node_tree.nodes if n.type == "MIX" and n.blend_type == "MULTIPLY")


def key_tint(c, f, k):
    sock = tint_node(c).inputs[7]; sock.default_value = (k, k, k, 1); sock.keyframe_insert("default_value", frame=f)


def constant(idblock):
    ad = getattr(idblock, "animation_data", None)
    if not ad or not ad.action: return
    try: fcs = ad.action.fcurves
    except Exception:
        fcs = [fc for layer in ad.action.layers for st in layer.strips for cb in st.channelbags for fc in cb.fcurves]
    for fc in fcs:
        for kp in fc.keyframe_points: kp.interpolation = "CONSTANT"


def build(sid):
    s = Shot(sid)
    lib.reset(s.n, preview=bool(arg("--preview")))
    s.cam = lib.camera()
    lib.world("#000000", 0.0)
    hall = S4.build_hall(); cor = S4.build_corridor(); S4.build_study()
    lib.compositor(bloom=0.55, vign=0.5, vign_col="#2a2230", sat=1.0)
    L = s.L; F = s.frames()

    # ---- hallway fill: warm ceiling glow + cool bounce from the camera side
    light("AREA", "h_fill", (-2.8, -0.6, 2.6), "#ffd9b0", 160, size=2.5, target=(-2.8, 1.2, 0.8))
    light("AREA", "h_fill2", (-2.0, -2.4, 2.4), "#c8c8e0", 60, size=2.0, target=(-2.6, 1.4, 1.0))

    # ---- entrance double doors open as the camera arrives (black until then)
    for g in F:
        a = math.radians(105) * lib.ease((g - 1170) / 15)
        for piv, side in hall["ent_leaves"]:
            piv.rotation_euler.z = -side * a; piv.keyframe_insert("rotation_euler", frame=L(g))

    # ---- staff line: staff1 (right of Hitler, facing left), staff2 (left of him, facing right), staff3 waiting
    S1 = partner_x(HX, 1, SH1 + 28); S2 = partner_x(HX, -1, SH2 + 28)
    print("SEC4 staff1", round(S1, 3), "staff2", round(S2, 3))
    st1 = Card4(s.dir, "staff1", HH, "#ffffff", s.cam, 0.2); st2 = Card4(s.dir, "staff2", HH, "#ffffff", s.cam, 0.2)
    st3 = s.card("staff3", 1.72); s.cards += [st1, st2]
    st2.plane.scale.x = -1                                  # staff2 faces right (toward Hitler)
    s.key_card(st1, lambda g: ("staff1", "sad", "rig", dict(clip="Shaking_Hands", cf=shake_cf(g - SH1))))
    s.key_card(st2, lambda g: ("staff2", "sad", "rig", dict(clip="Shaking_Hands", cf=shake_cf(g - SH2))))
    s.key_card(st3, lambda g: ("staff3", "sad", "stand", dict(blink=blink(g, 7))))
    for g in F:
        st1.at(L(g), (S1, YS, 0.008)); st2.at(L(g), (S2, YS, 0.008)); st3.at(L(g), (S3, YS, 0.008))

    # ---- Hitler: shake 1 (facing right), turns, shake 2 (facing left), then walks with Eva through the corridor door
    hit = Card4(s.dir, "hitler", HH, "#ffffff", s.cam, 0.2); s.cards.append(hit)
    e2 = SH2 + SHN
    hx = lambda g: HX if g < e2 else HX + V * (g - e2)
    def hit_state(g):
        if g < SH1 + SHN: return ("hitler", "sad", "rig", dict(clip="Shaking_Hands", cf=shake_cf(g - SH1)))
        if g < e2: return ("hitler", "sad", "rig", dict(clip="Shaking_Hands", cf=shake_cf(g - SH2)))
        return ("hitler", "sad", "rig", dict(clip="Walking_IP", cf=(g - e2 + 16) % 32))
    s.key_card(hit, hit_state)
    for g in F:                       # facing: right for shake 1 and the walk, left (plane mirrored) for shake 2
        hit.plane.scale.x = -1 if SH1 + SHN + 1 <= g < e2 else 1
        hit.plane.keyframe_insert("scale", frame=L(g))
    zf = lambda x: 0.008 if x < S4.HALL["x1"] - 0.05 else 0.0       # runner top in the hallway, bare floor beyond
    for g in F:
        x = hx(g); hit.at(L(g), (x, YH, zf(x)))
    # Eva: waits by the corridor mouth, joins him as he passes
    ge = next(g for g in range(e2, e2 + 200) if hx(g) >= EX - 0.15)
    VE = V * EH / HH
    eva = s.card("eva", EH)
    ex = lambda g: EX if g < ge else EX + VE * (g - ge)
    s.key_card(eva, lambda g: ("eva", "sad", "stand", dict(blink=blink(g, 3))) if g < ge else ("eva", "neutral", "rig", dict(clip="Walking_IP", cf=(g - ge) % 32)))
    for g in F:
        x = ex(g); eva.at(L(g), (x, YE, zf(x)))
    # both darken as they walk into the unlit study, then leave the scene
    DX = S4.DOOR["x"]
    for g in F:
        key_tint(hit, L(g), max(0.0, min(1.0, 1 - (hx(g) - DX + 0.05) / 0.25)))
        key_tint(eva, L(g), max(0.0, min(1.0, 1 - (ex(g) - DX + 0.05) / 0.25)))
    gin = next(g for g in F if min(hx(g), ex(g)) > DX + 0.22)
    hit.hide(L(s.g0), False); eva.hide(L(s.g0), False); hit.hide(L(gin), True); eva.hide(L(gin), True)
    print("SEC4 Eva joins", ge, "both through the door by", gin)

    # ---- the steel door: open, closes to a gap the camera slips through, stays ajar, shuts after the pull-back
    hinge = cor["hinge"]
    def door_ang(g):
        c0 = max(gin - 2, 1342)
        if g < c0: return 92
        if g < 1470: return 92 - 37 * lib.ease((g - c0) / 13)
        return 55 * (1 - lib.ease((g - 1478) / 14)) if g >= 1478 else 55
    for g in F:
        hinge.rotation_euler.z = math.radians(door_ang(g)); hinge.keyframe_insert("rotation_euler", frame=L(g))

    # ---- the study: Eva with the capsule in a soft spotlight; the dog asleep on its cushion
    EV = (3.6, 0.75, 0.0)
    eva2 = s.card("eva_capsule", EH)
    s.key_card(eva2, lambda g: ("eva", "sad", "rig", dict(clip="Sad_Idle_front", prop="capsule", cf=(g - 1352) % 84)))
    for g in F: eva2.at(L(g), EV)
    on = lambda g, a, d: lib.ease((g - a) / d)
    for g in F:
        key_tint(eva2, L(g), 0.04 + 0.96 * on(g, 1355, 14))
    eva2.hide(L(s.g0), True); eva2.hide(L(1354), False)
    spot = light("SPOT", "s_spotEva", (EV[0] - 0.25, EV[1], 2.95), "#fff2dc", 0, size=0.3, target=(EV[0], EV[1], 0.4), spot=(34, 0.6))
    dog = S4.build_dog((3.0, 1.38, 0.0), yaw=-50)
    for o in dog.children:            # kept out of the render until the corridor lights behind the camera are off
        o.hide_render = True; o.keyframe_insert("hide_render", frame=1)
        o.hide_render = False; o.keyframe_insert("hide_render", frame=L(1360))
    dspot = light("SPOT", "s_spotDog", (2.9, 1.3, 2.95), "#ffe8cc", 0, size=0.4, target=(3.0, 1.38, 0.0), spot=(36, 0.7))
    fill = light("POINT", "s_fill", (2.0, 0.9, 1.6), "#8090c0", 0, size=0.5)
    for g in F:
        spot.data.energy = 520 * on(g, 1355, 14); spot.data.keyframe_insert("energy", frame=L(g))
        spot.data.spot_size = math.radians(22 + 16 * on(g, W(137), 18)); spot.data.keyframe_insert("spot_size", frame=L(g))
        dspot.data.energy = 360 * on(g, W(137), 18); dspot.data.keyframe_insert("energy", frame=L(g))
        fill.data.energy = 6 * on(g, 1355, 14); fill.data.keyframe_insert("energy", frame=L(g))

    # ---- corridor lamps go dark while the camera is inside the study (they are behind it, unseen) so no corridor
    #      light spills through the door gap onto Eva/the dog before their own lights come up
    for i, (ls_, lamp_) in enumerate(cor["lamps"]):
        for f_, k in ((1351, 1.0), (1355, 0.0), (1448, 0.0), (1454, 1.0)):
            keyv(ls_, L(f_), 5.0 * k); lamp_.data.energy = 380 * k; lamp_.data.keyframe_insert("energy", frame=L(f_))

    df = cor["doorfill"]                      # door fill only once the door is shut (it would light the study otherwise)
    for f_, k in ((s.g0, 0.0), (1476, 0.0), (1494, 1.0)):
        df.data.energy = 160 * k; df.data.keyframe_insert("energy", frame=L(f_))

    # ---- gunshot (word 150), off-screen: one warm flicker under the closed door + the corridor lamp flickers
    G = W(150)
    sts, spill, spillIn = cor["under"]
    for f_, k in ((G - 1, 0), (G, 1.0), (G + 1, 0.55), (G + 2, 0.85), (G + 3, 0.15), (G + 4, 0)):
        keyv(sts, L(f_), 40 * k); spill.data.energy = 260 * k; spill.data.keyframe_insert("energy", frame=L(f_))
        spillIn.data.energy = 400 * k; spillIn.data.keyframe_insert("energy", frame=L(f_))
    ls, lamp = cor["lamps"][1]
    for f_, k in ((G, 1.0), (G + 1, 0.12), (G + 2, 0.9), (G + 4, 0.08), (G + 6, 0.6), (G + 7, 1.0)):
        keyv(ls, L(f_), 5.0 * k); lamp.data.energy = 380 * k; lamp.data.keyframe_insert("energy", frame=L(f_))
    for idb in (sts.id_data, ls.id_data, spill.data, spillIn.data, lamp.data): constant(idb)

    # ---- slow fade to black at the end (camera-parented black card)
    fade = bpy.data.objects.new("fade", bpy.data.meshes.new("fade")); bpy.context.scene.collection.objects.link(fade)
    fade.data.from_pydata([(-1, -1, 0), (1, -1, 0), (1, 1, 0), (-1, 1, 0)], [], [(0, 1, 2, 3)])
    fade.parent = s.cam; fade.location = (0, 0, -0.08); fade.visible_shadow = False; fade["no_ground"] = True
    fm = bpy.data.materials.new("fadeM"); fm.use_nodes = True; nt = fm.node_tree; nt.nodes.clear()
    o_ = nt.nodes.new("ShaderNodeOutputMaterial"); tr = nt.nodes.new("ShaderNodeBsdfTransparent"); em = nt.nodes.new("ShaderNodeEmission")
    em.inputs[0].default_value = (0, 0, 0, 1); mx = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(tr.outputs[0], mx.inputs[1]); nt.links.new(em.outputs[0], mx.inputs[2]); nt.links.new(mx.outputs[0], o_.inputs["Surface"])
    try: fm.surface_render_method = "BLENDED"
    except Exception: pass
    fade.data.materials.append(fm)
    for g in F:
        keyv(mx.inputs[0], L(g), lib.ease((g - 1514) / 66))

    bake_camera(s.cam, s.n, lambda f: cam(f + s.g0 - 1))
    return s


BUILD = {SID: build}
