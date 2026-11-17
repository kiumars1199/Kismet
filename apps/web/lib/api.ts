// Typed client for the web API. Browser code imports these; server components should call
// getStore()/apply() directly instead of fetching their own API.
//
// Routes (all GET, JSON; errors are { error } with 404 / 503):
//   /api/meta                      → MetaResponse   scan meta, counts, unfiltered facet counts
//   /api/markets?<FilterState>     → MarketsResponse filtered + sorted page (≤ 200 rows). Query keys are the
//                                    short keys of lib/filters/url.ts; unknown keys are ignored and invalid
//                                    values fall back to the default (never a 400).
//                                    Grouped (default): page_size = event groups per page (max 50); each
//                                    group is cut to GROUP_ROWS (4) rows, `size` is its full count (expand
//                                    with /api/events/[id]). `rows` are the page's groups
//                                    flattened in order; `groups[i]` covers rows[start .. start+count) and
//                                    rows[start] is its best row.
//   /api/flags?<FilterState>       → MarketsResponse same as /api/markets with view=flags forced
//   /api/markets/[id]              → MarketResponse  market + its model curve + category backtest record +
//                                    the other markets in its event
//   /api/events/[id]               → EventResponse   all markets of one event (by event_id)
//   /api/events/by-slug/[slug]     → EventResponse   same, by Polymarket event slug; CORS * (Chrome extension)
//   /api/model/curve?segment=&h=   → Curve           segment = "all" | "cat:<category>" | "<niche>" | "<niche>:<market_type>"
//                                                    (MarketResponse.segment gives a market's own), h = horizon hours
//   /api/backtest                  → BacktestResponse backtest.json as is + `chosen` (result for the chosen half-life)
import type { Curve } from "@/lib/data/model";
import type { Counts, Facets, Group } from "@/lib/filters/apply";
import type { FilterInput } from "@/lib/filters/state";
import { FilterState } from "@/lib/filters/state";
import { serialize } from "@/lib/filters/url";
import type { BacktestFile, BacktestRecord, BacktestResult, ScanMeta, Side, StoreMarket } from "@/lib/types";

export type { Curve, Facets, StoreMarket, Side };

export interface MetaResponse {
  meta: ScanMeta;
  loaded_at: number;                       // ms, when this server instance loaded the data
  counts: { markets: number; flags: number; events: number };
  facets: { categories: Counts; niches: Counts; market_types: Counts; periods: Counts; frequency: Counts; topics: Counts };
}

export interface ApiRow { market: StoreMarket; side: Side }   // side = the side chosen by FilterState.side
export type ApiGroup = Omit<Group, "rows" | "best"> & { start: number; count: number };
export interface MarketsResponse {
  total: number;                           // matching rows
  total_groups?: number;                   // when grouped
  page: number; page_size: number; pages: number;
  rows: ApiRow[];
  groups?: ApiGroup[];
  facets: Facets;                          // counts for the current filter minus that facet
}

export interface MarketResponse {
  market: StoreMarket;
  segment: string;                         // model segment of the best side (for /api/model/curve)
  curve: Curve | null;                     // that segment at the market's horizon
  backtest: BacktestRecord | null;         // walk-forward record for the market's category
  event_markets: StoreMarket[];            // other markets in the same event
}

export interface EventResponse {
  event_id: string; event: string; slug: string;
  markets: StoreMarket[];                  // sorted by best expected return
  flags: StoreMarket[];                    // flagged markets in the event (with execution)
}

export type BacktestResponse = BacktestFile & { chosen: BacktestResult | null };

async function get<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

const qs = (state: FilterInput) => {
  const s = serialize(FilterState.parse(state)).toString();
  return s ? `?${s}` : "";
};

export const fetchMeta = (init?: RequestInit) => get<MetaResponse>("/api/meta", init);
export const fetchMarkets = (state: FilterInput = {}, init?: RequestInit) => get<MarketsResponse>(`/api/markets${qs(state)}`, init);
export const fetchFlags = (state: FilterInput = {}, init?: RequestInit) => get<MarketsResponse>(`/api/flags${qs(state)}`, init);
export const fetchMarket = (id: string, init?: RequestInit) => get<MarketResponse>(`/api/markets/${encodeURIComponent(id)}`, init);
export const fetchEvent = (id: string, init?: RequestInit) => get<EventResponse>(`/api/events/${encodeURIComponent(id)}`, init);
export const fetchEventBySlug = (slug: string, init?: RequestInit) => get<EventResponse>(`/api/events/by-slug/${encodeURIComponent(slug)}`, init);
export const fetchCurve = (segment: string, h: number, init?: RequestInit) =>
  get<Curve>(`/api/model/curve?${new URLSearchParams({ segment, h: String(h) })}`, init);
export const fetchBacktest = (init?: RequestInit) => get<BacktestResponse>("/api/backtest", init);

/** Group rows back out of a MarketsResponse. */
export const groupRows = (r: MarketsResponse, g: ApiGroup) => r.rows.slice(g.start, g.start + g.count);
