# F16 big-trade detection: source and threshold

- Source: Polymarket Data API v2, "List trades". Public, no API key ("All data routes are public; no API key or token is required").
  Docs read 2026-11-23: https://docs.polymarket.com/api-reference/feeds/list-trades.md
  Migration note (v1 retires 2026-11-02, so v2 is used): https://docs.polymarket.com/migrate/data-api-v1-to-v2.md
- Request: `GET https://data-api.polymarket.com/v2/trades?event_id=<up to 20>&filter_type=CASH&filter_amount=10000&taker_only=true&limit=200`
- Row fields used: `size` (shares), `price` (USDC per share), `timestamp` (epoch seconds), `transaction_hash`, `token_id`, `outcome`, `side`.
  The row has no dollar field, so dollars = `size x price` (computed in `lib/bigtrade.ts`, which also re-checks the threshold itself).
- Threshold: one trade (one taker-side fill) of **$10,000 or more** (`BIG_TRADE_USD` in `lib/alerts.ts`).
- Matching: trades come back per Polymarket event; a row counts for a market when its `token_id` is one of that market's two CLOB tokens
  (`Market.tokens`), so no engine or data-contract change is needed.
- Who: Premium only. The evaluator hands the trade feed to Premium users only (`lib/alerts-server.ts`), so Free and Pro rules never fire
  and never trigger a request. One alert per trade per rule (dedupe key rule + market + transaction + token), within the next daily scan
  (look-back 25 h).
- Not verified live: the build sandbox's network blocks `data-api.polymarket.com` (proxy 403), so the response shape is taken from the docs
  and parsing is tolerant (a row that doesn't match is dropped). First live check belongs to the reviewer on the preview with network access.
