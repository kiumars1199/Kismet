# Marc's QA list (Nov 20, 2026): Lane D log (Kalshi, combos, plans)

Owner decision (final): Kalshi data and combos are ON permanently; `KALSHI_DATA_PERMISSION=true` is set on Vercel
(production + preview) and on the Railway engine service. Lane D was respawned on Nov 21 (the first agent stalled on a
permission prompt and left no commits). No dashboard tools were used (no Railway, Supabase, Vercel or Stripe calls):
the pipeline was checked by reading the code and by `curl` on public URLs. Anything that needs a dashboard or a
signed-in session is listed under "Main / Q to verify" with the exact check.

Branches are stacked (each starts from the previous one), so they merge in this order:

1. `claude/qa-d-golive`: Combos and Kalshi out of beta, `/kalshi` for every signed-in plan, nav link, plan cards and
   /pricing list both features, pipeline check (item 1).
2. `claude/qa-d-combos`: Marc's combo bugs 15, 42, 52, 65, 74 and the leg-rule tests.
3. `claude/qa-d-kalshi-fetch`: fetch every open Kalshi event and market, with more fields and settlements (item 2).

Order note: the brief lists the fetcher before the site work. It was moved last because it is the one group that can't
be checked against the live API from this session (see item 2), and Lane C's pricing copy (#39) waits on group 1.

Baseline on `origin/final` (f93f00a): tsc and lint clean; vitest 1 failure, `test/teaser.test.ts` "one bet per game"
(date-dependent, known, not Lane D's). `test/api.test.ts` "p95 < 150 ms" also fails when the machine is loaded (load
average 15 with four lanes running); it passes when run alone.

## Item 1: pipeline (read from the code; live checks for main)

