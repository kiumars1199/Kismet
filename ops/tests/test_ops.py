import calendar
import gzip
import json
import os
import time
import sys
import time

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

    @property
    def content(self):
        """Raw bytes as Storage returns them: bytes bodies as is (e.g. gzip), anything else as plain JSON."""
        return self.body if isinstance(self.body, bytes) else json.dumps(self.body).encode()

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
        self.calls.append(("POST", url, headers, data))
        return Resp(200)

    def delete(self, url, headers, timeout):
        self.calls.append(("DELETE", url, headers))
        return Resp(404)


def write(tmp_path, m, f):
    (tmp_path / "markets.json").write_text(json.dumps(m))
    (tmp_path / "flags.json").write_text(json.dumps(f))
    (tmp_path / "model.json").write_text("{}")
    (tmp_path / "ledger.jsonl").write_text("{}\n")
    return str(tmp_path)


def test_upload_skips_kalshi_json(tmp_path):
    """Nov 21: kalshi.json is uploaded only by --only after the crawl; the main upload would send the previous one."""
    out = write(tmp_path, *good())
    (tmp_path / "kalshi.json").write_text("{}")
    http = FakeHttp(prev=None)
    assert upload.publish(out, upload.Storage("https://x.supabase.co/", "svc", http), log=lambda *_: None)
    names = [c[1].rsplit("/", 1)[1] for c in http.calls if c[0] == "POST"]
    assert "kalshi.json" not in names and names[-1] == "flags.json"


def test_upload_all_files_flags_last(tmp_path):
    out = write(tmp_path, *good())
    http = FakeHttp(prev=None)
    assert upload.publish(out, upload.Storage("https://x.supabase.co/", "svc", http), log=lambda *_: None)
    posts = [c for c in http.calls if c[0] == "POST"]
    assert [c[1].rsplit("/", 1)[1] for c in posts] == ["ledger.jsonl", "markets.json", "model.json", "flags.json"]
    assert all("/storage/v1/object/scan/" in c[1] for c in posts)
    assert posts[0][2]["Authorization"] == "Bearer svc" and posts[0][2]["x-upsert"] == "true"
    assert http.calls[0][1] == "https://x.supabase.co/storage/v1/object/authenticated/scan/flags.json"
    assert not [c for c in http.calls if c[1].endswith("/copy")]  # first upload: nothing to keep


def test_upload_keeps_previous_scan_for_the_free_delay(tmp_path):
    out = write(tmp_path, *good(scanned_at=200))
    (tmp_path / "markets-prev.json").write_text("{}")  # a stray local copy is never uploaded
    http = FakeHttp(prev={"meta": {"scanned_at": 100}})
    assert upload.publish(out, upload.Storage("https://x.supabase.co", "svc", http), log=lambda *_: None)
    copies = [json.loads(c[3]) for c in http.calls if c[0] == "POST" and c[1].endswith("/object/copy")]
    # RT3-03: two older scans are kept (prev -> prev2 first, then live -> prev); the web store serves the newest
    # one that is at least the Free delay old.
    assert copies == [{"bucketId": "scan", "sourceKey": "markets-prev.json", "destinationKey": "markets-prev2.json"},
                      {"bucketId": "scan", "sourceKey": "markets.json", "destinationKey": "markets-prev.json"},
                      {"bucketId": "scan", "sourceKey": "flags-prev.json", "destinationKey": "flags-prev2.json"},
                      {"bucketId": "scan", "sourceKey": "flags.json", "destinationKey": "flags-prev.json"},
                      # T-295: the precomputed files rotate with the scan
                      {"bucketId": "scan", "sourceKey": "top-prev.json", "destinationKey": "top-prev2.json"},
                      {"bucketId": "scan", "sourceKey": "top.json", "destinationKey": "top-prev.json"},
                      {"bucketId": "scan", "sourceKey": "counts-prev.json", "destinationKey": "counts-prev2.json"},
                      {"bucketId": "scan", "sourceKey": "counts.json", "destinationKey": "counts-prev.json"}]
    first_put = next(i for i, c in enumerate(http.calls) if c[0] == "POST" and "/object/scan/" in c[1])
    last_copy = max(i for i, c in enumerate(http.calls) if c[1].endswith("/copy"))
    assert last_copy < first_put  # the old scan is kept before the new one overwrites it
    assert not [c for c in http.calls if c[0] == "POST" and c[1].endswith("-prev.json")]


