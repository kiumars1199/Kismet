import argparse
import json
import os
import sys
import time

from . import backtest, config, dataset, precompute, scan, update
from .model import Model
from .jsonio import dump_atomic


def fit(cfg, log=print):
    b = dataset.load(cfg)
    hl = cfg.half_life_days
    bt_p = cfg.path("output", "backtest.json")
    try:  # use the half-life the latest walk-forward test picked, if any
        hl = json.load(open(bt_p)).get("chosen_half_life_days", hl)
    except FileNotFoundError:
        pass
    asof = time.time()
    m = Model(cfg, b.vocab, hl).fit(b, asof=asof)
    out = m.to_json()
    out.update(instance=cfg.instance, fitted_at=int(asof), data=dataset.summary(b))
    dump_atomic(cfg.path("output", "model.json"), out)
    log(f"model fitted: half-life={hl or 'no decay'} nodes={len(m.nodes)} bets={b.n}")


def run_backtest(cfg, log=print):
    b = dataset.load(cfg)
    bt = backtest.run(cfg, b, log=log)
    found, hl = backtest.pick_half_life(bt)
    bt["chosen_half_life_days"] = hl if found else cfg.half_life_days
    bt["combos"] = bt.pop("combos_by_half_life").get(str(bt["chosen_half_life_days"]), {})
    bt["data"] = dataset.summary(b)
    bt["ran_at"] = int(time.time())
    even = _read(cfg.path("output", "backtest_even.json"))
    if even:  # carry the even-weeks run forward: the site leads with it (Nov 21, Q's decision on #6)
        bt["even_weeks"] = even
    dump_atomic(cfg.path("output", "backtest.json"), bt, indent=1)
    log(f"chosen half-life: {bt['chosen_half_life_days']}")


EVEN_DATA_DIR = os.path.join("data", "even")
# How the even sample is drawn (pipeline flags; the scheduler's backtest_even job and docs/qa/marc-nov20-laneB.md #35).
EVEN_SAMPLE = dict(days=365, window_days=30, per_window=150, per_niche_month=300)


def _read(path):
    try:
        with open(path) as f:
            return json.load(f)
    except (FileNotFoundError, ValueError):
        return None


def attach_even(cfg, log=print):
    """Copy output/backtest_even.json into backtest.json as `even_weeks`. No-op if either file is missing."""
    even, main_p = _read(cfg.path("output", "backtest_even.json")), cfg.path("output", "backtest.json")
    main = _read(main_p)
    if even is None or main is None:
        log("attach-even: nothing to attach")
        return False
    main["even_weeks"] = even
    dump_atomic(main_p, main, indent=1)
    log(f"attach-even: even_weeks from {even.get('ran_at')}")
    return True


def run_backtest_even(cfg, log=print):
    """The same walk-forward test on a history sampled evenly over the year (data/even: up to `per_window` events
    per tag per 30-day window, `per_niche_month` priced markets per niche and month), so no few weeks dominate.
    Production's own history is densest in the newest weeks (81-87% of its test bets in the last 2), which is why
    the site leads with this run. Writes output/backtest_even.json (a backtest.json-shaped run plus `sample`) and
    `python -m engine attach-even` (or the next daily backtest) copies it into backtest.json as `even_weeks`. Kept
    apart so the scheduler can run this long job beside the scans without two writers on backtest.json."""
    ecfg = config.Config({**cfg, "data_dir": EVEN_DATA_DIR})
    b = dataset.load(ecfg)
    bt = backtest.run(ecfg, b, log=log)
    found, hl = backtest.pick_half_life(bt)
    bt["chosen_half_life_days"] = hl if found else cfg.half_life_days
    bt["combos"] = bt.pop("combos_by_half_life").get(str(bt["chosen_half_life_days"]), {})
    bt["data"] = dataset.summary(b)
    bt["sample"] = dict(EVEN_SAMPLE)
    bt["ran_at"] = int(time.time())
    dump_atomic(cfg.path("output", "backtest_even.json"), bt, indent=1)
    t = bt["results"].get(str(bt["chosen_half_life_days"]), {}).get("taker", {})
    log(f"even weeks: half-life {bt['chosen_half_life_days']}, {t.get('flags')} bets, roi {t.get('roi_pct')}%, t {t.get('t_stat')}")


DELAYED = ("markets.json", "flags.json") + precompute.FILES  # T-295: top.json / counts.json rotate with the scan


def scan_keeping_prev(cfg, run=None):
    """Scan, then keep the two scans before it: the replaced one as *-prev.json, the one before that as
    *-prev2.json. The Free tier is served the newest scan at least the delay old (docs/15; the web store picks).
    Two copies, not one (RT3-03): at a 10-minute cadence the replaced scan is only ~10 min old, so a single copy
    either breaks the 15-min delay or leaves Free with nothing for 5 minutes of every 10. Same shift as
    ops/upload.py (Storage) and refresh.yml (live branch)."""
    old = {}
    for name in DELAYED:
        for src in (name, name.replace(".json", "-prev.json")):
            try:
                with open(cfg.path("output", src), "rb") as f:
                    old[src] = f.read()
            except FileNotFoundError:
                pass
    (run or scan.run)(cfg)  # a failed scan raises: nothing rotated, the old files stay as they were
    precompute.write(os.path.dirname(cfg.path("output", "flags.json")))  # T-295: top.json, top-<category>.json, counts.json
    for src, data in old.items():
        with open(cfg.path("output", src.replace(".json", "-prev.json").replace("-prev-prev", "-prev2")), "wb") as f:
            f.write(data)


def main():
    ap = argparse.ArgumentParser(prog="python -m engine")
    ap.add_argument("--config", default="config/demo.json")
    ap.add_argument("cmd", choices=["update", "fit", "backtest", "backtest-even", "attach-even", "scan", "all", "grade", "kalshi"])
    a = ap.parse_args()
    cfg = config.load(a.config)
    if a.cmd in ("update", "all"):
        update.run(cfg)
    if a.cmd == "backtest":
        run_backtest(cfg)
    if a.cmd == "backtest-even":
        run_backtest_even(cfg)
    if a.cmd == "attach-even":
        attach_even(cfg)
    if a.cmd in ("fit", "all"):
        fit(cfg)
    if a.cmd in ("scan", "all"):
        scan_keeping_prev(cfg)
    if a.cmd in ("kalshi", "all"):
        # Nov 21: its own step, run by ops/scheduler.py AFTER the Polymarket upload, so a long Kalshi crawl never
        # delays fresh best bets. No-op unless KALSHI_DATA_PERMISSION=true.
        __import__("pipeline.fetch_kalshi").fetch_kalshi.run_if_enabled(cfg.path("output", "kalshi.json"), cfg.path("data", "kalshi_cache"))
        # F4: the same outcome on every venue (output/venues.json); Polymarket + US always, Kalshi when its index exists
        from . import venues
        venues.write(cfg)
    if a.cmd == "grade":
        from . import ledger
        ledger.grade(cfg)


if __name__ == "__main__":
    sys.exit(main())
