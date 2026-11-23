import json
import os

from engine import pm_index


def ev(title, markets, tags=("nba",)):
    return {"title": title, "slug": title.lower().replace(" ", "-"), "tags": [{"slug": t} for t in tags], "markets": markets}


def mk(i, **kw):
    return {"id": str(i), "question": f"Q{i}", "outcomes": '["Yes","No"]', "acceptingOrders": True, "closed": False,
            "volumeNum": 12.7, "endDate": "2026-12-01T00:00:00Z", **kw}


def test_rows_keep_open_binary_without_a_book_or_a_close_window():
    rows = pm_index.rows_of(ev("Lakers game", [
        mk(1), mk(2, closed=True), mk(3, acceptingOrders=False), mk(4, outcomes='["A","B","C"]'),
        mk(5, endDate=None), mk(6, bestBid=None, bestAsk=None, endDate="2030-01-01T00:00:00Z")]))
    assert [r[0] for r in rows] == ["1", "5", "6"]   # no bid/ask and a far close date do not drop a market here
    assert rows[0][4:6] == ["sports", "nba"] and rows[0][7] == 12 and rows[1][8] is None


def pages(*evs_per_page):
    def fetch(cur):
        i = int(cur or 0)
        return {"events": evs_per_page[i], "next_cursor": str(i + 1) if i + 1 < len(evs_per_page) else None}
    return fetch


def test_crawl_pages_and_dedupes():
    rows, ok = pm_index.crawl(pages([ev("A", [mk(1), mk(2)])], [ev("B", [mk(2), mk(3)])]))
    assert ok and [r[0] for r in rows] == ["1", "2", "3"]


def test_crawl_over_budget_is_incomplete():
    t = iter(range(0, 10000, 1000))
    rows, ok = pm_index.crawl(pages([ev("A", [mk(1)])], [ev("B", [mk(2)])]), budget=500, now=lambda: next(t))
    assert not ok


class Cfg(dict):
    def path(self, kind, name):
        return os.path.join(self["d"], name)


def test_run_writes_then_keeps_the_fresh_file_and_never_replaces_with_partial(tmp_path):
    cfg = Cfg(d=str(tmp_path))
    f = pages([ev("A", [mk(1)])])
    assert pm_index.run(cfg, log=lambda *_: None, fetch=f) is True
    d = json.load(open(tmp_path / "polymarket_index.json"))
    assert d["meta"]["n"] == 1 and d["meta"]["columns"] == list(pm_index.COLUMNS)
    assert pm_index.run(cfg, log=lambda *_: None, fetch=f) is False   # younger than MAX_AGE_S: kept
    os.utime(tmp_path / "polymarket_index.json", (0, 0))

    def boom(cur):
        raise RuntimeError("down")
    assert pm_index.run(cfg, log=lambda *_: None, fetch=boom) is False
    assert json.load(open(tmp_path / "polymarket_index.json"))["meta"]["n"] == 1   # last good file stays
