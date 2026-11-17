import calendar
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import checks  # noqa: E402
import scheduler  # noqa: E402
import upload  # noqa: E402


def good(scanned_at=200, n=2000):
    meta = {"scanned_at": scanned_at, "markets_scanned": n, "rule": {"min_edge": 0.02}}
    flag = {"id": "1", "validated": True, "execution": {"verdict": "worth it"},
            "best": {"edge": 0.05, "edge_low": 0.01, "ask": 0.5}}
    return {"meta": meta, "markets": [{"id": "1", "ask": 0.5}]}, {"meta": dict(meta), "flags": [flag]}


def test_checks_pass_and_fail():
    m, f = good()
    assert checks.check(m, f) == []
    assert checks.check(m, f, prev_scanned_at=199) == []
    assert "not newer" in checks.check(m, f, prev_scanned_at=200)[0]
    m2, f2 = good(n=10)
    assert any("too few" in e for e in checks.check(m2, f2))
    m3, f3 = good()
    f3["flags"][0]["best"]["edge_low"] = 0
    del f3["flags"][0]["execution"]
    assert len(checks.check(m3, f3)) == 2
    m4, f4 = good()
    m4["markets"][0]["ask"] = float("nan")
    assert any("NaN" in e for e in checks.check(m4, f4))
    m5, f5 = good()
    f5["flags"] = f5["flags"] * 201  # > 10% of 2000 (MAX_BEST_SHARE)
    assert any("too many best bets" in e for e in checks.check(m5, f5))
    m6, f6 = good()   # tier "edge" rows don't count toward the cap
    edge = {**f6["flags"][0], "tier": "edge", "best": {**f6["flags"][0]["best"], "model_neff": 50}}
    edge["execution"] = {**edge["execution"], "book_ok": True}
    f6["flags"] = f6["flags"] + [edge] * 300
    assert checks.check(m6, f6) == []


class Resp:
    def __init__(self, status, body=None):
        self.status_code, self.body = status, body

    def json(self):
        return self.body

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError(self.status_code)


class FakeHttp:
    def __init__(self, prev):
        self.prev, self.calls = prev, []

    def get(self, url, headers, timeout):
        self.calls.append(("GET", url, headers))
        return Resp(404) if self.prev is None else Resp(200, self.prev)

    def post(self, url, data, headers, timeout):
        self.calls.append(("POST", url, headers))
        return Resp(200)


def write(tmp_path, m, f):
    (tmp_path / "markets.json").write_text(json.dumps(m))
    (tmp_path / "flags.json").write_text(json.dumps(f))
    (tmp_path / "model.json").write_text("{}")
    (tmp_path / "ledger.jsonl").write_text("{}\n")
    return str(tmp_path)


def test_upload_all_files_flags_last(tmp_path):
    out = write(tmp_path, *good())
    http = FakeHttp(prev=None)
    assert upload.publish(out, upload.Storage("https://x.supabase.co/", "svc", http), log=lambda *_: None)
    posts = [c for c in http.calls if c[0] == "POST"]
    assert [u.rsplit("/", 1)[1] for _, u, _ in posts] == ["ledger.jsonl", "markets.json", "model.json", "flags.json"]
    assert all("/storage/v1/object/scan/" in u for _, u, _ in posts)
    assert posts[0][2]["Authorization"] == "Bearer svc" and posts[0][2]["x-upsert"] == "true"
    assert http.calls[0][1] == "https://x.supabase.co/storage/v1/object/authenticated/scan/flags.json"


def test_upload_skips_when_checks_fail(tmp_path):
    m, f = good(scanned_at=100)
    out = write(tmp_path, m, f)
    http = FakeHttp(prev={"meta": {"scanned_at": 100}})  # bucket already has this scan
    assert not upload.publish(out, upload.Storage("https://x.supabase.co", "svc", http), log=lambda *_: None)
    assert not [c for c in http.calls if c[0] == "POST"]


def test_scheduler_plan(monkeypatch):
    monkeypatch.setattr(scheduler.os.path, "exists", lambda p: True)
    t = calendar.timegm((2026, 11, 17, 7, 20, 0))
    assert scheduler.plan(t, {"backtest": t - 600, "fit": t - 600}) == ["scan"]
    assert scheduler.plan(t, {"backtest": t - 600, "fit": t - 3600}) == ["update", "fit", "grade", "scan"]
    assert scheduler.plan(t, {"backtest": t - 86400, "fit": t - 600}) == ["backtest", "scan"]
    early = calendar.timegm((2026, 11, 17, 5, 0, 0))  # before the 06:00 UTC backtest slot
    assert scheduler.plan(early, {"backtest": early - 86400, "fit": early}) == ["scan"]
    monkeypatch.setattr(scheduler.os.path, "exists", lambda p: False)
    assert scheduler.plan(t, {})[:2] == ["bootstrap", "backtest"]
