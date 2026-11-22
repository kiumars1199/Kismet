# reviewer progress

Update after every task: task · status · evidence (commands + last output lines, PR, preview URL) · next step.

## Setup (Nov 22)
- Worktree `review` branch = `origin/final` (bcce1ed). `pnpm i --frozen-lockfile` done.
- Screenshots go to `<worktree>/docs/launch/review/f<nn>/` (untracked); the lead copies them. Reports cite paths relative to `docs/launch/`.
- Status: ready, waiting for the lead's first PR.

## Baseline (origin/final bcce1ed = `git ls-remote origin final`, before any F-PR)
- `pnpm typecheck`: pass. `pnpm lint`: pass (0 warnings). `vitest run`: 113 files, 1435 tests passed. `test:ops`: 36 pass, 0 fail.
- `pnpm build` OK. `pnpm check:js`: `/: first-load JS 142.5 kB gzipped ... budget 150 kB: OK` (7.5 kB headroom).
- Pre-existing: `/bets: first-load JS 195.0 kB gzipped ... OVER` on final already. Not a PR finding unless a PR makes it worse;
  I report deltas for `/bets`, `/check`, `/markets` against this.

## Per-PR routine (every feature)
1. `git fetch origin pull/<n>/head && git checkout -B pr-<n> FETCH_HEAD` (works on re-review / force-push); `pnpm i --frozen-lockfile`.
2. `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build && pnpm check:js` (≤ 150 kB). Also run
   `node scripts/perf/landing-js.mjs --route <new route> --budget-kb 150` for any new page (check:js measures only `/`).
3. Run the PR's named specs: `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium PW_PORT=3290 pnpm exec playwright test <spec> --project=chromium --trace off`
   (paid: `-c playwright.paid.config.ts`). Confirm each spec actually asserts its "Done when" line, not just that the file exists.
4. Preview (Vercel comment on the PR) at 390 and 1440 px: signed out, Free, Pro, Premium (in-app mock `/e2e-mock` or local `E2E_MOCK=1`).
   Screenshots to `review/f<nn>/<plan>-<width>-<what>.png`.
   Preview access: bypass secret not set yet (decisions.md), so the fallback is a local `E2E_MOCK=1` build
   (`playwright.paid.config.ts` env, port 3290). Every report says which one was used.
   Plan recipe (mock): sign up with the email form, open the magic link from `GET /e2e-mock/supabase/_inbox?email=…` → Free. Pro / Premium:
   run the mock Stripe checkout as `e2e-paid/s7-upgrade.spec.ts` does, or set `subscriptions.tier` / `comp_tier` on the mock row
   (mock reads `comp_tier` + `comp_expires_at`, route.ts:243). `_reset` clears the mock. I verify this recipe on the first paid review.
5. Cross-cutting on every PR: no cents anywhere (grep rendered HTML for `¢`, `cents`, `$0.xx` prices); every number has its basis one
   tap away; footer disclaimer "Market analytics, not financial advice. Based on past results. 18+." on new pages; empty / loading /
   error states; no layout jump (CLS < 0.1 in the e2e run); no horizontal scroll at 390; numbers agree across card, drawer, checker,
   `/markets`, `/track-record`; no personalized picks (result never depends on the user); `lib/types.ts` = `docs/03-data-model.md` when
   engine output changes; no keys or price IDs committed; migrations additive only; venue availability (F9) and 18+ near bet buttons.
6. Never write to live services; never create payments.

## Checklist per feature ("Done when" lines, checked one by one)

### F1 Bet checker
- [ ] `/check` at 390 + 1440: no horizontal scroll (`scrollWidth <= innerWidth`). Screenshot both.
- [ ] Every card on `/`, `/bets`, `/markets` has a "Check" link `/check?m=…&side=…` (count cards vs links).
- [ ] `lib/check/parse-link.test.ts` ≥ 9 cases covering polymarket.com/event, polymarket.us, kalshi.com/markets; ids equal card ids.
- [ ] `launch-f01-checker.spec.ts` compares chance, market %, multiplier, edge across checker, card, drawer on 3 fixture markets.
- [ ] Price 60%→50% updates multiplier, edge, score < 100 ms, no network call (`page.on('request')`).
- [ ] Formula text visible on page; `lib/check/score.test.ts` ≥ 8 cases incl. clamp 0, clamp 100, no-model. Formula =
      `clamp(0,100,round(50 + 250·net_edge·sqrt(min(n,400)/400)))`, net_edge = engine's (after fees + spread).
