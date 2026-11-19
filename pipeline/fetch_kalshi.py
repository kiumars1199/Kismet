"""Kalshi public market data -> output/kalshi.json (docs/03 § kalshi.json).

Runs only when KALSHI_DATA_PERMISSION=true: Kalshi's Developer Agreement bars commercial reuse of its data without
written permission (docs/16 §2). Flag off = no network call at all.

Public endpoints, no key (https://docs.kalshi.com/api-reference/market/get-markets):
  GET /events?status=open&with_nested_markets=true   plain markets, with their series ticker (for the kalshi.com link)
  GET /markets?status=open&mve_filter=only           Kalshi Combos (multivariate markets) and their legs
  GET /markets?tickers=a,b,...                       leg quotes we don't have yet

Combo prices: Kalshi lists its combo markets publicly, but they rarely carry a resting quote; combos are priced on
request (RFQ), which needs an authenticated member key. So each combo carries Kalshi's own quote when there is one,
and otherwise only the product of its legs' own Kalshi asks, labelled `price_basis: "legs_product"`.

Polite: small pages, a pause between calls, backoff on 429/5xx, User-Agent "Kismet scanner", on-disk cache with TTL.
"""
import hashlib
import json
import math
import os
import time

import requests

BASE = "https://api.elections.kalshi.com/trade-api/v2"
UA = "Kismet scanner"
PAGE = 100          # rows per call (Kalshi allows up to 1000; we ask for less)
DELAY_S = 1.0       # pause between network calls
TTL_S = 600         # on-disk cache lifetime
MAX_PAGES = 3       # event pages per run
MAX_COMBOS = 25     # combos kept per run
MAX_LEGS = 6        # same limit as the combo tray (docs/18 §5)
TICKER_BATCH = 20   # tickers per /markets?tickers= call
TRIES = 5


def enabled():
    return os.environ.get("KALSHI_DATA_PERMISSION") == "true"


class Client:
    """GET with an on-disk cache, a pause between calls and backoff on 429 / 5xx."""

    def __init__(self, cache_dir, ttl=TTL_S, delay=DELAY_S, session=None, sleep=time.sleep, now=time.time):
        self.cache_dir, self.ttl, self.delay = cache_dir, ttl, delay
        self.session = session or requests.Session()
        self.sleep, self.now = sleep, now
        self.last = None
        self.calls = 0

    def get(self, path, **params):
        key = hashlib.sha1(f"{path}?{json.dumps(params, sort_keys=True)}".encode()).hexdigest()
        cached = os.path.join(self.cache_dir, key + ".json")
        try:
            if self.now() - os.path.getmtime(cached) < self.ttl:
                with open(cached) as f:
                    return json.load(f)
        except (OSError, ValueError):
            pass
        for attempt in range(TRIES):
            if self.last is not None and self.now() - self.last < self.delay:
                self.sleep(self.delay - (self.now() - self.last))
            r = self.session.get(BASE + path, params=params, timeout=20,
                                 headers={"User-Agent": UA, "Accept": "application/json"})
            self.last = self.now()
            self.calls += 1
            if r.status_code == 429 or r.status_code >= 500:
                try:
                    wait = float(r.headers.get("Retry-After", ""))
                except ValueError:
                    wait = 2.0 ** attempt
                self.sleep(min(wait, 60))
                continue
            r.raise_for_status()
            data = r.json()
            os.makedirs(self.cache_dir, exist_ok=True)
            with open(cached, "w") as f:
                json.dump(data, f)
            return data
        raise RuntimeError(f"Kalshi {path}: still rate limited after {TRIES} tries")


def cents(m, field):
    """Price in whole cents from `<field>_dollars` (fixed-point string) or legacy integer `<field>`; None when
    there is no quote (0 or 100)."""
    try:
        c = round(float(m.get(f"{field}_dollars")) * 100)
    except (TypeError, ValueError):
        c = m.get(field) if isinstance(m.get(field), int) else None
    return c if c is not None and 0 < c < 100 else None


def volume(m):
    try:
        return int(float(m.get("volume_fp")))
    except (TypeError, ValueError):
        return m.get("volume") if isinstance(m.get("volume"), int) else 0


def series_of(event_ticker):
    return event_ticker.split("-")[0]


def url(series):
    # ponytail: series page, not the event page — Kalshi's event URLs carry a title slug the API doesn't return.
    return f"https://kalshi.com/markets/{series.lower()}"


def leg_ask(m, side):
    """What one contract of `side` costs right now, in cents."""
    if side == "yes":
        return cents(m, "yes_ask")
    ask = cents(m, "no_ask")
    if ask is None and cents(m, "yes_bid") is not None:
        ask = 100 - cents(m, "yes_bid")
    return ask


