// F3 fix: every open Polymarket market the model does not price (no live book, closes past 10 days, ...), searchable by
// words and topic. Pure functions (no I/O): store.ts loads output/polymarket_index.json (engine/pm_index.py) and caches
// the built index. These rows carry no price and no model chance, so they are never flags or Best bets and never leak a
// live price past the Free delay: the page says "Not priced yet" and links to polymarket.com.
import { topicsOf } from "@/lib/taxonomy";
import type { Market, PolymarketIndexFile } from "@/lib/types";

export const PM_MORE_MAX = 10;

type Tuple = PolymarketIndexFile["rows"][number];   // id, question, event, slug, category, niche, tags, volume, close_epoch
export interface PolymarketIndex { fetchedAt: number; rows: Tuple[]; hay: string[]; topics: string[][] }

export interface UnpricedRow {
  id: string; question: string; event: string; volume: number;
  closes_at: number | null;   // unix s
  /** Past its close time but still accepting orders: waiting for the result. */
  waiting: boolean;
  url: string;
  venue: "polymarket";
}
export interface UnpricedPage { total: number; rows: UnpricedRow[] }

const EMPTY_TAGS: string[] = [];
const hayOf = (t: Tuple) => `${t[1]} ${t[2]}`.toLowerCase();

/** From polymarket_index.json. Topic ids come from the same taxonomy the priced rows use (taxonomy.ts), computed once. */
export function indexFromPmFile(f: PolymarketIndexFile): PolymarketIndex {
  // Not yet past its close time first, then biggest volume. A market past its close time that still accepts orders is
  // open on Polymarket (waiting for the result), so it stays in the index AND the count (one rule for both).
  const at = f.meta.fetched_at;
  const rows = f.rows.slice().sort((a, b) => Number((a[8] ?? Infinity) <= at) - Number((b[8] ?? Infinity) <= at) || b[7] - a[7]);
  const shared = new Map<string, string[]>();   // one topic array per distinct topic set (memory: 143K rows, ~hundreds of sets)
  const topics = rows.map((t) => {
    const ids = [...topicsOf({ category: t[4], niche: t[5], tags: t[6] } as unknown as Market)];
    const key = ids.join("|");
    let a = shared.get(key);
    if (!a) shared.set(key, (a = ids));
    t[6] = EMPTY_TAGS;   // tags were only needed for the topic ids
    return a;
  });
  return { fetchedAt: f.meta.fetched_at, rows, hay: rows.map(hayOf), topics };
}

const rowOf = (t: Tuple, now: number): UnpricedRow => ({
  id: t[0], question: t[1], event: t[2], volume: t[7], closes_at: t[8], waiting: t[8] !== null && t[8] <= now, url: `https://polymarket.com/event/${t[3]}`, venue: "polymarket",
});

const tokens = (q: string) => q.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

export interface UnpricedQuery { q?: string; topics?: string[]; categories?: string[]; excludeCategories?: string[]; limit?: number }

/** Index rows not in `priced` (the store's market ids), matching every word of q and, when given, one of the topics and
 *  one of the categories; open ones before those waiting for a result, biggest volume first. total counts all matches,
 *  rows the first `limit`. */
export function searchUnpriced(ix: PolymarketIndex, priced: { has(id: string): boolean }, query: UnpricedQuery, now = Date.now() / 1000): UnpricedPage {
  const words = query.q ? tokens(query.q) : [];
  const topics = query.topics?.length ? query.topics : undefined;
  const cats = query.categories?.length ? query.categories : undefined;
  const limit = Math.min(query.limit ?? PM_MORE_MAX, PM_MORE_MAX);
  let total = 0;
  const rows: UnpricedRow[] = [];
  for (let i = 0; i < ix.rows.length; i++) {
    const t = ix.rows[i]!;
    if (priced.has(t[0])) continue;
    if (topics && !topics.some((id) => ix.topics[i]!.includes(id))) continue;
    if (cats && !cats.includes(t[4])) continue;
    if (query.excludeCategories?.includes(t[4])) continue;
    if (words.length && !words.every((w) => ix.hay[i]!.includes(w))) continue;
    total++;
    if (rows.length < limit) rows.push(rowOf(t, now));
  }
  return { total, rows };
}

const counted = new WeakMap<PolymarketIndex, WeakMap<object, number>>();
/** Rows of the index that the scan does not price (so counts.polymarket = priced + this has no double count). Cached per
 *  (index, store ids) pair. */
export function countUnpriced(ix: PolymarketIndex, priced: { has(id: string): boolean }): number {
  let per = counted.get(ix);
  if (!per) counted.set(ix, (per = new WeakMap()));
  let n = per.get(priced as object);
  if (n === undefined) {
    n = 0;
    for (const t of ix.rows) if (!priced.has(t[0])) n++;
    per.set(priced as object, n);
  }
  return n;
}
