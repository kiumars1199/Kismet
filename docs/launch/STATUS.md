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
| F1 Bet checker | checker | round 2 fixes pushed (064f521: CLS, Kalshi own Yes price); re-review queued first | kiumars1199/Kismet#43 | not reviewed (round 3 queued) |
| F2 Combo checker | checker | round 2 fixes pushed (ef73b2f: scores only on 'Check this combo', one server call); re-review queued | kiumars1199/Kismet#45 | not reviewed (round 3 queued) |
| F3 Every market searchable | data | merged 9ad7713; prod check FAIL (polymarket count); fix PR #59 bb4ce62 (polymarket_index.json, 143K rows) queued first for review | kiumars1199/Kismet#42 (fix #59) | prod check FAIL |
| F4 Three venues side by side | data | review FAIL (Free sees undelayed venue prices; US row contradicts card; no basis); fixing | kiumars1199/Kismet#52 | not reviewed |
| F5 Topics at signup | onboarding-invites | round 3 FAIL (9b07e14): 15-min hint makes the first visit each day unfiltered; sign-out race re-sets the cookie; fixing | kiumars1199/Kismet#47 | FAIL (round 3) |
| F6 How to place this bet | checker | all 4 fixes pushed (3668ac3: BetCard How to bet this + RiskNote); re-review queued; F9 wiring after #48 | kiumars1199/Kismet#46 | not reviewed |
| F7 Live payments by config | trust | merged (cd9f672), prod READY, health ok | kiumars1199/Kismet#41 | passed review |
| F8 Responsible betting | trust | merged (651462b); prod PASS with notes (help line, 18+, RiskNote on prod; pause/account verified on merged build with mock); follow-up #54 in review | kiumars1199/Kismet#44 | passed review |
| F9 Venue availability | trust | review PASS (aaa9198) but GitHub CI web job FAILS: 'Check your state' link is a 96×15 tap target on iPhone projects; fix assigned (tracker, trust lane is closed) | kiumars1199/Kismet#48 | PASS, CI red (merge blocked) |
| F10 Install and web push | alerts | PR open (3234b82; Lighthouse PWA 1; migration 20261122000500); in review queue | kiumars1199/Kismet#56 | not reviewed |
| F11 Bet tracker | tracker | PR open, 31bf544 (one-tap log, P&L by sport, beat-the-close, 50/50 = split); migration 20261123000100_journal_split pending; review queued | kiumars1199/Kismet#58 | not reviewed |
| F12 Morning digest | onboarding-invites | PR open (3862060; opt-in default off); migration renamed to 000400 pending; in review queue | kiumars1199/Kismet#55 | not reviewed |
| F13 Share and invite | onboarding-invites | review FAIL (/api/og/bet 401 signed out and not used as og:image; pending invites never promoted; OG chance differs from drawer; reward skipped permanently for trial/paid Premium at 5th invite; conflicts); fixing | kiumars1199/Kismet#51 | not reviewed |
| F14 Price history chart | data | review FAIL (empty-state CLS 0.188/0.108; history only for flag rows); fixing | kiumars1199/Kismet#53 |
| F15 Admin metrics | trust | merged 34f672f with #50 (1376182); migration 000300 live; full suites green (search 300 ms flake passed 21/21 alone). Notes left for follow-up: MRR/churn blocks disagree; yearly priced at monthly | kiumars1199/Kismet#49 | passed review |
| F16 Big trade alert | alerts | PR open (e3287b0, stacked on F10; migration 000600); in review queue | kiumars1199/Kismet#57 | not reviewed |

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
- ~~e2e-paid/admin.spec.ts ERR_ABORTED on final~~ fixed by #50 (merged).
- F15 review notes (admin only, not user-facing): the MRR and churn blocks disagree, and yearly plans are counted at the monthly price. Owner: lead to assign as a small follow-up once a lane frees up.

## Fixed log
- F7: passed review (pre-merge PASS + post-merge PASS on cd9f672; evidence review/f07/).
- F15: merged 34f672f with #50; migration 20261122000300 applied to live; prod deploy READY, /api/health ok (03:35 UTC).

## What Q must do
- Add repo secret `VERCEL_AUTOMATION_BYPASS_SECRET` (Vercel → Settings → Deployment Protection) for preview smoke S3/S5.
- Live Stripe keys and price IDs: follow `docs/launch/go-live.md` (F7 merged).
