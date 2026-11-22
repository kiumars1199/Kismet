# Kismet launch status

Summary: (written at the end)

Plan: `SPEC.md` (definition of done), `decisions.md`, lane briefs and progress in `lanes/`. The lead updates this
file after every merge. "Review result" says "passed review" only after the reviewer's pass on the merged code.

## Phase 0 close-out
| Item | PR | Status |
|---|---|---|
| a. Marc's filters, date range, owner payment alerts | kiumars1199/Kismet#33 | merged, prod READY (5a0de12) |
| b. Combos multiply line | kiumars1199/Kismet#37 | merged, prod READY (bc23e3b) |
| c. My list "Couldn't load, retry" | kiumars1199/Kismet#38 | merged, prod READY (023f505) |
| d. Phone layout in the first HTML | kiumars1199/Kismet#39 | merged, prod READY (13303de) |
| e. Smoke S3/S5 on previews | kiumars1199/Kismet#40 | merged (d02ea98); job skips until Q adds repo secret VERCEL_AUTOMATION_BYPASS_SECRET |

## Features
| Feature | Owner | Status | PR | Review result |
|---|---|---|---|---|
| F1 Bet checker | checker | in review (2 open items: signed-out search, Kalshi price) | kiumars1199/Kismet#43 | not reviewed |
| F2 Combo checker | checker | in review (stacked on #43; 2 open items after BetCard) | kiumars1199/Kismet#45 | not reviewed |
| F3 Every market searchable | data | review FAIL (direct-load search drops Kalshi; topic substring misfires; chip-row CLS; Kalshi header counts; ven=kalshi off-state); fixing | kiumars1199/Kismet#42 | not reviewed |
| F4 Three venues side by side | data | built locally; PR after F3 merges | — | not reviewed |
| F5 Topics at signup | onboarding-invites | PR open; fixture Politics + 390/1440 + CLS being added; migration topics_off (lead applies before merge) | kiumars1199/Kismet#47 | not reviewed |
| F6 How to place this bet | checker | PR open (stacked on #45); 2 unsourced guide steps being fixed | kiumars1199/Kismet#46 | not reviewed |
| F7 Live payments by config | trust | merged (cd9f672) after review PASS + full suites on final (e2e 88/88); post-merge check pending | kiumars1199/Kismet#41 | not reviewed |
| F8 Responsible betting | trust | PR open; afford note being added | kiumars1199/Kismet#44 | not reviewed |
| F9 Venue availability | trust | not started | | not reviewed |
| F10 Install and web push | alerts | not started | | not reviewed |
| F11 Bet tracker | tracker | not started | | not reviewed |
| F12 Morning digest | onboarding-invites | not started | | not reviewed |
| F13 Share and invite | onboarding-invites | not started | | not reviewed |
| F14 Price history chart | data | built locally (stacked on F4); PR after F3 + F4 | not reviewed |
| F15 Admin metrics | trust | not started | | not reviewed |
| F16 Big trade alert | alerts | not started | | not reviewed |

Merge order: F3, F1, F2, F5, F7, F8, F9, then F4, F6, F10–F16.

## Walk-through 1: first-time visitor from a TikTok link
Status: not yet walked (after all merges).
Problems:
- not walked yet

## Walk-through 2: new Free user
Status: not yet walked.
Problems:
- not walked yet

## Walk-through 3: Pro user building a combo
Status: not yet walked.
Problems:
- not walked yet

## Found in review, outside a lane
- /markets at 390 px: CLS 0.27 on `final` from the "Quick filters" row shifting (reviewer, F3 review). Owner: assigned when a lane frees up; must be fixed before walk-throughs.

## Fixed log
(empty)

## What Q must do
- Add repo secret `VERCEL_AUTOMATION_BYPASS_SECRET` (Vercel → Settings → Deployment Protection) for preview smoke S3/S5.
- Live Stripe keys and price IDs: follow `docs/launch/go-live.md` (F7 merged).
