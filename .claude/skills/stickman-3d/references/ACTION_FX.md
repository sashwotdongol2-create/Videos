# Action effects + transitions (from the Zack D. Films WWI reference)

Source: "The Assassination That Started World War I" (Zack D. Films, 35.5 s, 1062 frames), downloaded with its
transcript and every frame to `D:\resource\reference\pIZUyyun3eg` (frame strips of each effect in `fx_study/`).
Everything below is rebuilt for the stickman look in `src/world/fx_action.tsx` (effects) and
`src/film/transitions.ts` (transitions): procedural, deterministic (pure functions of t + seeds), cheap in WebGL, so
they render in the normal `S still` / `S render` loop. Demo project: `D:\resource\stickman\_t_fx` (4 shots on
roadfield:day, `src/shots/fxdemo.tsx`), shows every piece in use.

## What the reference uses, and what to call

| ref time | effect in the reference | stickman version | call |
|---|---|---|---|
| 0:00-0:06 | huge golden bullet drifting past the Archduke in slow motion | toon brass round, spinning, faint air ripples + speed streaks, slowest in front of the target | `<SlowBullet t t0 dur from to k={3.2} ease={0.6} />`, `bulletAt()` to aim the camera / focus at it |
| 0:06 | SPIN transition: frame rolls ~75 deg with heavy rotational blur, punch-in | `"spin"` | `src/edit.json` kinds `{"<id>": "spin"}` |
| 0:09 | vertical whip ("Earlier"): picture slides up with a vertical smear | `"vwhip"` | kinds `"vwhip"` |
| 0:11 | door / page swing ("and when"): shot hinges away into black, next swings in | `"flip"` | kinds `"flip"` |
| 0:03, 0:12 | rack focus between foreground and subject | DOF focus pull | `focus={rackFocus(t, t0, t1, A, B)}` on `<View>` |
| 0:13-0:15 | grenade thrown in an arc, bounces off the car hood, rolls on the cobbles | toon pineapple grenade + ballistic arc + hops + roll | `<Grenade p rot r />` with `throwArc(t, t0, from, land, {fly, h, e, roll, r})` (returns p, rot, impacts) |
| 0:16-0:19 | explosion: ground lit red -> white-hot fireball + flame spikes -> hot red -> black cloud with red embers inside, wheel + debris flying, smoke column; ~3.5 s; then dissolve out of the smoke | crimson palette by default (`palette="fire"` for orange) | `<Explosion t t0 p k={1} palette="red" />` + `shake(cam, t, [{t0, amp: 0.22, dur: 1.1}])` |
| 0:25-0:27 | pistol shot (POV): recoil, tiny flash, pink blood mist at the chest, a 2nd shot | muzzle flash 2 frames + light + gun smoke + sparks; mist sprays toward the lens | `<GunShot t t0 p dir />`, `<BloodHit t t0 p dir />`, `recoil(t, t0)` for a held gun |
| 0:26-0:29 | blood stain spreads on the chest, covered by a red pixel mosaic | spreading stain decal + censor mosaic | `<Wound t t0 p size censor />`, `<CensorMosaic p size />` alone |
| 0:29 | dissolve from the bodies into the map | existing `dissolve` | default |
| 0:30-0:35 | map: glowing borders, waving flags, little orange blast puffs, shells flying in arcs, stone "WWI" title | toon blast pops, shell with smoke trail, cloth flags | `<MiniBlast t t0 p r />`, `<ShellArc t t0 dur from to h k />`, `<WavingFlag t p colors />` |
| all | camera jolts on the blast and the shots | trauma shake (smooth multi-sine, decays) | `shake(cam, t, hits)` |

Not rebuilt here (not effects): the 3D map/globe itself, the stone "WWI" letters (a set/prop job), the photoreal crowd.

## Measured timings (30 fps) the code follows
- **Explosion** (`BLAST_LIFE` 4.2 s): flash 0-0.1 s (ground glow peaks) | spikes 0.03-0.6 s | fireball white 0-0.3 s, hot red by
  0.5 s, blood red 0.8 s, near-black with embers from ~1.3 s | embers glow 0.6-3.6 s | smoke column 0.4-2.4 s emitted |
  fade 2.5-4.2 s. Cloud stays on the street and rises slowly (the reference never lifts it off the ground).
  k = 1 for a grenade under a car (fireball ~2.5 m wide); k = 2-3 far off in a wide.
- **Gunshot**: flash 2 frames, smoke 1.3 s, mist 0.8 s, wound spreads over ~1.2 s, 2nd shot 0.8 s later.
- **Transitions**: spin 6 frames out + 6 in (2-frame blend); vwhip 4 + 4; flip 4 out, 1 black, 5 in.
  Motion blur in `S render` (sub-frames) turns spin and whips into real smears; `--draft` renders are sharp.
- **Shake amp** (metres of jolt): gunshot near 0.03-0.04, blast near 0.2-0.25, blast far 0.05.

## Rules
- Mist / smoke must not sit on faces: aim `BloodHit dir` at the lens side (back toward the shooter); put blasts beside
  or behind people, never between the lens and a face for more than a few frames.
- Place `GunShot` / `BloodHit` / `Wound` AFTER the `<Stickman/>` they belong to and read joints with
  `useJoint(who, "RightHandMiddle1" | "Neck" | "Hips")` so the flash sits on the drawn hand.
- Decals (ground glow, scorch, wound, mosaic) use a small ShaderMaterial: a plain MeshBasicMaterial with a canvas
  alpha map drew them as solid squares in this engine (found 2026-11-20).
- One explosion per shot is the budget at full quality (~110 sprites + 26 chips); two far ones are fine.
