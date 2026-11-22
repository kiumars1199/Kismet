"""Engine loop for the container (docs/14 §4): scan every SCAN_EVERY_SEC (default 120 s), update+fit+grade hourly, backtest daily.

One process runs the jobs in order, so data/ and output/ never see two writers. After every scan
the output is checked and uploaded (ops/upload.py); a failed check keeps the previous data live.

    python ops/scheduler.py            # forever
    python ops/scheduler.py --once     # one tick (for a smoke test)
"""
import argparse
import json
import os
import shutil
import subprocess
import sys
import threading
import time

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SCAN_EVERY = int(os.environ.get("SCAN_EVERY_SEC") or 120)
# Free stays at least 15 min behind: upload.py rotates its *-prev copies only this far apart (see ROTATE_MIN_SEC there).
ROTATE_MIN_SEC = max(0, 900 - SCAN_EVERY)
BACKTEST_HOUR_UTC = int(os.environ.get("BACKTEST_HOUR_UTC", "6"))
# Nov 21 (Q on #6): the site leads with the walk-forward test on an evenly sampled year (data/even). Its fetch and
# test take a long while, so they run in a background thread beside the scans, at most once a week (EVEN_EVERY_DAYS).
EVEN_EVERY_DAYS = float(os.environ.get("EVEN_EVERY_DAYS") or 7)
EVEN_DIR = os.path.join("data", "even")
KALSHI_CACHE = os.path.join(ROOT, "data", "kalshi_cache")
LOW_DISK = 0.10   # below this share free, every tick logs what uses the volume
# The Railway volume (mounted at data/) is 5 GB, but statvfs there reports the host disk (3 TB), so the share free is
# worked out from what data/ actually holds. Change VOLUME_GB if the volume is resized.
VOLUME_BYTES = float(os.environ.get("VOLUME_GB", "5")) * 1e9


def dir_bytes(path):
    total = 0
    for base, _, files in os.walk(path):
        for n in files:
            try:
                total += os.path.getsize(os.path.join(base, n))
            except OSError:
                pass
    return total


def housekeep(force_report=False):
    """Nov 22: runs before every tick's jobs, so it still frees space when the scan itself keeps failing. Deletes
    Kalshi cache pages past their TTL (never read again), then logs disk use when the volume is low (or at start)."""
    try:
        sys.path.insert(0, ROOT)
        from pipeline.fetch_kalshi import Client, TTL_S
        gone = Client(KALSHI_CACHE).prune(TTL_S)
        if gone:
            print(f"[scheduler] pruned {gone} stale Kalshi cache files", flush=True)
    except Exception as e:  # never let housekeeping stop the scans
        print(f"[scheduler] Kalshi cache prune failed: {e}", flush=True)
    try:
        data = os.path.join(ROOT, "data")
        used = dir_bytes(data)
        du = shutil.disk_usage(data if os.path.isdir(data) else ROOT)
        free = min(1 - used / VOLUME_BYTES, du.free / du.total if du.total else 1.0)
        if force_report or free < LOW_DISK:
            parts = []
            for top in ("data", "output"):
                d = os.path.join(ROOT, top)
                for n in sorted(os.listdir(d)) if os.path.isdir(d) else []:
                    parts.append((dir_bytes(os.path.join(d, n)) if os.path.isdir(os.path.join(d, n))
                                  else os.path.getsize(os.path.join(d, n)), f"{top}/{n}"))
            biggest = ", ".join(f"{name} {size / 1e9:.2f} GB" for size, name in sorted(parts, reverse=True)[:6])
            print(f"[scheduler] volume data/ {used / 1e9:.2f} of {VOLUME_BYTES / 1e9:.0f} GB ({free:.0%} free); "
                  f"largest: {biggest}", flush=True)
    except OSError as e:
        print(f"[scheduler] disk report failed: {e}", flush=True)


