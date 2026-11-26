"""SECTION 3 (global frames 662-1167): the bunker radio room -> newspaper photo portal -> Milan alley + square ->
back out of the photo -> the gold pistol on the desk -> into the dark exit doorway.  One continuous camera move.
Portals: the camera pushes perpendicular into photo 1 until it exactly fills the frame (frame Fx = first Italy frame;
photo 1's texture IS the render of frame Fx), and leaves through photo 2 (frame Fy = last Italy frame = photo 2's
texture).  Both stills are rendered (no compositing) inside build, before the section renders.
Needs: python tex_sec3.py (textures + headset overlays)."""
from shotlib import *
from mathutils import Vector
import sets_sec3 as S3

VF = 55.0                                                     # constant vertical fov (the portal fill depends on it)
FX, FY = 880, 1016                                            # first / last Italy frame (global)
D_FILL = (S3.PH_H / 2) / math.tan(math.radians(VF / 2))      # camera-to-photo distance at which the photo fills the frame
THUMPS = [(681, 1.0), (712, 0.8), (734, 0.55)]                # "Soviet guns could be heard": shell hits
IO = S3.IO
V3 = lambda *a: Vector(a[0] if len(a) == 1 else a)


def hermite(keys, g):
    """keys: [(frame, Vector, velocity-per-frame or None)] -> C1-smooth position (Catmull-Rom tangents where None)."""
    ts = [k[0] for k in keys]; ps = [Vector(k[1]) for k in keys]
    def tan(i):
        if keys[i][2] is not None: return Vector(keys[i][2])
        a, b = max(0, i - 1), min(len(keys) - 1, i + 1)
        return (ps[b] - ps[a]) / (ts[b] - ts[a])
    if g <= ts[0]: return ps[0] + tan(0) * (g - ts[0])
    if g >= ts[-1]: return ps[-1] + tan(len(keys) - 1) * (g - ts[-1])
    i = max(j for j in range(len(ts) - 1) if ts[j] <= g)
    h = ts[i + 1] - ts[i]; s = (g - ts[i]) / h
    h00, h10, h01, h11 = 2 * s ** 3 - 3 * s ** 2 + 1, s ** 3 - 2 * s ** 2 + s, -2 * s ** 3 + 3 * s ** 2, s ** 3 - s ** 2
    return h00 * ps[i] + h10 * h * tan(i) + h01 * ps[i + 1] + h11 * h * tan(i + 1)


# ------------------------------------------------------------------ the camera path
P1, P2 = V3(S3.P1), V3(S3.P2)
F1, F2 = P1 - V3(0, D_FILL, 0), P2 - V3(0, D_FILL, 0)       # fill poses (perpendicular, centred)
C1, L1 = IO + V3(0.15, -3.2, 1.45), IO + V3(0.0, 1.0, 1.42)   # Italy: first frame (= photo 1), looking at the Duce
C2, L2 = IO + V3(0.0, 5.9, 3.85), IO + V3(0.0, 15.0, 2.9)   # Italy: last frame (= photo 2), under the canopy over the crowd
VI1, VI2 = 0.045, 0.035                                       # Italy speeds at the portals (m/frame, forward / backward)
D0 = (L1 - C1).length; D1 = (IO + V3(0, 12.5, 1.5) - C2).length
VR1, VR2 = VI1 * D_FILL / D0, VI2 * D_FILL / D1               # matching room speeds (same apparent zoom rate)
Z = V3(0, 0, 0)

ROOM_A = [(656, (0, -3.3, 1.5), (0, 1 / 30, 0)), (700, (0.02, -1.95, 1.55), None), (770, (0.05, -1.4, 1.52), None),
          (812, (0.03, -1.2, 1.48), None), (850, (0.3, 0.2, 1.8), None),
          (866, F1 - V3(0, 0.16, 0), (0, 0.0115, 0)), (FX, F1, (0, VR1, 0))]
