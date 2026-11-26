"""Group sizes for channels with too few videos to sample. Run: python tests/test_census.py"""
import os, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ.setdefault("CA_WS", "unused")
from ca.fetch import census_sizes

for n in range(5, 35):
    h, r, c = census_sizes(n, 6)
    assert h + r + c == n and h >= 2 and r >= 1 and c >= 2, (n, h, r, c)
assert census_sizes(23, 6) == (13, 4, 6)   # Yarnhub's real split
try:
    census_sizes(4, 6)
    raise AssertionError("4 videos must stop")
except SystemExit:
    pass
print("ok")
