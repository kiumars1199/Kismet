# data progress

## F3 · done, PR open (with reviewer) · https://github.com/kiumars1199/Kismet/pull/42 (branch launch/data-f03, head 70fb2fe)
Evidence (full detail in the PR body):
- pytest engine+ops: 153 passed. vitest: 1449 passed (one apply() p95 timing test flakes under parallel load, passes alone 7/7).
- typecheck, lint clean. build + check:js: "/: first-load JS 142.5 kB gzipped; budget 150 kB: OK".
- e2e launch-f03-search.spec.ts: 6 passed (port 3210), 390 and 1440 px.
- perf LOCAL/SYNTHETIC: 207K-row index + real 13,971-market store: rss 343 MB; 20 queries p95 66-85 ms.
- Best bets coverage: sports 832, weather 234, politics 3, crypto/culture/tech/finance/geopolitics 0 (engine tier rule, not an allowlist; main: do not loosen, logged as a decision); "No edge right now" shown.
- Late fix (70fb2fe): the Railway scheduler now uploads kalshi_index.json too (the PR first only had refresh.yml).
Caveats: topic-map 95% is from a hand-written fixture (stated in the PR body); ops/upload.py, scheduler.py and refresh.yml touched.

### Owed to main after F3 merges
- [ ] After the first real Kalshi crawl: share of kalshi_index.json rows with topic "other" and with "<cat>.other" (count per topic too).
- [ ] After the first scheduled refresh following merge: size of the live-branch commit (kalshi_index.json plain size, push size).
- [ ] Retry https://kalshi.com/docs/kalshi-fee-schedule.pdf (429 on 8 attempts on 2026-11-22) and fill Kalshi's multiplier.

## F4 · built locally on launch/data-f04 (stacked on launch/data-f03 70fb2fe), NOT pushed; waiting for F3 to merge, then rebase on origin/final and open the PR
Commits: 32b9e36 (engine/venues.py + upload wiring), 954d200 (web block, store merge, docs/03, tests).
- Design: output/venues.json side file (only markets on 2+ venues), written by `python -m engine kalshi` after the crawl; the web merges it by id (store.ts usableVenues: missing, malformed or stale = no venues); top.ts passes it too so top.json pages match the store.
- Kalshi fee: help.kalshi.com has no formula; the PDF returned 429 on 8 attempts. Kalshi multiplier = null (TODO + URL in engine/venues.py); the block shows its % only and never marks it "Pays most here".
- The matcher's kalshi_ticker stays inside venues.json (copying it to Market.kalshi_ticker would flip the bet button to Kalshi).
- Evidence: pytest engine+ops 158 passed. Precision 1.000 on 50 hand-labeled pairs (TP 22, FP 0, recall 0.957); the first 42 pairs tuned the matcher, the last 8 were held out; the labels are mine, not a live crawl. vitest 1457 passed (api.test timing flake under load, passes alone). typecheck and lint clean. build + check:js 142.5 kB OK. e2e launch-f04-venues.spec.ts 4 passed (390 and 1440).
- Next: ping main before pushing lib/types.ts; open the PR after rebase onto origin/final.

## F14 · not started (plan to main first)
