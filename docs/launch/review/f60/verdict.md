# #60 df67be8: PASS with notes (code read + local timing; stacked on #59 4e52f3d, not merged yet)
- Suites: pytest 164, vitest polymarket-index 10/10, tsc and lint OK, CI web/python/supply-chain success.
- Local timing (run/pmix.timing.test.ts, synthetic 143,194-row index, 20.7 MB, local disk): unchanged-meta refresh 0.2–0.8 ms vs no-meta (#59 path) 23–69 ms; cold 354–472 ms; new build ~400 ms either way. Network/gzip saving not measurable here (same gap as PR states).
- Code read: meta read first; equal fetched_at = held index, big file not read; missing/torn meta = old signature path; failed index upload stops the chain before meta; meta is uploaded every scan (no .sent) so a failed meta upload heals next scan; index uploaded and meta lagging just re-downloads until they agree.
- Note: if a CDN/storage cache serves a stale meta, a new index is picked up only when the cache expires (the #59 path had the same exposure on the big file).
- Note: scheduler comment fixed (my #59 cosmetic note).
