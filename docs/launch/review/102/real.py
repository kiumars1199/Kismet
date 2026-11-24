# Real Polymarket titles (local output/markets.json, Nov 22) vs Kalshi-like rows derived from real titles: full pairwise vs index.
import json, random, time
from engine import venues as v
ms = [m for m in json.load(open("/home/user/MarketEdge/output/markets.json"))["markets"] if m.get("venue") != "us" and m.get("best")]
rnd = random.Random(5); rnd.shuffle(ms)
print(len(ms), "real markets; sample keys", sorted(ms[0].keys())[:25])
src = ms[:30000]; H = 3600
tuples = []
for i, m in enumerate(src):
    t = (m.get("event") if rnd.random() < .5 else m.get("question")) or ""
    w = t.split()
    if w and rnd.random() < .5: w.pop(rnd.randrange(len(w)))
    if rnd.random() < .3: w.insert(rnd.randrange(len(w) + 1), rnd.choice(["Yes", "pro", "series", "2026"]))
    sub = m["best"]["outcome"] if m["best"]["outcome"].lower() not in ("yes", "no") else rnd.choice(["", "Yes"])
    tuples.append([f"K{i}", " ".join(w), sub, rnd.choice([m.get("category") or "other", "other"]), "S", 40, 42, None, 1,
                   (m.get("closes_at") or 0) + rnd.choice([0, H, 47 * H, 48 * H, 48 * H + 1, 72 * H])])
rows = v.kalshi_rows(tuples); ix = v.KalshiIndex(rows)
test = ms[:1500]; bad = hit = 0; t = time.time()
for m in test:
    a, b = v.match_kalshi(m, rows), ix.match(m)
    hit += bool(a)
    if not ((a is None and b is None) or (a and b and a[0] is b[0] and a[1] == b[1])): bad += 1
print(f"real titles: {len(test)} markets x {len(rows)} rows, {hit} matched, {bad} mismatches, {time.time()-t:.0f}s")