ROOM_A_LOOK = [(656, (0, 1.3, 1.35), None), (700, (-0.05, 1.3, 1.25), None), (770, (-0.1, 1.3, 1.15), None), (812, (-0.12, 1.3, 1.12), None),
               (850, (P1.x - 0.05, S3.WB, P1.z - 0.05), None), (866, P1, Z), (FX, P1, Z)]
ITALY = [(FX, C1, (L1 - C1).normalized() * VI1), (925, IO + V3(0.05, -0.9, 1.55), None), (950, IO + V3(0, 1.0, 2.75), None),
         (982, IO + V3(0, 5.3, 3.8), None), (1000, IO + V3(0, 6.5, 3.85), (0, 0.004, 0)), (FY, C2, -(L2 - C2).normalized() * VI2)]
ITALY_LOOK = [(FX, L1, None), (925, IO + V3(0, 1.0, 1.42), None), (950, IO + V3(0, 8.0, 2.4), None), (982, IO + V3(0, 14.0, 2.7), None),
              (1000, L2, Z), (FY, L2, Z)]
PIS = V3(S3.PISTOL[0], S3.PISTOL[1], S3.DESK["top"])
ROOM_B = [(FY, F2, (0, -VR2, 0)), (1034, F2 - V3(0, 0.3, 0), (0, -0.03, 0)), (1064, (0.5, 0.33, 1.38), (-0.0007, 0.0041, -0.0054)), (1105, (0.47, 0.5, 1.16), (-0.0004, 0.003, -0.004)),
          (1135, (1.15, 0.4, 1.17), None), (1161, (1.525, 0.95, 1.15), (0, 1 / 30, 0)), (1180, (1.525, 1.58, 1.15), (0, 1 / 30, 0))]
ROOM_B_LOOK = [(FY, P2, Z), (1034, P2, Z), (1064, PIS + V3(0.03, -0.01, 0.01), Z), (1105, PIS + V3(0.03, -0.01, 0.01), Z),
               (1135, (1.5, 2.5, 1.12), None), (1161, (1.525, 3.0, 1.15), None), (1180, (1.525, 4.0, 1.15), None)]


def env(t, tau, onset=1.2):
    return 0.0 if t < 0 else math.exp(-t / tau) * (1 - math.exp(-t / onset))


def shake(g):
    """smooth decaying jolts (position, look) after each shell hit."""
    p, l = Vector(), Vector()
    for T, A in THUMPS:
        t = g - T; e = A * env(t, 9.0)
        if e == 0: continue
        p += e * V3(0.016 * math.sin(1.9 * t + T), 0.008 * math.sin(2.3 * t + 1 + T), 0.013 * math.sin(2.7 * t + 2 + T))
        l += e * V3(0.02 * math.sin(2.1 * t + 3 + T), 0.0, 0.016 * math.sin(2.5 * t + 4 + T))
    return p, l


def cam_path(g):
    if g < FX: pos, look = hermite(ROOM_A, g), hermite(ROOM_A_LOOK, g); sp, sl = shake(g); return pos + sp, look + sl
    if g <= FY: return hermite(ITALY, g), hermite(ITALY_LOOK, g)
    return hermite(ROOM_B, g), hermite(ROOM_B_LOOK, g)


