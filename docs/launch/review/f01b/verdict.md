# launch/checker-f01b c7e0a4b (no PR): PASS with notes
typecheck/lint OK; vitest lib/check+test/check 64/64; e2e f01-checker+f02-combo 15/15 (incl. new slow-lookup combo CLS at 390/1440); merges clean with final; merges clean with #52 39e3f74.
Stubbed /api/check kalshi prices (stub-probe.log, screenshots): {0:.44,1:.6} -> Yes side "Yes is 44%" Use it -> 44; No side "No is 60%" Use it -> 60. {0:.44,1:null} -> No side hides the line.
Missing card 640 px; CLS 0.001-0.004 at 390/1440 (missing-cls.log).
Still unreachable with #52: #52 writes kalshi_ticker into venues.json only; store.ts (venuesOf) merges venues, not kalshi_ticker, onto StoreMarket; resolveLink reads m.kalshi_ticker.
Not run here: check:js, paid limit spec, full vitest (coordinator runs in integ).
