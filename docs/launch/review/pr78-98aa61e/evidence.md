# #78 at 98aa61e: Kalshi fee worked for a $100 reference order

## Maths
- Re-derived in integer cents: C = 10000 // p, fee = ceil(7·C·p·(100−p) / 10000) cents.

| P | C | Fee | Multiplier |
|---|---|---|---|
| 0.01 | 10000 | $6.93 | 93.5191 |
| 0.05 | 2000 | $6.65 | 18.7529 |
| 0.50 | 200 | $3.50 | 1.9324 |
| 0.76 | 131 | $1.68 | 1.294 (shows 1.29x) |
| 0.97 | 103 | $0.21 | 1.0288 |

- Fixture 0.69 gives 1.4184, which matches venues.json.
- A $10 order gives the same multiplier to 2 dp at every P checked (worst case 0.97: 1.0288 vs 1.0277, both 1.03x).

## Store and e2e
- The store passes the venues.json multiplier through unchanged (venues-store test "kept, not nulled").
- The fixture matches the engine, and the e2e expects 1.29x. They agree.

## Tests
- pytest test_venues: 11 passed.
- vitest lib/venues + venues-store: 47 passed.
- e2e launch-f04-venues (PW_DEV :3332):
  - First run 7/8: the 390 case hit the 30 s test timeout as the first test on a cold dev compile. Its 1440 twin passed.
  - Rerun: 8/8.

## Not personalised
- REFERENCE_STAKE = 100 is a module constant.
- No user input reaches engine/venues.py.
- The basis says "for a $100 bet" for everyone.
