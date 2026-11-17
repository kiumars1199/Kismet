"""Step 1: pull resolved binary markets from Polymarket, sampled by category tag.

Writes data/markets.jsonl (one row per resolved binary market).
Usage: python pipeline/fetch_closed.py [--days 365] [--per-tag 1500]

Backfill mode (--window-days N): walks back in N-day end-date windows, newest first, so a
long history is sampled evenly over time instead of only the newest `per-tag` events.
Resumable: rows are appended to markets.jsonl as each (window, tag) finishes, and finished
windows are checkpointed in data/fetch_closed_state.json. Rerun the same command to continue.
  python pipeline/fetch_closed.py --days 730 --window-days 7 --per-window 300
"""
import argparse
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(__file__))
from common import GAMMA, SAMPLE_TAGS, classify, http, jl_write, parse_ts  # noqa: E402

OUT = os.path.join(os.path.dirname(__file__), "..", "data", "markets.jsonl")
STATE = os.path.join(os.path.dirname(__file__), "..", "data", "fetch_closed_state.json")
DAY = 86400


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


def market_rows(e, seen):
    """Resolved binary markets of one Gamma event, as compact rows (skips ids in `seen`)."""
    tags = [t.get("slug") for t in (e.get("tags") or []) if t.get("slug")]
    cat, niche = classify(tags)
    out = []
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
        out.append(dict(
            id=m["id"], question=m.get("question"), event=e.get("title"),
            event_id=e.get("id"), slug=e.get("slug"), category=cat, niche=niche,
            tags=tags, outcomes=outs, tokens=toks, yes_won=y, ref_ts=ref,
            start_ts=start, volume=float(m.get("volumeNum") or m.get("volume") or 0),
            neg_risk=bool(m.get("negRisk")), market_type=m.get("sportsMarketType"),
        ))
    return out


def _iso(ts):
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(ts))


def windows(anchor, days, window_days):
    """(lo, hi) end-date windows from `anchor` back `days` days, newest first."""
    out, hi = [], anchor
    while hi > anchor - days * DAY:
        lo = max(hi - window_days * DAY, anchor - days * DAY)
        out.append((lo, hi))
        hi = lo
    return out


def backfill(days, window_days, per_window, order, out=OUT, state_p=STATE, log=print):
    """Resumable windowed fetch. The window grid is anchored at the first run's midnight
    (stored in the state file) so a rerun on a later day resumes the same windows."""
    st = json.load(open(state_p)) if os.path.exists(state_p) else {}
    st.setdefault("anchor", int(time.time() // DAY * DAY))
    done = set(st.get("done", []))
    seen = set()
    if os.path.exists(out):  # ids already stored: resume without duplicates
        with open(out) as f:
            for line in f:
                i = line.find('"id": "')
                if i >= 0:
                    seen.add(line[i + 7:line.index('"', i + 7)])
    total = len(seen)
    for lo, hi in windows(st["anchor"], days, window_days):
        for tag in SAMPLE_TAGS:
            key = f"{int(lo)}|{tag}"
            if key in done:
                continue
            rows = []
            for off in range(0, per_window, 100):
                evs = http("GET", f"{GAMMA}/events", params=dict(
                    limit=100, offset=off, closed="true", order=order, ascending="false",
                    end_date_min=_iso(lo), end_date_max=_iso(hi), tag_slug=tag))
                if not evs:
                    break
                for e in evs:
                    rows += market_rows(e, seen)
                if len(evs) < 100:
                    break
            jl_write(out, rows)  # rows first, then the checkpoint: a crash repeats, never skips
            total += len(rows)
            done.add(key)
            st["done"] = sorted(done)
            with open(state_p + ".tmp", "w") as f:
                json.dump(st, f)
            os.replace(state_p + ".tmp", state_p)
        log(f"window {_iso(lo)[:10]}..{_iso(hi)[:10]} markets_total={total}")
    log(f"backfill done: {total} markets -> {out}")
    return total


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=365)
    ap.add_argument("--per-tag", type=int, default=2000)
    # Order by end date, NOT volume: final volume is partly caused by the outcome
    # (upsets attract trading), so ranking by it biases the sample toward longshot wins.
    ap.add_argument("--order", default="endDate")
    ap.add_argument("--window-days", type=int, default=0, help="backfill mode (resumable), see top")
    ap.add_argument("--per-window", type=int, default=300, help="events per tag per window")
    a = ap.parse_args()
    if a.window_days:
        os.makedirs(os.path.dirname(OUT), exist_ok=True)
        return backfill(a.days, a.window_days, a.per_window, a.order, log=lambda s: print(s, flush=True))
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
                rows += market_rows(e, seen)
            if len(evs) < 100:
                break
        print(f"{tag:12s} events={n_ev:5d} markets_total={len(rows)}", flush=True)

    with open(OUT, "w") as f:
        for r in rows:
            f.write(json.dumps(r) + "\n")
    print("wrote", len(rows), "markets ->", OUT)


if __name__ == "__main__":
    main()
