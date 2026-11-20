# Live record vs walk-forward test (T-296, lane E)

Question (docs/OVERHAUL.md §E): the walk-forward test says best bets return about +17%; the live ledger says about −2%.
Why, and what filter would have brought live closer to the test?

Short answer: the gap is real, but it is **not** explained by entry prices, the lower-confidence tier, 90¢+
favourites, weather, or a lookahead we could find in the price data. On the very markets of the overlap week the
model claims ~87% wins where the price says ~79% and the outcome came out ~80%: the **model's win chances are too
high live**. The live record itself is one slate of markets (179 events, almost all flagged on Nov 17), so it cannot
yet tell −2% from +10%. The one filter that moved both the in-sample and the held-out rows the same way is a cap on
the predicted edge (`flag_max_edge = 0.10`); it is shipped off by default and it does **not** close the gap.

Everything below is reproducible with `scripts/ledger/*.py` (python3, standard library). Data: the `live` branch
(`git fetch origin live --depth=1`, commit `ecbc3a7`, published 2026-11-19 19:47 UTC) plus Polymarket's public Gamma and
CLOB APIs (read-only).

```bash
git show origin/live:ledger.jsonl > /tmp/l/ledger.jsonl        # also ledger_summary.json, backtest.json, flags.json, spreads.json
python3 scripts/ledger/analyze.py         /tmp/l/ledger.jsonl /tmp/l/ledger_summary.json /tmp/l/flags.json
python3 scripts/ledger/backtest_summary.py /tmp/l/backtest.json
python3 scripts/ledger/replay_prices.py   /tmp/l/ledger.jsonl /tmp/l/spreads.json /tmp/l/cache
python3 scripts/ledger/lookahead.py       /tmp/l/ledger.jsonl /tmp/l/spreads.json /tmp/l/cache
python3 scripts/ledger/stale_check.py     /tmp/l/ledger.jsonl /tmp/l/cache
python3 scripts/ledger/grade_now.py       /tmp/l/ledger.jsonl /tmp/l/ledger_now.jsonl /tmp/l/cache_now
python3 scripts/ledger/filters.py         /tmp/l/ledger_now.jsonl
python3 scripts/ledger/weather.py         /tmp/l/ledger.jsonl /tmp/l/ledger_now.jsonl
```

## 1. Where the site's numbers come from, reconciled

- `/track-record` "Live record" reads `ledger_summary.json` (engine/ledger.py `summarize`); the return is
  `lib/proof.liveReturn` = Σpnl ÷ Σ(ask + fee), one $1 share per row, pnl = won − ask − fee.