- [ ] `launch-f01-limit.spec.ts` (paid): Free 200 then 429 `{code:"check_limit"}` same UTC day; Pro and Premium 20×200. Signed out: per IP-hash device, same limit.
- [ ] Second Free check shows the upgrade card and does not compute (no numbers in DOM or response).
- [ ] Unit: two accounts → byte-identical result JSON.
- [ ] Edge: unknown/closed link message + search; price 0%/100% rejected; stake $1 min / $100,000 max; Kalshi link uses Kalshi price;
      "No model chance for this market" with no score; score < 50 when our chance < price.
- [ ] Plain language, no cents; "How to bet this" (F6), afford-to-lose note (F8), availability (F9) near any deep link once merged.

### F2 Combo checker
- [ ] `lib/check/combo.test.ts` ≥ 6 cases: 2/3/10 legs hand-computed chance + payout (multipliers after fees); same-event flag; weakest leg = max score gain.
- [ ] `launch-f02-combo.spec.ts`: 3 legs from cards → combined numbers → one-tap remove weakest → numbers update.
- [ ] 2nd leg from same event shows "Same event: these legs move together…".
- [ ] Combo tray multiplier = checker multiplier for the same legs.
- [ ] Edge: 1 leg "Add at least one more leg"; 11th refused; duplicate refused; no-model leg blocks score and names the leg; n = smallest leg sample.
- [ ] Access shares the F1 daily count; `/combos` stays Premium-only.

### F3 Every market searchable
- [ ] `python3 -m pytest -q engine/tests` passes incl. Kalshi series → ≥ 95% non-`other` topic ids that exist in `lib/taxonomy.ts`.
- [ ] `launch-f03-search.spec.ts`: `/api/markets?venue=kalshi&topic=sports.nfl` returns Kalshi rows; `?q=<Kalshi word>` finds Kalshi; fixture ≥ 20 Kalshi rows.
- [ ] `/api/meta` counts by venue; after merge on prod: polymarket ≥ 15000, kalshi ≥ 150000.
- [ ] Every top-level taxonomy category on `/bets?topic=<id>`: Best bets or "No edge right now" (loop all ids).
- [ ] Memory < 1 GB with full Kalshi (number in PR); p95 `/api/markets` < 500 ms on preview over 20 queries (output in PR; spot-recheck).
- [ ] Browser never gets `markets.json` whole (no large JSON response in network log); 120 s cache kept; Kalshi no-price → "No price yet", excluded from Best bets.

### F4 Same event, three venues
- [ ] Engine emits `venues: [{venue, price, multiplier, url}]`; `lib/types.ts` + `docs/03-data-model.md` in the same PR.
- [ ] pytest precision ≥ 95% on ≥ 40 hand-labeled pairs (count the fixture rows).
- [ ] `launch-f04-venues.spec.ts`: 3 rows, exactly one "Pays most here" (highest payout after fees); missing venue "Not listed".
- [ ] Drawer and `/m/<id>` both; no cents; numbers match the card.

### F5 Topics at signup
- [ ] `launch-f05-topics.spec.ts` (paid): NFL + Politics → `/` and `/bets` filtered, "Your topics" pill visible, one tap clears.
- [ ] Skip → unfiltered; topics editable in `/settings`.
- [ ] API unit test: flags for a topic filter identical across users. Topics filter, never rank.

### F6 How to place this bet
- [ ] `lib/venues/guides.ts`: unit test every venue exactly 3 steps + URL builder.
- [ ] Deep-link unit ≥ 6 cases, right URL pattern per venue.
- [ ] `launch-f06-howto.spec.ts` at 390: open from a card, 3 steps + link, close.
- [ ] F9 availability above the deep link (if F9 not merged: note the dependency); F8 note next to the link.

