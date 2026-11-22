"""F14: per-market price history, downsampled (<= 200 points) and capped (<= 90 days). No network."""
import gzip
import json

from engine import history as h

NOW = 1_795_372_009
HOUR = 3600
DAY = 86400


def pts(n, start=NOW - 30 * DAY, step=HOUR, f=lambda i: 0.5 + (i % 7) / 100):
    return [{"t": start + i * step, "p": f(i)} for i in range(n)]


def expand(s):
    return [(s["t0"] + i * s["dt"], v / 1000) for i, v in enumerate(s["p"])]


def test_downsample_keeps_at_most_200_points_and_first_and_last_price():
    raw = pts(2160, start=NOW - 90 * DAY)   # 90 days hourly
    s = h.downsample(raw, NOW)
    assert len(s["p"]) <= 200
    assert s["dt"] % HOUR == 0 and s["dt"] >= HOUR
    assert s["t0"] == raw[0]["t"]
    assert s["p"][0] == round(raw[0]["p"] * 1000) and s["p"][-1] == round(raw[-1]["p"] * 1000)


def test_short_history_is_not_thinned():
    s = h.downsample(pts(48), NOW)
    assert len(s["p"]) == 48 and s["dt"] == HOUR


def test_points_older_than_90_days_are_dropped():
    raw = pts(200 * 24, start=NOW - 200 * DAY)
    s = h.downsample(raw, NOW)
    assert s["t0"] >= NOW - 90 * DAY - HOUR
    assert s["t0"] + (len(s["p"]) - 1) * s["dt"] <= NOW


def test_empty_or_all_old_history_is_none():
    assert h.downsample([], NOW) is None
    assert h.downsample(pts(10, start=NOW - 300 * DAY), NOW) is None


def test_gaps_carry_the_last_price_forward():
    raw = [{"t": NOW - 10 * HOUR, "p": 0.4}, {"t": NOW - 2 * HOUR, "p": 0.6}]
    s = h.downsample(raw, NOW)
    assert s["p"][0] == 400 and s["p"][-1] == 600 and set(s["p"][1:-1]) == {400}


def test_merge_replaces_the_overlap_with_the_fresh_tail():
    old = h.downsample(pts(24 * 10, start=NOW - 10 * DAY, f=lambda i: 0.5), NOW - DAY)
    fresh = [{"t": NOW - 2 * DAY + i * HOUR, "p": 0.7} for i in range(49)]
    s = h.merge(old, fresh, NOW)
    cells = expand(s)
    assert cells[-1][1] == 0.7 and cells[0][1] == 0.5
    assert len(s["p"]) <= 200


def test_prices_are_per_mille_integers_in_range():
    s = h.downsample(pts(30, f=lambda i: 0.1234), NOW)
    assert all(isinstance(v, int) and 0 <= v <= 1000 for v in s["p"]) and s["p"][0] == 123


class Cfg:
    def __init__(self, root):
        self.root = root

    def path(self, *a):
        import os
        return os.path.join(self.root, *a)


def _flags(tmp_path, ids=("1", "2", "3")):
    (tmp_path / "output").mkdir()
    (tmp_path / "data").mkdir()
    rows = [{"id": i, "best": {"side_index": 0}, "tokens": [f"tok{i}a", f"tok{i}b"]} for i in ids]
    rows[-1]["best"]["side_index"] = 1
    (tmp_path / "output" / "flags.json").write_text(json.dumps({"meta": {"scanned_at": NOW}, "flags": rows}))


def test_run_writes_history_json_for_each_flag_and_the_right_token(tmp_path):
    _flags(tmp_path)
    seen = []

    def fetch(tokens, start_ts, end_ts):
        seen.append((tuple(tokens), start_ts))
        return {t: pts(100, start=NOW - 5 * DAY) for t in tokens if t != "tok2a"}   # market 2 has no history

    out = h.run(Cfg(str(tmp_path)), fetch=fetch, now=NOW, log=lambda *a: None)
    f = json.load(open(tmp_path / "output" / "history.json"))
    assert set(f["series"]) == {"1", "3"} and out == f
    assert f["series"]["1"]["side"] == 0 and f["series"]["3"]["side"] == 1   # best side's token
    assert f["meta"]["max_points"] == 200 and f["meta"]["max_days"] == 90 and f["meta"]["n"] == 2
    assert {t for tokens, _ in seen for t in tokens} == {"tok1a", "tok2a", "tok3b"}


