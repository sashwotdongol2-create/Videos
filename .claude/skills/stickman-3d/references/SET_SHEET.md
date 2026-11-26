# Set sheet (SET.md)

Every set gets one before it is built (plan, step 3) and keeps it in the library (`S library save <set>` copies it from
`blender/SET_<set>.md` if present, else writes a stub to fill). `S library list` prints the FIRST LINE, so that line is
`<set>: <one-line description>`.

## Format

```
<set>: <what it is, era, place, in one line>

Base vs kit: <what is generic (shell, ground, light) and what is era/place dressing that a new film would swap>
States: <state> = <what differs: light, open door, objects>   (one line each; these are the GLBs)
Size + viewing side: <metres, which side cameras look from, ground height>
Anchors / animatable nodes: <named spots and nodes shots use>
Layers (depth):
  foreground  <props that sit close to the lens: frame edges, over-the-shoulder>
  middle      <where action happens: clear floor, desk, runway>
  background  <walls, windows, hills, haze>
Props (10-15): <list; mark era-specific ones with *>
Materials + colours: <main surfaces and their palette; dominant hue + saturated accent(s) per state (WORLD.md 1)>
Sky + ground: <sky per state (clouds / sun / moon), ground surfaces (road vs field vs street), grass areas + tuft count>
Life: <background extras, the moving element (smoke, birds, laundry, flag), mid-layer landmarks 15-80 m>
Light: day = ... | night/lamp = ... | golden = ...   (moods: which `--mood` suits it)
Camera notes: <near/far planes, walls to keep the lens inside, best angles>
Rebuild: <script, what it imports, where its assets/tex live>
Assets + licences: <source, licence; CC-BY credits to copy into the film's ASSETS.md/description>
Used in: <film / shots>   Look-dev: <files>   Known issues: <...>
```

## Detail rules (what makes a set read as detailed)
- Depth in three layers: something close to the lens at the frame edge, the action in the clear middle, and walls or
  hills fading into coloured haze at the back (LOOK.md -> Depth).
- 10-15 props with real models (RULES.md -> Assets), each with a reason to be there; clutter in clusters, floor clear
  where people walk.
- The WORLD.md look-dev gate passes on every state (colour, sky, grass, four coloured layers, dressing, light).
- Every set has at least two light states, or one state that the moods grade well (check with look-dev per mood).
- Look-dev from 3 angles with the 1.7 m stand-in, then one still with the real cast before `library save`.
- Era props are a kit: keep them in their own function/collection in the build script so a new film can swap them
  without touching the shell.
