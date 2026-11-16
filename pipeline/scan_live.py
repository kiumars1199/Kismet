"""Step 4: score open Polymarket markets against the win-rate table.

For each open binary market and each side, finds the closest matching group
in output/edges.json (most specific first: niche+type -> niche -> category -> all),
then computes edge at the CURRENT ask price:
    edge = group win rate - ask - taker fee
Writes output/live_flags.json. Run on a schedule (every few minutes) in production.
Usage: python pipeline/scan_live.py [--per-tag 300] [--min-edge 0.02] [--min-t 2]
"""
import argparse
import json
import math
import os
import sys
import time

sys.path.insert(0, os.path.dirname(__file__))
from common import GAMMA, SAMPLE_TAGS, classify, http, parse_ts, taker_fee  # noqa: E402
from build_table import BAND, P_MAX, P_MIN, mtype  # noqa: E402

ROOT = os.path.join(os.path.dirname(__file__), "..")
O = os.path.join(ROOT, "output")


def load_groups():
    t = json.load(open(os.path.join(O, "edges.json")))
    idx = {}
    for g in t["groups"]:
        idx[(g["scope"], g["key"], g["market_type"], g["horizon_h"], g["band_lo"])] = g
    return idx, t["horizons_h"]


def nearest_h(hours, hs):
    if hours < 0.5 or hours > 240:
        return None
    return min(hs, key=lambda h: abs(math.log(hours) - math.log(h)))


def lookup(idx, cat, niche, mt, h, b):
    for scope, key, t in (("niche+type", niche, mt), ("niche", niche, "all"),
                          ("category", cat, "all"), ("all", "all", "all")):
        g = idx.get((scope, key, t, h, b))
        if g:
            return g
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--per-tag", type=int, default=300)
    ap.add_argument("--min-edge", type=float, default=0.02)
    ap.add_argument("--min-t", type=float, default=2.0, help="group must be statistically solid")
    a = ap.parse_args()
    idx, hs = load_groups()
    now = time.time()
    seen, flags, scanned = set(), [], 0
    for tag in SAMPLE_TAGS:
        for off in range(0, a.per_tag, 100):
            evs = http("GET", f"{GAMMA}/events", params=dict(
                limit=100, offset=off, closed="false", active="true", order="volume",
                ascending="false", tag_slug=tag))
            for e in evs:
                tags = [t.get("slug") for t in (e.get("tags") or []) if t.get("slug")]
                cat, niche = classify(tags)
                for m in e.get("markets") or []:
                    if m.get("id") in seen or m.get("closed") or not m.get("acceptingOrders"):
                        continue
                    seen.add(m["id"])
                    outs = json.loads(m.get("outcomes") or "[]")
                    bid, ask = m.get("bestBid"), m.get("bestAsk")
                    refs = [parse_ts(m.get(k)) for k in ("endDate", "gameStartTime")]
                    refs = [r for r in refs if r]
                    if len(outs) != 2 or bid is None or ask is None or not refs:
                        continue
                    hours = (min(refs) - now) / 3600
                    h = nearest_h(hours, hs)
                    if h is None:
                        continue
                    scanned += 1
                    info = dict(id=m["id"], question=m.get("question"), event=e.get("title"),
                                slug=e.get("slug"), category=cat, niche=niche, market_type=None,
                                hours_to_close=round(hours, 1), volume=float(m.get("volumeNum") or 0),
                                liquidity=float(m.get("liquidityNum") or 0))
                    info["market_type"] = mtype(dict(category=cat, market_type=m.get("sportsMarketType"),
                                                     neg_risk=m.get("negRisk")))
                    mid = (float(bid) + float(ask)) / 2
                    if abs(mid - 0.5) < 0.005:
                        continue  # dead coin flip: no favorite side to bet
                    # Group is chosen by MID price (what the backtest measured);
                    # edge is charged at the ASK (what you actually pay).
                    for side, price, smid in ((0, float(ask), mid), (1, 1 - float(bid), 1 - mid)):
                        if not (P_MIN <= smid < P_MAX) or not (0 < price < 1):
                            continue
                        b = round(min(int(smid / BAND), int(1 / BAND) - 1) * BAND, 2)
                        g = lookup(idx, cat, niche, info["market_type"], h, b)
                        if not g:
                            continue
                        fee = taker_fee(cat, price)
                        edge = g["win_rate"] - price - fee
                        # flag only if: edge clears fees now, group is solid on all data,
                        # and the group also made money on the held-out (newest) period
                        if (edge <= a.min_edge or g["t_taker"] < a.min_t
                                or (g["held_out_edge_taker"] or 0) <= 0):
                            continue
                        flags.append(dict(info, side=outs[side], price=round(price, 3), mid=round(smid, 3),
                                          fee=round(fee, 4), group_win_rate=g["win_rate"],
                                          edge=round(edge, 4), group_scope=g["scope"],
                                          group_key=g["key"], group_n=g["n"], group_events=g["events"],
                                          group_held_out_edge=g["held_out_edge_taker"], group_t=g["t_taker"], horizon_h=h,
                                          url=f"https://polymarket.com/event/{e.get('slug')}"))
            if len(evs) < 100:
                break
    flags.sort(key=lambda f: -f["edge"])
    with open(os.path.join(O, "live_flags.json"), "w") as f:
        json.dump(dict(scanned_at=int(now), markets_scanned=scanned, flags=flags), f, indent=1)
    print(f"scanned {scanned} markets, {len(flags)} flags -> output/live_flags.json")


if __name__ == "__main__":
    main()
