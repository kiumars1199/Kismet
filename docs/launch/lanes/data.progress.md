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

### F3 review round 2 (fixes as new commits on launch/data-f03; evidence in docs/launch/review/f03/round2/)
1 server page carries Kalshi (firstPage), e2e direct load /markets?q=Jokic sees "Also on Kalshi" in the HTML. 2 kalshi_topics whole-word keywords, SOL/GOV prefixes, pytest cases + 12 fallback-only fixture series. 3 chip row decided on the server (page.tsx kalshiOn). 4 Kalshi view header counts Kalshi rows, Polymarket-only controls hidden. 5 ven=kalshi with Kalshi off = normal list. 6 CLS: Export CSV row mounted after /api/me and pushed the filter rows 56 px at 390: its row is reserved. Merged origin/final (d02ea98) into the branch.

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

## F14 · built locally on launch/data-f14 (stacked on launch/data-f04), NOT pushed (touches lib/types.ts: ping main first; F3 then F4 must land)
Commits: 0942bd9 (engine/history.py, `history` command, scheduler + upload wiring), 428ad5a (types, docs/03, loader, route, PriceHistory chart, tests).
Raw evidence files in docs/launch/review/f14/ (typecheck, lint, vitest, pytest, check-js, e2e .txt).
- pytest engine+ops 170 passed (12 new in test_history.py, written first). vitest 1464 passed; 1 suite (funnel-db PGlite beforeAll) timed out under load, rerun alone 5 passed. typecheck, lint exit 0. check:js 142.5 kB OK (Recharts dynamic). e2e launch-f14-history 4 passed at 390 and 1440 px.
- Size (fixture-scale, no CLOB call): 280 series = 232,200 B plain / 85,058 B gzipped; x10 for ~2,800 series = ~2.3 MB plain / ~0.85 MB gzipped. No prefix split needed.
- LIMITATION: Polymarket only (no US/Kalshi history); basis line "Prices from Polymarket, every <interval>"; interval 1 h up to ~8 days, 11 h at 90 days.
- refresh.yml (commit after 428ad5a): now runs `engine kalshi` and `engine history` in a best-effort step (continue-on-error) after the scan, seeds data/history.json from the live branch copy, and uploads the side files if present. `engine kalshi` is a no-op unless the repo variable KALSHI_DATA_PERMISSION=true; venues.json is always written.
- CONFIRMED by main (read from Railway service config, no changes): service Kismet (production) has volume kismet-volume (5000 MB) mounted at /app/data. State this in the F14 PR body. First-run 240 s cold fetch happens only on an empty volume.
- Railway persistence (from the repo, no live calls): engine/Dockerfile says "Mount a persistent volume at /app/data (market history + output/)", output is symlinked to data/output, ops/scheduler.py drop_root chowns the volume, VOLUME_BYTES assumes a 5 GB volume, last-run times survive restarts "on the data volume". So data/ and output/ persist across restarts IF the volume is actually mounted in Railway (railway.json has no volume config; volumes are set in the dashboard, which I cannot check). Therefore the 240 s cold fetch happens only on an empty volume; later runs only refresh tails. Cost on the volume: history.json is ~0.85 MB gzipped / ~2.3 MB plain, twice (data/ cache + output/).
- Cache for incremental refresh: data/history.json (volume) else output/history.json.

## F4 · PR open https://github.com/kiumars1199/Kismet/pull/52 (head da59363, merged with origin/final 9ad7713). pytest 161, tsc/lint 0, vitest 1475 (+1 timing flake, alone 7/7), check:js 142.5 kB OK, e2e f04 4 passed.
## F14 · PR open https://github.com/kiumars1199/Kismet/pull/53 (head 05e7f98, stacked on F4). pytest 173, tsc/lint 0, vitest 1486, check:js 142.5 kB OK, e2e f14 4 passed. Merge #52 first.
## F3 follow-ups: live branch (fetched 2026-11-22, last commit 20:52 UTC) has no kalshi_index.json yet, so topic "other" share and its size cannot be measured until the first scheduled refresh after F3. Live branch today: markets.json 32.7 MB, flags.json 9.1 MB, plus *-prev copies. Kalshi fee multiplier still null (PDF 429).

## Nov 23 respawn: F3 production fix (branch launch/data-f03b, from origin/final 651462b) - IN PROGRESS
Finding (read-only): counts.polymarket = markets.json rows = rows the model scores (2 outcomes, bid+ask, close 0.5h-240h, <=500 events/tag). Railway logs 2026-11-22 21:19..2026-11-23 03:11: "open markets fetched" 74308->68709, "scanned" 14402..16316, recovering overnight (15428 at 03:11): the window, not a pagination bug.
Replay of fetch_open on 2026-11-23 (Gamma GET /events?closed=false&active=true&order=volume&tag_slug=<27 tags>, pages of 100 to 500): 102,504 ids, 34,049 closed/not accepting, 68,455 kept; dropped before model: 21,446 >240h, 20,596 no bid/ask, 7,515 bad quote, 3,050 <0.5h, 389 no date; 15,459 scored. 8 tags hit the 500-event cap.
Whole venue (GET /events/keyset?closed=false&active=true&limit=100): 16,277 events, 300,732 markets, 143,349 accepting orders (all binary), 75,880 with bid+ask.
Fix (main approved): engine/pm_index.py -> output/polymarket_index.json (143,194 rows, 34.7 MB plain, 2.06 MB gzipped, 92 s crawl, hourly, scheduler step after kalshi, side file); web: lib/data/polymarket-index.ts, `unpriced` in /api/markets (top 10 + total, "Not priced yet", no price, never flags), /api/meta counts.polymarket = priced + unpriced, counts.polymarket_priced kept; Kalshi index keeps last good copy.
Perf (local, real 13,971-market store + real 143K PM index + synthetic 172,680 Kalshi index): next-server VmHWM 676 MB (<1 GB); 40 requests (20 queries x2) p95 0.199 s, max 0.343 s.

## Nov 23 respawn summary (end of this run)
- F3 fix PR #59 (launch/data-f03b, head 4e52f3d): passed review, merging. Finding + numbers in the PR body.
- F4 #52 (launch/data-f04): pushed 39e3f74 (venues from the card's own row, Kalshi snapshot <= store scan, basis expand, 44 px summary). LOCAL, NOT PUSHED: commit "expose the matched Kalshi ticker (kalshi_matched_ticker)". Main asked for kalshi_ticker itself; I used a separate field because kalshi_ticker flips the bet venue (venueOf/Trade/combos/MCP); awaiting main's call. Hold the /check e2e until F1 #43 is in final; rebase on final after #59 lands.
- F14 #53 (launch/data-f14): pushed f292928 (360 px card, live CLOB fallback, Free cut, details). Needs `git merge launch/data-f04` after the local F4 commit is pushed.
- Follow-up (launch/data-f03c, df67be8, stacked on #59 head, LOCAL, NOT PUSHED): polymarket_index_meta.json conditional download, scheduler comment. PR title suggestion "F3: download the Polymarket index only when it changed".
- Vercel daily deploy limit hit 03:57 UTC: one push per round.