def test_upload_tolerates_no_prev_yet(tmp_path):
    """Second publish ever: the bucket has a live scan but no *-prev.json yet; copying it to prev2 404s."""
    out = write(tmp_path, *good(scanned_at=200))
    http = FakeHttp(prev={"meta": {"scanned_at": 100}})
    post = http.post
    http.post = lambda url, data, headers, timeout: (
        Resp(404) if url.endswith("/copy") and "-prev.json\"" in data.split("destinationKey")[0] else post(url, data, headers, timeout))
    assert upload.publish(out, upload.Storage("https://x.supabase.co", "svc", http), log=lambda *_: None)


def test_upload_gzips_every_object_under_its_usual_name(tmp_path):
    """T-277: bodies are gzip (magic 1f 8b) and inflate to the exact local file; names don't change."""
    out = write(tmp_path, *good())
    http = FakeHttp(prev=None)
    assert upload.publish(out, upload.Storage("https://x.supabase.co", "svc", http), log=lambda *_: None)
    posts = [c for c in http.calls if c[0] == "POST" and "/object/scan/" in c[1]]
    assert len(posts) == 4
    for _, url, headers, body in posts:
        assert body[:2] == b"\x1f\x8b"
        assert gzip.decompress(body) == (tmp_path / url.rsplit("/", 1)[1]).read_bytes()
        assert headers["Content-Type"] == "application/gzip" and "Content-Encoding" not in headers


def test_get_json_reads_gzip_and_plain_objects():
    """During the rollout the bucket holds plain objects (old uploader) and gzip ones (new): both read."""
    doc = {"meta": {"scanned_at": 100}}
    for body in (gzip.compress(json.dumps(doc).encode()), json.dumps(doc).encode()):
        http = FakeHttp(prev=body)
        assert upload.Storage("https://x.supabase.co", "svc", http).get_json("flags.json") == doc


def test_upload_compares_against_a_gzipped_previous_scan(tmp_path):
    """The next run reads the gzipped flags.json it uploaded last time (scanned_at check + rotation)."""
    out = write(tmp_path, *good(scanned_at=100))
    http = FakeHttp(prev=gzip.compress(json.dumps({"meta": {"scanned_at": 100}}).encode()))
    assert not upload.publish(out, upload.Storage("https://x.supabase.co", "svc", http), log=lambda *_: None)
    http = FakeHttp(prev=gzip.compress(json.dumps({"meta": {"scanned_at": 50}}).encode()))
    assert upload.publish(out, upload.Storage("https://x.supabase.co", "svc", http), log=lambda *_: None)


def test_upload_skips_when_checks_fail(tmp_path):
    m, f = good(scanned_at=100)
    out = write(tmp_path, m, f)
    http = FakeHttp(prev={"meta": {"scanned_at": 100}})  # bucket already has this scan
    assert not upload.publish(out, upload.Storage("https://x.supabase.co", "svc", http), log=lambda *_: None)
    assert not [c for c in http.calls if c[0] == "POST"]


def test_scheduler_plan(monkeypatch):
    monkeypatch.setattr(scheduler.os.path, "exists", lambda p: True)
    monkeypatch.setattr(scheduler, "even_due", lambda now, last: False)
    t = calendar.timegm((2026, 11, 17, 7, 20, 0))
    assert scheduler.plan(t, {"backtest": t - 600, "fit": t - 600}) == ["scan"]
    assert scheduler.plan(t, {"backtest": t - 600, "fit": t - 3600}) == ["update", "fit", "grade", "scan"]
    assert scheduler.plan(t, {"backtest": t - 86400, "fit": t - 600}) == ["backtest", "scan"]
    early = calendar.timegm((2026, 11, 17, 5, 0, 0))  # before the 06:00 UTC backtest slot
    assert scheduler.plan(early, {"backtest": early - 86400, "fit": early}) == ["scan"]
    monkeypatch.setattr(scheduler.os.path, "exists", lambda p: False)
    assert scheduler.plan(t, {})[:2] == ["bootstrap", "backtest"]


