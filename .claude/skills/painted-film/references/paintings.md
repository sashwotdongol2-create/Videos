# Paintings: the casting list

All public domain (painter dead over 100 years; Commons files of 2D artworks are PD in the US). Fetch with
`fetch.py`; titles below are the exact Commons files used, so they download first time. Ask for width 1920, or 3840
when you will crop figures out.

## Cut out and used (tested)

| Painting | Commons file | Cut-out | Role so far | Used in |
|---|---|---|---|---|
| Velázquez, *Pablo de Valladolid* (c. 1635) | `File:Velázquez - Pablo de Valladolid (Museo del Prado, 1636-37).jpg` | Clean, plain background, whole figure | The man making conversation; mid-gesture, points at whoever he talks to | go-deeper, three-ways |
| Sargent, *Madame X* (1884) | `File:Sargent MadameX.jpeg` | Clean; her table drops out | The cool listener; profile, mirror her to look away, `P.turn` to face | go-deeper, three-ways |
| Manet, *Young Lady in 1866* | `File:Édouard Manet - Young Lady in 1866 - Google Art Project.jpg` | Clean; the parrot drops out | The candidate / hero. Pink dressing gown = the human.md "pyjama" look | three-ways, tell-me-painted |
| Manet, *The Fifer* (1866) | `File:Manet, Edouard - Young Flautist, or The Fifer, 1866 (2).jpg` | Clean | A bystander in a corridor | three-ways |
| Rembrandt, *The Syndics* (1662) | `File:Rembrandt - De Staalmeesters- het college van staalmeesters (waardijns) van het Amsterdamse lakenbereidersgilde - Google Art Project.jpg` | Men cut clean, **table dropped**: rebuild with `box 1104 1835 2736 760` (at 3840 px) | The interview panel; all staring at you | tell-me-painted |
| Vermeer, *Woman Reading a Letter* (c. 1663) | `File:Vermeer, Johannes - Woman reading a letter - ca. 1662-1663.jpg` | Clean | Reading (vs talking) | tell-me-painted |
| Seurat, *A Sunday on La Grande Jatte* (1884) | `File:A Sunday on La Grande Jatte, Georges Seurat, 1884.jpg` | Vision finds one subject; crop each figure first (boxes in `tell-me-painted` history: angler, girl with flowers, little girl, nurse, runner, top hat man, dog, pug, blue-parasol woman). Heads can drop off: check each | A crowd that arrives, followers, an audience | tell-me-painted |

Whole paintings used as scenes (no cut-out): Raphael *The School of Athens* (`File:The School of Athens by Raffaello
Sanzio da Urbino.jpg`, school/degree), Van Gogh *Café Terrace at Night* (`File:Vincent Willem van Gogh - Cafe Terrace
at Night (Yorck).jpg`, a café, a night out), Bruegel *The Tower of Babel* (Vienna, `File:Pieter Bruegel the Elder - The
Tower of Babel (Vienna) - Google Art Project - edited.jpg`, something bigger, ambition; focus fx 0.36).

## To try next, by role (not fetched yet: search with `fetch.py --search`)

People (full length on plain grounds cut out best):
- Manet, *The Tragic Actor* (1866): an actor mid-speech; a presenter.
- Raeburn, *The Skating Minister* (c. 1790): motion, flow, "glide through it".
- Gainsborough, *The Blue Boy* (c. 1770): a confident young man; landscape ground, check the cut.
- Caillebotte, *Paris Street; Rainy Day* (1877): couples walking with umbrellas; small talk on the street.
- Holbein, *The Ambassadors* (1533): two men, a table of instruments; a formal meeting.
- Frans Hals, *The Laughing Cavalier* (1624, half length): the confident one, a laugh.
- Munch, *The Scream* (1893; Munch died 1944, PD in the EU and US): nerves before speaking. Strong but overused: use small.
- Friedrich, *Wanderer above the Sea of Fog* (c. 1818, back view): confidence, looking ahead, "after you practise".
- Vermeer, *The Milkmaid*, *Girl with a Pearl Earring* (bust): a listener, a look over the shoulder.

Rooms and crowds (whole paintings as scenes):
- Rembrandt, *The Anatomy Lesson of Dr Tulp* (1632): a lecture, an audience leaning in: presentations.
- Caravaggio, *The Calling of Saint Matthew* (1600): the pointing finger and the beam of light: being called on in class.
- Rembrandt, *The Night Watch* (1642): a crowd moving, an entrance.
- Bruegel, *Netherlandish Proverbs*, *Hunters in the Snow*, *The Peasant Wedding*: busy scenes, a party, small talk.
- Hokusai, *The Great Wave off Kanagawa* (c. 1831): pressure, the moment before; a strong tilt or iris target.
- Van Gogh, *The Starry Night* (1889): the night before; tilt up into it.
- Seurat, *Bathers at Asnières* (1884): calm, after.
- Michelangelo, *The Creation of Adam* (detail of the hands): a handshake, a first meeting.

Props (cut from still lifes and details): Claesz / Heda vanitas (a watch, a glass, a candle), Chardin (cups, a
silver goblet), Van Gogh *Sunflowers* (a gift), Arcimboldo heads (a joke), a lute or a letter from Vermeer, a
pointing hand from Caravaggio.

## Rules

- Prefer full-length figures on plain or dark grounds; they cut cleanly. Busy backgrounds and figures touching
  furniture lose parts.
- Keep one painted style per scene where you can (Manet next to Sargent reads; Seurat dots next to Rembrandt is fine
  as a joke but not as a couple talking).
- Don't put a real living person or a brand in the film. Paintings of real historical sitters are fine.
- Note new cut-outs here (file, quality, role) when you add them, so the list grows.
