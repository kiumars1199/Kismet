import argparse
import json
import sys
import time

from . import backtest, config, dataset, scan, update
from .model import Model


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
    json.dump(out, open(cfg.path("output", "model.json"), "w"))
    log(f"model fitted: half-life={hl or 'no decay'} nodes={len(m.nodes)} bets={b.n}")


def run_backtest(cfg, log=print):
    b = dataset.load(cfg)
    bt = backtest.run(cfg, b, log=log)
    found, hl = backtest.pick_half_life(bt)
    bt["chosen_half_life_days"] = hl if found else cfg.half_life_days
    bt["data"] = dataset.summary(b)
    bt["ran_at"] = int(time.time())
    json.dump(bt, open(cfg.path("output", "backtest.json"), "w"), indent=1)
    log(f"chosen half-life: {bt['chosen_half_life_days']}")


def main():
    ap = argparse.ArgumentParser(prog="python -m engine")
    ap.add_argument("--config", default="config/demo.json")
    ap.add_argument("cmd", choices=["update", "fit", "backtest", "scan", "all", "grade"])
    a = ap.parse_args()
    cfg = config.load(a.config)
    if a.cmd in ("update", "all"):
        update.run(cfg)
    if a.cmd == "backtest":
        run_backtest(cfg)
    if a.cmd in ("fit", "all"):
        fit(cfg)
    if a.cmd in ("scan", "all"):
        scan.run(cfg)
    if a.cmd == "grade":
        from . import ledger
        ledger.grade(cfg)


if __name__ == "__main__":
    sys.exit(main())