- `live` branch snapshot: 2,687 logged rows, **862 settled rows**, 667 won / 195 lost, `avg_pnl` −0.0170 per share
  (the "−1.7%" in the brief is **−1.7¢ per share**), return **−2.14%** (the spec's "−2.2%"). Recomputed from the rows:
  identical (sports 315 rows −4.27¢ / −5.3%, weather 547 rows −0.21¢ / −0.3%).
- The spec's "1,117 settled" was an intermediate production snapshot (Supabase bucket, not in git). Grading the
  `live` rows again from Gamma today adds 149 settled rows (1,011 in total; **weather becomes 589, the spec's
  "590"**). Production at 2026-11-20 17:27 UTC shows 1,239 settled rows (956 won / 283 lost) at **−1.2%**. The
  numbers move every 10 minutes; the definitions above are what matter.
- **Rows are not bets.** `ledger.append` logs a market side again whenever it is re-flagged at a lower ask: of the
  862 settled rows only **593 are distinct bets** (269 re-flag rows). Counting each bet once: **−0.56¢, −0.7%**.
- **Rows are not independent.** All 862 settled rows were flagged on **one day (Nov 17)**, graded in one run, and
  come from **179 events** (63 games, 116 city-days of weather). Event-clustered t = −0.96: the live loss is not
  distinguishable from zero. The test's +10.9¢ per share (live-branch run) is ~7 standard errors above live, so
  "live is below the test" is a fair statement; "live loses money" is not yet.

## 2. Findings, one per question in §E

| Question | Answer | Numbers |
|---|---|---|
| Entries priced at the real ask after fees? | **Yes.** | Ledger `ask` = Gamma bestAsk; in the latest scan the CLOB book's best ask equals it for 98% of best bets (mean diff −0.02¢). Fee = rate × p × (1−p), same as the engine. |
| Does the test price at mid while live pays the ask? | **Yes, but the test charges for it, and the charge is not too small.** | Same 593 live bets, priced the test's way at flag time (history price + fee + max(0.5¢, ½ median live spread)): avg cost **80.67¢** vs live ask + fee **80.15¢**. Return at test pricing **−1.3%** vs live −0.7% (`lookahead.py`). The history price sat 2.2–3.0¢ under the ask. |
| Edge tier ("More bets") mixed into best bets? | **No.** | `scan.run` appends `best_flags` only. 67 settled rows had verdict "thin" (book edge < 2¢) at +1.3%; 3 "not worth it". 34 ledger ids show as tier "edge" in today's scan only because their price moved later. |
| 90¢+ favourites dominating? | **No.** | 206 of 862 rows (24%); avg win +7.2¢, avg loss −92.6¢; net **+1.83** of the −14.62 total loss (+1.2%). The losses sit at 50–90¢. |
| Which categories lose live? | **Sports, not weather.** | Sports 315 rows / 63 games: **−5.3%** (model 88% wins, actual 76%). Two soccer games, Wales–Portugal (−8.71) and Denmark–Norway (−4.89), are **93% of the whole loss**: 50 correlated rows, mostly Unders, on two high-scoring matches. Weather 547 rows / 116 city-days: **−0.3%** (+0.9% per distinct bet). |
| Weather break-out | Break-even; 90% of it is one bet type. | 589 settled rows / 375 distinct bets (with today's grading): −0.9% / −0.2%. "No" on an exact high-temperature bucket: 276 bets, −0.8%. By price: 90¢+ −2.3%, 80–90¢ +2.0%, 70–80¢ +1.7%, 60–70¢ +1.7%, under 60¢ −15.6% (20 bets). Model said 86% wins, actual 79%. In testing weather is the weaker category (+8.8% vs sports +20%). |
| Lookahead in the price data? | **None found.** | At flag time, history price − live ask is the same for winners (−2.24¢) and losers (−2.12¢): the price series does not know the outcome. Near close it moves toward the outcome (6 h: +12.5¢ gap, 1 h: +23.4¢), which is information arriving, at the same clock live uses: for 0 of 593 bets did the test's clock (closedTime first) differ from the live clock. On the overlap week's markets, history prices at each horizon win about as often as they cost (sports −6 to +4 pts, weather +3.5 pts; `stale_check.py`). |
| Lookahead in the test code? | **Two mild ones, not quantifiable without `data/`.** | (a) A fold trains on markets that *resolved* before the fold starts, but a 72 h/168 h test bet was *placed* up to 7 days earlier, so training includes up to a week of outcomes after the bet. The test's 72 h/168 h bets are its best (+18%/+20%, 94–95% won at ~76¢) and live has almost none (15 rows at 72 h, 0 at 168 h). (b) The half-life is chosen by the best t-stat over the same test folds (21 d: +8.4%, 90 d: +13.9%). Both inflate the test; neither touches live. The per-bet test rows are not stored and `data/` lives only in the Actions cache, so we could not re-run. |
| Is the big negative May week a data bug? | **Not proven: left as is.** | Live-branch run: week of May 3, 19 bets in 19 events, won 13 at an average price of 87¢, −23%. P(≤13 of 19 at 87%) = 2.9%; across 42 weeks with bets one such week is expected. Production run: Apr 29 (8 bets, −35%) and May 6 (1 bet, −100%). Fold rows are not stored, so no row-level bug can be shown. |

### Also found

- **The "1 year" test is mostly two weeks.** Live-branch run: 14,615 of 16,896 test best bets (86.5%) are in the last
  two weeks (Nov 1–14); production: 26.5K of 30.5K (87%), none before Apr 22. The earlier weeks still return +12.3%
  over 2,281 bets (32 of 40 weeks up), so the result is not *only* the last two weeks, but "Testing on 1 year of past
  markets" overstates the span (lib/proof `testSpan` multiplies folds by days).
- **The model is too sure, live.** Predicted win rate 86.6% vs actual 77.4% on all settled rows; sports 88.4% vs
  75.9%. Flags the model rated highest did worst live: predicted edge 2–5¢ −1.6%, 5–10¢ −1.8%, 10–15¢ −3.6%, 15¢+
  −4.1%. In the production test the edge buckets earned +13.1¢, +14.0¢, +10.2¢, +16.9¢: higher rating did not
  consistently earn more, so `/track-record` should **not** say "Bets we rated higher did better" on that data.
- **"Needs ~39 settled bets to judge" is too optimistic.** `lib/proof.betsNeeded` scales the test's t-stat (56.3)
  as if live bets were independent; they arrive in correlated slates (179 events, one day). Not lane E's file:
  flagged for the owner.

## 3. The filter

Candidates came from the brief's hypotheses (an edge cap, one bet per event, a 60¢ price floor, weather only), but
they were **not** pre-registered: the in-sample edge-band table had been seen before the cap was picked. Held-out
split: **in-sample** = the 862 rows the published snapshot had graded (flagged Nov 17); **held-out** = the 149 rows
graded since by `grade_now.py` (settled Nov 19–20), not looked at while choosing. The held-out rows are close to
independent of the in-sample ones: 146 of 149 were flagged on Nov 19, and only 1 of their 30 events also appears
in-sample (107 sports rows, 42 weather). Month-based splits are impossible: the live ledger starts Nov 17.

| Rule | In-sample (rows) | Held-out (rows) | Both, distinct bets |
|---|---|---|---|
| As live (cap off) | 862 rows, 179 events, **−2.1%** | 149 rows, 30 events, **+9.6%** | 742 bets, **+1.3%** |
| `flag_max_edge = 0.10` (cap on) | 655 rows, **−1.7%** | 111 rows, **+12.6%** | 574 bets, **+1.9%** |
| One bet per event | 394 rows, −1.6% | 30 rows, +4.5% | — |
| Price ≥ 60¢ | 812 rows, −1.2% | 138 rows, +5.9% | — |
| Weather only | 547 rows, −0.3% | 42 rows, −9.0% | — |

- The edge cap is the only rule that improved **both** splits. Its in-sample sweep is not monotonic (4¢ −3.4%,
  8¢ −2.4%, 10¢ −0.5%, 12¢ −0.3%, none −0.7%, distinct bets), so 10¢ is chosen from the test's own bucket boundary
  and the scanner's existing "edge looks too good" warning, not from the ledger. Treat the in-sample gain as noise-sized.
- The held-out rows flip sign (+9.6% vs −2.1%) with no filter at all: 30 events decide them. **No filter fitted
  on this ledger can be trusted to close a 15-point gap**, and none does: with the cap on, live is still far below
  the test's +17%.
- In the test the cap barely matters (10–15¢ bucket earned +10.2¢, the rest +13–17¢), so turning it on is
  expected to cost little test return.

**Shipped:** `flag_max_edge` in `config/demo.json` (`null` = off, the default). When set, `engine/scan.is_best`
(the live Best-bet rule) and `engine/backtest.flag_mask` (the test) both require predicted edge < cap, so live and test
keep one rule. Tests: `engine/tests/test_max_edge.py` (off by default, cap boundary, other rules unchanged, backtest
parity, shipped config off).

## 4. The US record (§G)

`ledger_summary.us` (merged from `claude/us-venue`) is **empty on every row logged so far**: no ledger row before
the US venue shipped carries `us_ask`, so there is no US live result yet, at any price. The nearest proxy is the
sports part of the live record (Polymarket US lists only sports): 315 settled rows / 63 games at **−5.3%** at
international prices, before US's ~0.6¢ higher fee. `/track-record` therefore leads with an empty US card that says
so, then the whole record.

Two caveats for the new summary fields, both in `engine/ledger.py` (not lane E's file):
- `events` groups by `event_id`, which old rows lack, so each old market counts as its own event: `first` shows
  **739 events for 742 bets** where the real count is ~179 games and city-days. The page treats a record of 50+
  bets with ≥ 98% as many events as bets as "events not recorded" and makes no "enough to compare" call from it.
  Fix at the source: derive `event_id` for old rows (Gamma event id, or `scripts/ledger/common.event_key`).
- `intl_only` is every old row (742 of 742), not "bets US users couldn't place". The page shows the
  international-only line only once some US rows exist.

## 5. Why the test history is thin before September (§G3)

Not re-run: `data/` lives only in the Actions cache, so this is a reading of the code, not a measurement.
The bootstrap (`refresh.yml`, first run) calls `pipeline/fetch_closed.py` with its defaults, **the newest 2,000
closed events per tag, ordered by end date**. Sports and weather close hundreds of events a day, so for them that
reaches back only a few weeks; older weeks are filled only by the 730-day backfill (`mode=backfill`, up to 1,000
events per tag per 30-day window) and `fetch_prices --extend`, which tops each niche-month up to a cap. A week also
needs a validated category and horizon record before it yields best bets. Probable result: a sample dense in the
last weeks and thin before, which matches 86–87% of test bets in the last two weeks. To confirm: count
`data/sample.jsonl` rows per (category, month) in the cache, run the backfill to completion, and re-run
`python -m engine backtest`.

## 6. What would actually tell us more

1. Count the live record by distinct bet and by event (`first`, `events`; fill `event_id` for old rows).
2. Store per-bet test rows (id, horizon, price, model chance, result) for the last folds, so the overlap week can be
   compared bet for bet with the ledger.
3. Embargo the training cutoff by the horizon (train on markets resolved before `fold start − 7 days`) and re-run;
   if 72 h/168 h returns fall, (a) above was doing the work.
4. Wait for weeks, not days, of live results before judging; report them by event.
