# #116 review fix: the stale-guard after a normal scan

Findings: (a) caches out of step (counts 30 s, teasers 60 s; resetTop did not clear the teaser cache), (b) ops/upload.py sent counts.json
before markets.json/teasers/top (alphabetical), (c) top.ts awaited counts serially.

Fix: when counts.json is newer than the cached teasers.json / top.json, that file is re-read once bypassing the cache before the guard gives
up (a real leftover is still refused); resetTop() also clears the teaser cache; ops/upload.py sends counts.json after every other file and
just before flags.json; top.ts reads top.json and counts.json in one Promise.all.

Files here:
- vitest-red.txt / vitest-green.txt: test/teaser-index.test.ts "the stale-guard with caches out of step" (red: 3 failed on the old code).
- pytest-red.txt / pytest-green.txt: ops/tests/test_ops.py counts.json goes after teasers/top and before flags.json.
- skew.sh + skew-*.log: a warm production `next start` on synthetic real-size data (55k markets, 8.9 MB markets.json, 7.6 MB teasers.json;
  fixture markets replicated), then a NORMAL scan (counts + teasers + top rewritten with the same newer scanned_at), /m of another id at
  t=35 s. 2d4997b: 4.43 s (store path), t=65 s 0.15 s. Fixed: 0.31 s (one re-read of teasers.json), the next /m 0.02 s, t=65 s 0.04 s.
  Control (no new scan) fixed: 0.04 s. (The synthetic teasers.json is far bigger than a real one, so the re-read is a ceiling.)

## Second review (103b628): a real leftover must not cost a read per request
The stale-guard's re-read now happens at most once per counts.json scan (the cache entry remembers the `scanned_at` it was re-read against, kept
across TTL refreshes) and concurrent callers share the one read (`freshInflight`), in teasers.ts and top.ts. Test: "a real leftover costs
one re-read, not one per request" (teaser-index.test.ts): 20 sequential + 20 concurrent requests inside the TTL add 0 reads; after the TTL
one read per window; 20 concurrent cold requests make at most 2 (load + re-read). Red before: 42 / 21 / 42 reads. See vitest-red-leftover-reads.txt.
