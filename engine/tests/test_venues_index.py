"""Hotfix T-hot1: the Kalshi matcher is indexed (it took ~82 minutes pairwise on prod-sized input) and bounded in time.
The indexed matcher must return EXACTLY what the old pairwise one did (`v.match_kalshi`, kept as the reference)."""
import random
import time

import pytest

from engine import venues as v

T0 = 1_795_372_009
H = 3600


def row(ticker, title, subtitle="", topic="sports.nfl", series="S", close=T0 + 100 * H, bid=50, ask=52):
    return [ticker, title, subtitle, topic, series, bid, ask, None, 10, close]


def pm(i, event, question=None, outcome="Yes", category="sports", closes=T0 + 100 * H, **kw):
    return dict(id=str(i), event=event, question=question if question is not None else event, category=category, closes_at=closes,
                url="https://polymarket.com/event/x", best=dict(outcome=outcome, ask=0.6, fee=0.01, side_index=0), **kw)


def same(markets, tuples, window=False):
    """Indexed result == pairwise result, market by market (ticker AND score). window=True: the pairwise reference only sees rows whose
    close time is within 48 h (score()'s own first gate returns 0 for the rest, so nothing it could match is dropped, and row order
    is kept for ties): that keeps the 2K x 20K reference to seconds. Every token/score path is still the unmodified pairwise code."""
    import bisect
    rows = v.kalshi_rows(tuples)
    ix = v.KalshiIndex(rows)
    by_time = sorted((r["close_epoch"] or 0, i) for i, r in enumerate(rows))
    times = [t for t, _ in by_time]
    for m in markets:
        ref = rows
        if window:
            lo, hi = bisect.bisect_left(times, m["closes_at"] - v.MAX_CLOSE_GAP_S), bisect.bisect_right(times, m["closes_at"] + v.MAX_CLOSE_GAP_S)
            ref = [rows[i] for i in sorted(i for _, i in by_time[lo:hi])]
        a, b = v.match_kalshi(m, ref), ix.match(m)
        assert (a is None) == (b is None), m["id"]
        if a:
            assert a[0]["ticker"] == b[0]["ticker"] and a[1] == b[1], m["id"]
    return sum(1 for m in markets if ix.match(m))


def test_near_threshold_pairs_score_089_to_091_agree():
    """Seven-token union, six shared: Jaccard 6/7 = 0.857 -> exactly the bound. The close gap moves the score across 0.9."""
    base = "alpha bravo charlie delta echo foxtrot"
    tuples, markets = [], []
    for g in range(0, 49, 3):   # gap in hours: score slides 0.9000 .. 0.8650 (each pair has its own tokens, so rows don't compete)
        b = " ".join(f"{t}{g}" for t in base.split())
        tuples.append(row(f"K{g}", b + f" golf{g}", "Yes", close=T0 + 100 * H + g * H))
        markets.append(pm(g, b, closes=T0 + 100 * H))
    # five shared of six (0.833) and one extra token on the Polymarket side (6/7): the other direction
    tuples.append(row("KX", base, "Yes"))
    markets.append(pm(900, base + " golf"))
    tuples.append(row("KY", "alpha bravo charlie delta echo", "Yes"))
    markets.append(pm(901, base))
    scores = [v.score(m, r) for m in markets for r in v.kalshi_rows(tuples)]
    assert any(0.89 <= s <= 0.91 for s in scores), "fixture must straddle the threshold"
    n = same(markets, tuples)
    assert 0 < n < len(markets)


def test_duplicate_rows_tie_breaks_to_the_first_in_row_order():
    tuples = [row("A1", "texans colts game", "Texans"), row("A2", "texans colts game", "Texans"), row("A3", "texans colts", "Texans")]
    m = pm(1, "texans colts game", outcome="Texans")
    rows = v.kalshi_rows(tuples)
    assert v.match_kalshi(m, rows)[0]["ticker"] == "A1" == v.KalshiIndex(rows).match(m)[0]["ticker"]
    same([m], tuples)


def test_rare_and_common_tokens():
    common = ["the", "will", "2026"]   # stop words and a very common number token
    tuples = [row(f"C{i}", f"market {i} winner 2026 zyxqrare{i % 3}", "Yes") for i in range(200)]
    tuples.append(row("R", "uniquetokenonly 2026", "Yes"))
    markets = [pm(1, "uniquetokenonly 2026"), pm(2, "market 7 winner 2026 zyxqrare1"), pm(3, "will the " + " ".join(common))]
    same(markets, tuples)


def test_empty_and_one_token_titles():
    tuples = [row("E0", "", ""), row("E1", "the", ""), row("E2", "solo", "Yes"), row("E3", "solo", "Yes"), row("E4", "the of a", "")]
    markets = [pm(1, ""), pm(2, "the"), pm(3, "solo"), pm(4, "solo", question="solo"), pm(5, "", question="solo"), pm(6, "of")]
    same(markets, tuples)


