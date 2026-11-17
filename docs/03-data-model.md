# 03 · Data model

Three layers: **engine output** (read-only JSON), **topic taxonomy** (how markets are grouped
and filtered), **user data** (Supabase tables).

## 1. Engine output → `apps/web/lib/types.ts`

```ts
// output/markets.json
export interface MarketsFile { meta: ScanMeta; markets: Market[] }
// output/flags.json  (flags = Market + execution + best.realistic_edge)
export interface FlagsFile { meta: ScanMeta; flags: Flag[] }

export interface ScanMeta {
  instance: string;               // "demo"
  platform: "polymarket" | "kalshi";
  scanned_at: number;             // unix seconds
  model_half_life_days: number | null;   // null = no decay
  markets_scanned: number;
  flags: number;
  verdicts?: Record<Verdict, number>;
  rule: { min_edge: number; confidence_z: number; price_range: [number, number] };
}

export type Category = "sports" | "crypto" | "politics" | "finance" | "culture"
                     | "weather" | "tech" | "geopolitics" | "other";
export type MarketType = "moneyline" | "spreads" | "totals" | "props" | "yes/no" | "multi-outcome";
export type ModelLevel = "all" | "cat" | "niche" | "nmt";   // nmt = niche + market type

export interface Side {
  side_index: 0 | 1;
  outcome: string;          // "Yes", "No", "Lakers", "Over", ...
  ask: number;              // what a market buy pays now (0-1)
  mid: number;              // (bid+ask)/2 for this side
  fee: number;              // Polymarket taker fee per share at the ask
  win_prob: number;         // model estimate of the true win chance
  win_prob_low: number;     // pessimistic estimate (80% one-sided)
  edge: number;             // win_prob - ask - fee   (per $1 payout share)
  edge_low: number;         // win_prob_low - ask - fee
  roi_pct: number;          // edge / (ask + fee) * 100
  model_level: ModelLevel;
  model_neff: number;       // effective independent sample behind the estimate
  model_events: number;     // distinct past events behind the estimate
  realistic_edge?: number | null;   // flags only: what similar predicted edges actually earned
}

export interface Market {
  id: string;               // Polymarket market id
  question: string;
  event: string; event_id: string; slug: string; url: string; image?: string | null;
  tokens: [string, string]; // CLOB token ids, index = side_index
  category: Category;
  niche: string;            // nfl | nba | cfb | soccer | tennis | esports | nhl | weather | bitcoin | ...
  market_type: MarketType;
  tags: string[];           // raw Polymarket tag slugs (used for sub-niche filters, see §2)
  hours_to_close: number; closes_at: number; horizon_h: 1 | 6 | 24 | 72 | 168;
  volume: number; liquidity: number; spread: number;
  volume_24h: number | null;  // Gamma `volume24hr` (USD traded in the last 24 h); null if Gamma omits it
  created_at: number | null;  // Gamma `createdAt` as unix seconds; null if missing/unparseable
  competitive: number;        // abs(mid - 0.5) of the market mid; identical for both sides (side 1 mid = 1 - side 0 mid). 0 = coin flip
  validated: boolean;       // category AND horizon made money in the walk-forward test
  backtest: { flags: number; pnl_cents: number; t: number } | null;   // category record
  sides: Side[];
  best: Side;               // the side with the higher edge
  // T-02 (engine) adds these; absent today. Filters treat missing as "no value", never invent one.
  volume_24h?: number; created_at?: number; competitive?: number; ask_size?: number; bid_size?: number;
}

export type Verdict = "worth it" | "thin" | "not worth it" | "no sellers" | "no book";
export interface StakeRow { stake_usd: number; filled_usd: number; shares: number;
  avg_price: number; edge: number; expected_profit_usd: number; roi_pct: number }
export interface Execution {
  book_ok: boolean; best_bid: number | null; best_ask: number; book_mid: number;
  spread: number; spread_cost: number; fee_at_ask: number;
  gross_edge: number;       // win_prob - mid
  net_edge: number;         // win_prob - ask - fee
  retention: number;        // net_edge / gross_edge
  capacity_usd: number;     // $ you can buy before edge < min_edge
  stakes: StakeRow[];       // $25, $100, $500, $1000
  limit_price: number; limit_edge: number;
  verdict: Verdict; warning?: string;
  ask_size?: number | null; // shares at the best ask of the best side's book (scan only, not part of check())
  bid_size?: number | null; // shares at the best bid; null when that side of the book is empty or no book
}
export interface Flag extends Market { execution: Execution; tier?: "best" | "edge" }  // docs/18 §2; missing = "best"
```

