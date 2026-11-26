"""Parlour shots (14, 15, 16, 17, 22, 23)."""
from shotlib import *

# ============================================================ PARLOUR shots (14, 15, 16, 17, 22, 23)
def parlour_shot(sid):
    s = Shot(sid)
    state = "day" if sid == 17 else "night"
    lib.reset(s.n, preview=bool(arg("--preview")))
    s.cam = lib.camera()
    o = sets.build_parlour(state); sets.parlour_lights(state)
    lib.compositor(bloom=0.5 if state == "day" else 0.7, vign=0.4 if state == "day" else 0.55, vign_col="#3a3570" if state != "day" else "#5a4030", sat=1.05)
    P = sets.P; C = P["CHAIR"]
    chair = o["chair"]
    SINK = 0.36                                   # sitting card sunk into the chair: the seat/arms hide the legs
    wife_at = (C[0] + 0.02, C[1] - 0.12, -SINK)
    wife = s.card("wife", 1.45, tint="#eceaff" if state != "day" else "#ffffff"); wife.exempt = True
    WH = wife.head(wife_at, "wife", "bored", "sit")
    # rocking: chair + wife bob, period stretching through the night in shot 23
    def rock(g):
        # phase integrated frame by frame so the period can stretch (2.4 s -> 4.1 s through shot 23) without speeding up
        ph = 0.0
        for x in range(s.g0, g):
            slow = 1 + (0.7 * lib.ease((x - s.a) / max(1, s.b - s.a)) if sid == 23 else 0)
            ph += 2 * math.pi / (2.4 * slow * lib.FPS)
        return math.sin(ph + s.g0 * 2 * math.pi / (2.4 * lib.FPS))
    for g in s.frames():
        f = s.L(g); r = rock(g) if state != "day" else 0
        chair.rotation_euler.x = math.radians(3.5 * r); chair.keyframe_insert("rotation_euler", frame=f)
        wife.at(f, (wife_at[0], wife_at[1] + 0.03 * r, wife_at[2] + 0.02 * abs(r)))
    if sid in (16, 22, 17):
        wife.hide(1)
    def wife_state(g):
        e = "bored"
        if sid == 23 and W(196) <= g < W(199): e = "sleepy"
        if sid == 23 and g >= W(199): e = "smug"
        return ("wife", e, "sit", dict(blink=0 if e == "sleepy" else blink(g, 3)))
    s.key_card(wife, wife_state)
    if sid == 17:
        hus = s.card("husband", 1.75, tint="#ffffff")
        s.key_card(hus, lambda g: ("husband", "grin" if (g // 8) % 2 == 0 else "laugh", "hold", dict(prop="bell", blink=blink(g, 5))))
        for g in s.frames(): hus.at(s.L(g), (-0.45, 1.05, 0.25 + 0.02 * math.sin(g * 0.8)))
    # cameras (global frame functions)
    def cam(g):
        if sid == 14:
            A = push((0.5, -5.2, 1.7), (0.2, 1.8, 1.0), g, s.a, 0.08)
            B = push((1.3, -1.8, 1.25), (1.15, P["WALL"], 0.75), g, s.a, 0.08)
            return glide(A, B, g, W(122), W(125)) + (42,)
        if sid == 15:
            return spike(push((WH[0] - 0.7, WH[1] - 5.2, WH[2] - 0.55), (WH[0] - 0.05, WH[1], WH[2] - 0.3), g, s.a, 0.10), g, W(130), 0.3) + (32,)
        if sid == 16:
            A = push((0.3, -0.2, 1.6), (P["BELL"][0] + 0.1, P["WALL"], 1.45), g, s.a, 0.12)
            B = push((1.1, -0.1, 1.5), (P["DOOR_X"] - 0.83, P["WALL"], 1.35), g, s.a, 0.12)
            return spike(glide(A, B, g, W(141), W(142) + 8), g, W(144), 0.45) + (40,)
        if sid == 17:
            return push((0.9, -4.6, 1.55), (-0.45, 1.05, 1.0), g, s.a, 0.10) + (40,)
        if sid == 22:
            return push((0.55, 0.3, 1.0), (P["SHOVEL"][0], P["SHOVEL"][1], 0.72), g, s.a, 0.14) + (38,)
        # 23
        W1 = push((1.1, -5.4, 2.0), (-0.4, 1.4, 1.0), g, s.a, 0.08)
        CU = push((WH[0] - 0.7, WH[1] - 5.0, WH[2] - 0.5), (WH[0] - 0.05, WH[1], WH[2] - 0.3), g, W(192), 0.10)
        MS = push((WH[0] + 1.0, WH[1] - 4.3, WH[2]), (WH[0], WH[1], WH[2] - 0.35), g, W(196), 0.10)
        HI = ((1.6, -3.2, 2.75), (-1.0, 0.8, 0.4))
        if g < W(192): return W1 + (42,)
        if g < W(196): return CU + (38,)
        return glide(MS, HI, g, W(199), W(203) + 6) + (40,)
    def dof(g):
        pos, look = cam(g)[:2]
        dist = math.dist(pos, look)
        fstop = {15: 1.4, 22: 1.2, 16: 2.0, 17: 2.8, 14: 3.5}.get(sid, 2.0 if W(192) <= g < W(199) else 4.0)
        return (dist, fstop)
    bake_camera(s.cam, s.n, lambda f: cam(f + s.g0 - 1), dof=lambda f: dof(f + s.g0 - 1))
    return s



BUILD = {i: parlour_shot for i in (14, 15, 16, 17, 22, 23)}
