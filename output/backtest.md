# MarketEdge backtest (Polymarket)

Markets sampled: 50,751 | snapshots: 63,913 | bets: 59,916
Train: 31,594 bets resolved before cutoff | Test: 28,322 bets after
Fees: Polymarket taker formula by category; slippage assumed 0.5c for takers

- TAKER (market orders, pay fee) / category: no groups pass on train
- TAKER (market orders, pay fee) / niche: 4 groups flagged on train (avg edge +6.85c) -> on test: avg edge +3.55c over 715 bets, 3/4 groups still positive
- TAKER (market orders, pay fee) / niche+type: 1 groups flagged on train (avg edge +5.48c) -> on test: avg edge +1.58c over 92 bets, 1/1 groups still positive
- MAKER (limit orders, no fee) / category: 4 groups flagged on train (avg edge +3.90c) -> on test: avg edge +6.63c over 1,865 bets, 4/4 groups still positive
- MAKER (limit orders, no fee) / niche: 5 groups flagged on train (avg edge +7.88c) -> on test: avg edge +4.84c over 984 bets, 4/5 groups still positive
- MAKER (limit orders, no fee) / niche+type: 1 groups flagged on train (avg edge +7.23c) -> on test: avg edge +3.33c over 92 bets, 1/1 groups still positive

## Calibration, all markets, 24h before resolution (test set)
| price band | bets | win rate | avg price | edge (taker) |
|---|---|---|---|---|
| 0.05-0.10 | 421 | 0.059 | 0.072 | -2.02c |
| 0.10-0.15 | 344 | 0.102 | 0.125 | -3.29c |
| 0.15-0.20 | 235 | 0.170 | 0.176 | -1.71c |
| 0.20-0.25 | 313 | 0.176 | 0.226 | -6.29c |
| 0.25-0.30 | 340 | 0.197 | 0.274 | -9.11c |
| 0.30-0.35 | 450 | 0.207 | 0.332 | -14.06c |
| 0.35-0.40 | 307 | 0.339 | 0.376 | -5.35c |
| 0.40-0.45 | 369 | 0.396 | 0.426 | -4.73c |
| 0.45-0.50 | 635 | 0.359 | 0.478 | -13.63c |
| 0.50-0.55 | 1,135 | 0.576 | 0.511 | +4.82c |
| 0.55-0.60 | 397 | 0.605 | 0.572 | +1.58c |
| 0.60-0.65 | 307 | 0.661 | 0.624 | +2.13c |
| 0.65-0.70 | 463 | 0.786 | 0.669 | +10.14c |
| 0.70-0.75 | 283 | 0.799 | 0.724 | +6.05c |
| 0.75-0.80 | 337 | 0.834 | 0.770 | +5.07c |
| 0.80-0.85 | 250 | 0.828 | 0.822 | -0.55c |
| 0.85-0.90 | 333 | 0.895 | 0.874 | +1.11c |
| 0.90-0.95 | 404 | 0.943 | 0.925 | +0.95c |

## Top groups by train taker edge (t >= 2), with test result
| scope | key | type | hrs | band | train n | train edge | test n | test edge |
|---|---|---|---|---|---|---|---|---|
| niche | nfl | all | 24 | 0.50-0.55 | 424 | +7.19c | 231 | +2.36c |
| niche | nfl | all | 72 | 0.50-0.55 | 229 | +7.14c | 233 | +6.74c |
| niche | nhl | all | 24 | 0.55-0.60 | 258 | +6.38c | 41 | -2.88c |
| niche | nfl | all | 6 | 0.50-0.55 | 154 | +6.30c | 210 | +2.59c |
| niche+type | nfl | props | 24 | 0.50-0.55 | 201 | +5.48c | 92 | +1.58c |
| all | all | all | 72 | 0.60-0.65 | 347 | +5.31c | 163 | +6.39c |
| all | all | all | 72 | 0.70-0.75 | 375 | +5.18c | 143 | -1.41c |
| all | all | all | 24 | 0.50-0.55 | 1,486 | +2.92c | 1,135 | +4.82c |