```ts
// output/events.json  (written by scan; slug = Polymarket event URL slug)
// market_ids: every scored market of the event (same ids as markets.json); flag_ids ⊆ market_ids
export type EventsFile = Record<string, { event_id: string; event: string; market_ids: string[]; flag_ids: string[] }>;
```

```ts
// output/ledger.jsonl  (F-29; one JSON object per line; scan appends, `python -m engine grade` fills results)
// A row is added the first time a market/side is flagged, and again when re-flagged at a lower ask.
export interface LedgerEntry {
  id: string; side_index: 0 | 1; outcome: string; question: string;
  category: Category; niche: string;
  ask: number; fee: number; win_prob: number; edge: number;   // best side at flag time
  verdict: Verdict; flagged_at: number;                       // unix seconds
  closes_at: number; token: string | null;                    // side's CLOB token (for closing price)
  // set by the grader once the market resolved; absent = still open
  result?: "won" | "lost"; pnl?: number;                      // (won ? 1 : 0) - ask - fee, per $1 share
  closing_price?: number | null;  // last CLOB price of this side at or before close - 1 h,
                                  // close = min(closedTime, endDate, gameStartTime); null if no history
  clv?: number | null;            // closing_price - ask
  graded_at?: number;
}
// output/ledger_summary.json  (written by the grader)
export interface LedgerStats { entries: number; graded: number; wins: number; losses: number;
  avg_pnl: number | null; avg_clv: number | null }
export interface LedgerSummary extends LedgerStats { by_category: Record<string, LedgerStats>; updated_at: number }
```

`model.json` (curves for charts): `nodes[]` with `level, horizon_h, key, market_type, n, neff, events,
win_prob_at_price: {"0.05": 0.03, ..., "0.95": 0.97}`.
`backtest.json`: `results[half_life]` with `taker, maker, taker_tight_spread, baseline_all_bets_taker,
by_category, by_horizon, edge_buckets, folds[]` and `chosen_half_life_days`.
Added by docs/18: `results[hl].by_pays[tier][band]` (tier `best|edge`; band `<1.5x, 1.5-2x, 2-3x, 3-5x, 5-10x, 10x+`;
fields `flags, win_rate, predicted_win_rate, roi_pct, t_stat`), and top-level `combos["2"|"3"]` =
`{combos, win_rate, predicted_win_rate, avg_pays, roi_pct, t_stat}` (random cross-event combos of tier-"best" bets
that closed the same day).

A zod schema mirrors these types; the data layer validates `meta` and a 1% sample of rows on load
and logs (does not crash) on mismatch.

## 2. Topic taxonomy (filters, favorite topics, presets)

Built from Kalshi's category tree (`GET /search/tags_by_categories`) and Polymarket's tags, so a
user sees the same structure whichever venue a market comes from. Three levels:
**Category → Topic → Sub-topic**. Engine fields map as shown; sub-topics come from `tags`.

