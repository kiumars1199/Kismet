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
| F1 Bet checker | checker | merged 2bff4d5 (+ follow-up #64 6c02f4c); prod READY. Post-merge prod check queued with the reviewer. Post-merge PASS: 4 cards with Check, CLS 0; Free 1/day then 429, Pro 20 OK (prod /check is BotID-blocked for headless, expected) | kiumars1199/Kismet#43, kiumars1199/Kismet#64 | passed review |
| F2 Combo checker | checker | merged 4af89fd; prod READY. Post-merge prod check queued. Low: CLS 0.141 at 390 when legs arrive after a slow lookup (follow-up). Post-merge PASS: /check/combo CLS 0, launch-f02 green | kiumars1199/Kismet#45 | passed review |
| F3 Every market searchable | data | merged 9ad7713 + fix #59 67cab85; prod READY, health ok. Prod recheck PASS with notes: counts.polymarket 143222 vs keyset crawl 143401 (99.9%); 12/12 sampled open markets found (local stand-in, prod search is behind sign-up); /markets CLS 0.02–0.068 at 390 (the count line wraps on 2 of 9 loads; low). Post-merge PASS: launch-f03-search green (prod search BotID-blocked for headless) | kiumars1199/Kismet#42, kiumars1199/Kismet#59 (follow-up #60 in batch 1) | passed review |
| F4 Three venues side by side | data | 6bed452 review PASS: Kalshi multiplier from the published taker fee (0.50 → 1.92x), Kalshi can win Pays most here, "Not available right now" state. CI web green; merged a7c3ae5. Follow-up: fee per $100 reference order (longshots understated) | kiumars1199/Kismet#52 | passed review |
| F5 Topics at signup | onboarding-invites | migration 20261122000100 applied, merged e8068f5; prod READY. Post-merge check queued. Post-merge PASS: topics pill on landing, CLS ≤ 0.003, all 3 plans at 390/1440 | kiumars1199/Kismet#47 | passed review |
| F6 How to place this bet | checker | PASS with notes (3668ac3 + 57ed4de). GitHub reported a conflict with final, so final was merged in (ea5ccff, same tree as a clean merge); CI web failed on the next dev memory restart (fixed by #65). Merges after #65. Post-merge PASS on prod 2a987ba: How to bet this on every card, 3 steps + sources, live deep link, no cents | kiumars1199/Kismet#46 | passed review |
| F7 Live payments by config | trust | merged (cd9f672), prod READY, health ok | kiumars1199/Kismet#41 | passed review |
| F8 Responsible betting | trust | merged (651462b); prod PASS with notes (help line, 18+, RiskNote on prod; pause/account verified on merged build with mock); follow-up #54 1979f82 PASS with notes (paused users get 423 from trade config; CI green), batch 2 | kiumars1199/Kismet#44 | passed review |
| F9 Venue availability | trust | merged 5a65227; prod FAIL (signed-out state link hit the sign-up wall). Fix #63 round 2 e52cafb PASS with notes (open redirect closed: 20 hostile `next` values all land on "/"; NV note shows on static "/" for all plans at 390/1440, CLS ≤ 0.0006). Final merged in (5c219ea, same patch, CI green); fix merged ac1b517 at 09:50 UTC. Post-merge PASS on prod ac1b517: state link reaches /state, NV note persists, 22 redirect payloads stay same-origin | kiumars1199/Kismet#48, kiumars1199/Kismet#63 | passed review |
| F10 Install and web push | alerts | migrations 000500 + 000550 applied; merged 3299561. Post-merge prod check queued. Post-merge PASS: manifest + icons, sw only on opt-in, Pro/Premium toggle | kiumars1199/Kismet#56 | passed review |
| F11 Bet tracker | tracker | Round 4 989acfa review PASS (CheckClient conflict resolved, afford note intact), CI web green; journal_split migration applied; merged 045dc79. Post-merge prod smoke queued | kiumars1199/Kismet#58 | passed review |
| F12 Morning digest | onboarding-invites | round 2 eabe0f5 PASS with notes (cron reaches route, after-fee payout, Free gets its own daily sample, paused users skipped); migration 000400 applied; merged b9fd607, prod READY. Post-merge check queued. Post-merge PASS: opt-in saved (200 on:true) all 6 runs; 401 signed out | kiumars1199/Kismet#55 | passed review |
| F13 Share and invite | onboarding-invites | round 5 code PASS; conflict-resolution PASS on ed4b2c6 (nothing from final dropped; vitest 1778); CI web green; invites migration 20261122000200 applied; merged 33521d6. Post-merge prod smoke queued | kiumars1199/Kismet#51 | passed review |
| F14 Price history chart | data | round 5 d494061 review PASS (CLS ≤0.008 on /m, chart + empty state 360 px, history API 401/200, Free delayed). CI red only on s7 keyboard /pricing nav at 5 s (next dev slow nav; 3/3 locally) → #76 timeout; rerun after #76; merged a98ee96 17:10; post-merge PASS a98ee96 (prod signed-out 390–1440 clean, history 401; paid mock chart + empty state all plans, /m CLS ≤0.0063; evidence review/postmerge-a98ee96/) | kiumars1199/Kismet#53 | passed review |
| F15 Admin metrics | trust | merged 34f672f with #50 (1376182); migration 000300 live; full suites green (search 300 ms flake passed 21/21 alone). Notes left for follow-up: MRR/churn blocks disagree; yearly priced at monthly | kiumars1199/Kismet#49 | passed review |
| F16 Big trade alert | alerts | migration 000600 applied; merged 5045e21. Post-merge prod check queued. First live run's log line shows the feed order. Post-merge PASS: Premium-only Big trade kind, rule copy right at 390/1440 | kiumars1199/Kismet#57 | passed review |

Merge order: F3, F1, F2, F5, F7, F8, F9, then F4, F6, F10–F16.

Batch 1 MERGED (08:20–08:50 UTC: #43, #45, #64, #60, #61, #62; then #47, #54, #55; #46 merged 2a987ba at 09:31). Was: Batch 1 (decisions.md, Vercel cap): F1 #43 064f521, F2 #45 ef73b2f, f01b kiumars1199/Kismet#64 ae4e3eb, #60 df67be8, F6 #46 57ed4de, #61 0107058, #62 70d8f6b. Integ tree integ-b1 v1 (c5abb7f, first five) green: tsc, lint, vitest 1594 + timing test passes alone, pytest 164, build, check:js 146.8 kB, e2e 129. f01b delta PASS; v2 (b99788b, +#61 +#62, tree 61da2d4) green: tsc, lint, vitest, pytest 164, build, check:js 146.8 kB, e2e 139; pushed as launch/integ-batch1; one preview when a slot frees (~08:40 UTC), then merges and one prod build.

## Walk-through 1: first-time visitor from a TikTok link
Status: dry run on prod a7c3ae5 (16:45; evidence review/walkthrough-1-dryrun/). Official walk after all merges.

Problems (dry run; fixes assigned):
- [should-fix] /m teaser "get10 best bets" missing space (onboarding)
- [should-fix] /m subtitle repeats a truncated title (onboarding)
- [should-fix] /m teaser gives nothing concrete: add market price %, relative close time, locked verdict row (onboarding)
- [should-fix] /signup from a bet is generic: name the bet (onboarding)
- [should-fix] /pricing at 390: 470 px of stats above the plans (tracker)
- [nit] Free plan copy "chosen at random" (tracker)
- [nit] helpline links are 15 px tap targets (tracker)
- [nit] header "Sign up" shows on /signup and /login (onboarding)
- [nit] /m close time absolute only (onboarding)

## Walk-through 2: new Free user
Status: dry run on the paid mock at eef7345 (18:35). The official walk on prod comes after the merges. Fixes go to the trust lane (T-wt2).
Problems (from the dry run):
- [should-fix] A first-time Free user with one topic can land on an empty first screen, because the random 10-bet sample may have none in that topic.
- [should-fix] Tour step 1 opens over an empty list.
- [should-fix] Onboarding step 1 has a CLS of 0.104 at 1440, from chip height growth and a late fieldset.
- [nit] "Why this bet?" says "over over".
- [nit] The copy on the locked card is unclear when 0 Free bets match.
- [nit] "- More Markets" shows on the /markets group header (fixed in #81).

## Walk-through 3: Pro user building a combo
Status: dry run on the paid mock at eef7345 (18:58). The official walk on prod comes after the merges. Fixes are with the data lane (T-wt3).
Problems (from the dry run):
- [blocker] A Pro user has no way into /check/combo: no link anywhere, and the Add-to-combo tray is Premium-only.
- [should-fix] /combos and /pricing copy tells Pro that building combos is Premium-only.
- [should-fix] Same-event legs still show a confident "Score 100" under the "likely off" warning.
- [nit] The same-event warning shows the raw " - More Markets" event name.
- [nit] Pro sees Free's "1 check a day" copy.
- [nit] The leg basis in "Why these numbers?" uses engine wording.
- [nit] Search hits shift the result box (CLS 0.06-0.07).

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

- CI: e2e-paid on `next dev` hit its memory restart (default heap 4144 MB on the runner). Fixed by kiumars1199/Kismet#65 (two shards + pinned 8192 MB heap), review PASS, merged 44ea8b6. Still open (low): a rare `read ECONNRESET` without a restart; trust investigates.

- /markets at 390: the count line ("N markets match · …") wraps from 1 to 2 lines about 1–2 s in on 2 of 9 loads, CLS 0.068 (reviewer, F3 prod). Under budget; low. Owner: data, after F4.
- f01b + #52 both declare `kalshi_matched_ticker`: whichever merges second drops one line (data, in the #52 rebase). Until #52 lands, pasted Kalshi links still show "missing".

- F8 gap (reviewer, #66): /api/ext/token and /api/ext/token/refresh don't check pause, so an already-connected extension keeps refreshing its token while the user is paused; its token-authenticated data calls may not be pause-gated either. Owner: trust, after #63/HowToBet. #66 (trade config checks the deploy's trading switch first) PASS with notes, merged 2aa61a1 at 10:39 UTC.
- #54 note: /api/trade/config reads the user's profile even when trading is off on the deploy; check tradingEnv/extensionId first (reviewer). Low; owner trust, after #63.
- F12 test gap (`if (found)` guard hid the digestBets assertions): fixed in kiumars1199/Kismet#68, review PASS (6 of 6 mutations caught), merged 1aa4bca at 10:52 UTC.
- F5 copy nit (reviewer, post-merge): Free with a 1-bet daily sample filtered to 0 by topics reads "0 of 1 bet where the odds lean your way". Should say plainly that today's free pick isn't in their topics. Low; owner onboarding, after F13.
- F10 nit (reviewer, post-merge): `link rel=manifest` appears twice in prod HTML. Low; owner: whichever lane frees first.
- F8 gap fixed in kiumars1199/Kismet#67: 5ca579b PASS with notes (an existing token is refused after pause; other users unaffected). Final merged in (149c524), CI green; merged df105f8 at 10:25 UTC. Follow-ups (owner trust, post-launch; trading is off in prod):
  - allow trade cancel while paused;
  - move supabaseAdmin() inside the try in pausedUntilForUser;
  - add a unit test for an unpaused nonce;
  - show a pause message in the extension popup on 423, and clear cached by-slug data.
- CI timeout: kiumars1199/Kismet#73 closed as superseded (#69 carries the 45-min line).
- Merged 11:3x: #58 F11 (045dc79), #69 pill links + StateLink + timeout (0a5972f), #70 HowToBet state link (0e387e6), #72 extension pause follow-ups (40acce0); reviewer PASS on each.
- #71 FAIL: CLS 0.765 at 1440 on Free after "Show today's free bets" with a slow /api/flags (heading collapse + list swap; the list swap is on final too, 0.52 on pill removal). With trust.
- #72 notes: pausedUntilForUser fails open on DB errors (accepted while trading is off); background.ts pause wiring has no unit test; popup shows date only.
- Post-merge 40acce0 (F11, #69, #70, #72) PASS on prod. Note: StateLink SSR href on / is /state?next=%2Findex (prerendered home); with tracker as a small fix.
- Merged 16:05: #51 F13 (33521d6), #75 StateLink next=/index (3f1a985, preview verified %2F).
- #76 (test only): f05 and s7 post-action asserts get 30 s on CI next dev; PASS, waiting on CI.
- Merged 16:29: #76 test timeouts (5881b35).
- #71 round 2 30fe232: Show-tap fixed (0.765 → 0.0065), pill 0.52 gone; still FAIL on full→empty filter change at 1440 (0.786); with trust.
- #74 PASS (Kalshi-view min-h tweak 54641d6 pending diff check). #77 new: /markets sideways scroll at 768 and 1024, found by the #74 review.
- Merged 16:33: #52 F4 (a7c3ae5). Post-merge prod smoke a7c3ae5 PASS (#75 live, og image teaser 1200x630 with no leak, invite endpoints 204/401/405, no 5xx).
- #77 follow-up: table fits from 1280 (xl overflow-visible + trim padding) and a fade cue for hidden columns.
- #77 merged 16:56 as f2c7abf (reviewer PASS c93a99d/2d2597f, CI web green, preview READY). 1280 follow-up (launch/data-table-1280 cd90a13) is being opened as a PR.
- #74 merged 17:05 as b02e125 (reviewer PASS 054c0c8, CI web green, preview READY). #80 CI red: HelpLine "source" link 39×44 fails the overhaul-iphone 44 px tap-target check (50 tests, all the same cause); the tracker lane is fixing it.
- #53 F14 merged 17:10 as a98ee96. #78 merged 17:15 as f654082 (PASS with notes; follow-up fix/kalshi-basis-wording). #79 merged 17:15 as b887554 (PASS with notes a/b; follow-up launch/onb-walk1b). All with CI web green and preview READY.
- #71 561b0d2 CI red: free-topics-cls:75 cannot find a roi filter leaving 1–6 Free bets in CI fixtures (test is data-dependent; trust fixing). #82 (walk-1 notes a/b) and #83 (#78 wording notes) opened.
- 17:32 check-in: #82 ce71c04 PASS (walk-1 notes a/b + /event teaser suffix; signed-in /event title fix in progress). #83 18de41d PASS. #81 rerun after ECONNRESET flake (080398e). #80 d21a714 (44 px width fix) and #71 in review/fix. F14 post-merge: chart clean, /markets+Kalshi part rerunning after an OOM kill.
- #83 merged 17:50 as 723a14d (PASS 18de41d, CI web green, preview READY). #80 d21a714 CI green, awaiting review. #81 CI flaked twice on ECONNRESET (paywall-pages:105, password:10; keep-alive race) → rerun 5b1ffa2 + tracker fixing at the root in its own PR.
- 18:03 check-in: F14 post-merge PASS a98ee96 → 16/16 rows passed review. #71 dfbede9 PASS with notes (CLS ≤0.053; blank on short Free list judged fine; optional cap 0-row reserve at ~60svh on lg+). #82 4f8d1fd and #80 d21a714 CI green, awaiting review. #81 CI rerun.
- #82 merged 18:06 as fbf5407 (PASS 4f8d1fd, CI all green, preview READY).
- #71 merged 18:09 as efa7343 (PASS r3 dfbede9, CI all green, preview READY).
- #80 merged 18:12 as eef7345 (PASS with notes d21a714, CI all green, preview READY). Follow-up: footer "source ," gap + LockedBets "chosen at random" copy.
- #81 5b1ffa2 review FAIL: Pro with extra columns gets page sideways scroll from 1280 (xl:overflow-visible regardless of fit). Data lane fixing (overflow-visible only when the table fits + fade at xl when it does not) plus the /markets group-row "More Markets" suffix.
- Old: CI timeout #73 (one line, 30 → 45 min), split out of #69 so it lands first; #51 was also cancelled at 30 min (10:05–10:35).
- CI blockers (10:05): #66 was cancelled by the 30-min job timeout (the run now takes ~30 min); #68 and #67 failed on the F5 pill tap before page load (AppliedPills is a client-only button). Both are being fixed in #69 (trust); after it merges, final gets merged into the waiting PRs.
- F5 pill-click flake: e2e-paid/launch-f05-topics.spec.ts:59 at 1440 failed on CI after a server ECONNRESET (seen on #67). Part of trust's stabilize PR (D).

## Fixed log
- F7: passed review (pre-merge PASS + post-merge PASS on cd9f672; evidence review/f07/).
- F3: passed review (prod recheck on 67cab85, evidence review/f03/prod67cab85/).
- F15: merged 34f672f with #50; migration 20261122000300 applied to live; prod deploy READY, /api/health ok (03:35 UTC).

## What Q must do
- ~~Vercel plan~~ done: Q moved Vercel to Pro (Nov 23).
- Set in Vercel env: `INVITE_IP_SALT` (F13 invite address checks), `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (F10 web push).
- Vercel → kismet → Settings → Functions: confirm function memory is at least 1 GB. The F3 index fix (#59) peaks near 600 MB RSS, and the tools available here can't read this setting.
- GitHub → Kismet → Settings → Actions: add secret `CRON_SECRET` (same value as in Vercel) and variable `SITE_URL` = https://kismetodds.com, so big-trade alerts run after every scan (F16). Without them the step skips and big-trade alerts arrive with the daily run.
- Add repo secret `VERCEL_AUTOMATION_BYPASS_SECRET` (Vercel → Settings → Deployment Protection) for preview smoke S3/S5.
- Live Stripe keys and price IDs: follow `docs/launch/go-live.md` (F7 merged).