def test_scheduler_even_weeks(monkeypatch, tmp_path):
    """Nov 21: the even-weeks job runs weekly from its file's ran_at, never twice at once, never retried within a day;
    a finished run is attached to backtest.json from the main loop."""
    monkeypatch.setattr(scheduler, "ROOT", str(tmp_path))
    (tmp_path / "output").mkdir()
    t = calendar.timegm((2026, 11, 17, 7, 20, 0))
    assert scheduler.even_due(t, {})  # no file yet
    assert not scheduler.even_due(t, {"even_running": True})
    assert not scheduler.even_due(t, {"backtest_even": t - 3600})  # tried an hour ago (maybe failed)
    assert not scheduler.even_due(calendar.timegm((2026, 11, 17, 5, 0, 0)), {})  # before the backtest hour
    (tmp_path / "output" / "backtest_even.json").write_text(json.dumps({"ran_at": t - 2 * 86400}))
    assert not scheduler.even_due(t, {})
    (tmp_path / "output" / "backtest_even.json").write_text(json.dumps({"ran_at": t - 8 * 86400}))
    assert scheduler.even_due(t, {})
    monkeypatch.setattr(scheduler.os.path, "exists", lambda p: True)
    monkeypatch.setattr(scheduler, "even_due", lambda now, last: False)
    last = {"backtest": t, "fit": t, "even_done": True}
    assert scheduler.plan(t, last) == ["attach_even", "scan"]
    assert scheduler.plan(t, last) == ["scan"]  # attached once
    assert scheduler.CMDS["backtest_even"][-1] == ["-m", "engine", "backtest-even"]


class GapHttp(FakeHttp):
    """Bucket with a live scan at `live_at` and a *-prev.json at `prev_at`."""
    def __init__(self, live_at, prev_at):
        super().__init__(prev={"meta": {"scanned_at": live_at}})
        self.prev_at = prev_at

    def get(self, url, headers, timeout):
        if url.endswith("flags-prev.json"):
            self.calls.append(("GET", url, headers))
            return Resp(200, {"meta": {"scanned_at": self.prev_at}})
        return super().get(url, headers, timeout)


def _copies(http):
    return [c for c in http.calls if c[0] == "POST" and c[1].endswith("/object/copy")]


def test_upload_rotates_prev_only_when_far_enough_apart(tmp_path):
    """SCAN_EVERY_SEC=120: rotating every scan would leave prev2 only ~4 min old, so Free (15 min behind) gets nothing."""
    out = write(tmp_path, *good(scanned_at="2026-11-19T10:20:00Z"))
    near = GapHttp(live_at="2026-11-19T10:10:00Z", prev_at="2026-11-19T10:00:00Z")   # 600 s apart < 780
    assert upload.publish(out, upload.Storage("https://x.supabase.co", "svc", near), log=lambda *_: None, rotate_min_sec=780)
    assert _copies(near) == []
    far = GapHttp(live_at="2026-11-19T10:13:00Z", prev_at="2026-11-19T10:00:00Z")    # 780 s apart
    assert upload.publish(out, upload.Storage("https://x.supabase.co", "svc", far), log=lambda *_: None, rotate_min_sec=780)
    assert len(_copies(far)) == 8


def test_scheduler_state_survives_restart(monkeypatch, tmp_path):
    """Nov 21: a restart reloads the last-run times, so a redeploy within the hour goes straight to the scan."""
    path = str(tmp_path / "data" / "scheduler_state.json")
    monkeypatch.setattr(scheduler, "run", lambda job: True)
    monkeypatch.setattr(scheduler.os.path, "exists", lambda p: True)
    last = {}
    scheduler.tick(last, save=lambda l: scheduler.save_state(l, path))
    assert set(last) >= {"update", "fit", "grade", "scan"}
    resumed = scheduler.load_state(path)
    assert resumed == {k: v for k, v in last.items() if not isinstance(v, bool)}   # times only; even-job flags stay in memory
    assert scheduler.plan(time.time(), resumed) == ["scan"]
    with open(path, "w") as f:
        f.write("{not json")
    assert scheduler.load_state(path) == {}
    assert scheduler.load_state(str(tmp_path / "missing.json")) == {}


