"""Backfill (docs/18 §1): windowed fetch_closed resumes, windowed price history groups fit the CLOB limit."""
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "pipeline"))
import fetch_closed  # noqa: E402
import fetch_prices  # noqa: E402

DAY = 86400


def test_windows_cover_range_newest_first():
    w = fetch_closed.windows(100 * DAY, 20, 7)
    assert w == [(93 * DAY, 100 * DAY), (86 * DAY, 93 * DAY), (80 * DAY, 86 * DAY)]


def event(eid, mid, end):
    return {"id": eid, "title": "E", "slug": "e", "tags": [{"slug": "nba"}], "markets": [{
        "id": mid, "outcomePrices": '["1", "0"]', "clobTokenIds": '["a", "b"]', "outcomes": '["Y", "N"]',
        "endDate": end, "startDate": "2025-01-01T00:00:00Z"}]}


def test_backfill_resumes_without_duplicates(tmp_path, monkeypatch):
    out, st = str(tmp_path / "m.jsonl"), str(tmp_path / "s.json")
    monkeypatch.setattr(fetch_closed, "SAMPLE_TAGS", ["nba"])
    calls = []

    def fake(method, url, params=None, **kw):
        calls.append(params["end_date_min"])
        if len(calls) == 2:
            raise RuntimeError("API down")
        return [event(str(len(calls)), str(len(calls)), "2025-02-01T00:00:00Z"),
                event("dup", "dup", "2025-02-01T00:00:00Z")]

    monkeypatch.setattr(fetch_closed, "http", fake)
    json.dump({"anchor": 100 * DAY}, open(st, "w"))
    try:
        fetch_closed.backfill(14, 7, 100, "endDate", out=out, state_p=st, log=lambda *a: None)
    except RuntimeError:
        pass
    assert len(json.load(open(st))["done"]) == 1
    fetch_closed.backfill(14, 7, 100, "endDate", out=out, state_p=st, log=lambda *a: None)
    ids = [json.loads(line)["id"] for line in open(out)]
    assert len(ids) == len(set(ids)) == 3  # "1", "dup", "3": window 1 not refetched, dup kept once
    assert len(calls) == 3 and len(json.load(open(st))["done"]) == 2


def test_windowed_history_groups_fit_clob_limit(monkeypatch):
    got = []
    monkeypatch.setattr(fetch_prices, "history",
                        lambda toks, fid, s=None, e=None: got.append((toks, s, e)) or {t: [1] for t in toks})
    ms = [dict(tokens=[str(i)], ref_ts=i * DAY) for i in (0, 3, 6, 20)]
    h = fetch_prices.windowed(ms)
    assert set(h) == {"0", "3", "6", "20"}
    for toks, s, e in got:
        assert e - s <= fetch_prices.WINDOW_S
    assert [g[0] for g in got] == [["0", "3", "6"], ["20"]]
