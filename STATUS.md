# MarketEdge demo — status

Branch `demo`. Built in one night by an agent team (one lane per worktree), merged by the lead.

## How to run
Python 3.12+ and Node 20+ with pnpm. From the repo root:

```bash
pip install -r requirements.txt
```
```bash
python3 -m engine scan
```
(refreshes `output/*.json` from live Polymarket prices; `python3 -m engine all` also re-fits, but needs the `data/` history bootstrap)
```bash
cd apps/web && pnpm i
```
```bash
pnpm dev
```
Open http://localhost:3000. Demo mode is on by default (`DEMO_MODE=true`, `DATA_SOURCE=local` reading `../../output`): no login, no Stripe, every feature unlocked, your lists and bets saved in this browser.

Checks:
```bash
pnpm typecheck && pnpm test
```
```bash
pnpm build
```
```bash
pnpm e2e
```
(Playwright starts its own server on :3100 against `test/fixtures`.)

Extension:
```bash
cd apps/extension && pnpm i && pnpm build
```
Then load `apps/extension/dist` in chrome://extensions with Developer mode on (Load unpacked), with the web app running on :3000. Open any Polymarket event page.

## Demo scope (docs/01) — verified in the browser
- [x] Screener, search, all filters, grouping (F-01..F-03): /markets, 13k markets, grouped by event, filters in the URL (S2)
- [x] Drawer + live execution check + stake table (F-04, F-05): live order book every 5 s, "You get back if it wins" table, own stake (S3)
- [x] Flags, event pages, share links, OG images (F-06, F-16, F-26): /flags, /event/[id], /m/[id] with a 1200×630 OG image
- [x] Presets, favorite topics, watchlist (F-07..F-09): save/switch/share presets (S4), My list with since-saved (S5)
- [x] Dashboards (F-10): a new dashboard starts with 3 panels (screenshot dashboard-d.png)
- [x] Alerts: rule editor, in-app inbox, browser notifications, 2-min evaluator (F-11, F-23): a loose "All markets" rule fired 3 inbox items on load; dedupe covered by e2e. Browser notifications ask permission only when switched on (not exercised headless)
- [x] Bet journal + CLV + P&L, `/api/settle` on load (F-12): a $50 bet logged from the drawer shows in My bets; settle returns unresolved for open markets
- [x] Kelly sizing, calculators (F-13, F-15): drawer Kelly card, /tools (S6: q=0.6, p=0.5 → 20%)
- [x] Track record + methodology (F-14), flag ledger (F-29): /track-record tiles equal backtest.json (S6)
- [x] Display settings, keyboard, CSV export, onboarding (F-17..F-19, F-27): /settings, `?` help, `j`/`w`, CSV of the current view, /onboarding
- [x] Landing + pricing (F-20)
- [x] Chrome extension (F-25): badges on 3 live Polymarket event pages (weather, NFL, UFC), pill fallback on a 4th; popup + side panel. See docs/screenshots/extension-*.png
- [x] `<UpgradeGate>` present, always passes in demo (F-22)

## What's stubbed
- Auth and billing: `DEMO_MODE=true` runs as `premium` with no login; `/pricing` buttons don't charge. Supabase and Stripe wiring (Lane E) is not built; `<UpgradeGate>` and the entitlements table are, so it slots in.
- User data lives in `localStorage` (LocalRepo). A SupabaseRepo with the same interface is next.
- Alerts run only while a MarketEdge tab is open (every 2 min); email, Telegram and Discord channels are shown but not sent. "Run now" is dev-only.
- No order placement anywhere: "Open on Polymarket" links out.

## Known issues
- Extension: sports badges sit under the Moneyline/Spreads/Totals headings; matching is exact text only (unmatched markets get the corner pill); side-panel screenshot taken by opening the panel page directly.
- All 581 XRP markets score off the top-level "all" model node (too little XRP history to pass node thresholds). The drawer's "model fell back to a broad level" warning covers it.
- `volume_24h` is null for ~10k of 13.7k markets (Gamma omits `volume24hr`); the 24h-volume filter only matches markets that report it.
- Ledger has 878 open rows from three scans; none graded yet (markets haven't resolved), so Results shows the backtest plus an empty live record. `python3 -m engine grade` grades them once they close.
- "Unusually high" shows on most top bets (edge ≥ 15¢, per docs/07). The note now gives what similar past bets really returned (e.g. +24% next to +32%) so the headline isn't taken at face value.
- Filter-panel counts come from /api/meta, so they ignore the other filters you've set.
- "Similar past bets returned" only exists for best bets (the engine computes `realistic_edge` for flags only).
- With "My list only" on, rows are filtered per fetched page, so a page can come back short.
- The fixtures have no "thin" or "not worth it" flags; those notes are only exercised on real data.

## Decisions (lead calls, incl. blockers > 20 min)
- Design tokens: the approved artboard wins over the old docs/06 values; docs/06 now lists what the app implements.
- docs/08 said demo runs as `pro`; docs/01 and the brief say `premium`. Went with premium, fixed docs/08.
- Engine warning text says "15c" (scan.py) where docs/07 says "15¢"; UI shows its own plain-language label ("Unusually high — similar past bets returned +X%", or "check details" when unknown), so the raw string is not user-facing.
- LocalRepo adds sync `snapshot()`/`profileSnapshot()` for useSyncExternalStore; SupabaseRepo must serve them from a cache.
- Lane A widened SAMPLE_TAGS and added tag aliases (cbb→ncaab, mma→ufc, formula1→f1) so new niches get history; kept.
- Grouped screener pages over event groups (≤50 per page, best row + up to 3 more each, `size` = full count); docs/04's "paginate groups" sent 2.8 MB pages on real data.
- Worktrees spawned by the agent tool start from `main`, not `demo`; every lane brief begins with `git reset --hard demo`.
- Lanes C and D split in two each (C1 screener+drawer, C2 results/landing/status, D1 presets/list/onboarding/keys/CSV, D2 settings/dashboards/bets/Kelly/tools/alerts) so five teammates work on disjoint files.
- Playwright e2e runs on port 3100 against fixtures (never reuses a real-data server on 3000).
- T-60: fixtures in `apps/web/test/fixtures/` already existed (500 markets, 150 flags); reused as-is.
- `engine fit` needs `data/` (gitignored, ~1 h Polymarket bootstrap). Bootstrap started locally at the start of the night.
- Lead review fixes after the advisor pass: stake table says "You get back if it wins" (it is payout, not profit); "pick"/"edge" removed from casual text (Pro mode and Results keep "edge"); landing hides the ¢-per-share and t-stat tiles (kept on Results); save star is 44px; landing count, Best bets page and the built-in "Best bets right now" view all use worth it + thin.
- Alert channel type gained `"inapp"` (D1's target-price alerts); D2's inbox is always on regardless.