# ------------------------------------------------------------------ build
def radio_shot(sid):
    s = Shot(sid)
    sc = lib.reset(s.n, preview=bool(arg("--preview")))
    s.cam = lib.camera()
    w = lib.world("#0d0c12", 0.35)
    lib.compositor(bloom=0.45, vign=0.45, vign_col="#1f1a2a", sat=1.05)
    room = S3.build_room(); S3.build_italy()
    rl = S3.room_lights(room["lamp_pivot"]); il = S3.italy_lights()
    photos = {}
    S3.photo_plane("r_photo1", S3.P1, photos); S3.photo_plane("r_photo2", S3.P2, photos)
    L = s.L

    # ---- italy-only lights + world (keys at the switches; integer frames never interpolate)
    bg = w.node_tree.nodes["Background"] if "Background" in w.node_tree.nodes else next(n for n in w.node_tree.nodes if n.type == "BACKGROUND")
    def toggle(sock_owner, path, room_v, italy_v):
        for g, v in ((s.g0, room_v), (FX - 1, room_v), (FX, italy_v), (FY, italy_v), (FY + 1, room_v), (s.g0 + s.n - 1, room_v)):
            setattr(sock_owner, path, v); sock_owner.keyframe_insert(path, frame=L(g))
    for o in il: toggle(o.data, "energy", 0.0, o.data.energy)
    toggle(bg.inputs[0], "default_value", lib.rgb("#0d0c12"), lib.rgb("#6a5890"))
    toggle(bg.inputs[1], "default_value", 0.35, 0.9)

    # ---- curtain parting (entry), lamp swing + flicker, dust
    cl, cr = room["curtain"]
    for g in s.frames():
        u = lib.ease((g - 663) / 16)
        for o, sd in ((cl, -1), (cr, 1)):
            o.location.x = sd * (0.62 + 0.36 * u); o.scale.x = 1 - 0.52 * u
            o.keyframe_insert("location", frame=L(g)); o.keyframe_insert("scale", frame=L(g))
    piv = room["lamp_pivot"]; bulb = rl[0]
    for g in s.frames():
        ax = ay = fl = 0.0
        for T, A in THUMPS:
            t = g - T; e = A * env(t, 45.0, 3.0)
            ax += 7.0 * e * math.sin(2 * math.pi * max(0, t) / 52); ay += 4.0 * e * math.sin(2 * math.pi * max(0, t) / 52 + 1.3)
            fl += A * env(t, 4.0, 0.8) * (0.5 + 0.5 * math.sin(1.7 * max(0, t)))
        piv.rotation_euler = (math.radians(ax), math.radians(ay), 0); piv.keyframe_insert("rotation_euler", frame=L(g))
        bulb.data.energy = 70 * (1 - 0.55 * min(1, fl)); bulb.data.keyframe_insert("energy", frame=L(g))
    dust(s)

    # ---- cast
    hit = s.card("hitler", 1.75, tint="#f6f2ec", lit=0.2)
    hit.at(1, S3.HIT)
    def hst(g):
        if g < 772: return ("hitler", "worried", "rig", dict(clip="Talking_On_Phone_front", cf=(g - 556) % 240))
        if g < 796: return ("hitler", "sad", "rig", dict(clip="Talking_On_Phone_front", cf=(g - 556) % 240))
        return ("hitler", "sad", "rig", dict(clip="Sad_Idle_front", cf=(g - 796) % 85))
    s.key_card(hit, hst)
    headset(s, hit)
    duce = s.card("duce", 1.72, tint="#ffeadc", lit=0.25)
    duce.at(1, tuple(IO + V3(S3.DUCE)))
    s.key_card(duce, lambda g: ("duce", "worried" if g < 935 else "scared", "stand", dict(blink=blink(g, 11))))
    rnd = random.Random(7); spots = []
    for row in range(6):
        y = 10.4 + row * 1.15
        for k in range(7):
            x = -5.4 + k * 1.8 + (0.9 if row % 2 else 0) + rnd.uniform(-0.25, 0.25)
            if abs(x) > 5.8: continue
            spots.append((x, y + rnd.uniform(-0.2, 0.2)))
    for i, (x, y) in enumerate(spots):
        who = "crowd1" if rnd.random() < 0.5 else "crowd2"; ex = "angry" if rnd.random() < 0.75 else "shocked"
        c = s.card(f"crowd{i}", rnd.uniform(1.62, 1.82), tint=rnd.choice(("#ffeee2", "#f4ece8", "#ffe4d4")), lit=0.25)
        c.at(1, (IO.x + x, IO.y + y, 0.0))
        s.key_card(c, lambda g, who=who, ex=ex, i=i: (who, ex, "stand", dict(blink=blink(g, 20 + i))))

    # ---- camera + photo fade
    def cam(g):
        pos, look = cam_path(g); return tuple(pos), tuple(look), VF
    def dof(g):
        pos, look = cam_path(g)
        return ((pos - look).length, 2.0 if 1050 <= g <= 1128 else 22.0)
    bake_camera(s.cam, s.n, lambda f: cam(f + s.g0 - 1), dof=lambda f: dof(f + s.g0 - 1))
    for nm, (ti, k) in photos.items():
        P = P1 if nm.endswith("1") else P2
        for g in s.frames():
            pos, _ = cam_path(g)
            d = (pos - P).length if not (FX <= g <= FY) else D_FILL
            k.outputs[0].default_value = max(0.0, min(0.85, (d - 0.62) / 0.9)); k.outputs[0].keyframe_insert("default_value", frame=L(g))

    # ---- portal stills: the Italy renders at FX and FY become the two newspaper photos
    sc.render.use_compositing = False
    for g, nm in ((FX, "r_photo1"), (FY, "r_photo2")):
        sc.frame_set(L(g)); path = s.dir / f"portal_{nm[-1]}.png"
        sc.render.filepath = str(path); bpy.ops.render.render(write_still=True)
        img = bpy.data.images.load(str(path), check_existing=False); img.reload()
        photos[nm][0].image = img
    sc.render.use_compositing = True
    return s


