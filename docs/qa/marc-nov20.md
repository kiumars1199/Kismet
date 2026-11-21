# Marc's QA list (Nov 20, 2026): master log

Orchestrator log for the Nov 21 overnight run. Lane logs: `marc-nov20-lane{A,B,C,D}.md`.
Status: fixed / already fixed / won't fix (why) / not verified live / open.

## Summary
_(filled at the end of the run)_

## Run notes
- PR #10 (agent teams settings) merged to `final` as 67faeaf. Agent teams were not active in this
  session, so the lanes run as 4 parallel subagents in their own worktrees. Only the orchestrator merges.
- Marc's original list is not in the repo. Item descriptions below come from the lane briefs only.
- Lane B one-return plan (Nov 21): roi_pct already equals win% x after-fee pays - 1 (fixture max diff 0.03pp); the bug is presentation. New lib/betQuote.ts feeds card, drawer, tables, /about. Advisor was rate-limited, so the orchestrator reviewed it and approved with notes: export numeric pays for A's #69 sort, Free tier sees bands only, every drawer figure shows its n, card stays 7 slots at 390px.
- Gate note: PRs #11-#13 merged while `check:js` read 150.4-150.8 kB here; origin/final itself was already 150.2-150.6 (over). Cause found by Lane A (not-found/error pulled the client kit into every page); #14 took landing JS to 142.6 kB. Gate is OK from #14 on.
- Pre-existing red test: test/teaser.test.ts "one bet per game" depends on today's UTC date; fails on final before tonight. Lane A asked to pin its clock. test/api.test.ts timing flakes under parallel load and passes alone.
- Lane D's first agent stalled on an MCP permission prompt and made no commits; stopped and respawned with no-MCP rules.
- Merged in order: #10 settings, #11 QA-A 46/60, #12 QA-C 18/48/32/30, #13 QA-C 33, #14 QA-A JS budget. Each deploy READY before the next merge.
- Shared items: 69 (A, then B if still wrong), 48 (B: FAQ copy, C: cancel path).

