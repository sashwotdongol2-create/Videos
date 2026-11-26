"""clean's guard must see junctions/symlinks (Path.resolve() misses Windows junctions). Run: python tests/test_links.py"""
import os, subprocess, sys, tempfile
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ.setdefault("CA_WS", tempfile.gettempdir())
from ca.library import _links

with tempfile.TemporaryDirectory() as t:
    t = Path(t); (t / "target").mkdir(); (t / "ws" / "sub").mkdir(parents=True)
    link = t / "ws" / "sub" / "data"
    if os.name == "nt":
        subprocess.run(["cmd", "/c", "mklink", "/J", str(link), str(t / "target")], check=True, capture_output=True)
    else:
        link.symlink_to(t / "target")
    assert [p.name for p in _links(t / "ws")] == ["data"], "junction not detected"
    assert list(_links(t / "target")) == [], "false positive"
    os.rmdir(link) if os.name == "nt" else link.unlink()
print("ok")

# clean must never get a workspace outside <home>: handles that resolve to <home> or above are rejected
import importlib.util
spec = importlib.util.spec_from_file_location("analyze_cli", Path(__file__).resolve().parents[1] / "analyze.py")
src = spec.loader.get_source("analyze_cli")
ns = {}
exec(src[src.index("def handle_from_url"):src.index("def _pick_workspace")], {"re": __import__("re"), "sys": sys}, ns)
for bad in (".", "..", "@", "a/../.."):
    try:
        ns["handle_from_url"](bad)
        raise AssertionError(f"accepted {bad!r}")
    except SystemExit:
        pass
assert ns["handle_from_url"]("https://www.youtube.com/@TheArtOfWarrr/shorts") == "theartofwarrr"
print("ok handles")
