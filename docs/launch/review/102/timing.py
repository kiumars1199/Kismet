import time, sys
from engine import venues as v
from engine.tests.test_venues_index import _random_world
for span in (7200, 400):
    t = time.time(); markets, tuples = _random_world(15000, 183000, seed=21, span_h=span); gen = time.time() - t
    t = time.time(); res = v.build(markets, tuples); ib = time.time() - t
    rows = v.kalshi_rows(tuples); t = time.time()
    for m in markets[:15]: v.match_kalshi(m, rows)
    per = (time.time() - t) / 15
    print(f"span {span}h: 15000 x 183000: indexed build {ib:.1f}s ({len(res)} entries); pairwise {per:.2f}s/market -> est {per*15000/60:.0f} min")
