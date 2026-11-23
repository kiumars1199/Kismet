# F4 #52 head da59363 (local next start, fixtures, DEMO_MODE=true, KALSHI_DATA_PERMISSION=true)
- pytest engine/tests 137 passed; test_venues: 50 labeled pairs (23 same / 27 hard negatives), precision 1.000 (TP 22, FP 0), recall 0.957. Pairs are synthetic (ids pm0.., events e0..), not real PM/Kalshi rows.
- typecheck, lint OK; vitest lib/venues + venues-store 9/9; build OK; check:js / 142.5 kB OK; /m/[id] 180.1 kB (OVER; build table 175 kB vs 174-175 kB on earlier builds = pre-existing).
- e2e launch-f04-venues 4/4 (e2e.log).
- probe.log + screenshots {390,1440}-m-{6674492,7078474}{,-block}.png, {390,1440}-drawer-6674492.png: block in drawer and /m, no cents, no hscroll.
- 6674492 page: "International only, not on Polymarket US" while the block lists Polymarket US 66% 1.49x "Pays most here".
- 7078474 page: "Pays 1.34x on Polymarket US" while the block shows Polymarket US 1.41x 70% (markets.json us.ask 0.73 fee 0.0187; venues.json us 0.70).
- store.ts loadCopy (delayed Free/anon store) passes venues: s.venuesFile = the newest venues.json; usableVenues allows ±3 h skew.
