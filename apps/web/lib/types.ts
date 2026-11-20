// Engine output types. Single source of truth: must match docs/03-data-model.md §1.
// Zod mirrors live in lib/schemas.ts (validation only).

// output/markets.json
export interface MarketsFile { meta: ScanMeta; markets: Market[] }
// output/flags.json  (flags = Market + execution + best.realistic_edge)
export interface FlagsFile { meta: ScanMeta; flags: Flag[] }

export interface ScanMeta {
  instance: string;               // "kismet" (config/demo.json; display name on /status is fixed: "Kismet engine")
  platform: "polymarket" | "kalshi";
  scanned_at: number;             // unix seconds
  model_half_life_days: number | null;   // null = no decay
  markets_scanned: number;
  flags: number;
  verdicts?: Record<Verdict, number>;
  tiers?: { best: number; edge: number };   // docs/18 §2: flag count per tier (flags = best + edge)
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
  ranges?: SideRanges;      // API only, Free tier: exact numbers replaced by bands (lib/data/gate.ts)
}
/** Free tier bands [low, high]; null = open end. The numeric fields then hold the band's low end. */
export interface SideRanges { roi_pct: [number | null, number | null]; edge: [number | null, number | null] }

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
  validated: boolean;       // category AND horizon made money in the walk-forward test
  backtest: { flags: number; pnl_cents: number; t: number } | null;   // category record
  sides: Side[];
  best: Side;               // the side with the higher edge
  // T-02. Null when Gamma omits it (volume_24h is null for most markets). Filters treat null as "no value".
  volume_24h?: number | null;   // Gamma volume24hr
  created_at?: number | null;   // Gamma createdAt, unix seconds
  competitive?: number;         // abs(mid - 0.5) of the market mid
  // docs/16 §3 market matching (engine job kalshi_match, not built yet). Set only when confidence >= 0.9.
  kalshi_ticker?: string | null;
  kalshi_match_conf?: number;
}

export type Verdict = "worth it" | "thin" | "not worth it" | "no sellers" | "no book";
export interface StakeRow { stake_usd: number; filled_usd: number; shares: number;
  avg_price: number; edge: number; expected_profit_usd: number; roi_pct: number }
export interface Execution {
  book_ok: boolean; best_bid: number | null; best_ask: number; book_mid: number;
  spread: number; spread_cost: number; fee_at_ask: number;
  gross_edge: number;       // win_prob - mid
  net_edge: number;         // win_prob - ask - fee
  // T-44: retention, capacity_usd, limit_price, limit_edge are absent and stakes is [] on the Free tier (API only;
  // the engine always writes them).
  retention?: number;       // net_edge / gross_edge
  capacity_usd?: number;    // $ you can buy before edge < min_edge
  stakes: StakeRow[];       // $25, $100, $500, $1000
  limit_price?: number; limit_edge?: number;
  verdict: Verdict; warning?: string;
  ask_size?: number | null;   // T-02: shares at best ask of the best side's book
  bid_size?: number | null;   // shares at best bid
}
// docs/18 §2: "best" = Best bets rule; "edge" = More bets with an edge (lower confidence). Missing = "best".
export type FlagTier = "best" | "edge";
export interface Flag extends Market { execution: Execution; tier?: FlagTier }

// output/model.json (curves for charts). Node `level` uses the engine's long names.
export type ModelNodeLevel = "all" | "category" | "niche" | "niche+type";
export interface ModelNode {
  level: ModelNodeLevel; horizon_h: number; key: string; market_type: string;   // "all" unless niche+type
  n: number; neff: number; events: number;
  win_prob_at_price: Record<string, number>;   // {"0.05": 0.03, ..., "0.95": 0.97}
  theta?: number[]; cov?: number[][];          // fit: win chance at any price (lib/reprice.ts predictAt, server only)
}
export interface ModelFile { half_life_days: number | null; fitted_at: number; nodes: ModelNode[]; knots?: number[]; [k: string]: unknown }

