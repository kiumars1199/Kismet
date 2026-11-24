# Coverage of the fuzz: wrap score() to count near-threshold scores, 48h-boundary gaps, and ties among >=0.9 rows.
import runpy, sys, collections
from engine import venues as v
orig = v.score; c = collections.Counter()
def sc(pm, k):
    s = orig(pm, k)
    if 0.88 <= s < 0.9: c["0.88-0.9 (just below)"] += 1
    if 0.9 <= s <= 0.905: c["0.9-0.905 (just above)"] += 1
    if pm.get("closes_at") and k["close_epoch"]:
        g = abs(k["close_epoch"] - pm["closes_at"])
        if 48*3600 - 1 <= g <= 48*3600 + 1 and s: c["nonzero score at gap 48h+-1s"] += 1
        if g == 48*3600 and s >= .9: c["match at exactly 48h"] += 1
    return s
v.score = sc
ml = v.match_kalshi
def mk(pm, rows):
    r = ml(pm, rows)
    if r:
        n = sum(1 for k in rows if orig(pm, k) == r[1])
        if n > 1: c["matches with a tie at the top score"] += 1
    return r
v.match_kalshi = mk
sys.argv = ["fuzz", "1", "40"]; runpy.run_path("../r102/fuzz.py")
print(dict(c))
