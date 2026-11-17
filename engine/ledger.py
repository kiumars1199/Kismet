"""Flag ledger (F-29): the live forward track record.

output/ledger.jsonl   one row per flag, appended by every scan: the first time a
                      market/side is flagged, and again whenever it is re-flagged at a
                      lower (better) ask. Rows without `result` are open.
python -m engine grade
                      for open rows whose market has resolved (Gamma /markets/{id}):
                      result, pnl = (won ? 1 : 0) - ask - fee, closing price and CLV.
                      Rewrites ledger.jsonl and writes output/ledger_summary.json.

Closing price = last CLOB trade price of the flagged side at or before (close - 1 h),
close = min(closedTime, endDate, gameStartTime) as in pipeline/fetch_closed.py, so
sports close at kickoff and the 1 h gap keeps the settled outcome out of the price.
clv = closing_price - ask (positive = the market moved toward the flag).
"""
import json
import os
import time

from pipeline.common import CLOB, GAMMA, http, jl_read, jl_write, parse_ts
from pipeline.fetch_closed import resolved_yes


def _path(cfg):
    return cfg.path("output", "ledger.jsonl")


def append(cfg, flags, now):
    """Append new flags and re-flags at a better ask. Returns rows added."""
    p = _path(cfg)
    best_ask = {}
    for e in jl_read(p):
        k = (e["id"], e["side_index"])
        best_ask[k] = min(best_ask.get(k, 2.0), e["ask"])
    new = []
    for r in flags:
        s = r["best"]
        k = (r["id"], s["side_index"])
        if s["ask"] >= best_ask.get(k, 2.0):
            continue
        best_ask[k] = s["ask"]
        toks = r.get("tokens") or []
        new.append(dict(
            id=r["id"], side_index=s["side_index"], outcome=s["outcome"], question=r["question"],
            category=r["category"], niche=r["niche"], ask=s["ask"], fee=s["fee"],
            win_prob=s["win_prob"], edge=s["edge"], verdict=r["execution"]["verdict"],
            flagged_at=int(now), closes_at=r["closes_at"],
            token=toks[s["side_index"]] if len(toks) == 2 else None))
    jl_write(p, new)
    return len(new)


def closing_price(m, pts):
    refs = [r for r in (parse_ts(m.get(k)) for k in ("closedTime", "endDate", "gameStartTime")) if r]
    if not refs:
        return None
    cut = min(refs) - 3600
    before = [x for x in pts if x["t"] <= cut]
    return float(max(before, key=lambda x: x["t"])["p"]) if before else None


def get_market(mid):
    return http("GET", f"{GAMMA}/markets/{mid}")


def get_history(token):
    d = http("POST", f"{CLOB}/batch-prices-history",
             json=dict(markets=[token], interval="max", fidelity=60))
    return (d.get("history") or {}).get(token) or []


def summarize(entries, now):
    def agg(es):
        g = [e for e in es if "result" in e]
        clv = [e["clv"] for e in g if e.get("clv") is not None]
        return dict(entries=len(es), graded=len(g),
                    wins=sum(e["result"] == "won" for e in g),
                    losses=sum(e["result"] == "lost" for e in g),
                    avg_pnl=round(sum(e["pnl"] for e in g) / len(g), 4) if g else None,
                    avg_clv=round(sum(clv) / len(clv), 4) if clv else None)
    out = agg(entries)
    out["by_category"] = {c: agg([e for e in entries if e["category"] == c])
                          for c in sorted({e["category"] for e in entries})}
    out["updated_at"] = int(now)
    return out


def grade(cfg, get_market=get_market, get_history=get_history, now=None, log=print):
    now = time.time() if now is None else now
    p = _path(cfg)
    entries = jl_read(p)
    markets, graded = {}, 0
    for e in entries:
        if "result" in e:
            continue
        if e["id"] not in markets:
            try:
                markets[e["id"]] = get_market(e["id"])
            except RuntimeError as err:  # keep going; retried next run
                log(f"grade: {e['id']}: {err}")
                markets[e["id"]] = None
        m = markets[e["id"]]
        # ponytail: 50-50 / disputed resolutions stay open forever; add a "void" result if they show up
        y = resolved_yes(m) if m and m.get("closed") else None
        if y is None:
            continue
        won = (y == 1) if e["side_index"] == 0 else (y == 0)
        cp = None
        if e.get("token"):
            try:
                cp = closing_price(m, get_history(e["token"]))
            except RuntimeError:
                pass
        e.update(result="won" if won else "lost", pnl=round(int(won) - e["ask"] - e["fee"], 4),
                 closing_price=cp, clv=round(cp - e["ask"], 4) if cp is not None else None,
                 graded_at=int(now))
        graded += 1
    tmp = p + ".tmp"
    with open(tmp, "w") as f:
        for e in entries:
            f.write(json.dumps(e) + "\n")
    os.replace(tmp, p)
    s = summarize(entries, now)
    json.dump(s, open(cfg.path("output", "ledger_summary.json"), "w"), indent=1)
    log(f"ledger: graded {graded} now, {s['graded']}/{s['entries']} graded in total")
    return s
