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
    assert k["price"] == 0.6 and k["multiplier"] == v.kalshi_multiplier(0.6) and k["url"] == "https://kalshi.com/markets/kxnflgame"
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


# Kalshi taker fee, worked for ONE fixed reference order (the same for everyone): a $100 stake, C = floor(100 / P) contracts,
# fee_total = round_up_to_cent(0.07 * C * P * (1 - P)), per contract = fee_total / C, multiplier = 1 / (P + per-contract fee).
# Hand-computed:
#  P=0.01: C = 10000, 0.07*10000*0.01*0.99 = 6.93 -> $6.93 ; 0.000693 per contract ; 1/0.010693 = 93.5191
#  P=0.05: C = 2000,  0.07*2000*0.05*0.95  = 6.65  -> $6.65 ; 0.003325 per contract ; 1/0.053325 = 18.7529
#  P=0.50: C = 200,   0.07*200*0.5*0.5     = 3.50  -> $3.50 ; 0.0175 per contract ; 1/0.5175  = 1.9324
#  P=0.97: C = 103,   0.07*103*0.97*0.03   = 0.2098 -> $0.21 ; 0.21/103 per contract ; 1/(0.97 + 0.21/103) = 1.0288
def test_kalshi_reference_order_contracts_and_total_fee():
    assert v.kalshi_contracts(0.01) == 10000 and v.kalshi_contracts(0.05) == 2000
    assert v.kalshi_contracts(0.50) == 200 and v.kalshi_contracts(0.97) == 103
    assert v.kalshi_fee_total(0.01) == 6.93
    assert v.kalshi_fee_total(0.05) == 6.65
    assert v.kalshi_fee_total(0.50) == 3.5
    assert v.kalshi_fee_total(0.97) == 0.21
    assert v.kalshi_fee_total(0.76) == 1.68   # C = 131: 0.07*131*0.76*0.24 = 1.6727 rounds UP to the cent


def test_kalshi_multiplier_uses_the_per_contract_fee_of_the_100_dollar_order():
    assert v.kalshi_multiplier(0.01) == 93.5191
    assert v.kalshi_multiplier(0.05) == 18.7529
    assert v.kalshi_multiplier(0.50) == 1.9324
    assert v.kalshi_multiplier(0.97) == 1.0288


def test_kalshi_longshots_are_not_inflated_by_one_contract_rounding():
    # The old one-contract maths (fee rounded up to a whole cent per contract) gave 50x at 1% and 16.67x at 5%.
    assert v.kalshi_multiplier(0.01) > 90 and v.kalshi_multiplier(0.05) > 18.5


def test_kalshi_multiplier_none_without_a_usable_price():
    assert v.kalshi_multiplier(None) is None and v.kalshi_multiplier(0) is None and v.kalshi_multiplier(1.0) is not None