| Check | Status | Evidence |
|---|---|---|
| The engine writes `output/kalshi.json` every scan with the flag on | Yes, by code | `railway.json` starts `python ops/scheduler.py`. Its `scan` job runs `python -m engine scan`, then `ops/upload.py output`. `engine/__main__.py` (cmd `scan`) runs `scan_keeping_prev`, then `pipeline.fetch_kalshi.run_if_enabled(output/kalshi.json, data/kalshi_cache)`, which is a no-op unless `KALSHI_DATA_PERMISSION` is exactly `true`. A Kalshi failure is logged (`kalshi: skipped (...)`) and never fails the scan. |
| The publish step uploads `kalshi.json` to the Supabase `scan` bucket | Yes, by code | `ops/upload.py publish()` uploads every `output/*.json` and `*.jsonl` except the local `-prev` copies, so `kalshi.json` goes up with each scan even though the file never names it. It is not rotated into `-prev` copies (only markets, flags, top and counts are), which is right: Kalshi data has no Free delay. |
| The web app reads it | Yes, by code | `lib/data/store.ts getKalshi()` reads `kalshi.json` from the same source chain as the scan, with its own 120 s cache. |
| `fetched_at` is honest | **Was not**; fixed in group 3 | The fetcher cached every Kalshi call on disk for 600 s while Railway scans every 15 min (Lane A's log) or 2 min (the default). With the default cadence `fetched_at` was stamped "now" on data up to 10 min old. Group 3 sets the cache lifetime below the cadence and stamps `fetched_at` from the oldest page actually used. Field name unchanged (Lane A reads it). |
| Live `/api/kalshi` and `/kalshi` | Not checkable signed out | `curl https://kismetodds.com/api/kalshi` → 401 `{"error":"Sign in to use this."}`; `/kalshi` → 307 to `/signup?next=%2Fkalshi` (account wall, as intended). `/api/meta` → 200, scan 1795225601. |
| Kalshi public API reachable from here | **No** | `curl https://api.elections.kalshi.com/trade-api/v2/events` → 403 from this session's egress proxy ("no rule allows this host"). No environment change was requested (that is a permission prompt). Group 3 is built from Kalshi's documented fields and the repo's own fixture; see the checks for main below. |

## Group 1: `claude/qa-d-golive`

| Item | Status | Evidence |
|---|---|---|
| Combos and Kalshi out of beta | Done | `lib/beta-list.ts` `BETA_FEATURES = []`. `<BetaBadge>` renders nothing while the list is empty, so no pill, tag or banner anywhere (Header and MobileNav untouched). |
| 3. `/kalshi` for every signed-in plan | Done | Live rule `kalshi` (unchanged in `lib/beta.ts`): `KALSHI_DATA_PERMISSION=true` on the server, any plan. Signed out: account wall, as before. `test/kalshi.test.ts`: Free, Pro and Premium all get 200 from `/api/kalshi` and the board on `/kalshi` with the flag on; 404 with it off; empty state with no `kalshi.json`. |
| 3. Nav link everywhere | Done with Lane C's header (merge `claude/qa-c-header` first) | The browser can't read `KALSHI_DATA_PERMISSION`, so a client-side `canBeta("kalshi")` would hide the link forever once Kalshi leaves beta. Lane C's `claude/qa-c-header` decides the gated links on the server (`navFeatures`, `/api/me` `nav`, layout hint), so this branch doesn't touch `/api/me`, Header or MobileNav. With both merged: Kalshi for every signed-in plan, Combos for Premium, no Beta pill (the pill only shows for features still in `BETA_FEATURES`). `e2e-paid/admin.spec.ts` asserts `/api/me` `nav` = `["kalshi"]` (Free) and `["combos","kalshi"]` (Premium), so it needs Lane C's branch merged first. Footer: "Kalshi markets" shows with the flag on (it was hidden while in beta). |
| 3. "Updated" time from `kalshi.json` | Already there | `KalshiBoard` header: "Data: Kalshi · updated {ago(meta.fetched_at)}". How relative ages render is Lane A's. |
| `/api/kalshi` cache | Fixed | It switched to `public, s-maxage=120` once out of beta, on an account-walled route (a CDN could hand it to anyone). Now always `private, no-store`, `Vary: Cookie`. |
| `/combos` for Free and Pro | Decided: upgrade prompt, not a 404 | Combos stay Premium (`lib/entitlements`). A Free or Pro user who opens `/combos` sees what Combos are and "See Premium" (`data-testid="combos-upgrade"`). `/api/combos` answers them with no groups, as before. |
| Kalshi combo check in the tray | Gate fixed; still can't fire | `/api/combos/kalshi` now needs Combos (Premium) and the flag. It still never shows a button in practice: it needs a `kalshi_ticker` on every leg, and the engine's `kalshi_match` job (docs/16 §3) doesn't exist yet. **Q decides** whether to build matching. |
| MCP | Done | `get_market` names the Kalshi venue when the flag is on (was testers only), without "beta". |
| 5. Plans | Done | /pricing table: "Combos: 2- and 3-leg bets from Best bets, and your own combo builder" (—, —, Yes) and "Kalshi markets: prices, volume and Kalshi Combos" (Yes, Yes, Yes). Plan cards: Free and Pro list "Kalshi markets: prices, volume, Kalshi Combos"; Premium "Combos: 2- and 3-leg bets built from Best bets, plus your own combo builder" (no "coming soon"; Premium inherits Kalshi through "Everything in Pro"). `Plans.test.tsx` checks each card against `can(tier, "combos")`. **Lane C:** the Combos and Kalshi lines on /pricing and the plan cards are in; #39 can go on top. The Chrome extension line still says "coming soon" (not Lane D's). |
| e2e | Updated to the new truth | Both Playwright configs set `KALSHI_DATA_PERMISSION=true` (as production). `e2e-paid/admin.spec.ts`: a signed-in Free user gets `/kalshi` 200, a Kalshi nav link with no Beta pill, no Combos link, `/combos` upgrade prompt, `/api/combos/kalshi` `enabled: false`, `/api/me` `nav: ["kalshi"]`; the admin (Premium) gets both links and pages, no Beta marker, `enabled: true`. Run on a local merge of this branch with `claude/qa-c-header` (not pushed): `admin.spec.ts`, `qa-c-404.spec.ts`, `t291-plans.spec.ts` (paid config, chromium) all pass. The admin test's 120 s limit tripped once on cold dev compiles under load (load average 11; it failed at the banner reset, after every Lane D assertion had passed). It passed alone on the rerun. |
| Demo e2e (`e2e/multipliers.spec.ts`) | Updated; one test waits on Lane C | The Add to combo button, the tray and `/combos` no longer carry a Beta tag or banner. 3 of 4 tests pass on a local merge with `claude/qa-c-header`. "combos page…" fails at the Combos nav link: in `DEMO_MODE` Lane C's header never gets `/api/me` (AuthBoot skips `loadMe()` in demo) and the layout hint is null without auth, so no gated links show in demo. That fails Lane C's own version of the assertion too. Reported to main for Lane C. Merge conflict with `qa-c-header` in that block: keep this branch's version. |
| Gates | Green | tsc and lint clean; vitest only the known teaser failure; `pnpm build && pnpm check:js` (no env) 142.0 kB, under the 150 kB budget (baseline 141.9). |
