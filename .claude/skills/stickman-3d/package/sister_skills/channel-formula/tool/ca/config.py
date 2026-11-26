"""Paths for the skill (stdlib only, so any Python can read them before switching into the venv)."""
from __future__ import annotations

import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent          # <skill>/tool
SKILL = ROOT.parent                                     # <skill>


def load_config() -> dict:
    """<skill>/config.json (written by setup.py): {"home": workspaces root, "venv": venv dir}. CF_HOME / CF_VENV win."""
    cfg = {}
    p = SKILL / "config.json"
    if p.exists():
        cfg = json.loads(p.read_text(encoding="utf-8"))
    home = os.environ.get("CF_HOME") or cfg.get("home") or str(Path.home() / "channel-formula")
    venv = os.environ.get("CF_VENV") or cfg.get("venv") or str(SKILL / ".venv")
    return {"home": Path(home), "venv": Path(venv)}


def load_library() -> Path:
    """Where approved formulas are published: CF_LIBRARY, config.json "library", or <home>/_library."""
    cfg = {}
    p = SKILL / "config.json"
    if p.exists():
        cfg = json.loads(p.read_text(encoding="utf-8"))
    lib = os.environ.get("CF_LIBRARY") or cfg.get("library") or str(load_config()["home"] / "_library")
    return Path(lib)
