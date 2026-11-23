# F14 #53 round 5, d494061

Setup: paid mock on next dev :3314, with trading on (demo, allowlist r53-premium-trade@example.com) and HISTORY_LIVE=off.
Markets: /m/6674492 (has a chart) and /m/7078474 (no history). Raw output is in p53.log.

## Whole-page CLS

| Plan | 390 | 1440 |
|---|---|---|
| Signed out (teaser) | 0 | 0 |
| Free | 0.0034 / 0.0079 | 0.0056 / 0.0064 |
| Pro, Premium, allowlisted | 0 | 0.0006 |

## Action row
- trade-slot is 0 everywhere.
- The Trade button shows only for the allowlisted Premium user.
- The combo button shows for Premium only.
- No reserve slot is left over.

## Chart
- 6674492: the chart and curve render. Basis: "Prices from Polymarket, every 11 hours. Chance of Yes."
- 7078474: shows "No price history for this market yet". Basis: "Prices from Polymarket."
- The card is 360 px tall in both states.

## History API

| Caller | Status | Points | Last point |
|---|---|---|---|
| Signed out | 401 | – | – |
| Free (delayed) | 200 | 196 | 1794819437 |
| Paid | 200 | 197 | 1794859037 |

- Scan time is 1794873437.
- The empty market returns 200 with 0 points.

## Venues block
- Exactly one "Pays most" per market.
- Kalshi on 6674492 shows a % only, with the line "its payout after fees is not worked out here yet". This is for F4 to settle.

## Page checks
No cents, disclaimer present, no horizontal scroll, no page errors.