### F7 Live payments by config
- [ ] `git grep -nE 'price_[A-Za-z0-9]{8,}|(sk|pk|rk)_(live|test)_[A-Za-z0-9]{20,}|sk_live|pk_live|whsec_[A-Za-z0-9]{10,}'` → 0 hits (mock dummies like `sk_test_e2e`, `price_pro_m` don't match); price IDs from `STRIPE_PRICE_*`.
- [ ] Webhook handles checkout completed, subscription updated/deleted, invoice paid/failed (tests); receipts documented.
- [ ] `docs/launch/go-live.md`: every env var, where Q pastes it, 5-step live charge + refund test.
- [ ] Unit test for test-vs-live mode selection by env. No live Stripe calls by me.

### F8 Responsible betting
- [ ] 18+ confirmation at signup present (verify existing).
- [ ] `launch-f08-pause.spec.ts`: pause 24 h → every app page shows the pause screen; data APIs 423; end time in the user's TZ (test a non-UTC TZ).
- [ ] e2e counts bet buttons vs "Bet only what you can afford to lose" notes on `/bets` (equal).
- [ ] 1-800-GAMBLER in footer and `/account`, source URL + date in `config/site.json` or sources file; 24 h / 7 d / 30 d options.

### F9 Venue availability
- [ ] `config/venue-availability.json`: every US state (50) per venue (DC: question for the lead, not a fail), each with source URL + checked date; unit test fails on a missing one.
- [ ] `launch-f09-availability.spec.ts`: restricted state → "not available in <state>" above the button; unknown → "Check your state"; state saved.

### F10 Install + web push
- [ ] Lighthouse PWA installability on the preview: manifest, 192/512 icons, service worker. Lighthouse 12+ dropped the PWA category and it isn't
      installed here; agree substitute evidence with the lead: manifest fields valid, both icons 200 + right size, SW registered and controlling (`navigator.serviceWorker.controller`), Chrome `getInstalledRelatedApps`/beforeinstallprompt fires.
- [ ] `POST /api/push/subscribe` stores with RLS (unit, fake Supabase); RLS policy in an additive migration.
- [ ] Evaluator: one push per event, never twice (extends `test/alerts-cron.test.ts`).
- [ ] Existing email + in-app alert tests pass unchanged (diff shows no weakened assertions). No sends to real users.

### F11 Bet tracker
- [ ] `launch-f11-log.spec.ts`: one tap "I placed this" from a card → row in `/journal` (side, price, stake prefilled; also from the checker).
- [ ] Settlement unit ≥ 6 cases incl. fees; recompute one P&L by hand.
- [ ] `supabase/tests` RLS: user B can't read A's bets.
- [ ] P&L by topic sums to the total; "Beat the closing price" per bet; dollars not cents; nothing ranked from the user's positions.

### F12 Morning digest
- [ ] Cron route, one email per opted-in user, top bets in their topics (same for everyone with those topics), one-click List-Unsubscribe.
- [ ] Unit renders the email: no cents, disclaimer, unsubscribe link, ≤ 5 bets.
- [ ] Resend test mode / mock only; cron route auth-protected.

### F13 Share and invite
- [ ] `GET /api/og/bet/<id>` → 1200×630 PNG (check dims), multiplier + %, no cents; look at the image.
- [ ] Self-referral unit ≥ 5 cases (same account, same email domain + IP hash within 24 h, inviter's own sessions).
- [ ] Reward once at 5, stacks onto an existing comp end, never lowers a paid plan (unit).
- [ ] Migration additive; RLS keeps invite rows private to the inviter; "3 of 5" counter on `/account` and in the share sheet; QR renders.

### F14 Price history
- [ ] Engine history ≤ 200 points/market, ≤ 90 days; total file size in the PR.
- [ ] `GET /api/markets/<id>/history`; drawer Recharts line in %, basis "Prices from <venue>, every <interval>".
- [ ] `launch-f14-history.spec.ts`: renders for a fixture; empty "No price history yet". Recharts lazy-loaded (budget).

### F15 Admin metrics
- [ ] `/admin`: daily signups, trials, paid, revenue in dollars, churn, invites, last 30 days.
- [ ] Seeded-fixture unit matches; non-admin 404 test still passes.

### F16 Big trade alert
- [ ] Trade ≥ $10,000 on a followed market → one alert to the Premium user within one scan, via their channels.
- [ ] Free and Pro never (unit); detection source + threshold documented with a source URL.

## Walk-throughs (after all merges, kismetodds.com; BotID-blocked steps re-run on latest preview with bypass, noted)
1. TikTok visitor, 390 px, signed out, lands on a bet share link. 2. New Free user: signup, topics, 1 free check, hits limit.
3. Pro (comped test account from lead): combo 2–4 legs, drop weakest, log bet. Screens → `review/walkthrough-<n>/`; problems → STATUS.md.

## Log


### F7 · PR #41 (head 3c709f9) · PASS (Nov 22)
- typecheck OK; lint OK (0 warnings); vitest 115 files / 1445 tests passed; test:ops 36 pass 0 fail; build exit 0;
  check:js `/: 142.5 kB ... OK` (unchanged from baseline); `/bets` 195.0 kB OVER (same as baseline, pre-existing).
- Chromium e2e: 82/83 on the first run; trading-paper failed in beforeAll because `apps/extension` had no node_modules in my worktree
  ("vite: not found"). After `pnpm i` in apps/extension it re-ran: 1 passed. 83/83 in total.
- Secret scan (git grep for full price IDs, sk/pk/rk live+test keys, whsec, over all tracked files incl. tests/fixtures): 13 hits, all FAKE/mock
  values in *.test.* or ops/tests. 0 real. Price IDs read from `STRIPE_PRICE_*` (stripe.ts:17-18); `.env.example` values empty.
- Webhook: stripe.ts cases checkout.session.completed, subscription created/updated/deleted, invoice.payment_failed, invoice.paid;
  behaviour tests in invoice-events.test.ts and the existing stripe.test.ts.
- go-live.md: env var table (source + where to paste), receipts sourced with URLs + date, 5-step live charge + refund test, rollback.
  Referenced scripts exist (ops/stripe-setup.mjs, ops/vercel-env.mjs, `pnpm preflight`).
- Mode unit test: mode.test.ts. Non-blocking notes: `stripeMode()` is called by no app code (the live gate is ops/preflight `--live`,
  tested in ops/tests/preflight.test.mjs); the in-test scanner's regex skips sk_test_/rk_test_ and *.test.* files; git history still has the
  truncated price-ID prefix in docs/qa (removed at HEAD; price IDs aren't secret).
- No GitHub API access to kiumars1199/Kismet here, so I couldn't read CI or the Vercel comment; F7 has no UI, so no screenshots.
- Evidence: review/f07/checks.log, review/f07/e2e-chromium.log, review/f07/secret-scan.txt.

### F7 re-check · PR #41 (head 549a62b) · PASS
- Delta from 3c709f9: .gitleaksignore (+10) and mode.test.ts only. 8 fingerprints pinned to 3c709f9:mode.test.ts lines 12/13/14/15/18/22/24/35,
  each holding only *_FAKEFAKEFAKE0000 / sk_live_x literals; no pattern or path rule. New mode.test.ts has 0 key-shaped literals.

### F3 · PR #42 (head 70fb2fe) · FAIL (sent to lead Nov 22)
- Findings: (1) direct /markets?q=<word> load drops Kalshi matches (firstPage builds the page without `kalshi`); (2) kalshi_topics.py keyword
  substrings (rain→Ukraine, gold→Golden State, war→Warriors; KXSOLAR→solana, KXGOVSHUT→elections); (3) venue chips mount after client
  /api/meta, a new layout shift; (4) Kalshi view header says "0 markets match" above "4 Kalshi markets", and Polymarket-only filters do nothing;
  (5, low) Kalshi off + old ?ven=kalshi link shows "data server didn't answer".
- Passing: pytest 153; e2e chromium 89/89 incl. 6 F3; API venue/topic/q/meta; flags never Kalshi; "No price yet"; permission-off 404;
  types = data model; uploads correct; peak RSS 491 MB and p95 138 ms over 20 local queries on 207K synthetic Kalshi rows; /bets?topic for 10 ids.
- p95 vitest test fails on final too under load (not a finding); funnel-db file failure is a load flake.
- Post-merge: production counts. Evidence: review/f03/*.
- Next: F1 (#43), then F2 (#45, last commit da631bb only).

## F1 #43 (head c83a7cf): FAIL
Evidence in review/f01/ (checks.log, e2e-checker.log, e2e-paid-limit.log, probe.log, cls-result.log, closed-market-repro.txt, screenshots signedout-{390,1440}-{empty,result,price-0.5,missing}.png).
Green: typecheck, lint, test:ops 36/36, build, check:js / 142.5 kB, /check 129.1 kB; vitest 1471/1472 (only the known apply() p95 load flake, same as final); checker e2e 6/6; shared-file edits OK.
Findings:
1. No "Check" link on any card: 0 links to /check?m= on / (12 cards), /bets (12), /markets (15).
2. Layout jump: CLS 0.374 at 390 px (0.016 at 1440) on /check?m=…, the footer moves when the result arrives.
3. A closed market is still scored: with the real clock, 6674492 (closed 5 days earlier) returns 200 and score 100. The spec wants "We couldn't find an open market".
4. The paid launch-f01-limit spec fails 1 of 3: signed-out search test gets the upgrade card because the previous test used the device's daily check.
5. The e2e doesn't compare market % or edge with the card/drawer, and its timing check is < 1000 ms, not 100 ms. Measured in the page: 3–10 ms.
6. Low: price 0.5 is accepted (shows "1%", "191x") while the message says 1%–99%. The checker shows no venue availability: card says "International only, not on Polymarket US"; the API has venue "intl-only" but the UI drops it.
Open (not findings): signed-out word search, Kalshi links use Kalshi's own price.

## F7 post-merge (final cd9f672): PASS
go-live.md present; mode+invoice-events 10/10; price IDs env-only; scan 0 real (12 fake in ops/tests). review/f07/postmerge-*.
Queue: F2 #45 da631bb, F5 #47, F8 #44, F9 #48 (8434b9e), F6 #46 (b9051cb..c68d2b7); F3 returns later.

## F2 #45 (da631bb only): FAIL
Green: typecheck, lint; lib/check + check-api vitest 47/47; e2e launch-f02-combo 3/3 + f01 6/6; /check/combo 390/1440 no hscroll, CLS ≤ 0.004, disclaimer, no cents.
Math: the 3-leg hand calc (0.6/0.4/0.8, ask+fee 0.51/0.32/0.71) gives chance 0.192, ×8.6302, edge +0.0761, score 69, the same as the test and combo(). Live 3 legs match the leg pays product (1.16×1.14×1.45 = 1.92x).
1. Free-limit bypass: /api/check/leg counts the fixed key "combo:0", so after the first leg every further leg (any market) is free all day. Each answer is a full single-market check (result.score, chance, edge), which gets around F1's 1-a-day. Fix: count per combo, or strip result from the leg response.
2. Combined numbers have no basis one tap away (no smallest-leg n or model level). Leg basis is in the response but not shown.
Open (not counted): add 3 legs from cards; paid e2e for the Free combo limit.

## F5 #47 (head 4a93a49): FAIL
Evidence: review/f05-reviewer/ (e2e-paid.log 3/3, probe*.log, bets-signedin-raw.html, screenshots). The spec was run from a copy with SHOTS repointed (the PR's SHOTS path is another agent's worktree).
1. The onboarding landing /?view=flags&fav=1 (no t=) isn't server-filtered: CLS 1.848 at 390 on a fresh load, the cards churn in after the profile loads. Onboarding.tsx now sends fav only.
2. The "server redirect" is not an HTTP redirect when signed in: GET /bets gives 200 with NEXT_REDIRECT plus a meta refresh (249 KB, 0 cards). Then a second document loads /bets?fav=1&t=… (that one has the pill in its HTML). Seen on next dev with the mock; check on the preview.
3. The spec's SHOTS is an absolute path into another agent's worktree (agent-afda8a27944e228d2), so it would write outside the repo in CI.
OK: the pill clears, and stays cleared on a second device (topics_off). CLS /bets 0.054 at 390 and 0.020 at 1440. Disclaimer, no hscroll, typecheck, lint, unit tests pass. Same-for-all unit test is present (two anonymous callers only).
