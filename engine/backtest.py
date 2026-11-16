"""Walk-forward backtest: the honest test of whether flags make money.

For each fold (a week, newest folds last): fit the model ONLY on markets that
resolved before the fold started, flag bets inside the fold with the exact
live rule, and score what those flags actually returned. Repeated for several
recency half-lives so the engine can pick how fast old data should fade.

pnl per $1-payout share, taker:  won - price - fee - slippage
pnl per share, maker (limit):    won - price          (assumes the order fills)
"""
import json
import math

import numpy as np

from .model import Model, DAY


def slippage(cfg, b):
    """Per-bet taker cost above mid: half the LIVE median spread for that niche and
    market type (output/spreads.json, written by every scan), never below the config floor."""
    import os
    slip = np.full(b.n, float(cfg.taker_slippage))
    p = cfg.path("output", "spreads.json")
    if not os.path.exists(p):
        return slip
    sp = json.load(open(p))
    for ni, niche in enumerate(b.vocab["niche"]):
        for ti, mt in enumerate(b.vocab["mt"]):
            s = sp.get(f"{niche}|{mt}")
            if s:
                sel = (b.niche == ni) & (b.mt == ti)
                slip[sel] = max(cfg.taker_slippage, s["median"] / 2)
    return slip


def flag_mask(cfg, b, q, lo, maker=False, tight=False):
    fee = 0 if maker else b.fee_rate * b.p * (1 - b.p)
    slip = 0 if maker else (cfg.taker_slippage if tight else slippage(cfg, b))
    cost = b.p + fee + slip
    ok = (b.p >= cfg.price_min) & (b.p < cfg.price_max) & ~np.isnan(q)
    return ok & (q - cost >= cfg.flag_min_edge) & (lo - cost > 0), cost


def clustered_t(pnl, ev):
    if len(pnl) < 2:
        return 0.0
    r = pnl - pnl.mean()
    S = np.bincount(ev, weights=r)
    se = math.sqrt((S ** 2).sum()) / len(pnl)
    return float(pnl.mean() / se) if se > 0 else 0.0


def score(b, mask, cost):
    pnl = b.y[mask] - cost[mask]
    n = int(mask.sum())
    if n == 0:
        return dict(flags=0)
    return dict(flags=n, events=int(len(np.unique(b.ev[mask]))),
                win_rate=round(float(b.y[mask].mean()), 4),
                avg_price=round(float(b.p[mask].mean()), 4),
                pnl_cents_per_share=round(float(pnl.mean() * 100), 2),
                roi_pct=round(float(pnl.sum() / cost[mask].sum() * 100), 2),
                t_stat=round(clustered_t(pnl, b.ev[mask]), 2))


def run(cfg, b, half_lives=None, log=print):
    half_lives = half_lives if half_lives is not None else cfg.half_life_grid
    wf = cfg.walk_forward
    end = b.ts.max() - cfg.settle_days * DAY
    starts = [end - (i + 1) * wf["test_days"] * DAY for i in reversed(range(wf["folds"]))]
    results = {}
    for hl in half_lives:
        allm, allc, allmk, allmc, test_idx = [], [], [], [], []
        allt, alltc = [], []
        fold_rows = []
        for s in starts:
            train = b.ts < s
            test = (b.ts >= s) & (b.ts < s + wf["test_days"] * DAY)
            if train.sum() < 1000 or test.sum() == 0:
                continue
            m = Model(cfg, b.vocab, hl).fit(b.take(train), asof=s)
            tb = b.take(test)
            q, lo, _ = m.predict_bets(tb)
            fm, cost = flag_mask(cfg, tb, q, lo)
            mm, mcost = flag_mask(cfg, tb, q, lo, maker=True)
            tm, tcost = flag_mask(cfg, tb, q, lo, tight=True)
            allt.append(tm); alltc.append(tcost)
            fold_rows.append(dict(start=int(s), **score(tb, fm, cost)))
            allm.append(fm); allc.append(cost); allmk.append(mm); allmc.append(mcost)
            test_idx.append(np.where(test)[0])
        if not test_idx:
            continue
        idx = np.concatenate(test_idx)
        tb = b.take(idx)
        fm, cost = np.concatenate(allm), np.concatenate(allc)
        mm, mcost = np.concatenate(allmk), np.concatenate(allmc)
        tm, tcost = np.concatenate(allt), np.concatenate(alltc)
        by_cat_tight = {c: score(tb, tm & (tb.cat == ci), tcost)
                        for ci, c in enumerate(b.vocab["cat"]) if (tm & (tb.cat == ci)).any()}
        by_cat = {}
        for ci, c in enumerate(b.vocab["cat"]):
            sel = fm & (tb.cat == ci)
            if sel.any():
                by_cat[c] = score(tb, sel, cost)
        by_h = {int(h): score(tb, fm & (tb.h == h), cost) for h in np.unique(tb.h)}
        base = np.ones(tb.n, bool) & (tb.p >= cfg.price_min) & (tb.p < cfg.price_max)
        results[str(hl)] = dict(
            half_life_days=hl, taker=score(tb, fm, cost), maker=score(tb, mm, mcost),
            taker_tight_spread=score(tb, tm, tcost), by_category_tight_spread=by_cat_tight,
            baseline_all_bets_taker=score(tb, base, cost), by_category=by_cat,
            by_horizon=by_h, folds=fold_rows)
        t = results[str(hl)]["taker"]
        log(f"half-life {hl}: taker flags={t.get('flags')} pnl={t.get('pnl_cents_per_share')}c "
            f"roi={t.get('roi_pct')}% t={t.get('t_stat')}")
    return dict(test_days=wf["test_days"], folds=len(starts), results=results)


def pick_half_life(bt, min_flags=300):
    """Best risk-adjusted taker result: highest t-stat among runs with enough flags."""
    best, best_t, found = None, -1e9, False
    for k, r in bt["results"].items():
        t = r["taker"]
        if t.get("flags", 0) >= min_flags and t["t_stat"] > best_t:
            best, best_t, found = r["half_life_days"], t["t_stat"], True
    return found, best  # best=None is valid: "no decay" won