def headset(s, hit):
    """headset overlay (tex/sec3_headset, same frame as the card) on a plane 2 cm in front of hitler's card."""
    hs = Card(s.dir, "hitler_headset", hit.height, "#f6f2ec", None, hit.lit)
    hs.frames = dict(hit.frames)
    keep = lib.CARDS; lib.CARDS = lib.HERE / "tex" / "sec3_headset"
    try: hs.finish(s.n)
    finally: lib.CARDS = keep
    hs.root.parent = hit.root; hs.root.location = (0, -0.02, 0)


def dust(s):
    """dust specks shaken off the ceiling after each hit: drag-limited fall, land on the desk or the floor."""
    rnd = random.Random(5); m = lib.mat("sec3_dust", "#bdb3a2", emit=0.1, emit_col="#bdb3a2")
    D = S3.DESK
    for T, A in THUMPS:
        for i in range(int(70 * A)):
            r = rnd.uniform(0.002, 0.005) if rnd.random() < 0.85 else rnd.uniform(0.006, 0.009)
            o = lib.add_mesh("sphere", "dust", (0, 0, 0), (r,) * 3, material=m, ink=False, segments=6, ring_count=4)
            x, y = rnd.uniform(-1.7, 1.7), rnd.uniform(-0.6, 1.9)
            floor = D["top"] if (D["x0"] < x < D["x1"] and D["y0"] < y < D["y1"]) else 0.0
            t0 = T + rnd.uniform(0, 12); vt = rnd.uniform(0.45, 1.2) * (1.6 if r > 0.0055 else 1.0); tau = 0.22
            ph, amp = rnd.uniform(0, 6.28), rnd.uniform(0.01, 0.04)
            o.location = (x, y, S3.CEIL + 0.04); o.keyframe_insert("location", frame=s.L(s.g0))
            o.keyframe_insert("location", frame=s.L(int(t0)))
            g = int(t0) + 1
            while g < s.g0 + s.n:
                t = (g - t0) / 30.0
                z = S3.CEIL - 0.01 - vt * (t - tau * (1 - math.exp(-t / tau)))
                if z <= floor + r: z = floor + r
                o.location = (x + amp * math.sin(ph + 3 * t), y + amp * 0.5 * math.cos(ph + 2 * t), z)
                o.keyframe_insert("location", frame=s.L(g))
                if z <= floor + r: break
                g += 2


BUILD = {3: radio_shot}
