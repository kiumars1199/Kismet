# F16 big-trade detection: source and threshold

- Source: Polymarket Data API v2, "List trades". Public, no API key ("All data routes are public; no API key or token is required").
  Docs read 2026-11-23: https://docs.polymarket.com/api-reference/feeds/list-trades.md
  Migration note (v1 retires 2026-11-02, so v2 is used): https://docs.polymarket.com/migrate/data-api-v1-to-v2.md
- Request: `GET https://data-api.polymarket.com/v2/trades?event_id=<up to 20>&filter_type=CASH&filter_amount=10000&taker_only=true&limit=1000`, then `&cursor=<next_cursor>` with the same filters
- Row fields used: `size` (shares), `price` (USDC per share), `timestamp` (epoch seconds), `transaction_hash`, `token_id`, `outcome`, `side`.
  The row has no dollar field, so dollars = `size x price` (computed in `lib/bigtrade.ts`, which also re-checks the threshold itself).
- Threshold: one trade (one taker-side fill) of **$10,000 or more** (`BIG_TRADE_USD` in `lib/alerts.ts`).
- Matching: trades come back per Polymarket event; a row counts for a market when its `token_id` is one of that market's two CLOB tokens
  (`Market.tokens`), so no engine or data-contract change is needed.
- Who: Premium only. The evaluator hands the trade feed to Premium users only (`lib/alerts-server.ts`), so Free and Pro rules never fire
  and never trigger a request. One alert per trade per user (dedupe key rule + market + transaction + token, plus a per-run check so a
  general rule and a single-market rule don't both send it; a rule never reaches back before it was created). At most 10 per rule per run.
- When: within one scan. refresh.yml POSTs `/api/alerts/run?kind=bigtrade` (cron secret) after every 30-minute scan; that run evaluates
  only big-trade rules. The daily Vercel cron still runs every rule. Look-back 25 h; dedupe makes the overlap harmless.
- Order: the docs give no sort direction for the `event_id` feed, and `/v2/trades` has no sort/order parameter (only `/v2/activity`
  does). So the fetch follows `next_cursor` (up to 5 pages of 1000 per 20 events) until the feed ends or a newest-first page passes
  the look-back, and sorts newest first itself. Limit: an oldest-first feed with more than 5,000 trades of $10,000+ in one batch's
  3-year window would still miss the newest. Each run logs `big-trade feed: N requests, N trades, newest <time>` to show the live order.
- US-venue events (`us:<id>`) are not Polymarket ids and are never sent to the API.
- Not verified live: the build sandbox's network blocks `data-api.polymarket.com` (proxy 403), so the response shape is taken from the docs
  and parsing is tolerant (a row that doesn't match is dropped). First live check belongs to the reviewer on the preview with network access.
