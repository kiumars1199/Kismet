# MarketEdge demo — status

Branch `demo`. Built in one night by an agent team (one lane per worktree), merged by the lead.

## How to run
(filled at the end)

## Demo scope (docs/01) — verified in the browser
- [ ] Screener, search, all filters, grouping (F-01..F-03)
- [ ] Drawer + live execution check + stake table (F-04, F-05)
- [ ] Flags, event pages, share links, OG images (F-06, F-16, F-26)
- [ ] Presets, favorite topics, watchlist (F-07..F-09)
- [ ] Dashboards (F-10)
- [ ] Alerts: rule editor, in-app inbox, browser notifications, 2-min evaluator (F-11, F-23)
- [ ] Bet journal + CLV + P&L, `/api/settle` on load (F-12)
- [ ] Kelly sizing, calculators (F-13, F-15)
- [ ] Track record + methodology (F-14), flag ledger (F-29)
- [ ] Display settings, keyboard, CSV export, onboarding (F-17..F-19, F-27)
- [ ] Landing + pricing (F-20)
- [ ] Chrome extension (F-25)
- [ ] `<UpgradeGate>` present, always passes in demo (F-22)

## What's stubbed
(filled at the end)

## Known issues
- All 581 XRP markets score off the top-level "all" model node (too little XRP history to pass node thresholds). The drawer's "model fell back to a broad level" warning covers it.
- `volume_24h` is null for ~10k of 13.7k markets (Gamma omits `volume24hr`); the 24h-volume filter only matches markets that report it.
- Ledger has 704 open rows from two scans tonight; none graded yet (markets haven't resolved), so Results shows the backtest plus an empty live record.

## Decisions (lead calls, incl. blockers > 20 min)
- Design tokens: the approved artboard wins over the old docs/06 values; docs/06 now lists what the app implements.
- docs/08 said demo runs as `pro`; docs/01 and the brief say `premium`. Went with premium, fixed docs/08.
- Engine warning text says "15c" (scan.py) where docs/07 says "15¢"; UI shows its own plain-language label ("Unusually high — check details"), so the raw string is not user-facing.
- LocalRepo adds sync `snapshot()`/`profileSnapshot()` for useSyncExternalStore; SupabaseRepo must serve them from a cache.
- Lane A widened SAMPLE_TAGS and added tag aliases (cbb→ncaab, mma→ufc, formula1→f1) so new niches get history; kept.
- T-60: fixtures in `apps/web/test/fixtures/` already existed (500 markets, 150 flags); reused as-is.
- `engine fit` needs `data/` (gitignored, ~1 h Polymarket bootstrap). Bootstrap started locally at the start of the night.