def plan(now, last):
    """Jobs due at unix time `now`, given `last` = {job: unix time it last ran}."""
    hour, day = int(now // 3600), int(now // 86400)
    jobs = []
    if not os.path.exists(os.path.join(ROOT, "data", "sample.jsonl")):
        jobs.append("bootstrap")
    if not os.path.exists(os.path.join(ROOT, "output", "backtest.json")) or (
            int(last.get("backtest", 0) // 86400) < day and time.gmtime(now).tm_hour >= BACKTEST_HOUR_UTC):
        jobs.append("backtest")
    if even_due(now, last):
        jobs.append("backtest_even")
    if last.pop("even_done", False):
        jobs.append("attach_even")  # into backtest.json from the main loop; the scan's upload publishes it
    if int(last.get("fit", -1) // 3600) < hour:
        jobs += ["update", "fit", "grade"]
    jobs.append("scan")
    return jobs


def even_due(now, last):
    """The even-weeks job is due when its output is missing or a week old, no copy is running, and the last try (even
    a failed one) was over a day ago. Its file's ran_at survives restarts, so a redeploy doesn't refetch."""
    if last.get("even_running") or now - last.get("backtest_even", 0) < 86400:
        return False
    try:
        with open(os.path.join(ROOT, "output", "backtest_even.json")) as f:
            ran = json.load(f).get("ran_at", 0)
    except (FileNotFoundError, ValueError):
        ran = 0
    return now - ran >= EVEN_EVERY_DAYS * 86400 and time.gmtime(now).tm_hour >= BACKTEST_HOUR_UTC


CMDS = {
    "bootstrap": [["pipeline/fetch_closed.py"], ["pipeline/fetch_prices.py", "--per-niche", "25000", "--threads", "8"]],
    "update": [["-m", "engine", "update"]],
    "fit": [["-m", "engine", "fit"]],
    "backtest": [["-m", "engine", "backtest"]],
    "grade": [["-m", "engine", "grade"]],
    # Even sample (docs/qa/nov21.md): same flags as engine.__main__.EVEN_SAMPLE, in data/even (KISMET_DATA_DIR).
    "backtest_even": [["pipeline/fetch_closed.py", "--days", "365", "--window-days", "30", "--per-window", "150"],
                      ["pipeline/fetch_prices.py", "--extend", "--per-niche-month", "300", "--threads", "4"],
                      ["-m", "engine", "backtest-even"]],
    "attach_even": [["-m", "engine", "attach-even"]],  # settles the live flag ledger (ledger_summary.json)
    # Nov 21: Kalshi runs after the Polymarket upload (fresh best bets first), then only kalshi.json is uploaded.
    "scan": [["-m", "engine", "scan"], ["ops/upload.py", "output"],
             ["-m", "engine", "kalshi"], ["ops/upload.py", "--only", "output/kalshi.json"]],
}


def run(job):
    for args in CMDS[job]:
        print(f"[scheduler] {job}: python {' '.join(args)}", flush=True)
        env = {**os.environ, "ROTATE_MIN_SEC": os.environ.get("ROTATE_MIN_SEC") or str(ROTATE_MIN_SEC),
               "PYTHONUNBUFFERED": "1"}  # job output reaches the logs even if the job is killed
        if job == "backtest_even":
            env["KISMET_DATA_DIR"] = EVEN_DIR
        if subprocess.run([sys.executable, *args], cwd=ROOT, env=env).returncode != 0:
            print(f"[scheduler] {job} failed; previous data stays live", flush=True)
            return False
    for d in (("data",) if job == "bootstrap" else (EVEN_DIR,) if job == "backtest_even" else ()):
        try:  # raw closed markets: only the priced sample is kept (disk)
            os.remove(os.path.join(ROOT, d, "markets.jsonl"))
        except FileNotFoundError:
            pass
    return True


def start_even(last):
    """Run the even-weeks job in a thread; the main loop attaches its result on the tick after it succeeds."""
    def work():
        try:
            last["even_done"] = run("backtest_even")
        finally:
            last["even_running"] = False
    last["even_running"] = True
    threading.Thread(target=work, name="backtest_even", daemon=True).start()


def tick(last):
    now = time.time()
    for job in plan(now, last):
        if job == "backtest_even":
            last[job] = now
            start_even(last)
            continue
        ok = run(job)
        last[job] = now  # a failed job waits for its next slot instead of retrying every tick
        if job == "bootstrap" and not ok:
            return  # no history yet: nothing else can run


ENGINE_UID = 10001


def drop_root():
    """Container start: give the mounted volume to the engine user, then never run as root again."""
    if os.getuid() != 0:
        return
    for d in ("data", os.path.join("data", "output")):  # image: output -> data/output (on the volume)
        p = os.path.join(ROOT, d)
        os.makedirs(p, exist_ok=True)
        for base, dirs, files in os.walk(p):
            for name in [base, *(os.path.join(base, x) for x in dirs + files)]:
                os.lchown(name, ENGINE_UID, ENGINE_UID)
    os.setgroups([])
    os.setgid(ENGINE_UID)
    os.setuid(ENGINE_UID)
    assert os.getuid() == ENGINE_UID and os.geteuid() == ENGINE_UID


def seed_ledger():
    """First start on an empty volume: continue the live flag ledger from the copy baked into the image."""
    dst, seed = os.path.join(ROOT, "output", "ledger.jsonl"), os.path.join(ROOT, "ops", "seed", "ledger.jsonl")
    if not os.path.exists(dst) and os.path.exists(seed):
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copyfile(seed, dst)


def main(argv=None):
    a = argparse.ArgumentParser(prog="ops/scheduler.py")
    a.add_argument("--once", action="store_true")
    once = a.parse_args(argv).once
    drop_root()
    seed_ledger()
    last = {}
    housekeep(force_report=True)
    while True:
        start = time.time()
        housekeep()
        tick(last)
        if once:
            return 0
        time.sleep(max(5, SCAN_EVERY - (time.time() - start) % SCAN_EVERY))


if __name__ == "__main__":
    sys.exit(main())
