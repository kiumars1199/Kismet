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
(filled at the end)

## Decisions (lead calls, incl. blockers > 20 min)
- Design tokens: the approved artboard wins over the old docs/06 values; docs/06 now lists what the app implements.
- T-60: fixtures in `apps/web/test/fixtures/` already existed (500 markets, 150 flags); reused as-is.
- `engine fit` needs `data/` (gitignored, ~1 h Polymarket bootstrap). Bootstrap started locally at the start of the night.