def test_second_run_fetches_only_the_tail_and_keeps_the_old_series(tmp_path):
    _flags(tmp_path, ids=("1",))
    calls = []

    def fetch(tokens, start_ts, end_ts):
        calls.append((start_ts, end_ts))
        return {t: pts(48, start=(start_ts or NOW - 50 * HOUR), f=lambda i: 0.3) for t in tokens}

    h.run(Cfg(str(tmp_path)), fetch=fetch, now=NOW - 2 * HOUR, log=lambda *a: None)
    first = json.load(open(tmp_path / "output" / "history.json"))["series"]["1"]
    h.run(Cfg(str(tmp_path)), fetch=fetch, now=NOW, log=lambda *a: None)
    second = json.load(open(tmp_path / "output" / "history.json"))["series"]["1"]
    assert calls[0][0] is None                      # first run: the whole history (interval=max)
    assert calls[1][0] is not None and NOW - calls[1][0] < 14 * DAY   # second: a tail window the CLOB accepts
    assert second["t0"] == first["t0"] and len(second["p"]) <= 200


def test_ids_no_longer_flagged_are_dropped(tmp_path):
    _flags(tmp_path, ids=("1", "2"))
    fetch = lambda tokens, s, e: {t: pts(50, start=NOW - 3 * DAY) for t in tokens}  # noqa: E731
    h.run(Cfg(str(tmp_path)), fetch=fetch, now=NOW, log=lambda *a: None)
    _flags_again = json.loads((tmp_path / "output" / "flags.json").read_text())
    _flags_again["flags"] = _flags_again["flags"][:1]
    (tmp_path / "output" / "flags.json").write_text(json.dumps(_flags_again))
    h.run(Cfg(str(tmp_path)), fetch=fetch, now=NOW + HOUR, log=lambda *a: None)
    assert set(json.load(open(tmp_path / "output" / "history.json"))["series"]) == {"1"}


def test_a_failed_batch_keeps_the_cached_series_and_does_not_raise(tmp_path):
    _flags(tmp_path, ids=("1",))
    ok = lambda tokens, s, e: {t: pts(50, start=NOW - 3 * DAY) for t in tokens}  # noqa: E731
    h.run(Cfg(str(tmp_path)), fetch=ok, now=NOW, log=lambda *a: None)

    def boom(tokens, s, e):
        raise RuntimeError("CLOB down")

    out = h.run(Cfg(str(tmp_path)), fetch=boom, now=NOW + HOUR, log=lambda *a: None)
    assert "1" in out["series"]


def test_projected_size_for_2800_series_stays_under_6mb_gzipped():
    """Fixture-scale measurement (200 points per series, realistic random-walk prices) extrapolated to 2,800 series."""
    import random
    random.seed(3)
    series = {}
    for i in range(280):
        p, raw = 0.5, []
        for k in range(2160):
            p = min(0.99, max(0.01, p + random.gauss(0, 0.01)))
            raw.append({"t": NOW - 90 * DAY + k * HOUR, "p": p})
        s = h.downsample(raw, NOW)
        series[str(7_000_000 + i)] = {"side": i % 2, **s}
    blob = json.dumps({"meta": {}, "series": series}, separators=(",", ":")).encode()
    plain, gz = len(blob), len(gzip.compress(blob))
    print(f"280 series: {plain} B plain, {gz} B gzipped; x10 = {plain * 10 / 1e6:.2f} MB plain, {gz * 10 / 1e6:.2f} MB gzipped")
    assert gz * 10 < 6_000_000
