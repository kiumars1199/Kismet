// Server-side filtering, sorting, grouping and facets (docs/04 § Server filtering).
// Missing fields (volume_24h, created_at, competitive, ...) count as "no value": a min/max filter on them
// excludes the row and sorting puts them last in either direction. Values are never invented.
import type { Store } from "@/lib/data/store";
import { TAXONOMY, topicsOf } from "@/lib/taxonomy";
import type { Execution, Side, StoreMarket } from "@/lib/types";
import type { FilterState, SortKey } from "./state";

export const GROUP_ROWS = 4;
export interface UserCtx { watchlist: Set<string>; favoriteTopics: string[] }
export interface Row { market: StoreMarket; side: Side }
export interface Group {
  event_id: string; event: string; slug: string;
  closes_at: number;        // earliest close among member rows
  flagged: number;          // member rows that are flags
  size: number;             // matching rows in the group (rows below are cut to GROUP_ROWS)
  best: Row;                // first row = best by the current sort
  rows: Row[];
}
export type Counts = Record<string, number>;
export interface Facets { categories: Counts; topics: Counts; market_types: Counts; periods: Counts; verdicts: Counts }
export interface Page {
  total: number;            // matching rows
  total_groups?: number;    // matching event groups (when grouped)
  page: number; page_size: number;
  pages: number;            // page count for this filter
  // Flat: rows[(page-1)*page_size ...]. Grouped: page_size = event groups per page (max 50), each cut to
  // GROUP_ROWS rows (Group.size is the full count), so a page holds <= 200 rows.
  rows: Row[];              // rows on this page (grouped: the page's groups flattened, best first)
  groups?: Group[];
  facets: Facets;           // counts for the current filter minus that facet
}

const num = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
const gte = (x: number | null | undefined, min?: number) => min === undefined || (num(x) && x >= min);
const lte = (x: number | null | undefined, max?: number) => max === undefined || (num(x) && x <= max);
const inSet = <T>(x: T, set?: readonly T[]) => !set || set.includes(x);

export function pickSide(m: StoreMarket, side: FilterState["side"]): Side | undefined {
  const [a, b] = m.sides;
  switch (side) {
    case "best": return m.best;
    case "yes": return a;
    case "no": return b;
    case "favorite": return a && b ? (b.mid > a.mid ? b : a) : a;
    case "underdog": return a && b ? (b.mid < a.mid ? b : a.mid < b.mid ? a : b) : a;
  }
}

/** Payout multiplier per $1 staked, before fee (docs/13): 1 / ask. */
export const paysOf = (s: Pick<Side, "ask">) => (s.ask > 0 ? 1 / s.ask : null);

/** Asking for long shots (pays >= 2.5x, price <= 40¢, chance <= 40%) lifts the default 40% floor (docs/13 § Matching). */
export const liftsFloor = (f: FilterState) =>
  (f.pays_min ?? 0) >= 2.5 || (f.price_max ?? 1) <= 0.4 || (f.win_prob_max ?? 1) <= 0.4;

/** Side-level filters; the 40% win-chance floor applies unless win_prob_min is set (wp=0 turns it off) or lifted. */
export function sideOk(s: Side, f: FilterState): boolean {
  const pays = paysOf(s);
  return gte(s.ask, f.price_min) && lte(s.ask, f.price_max) &&
    gte(pays, f.pays_min) && lte(pays, f.pays_max) &&
    gte(s.win_prob, f.win_prob_min ?? (liftsFloor(f) ? 0 : f.win_prob_floor_default)) && lte(s.win_prob, f.win_prob_max) &&
    gte(s.edge, f.sort.key === "pays" ? Math.max(f.edge_min ?? 0.02, 0.02) : f.edge_min) && (!f.edge_low_positive || s.edge_low > 0) &&
    gte(s.roi_pct, f.roi_min) && gte(s.model_events, f.min_events);
}

export function executionOk(x: Execution | undefined, f: FilterState): boolean {
  if (!f.verdicts && f.retention_min === undefined && f.capacity_min_usd === undefined) return true;
  return !!x && inSet(x.verdict, f.verdicts) && gte(x.retention, f.retention_min) && gte(x.capacity_usd, f.capacity_min_usd);
}

const SORT_VALUE: Record<SortKey, (r: Row) => number | null | undefined> = {
  edge: (r) => r.side.edge,
  edge_low: (r) => r.side.edge_low,
  realistic_edge: (r) => r.side.realistic_edge,
  roi: (r) => r.side.roi_pct,
  win_prob: (r) => r.side.win_prob,
  price: (r) => r.side.ask,
  closes: (r) => r.market.closes_at,
  volume: (r) => r.market.volume,
  volume_24h: (r) => r.market.volume_24h,
  liquidity: (r) => r.market.liquidity,
  spread: (r) => r.market.spread,
  capacity: (r) => r.market.execution?.capacity_usd,
  retention: (r) => r.market.execution?.retention,
  evidence: (r) => r.side.model_events,
  competitive: (r) => r.market.competitive,
  newest: (r) => r.market.created_at,
  pays: (r) => paysOf(r.side),
};

/** Missing values last in either direction; ties by closes_at asc, then id. */
export function comparator(sort: FilterState["sort"]): (a: Row, b: Row) => number {
  const get = SORT_VALUE[sort.key];
  const sign = sort.dir === "asc" ? 1 : -1;
  return (a, b) => {
    const x = get(a), y = get(b);
    const hx = num(x), hy = num(y);
    if (hx !== hy) return hx ? -1 : 1;
    if (hx && hy && x !== y) return (x - y) * sign;
    return a.market.closes_at - b.market.closes_at || (a.market.id < b.market.id ? -1 : a.market.id > b.market.id ? 1 : 0);
  };
}

