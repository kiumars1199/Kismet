# Kismet launch status

Summary: (written at the end)

Plan: `SPEC.md` (definition of done), `decisions.md`, lane briefs and progress in `lanes/`. The lead updates this
file after every merge. "Review result" says "passed review" only after the reviewer's pass on the merged code.

## Phase 0 close-out
| Item | PR | Status |
|---|---|---|
| a. Marc's filters, date range, owner payment alerts | kiumars1199/Kismet#33 | CI re-running on latest final |
| b. Combos multiply line | kiumars1199/Kismet#37 | CI running |
| c. My list "Couldn't load, retry" | kiumars1199/Kismet#38 | CI running |
| d. Phone layout in the first HTML | kiumars1199/Kismet#39 | CI running |
| e. Smoke S3/S5 on previews | kiumars1199/Kismet#40 | CI running; needs repo secret (Q) |

## Features
| Feature | Owner | Status | PR | Review result |
|---|---|---|---|---|
| F1 Bet checker | checker | not started | | not reviewed |
| F2 Combo checker | checker | not started | | not reviewed |
| F3 Every market searchable | data | not started | | not reviewed |
| F4 Three venues side by side | data | not started | | not reviewed |
| F5 Topics at signup | onboarding-invites | not started | | not reviewed |
| F6 How to place this bet | checker | not started | | not reviewed |
| F7 Live payments by config | trust | in review | kiumars1199/Kismet#41 | not reviewed |
| F8 Responsible betting | trust | not started | | not reviewed |
| F9 Venue availability | trust | not started | | not reviewed |
| F10 Install and web push | alerts | not started | | not reviewed |
| F11 Bet tracker | tracker | not started | | not reviewed |
| F12 Morning digest | onboarding-invites | not started | | not reviewed |
| F13 Share and invite | onboarding-invites | not started | | not reviewed |
| F14 Price history chart | data | not started | | not reviewed |
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

## Fixed log
(empty)

## What Q must do
- Add repo secret `VERCEL_AUTOMATION_BYPASS_SECRET` (Vercel → Settings → Deployment Protection) for preview smoke S3/S5.
- Live Stripe keys and price IDs (see `go-live.md` once F7 lands).