// output/backtest.json. `results` is keyed by half-life as a string ("21", ..., "None").
export interface BacktestRecord {
  flags: number; events?: number; win_rate?: number; avg_price?: number;
  pnl_cents_per_share?: number; roi_pct?: number; t_stat?: number;
}
export interface BacktestResult {
  taker: BacktestRecord; maker: BacktestRecord; taker_tight_spread: BacktestRecord;
  baseline_all_bets_taker: BacktestRecord;
  by_category: Record<string, BacktestRecord>; by_horizon: Record<string, BacktestRecord>;
  edge_buckets: unknown; folds: unknown[];
  // docs/18 §1: payout bands "<1.5x" | "1.5-2x" | "2-3x" | "3-5x" | "5-10x" | "10x+", per tier.
  by_pays?: Partial<Record<FlagTier, Record<PaysBand, PaysBandRecord>>>;
  [k: string]: unknown;
}
export type PaysBand = "<1.5x" | "1.5-2x" | "2-3x" | "3-5x" | "5-10x" | "10x+";
export interface PaysBandRecord extends BacktestRecord { predicted_win_rate?: number }
// docs/18 §5.4: combo backtest, keyed by leg count ("2", "3").
export interface ComboBacktestRecord {
  combos: number; win_rate?: number; predicted_win_rate?: number; avg_pays?: number;
  roi_pct?: number; t_stat?: number;
}
export interface BacktestFile {
  chosen_half_life_days: number | null; results: Record<string, BacktestResult>;
  combos?: Record<string, ComboBacktestRecord>;
  [k: string]: unknown;
}

// Derived at load (lib/data/derive.ts, docs/03 §2).
export type Period = "full" | "1H" | "2H" | "1Q" | "2Q" | "3Q" | "4Q";
export type Frequency = "recurring" | "15M" | "hourly" | "daily" | "weekly";
export interface Derived {
  period: Period;
  city: string | null;                      // weather only
  temp_kind: "high" | "low" | null;         // weather only
  crypto_window: "15M" | "hourly" | "daily" | "weekly" | null;
  frequency: Frequency[];
  is_live: boolean;                         // hours_to_close <= 0
  recurring: boolean;
}
export type StoreMarket = Market & { derived: Derived; execution?: Execution; tier?: FlagTier };   // tier: flags only

// output/events.json (T-05): event slug -> markets, used by the extension lookup
export type EventsFile = Record<string, { event_id: string; event: string; market_ids: string[]; flag_ids: string[] }>;

// output/ledger.jsonl + ledger_summary.json (T-04, F-29): live forward record of every flag
export interface LedgerEntry {
  id: string; side_index: 0 | 1; outcome: string; question: string;
  category: Category; niche: string;
  ask: number; fee: number; win_prob: number; edge: number;
  verdict: Verdict; flagged_at: number;
  closes_at: number; token: string | null;
  result?: "won" | "lost"; pnl?: number;
  closing_price?: number | null; clv?: number | null;
  graded_at?: number;
}
export interface LedgerStats { entries: number; graded: number; wins: number; losses: number;
  avg_pnl: number | null; avg_clv: number | null }
export interface LedgerSummary extends LedgerStats { by_category: Record<string, LedgerStats>; updated_at: number }

// output/kalshi.json (optional; KALSHI_DATA_PERMISSION=true only; docs/03 § kalshi.json). Kalshi's data: credit it.
export interface KalshiMarket {
  ticker: string; event_ticker: string; series_ticker: string;
  title: string; subtitle: string;
  yes_bid_cents: number | null; yes_ask_cents: number | null;
  volume: number;
  close_time: string | null;
  url: string;
  source: "Kalshi";
}
export interface KalshiComboLeg {
  market_ticker: string; event_ticker: string; side: "yes" | "no"; title: string;
  ask_cents: number | null;
  url: string;
}
export interface KalshiCombo {
  ticker: string; event_ticker: string; collection_ticker: string; title: string;
  legs: KalshiComboLeg[];
  same_event: boolean;
  kalshi_yes_bid_cents: number | null; kalshi_yes_ask_cents: number | null;
  legs_product_cents: number | null;
  price_basis: "kalshi_quote" | "legs_product";
  volume: number; close_time: string | null; url: string; source: "Kalshi";
}
export interface KalshiFile {
  meta: { source: "Kalshi"; attribution: string; fetched_at: number; api: string; n_markets: number; n_combos: number };
  markets: KalshiMarket[];
  combos: KalshiCombo[];
}
