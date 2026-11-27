"""Nov 21 (Q on #6): the even-weeks run lives in output/backtest_even.json and rides along in backtest.json."""
import json

from engine import __main__ as cli
from engine.config import Config


def cfg(tmp_path):
    return Config({"output_dir": str(tmp_path / "output"), "data_dir": str(tmp_path / "data")})


def test_attach_even(tmp_path):
    c = cfg(tmp_path)
    assert not cli.attach_even(c, log=lambda *_: None)  # neither file
    json.dump({"results": {}, "chosen_half_life_days": 90}, open(c.path("output", "backtest.json"), "w"))
    assert not cli.attach_even(c, log=lambda *_: None)  # no even run yet
    json.dump({"results": {"None": {}}, "ran_at": 5, "sample": cli.EVEN_SAMPLE}, open(c.path("output", "backtest_even.json"), "w"))
    assert cli.attach_even(c, log=lambda *_: None)
    main = json.load(open(c.path("output", "backtest.json")))
    assert main["chosen_half_life_days"] == 90 and main["even_weeks"]["ran_at"] == 5


def test_even_sample_matches_scheduler():
    import ops.scheduler as s
    a = s.CMDS["backtest_even"]
    flat = [x for cmd in a for x in cmd]
    for flag, key in (("--days", "days"), ("--window-days", "window_days"), ("--per-window", "per_window"),
                      ("--per-niche-month", "per_niche_month")):
        assert flat[flat.index(flag) + 1] == str(cli.EVEN_SAMPLE[key])
