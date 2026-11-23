# F4 #52 a044cde (merges final 40acce0)

## Tests
- pytest engine/tests/test_venues.py: 7 passed.
  - Precision 1.000 on 50 hand-labelled pairs (23 same, 27 different; TP 22, FP 0).
  - Recall 0.957 (1 FN, "mentions").
- vitest: lib/venues, test/venues-store, kalshi-search, kalshi: 64 passed.
- e2e launch-f04-venues.spec.ts (PW_DEV, :3320): 8/8 pass, including the /check paste of a Kalshi link (KXFIXTURE-6674492).
- launch-f09-state-signed-out also ran: one 390 cold-compile flake, then 6/6 on rerun.

## Runtime (paid mock :3321; p52.log, screenshots)
Coverage: signed out, Free, Pro and Premium, each at 390 and 1440.

Pages checked:
- /m/7077573 (3 venues)
- /m/6674492 (Polymarket + Kalshi)
- /m/7078474 (Polymarket + US)
- /m/6635049 (one venue)
- the /bets?m=7077573 drawer

| Market | Polymarket | Polymarket US | Kalshi |
|---|---|---|---|
| 7077573 | 1.32x 75%, "Pays most here (Kalshi fee not counted)" | 1.29x 76% | 76% (no multiplier) |
| 6674492 | 1.45x 68%, "Pays most here (Kalshi fee not counted)" | Not listed | 69% |
| 7078474 | 1.37x 72%, "Pays most here" | 1.34x 73% | Not listed |

- 6635049 has no block.
- Exactly one "Pays most" everywhere.
- The basis summary is a 44 px tap target.

Signed out:
- /m shows the teaser and no block.
- /api/markets/7077573 returns 401.
- /bets redirects to signup.

Page checks:
- CLS on /m is at most 0.0079 (Free) and at most 0.0066 (paid).
- The Free /bets drawer at 390 has CLS 0.0377. The shift is the card underneath growing (h140->192), not the block.
- No cents, disclaimer present, no horizontal scroll, no page errors.

- kalshi_ticker stays null on the store row; kalshi_matched_ticker = KXFIXTURE-7077573.
