"""F3 (fix): every open Polymarket market, searchable. The scan (engine/scan.py) only keeps the markets the model can
price (two outcomes, a live bid and ask, closing 0.5 h to 10 days out, <= 500 events per tag), about 14-16K of about 143K
open ones. This writes output/polymarket_index.json: one light row per OPEN, order-accepting, two-outcome market, for
search and topic filters on /markets. Rows have no price and no model chance: the web shows them as "Not priced yet",
never as flags or Best bets, and never as a live price (so no Free-tier delay can be bypassed).

Source: Polymarket Gamma API GET /events/keyset?closed=false&active=true&limit=100 (cursor paging; offset paging stops at
about 2000 events: "offset too large, use /events/keyset", checked 2026-11-23). Whole crawl is ~165 requests.
A crawl that does not finish keeps the previous file (never a partial index)."""
import json
import os
import time

from pipeline.common import GAMMA, classify, http, parse_ts
from .jsonio import dump_atomic

COLUMNS = ("id", "question", "event", "slug", "category", "niche", "tags", "volume", "close_epoch")
MAX_AGE_S = 55 * 60      # the scheduler calls this every scan; a younger file is kept
BUDGET_S = 240
MAX_PAGES = 400


def rows_of(event):
    """Index rows of one Gamma event: its open, order-accepting, two-outcome markets."""
    tags = [t.get("slug") for t in (event.get("tags") or []) if t.get("slug")]
    cat, niche = classify(tags)
    out = []
    for m in event.get("markets") or []:
        if m.get("closed") or not m.get("acceptingOrders") or not m.get("id"):
            continue
        try:
            outs = json.loads(m.get("outcomes") or "[]")
        except ValueError:
            continue
        if len(outs) != 2:
            continue
        end = parse_ts(m.get("endDate")) or parse_ts(m.get("gameStartTime"))
        out.append([str(m["id"]), m.get("question") or "", event.get("title") or "", event.get("slug") or "", cat, niche,
                    tags, int(float(m.get("volumeNum") or 0)), int(end) if end else None])
    return out


def crawl(fetch=None, budget=BUDGET_S, now=time.time):
    """-> (rows, complete). fetch(cursor) -> {"events": [...], "next_cursor": str|None}."""
    fetch = fetch or (lambda cur: http("GET", f"{GAMMA}/events/keyset", params={"limit": 100, "closed": "false", "active": "true", **({"after_cursor": cur} if cur else {})}))
    t0, cur, seen, rows = now(), None, set(), []
    for _ in range(MAX_PAGES):
        d = fetch(cur)
        for e in d.get("events") or []:
            for r in rows_of(e):
                if r[0] not in seen:
                    seen.add(r[0])
                    rows.append(r)
        cur = d.get("next_cursor")
        if not cur or not d.get("events"):
            return rows, True
        if now() - t0 > budget:
            return rows, False
    return rows, False


def run(cfg, log=print, fetch=None, now=time.time):
    path = cfg.path("output", "polymarket_index.json")
    try:
        if now() - os.path.getmtime(path) < MAX_AGE_S:
            log("polymarket index: fresh enough, kept")
            return False
    except OSError:
        pass
    try:
        rows, complete = crawl(fetch, now=now)
    except Exception as e:  # noqa: BLE001 - optional side file: the scan has already published
        log(f"polymarket index: skipped ({e}); previous file kept")
        return False
    if not complete or not rows:
        log(f"polymarket index: crawl incomplete ({len(rows)} rows); previous file kept")
        return False
    dump_atomic(path, {"meta": {"source": "Polymarket", "fetched_at": int(now()), "n": len(rows), "columns": list(COLUMNS)},
                       "rows": rows}, separators=(",", ":"))
    log(f"polymarket index: {len(rows)} open markets")
    return True