## Items
| # | Lane | Topic | Status | Evidence | PR |
|---|------|-------|--------|----------|----|
| 2 | A | data staleness vs "~10-minute scans" copy | fixed | copy says scans run about every 15 minutes (Railway: 900 s); /status flags late scans after 45 min | qa-a-freshness |
| 3 | B | backtest headline vs live record | already fixed | calibration sentence 'Why live trails testing' already live | — |
| 4 | B | FAQ contradictions | fixed | FAQ: most best bets win because most pay <1.5x, yet a record can lose money; live hit rate + return shown | qa-b-faq |
| 5 | B | edge labels vs numbers | fixed | labels computed at the quote's price; return <= 0 gets no stars or positive verdict (tested on every fixture bet) | qa-b-return |
| 6 | A | counts disagree | fixed, paid views not verified live | lib/data/counts.ts settledCount/bestBetsCount shared by /status, /about, /api/meta, MCP; exact below 10,000; plural(); Show more counts and hides at end | qa-a-counts |
| 9 | C | Pro modal close; filter loading state | open | | |
| 10 | B | gross vs net | fixed (superseded by one-return change) | card, drawer and stake box show one after-fee payout | qa-b-return |
| 11 | B | gross vs net | fixed (superseded by one-return change) | card, drawer and stake box show one after-fee payout | qa-b-return |
| 13 | A | paid users see Free upsells | fixed, not verified live | /api/me retried with backoff; no paid upsell until plan known | qa-a-plan |
| 14 | B | similar past bets vs testing figure | fixed | one tested figure per payout band from backtest.by_pays (same as /track-record); <30 tested bets says so | qa-b-return |
| 15 | D | combo legs same event; cautious chance | open | | |
| 17 | C | signed-in header consistent | fixed, not verified live | nav links from server (me.nav); same header incl. /kalshi and 404; e2e-paid qa-c-header | qa-c-header |
| 18 | C | /account plan, renewal, manage billing | fixed / not verified live | /account shows plan, trial end, 'Manage billing or cancel'; e2e-paid qa-c-billing 2/2 | #12 |
| 19 | C | saved views list | open | | |
| 20 | B | return/payout disagree | fixed, not verified live | lib/betFigures.ts betQuote is the one source for venue/price/fee/pays/return on card, Why, drawer, tables, panels, MCP; test/one-return.test.tsx checks every fixture bet | qa-b-return |
| 21 | C | /settings links, account sync | open | | |
| 22 | C | onboarding banner, sync | open | | |
| 23 | C | /alerts blank; alert delivery claims | open | | |
| 25 | A | Free limit text on /bets | fixed | Free /bets reads 'Showing 10 of 89 bets' | qa-a-counts |
| 26 | A | counts | fixed, paid views not verified live | lib/data/counts.ts settledCount/bestBetsCount shared by /status, /about, /api/meta, MCP; exact below 10,000; plural(); Show more counts and hides at end | qa-a-counts |
| 27 | A | hydration flashes | partly fixed | times render from one clock server/client; remaining flashes in header (C) and Kalshi (D) files | qa-a-freshness |
| 28 | B | /about Top 3 sort | fixed | /about Top 3 uses BetCard ranked by shown return, $10 stake | qa-b-return |
| 29 | A | hydration flashes | partly fixed | times render from one clock server/client; remaining flashes in header (C) and Kalshi (D) files | qa-a-freshness |
| 30 | C | Free "Start free" goes to signup | fixed | Start free -> signup, covered in qa-c-billing | #12 |
| 31 | B | return/payout disagree | fixed, not verified live | lib/betFigures.ts betQuote is the one source for venue/price/fee/pays/return on card, Why, drawer, tables, panels, MCP; test/one-return.test.tsx checks every fixture bet | qa-b-return |
| 32 | C | trial plan kept through signup | fixed (already worked; now proven) | e2e-paid qa-c-billing: trial keeps plan/period through signup into checkout | #12 |
| 33 | C | 404 for signed-out visitors | fixed | prod: /no-such-page-xyz -> 404 (was 307 /signup) | #13 |
| 34 | A | timestamps lag | fixed | <Ago> ticks every 30 s off the shared clock; pill, Best bets, markets, /status, /kalshi | qa-a-freshness |
| 35 | B | "52 weeks" framing; backtest weeks | fixed | test span reads 'bets in N of M weeks, X% in the last 2'; method note says only N of 52 weeks had bets; even-week rebuild run (see Q decisions) | qa-b-faq |
| 36 | B | backtest vs live | fixed | test span reads 'bets in N of M weeks, X% in the last 2'; method note says only N of 52 weeks had bets; even-week rebuild run (see Q decisions) | qa-b-faq |
| 37 | B | return/payout disagree | fixed, not verified live | lib/betFigures.ts betQuote is the one source for venue/price/fee/pays/return on card, Why, drawer, tables, panels, MCP; test/one-return.test.tsx checks every fixture bet | qa-b-return |
| 38 | C | AI connector allowance | open | | |
| 39 | C | plan cards list only shipped features | open | | |
| 40 | A | paid users see signed-out view | fixed, not verified live | /api/me retried with backoff; no paid upsell until plan known | qa-a-plan |
| 41 | C | /status data-source spacing | already fixed (per brief; to verify) | | |
| 42 | D | combo legs from closed/past markets | open | | |
| 44 | A | timestamps freeze | fixed | <Ago> ticks every 30 s off the shared clock; pill, Best bets, markets, /status, /kalshi | qa-a-freshness |
| 46 | A | CRITICAL stale snapshots | fixed (prod check pending 30-min sample) | SWR limited to copies <5 min old; torn markets/flags loads refused; page publishes its own scanned_at | #11 |
| 47 | A | search accent matching | fixed | invalid ?s= falls back with a note; search folds ø/æ/ß/ł so 'Bodø' doesn't match 'The Body' | qa-a-sort |
| 48 | B+C | FAQ / cancel path | fixed | 'everyone sees the same numbers' reworded (Free sees ranges) on /about, /pricing, /terms, /disclaimer, landing; cancel answer links /account 'Manage billing or cancel' | #12 + qa-b-faq |
| 49 | A | counts | fixed, paid views not verified live | lib/data/counts.ts settledCount/bestBetsCount shared by /status, /about, /api/meta, MCP; exact below 10,000; plural(); Show more counts and hides at end | qa-a-counts |
| 50 | A | "Show every bet" when all show | already fixed | 'Show every bet' removed in T-302; checked code and live | — |
| 51 | B | similar past bets vs testing | fixed | one tested figure per payout band from backtest.by_pays (same as /track-record); <30 tested bets says so | qa-b-return |
| 52 | D | closing-within-a-day legs; past dates | open | | |
| 53 | C | saved view default name | open | | |
| 54 | B | return/payout disagree | fixed, not verified live | lib/betFigures.ts betQuote is the one source for venue/price/fee/pays/return on card, Why, drawer, tables, panels, MCP; test/one-return.test.tsx checks every fixture bet | qa-b-return |
| 55 | B | return/payout disagree | fixed, not verified live | lib/betFigures.ts betQuote is the one source for venue/price/fee/pays/return on card, Why, drawer, tables, panels, MCP; test/one-return.test.tsx checks every fixture bet | qa-b-return |
| 56 | A | counts | fixed, paid views not verified live | lib/data/counts.ts settledCount/bestBetsCount shared by /status, /about, /api/meta, MCP; exact below 10,000; plural(); Show more counts and hides at end | qa-a-counts |
| 57 | A | counts | fixed, paid views not verified live | lib/data/counts.ts settledCount/bestBetsCount shared by /status, /about, /api/meta, MCP; exact below 10,000; plural(); Show more counts and hides at end | qa-a-counts |
| 58 | C | AI connector allowance | open | | |
| 59 | A | counts | fixed, paid views not verified live | lib/data/counts.ts settledCount/bestBetsCount shared by /status, /about, /api/meta, MCP; exact below 10,000; plural(); Show more counts and hides at end | qa-a-counts |
| 60 | A | CRITICAL stale snapshots | fixed (prod check pending) | same as 46 | #11 |
| 61 | B | (already fixed by #5/#6 per brief; to verify) | fixed (superseded by one-return change) | card, drawer and stake box show one after-fee payout | qa-b-return |
| 63 | A | counts | fixed, paid views not verified live | lib/data/counts.ts settledCount/bestBetsCount shared by /status, /about, /api/meta, MCP; exact below 10,000; plural(); Show more counts and hides at end | qa-a-counts |
| 64 | C | alerts sold vs delivered | open | | |
| 65 | D | /combos intro range | open | | |
| 67 | A | timestamps | fixed | <Ago> ticks every 30 s off the shared clock; pill, Best bets, markets, /status, /kalshi | qa-a-freshness |
| 68 | A | sort changes result set | fixed | sort only reorders (pays sort no longer widens tier) | qa-a-sort |
| 69 | A(+B) | "Biggest payout" sort | fixed | 'Biggest payout' sorts by betQuote().pays, the card's after-fee figure (orchestrator repoint) | qa-a-sort + orchestrator |
| 70 | A | counts | fixed, paid views not verified live | lib/data/counts.ts settledCount/bestBetsCount shared by /status, /about, /api/meta, MCP; exact below 10,000; plural(); Show more counts and hides at end | qa-a-counts |
| 71 | A | Show more counter, dead click | fixed, paid views not verified live | lib/data/counts.ts settledCount/bestBetsCount shared by /status, /about, /api/meta, MCP; exact below 10,000; plural(); Show more counts and hides at end | qa-a-counts |
| 72 | C | AI connector allowance | open | | |
| 73 | C | header on /kalshi, 404 | fixed, not verified live | nav links from server (me.nav); same header incl. /kalshi and 404; e2e-paid qa-c-header | qa-c-header |
| 74 | D | label every leg number | open | | |
| 8 | C | /about "Coming soon" (part 1) | already fixed (per brief; to verify) | | |

Items 1, 7, 12, 16, 24, 43, 45, 62, 66 are not in any lane brief and are not tracked here.
