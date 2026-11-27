"""F14: per-market price history for the drawer chart (output/history.json).

One series per flag row (the best side's price, Polymarket CLOB `batch-prices-history`, fidelity 60 min), downsampled to at
most MAX_POINTS points and capped at MAX_DAYS days. Columnar to stay small:

    series[<market id>] = { side: 0|1, t0: unix s of the first point, dt: seconds between points (a whole number of
                            hours), p: [price in per-mille, 0..1000, ...] }

Empty buckets carry the previous price forward, so the first and last prices are always the real first and last ones.
`python -m engine history` runs it as its own step after the scan (like `kalshi`), so it never delays best bets. The
previous history.json (data/ copy, else output/) is the cache: a market already held is refreshed with a tail window the CLOB accepts
(<= 14 days) and re-downsampled; a new one fetches everything (interval=max). A failed batch keeps the cached series.
Source: Polymarket only. Basis line in the app: "Prices from Polymarket, every <interval>".
"""
import json
import math
import os
import time

MAX_POINTS = 200
MAX_DAYS = 90
BASE_S = 3600          # fidelity 60 min
BATCH = 20            # markets per request: the CLOB maximum (pipeline.fetch_prices.CLOB_BATCH_MAX = 20); a larger batch is a 400
TAIL_MAX_DAYS = 13     # the CLOB rejects start/end windows over 14 days
BUDGET_S = 240


def downsample(raw, now, max_points=MAX_POINTS, max_days=MAX_DAYS, base=BASE_S):
    """[{t, p}] -> {t0, dt, p} or None. p in per-mille ints; at most max_points points; first and last price are exact."""
    pts = sorted((x for x in raw if now - max_days * 86400 <= x["t"] <= now and 0 <= float(x["p"]) <= 1), key=lambda x: x["t"])
    if not pts:
        return None
    t0, span = pts[0]["t"], pts[-1]["t"] - pts[0]["t"]
    dt = base * max(1, math.ceil(span / (max_points - 1) / base))
    n = int(span // dt) + 1
    out = [None] * n
    for x in pts:
        out[int((x["t"] - t0) // dt)] = round(float(x["p"]) * 1000)
    out[0] = round(float(pts[0]["p"]) * 1000)   # the first bucket shows the first price, not the last in its hour
    last = out[0]
    for i, v in enumerate(out):
        if v is None:
            out[i] = last
        else:
            last = v
    return {"t0": int(t0), "dt": int(dt), "p": out}


def expand(s):
    return [{"t": s["t0"] + i * s["dt"], "p": v / 1000} for i, v in enumerate(s["p"])]


def merge(old, fresh, now):
    """The cached series with its tail replaced by the fresh points, downsampled again."""
    fresh = sorted(fresh, key=lambda x: x["t"])
    if not fresh:
        return old
    kept = [x for x in expand(old) if x["t"] < fresh[0]["t"]] if old else []
    return downsample(kept + fresh, now)


def clob_fetch(tokens, start_ts, end_ts):
    from pipeline.fetch_prices import history   # the CLOB batch call every other job uses
    if start_ts is None:
        return history(tokens, 60)
    return history(tokens, 60, start_ts, end_ts)


def _read(path):
    try:
        with open(path) as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return None


def run(cfg, fetch=None, now=None, log=print, budget_s=BUDGET_S):
    fetch = fetch or clob_fetch
    now = int(time.time() if now is None else now)
    t0 = time.time()
    flags = (_read(cfg.path("output", "flags.json")) or {}).get("flags") or []
    # the cache lives on the persistent data/ volume (output/ may be rebuilt per deploy); output/history.json is the published copy
    prev = ((_read(cfg.path("data", "history.json")) or _read(cfg.path("output", "history.json")) or {}).get("series")) or {}
    want = {}   # market id -> (side, token)
    for m in flags:
        side = (m.get("best") or {}).get("side_index")
        toks = m.get("tokens") or []
        if side in (0, 1) and len(toks) == 2 and toks[side]:
            want[m["id"]] = (side, toks[side])
    series = {i: s for i, s in prev.items() if i in want and s.get("side") == want[i][0]}   # dropped / flipped side: refetch
    fresh_ids = [i for i in want if i not in series]
    held_ids = []
    for i in want:
        if i in series:
            last = series[i]["t0"] + (len(series[i]["p"]) - 1) * series[i]["dt"]
            (held_ids if now - last <= TAIL_MAX_DAYS * 86400 else fresh_ids).append(i)
    failed = 0

    def batches(ids, window):
        nonlocal failed
        for k in range(0, len(ids), BATCH):
            if time.time() - t0 > budget_s:
                log(f"[history] time budget used; {len(ids) - k} markets keep their cached series")
                return
            chunk = ids[k:k + BATCH]
            start = None
            if window:
                lasts = [series[i]["t0"] + (len(series[i]["p"]) - 1) * series[i]["dt"] for i in chunk]
                start = max(min(lasts) - BASE_S, now - TAIL_MAX_DAYS * 86400)
            try:
                got = fetch([want[i][1] for i in chunk], start, now)
            except Exception as e:  # noqa: BLE001 - one bad batch must not lose the others
                failed += 1
                log(f"[history] batch failed: {type(e).__name__}: {e}")
                continue
            for i in chunk:
                pts = (got or {}).get(want[i][1]) or []
                s = merge(series.get(i), pts, now) if window else downsample(pts, now)
                if s:
                    series[i] = {"side": want[i][0], **s}

    batches(fresh_ids, window=False)
    batches(held_ids, window=True)
    out = {"meta": {"generated_at": now, "interval_s": BASE_S, "max_points": MAX_POINTS, "max_days": MAX_DAYS, "n": len(series),
                    "source": "Polymarket"}, "series": series}
    path = cfg.path("output", "history.json")
    tmp = path + ".tmp"
    with open(tmp, "w") as f:
        json.dump(out, f, separators=(",", ":"))
    os.replace(tmp, path)
    try:
        os.makedirs(os.path.dirname(cfg.path("data", "history.json")), exist_ok=True)
        with open(cfg.path("data", "history.json"), "w") as f:
            json.dump(out, f, separators=(",", ":"))
    except OSError as e:
        log(f"[history] cache copy skipped: {e}")
    log(f"[history] {len(series)} series ({len(fresh_ids)} full, {len(held_ids)} tail, {failed} failed batches)")
    return out
