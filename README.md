# MarketEdge

Flags prediction-market contracts whose **historical win rate beats their price after fees**.
Two contracts can both pay ~2x; one sits in a group that has historically won 59% of the time
at that price, the other 48%. MarketEdge finds the first kind.

Polymarket only for now: its data is public and needs no key.
Kalshi comes later, once Kalshi gives written permission to use its data.

## How it works

```
fetch_closed.py  ->  data/markets.jsonl     resolved binary markets, sampled by category tag
fetch_prices.py  ->  data/snapshots.jsonl   price 1h / 6h / 24h / 72h / 7d before resolution
build_table.py   ->  output/edges.json      win-rate table + output/backtest.md (go/no-go)
scan_live.py     ->  output/live_flags.json open markets scored against the table
```

```bash
pip install -r requirements.txt
python pipeline/fetch_closed.py      # ~5 min
python pipeline/fetch_prices.py      # ~10 min, resumable
python pipeline/build_table.py       # seconds
python pipeline/scan_live.py         # ~20 s, run every few minutes in production
```

`data/` is git-ignored (large, rebuildable). `output/` is committed so the UI can use it right away.

### Method (the parts that matter)

- **Bets:** each snapshot becomes two bets: side A at price `p`, side B at `1 - p`.
- **Groups:** bets are grouped by scope (all / category / niche / niche + market type),
  hours before resolution, and 5¢ price band (by mid price).
- **Edge (taker)** = win rate − avg price − Polymarket taker fee − 0.5¢ slippage.
  Fee = `rate × p × (1 − p)`, with the rate set per category ([docs](https://docs.polymarket.com/trading/fees.md)).
  **Edge (maker)** = win rate − avg price (limit orders pay no fee, but may not fill).
- **No look-ahead:** a snapshot only uses a price observed at or before (resolution − N hours),
  and the market must have traded at least 3 distinct prices by then.
- **No outcome-biased sampling:** events are sampled by end date, not volume. Final volume
  leaks the outcome (upsets attract trading); the first run fell into this and is discarded.
- **Held-out test:** groups are learned on the oldest 70% of markets and checked on the newest 30%.
  Markets resolved in the last 7 days are excluded (they looked anomalous).
- **Standard errors are clustered by event,** because markets from one game move together.

## Result of the first run (Nov 16, 2026)

~50,000 sampled markets, ~60,000 bets after filters. See `output/backtest.md`.

- The classic **favorite–longshot bias** shows up: contracts under 25¢ win less often than
  their price; slight favorites (50–80¢) win more often. It showed up in most time slices checked, not all.
- Groups that looked profitable on the old 70% **mostly stayed profitable on the newest 30%**
  (taker: 3 of 4 niche groups; avg +3.6¢ per $1 share on held-out data).
- Strongest: **NFL, slight favorites (50–55¢), 1–3 days before kickoff**,
  +7.1¢ on the older data and +6.7¢ on the held-out data (taker, after fees).
- **Caveats:** the held-out samples are small (hundreds of bets, dozens of events). Historical
  prices are mid/last-trade, so real asks in thin markets cost more than the 0.5¢ assumed.
  Treat this as "worth building and forward-testing," not as proof.

## Data contract for the UI

### `output/live_flags.json`
```jsonc
{
  "scanned_at": 1794868320,          // unix seconds
  "markets_scanned": 11558,
  "flags": [{                         // sorted by edge, highest first
    "id": "6639700",                  // Polymarket market id
    "question": "Colts vs. Texans: O/U 44.5",
    "event": "Colts vs. Texans",      // group rows by this: one game spawns many flags
    "slug": "nfl-ind-hou-2026-11-20",
    "url": "https://polymarket.com/event/nfl-ind-hou-2026-11-20",
    "category": "sports",             // sports | crypto | politics | finance | culture | weather | tech | geopolitics | other
    "niche": "nfl",                   // nfl, nba, cfb, tennis, bitcoin, weather, ...
    "market_type": "totals",          // moneyline | spreads | totals | props | yes/no | multi-outcome
    "hours_to_close": 75.7,
    "volume": 225.0, "liquidity": 40249.1,
    "side": "Under",                  // the outcome to buy
    "price": 0.52,                    // current ask for that side
    "mid": 0.51,
    "fee": 0.0125,                    // taker fee per share at that price
    "edge": 0.0627,                   // expected profit per $1 share after fee (6.3 cents)
    "group_win_rate": 0.5952,         // how often this group won historically
    "group_scope": "niche", "group_key": "nfl",
    "group_n": 462, "group_events": 192,   // sample size behind the number
    "group_t": 4.16,                  // statistical confidence (>= 2 required to flag)
    "group_held_out_edge": 0.0674,    // edge this group made on held-out data
    "horizon_h": 72
  }]
}
```

### `output/edges.json`
The full win-rate table (`groups[]`) for charts and the "why is this flagged" panel.
Key fields: `scope, key, market_type, horizon_h, band_lo, band_hi, n, events, win_rate,
avg_price, edge_taker, edge_maker, t_taker, held_out_edge_taker`.

### UI requirements (from the scoping doc)
- Filters: platform, category, niche, market type, price range, min edge, hours to close,
  liquidity, min sample size. Sort by edge, win rate, sample size, closing time.
- Saved presets and saved dashboards; "Favorite topics" setting (topic-level only).
- Group flags by `event`; show a small-sample warning when `group_events < 50`.
- Show the same data to everyone. Never generate picks from a user's own positions.
- Disclaimer on every page: not financial advice, based on past results, 18+.