| Category | Topic (`niche` or tag) | Sub-topics (tags) |
|---|---|---|
| Sports | Football: `nfl`, `cfb` | moneyline / spreads / totals / props; 1H, 1Q, team totals (from question text) |
| | Basketball: `nba` (+ `ncaab` later) | same as above |
| | Soccer: `soccer` | `premier-league`/`EPL`, `la-liga`, `bundesliga`, `ligue-1`, `ucl`, `uefa-nations-league`, `fifa-friendly`, `efl-championship`, `ere`, `concacaf-nations-league`, `la-liga-2`, `bundesliga-2` |
| | Hockey: `nhl` · Baseball: `mlb` · Tennis: `tennis` | ATP/WTA (from tags) |
| | Esports: `esports` | `counter-strike-2`, `dota-2`, `league-of-legends`, `valorant` |
| | Combat / Golf / Motorsport / Cricket | from tags `ufc`, `boxing`, `golf`, `f1`, `cricket` |
| Crypto | `bitcoin`, `ethereum`, `solana`, `xrp`, other | window: `15M`, hourly, `daily`, `weekly`; type: `up-or-down`, `hit-price`, `multi-strikes` |
| Weather & Climate | `weather` | `highest-temperature`, `lowest-temperature`, city (parsed from question), rain/snow, hurricanes |
| Finance & Economics | `finance` | `stocks`/`equities`, `stock-prices`, `earnings-calls`, `commodities` (`gold`, `silver`, `oil`), `fed`, inflation, jobs, `daily-close`, `finance-updown` |
| Politics & Elections | `politics`, `elections` | US, international, Congress, courts, Trump admin |
| World | `geopolitics`, `world` | regions |
| Culture | `culture` (pop-culture) | `awards`, `music`, `movies`, `celebrities`, `tweets-markets`, `top-netflix`, `art-auction` |
| Tech & Science | `tech` | `ai`, `ai-releases`, `big-tech`, company tags (`openai`, `anthropic`, `google`, `nvda`) |
| Mentions | `mention-markets` | earnings calls, speeches |

Implementation: `lib/taxonomy.ts` exports the tree as data:
```ts
type Node = { id: string; label: string; match: (m: Market) => boolean; children?: Node[] }
// e.g. { id: "soccer.epl", label: "Premier League",
//        match: m => m.niche === "soccer" && hasAny(m.tags, ["premier-league","EPL"]) }
```
Facet counts are computed per scan on the server (`/api/meta`). Unknown tags fall into "Other".
Derived attributes parsed once at load (`lib/data/derive.ts`):
- `period`: full game | 1H | 2H | 1Q.. (regex on question: `/\b(1H|2H|1Q|2Q|3Q|4Q|1st Half)\b/`)
- `city`, `temp_kind` for weather (`/temperature in ([A-Za-z .]+) be/`, high/low from tag)
- `crypto_window` from tags (`15M`, `hourly`, `daily`, `weekly`)
- `is_live`: hours_to_close <= 0 (sports in progress, if they appear)
- `recurring`: tag `recurring`

The engine's `classify()` (`pipeline/common.py`) maps tags to `category`/`niche`. T-03 added the niches
`ncaab, ufc, boxing, golf, f1, cricket, xrp, economy` (`mlb`, `fed` already existed). Live tag slugs are
normalized first via `TAG_ALIASES`: `cbb`/`ncaa-basketball`/`college-basketball` → `ncaab`,
`mma` → `ufc`, `formula1` → `f1`. `dataset.load` re-classifies history from stored tags, so a refit
picks up new niches; until then the scanner scores a new niche with its category node (`model_level: "cat"`).

## 3. User data (Supabase Postgres, RLS: `user_id = auth.uid()` on every table)

