# data progress

## F3 · done, PR open (with reviewer) · https://github.com/kiumars1199/Kismet/pull/42 (branch launch/data-f03, 5 commits)
Evidence (full detail in the PR body):
- pytest engine+ops: 153 passed. vitest: 1449 passed (one apply() p95 timing test flaked under parallel load, passes alone 7/7).
- typecheck, lint clean. build + check:js: "/: first-load JS 142.5 kB gzipped; budget 150 kB: OK".
- e2e launch-f03-search.spec.ts: 6 passed (port 3210), 390 and 1440 px.
- perf LOCAL/SYNTHETIC: 207K-row index + real 13,971-market store: rss 343 MB; 20 queries p95 66-85 ms.
- Best bets coverage: sports 832, weather 234, politics 3, crypto/culture/tech/finance/geopolitics 0 (engine tier rule, not an allowlist; main: do not loosen, logged as a decision); "No edge right now" shown.
- Preview URL: none yet. Production counts check is the reviewer's after merge.
Caveats: topic-map 95% is from a hand-written fixture (stated in the PR body); ops/upload.py and refresh.yml touched.

### Owed to main after F3 merges
- [ ] After the first real Kalshi crawl: share of kalshi_index.json rows with topic "other" and with "<cat>.other" (count per topic too).
- [ ] After the first scheduled refresh following merge: size of the live-branch commit (kalshi_index.json plain size, push size).

## F4 · plan sent to main, waiting for "yes" (no code yet)
Fields: lib/types.ts VenueQuote + Market.venues?; lib/schemas.ts; docs/03-data-model.md. Precision: >= 40 hand-labeled pairs in engine/tests/fixtures/venue_pairs.json, pytest asserts precision >= 0.95.
