# Lane: data (builder, Sonnet)
Read `_common.md` first. Features: **F3**, **F4**, **F14** in `SPEC.md`.

**You own:** `engine/`, `pipeline/`, `apps/web/lib/data/`, `apps/web/app/api/markets/`, `apps/web/app/api/meta/`,
`docs/03-data-model.md`. **Don't touch:** checker, journal, billing, onboarding, alerts files; `BetCard`/`BestBets`
without asking the lead.

**Build on:**
- `pipeline/fetch_kalshi.py` already crawls Kalshi into `output/kalshi.json` (`engine/__main__.py` `kalshi` command).
  `apps/web/lib/data/store.ts` loads the stores (gzip, 120 s cache; see `test/store-gzip.test.ts`) and
  `app/api/kalshi/route.ts` serves Kalshi today. F3 merges Kalshi rows into the same searchable store.
- Topic ids come from `apps/web/lib/taxonomy.ts` (`category()`/`topic()` match on `m.category`, `m.niche`, `m.tags`).
  Map each Kalshi series to those ids in the engine (a table in `engine/`, tested), so the web side needs no new matcher.
- Filtering and paging: `apps/web/lib/filters/apply.ts`, `lib/data/respond.ts`, `lib/data/counts.ts`. The browser
  never gets `markets.json` whole.
- Polymarket US prices: `pipeline/venue_us.py`, `engine/us_native.py`, `venue?: "us"` in `lib/types.ts`. F4 adds a
  `venues` array; update `lib/types.ts` and `docs/03-data-model.md` together (shared file: ask the lead first).
- F14 price history: `pipeline/fetch_prices.py` has price fetching; store downsampled ≤ 200 points, ≤ 90 days.
  The drawer chart uses Recharts like `components/market/CurveChart.tsx`.

**Order:** F3 first (it blocks launch), then F4, then F14.

**Tests:** `python3 -m pytest -q engine/tests`, `pnpm test`, and e2e `launch-f03-search`, `launch-f04-venues`,
`launch-f14-history`. Fixture data lives in `apps/web/test/fixtures` (add ≥ 20 Kalshi rows there for F3).
Put the store's memory use and `/api/markets` p95 numbers in the F3 PR.
