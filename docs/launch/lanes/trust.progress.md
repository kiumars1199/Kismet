# trust progress

- F7 · PR #41 https://github.com/kiumars1199/Kismet/pull/41 head 549a62b. CI/review: main handling.
- F8 · PR #44 https://github.com/kiumars1199/Kismet/pull/44 head f1d4e3e (pause, help line 1-800-MY-RESET, RiskNote, 18+ e2e). Migration 20261122000000_pause.sql: lead applies. In review.
- F9 · PR #48 https://github.com/kiumars1199/Kismet/pull/48 head 09d9ca1, STACKED on #44 (also carries the check:js fix: 143.8 kB). Kalshi and Polymarket US per-state entries are "unverified" (no official per-state list reachable). In review.
- F15 · PR #49 https://github.com/kiumars1199/Kismet/pull/49 head c8d68a1 (from origin/final). Migration 20261122000300_admin_metrics.sql: lead applies (adds stripe_events.amount_cents/customer). Evidence docs/launch/review/f15/evidence.md. typecheck/lint clean; 118/119 test files (api.test.ts timing flake); check:js 142.5 OK; launch-f15-admin e2e pass; e2e-paid/admin.spec.ts fails on origin/final too (env).
- All four lane features have PRs. Remaining: review fixes on request.
- fix: admin e2e-paid ERR_ABORTED · PR #50 https://github.com/kiumars1199/Kismet/pull/50 head 850bdd3. Cause: 120 s per-test timeout vs cold next dev compiles (~70 s for admin routes alone). Fix: test.setTimeout(300_000) on the two tests; both pass (2.9m, 2.6m). Idle until review findings.
- F9 fix round (Nov 22) · launch/trust-f9 pushed (still stacked on #44; rebase on final after F8 merges). Polymarket US: NV restricted, others available (polymarket.us/trust). Kalshi unverified everywhere (no official list; see decisions.md). Visible availability bar above /markets, labels on icon links, line on event page. Evidence: tsc, lint clean; vitest 115/116 files (api.test.ts timing flake only); check:js 144.1 kB OK; chromium e2e launch-f09 6/6 pass.
- F9: lead confirmed Kalshi stays unverified (decisions.md). Waiting for F8 on final to rebase F9 and do the trade-config 423 branch.
- F9 merged origin/final (no rebase), head aaa9198 pushed; check:js 144.1; launch-f08+f09 e2e pass. fix: trade config 423 PR #54 https://github.com/kiumars1199/Kismet/pull/54 head 1979f82.
- F9 state picker (signed out) · PR #63 https://github.com/kiumars1199/Kismet/pull/63 head 315b0db (launch/trust-f9-state from final 67cab85). Public /state page plus `?next=`; "Check your state" links go there. Reusable `StateLink` for F6 HowToBet (wire it in after #46 is on final, when main says). Evidence: e2e failed first on final (landed on /settings#state); now tsc and lint clean, vitest 126/126, check:js 144.2 kB, chromium launch-f09 9/9.

## 2026-11-23 CI paid e2e (launch/trust-ci-paid)
- Cause on CI (run 45122942012): next dev's own memory restart at 13.8 min of a 15.3 min paid run. The heap grows about 350 MB/min with no plateau (local base2: 5.3 GB peak at ~13 min).
- Local baselines base1/base2 void: other lanes' broad `pkill -f` killed the dev server (it exited 0 with no restart line). Main has told lanes to stop.
- Fix: `pnpm e2e` runs the paid suite in 2 shards, each with its own dev server; playwright.paid.config.ts pins --max-old-space-size=8192; web-ci adds a step printing `free -m` and the Node heap limit.
- chg1: 16/16 + 15/15 passed, 0 restarts, 963 s, peak used heap 4.3/3.2 GB.
- Not covered by this fix: qa-c-billing ERR_ABORTED (test races CheckoutStatus's location.replace) and password.spec ECONNRESET. Both reported to main.
