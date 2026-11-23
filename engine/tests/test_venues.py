"""F4: Kalshi matching precision on hand-labeled pairs, and the venues.json shape.
venue_pairs.json: 50 pairs labeled by hand (23 same, 27 different, most of those hard negatives: other date, other side,
spread vs moneyline, other line or strike). The first 42 were used to tune the matcher; the last 8 were added after.
NOT a live crawl: the pairs are written from fixtures, so the real-world precision is unmeasured until a crawl is labeled."""
import json
import os

from engine import venues as v

PAIRS = json.load(open(os.path.join(os.path.dirname(__file__), "fixtures", "venue_pairs.json")))


def accepted(p):
    return v.score(p["pm"], p["k"]) >= v.MIN_SCORE


def test_at_least_40_labeled_pairs_with_hard_negatives():
    assert len(PAIRS) >= 40
    assert sum(not p["same"] for p in PAIRS) >= 15


def test_matching_precision_at_least_95_percent():
    tp = sum(accepted(p) and p["same"] for p in PAIRS)
    fp = [p["note"] for p in PAIRS if accepted(p) and not p["same"]]
    fn = [p["note"] for p in PAIRS if not accepted(p) and p["same"]]
    precision = tp / (tp + len(fp))
    print(f"precision {precision:.3f} (TP {tp}, FP {fp}), recall {tp / (tp + len(fn)):.3f} (FN {fn})")
    assert precision >= 0.95, fp


def _pm(**kw):
    b = dict(outcome="Texans", ask=0.62, fee=0.01)
    return dict(id="1", question="Colts vs. Texans", event="Colts vs. Texans", category="sports", closes_at=1795372009 + 100 * 3600,
                url="https://polymarket.com/event/x", best=b, **kw)


def _row(**kw):
    return [f"KXNFLGAME-1", "Colts at Texans", "Texans", "sports.nfl", "KXNFLGAME", 58, 60, None, 100, 1795372009 + 101 * 3600]


def test_build_polymarket_us_and_kalshi_in_order_with_kalshi_multiplier():
    pm = _pm(us=dict(ask=0.6, fee=0.01, url="https://polymarket.us/event/x"))
    out = v.build([pm], [_row()])["1"]
    assert [q["venue"] for q in out["venues"]] == ["polymarket", "us", "kalshi"]
    poly, us, k = out["venues"]
    assert poly["multiplier"] == round(1 / 0.63, 4) and us["multiplier"] == round(1 / 0.61, 4)
    assert k["price"] == 0.6 and k["multiplier"] == round(1 / 0.62, 4) and k["url"] == "https://kalshi.com/markets/kxnflgame"
    assert out["kalshi_ticker"] == "KXNFLGAME-1" and out["kalshi_match_conf"] >= v.MIN_SCORE


def test_a_market_on_one_venue_is_left_out_and_us_native_rows_are_skipped():
    assert v.build([_pm()], []) == {}
    assert v.build([dict(_pm(), venue="us", us=dict(ask=0.5, fee=0, url="u"))], [_row()]) == {}


def test_no_side_prices_kalshi_at_one_minus_the_yes_bid():
    pm = _pm()
    pm["best"] = dict(outcome="No", ask=0.4, fee=0.01)
    k = dict(ticker="T", title="x", subtitle="", topic="sports.nfl", series="S", yes_bid=70, yes_ask=72, close_epoch=1)
    assert v.kalshi_price(pm, k) == 0.3
    k["yes_bid"] = None
    assert v.kalshi_price(pm, k) is None


def test_entries_carry_the_side_the_kalshi_price_is_for():
    pm = _pm(us=dict(ask=0.6, fee=0.01, url="u"))
    pm["best"]["side_index"] = 1
    assert v.build([pm], [_row()])["1"]["side"] == 1


def test_write_stamps_the_kalshi_crawl_time_and_keeps_two_older_snapshots(tmp_path):
    """F4: the web picks the newest snapshot whose Kalshi crawl is not newer than a store's scan (Free's delay)."""
    class Cfg(dict):
        def path(self, kind, name):
            return str(tmp_path / name)
    cfg = Cfg()
    pm = _pm(us=dict(ask=0.6, fee=0.01, url="u"))
    pm["best"]["side_index"] = 0
    json.dump({"markets": [pm]}, open(tmp_path / "markets.json", "w"))
    for fetched in (1000, 2000, 3000, 4000):
        json.dump({"meta": {"fetched_at": fetched}, "rows": [_row()]}, open(tmp_path / "kalshi_index.json", "w"))
        v.write(cfg, log=lambda *_: None)
    out = json.load(open(tmp_path / "venues.json"))
    assert out["meta"]["kalshi_fetched_at"] == 4000
    assert [p["meta"]["kalshi_fetched_at"] for p in out["prev"]] == [3000, 2000]   # newest first, two kept
    assert "prev" not in out["prev"][0]
    # the same crawl written twice is one snapshot, not two
    v.write(cfg, log=lambda *_: None)
    assert [p["meta"]["kalshi_fetched_at"] for p in json.load(open(tmp_path / "venues.json"))["prev"]] == [3000, 2000]


# Kalshi taker fee for one contract: round_up_to_cent(0.07 * C * P * (1 - P)), C = 1; multiplier = 1 / (P + fee).
# Hand-computed: P=0.01: 0.07*0.01*0.99 = 0.000693 -> 1c; 1/0.02 = 50. P=0.50: 0.07*0.25 = 0.0175 -> 2c; 1/0.52 = 1.9231.
# P=0.97: 0.07*0.97*0.03 = 0.002037 -> 1c; 1/0.98 = 1.0204. P=0.69: 0.07*0.69*0.31 = 0.014973 -> 2c.
def test_kalshi_fee_rounds_up_to_the_next_cent():
    assert v.kalshi_fee(0.01) == 0.01
    assert v.kalshi_fee(0.50) == 0.02
    assert v.kalshi_fee(0.97) == 0.01
    assert v.kalshi_fee(0.69) == 0.02


def test_kalshi_multiplier_is_one_over_price_plus_fee():
    assert v.kalshi_multiplier(0.01) == 50.0
    assert v.kalshi_multiplier(0.50) == 1.9231
    assert v.kalshi_multiplier(0.97) == 1.0204


def test_kalshi_multiplier_none_without_a_usable_price():
    assert v.kalshi_multiplier(None) is None and v.kalshi_multiplier(0) is None


def test_kalshi_fee_other_prices():
    # P=0.20: 0.07*0.2*0.8 = 0.0112 -> 2c; P=0.10: 0.07*0.1*0.9 = 0.0063 -> 1c (integer-cent maths, no float noise).
    assert v.kalshi_fee(0.20) == 0.02 and v.kalshi_fee(0.10) == 0.01
