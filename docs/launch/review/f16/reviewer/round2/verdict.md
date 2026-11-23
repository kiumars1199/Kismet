# F16 #57 5ec0156 round 2: FAIL (merge conflict only; code passes)
- PR is dirty: the same rls.test.ts conflict as #56 (merged in). No CI on 5ec0156.
- refresh.yml: a step after the Supabase upload POSTs /api/alerts/run?kind=bigtrade with CRON_SECRET; continue-on-error; skips with a warning
  if SITE_URL/CRON_SECRET are unset. /api/alerts/run is in public-paths, so the middleware lets it through. Decision 07:50 recorded.
- kind=bigtrade: kindsFromQuery -> ["big_trade"], any other value -> 400. runRules skips other kinds; the user's other rules stay as context.
  Counts are recorded under alerts_last_bigtrade_run. Test "kind=bigtrade evaluates only big-trade rules".
- Feed: follows next_cursor (max 5 pages x 1000 per chunk of 20 events), stops early when the feed is newest first, sorts newest first.
  One console line per run: requests, trades, newest. Tests cover both directions.
- "us:" and empty ids are dropped (test with a mixed batch). Cap: 10 per rule, newest kept.
- Dedupe: key bt|user|tx|token; alert_events.dedupe_key is globally unique (init migration), so one alert per user per trade across rules
  and runs, plus a Set within a run.
- Premium only: fetchBigTrades only when tier === premium (unchanged). Test "Free and Pro never get it".
Notes: (a) decisions.md line 38 still says "dedupe rule + market + transaction" and "cron is daily". (b) Worst case 5 pages x 8 s per chunk
across many Premium users can pass maxDuration 60; the next run's dedupe recovers it. (c) Still not seen live (proxy 403); read the first
production log line.
Unit (wtf01b @5ec0156): alerts-bigtrade + cron + security + push-subscribe + sw + rls 81/81.
