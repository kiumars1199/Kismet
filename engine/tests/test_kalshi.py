"""Kalshi fetcher (pipeline/fetch_kalshi.py): flag gate, polite client, kalshi.json shape. No network."""
import json
import os

import pytest

from pipeline import fetch_kalshi as k

FIX = json.load(open(os.path.join(os.path.dirname(__file__), "fixtures", "kalshi_api.json")))


class FakeClient:
    def __init__(self):
        self.calls = []

    def get(self, path, **params):
        self.calls.append((path, params))
        if path == "/events":
            return FIX["events"]
        if params.get("mve_filter") == "only":
            return FIX["combos"]
        return {"markets": [m for m in FIX["legs"]["markets"] if m["ticker"] in params["tickers"].split(",")]}


class Resp:
    def __init__(self, status, body=None, headers=None):
        self.status_code, self.body, self.headers = status, body or {}, headers or {}

    def json(self):
        return self.body

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError(self.status_code)


class Session:
    def __init__(self, replies):
        self.replies, self.seen = list(replies), []

    def get(self, url, params=None, headers=None, timeout=None):
        self.seen.append((url, params, headers))
        return self.replies.pop(0)


def test_flag_off_makes_no_network_call(tmp_path, monkeypatch):
    monkeypatch.delenv("KALSHI_DATA_PERMISSION", raising=False)
    monkeypatch.setattr(k, "Client", lambda *a, **kw: pytest.fail("network client built with the flag off"))
    assert k.run_if_enabled(str(tmp_path / "kalshi.json"), str(tmp_path / "cache")) is None
    assert not (tmp_path / "kalshi.json").exists()
    monkeypatch.setenv("KALSHI_DATA_PERMISSION", "1")   # only the exact string "true" turns it on
    assert k.run_if_enabled(str(tmp_path / "kalshi.json"), str(tmp_path / "cache")) is None


def test_builds_markets_and_combos_from_fixtures(tmp_path):
    out = str(tmp_path / "kalshi.json")
    data = k.run(out, str(tmp_path), client=FakeClient())
    assert json.load(open(out)) == data
    assert data["meta"]["source"] == "Kalshi"
    mars = data["markets"][0]
    assert mars == {"ticker": "KXELONMARS-99", "event_ticker": "KXELONMARS-99", "series_ticker": "KXELONMARS",
                    "title": "Will Elon Musk visit Mars before Aug 1, 2099?", "subtitle": "Mars",
                    "yes_bid_cents": 10, "yes_ask_cents": 12, "volume": 127577, "close_time": "2099-08-01T04:59:00Z",
                    "url": "https://kalshi.com/markets/kxelonmars", "source": "Kalshi"}
    lac = data["markets"][2]
    assert (lac["yes_bid_cents"], lac["yes_ask_cents"]) == (None, None)   # 0 / 100 = no quote
    assert all(m["source"] == "Kalshi" and m["url"].startswith("https://kalshi.com/") for m in data["markets"])

    combos = {c["ticker"]: c for c in data["combos"]}
    assert set(combos) == {"KXMVE-S1", "KXMVE-S2"}   # 7-leg combo and the unpriced one dropped
    s1 = combos["KXMVE-S1"]
    assert s1["price_basis"] == "legs_product" and s1["kalshi_yes_ask_cents"] is None
    assert [l["ask_cents"] for l in s1["legs"]] == [63, 30]   # yes ask; no ask from the leg's own quote
    assert s1["legs_product_cents"] == 18.9
    s2 = combos["KXMVE-S2"]
    assert s2["same_event"] and s2["legs_product_cents"] is None   # correlated legs: no product
    assert s2["price_basis"] == "kalshi_quote" and s2["kalshi_yes_ask_cents"] == 24


def test_only_missing_leg_tickers_are_requested(tmp_path):
    c = FakeClient()
    k.build(c)
    asked = [p["tickers"] for _, p in c.calls if "tickers" in p]
    assert asked == ["KXATPMATCH-26NOV17ZVEFIL-ZVE,KXX-1-A,KXY-1-B"]


def test_client_is_polite_retries_429_and_caches(tmp_path):
    slept = []
    clock = [1000.0]
    s = Session([Resp(429, headers={"Retry-After": "3"}), Resp(200, {"ok": 1})])
    c = k.Client(str(tmp_path), ttl=600, delay=1.0, session=s, sleep=slept.append, now=lambda: clock[0])
    assert c.get("/markets", limit=100) == {"ok": 1}
    assert s.seen[0][2]["User-Agent"] == "Kismet scanner"
    assert s.seen[0][1] == {"limit": 100}
    assert slept[0] == 3.0 and len(s.seen) == 2
    # second call within the TTL comes from disk: no request
    clock[0] = os.path.getmtime(os.path.join(str(tmp_path), os.listdir(str(tmp_path))[0])) + 10
    assert c.get("/markets", limit=100) == {"ok": 1} and len(s.seen) == 2


def test_client_gives_up_after_repeated_429(tmp_path):
    s = Session([Resp(429)] * k.TRIES)
    c = k.Client(str(tmp_path), session=s, sleep=lambda _: None)
    with pytest.raises(RuntimeError):
        c.get("/markets")
    assert len(s.seen) == k.TRIES


def test_failure_never_breaks_the_scan(tmp_path, monkeypatch):
    monkeypatch.setenv("KALSHI_DATA_PERMISSION", "true")
    monkeypatch.setattr(k, "build", lambda client: (_ for _ in ()).throw(RuntimeError("down")))
    logs = []
    assert k.run_if_enabled(str(tmp_path / "kalshi.json"), str(tmp_path), log=logs.append) is None
    assert "skipped" in logs[0]