def _random_world(n_pm, n_k, seed=7, span_h=7200):
    rnd = random.Random(seed)
    vocab = [f"w{i}" for i in range(400)] + [str(n) for n in (1, 2, 3, 2026, 4.5, 6.5)]
    weights = [1 / (i + 1) ** 0.8 for i in range(len(vocab))]
    tuples = []
    for i in range(n_k):
        title = rnd.choices(vocab, weights, k=rnd.randint(1, 8))
        topic = rnd.choice(["sports.nfl", "politics.x", "other", "crypto.btc", "sports.nba"])
        tuples.append(row(f"K{i}", " ".join(title), rnd.choice(["Yes", "No", "w1", "w2 w3", ""]), topic, f"S{i % 50}",
                          close=T0 + rnd.randrange(0, span_h) * H))
    markets = []
    for j in range(n_pm):
        if rnd.random() < 0.6:   # derived from a Kalshi row: some match, some are off by a token or the date
            k = tuples[rnd.randrange(n_k)]
            toks = k[1].split()
            for _ in range(rnd.randint(0, 2)):
                if rnd.random() < 0.5 and toks:
                    toks.pop(rnd.randrange(len(toks)))
                else:
                    toks.insert(rnd.randrange(len(toks) + 1), rnd.choice(vocab))
            event, closes = " ".join(toks), k[9] + rnd.choice([0, 0, H, 40 * H, 60 * H])
            cat = k[3].split(".")[0] if rnd.random() < 0.9 else "sports"
            outcome = rnd.choice(["Yes", "No", "w1", k[2] or "Yes"])
        else:
            event = " ".join(rnd.choices(vocab, weights, k=rnd.randint(1, 7)))
            closes, cat, outcome = T0 + rnd.randrange(0, span_h) * H, rnd.choice(["sports", "politics", "crypto"]), rnd.choice(["Yes", "No"])
        q = event if rnd.random() < 0.5 else event + " " + rnd.choice(vocab)
        markets.append(pm(j, event, q, outcome, cat, closes))
    return markets, tuples


def test_large_random_world_2k_by_20k_has_identical_match_lists():
    markets, tuples = _random_world(2000, 20000)
    t = time.time()
    n = same(markets, tuples, window=True)
    print(f"2000 x 20000: {n} matched, {time.time() - t:.1f}s incl. the pairwise reference")
    assert n > 100   # the fixture really matches things (a vacuous equality would prove nothing)


def test_build_output_equals_the_pairwise_build():
    markets, tuples = _random_world(300, 3000, seed=3, span_h=200)   # dense in time: the time gate prunes nothing, so the token index does the work
    rows = v.kalshi_rows(tuples)
    want = {}
    for m in markets:
        venues, hit = v.quotes(m, rows)   # quotes() is the pairwise path
        if len(venues) >= 2:
            want[m["id"]] = dict(venues=venues, side=m["best"].get("side_index"), **({"kalshi_ticker": hit[0]["ticker"], "kalshi_match_conf": hit[1]} if hit else {}))
    assert v.build(markets, tuples) == want


def test_indexed_matcher_is_fast_at_prod_shape():
    """15K scored markets against 183K Kalshi rows must take well under 60 s; here 3K x 40K in under 8 s (the pairwise matcher needs minutes)."""
    markets, tuples = _random_world(3000, 40000, seed=11)
    t = time.time()
    v.build(markets, tuples)
    assert time.time() - t < 8


class _Cfg:
    def __init__(self, root):
        self.root = root

    def path(self, *p):
        import os
        return os.path.join(self.root, *p)


def test_time_budget_keeps_the_previous_venues_json_and_logs_one_warning(tmp_path):
    import json
    import os
    os.makedirs(tmp_path / "output")
    markets, tuples = _random_world(400, 4000, seed=5)
    (tmp_path / "output" / "markets.json").write_text(json.dumps({"markets": markets}))
    (tmp_path / "output" / "kalshi_index.json").write_text(json.dumps({"meta": {"fetched_at": 5}, "rows": tuples}))
    prev = {"meta": {"n": 1, "kalshi": True, "generated_at": 1, "kalshi_fetched_at": 4}, "venues": {"old": {"venues": [], "side": 0}}, "prev": []}
    (tmp_path / "output" / "venues.json").write_text(json.dumps(prev))
    logs = []
    out = v.write(_Cfg(str(tmp_path)), log=logs.append, budget_s=0.0)   # no time at all
    assert json.loads((tmp_path / "output" / "venues.json").read_text()) == prev   # untouched
    assert out == prev["venues"]
    warn = [m for m in logs if "budget" in m]
    assert len(warn) == 1 and warn[0].startswith("[venues] WARNING")
    # and with time to spare it writes the new file
    v.write(_Cfg(str(tmp_path)), log=logs.append, budget_s=60)
    assert json.loads((tmp_path / "output" / "venues.json").read_text())["meta"]["kalshi_fetched_at"] == 5


def test_real_polymarket_titles_give_the_same_matches_as_the_pairwise_matcher():
    """T-hot2: parity on REAL text (900 Polymarket markets from the Nov 23 scan, a dense slice by close time, and Kalshi-like rows made from
    their titles). The pairwise matcher finds 395 of the 900; the index must find the same markets with the same tickers and scores."""
    import json
    import os
    d = json.load(open(os.path.join(os.path.dirname(__file__), "fixtures", "venue_real_titles.json")))
    rows = v.kalshi_rows(d["rows"])
    ix = v.KalshiIndex(rows)
    found = 0
    for m in d["markets"]:
        a, b = v.match_kalshi(m, rows), ix.match(m)
        assert (a is None) == (b is None), (m["id"], m["event"], m["question"])
        if a:
            found += 1
            assert (a[0]["ticker"], a[1]) == (b[0]["ticker"], b[1]), m["id"]
    assert found == 395
    # and through build(): the same markets end up on 2+ venues
    assert len(v.build(d["markets"], d["rows"])) == found
