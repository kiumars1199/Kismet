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
| F1 Bet checker | checker | review PASS with notes on 064f521 (CLS fixed); merge waits on the Vercel limit. Follow-up launch/checker-f01b c7e0a4b PASS with notes (Kalshi Use it per side, 640 px card, F2 CLS fix); merges after #43/#45, before F4 #52 | kiumars1199/Kismet#43 | PASS (pre-merge); post-merge check pending |
| F2 Combo checker | checker | review PASS with notes on ef73b2f (one server call per check; CI green); merge after F1, waits on the Vercel limit. Low: CLS 0.141 at 390 when legs arrive after a slow lookup (follow-up) | kiumars1199/Kismet#45 | PASS (pre-merge); post-merge check pending |
| F3 Every market searchable | data | merged 9ad7713; prod check FAIL (polymarket count); fix #59 4e52f3d PASS with notes (CI green); suites green on the exact final+#59 tree; preview for 4e52f3d building, then merge | kiumars1199/Kismet#42 (fix #59; follow-up #60 df67be8 PASS with notes, merges after #59) | fix PASS; prod recheck pending |
| F4 Three venues side by side | data | review PASS with notes on 42ee0ba (CI green). Before merge: rebase after F1/F2/f01b with one kalshi_matched_ticker declaration + Kalshi fixture row and /check e2e | kiumars1199/Kismet#52 | PASS (pre-merge); rebase pending |
| F5 Topics at signup | onboarding-invites | review PASS with notes on ff7c5eb (1-year uid-bound hint, sign-out clears it; CI green); migration 20261122000100 applied just before merge; merge waits on the Vercel limit | kiumars1199/Kismet#47 | PASS (pre-merge); post-merge check pending |
| F6 How to place this bet | checker | all 4 fixes pushed (3668ac3: BetCard How to bet this + RiskNote); re-review queued; F9 wiring after #48 | kiumars1199/Kismet#46 | not reviewed |
| F7 Live payments by config | trust | merged (cd9f672), prod READY, health ok | kiumars1199/Kismet#41 | passed review |
| F8 Responsible betting | trust | merged (651462b); prod PASS with notes (help line, 18+, RiskNote on prod; pause/account verified on merged build with mock); follow-up #54 in review | kiumars1199/Kismet#44 | passed review |
| F9 Venue availability | trust | merged 5a65227 (preview READY on 7b83e4f, CI green, suites green); prod deploy building; post-merge prod check next | kiumars1199/Kismet#48 | PASS (pre-merge); prod check pending |
| F10 Install and web push | alerts | PR open (3234b82; Lighthouse PWA 1; migration 20261122000500); in review queue | kiumars1199/Kismet#56 | not reviewed |
| F11 Bet tracker | tracker | PR open, 31bf544 (one-tap log, P&L by sport, beat-the-close, 50/50 = split); migration 20261123000100_journal_split pending; review queued | kiumars1199/Kismet#58 | not reviewed |
| F12 Morning digest | onboarding-invites | PR open (3862060; opt-in default off); migration renamed to 000400 pending; in review queue | kiumars1199/Kismet#55 | not reviewed |
| F13 Share and invite | onboarding-invites | round 3 pushed 4c3d82a: signed share links (HMAC via existing UNSUBSCRIBE_SECRET; unsigned = teaser), one-line wording, only the recommended side is shared; vitest 1544; re-review queued after F6 | kiumars1199/Kismet#51 | FAIL (round 2, CI); round 3 queued |
| F14 Price history chart | data | review PASS with notes on 581a9de, two findings being fixed: Free cut leaks up to one bucket past scan time; empty state CLS 0.20 at 390 | kiumars1199/Kismet#53 | fixes in progress |
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

- /m at 390: CLS 0.17–0.19 in the e2e env from the paper-trade button mounting after /api/trade/config (data, F14). Reviewer to measure on prod; owner decided after that.

- Kalshi links stay unresolvable after #52: store.ts withVenues drops kalshi_ticker (reviewer, f01b). Owner: data, in #52.

- F13 deferred invite reward waits for the next sign-in if a trial lapses while signed in (reviewer). Follow-up: hook on Stripe subscription-ended. Owner: onboarding, after F13.
- Pre-existing: at 390 on /bets?m=<id> with the tour flag set, the tour dialog sits behind the drawer and can't be dismissed (reviewer, F13). Owner: onboarding; fix kiumars1199/Kismet#61 (2da4dab, tour waits while a drawer is open), review queued.
- Kalshi shows a price only, with the fee not counted (engine/venues.py TODO). The wording is honest; follow-up.

## Fixed log
- F7: passed review (pre-merge PASS + post-merge PASS on cd9f672; evidence review/f07/).
- F15: merged 34f672f with #50; migration 20261122000300 applied to live; prod deploy READY, /api/health ok (03:35 UTC).

## What Q must do
- Vercel Hobby deployment limit hit at 03:57 UTC Nov 23 (140 deployments in 24 h; "retry in 24 hours"). Merges are paused until previews build again. Upgrading the Vercel plan is Q's call; the lead has cut deploy use (docs branch no longer deploys, lanes push once per round).
- Set in Vercel env: `INVITE_IP_SALT` (F13 invite address checks), `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (F10 web push).
- Vercel → kismet → Settings → Functions: confirm function memory is at least 1 GB. The F3 index fix (#59) peaks near 600 MB RSS, and the tools available here can't read this setting.
- Add repo secret `VERCEL_AUTOMATION_BYPASS_SECRET` (Vercel → Settings → Deployment Protection) for preview smoke S3/S5.
- Live Stripe keys and price IDs: follow `docs/launch/go-live.md` (F7 merged).
