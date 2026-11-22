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
| F1 Bet checker | checker | review FAIL (no card Check link; result CLS 0.374@390; closed markets scored; paid limit e2e isolation; e2e gaps; price range; venue line); fixing | kiumars1199/Kismet#43 | not reviewed |
| F2 Combo checker | checker | review FAIL (leg route bypasses Free limit; no basis on combo result); fixing after F1 | kiumars1199/Kismet#45 | not reviewed |
| F3 Every market searchable | data | review FAIL (direct-load search drops Kalshi; topic substring misfires; chip-row CLS; Kalshi header counts; ven=kalshi off-state); fixing | kiumars1199/Kismet#42 | not reviewed |
| F4 Three venues side by side | data | built locally; PR after F3 merges | — | not reviewed |
| F5 Topics at signup | onboarding-invites | review FAIL (post-onboarding CLS 1.848@390; redirect is a meta refresh, not HTTP; hard-coded screenshot path); fixing; migration topics_off (lead applies before merge) | kiumars1199/Kismet#47 | not reviewed |
| F6 How to place this bet | checker | PR open (stacked on #45); 2 unsourced guide steps being fixed | kiumars1199/Kismet#46 | not reviewed |
| F7 Live payments by config | trust | merged (cd9f672), prod READY, health ok | kiumars1199/Kismet#41 | passed review |
| F8 Responsible betting | trust | PR open (head f1d4e3e; RiskNote by every bet button, icon links via aria); in review queue; migration paused_until (lead applies before merge) | kiumars1199/Kismet#44 | not reviewed |
| F9 Venue availability | trust | PR open, stacked on #44 (Kalshi/Polymarket US unverified per state, intl restricted); in review queue; check:js trimmed to 143.8 kB (09d9ca1) | kiumars1199/Kismet#48 | not reviewed |
| F10 Install and web push | alerts | not started | | not reviewed |
| F11 Bet tracker | tracker | not started | | not reviewed |
| F12 Morning digest | onboarding-invites | not started | | not reviewed |
| F13 Share and invite | onboarding-invites | plan approved; building | | not reviewed |
| F14 Price history chart | data | built locally (stacked on F4); PR after F3 + F4 | not reviewed |
| F15 Admin metrics | trust | PR open (head c8d68a1); in review queue; migration 20261122000300 (lead applies before merge) | kiumars1199/Kismet#49 | not reviewed |
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
- /markets at 390 px: CLS 0.27 on `final` from the "Quick filters" row shifting (reviewer, F3 review). Owner: data, in the F3 fix PR (same page, same kind of shift).
- e2e-paid/admin.spec.ts fails on clean `final` (page.goto ERR_ABORTED) (trust, F15). Owner: trust, separate fix PR.

## Fixed log
- F7: passed review (pre-merge PASS + post-merge PASS on cd9f672; evidence review/f07/).

## What Q must do
- Add repo secret `VERCEL_AUTOMATION_BYPASS_SECRET` (Vercel → Settings → Deployment Protection) for preview smoke S3/S5.
- Live Stripe keys and price IDs: follow `docs/launch/go-live.md` (F7 merged).
