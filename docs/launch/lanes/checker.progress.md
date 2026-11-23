# checker progress

- F1 bet checker · PR up, awaiting lead review · https://github.com/kiumars1199/Kismet/pull/43 (branch launch/checker-f01)
  Evidence: typecheck/lint clean; vitest 1471 pass (only api.test.ts p95 timing flaked under load, passes alone); check:js "142.5 kB ... budget 150 kB: OK";
  e2e launch-f01-checker 6 passed; e2e-paid launch-f01-limit 2 passed. No preview URL checked yet (lead).
  Shared files touched: entitlements.ts (checks_day), DrawerGate.tsx (/check exact path), public-paths.ts (/check, /api/check), sitemap.ts.
  Not done: Kalshi's own price (needs F3/F4), signed-out word search (/api/suggest needs account).
- F2 combo checker · next (needs plan to main first). F6 · after F2.
- F1 fix (a) signed-out word search: pushed to PR #43. /api/check/search (id, question, side, outcome, pays only). e2e-paid launch-f01-limit: 3 tests (2 signed-out incl. search) passed; typecheck/lint clean.
- F1 fix (b) Kalshi own price: waiting for "F3 merged".
- F2: plan approved; branch launch/checker-f02 from launch/checker-f01; not started.
- F2 combo checker · PR up (stacked on #43), https://github.com/kiumars1199/Kismet/pull/45 (branch launch/checker-f02).
  Evidence: combo.test.ts 9 pass; e2e launch-f02-combo 3 passed; typecheck/lint clean; vitest only api.test.ts timing flake; check:js 142.6 kB OK.
  Open: "from cards" e2e + Free combo limit paid e2e after BetCard (#44); rebase onto final after #43 merges.
- F6 how to bet · not started (guides.ts config, then BetCard link after #44).
- F1(b) Kalshi own price: waiting for "F3 merged".
- F6 how to bet · PR up (stacked on #45), https://github.com/kiumars1199/Kismet/pull/46 (branch launch/checker-f06).
  Evidence: guides.test.ts 11 pass; e2e launch-f06-howto 1 passed (390px); launch-f01-checker still 6 passed; typecheck/lint clean.
  Sources fetched 2026-11-22 (URLs in guides.ts). Partly unverified: Polymarket intl step 3 "enter amount and confirm"; Kalshi step 1 signup wording.
  Open: BetCard buttons ("Check", "How to bet this", "Add to combo") + card e2e after #44; F9 availability + RiskNote slots; F1(b) Kalshi price after "F3 merged"; rebases as #43/#45 merge.
- F6 fix: steps now each carry source url + date; Polymarket intl step 3 and Kalshi step 1 reworded to only what fetched pages say; test added. Pushed to #46. Idle until #44 / F3 merged.
- F1 review fixes pushed to #43 (8818178): Check link on BetCard/MarketCard/MarketTable (z-10: title overlay blocked taps), CLS skeleton (390/1440 < 0.1), closed markets rejected (open.ts, unit test with 6674492), x-e2e-device (E2E_MOCK only) per paid test, edge = card/drawer gap pts + after-fee line, market % and edge compared with card+drawer in e2e, timing measured in-page < 100 ms, price 1-99, venue line.
  Evidence: unit 1493 pass (api.test.ts p95 timing flakes under shared-machine load); full demo e2e 96 pass, 1 fail trading-paper (pnpm build of apps/extension fails in my worktree, unrelated); paid launch-f01-limit 4/4 pass alone (full paid suite did not finish: dev-server cold compiles time out while other lanes load the machine).
- F2 review fixes pushed to #45: /api/check/leg lookup only; /api/check/combo scores once under sorted set key, shared Free allowance; "Why these numbers?" expand; paid e2e (combo then single 429, other combo 429).
- F6 #46 merged F2 and conflict resolved (venue line above HowToBet). e2e f01/f02/f06 13 pass.
- F6 review fixes 2-4 pushed to #46: venue adapter (guides.ts venueStatus, all "unverified" until F9 merges; one-line swap to statusesFor), no default venue unless known available, "Check <venue> for your state", step sources expand (URL + date), one afford note. Unit 16 pass in guides.test.ts; typecheck/lint clean; e2e f01/f02/f06 13 pass (chromium). Pending: BetCard "How to bet this" button after #44 lands (main approved), then F9 wiring after #48.
- F6 fix 1 pushed: merged final (#44), BetCard 'How to bet this' + RiskNote, card e2e. vitest 1545 pass (api.test.ts timing flake, passes alone), check:js 146.8 kB OK, chromium e2e f01/f02/f06/f08 16 pass. F9 wiring pending #48.
- Round-2 fixes (respawn): F1 #43 064f521: missing/limit cards keep the skeleton height (CLS), e2e CLS for unknown link at 390/1440 + paid limit card CLS at both; Kalshi link shows Kalshi's own Yes price + "Use it" (lib/check/kalshi-price.ts, unit tests). Evidence: tsc/lint clean; vitest 1517 pass (api.test.ts p95 timing flake only); check:js 144.7 kB OK; chromium f01-checker 11 pass; paid f01-limit 3 pass.
- F2 #45: explicit "Check this combo" tap; weakest/drop recompute from the same response (no extra check); /api/check/combo returns only {m, side, base, basis} per leg; paid test "Free 3 legs, one check, drop a leg" added. Evidence: tsc/lint clean; vitest lib/check+check-api 60 pass; chromium f02 3 pass; paid f01-limit 5 pass (new 3-leg test passed on rerun after fixing test race). F6 not merged forward yet (waiting for main's verdict). LogBetButton: waiting for tracker-f11 merge. F9 wiring: waiting for #48.
- F1b launch/checker-f01b: per-side Kalshi price (kalshiOwnPrices, 7 unit tests written first, failing then passing), missing card 640px (CLS <0.1 at 390/1440). tsc/lint clean, vitest lib/check+check-api 49 pass, chromium f01 11 pass. Based on #43; PR to open vs final after #43 merges.
