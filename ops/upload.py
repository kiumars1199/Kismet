"""Upload output/*.json to the private Supabase Storage bucket `scan` (docs/14 §4).

    SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... python ops/upload.py [output_dir]

Runs the docs/12 data checks first (scanned_at must be newer than the copy in the bucket).
Any failure uploads nothing, so the web app keeps serving the previous scan. Exit 1 on failure.
"""
import glob
import json
import os
import sys

import requests

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from checks import check_dir  # noqa: E402

BUCKET = "scan"


class Storage:
    def __init__(self, url, key, http=None):
        self.base = url.rstrip("/") + "/storage/v1/object"
        self.headers = {"Authorization": f"Bearer {key}", "apikey": key}
        self.http = http or requests.Session()

    def get_json(self, name):
        r = self.http.get(f"{self.base}/authenticated/{BUCKET}/{name}", headers=self.headers, timeout=60)
        if r.status_code in (400, 404):  # Storage answers 400 for a missing object
            return None
        r.raise_for_status()
        return r.json()

    def put(self, name, body):
        r = self.http.post(f"{self.base}/{BUCKET}/{name}", data=body, timeout=300,
                           headers={**self.headers, "Content-Type": "application/json", "x-upsert": "true",
                                    "Cache-Control": "no-cache"})
        r.raise_for_status()


def publish(out_dir, storage, log=print):
    prev = storage.get_json("flags.json")
    prev_at = (prev or {}).get("meta", {}).get("scanned_at")
    errs = check_dir(out_dir, prev_at)
    if errs:
        for e in errs:
            log(f"data check failed: {e}")
        log("upload skipped; the bucket keeps the previous scan")
        return False
    files = sorted(glob.glob(os.path.join(out_dir, "*.json")))
    # flags.json last: it carries the scanned_at that the next run compares against.
    files.sort(key=lambda p: os.path.basename(p) == "flags.json")
    for p in files:
        with open(p, "rb") as f:
            storage.put(os.path.basename(p), f.read())
        log(f"uploaded {os.path.basename(p)}")
    return True


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required", file=sys.stderr)
        return 1
    try:
        ok = publish(argv[0] if argv else "output", Storage(url, key))
    except (requests.RequestException, OSError, json.JSONDecodeError) as e:
        print(f"upload failed: {type(e).__name__}: {e}", file=sys.stderr)
        return 1
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