def test_scheduler_cadence_from_env(monkeypatch):
    import importlib
    monkeypatch.setenv("SCAN_EVERY_SEC", "300")
    m = importlib.reload(scheduler)
    assert (m.SCAN_EVERY, m.ROTATE_MIN_SEC) == (300, 600)
    monkeypatch.delenv("SCAN_EVERY_SEC")
    m = importlib.reload(scheduler)
    assert (m.SCAN_EVERY, m.ROTATE_MIN_SEC) == (120, 780)


def test_upload_never_sends_local_prev_copies_and_tolerates_no_top_yet(tmp_path):
    """T-295: local *-prev2.json (rotated every scan, ~4 min old at a 2 min cadence) must not overwrite the bucket's;
    a bucket from before T-295 has no top.json / counts.json to rotate."""
    out = write(tmp_path, *good(scanned_at=200))
    for n in ("markets-prev2.json", "top-prev.json", "top-prev2.json", "counts-prev2.json"):
        (tmp_path / n).write_text("{}")
    (tmp_path / "top.json").write_text("{}")
    http = FakeHttp(prev={"meta": {"scanned_at": 100}})
    post = http.post
    http.post = lambda url, data, headers, timeout: (
        Resp(404) if url.endswith("/copy") and json.loads(data)["sourceKey"].startswith(("top", "counts")) else post(url, data, headers, timeout))
    assert upload.publish(out, upload.Storage("https://x.supabase.co", "svc", http), log=lambda *_: None)
    put = [c[1].rsplit("/", 1)[1] for c in http.calls if c[0] == "POST" and "/object/scan/" in c[1]]
    assert "top.json" in put and not [n for n in put if "-prev" in n]


class RevalHttp:
    def __init__(self, status=200, fail=False):
        self.status, self.fail, self.calls = status, fail, []

    def post(self, url, headers, timeout):
        self.calls.append(("POST", url, headers))
        if self.fail:
            raise upload.requests.ConnectionError("down")
        return Resp(self.status)

    def get(self, url, timeout):
        self.calls.append(("GET", url))
        return Resp(200)


def test_revalidate_posts_the_secret_then_warms_every_static_page():
    http = RevalHttp()
    env = {"SITE_URL": "https://kismet.test/", "REVALIDATE_SECRET": "r3v", "CRON_SECRET": "c"}
    assert upload.revalidate(env, http, log=lambda *_: None)
    assert http.calls[0] == ("POST", "https://kismet.test/api/revalidate", {"Authorization": "Bearer r3v"})
    assert [c[1] for c in http.calls[1:]] == ["https://kismet.test" + p for p in upload.STATIC_PAGES]
    http = RevalHttp()
    assert upload.revalidate({"REVALIDATE_URL": "https://x.test/api/revalidate", "CRON_SECRET": "c"}, http, log=lambda *_: None)
    assert http.calls[0][2] == {"Authorization": "Bearer c"}


def test_revalidate_is_optional_and_never_raises():
    http = RevalHttp()
    assert not upload.revalidate({"SITE_URL": "https://kismet.test"}, http, log=lambda *_: None)   # no secret
    assert not upload.revalidate({"CRON_SECRET": "c"}, http, log=lambda *_: None)                  # no URL
    assert http.calls == []
    env = {"SITE_URL": "https://k.test", "CRON_SECRET": "c"}
    assert not upload.revalidate(env, RevalHttp(status=401), log=lambda *_: None)
    assert not upload.revalidate(env, RevalHttp(fail=True), log=lambda *_: None)