export function groupByEvent(rows: Row[], flagIds?: Map<string, unknown>): Group[] {
  const groups = new Map<string, Group>();
  for (const r of rows) {
    const m = r.market;
    let g = groups.get(m.event_id);
    if (!g) groups.set(m.event_id, (g = { event_id: m.event_id, event: m.event, slug: m.slug, closes_at: m.closes_at, flagged: 0, size: 0, best: r, rows: [] }));
    g.rows.push(r);
    g.size++;
    g.closes_at = Math.min(g.closes_at, m.closes_at);
    if (m.execution && (!flagIds || flagIds.has(m.id))) g.flagged++;
  }
  return [...groups.values()];
}

// Facet bits: a row counts toward facet X when every filter except X passes.
const CAT = 1, TOPIC = 2, MT = 4, PER = 8, VD = 16;

export function apply(store: Store, f: FilterState, user?: UserCtx): Page {
  const source = f.view === "flags" ? store.flags : store.markets;
  const hits = f.q ? store.search.find(f.q) : null;
  const fav = f.favorites_only ? (user?.favoriteTopics ?? []) : null;
  const fNoVerdicts = { ...f, verdicts: undefined }; // verdicts are a facet (VD bit)

  const facets: Facets = {
    categories: Object.fromEntries(["sports", "crypto", "politics", "finance", "culture", "weather", "tech", "geopolitics", "other"].map((k) => [k, 0])),
    topics: Object.fromEntries(Object.keys(TAXONOMY).map((k) => [k, 0])),
    market_types: Object.fromEntries(["moneyline", "spreads", "totals", "props", "yes/no", "multi-outcome"].map((k) => [k, 0])),
    periods: Object.fromEntries(["full", "1H", "2H", "1Q", "2Q", "3Q", "4Q"].map((k) => [k, 0])),
    verdicts: Object.fromEntries(["worth it", "thin", "not worth it", "no sellers", "no book"].map((k) => [k, 0])),
  };
  const bump = (c: Counts, k: string) => (c[k] = (c[k] ?? 0) + 1);

  const rows: Row[] = [];
  for (const m of source) {
    let mask = 0;
    if (!inSet(m.category, f.categories)) mask |= CAT;
    const topics = topicsOf(m);
    if (f.topics && !f.topics.some((id) => topics.has(id))) mask |= TOPIC;
    if (!inSet(m.market_type, f.market_types)) mask |= MT;
    if (!inSet(m.derived.period, f.periods)) mask |= PER;
    if (f.verdicts && !(m.execution && f.verdicts.includes(m.execution.verdict))) mask |= VD;

    const s = pickSide(m, f.side);
    const other =
      !s || !sideOk(s, f) ||
      (f.exclude_categories?.includes(m.category) ?? false) ||
      (f.frequency ? !f.frequency.some((fr) => m.derived.frequency.includes(fr)) : false) ||
      (f.live_only && !m.derived.is_live) ||
      !gte(m.hours_to_close, f.closes_after_h) || !lte(m.hours_to_close, f.closes_within_h) ||
      !gte(m.volume, f.volume_min) || !gte(m.volume_24h, f.volume_24h_min) ||
      !gte(m.liquidity, f.liquidity_min) || !lte(m.spread, f.spread_max) ||
      (f.validated_only && !m.validated) ||
      (f.watchlisted_only && !user?.watchlist.has(m.id)) ||
      (fav && !fav.some((id) => topics.has(id))) ||
      (hits && !hits.has(m.id)) ||
      !executionOk(m.execution, fNoVerdicts);
    if (other) continue;   // fails a non-facet filter: counts nowhere

    if (!(mask & ~CAT)) bump(facets.categories, m.category);
    if (!(mask & ~TOPIC)) for (const id of topics) bump(facets.topics, id);
    if (!(mask & ~MT)) bump(facets.market_types, m.market_type);
    if (!(mask & ~PER)) bump(facets.periods, m.derived.period);
    if (!(mask & ~VD) && m.execution) bump(facets.verdicts, m.execution.verdict);
    if (mask === 0) rows.push({ market: m, side: s! });
  }

  rows.sort(comparator(f.sort));
  const base = { total: rows.length, page: f.page, page_size: f.page_size, facets };
  if (!f.group_by_event) {
    const start = (f.page - 1) * f.page_size;
    return { ...base, pages: Math.ceil(rows.length / f.page_size), rows: rows.slice(start, start + f.page_size) };
  }

  // Page over event groups. Each group carries its best row plus up to GROUP_ROWS-1 more (size = full count;
  // expand via /api/events/[id]). Groups per page = page_size, capped so a page never exceeds 200 rows.
  const all = groupByEvent(rows, store.flagsById);
  const per = Math.min(f.page_size, Math.floor(200 / GROUP_ROWS));
  const groups = all.slice((f.page - 1) * per, f.page * per).map((g) => (g.size > GROUP_ROWS ? { ...g, rows: g.rows.slice(0, GROUP_ROWS) } : g));
  return { ...base, page_size: per, pages: Math.ceil(all.length / per), total_groups: all.length, groups, rows: groups.flatMap((g) => g.rows) };
}
