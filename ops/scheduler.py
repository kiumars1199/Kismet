"""Engine loop for the container (docs/14 §4): scan every 10 min, update+fit hourly, backtest daily.

One process runs the jobs in order, so data/ and output/ never see two writers. After every scan
the output is checked and uploaded (ops/upload.py); a failed check keeps the previous data live.

    python ops/scheduler.py            # forever
    python ops/scheduler.py --once     # one tick (for a smoke test)
"""
import argparse
import os
import subprocess
import sys
import time

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SCAN_EVERY = 600
BACKTEST_HOUR_UTC = int(os.environ.get("BACKTEST_HOUR_UTC", "6"))


def plan(now, last):
    """Jobs due at unix time `now`, given `last` = {job: unix time it last ran}."""
    hour, day = int(now // 3600), int(now // 86400)
    jobs = []
    if not os.path.exists(os.path.join(ROOT, "data", "sample.jsonl")):
        jobs.append("bootstrap")
    if not os.path.exists(os.path.join(ROOT, "output", "backtest.json")) or (
            int(last.get("backtest", 0) // 86400) < day and time.gmtime(now).tm_hour >= BACKTEST_HOUR_UTC):
        jobs.append("backtest")
    if int(last.get("fit", -1) // 3600) < hour:
        jobs += ["update", "fit"]
    jobs.append("scan")
    return jobs


CMDS = {
    "bootstrap": [["pipeline/fetch_closed.py"], ["pipeline/fetch_prices.py", "--per-niche", "25000", "--threads", "8"]],
    "update": [["-m", "engine", "update"]],
    "fit": [["-m", "engine", "fit"]],
    "backtest": [["-m", "engine", "backtest"]],
    "scan": [["-m", "engine", "scan"], ["ops/upload.py", "output"]],
}


def run(job):
    for args in CMDS[job]:
        print(f"[scheduler] {job}: python {' '.join(args)}", flush=True)
        if subprocess.run([sys.executable, *args], cwd=ROOT).returncode != 0:
            print(f"[scheduler] {job} failed; previous data stays live", flush=True)
            return False
    if job == "bootstrap":
        try:
            os.remove(os.path.join(ROOT, "data", "markets.jsonl"))
        except FileNotFoundError:
            pass
    return True


def tick(last):
    now = time.time()
    for job in plan(now, last):
        ok = run(job)
        last[job] = now  # a failed job waits for its next slot instead of retrying every tick
        if job == "bootstrap" and not ok:
            return  # no history yet: nothing else can run


def main(argv=None):
    a = argparse.ArgumentParser(prog="ops/scheduler.py")
    a.add_argument("--once", action="store_true")
    once = a.parse_args(argv).once
    last = {}
    while True:
        start = time.time()
        tick(last)
        if once:
            return 0
        time.sleep(max(5, SCAN_EVERY - (time.time() - start) % SCAN_EVERY))


if __name__ == "__main__":
    sys.exit(main())
