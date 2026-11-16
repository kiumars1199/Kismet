"""Step 1: pull resolved binary markets from Polymarket, sampled by category tag.

Writes data/markets.jsonl (one row per resolved binary market).
Usage: python pipeline/fetch_closed.py [--days 365] [--per-tag 1500]
"""
import argparse
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(__file__))
from common import GAMMA, SAMPLE_TAGS, classify, http, parse_ts  # noqa: E402

OUT = os.path.join(os.path.dirname(__file__), "..", "data", "markets.jsonl")


def resolved_yes(m):
    try:
        prices = [float(x) for x in json.loads(m.get("outcomePrices") or "[]")]
    except (ValueError, TypeError):
        return None
    if len(prices) != 2:
        return None
    if prices[0] >= 0.99 and prices[1] <= 0.01:
        return 1
    if prices[1] >= 0.99 and prices[0] <= 0.01:
        return 0
    return None  # 50-50 or unresolved


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=365)
    ap.add_argument("--per-tag", type=int, default=2000)
    # Order by end date, NOT volume: final volume is partly caused by the outcome
    # (upsets attract trading), so ranking by it biases the sample toward longshot wins.
    ap.add_argument("--order", default="endDate")
    a = ap.parse_args()
    since = time.strftime("%Y-%m-%dT00:00:00Z", time.gmtime(time.time() - a.days * 86400))

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    seen, rows = set(), []
    for tag in SAMPLE_TAGS:
        n_ev = 0
        for off in range(0, a.per_tag, 100):
            evs = http("GET", f"{GAMMA}/events", params=dict(
                limit=100, offset=off, closed="true", order=a.order, ascending="false",
                end_date_min=since, end_date_max=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), tag_slug=tag))
            if not evs:
                break
            for e in evs:
                n_ev += 1
                tags = [t.get("slug") for t in (e.get("tags") or []) if t.get("slug")]
                cat, niche = classify(tags)
                for m in e.get("markets") or []:
                    if m.get("id") in seen:
                        continue
                    y = resolved_yes(m)
                    toks = json.loads(m.get("clobTokenIds") or "[]")
                    outs = json.loads(m.get("outcomes") or "[]")
                    if y is None or len(toks) != 2:
                        continue
                    refs = [parse_ts(m.get(k)) for k in ("closedTime", "endDate", "gameStartTime")]
                    refs = [r for r in refs if r]
                    start = parse_ts(m.get("startDate")) or parse_ts(m.get("createdAt"))
                    if not refs or not start:
                        continue
                    ref = min(refs)
                    if ref - start < 3600:
                        continue
                    seen.add(m["id"])
                    rows.append(dict(
                        id=m["id"], question=m.get("question"), event=e.get("title"),
                        event_id=e.get("id"), slug=e.get("slug"), category=cat, niche=niche,
                        tags=tags, outcomes=outs, tokens=toks, yes_won=y, ref_ts=ref,
                        start_ts=start, volume=float(m.get("volumeNum") or m.get("volume") or 0),
                        neg_risk=bool(m.get("negRisk")), market_type=m.get("sportsMarketType"),
                    ))
            if len(evs) < 100:
                break
        print(f"{tag:12s} events={n_ev:5d} markets_total={len(rows)}", flush=True)

    with open(OUT, "w") as f:
        for r in rows:
            f.write(json.dumps(r) + "\n")
    print("wrote", len(rows), "markets ->", OUT)


if __name__ == "__main__":
    main()
