# Vision review instructions (per video)

You review one video at a time from its folder `<home>/<handle>/data/<id>/` (paths from `analyze.py --ch <handle> vision-todo`). Files:

- `contact_sheet.jpg`: thumbnails labelled `frame time`: the first 3 s every 0.5 s, then every 2 s, plus 2 frames per detected shot.
- `bounds_sheet.jpg`: one row per **candidate** transition: 9 consecutive frames (i-4 … i+4), labelled `#n f<frame> <time>s`. At ~30 fps a row spans 0.3 s.
- `transcript.json`: field `text` (narration) and `sentences`.
- `meta.json`: `youtube.title`.

Open the images with the Read tool. Write `vision.json` in the same folder with exactly this shape:

```json
{
  "candidates": [
    {"n": 0, "label": "hard_cut | whip_pan | zoom_through | fly_to_new_scene | morph_or_dissolve | rotate_or_flip | not_a_transition", "note": "short"}
  ],
  "art_style": "e.g. photoreal 3D CGI / stylised 3D / live action / 2D",
  "background": "what is behind the subject most of the time (e.g. flat sky-blue studio gradient, full environment)",
  "hook_visual": "what is on screen in the first 1.5 s and what happens (1 sentence)",
  "first_frame": "describe frame 0 exactly: subject, framing, action already in progress or not",
  "shot_types_pct": {"extreme_close_up": 0, "close_up": 0, "medium": 0, "wide": 0, "cross_section_or_xray": 0, "macro_inside_body_or_object": 0},
  "subject": "main subject (human body part / object / person / animal / place)",
  "human_present": true,
  "face_visible": false,
  "visual_devices": ["cutaway / x-ray view", "scale comparison", "labels/arrows", "slow motion", "hand interacting", "..."],
  "caption_style": "burned-in caption look: colour, outline/shadow, case, position, words per caption",
  "ending_visual": "what the last 2 s show; does it loop back to the first frame?",
  "loops_to_start": false,
  "beats": [{"t": 0.0, "beat": "hook"}, {"t": 4.5, "beat": "turn"}, {"t": 8.0, "beat": "setup"}, {"t": 14.0, "beat": "mechanism"}, {"t": 25.0, "beat": "payoff"}, {"t": 29.0, "beat": "ending"}],
  "notes": "anything distinctive about this video's look or pacing"
}
```

Transition labels:

- **hard_cut**: one frame to the next is a different shot with no motion blur or in-between frames.
- **whip_pan**: strong directional motion blur carries the picture to a new shot.
- **zoom_through**: the camera pushes fast into (or pulls out of) something and arrives somewhere new.
- **fly_to_new_scene**: a continuous camera move with no cut travels to a different location or subject (e.g. flies over a map to another country).
- **morph_or_dissolve**: one image blends or transforms into the next.
- **wipe**: a panel or shape slides across and replaces the picture.
- **rotate_or_flip**: the frame or object spins or flips to reveal the next scene.
- **not_a_transition**: the same shot continues (camera moving, lighting change, object moving).

Use the beat times from the transcript and the contact sheet. `shot_types_pct` should add up to about 100 and is your estimate of screen time.

Beats: name each beat with exactly one of these words, in the order they appear, and give the second the narration starts it (from transcript.json):
- **hook**: the opening line or image.
- **turn**: the line that overturns the obvious or raises the question ("but", "you might think", "actually", a misconception, a complication). Leave it out if there is none.
- **setup**: the situation gets specific (place, date, who, how it normally works).
- **mechanism**: the explanation starts ("this is because", how or why it happens), or the escalation ladder starts.
- **payoff**: the answer, twist or result in one line.
- **ending**: the closing line or loop.
Use each word at most once. Put any detail in `notes`, never in the beat name.