def test_main_revalidates_only_after_a_good_upload(tmp_path, monkeypatch):
    calls = []
    monkeypatch.setenv("SUPABASE_URL", "https://x.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "svc")
    monkeypatch.setattr(upload, "revalidate", lambda: calls.append(1))
    for ok in (True, False):
        monkeypatch.setattr(upload, "publish", lambda *a, ok=ok, **k: ok)
        assert upload.main([str(tmp_path)]) == (0 if ok else 1)
    assert calls == [1]


def test_static_pages_match_the_web_list():
    import re
    src = open(os.path.join(os.path.dirname(__file__), "..", "..", "apps", "web", "lib", "static-routes.ts")).read()
    block = src.split("export const STATIC_PAGES", 1)[1].split("];", 1)[0]
    assert tuple(re.findall(r'"(/[^"]*)"', block)) == upload.STATIC_PAGES


def test_upload_only_sends_one_file_and_tolerates_missing(tmp_path):
    p = tmp_path / "kalshi.json"
    p.write_text('{"markets": []}')
    http = FakeHttp(prev=None)
    assert upload.publish_one(str(p), upload.Storage("https://x.supabase.co/", "svc", http), log=lambda *_: None)
    posts = [c for c in http.calls if c[0] == "POST"]
    assert [c[1].rsplit("/", 1)[1] for c in posts] == ["kalshi.json"]
    assert not [c for c in http.calls if c[0] == "GET"]  # no scan checks, no rotation
    http2 = FakeHttp(prev=None)
    assert upload.publish_one(str(tmp_path / "missing.json"), upload.Storage("https://x.supabase.co/", "svc", http2), log=lambda *_: None)
    assert http2.calls == []


def test_scheduler_runs_kalshi_after_the_polymarket_upload():
    steps = [" ".join(a) for a in scheduler.CMDS["scan"]]
    assert steps.index("ops/upload.py output") < steps.index("-m engine kalshi") < steps.index("ops/upload.py --only output/kalshi.json")


def test_housekeep_prunes_stale_kalshi_cache_and_reports_disk(monkeypatch, tmp_path, capsys):
    """Nov 22: a full volume (Kalshi cache pages kept 24 h) left a truncated model.json and 4 h of failed scans. The
    scheduler now prunes stale cache pages before every tick, even while the scan keeps failing, and logs disk use."""
    cache = tmp_path / "data" / "kalshi_cache"
    cache.mkdir(parents=True)
    stale, fresh = cache / ("a" * 40 + ".json"), cache / ("b" * 40 + ".json")
    for p in (stale, fresh):
        p.write_text("{}")
    old = time.time() - 3600
    os.utime(stale, (old, old))
    monkeypatch.setattr(scheduler, "ROOT", str(tmp_path))
    monkeypatch.setattr(scheduler, "KALSHI_CACHE", str(cache))
    scheduler.housekeep(force_report=True)
    assert fresh.exists() and not stale.exists()
    out = capsys.readouterr().out
    assert "pruned 1 stale Kalshi cache files" in out and "volume data/ " in out and "data/kalshi_cache" in out


def test_housekeep_measures_the_volume_not_the_host(monkeypatch, tmp_path, capsys):
    """Nov 22: on Railway, disk_usage() on the volume reports the 3 TB host, so "73% free" hid a full 5 GB volume. The
    share free comes from what data/ holds against the volume size, and a nearly full volume logs every tick."""
    data = tmp_path / "data"
    data.mkdir()
    (data / "sample.jsonl").write_bytes(b"x" * 950)
    monkeypatch.setattr(scheduler, "ROOT", str(tmp_path))
    monkeypatch.setattr(scheduler, "KALSHI_CACHE", str(data / "kalshi_cache"))
    monkeypatch.setattr(scheduler, "VOLUME_BYTES", 1000.0)
    scheduler.housekeep()   # not forced: logs only because the volume is 95% full
    out = capsys.readouterr().out
    assert "volume data/ 0.00 of 0 GB (5% free)" in out and "data/sample.jsonl" in out


def test_engine_json_writes_are_atomic(tmp_path):
    """Nov 22: a write that fails (full disk) raises and leaves the previous file whole, with no temp file behind."""
    from engine.jsonio import dump_atomic
    p = str(tmp_path / "model.json")
    dump_atomic(p, {"ok": 1})

    class Boom:
        pass
    try:
        dump_atomic(p, {"bad": Boom()})   # fails mid-write, like ENOSPC
    except TypeError:
        pass
    assert json.load(open(p)) == {"ok": 1} and os.listdir(tmp_path) == ["model.json"]
    import glob
    src = "".join(open(f).read() for f in glob.glob(os.path.join(os.path.dirname(__file__), "..", "..", "engine", "*.py")))
    import re
    assert not re.search(r'json\.dump\([^\n]*open\(', src.replace('json.dump(x, open(p, "w"))', ""))   # no in-place writes left
