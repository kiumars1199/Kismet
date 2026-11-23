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
| F1 Bet checker | checker | review PASS with notes on 064f521 (CLS fixed); suites green on final+#59+F1 (vitest 1555, e2e 123), CI green; preview refused by the Vercel API daily cap at 06:50, retrying. Follow-up launch/checker-f01b c7e0a4b PASS with notes (Kalshi Use it per side, 640 px card, F2 CLS fix); merges after #43/#45, before F4 #52 | kiumars1199/Kismet#43 | PASS (pre-merge); post-merge check pending |
| F2 Combo checker | checker | review PASS with notes on ef73b2f (one server call per check; CI green); merge after F1, waits on the Vercel limit. Low: CLS 0.141 at 390 when legs arrive after a slow lookup (follow-up) | kiumars1199/Kismet#45 | PASS (pre-merge); post-merge check pending |
| F3 Every market searchable | data | merged 9ad7713 + fix #59 67cab85; prod READY, health ok. Prod recheck PASS with notes: counts.polymarket 143222 vs keyset crawl 143401 (99.9%); 12/12 sampled open markets found (local stand-in, prod search is behind sign-up); /markets CLS 0.02–0.068 at 390 (the count line wraps on 2 of 9 loads; low) | kiumars1199/Kismet#42, kiumars1199/Kismet#59 (follow-up #60 in batch 1) | passed review |
| F4 Three venues side by side | data | review PASS with notes on 42ee0ba (CI green). Before merge: rebase after F1/F2/f01b with one kalshi_matched_ticker declaration + Kalshi fixture row and /check e2e | kiumars1199/Kismet#52 | PASS (pre-merge); rebase pending |
| F5 Topics at signup | onboarding-invites | review PASS with notes on ff7c5eb (1-year uid-bound hint, sign-out clears it; CI green); migration 20261122000100 applied just before merge; merge waits on the Vercel limit | kiumars1199/Kismet#47 | PASS (pre-merge); post-merge check pending |
| F6 How to place this bet | checker | PASS with notes on 3668ac3; F9 wiring 57ed4de PASS with notes (CA/NV/none verified in browser, F9 JSON not in client bundle, check:js 146.6 kB). Merge after F1/F2 once CI web is green on 57ed4de. Guide line will reuse trust's signed-out state picker | kiumars1199/Kismet#46 | PASS (pre-merge); post-merge check pending |
| F7 Live payments by config | trust | merged (cd9f672), prod READY, health ok | kiumars1199/Kismet#41 | passed review |
| F8 Responsible betting | trust | merged (651462b); prod PASS with notes (help line, 18+, RiskNote on prod; pause/account verified on merged build with mock); follow-up #54 1979f82 PASS with notes (paused users get 423 from trade config; CI green), batch 2 | kiumars1199/Kismet#44 | passed review |
| F9 Venue availability | trust | merged 5a65227, prod READY, health ok. Prod check FAIL: signed out, "Check your state" goes to /settings#state behind the sign-up wall, so the note can never change. Fix #63 315b0db review FAIL: open redirect via tab/CR/LF in next; NV note never shows on static "/" (cookie read server-side). Trust fixing after the CI heap PR | kiumars1199/Kismet#48 | FAIL (prod); fix in progress |
| F10 Install and web push | alerts | PR open (3234b82; Lighthouse PWA 1; migration 20261122000500); in review queue | kiumars1199/Kismet#56 | not reviewed |
| F11 Bet tracker | tracker | PR open, 31bf544 (one-tap log, P&L by sport, beat-the-close, 50/50 = split); migration 20261123000100_journal_split pending; review queued | kiumars1199/Kismet#58 | not reviewed |
| F12 Morning digest | onboarding-invites | PR open (3862060; opt-in default off); migration renamed to 000400 pending; in review queue | kiumars1199/Kismet#55 | not reviewed |
| F13 Share and invite | onboarding-invites | round 4 79639df review FAIL: "flagged" was implemented as edge > 0, so 105 positive-edge non-flags still render numbers and get signed links. Fix: flag membership + recommended side, judged on one store. Signed links, teaser fallback and flagged card all pass | kiumars1199/Kismet#51 | FAIL (round 4); round 5 in progress |
| F14 Price history chart | data | 59831df review FAIL: the reserved trade slot stays empty forever for users not on the allow-list; the 50 px jump at 390 remains (0.15–0.19; AddToCombo also mounts late and wraps the row); conflicts with final, so no CI. Free cut, as_of and empty state still pass. Data fixing | kiumars1199/Kismet#53 | FAIL (round 4) |
| F15 Admin metrics | trust | merged 34f672f with #50 (1376182); migration 000300 live; full suites green (search 300 ms flake passed 21/21 alone). Notes left for follow-up: MRR/churn blocks disagree; yearly priced at monthly | kiumars1199/Kismet#49 | passed review |
| F16 Big trade alert | alerts | PR open (e3287b0, stacked on F10; migration 000600); in review queue | kiumars1199/Kismet#57 | not reviewed |

