"""Score every open Polymarket market with the fitted model.

Outputs (all in output/, read by the UI):
  markets.json  every scanned market: both sides, model win prob, edge at the current ask
  flags.json    the subset that passes the flag rule (edge >= min AND confident)
  spreads.json  live bid/ask spread by segment, used by the backtest as real trading cost
"""
import json
import math
import time
from collections import defaultdict

import numpy as np

from pipeline.common import GAMMA, SAMPLE_TAGS, classify, http, parse_ts, taker_fee
from .dataset import HORIZONS, market_type
from .model import Model


def nearest_h(hours):
    if hours < 0.5 or hours > 240:
        return None
    return min(HORIZONS, key=lambda h: abs(math.log(hours) - math.log(h)))


def fetch_open(cfg, log=print):
    seen, out = set(), []
    for tag in SAMPLE_TAGS:
        for off in range(0, cfg.scan_events_per_tag, 100):
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
                    out.append((e, m, cat, niche, tags))
            if len(evs) < 100:
                break
    log(f"open markets fetched: {len(out)}")
    return out


def run(cfg, log=print):
    d = json.load(open(cfg.path("output", "model.json")))
    model = Model.from_json(cfg, d)
    V = model.vocab
    now = time.time()
    rows, spreads = [], defaultdict(list)
    # category track record from the latest walk-forward test (if one has run)
    record, hrecord = {}, {}
    try:
        bt = json.load(open(cfg.path("output", "backtest.json")))
        r = bt["results"].get(str(bt.get("chosen_half_life_days")))
        if r:
            for c, sc in r["by_category"].items():
                record[c] = dict(flags=sc.get("flags", 0), pnl_cents=sc.get("pnl_cents_per_share"),
                                 t=sc.get("t_stat", 0))
            for h, sc in r["by_horizon"].items():
                hrecord[int(h)] = dict(flags=sc.get("flags", 0), pnl_cents=sc.get("pnl_cents_per_share"),
                                       t=sc.get("t_stat", 0))
    except (FileNotFoundError, KeyError, ValueError):
        pass
    for e, m, cat, niche, tags in fetch_open(cfg, log):
        outs = json.loads(m.get("outcomes") or "[]")
        bid, ask = m.get("bestBid"), m.get("bestAsk")
        refs = [parse_ts(m.get(k)) for k in ("endDate", "gameStartTime")]
        refs = [r for r in refs if r]
        if len(outs) != 2 or bid is None or ask is None or not refs:
            continue
        bid, ask = float(bid), float(ask)
        if not (0 < bid < ask < 1):
            continue
        mt = market_type(cat, m.get("sportsMarketType"), m.get("negRisk"))
        hours = (min(refs) - now) / 3600
        h = nearest_h(hours)
        mid = (bid + ask) / 2
        spreads[(niche, mt)].append(ask - bid)
        if h is None or cat not in V["cat"] or niche not in V["niche"] or mt not in V["mt"]:
            continue
        c, n, t = V["cat"].index(cat), V["niche"].index(niche), V["mt"].index(mt)
        sides = []
        for side, price, smid in ((0, ask, mid), (1, 1 - bid, 1 - mid)):
            r = model.predict(smid, h, c, n, t)
            if r is None:
                continue
            q, lo, key, nd = float(r[0][0]), float(r[1][0]), r[2], r[3]
            fee = taker_fee(cat, price)
            cost = price + fee
            sides.append(dict(
                outcome=outs[side], ask=round(price, 4), mid=round(smid, 4), fee=round(fee, 4),
                win_prob=round(q, 4), win_prob_low=round(lo, 4),
                edge=round(q - cost, 4), edge_low=round(lo - cost, 4),
                roi_pct=round((q - cost) / cost * 100, 2),
                model_level=key[0], model_neff=round(nd["neff"], 1), model_events=nd["events"]))
        if not sides:
            continue
        best = max(sides, key=lambda s: s["edge"])
        rows.append(dict(
            id=m["id"], question=m.get("question"), event=e.get("title"), event_id=e.get("id"),
            url=f"https://polymarket.com/event/{e.get('slug')}", category=cat, niche=niche,
            market_type=mt, tags=tags, hours_to_close=round(hours, 2), horizon_h=h,
            closes_at=int(min(refs)), volume=round(float(m.get("volumeNum") or 0), 2),
            backtest=record.get(cat),
            # "validated": this category's flags made money in the walk-forward test
            # and flags at this time-to-close did too
            validated=all(bool(rec and rec["flags"] >= 100 and (rec["pnl_cents"] or 0) > 0
                               and (rec["t"] or 0) >= 2)
                          for rec in (record.get(cat), hrecord.get(h))),
            liquidity=round(float(m.get("liquidityNum") or 0), 2), spread=round(ask - bid, 4),
            sides=sides, best=best))

    def is_flag(r):
        s = r["best"]
        return (cfg.price_min <= s["mid"] < cfg.price_max and abs(s["mid"] - 0.5) >= 0.005
                and s["edge"] >= cfg.flag_min_edge and s["edge_low"] > 0
                and (r["validated"] or not record))

    flags = sorted([r for r in rows if is_flag(r)], key=lambda r: -r["best"]["edge"])
    meta = dict(instance=cfg.instance, platform=cfg.platform, scanned_at=int(now),
                model_half_life_days=model.hl, markets_scanned=len(rows), flags=len(flags),
                rule=dict(min_edge=cfg.flag_min_edge, confidence_z=cfg.flag_confidence_z,
                          price_range=[cfg.price_min, cfg.price_max]))
    json.dump(dict(meta=meta, markets=rows), open(cfg.path("output", "markets.json"), "w"))
    json.dump(dict(meta=meta, flags=flags), open(cfg.path("output", "flags.json"), "w"), indent=1)
    sp = {f"{k[0]}|{k[1]}": dict(n=len(v), median=round(float(np.median(v)), 4),
                                  p75=round(float(np.percentile(v, 75)), 4))
          for k, v in spreads.items() if len(v) >= 5}
    json.dump(sp, open(cfg.path("output", "spreads.json"), "w"), indent=1)
    log(f"scanned {len(rows)} markets, {len(flags)} flags")
    return meta
