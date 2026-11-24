# Independent equivalence fuzz for #102: full pairwise match_kalshi (no window prefilter) vs KalshiIndex.match.
import random, sys, time
from engine import venues as v
H = 3600; T0 = 1_795_372_009
rnd = random.Random(int(sys.argv[1]) if len(sys.argv) > 1 else 1)
vocab = ["Texans", "colts", "U.S.", "4.5", "2026", "Bitcoin", "btc", "O'Brien", "obrien", "the", "Will", "WIN", "vs.", "a", "Rate",
         "cut", "fed", "Dec", "Lakers", "celtics", "over", "under", "6.5", "1", "2"] + [f"w{i}" for i in range(40)]
def title(k): return " ".join(rnd.choice(vocab) for _ in range(k))
def mutate(t):
    toks = t.split()
    for _ in range(rnd.choice([0, 0, 1, 1, 2])):
        r = rnd.random()
        if r < 0.3 and toks: toks.pop(rnd.randrange(len(toks)))
        elif r < 0.6: toks.insert(rnd.randrange(len(toks) + 1), rnd.choice(vocab))
        elif toks: i = rnd.randrange(len(toks)); toks[i] = toks[i].upper() if rnd.random() < .5 else toks[i] + "!"
    return " ".join(toks)
GAPS = [0, 1, H, 47 * H, 48 * H - 1, 48 * H, 48 * H + 1, 49 * H, 100 * H, 0.5, 48 * H + 0.5]
bad = 0; total = 0; matched = 0
for world in range(int(sys.argv[2]) if len(sys.argv) > 2 else 40):
    tuples = []
    nk = rnd.randint(50, 400)
    for i in range(nk):
        t = title(rnd.randint(0, 9))
        close = rnd.choice([None, 0, T0 + rnd.randrange(0, 300) * H, T0 + rnd.randrange(0, 300) * H + 0.25])
        tuples.append([f"K{i}", t, rnd.choice(["Yes", "No", "", "Texans", "colts 4.5"]), rnd.choice(["sports.nfl", "other", None, "crypto.x", "politics"]),
                       "S", 40, 42, None, 1, close])
    for i in range(rnd.randint(0, 30)):   # exact duplicates (ties) at different positions
        tuples.insert(rnd.randrange(len(tuples) + 1), list(rnd.choice(tuples)))
        tuples[-1] = tuples[-1]
    rows = v.kalshi_rows(tuples)
    ix = v.KalshiIndex(rows)
    for j in range(150):
        if rnd.random() < 0.75 and rows:
            k = rnd.choice(rows); ev = mutate(k["title"]); base = k["close_epoch"] or T0
            closes = base + rnd.choice(GAPS) * rnd.choice([1, -1])
            outcome = rnd.choice(["Yes", "No", k["subtitle"] or "Yes", "Texans"])
            cat = (k["topic"] or "sports").split(".")[0] if rnd.random() < .8 else "sports"
        else:
            ev = title(rnd.randint(0, 8)); closes = T0 + rnd.randrange(0, 300) * H; outcome = rnd.choice(["Yes", "No"]); cat = "sports"
        if rnd.random() < 0.05: closes = rnd.choice([None, 0])
        q = rnd.choice([ev, mutate(ev), ev + " " + rnd.choice(vocab), "", None])
        m = dict(id=str(j), event=rnd.choice([ev, ev, "", None]), question=q, category=cat, closes_at=closes, url="u",
                 best=dict(outcome=outcome, ask=.5, fee=.01, side_index=0))
        a, b = v.match_kalshi(m, rows), ix.match(m)
        total += 1
        if a: matched += 1
        same = (a is None and b is None) or (a and b and a[0] is b[0] and a[1] == b[1])
        if not same:
            bad += 1
            if bad <= 5: print("MISMATCH", m, a and (a[0]["ticker"], a[1]), b and (b[0]["ticker"], b[1]))
print(f"seed {sys.argv[1] if len(sys.argv) > 1 else 1}: {total} markets, {matched} matched by pairwise, {bad} mismatches")