```sql
create table profiles (
  user_id uuid primary key references auth.users on delete cascade,
  display_name text, timezone text default 'America/New_York',
  bankroll_usd numeric,                 -- for Kelly sizing; user-entered, optional
  kelly_fraction numeric default 0.25,  -- quarter Kelly default
  default_stake_usd numeric default 100,
  odds_format text default 'cents' check (odds_format in ('cents','percent','decimal','american')),
  favorite_topics text[] default '{}',  -- taxonomy ids, e.g. {'sports.nfl','weather'}
  density text default 'comfortable', theme text default 'dark', numbers_mode text default 'simple',  -- display prefs (F-17)
  accepted_terms_at timestamptz,        -- 18+ and Terms checkbox at sign-up
  onboarded_at timestamptz, created_at timestamptz default now()
);

create table subscriptions (
  user_id uuid primary key references auth.users on delete cascade,
  stripe_customer_id text unique, stripe_subscription_id text,
  tier text not null default 'free' check (tier in ('free','pro','premium')),
  status text,                          -- trialing | active | past_due | canceled
  current_period_end timestamptz, cancel_at_period_end boolean default false,
  trialed_at timestamptz,               -- first trial start; checkout offers the 7-day trial only while null
  updated_at timestamptz default now()
);
-- Written only by the Stripe webhook (service role). Users can read their own row, never write it.

create table stripe_events (id text primary key, type text not null, processed_at timestamptz default now());
                                        -- webhook idempotency, RLS on with no policies

create table drawer_reveals (           -- free tier: market details opened per day (LIMITS.flagsPerDay)
  user_id uuid references auth.users on delete cascade, day date default current_date, market_id text,
  primary key (user_id, day, market_id)
);

create table presets (                  -- a saved filter + sort + columns
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null, emoji text,
  query jsonb not null,                 -- FilterState (04-filters.md), versioned: {"v":1,...}
  columns text[], sort jsonb,
  is_default boolean default false, position int default 0,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table dashboards (               -- a layout of panels, each panel = a preset or a widget
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null, layout jsonb not null,   -- [{panel_id, kind, preset_id|query, x,y,w,h}]
  position int default 0, created_at timestamptz default now()
);

create table watchlist (                -- saved bets / markets to watch
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  market_id text not null, side_index smallint,          -- null = whole market
  note text, target_price numeric,                       -- alert when ask <= target
  snapshot jsonb,                                        -- Market row at save time (question, ask, win_prob, edge)
  created_at timestamptz default now(),
  unique nulls not distinct (user_id, market_id, side_index)   -- one whole-market row per market
);

create table alert_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null, enabled boolean default true,
  kind text not null check (kind in ('preset_match','market_price','edge_change','closing_soon')),
  query jsonb,                          -- for preset_match: FilterState
  market_id text, side_index smallint, threshold numeric,
  channels text[] default '{email}',    -- email | push | telegram | discord
  webhook_url text,                     -- Premium: Discord/Telegram
  cooldown_minutes int default 60, quiet_hours smallint[],   -- [start_hour, end_hour), may wrap midnight
  last_fired_at timestamptz, created_at timestamptz default now()
);

create table alert_events (             -- what fired, for the in-app inbox + dedupe
  id bigserial primary key, rule_id uuid references alert_rules on delete cascade,
  user_id uuid not null references auth.users on delete cascade, market_id text not null, side_index smallint,
  payload jsonb, sent_channels text[], fired_at timestamptz default now(), read_at timestamptz,
  dedupe_key text not null,             -- app sets: rule_id|market_id|side|cooldown bucket
  unique (dedupe_key)
);

create table journal (                  -- bets the user says they placed (manual entry)
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  market_id text not null, side_index smallint not null, outcome text,
  question text, category text, niche text,
  price numeric not null, shares numeric not null, fee numeric default 0,
  placed_at timestamptz not null default now(),
  model_win_prob numeric, model_edge numeric,          -- MarketEdge numbers at entry
  closing_price numeric,                               -- filled after the market closes (CLV)
  result text check (result in ('won','lost','void')), settled_at timestamptz,
  pnl_usd numeric, tags text[], note text
);

create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  endpoint text unique not null, keys jsonb not null, created_at timestamptz default now()
);
```
Migration: `supabase/migrations/`. Every user table's `user_id` defaults to `auth.uid()`. A trigger on
`auth.users` creates `profiles` + `subscriptions(tier='free')`; a trigger on `auth.sessions` keeps the 3 newest
sessions per user (docs/14 §1). RLS tests: `apps/web/test/rls.test.ts` (PGlite) and `supabase/tests/rls.test.sql` (pgTAP).

Demo mode (no auth): presets, watchlist, favorites and journal live in `localStorage` behind
the same repository interface (`lib/repo/*.ts`: `LocalRepo` and `SupabaseRepo`). At first login
the app offers to import local data into the account.