Merge order: F3, F1, F2, F5, F7, F8, F9, then F4, F6, F10–F16.

Batch 1 (decisions.md, Vercel cap): F1 #43 064f521, F2 #45 ef73b2f, f01b kiumars1199/Kismet#64 ae4e3eb, #60 df67be8, F6 #46 57ed4de, #61 0107058, #62 70d8f6b. Integ tree integ-b1 v1 (c5abb7f, first five) green: tsc, lint, vitest 1594 + timing test passes alone, pytest 164, build, check:js 146.8 kB, e2e 129. f01b delta PASS; v2 (b99788b, +#61 +#62) suites running; one preview when a slot frees (~08:40 UTC), then merges and one prod build.

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

- /m at 390: (a) paper-trade button mounts after /api/trade/config and shifts 0.15–0.18 (only users who see the paper ticket). Owner: data, one commit on F14. (b) footer jump 0.432 on some loads from a bare <Suspense> in app/m/[id]/page.tsx:75 (same as /event). Owner: onboarding, added to #62. Prod signed out measured 0 (teaser).

- Kalshi links stay unresolvable after #52: store.ts withVenues drops kalshi_ticker (reviewer, f01b). Owner: data, in #52.

- F13 deferred invite reward waits for the next sign-in if a trial lapses while signed in (reviewer). Follow-up: hook on Stripe subscription-ended. Owner: onboarding, after F13.
- Pre-existing: at 390 on /bets?m=<id> with the tour flag set, the tour dialog sits behind the drawer and can't be dismissed (reviewer, F13). Owner: onboarding; fix kiumars1199/Kismet#61 0107058 review PASS (CI green); joins batch 1.
- Kalshi shows a price only, with the fee not counted (engine/venues.py TODO). The wording is honest; follow-up.

- /event/<id> at 390: CLS 0.436 on 8 of 15 cold loads; the footer is pushed down when EventView streams in under a bare <Suspense> with no fallback (app/event/[id]/page.tsx:62). Found by the reviewer on final during F6. Owner: onboarding; fix kiumars1199/Kismet#62 70d8f6b review PASS with notes (48 cold loads, no footer swap; CI green); joins batch 1.

- CI: e2e-paid on `next dev` fails with memory restarts / ECONNRESET on three branches (F13, F14, #61), never on final (reviewer). Owner: trust, PR "CI: run paid e2e on a production server".

- /markets at 390: the count line ("N markets match · …") wraps from 1 to 2 lines about 1–2 s in on 2 of 9 loads, CLS 0.068 (reviewer, F3 prod). Under budget; low. Owner: data, after F4.
- f01b + #52 both declare `kalshi_matched_ticker`: whichever merges second drops one line (data, in the #52 rebase). Until #52 lands, pasted Kalshi links still show "missing".

- #54 note: /api/trade/config reads the user's profile even when trading is off on the deploy; check tradingEnv/extensionId first (reviewer). Low; owner trust, after #63.

## Fixed log
- F7: passed review (pre-merge PASS + post-merge PASS on cd9f672; evidence review/f07/).
- F3: passed review (prod recheck on 67cab85, evidence review/f03/prod67cab85/).
- F15: merged 34f672f with #50; migration 20261122000300 applied to live; prod deploy READY, /api/health ok (03:35 UTC).

## What Q must do
- Vercel Hobby deployment limit hit at 03:57 UTC Nov 23 (140 deployments in 24 h; "retry in 24 hours"). Merges are paused until previews build again. Upgrading the Vercel plan is Q's call; the lead has cut deploy use (docs branch no longer deploys, lanes push once per round).
- Set in Vercel env: `INVITE_IP_SALT` (F13 invite address checks), `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (F10 web push).
- Vercel → kismet → Settings → Functions: confirm function memory is at least 1 GB. The F3 index fix (#59) peaks near 600 MB RSS, and the tools available here can't read this setting.
- Add repo secret `VERCEL_AUTOMATION_BYPASS_SECRET` (Vercel → Settings → Deployment Protection) for preview smoke S3/S5.
- Live Stripe keys and price IDs: follow `docs/launch/go-live.md` (F7 merged).