def market_row(m, title, series):
    return {
        "ticker": m["ticker"],
        "event_ticker": m.get("event_ticker", ""),
        "series_ticker": series,
        "title": title or m.get("title") or m["ticker"],
        "subtitle": m.get("yes_sub_title") or "",
        "yes_bid_cents": cents(m, "yes_bid"),
        "yes_ask_cents": cents(m, "yes_ask"),
        "volume": volume(m),
        "close_time": m.get("close_time"),
        "url": url(series),
        "source": "Kalshi",
    }


def combo_row(m, by_ticker):
    legs = m.get("mve_selected_legs") or []
    out = []
    for leg in legs:
        q = by_ticker.get(leg.get("market_ticker"))
        ev = leg.get("event_ticker") or (q or {}).get("event_ticker", "")
        out.append({
            "market_ticker": leg.get("market_ticker"),
            "event_ticker": ev,
            "side": leg.get("side"),
            "title": (q or {}).get("title") or (q or {}).get("yes_sub_title") or leg.get("market_ticker"),
            "ask_cents": leg_ask(q, leg.get("side")) if q else None,
            "url": url(series_of(ev or leg.get("market_ticker", ""))),
        })
    same_event = len({leg["event_ticker"] for leg in out}) < len(out)
    asks = [leg["ask_cents"] for leg in out]
    # Same-event legs are correlated, so the simple product is wrong (docs/18 §5): no number then.
    product = None if same_event or None in asks else round(math.prod(a / 100 for a in asks) * 100, 2)
    quote = cents(m, "yes_ask")
    ev = m.get("event_ticker", "")
    return {
        "ticker": m["ticker"],
        "event_ticker": ev,
        "collection_ticker": m.get("mve_collection_ticker", ""),
        "title": m.get("yes_sub_title") or m.get("title") or m["ticker"],
        "legs": out,
        "same_event": same_event,
        "kalshi_yes_bid_cents": cents(m, "yes_bid"),
        "kalshi_yes_ask_cents": quote,
        "legs_product_cents": product,
        "price_basis": "kalshi_quote" if quote is not None else "legs_product",
        "volume": volume(m),
        "close_time": m.get("close_time"),
        "url": url(series_of(ev)),
        "source": "Kalshi",
    }


def build(client):
    markets, by_ticker = [], {}
    cursor = None
    for _ in range(MAX_PAGES):
        params = {"status": "open", "with_nested_markets": "true", "limit": PAGE}
        if cursor:
            params["cursor"] = cursor
        page = client.get("/events", **params)
        for ev in page.get("events") or []:
            series = ev.get("series_ticker") or series_of(ev.get("event_ticker", ""))
            for m in ev.get("markets") or []:
                by_ticker[m["ticker"]] = {**m, "title": m.get("title") or ev.get("title")}
                markets.append(market_row(m, ev.get("title"), series))
        cursor = page.get("cursor")
        if not cursor:
            break

    raw = client.get("/markets", status="open", mve_filter="only", limit=PAGE).get("markets") or []
    raw = [m for m in raw if 2 <= len(m.get("mve_selected_legs") or []) <= MAX_LEGS][:MAX_COMBOS]
    missing = sorted({leg["market_ticker"] for m in raw for leg in m["mve_selected_legs"]} - by_ticker.keys())
    for i in range(0, len(missing), TICKER_BATCH):
        for m in client.get("/markets", tickers=",".join(missing[i:i + TICKER_BATCH])).get("markets") or []:
            by_ticker[m["ticker"]] = m
    combos = [combo_row(m, by_ticker) for m in raw]
    combos = [c for c in combos if c["kalshi_yes_ask_cents"] is not None or c["legs_product_cents"] is not None]

    return {
        "meta": {
            "source": "Kalshi",
            "attribution": "Market data from Kalshi (kalshi.com)",
            "fetched_at": int(time.time()),
            "api": BASE,
            "n_markets": len(markets),
            "n_combos": len(combos),
        },
        "markets": markets,
        "combos": combos,
    }


def run(out_path, cache_dir, client=None):
    data = build(client or Client(cache_dir))
    tmp = out_path + ".tmp"
    with open(tmp, "w") as f:
        json.dump(data, f)
    os.replace(tmp, out_path)
    return data


def run_if_enabled(out_path, cache_dir, log=print):
    """Engine scan hook: no-op (and no network) unless KALSHI_DATA_PERMISSION=true; a Kalshi failure never fails the scan."""
    if not enabled():
        return None
    try:
        data = run(out_path, cache_dir)
        log(f"kalshi: {data['meta']['n_markets']} markets, {data['meta']['n_combos']} combos")
        return data
    except Exception as e:  # noqa: BLE001 — optional source; the main scan must still publish
        log(f"kalshi: skipped ({e})")
        return None
