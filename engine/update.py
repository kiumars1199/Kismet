"""Incremental update: pull markets that resolved since the last run, plus their prices.

Every newly resolved market is kept (no sampling cap), because recent markets
carry the most weight in the model. Safe to run as often as you like: markets
already stored are skipped, and the lookback window re-checks the last few days
for markets that settled late.
"""
import json
import os
import sys
import time

from pipeline.common import GAMMA, SAMPLE_TAGS, http, jl_write

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "pipeline"))
import fetch_closed  # noqa: E402
import fetch_prices  # noqa: E402


def _ids(path):
    ids = set()
    if os.path.exists(path):
        with open(path) as f:
            for line in f:
                i = line.find('"id": "')
                if i >= 0:
                    ids.add(line[i + 7:line.index('"', i + 7)])
    return ids


def run(cfg, max_pages_per_tag=50, log=print):
    state_p = cfg.path("data", "state.json")
    state = json.load(open(state_p)) if os.path.exists(state_p) else {}
    sample_p = cfg.path("data", "sample.jsonl")
    seen = _ids(sample_p)
    last = state.get("last_update_ts") or (time.time() - 30 * 86400)
    since = time.strftime("%Y-%m-%dT%H:%M:%SZ",
                          time.gmtime(last - cfg.update_lookback_days * 86400))
    now_s = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    new = []
    for tag in SAMPLE_TAGS:
        for page in range(max_pages_per_tag):
            evs = http("GET", f"{GAMMA}/events", params=dict(
                limit=100, offset=page * 100, closed="true", order="endDate", ascending="false",
                end_date_min=since, end_date_max=now_s, tag_slug=tag))
            for e in evs:
                new += fetch_closed.market_rows(e, seen)
            if len(evs) < 100:
                break
    log(f"new resolved markets since {since}: {len(new)}")
    if new:
        jl_write(sample_p, new)
        added = 0
        for i in range(0, len(new), 20):
            try:
                added += fetch_prices.work(new[i:i + 20])
            except Exception as ex:  # noqa: BLE001
                log(f"price batch failed (will retry next run): {ex}")
        log(f"new snapshots: {added}")
    state.update(last_update_ts=time.time(), last_new_markets=len(new))
    json.dump(state, open(state_p, "w"))
    return len(new)
