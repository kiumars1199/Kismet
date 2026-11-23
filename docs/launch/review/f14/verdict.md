# F14 #53 581a9de: PASS with notes

Head: 581a9de, which is f292928 plus a merge of F4 42ee0ba.

## Done when
| Item | Result |
|------|--------|
| Engine history | ≤200 points, ≤90 days. Size at fixture scale per the PR: 280 series = 232 kB plain / 85 kB gzip. |
| Chart | `/api/markets/<id>/history` serves the data. The Recharts line shows %, and the basis line reads "Prices from Polymarket, every 11 hours". |
| e2e | launch-f14-history passes; the empty-state text is "No price history for this market yet", where the SPEC says "…yet". |
| Card height | 360 px in every state, for signed out, Free, Pro and Premium, at 390 and 1440 px. |
| Details expand | 44 px tap target. Shows the source, the latest point time and the Free delay note. |
| Units | No cents and no horizontal scroll. |
| Disclaimer | Present. |

## Checks
| Check | Result |
|-------|--------|
| pytest | 175 |
| typecheck | Pass (after clearing a stale .next) |
| lint | Pass |
| vitest | 1523/1523 |
| build | OK; /m 175 kB |
| check:js | 144.6 kB |
| e2e f14+f04 | 17/17 |
| CI on 581a9de | web, python and supply-chain all success |

## Findings
1. **Free cut is on bucket start, not raw time.** Each bucket holds the LAST raw price inside it, so the last kept point can be a price from up to dt−1 after Free's scan. The Free delay is 15 min, and dt is 1–11 h.
   - Python twin demo: an 11 h series cut 5 h before now keeps a bucket whose value comes from 2 h AFTER the cut.
   - A 1 h series keeps a value from 10 min after the cut.
   - `as_of` shows the bucket start, so the timestamp also understates how fresh the value is.
   - Fix: drop the bucket that straddles the cut (keep `x.t + dt <= cut`). On the live path, cut the raw points before downsampling.
2. **Empty-state CLS from node reuse.**
   - CLS with paper trading off: 0.20 at 390 and 0.11 at 1440 on the empty-state market 7078474. The chart markets measure 0.002–0.004.
   - Chromium reports the shift on `history-empty` with a (0,0) previousRect while the card is about 2200 px below the fold, so nothing visibly moves. Chromium field CLS will still count it.
   - Cause: the `animate-pulse` skeleton div and the empty/error div share one JSX slot, so React reuses the animated node.
   - Likely fix: a `key` per state branch, or no animation on the reused node. The error state probably behaves the same way (not measured).
   - The e2e spec logs these CLS values and attributes them all to the paper Trade button: 0.389 at 390 is about 0.19 paper + 0.197 from this.
3. **Cosmetic:** in ops/scheduler.py the old "# F3: every open Kalshi market" comment now trails the history line.
4. **Not tested live:** the CLOB fallback (HISTORY_LIVE=off in e2e). It is covered by unit tests with a stubbed fetch: a single in-flight fetch, the 10 min cache, the 3 s timeout producing an empty series, the 14-day fallback, and no fetch on a 404.
