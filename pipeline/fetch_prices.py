"""Step 2: sample liquid markets and record the price N hours before resolution.

Reads data/markets.jsonl, writes data/sample.jsonl and data/snapshots.jsonl.
Snapshots only ever use a price observed AT OR BEFORE (resolution - N hours),
so no future information leaks in. Resumable: rerun to continue.
Usage: python pipeline/fetch_prices.py [--min-volume 0] [--per-niche 3000] [--threads 4]
"""
import argparse
import json
import os
import random
import sys
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed

sys.path.insert(0, os.path.dirname(__file__))
from common import CLOB, HORIZONS_H, http, jl_read, jl_write  # noqa: E402

D = os.path.join(os.path.dirname(__file__), "..", "data")
MARKETS, SAMPLE, SNAPS, DONE = (os.path.join(D, f) for f in
                                ("markets.jsonl", "sample.jsonl", "snapshots.jsonl", "done.txt"))
lock = threading.Lock()


def make_sample(min_vol, per_niche, seed=7):
    if os.path.exists(SAMPLE):
        return jl_read(SAMPLE)
    rows = [r for r in jl_read(MARKETS) if r["volume"] >= min_vol]
    by = {}
    for r in rows:
        by.setdefault(r["niche"], []).append(r)
    rnd = random.Random(seed)
    out = []
    for niche, rs in by.items():
        rnd.shuffle(rs)
        out += rs[:per_niche]
    with open(SAMPLE, "w") as f:
        for r in out:
            f.write(json.dumps(r) + "\n")
    return out


def history(tokens, fidelity):
    d = http("POST", f"{CLOB}/batch-prices-history",
             json=dict(markets=tokens, interval="max", fidelity=fidelity))
    return d.get("history") or {}


def snapshot(pts, m):
    out = []
    pts = sorted(pts, key=lambda x: x["t"])
    for h in HORIZONS_H:
        target = m["ref_ts"] - h * 3600
        tol = max(1800, min(0.5 * h * 3600, 13 * 3600))
        best = None
        for p in pts:
            if p["t"] <= target:
                best = p
            else:
                break
        if not best or target - best["t"] > tol or best["t"] < m["start_ts"]:
            continue
        # require the market to have actually traded before the snapshot
        if len({p["p"] for p in pts if p["t"] <= target}) < 3:
            continue
        price = float(best["p"])
        if 0 < price < 1:
            out.append(dict(id=m["id"], h=h, p=price, lag=int(target - best["t"])))
    return out


def work(batch):
    toks = [m["tokens"][0] for m in batch]
    hist = history(toks, 60)
    missing = [m for m in batch if not hist.get(m["tokens"][0])]
    if missing:
        hist.update(history([m["tokens"][0] for m in missing], 720))
    snaps = []
    for m in batch:
        snaps += snapshot(hist.get(m["tokens"][0]) or [], m)
    with lock:
        jl_write(SNAPS, snaps)
        with open(DONE, "a") as f:
            f.write("\n".join(m["id"] for m in batch) + "\n")
    return len(snaps)


def fetch_pending(sample, threads=4, log=print):
    """Fetch snapshots for every market in `sample` not yet in done.txt (newest first)."""
    done = set()
    if os.path.exists(DONE):
        done = set(open(DONE).read().split())
    # newest first: recent markets matter most, and a partial run still has them
    todo = sorted((m for m in sample if m["id"] not in done), key=lambda m: -m["ref_ts"])
    log(f"sample={len(sample)} remaining={len(todo)}")
    batches = [todo[i:i + 20] for i in range(0, len(todo), 20)]
    n = 0
    with ThreadPoolExecutor(threads) as ex:
        futs = [ex.submit(work, b) for b in batches]
        for i, f in enumerate(as_completed(futs)):
            try:
                n += f.result()
            except Exception as e:  # keep going; failed batches retry on rerun
                log(f"batch error: {e}")
            if i % 100 == 0:
                log(f"batches {i}/{len(batches)} snapshots+={n}")
    log(f"done, snapshots added: {n}")
    return n


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--min-volume", type=float, default=0)  # keep 0: final volume leaks the outcome
    ap.add_argument("--per-niche", type=int, default=3000)
    ap.add_argument("--threads", type=int, default=4)
    a = ap.parse_args()
    fetch_pending(make_sample(a.min_volume, a.per_niche), a.threads,
                  log=lambda s: print(s, flush=True))


if __name__ == "__main__":
    main()
