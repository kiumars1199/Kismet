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
- Shared items: 69 (A, then B if still wrong), 48 (B: FAQ copy, C: cancel path).

## Items
| # | Lane | Topic | Status | Evidence | PR |
|---|------|-------|--------|----------|----|
| 2 | A | data staleness vs "~10-minute scans" copy | open | | |
| 3 | B | backtest headline vs live record | open | | |
| 4 | B | FAQ contradictions | open | | |
| 5 | B | edge labels vs numbers | open | | |
| 6 | A | counts disagree | open | | |
| 9 | C | Pro modal close; filter loading state | open | | |
| 10 | B | gross vs net | open | | |
| 11 | B | gross vs net | open | | |
| 13 | A | paid users see Free upsells | open | | |
| 14 | B | similar past bets vs testing figure | open | | |
| 15 | D | combo legs same event; cautious chance | open | | |
| 17 | C | signed-in header consistent | open | | |
| 18 | C | /account plan, renewal, manage billing | open | | |
| 19 | C | saved views list | open | | |
| 20 | B | return/payout disagree | open | | |
| 21 | C | /settings links, account sync | open | | |
| 22 | C | onboarding banner, sync | open | | |
| 23 | C | /alerts blank; alert delivery claims | open | | |
| 25 | A | Free limit text on /bets | open | | |
| 26 | A | counts | open | | |
| 27 | A | hydration flashes | open | | |
| 28 | B | /about Top 3 sort | open | | |
| 29 | A | hydration flashes | open | | |
| 30 | C | Free "Start free" goes to signup | open | | |
| 31 | B | return/payout disagree | open | | |
| 32 | C | trial plan kept through signup | open | | |
| 33 | C | 404 for signed-out visitors | open | | |
| 34 | A | timestamps lag | open | | |
| 35 | B | "52 weeks" framing; backtest weeks | open | | |
| 36 | B | backtest vs live | open | | |
| 37 | B | return/payout disagree | open | | |
| 38 | C | AI connector allowance | open | | |
| 39 | C | plan cards list only shipped features | open | | |
| 40 | A | paid users see signed-out view | open | | |
| 41 | C | /status data-source spacing | already fixed (per brief; to verify) | | |
| 42 | D | combo legs from closed/past markets | open | | |
| 44 | A | timestamps freeze | open | | |
| 46 | A | CRITICAL stale snapshots | open | | |
| 47 | A | search accent matching | open | | |
| 48 | B+C | FAQ / cancel path | open | | |
| 49 | A | counts | open | | |
| 50 | A | "Show every bet" when all show | open | | |
| 51 | B | similar past bets vs testing | open | | |
| 52 | D | closing-within-a-day legs; past dates | open | | |
| 53 | C | saved view default name | open | | |
| 54 | B | return/payout disagree | open | | |
| 55 | B | return/payout disagree | open | | |
| 56 | A | counts | open | | |
| 57 | A | counts | open | | |
| 58 | C | AI connector allowance | open | | |
| 59 | A | counts | open | | |
| 60 | A | CRITICAL stale snapshots | open | | |
| 61 | B | (already fixed by #5/#6 per brief; to verify) | open | | |
| 63 | A | counts | open | | |
| 64 | C | alerts sold vs delivered | open | | |
| 65 | D | /combos intro range | open | | |
| 67 | A | timestamps | open | | |
| 68 | A | sort changes result set | open | | |
| 69 | A(+B) | "Biggest payout" sort | open | | |
| 70 | A | counts | open | | |
| 71 | A | Show more counter, dead click | open | | |
| 72 | C | AI connector allowance | open | | |
| 73 | C | header on /kalshi, 404 | open | | |
| 74 | D | label every leg number | open | | |
| 8 | C | /about "Coming soon" (part 1) | already fixed (per brief; to verify) | | |

Items 1, 7, 12, 16, 24, 43, 45, 62, 66 are not in any lane brief and are not tracked here.
