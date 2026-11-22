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
| F1 Bet checker | checker | fixes pushed (8818178); re-review queued; Kalshi own price after F3 merge | kiumars1199/Kismet#43 | not reviewed |
| F2 Combo checker | checker | fixes pushed (leg route lookup only, combo counted once, "Why these numbers?"); re-review queued | kiumars1199/Kismet#45 | not reviewed |
| F3 Every market searchable | data | merged (9ad7713); reviewer round 2 PASS on preview; prod post-merge check pending | kiumars1199/Kismet#42 | preview PASS; prod check pending |
| F4 Three venues side by side | data | built locally; PR after F3 merges | — | not reviewed |
| F5 Topics at signup | onboarding-invites | fixes pushed (2325297: HTTP 307, CLS 0.051/0.017); re-review queued; migration topics_off | kiumars1199/Kismet#47 | not reviewed |
| F6 How to place this bet | checker | review FAIL (no How-to-bet on cards; intl default without availability; step sources not shown; duplicate afford note); fixing | kiumars1199/Kismet#46 | not reviewed |
| F7 Live payments by config | trust | merged (cd9f672), prod READY, health ok | kiumars1199/Kismet#41 | passed review |
| F8 Responsible betting | trust | review PASS (f1d4e3e); migration applied; merging after F3 rebase. Follow-up: /api/trade/config 423 while paused | kiumars1199/Kismet#44 | not reviewed |
| F9 Venue availability | trust | review FAIL (/markets icon links lack availability note; Kalshi/PM US all unverified so never "available"); fixing | kiumars1199/Kismet#48 | not reviewed |
| F10 Install and web push | alerts | not started | | not reviewed |
| F11 Bet tracker | tracker | not started | | not reviewed |
| F12 Morning digest | onboarding-invites | not started | | not reviewed |
| F13 Share and invite | onboarding-invites | PR open (cf5f783); evidence + check:js pending; migration 20261122000200 | kiumars1199/Kismet#51 | not reviewed |
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
