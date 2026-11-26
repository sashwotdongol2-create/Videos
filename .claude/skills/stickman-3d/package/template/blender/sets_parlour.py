"""The worked parlour set (template example shot s01): `S export parlour --state night --bake --light`. The build lives in
sets.py (build_parlour / parlour_lights); export.py imports sets_<name>.py, so this file only points at it."""
from sets import build_parlour as build, parlour_lights as lights  # noqa: F401
