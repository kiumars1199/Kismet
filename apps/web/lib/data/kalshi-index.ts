// F3: every open Kalshi market, searchable by words and topic. Pure functions (no I/O): store.ts loads the file and
// caches the built index for 120 s. Kalshi rows have no model chance, so they never become flags or Best bets.
import type { KalshiFile, KalshiIndexFile } from "@/lib/types";

export const KALSHI_PAGE_MAX = 50;

/** One Kalshi row as /api/markets serves it. `price_cents` = what a Yes costs now (ask, else last trade); null = "No price yet". */
export interface KalshiRow {
  ticker: string; title: string; subtitle: string; topic: string;
  price_cents: number | null; yes_bid_cents: number | null; volume: number;
  closes_at: number | null;   // unix s
  url: string;
  venue: "kalshi";
}
export interface KalshiPage { total: number; page: number; page_size: number; pages: number; rows: KalshiRow[] }

type Tuple = KalshiIndexFile["rows"][number];
export interface KalshiIndex { fetchedAt: number; rows: Tuple[]; hay: string[] }

const hayOf = (t: Tuple) => `${t[1]} ${t[2]} ${t[0]}`.toLowerCase();
const byVolume = (a: Tuple, b: Tuple) => b[8] - a[8];

/** From kalshi_index.json (every open market). */
export function indexFromFile(f: KalshiIndexFile): KalshiIndex {
  const rows = f.rows.slice().sort(byVolume);
  return { fetchedAt: f.meta.fetched_at, rows, hay: rows.map(hayOf) };
}

/** Fallback when the scan wrote no kalshi_index.json (older scans, fixtures): the top markets in kalshi.json. */
export function indexFromKalshi(f: KalshiFile): KalshiIndex {
  const rows = f.markets.map((m): Tuple => [
    m.ticker, m.title, m.subtitle, m.topic ?? "other", m.series_ticker, m.yes_bid_cents, m.yes_ask_cents,
    m.last_price_cents ?? null, m.volume, m.close_time ? Date.parse(m.close_time) / 1000 : null,
  ]).sort(byVolume);
  return { fetchedAt: f.meta.fetched_at, rows, hay: rows.map(hayOf) };
}

const url = (series: string) => `https://kalshi.com/markets/${series.toLowerCase()}`;
const rowOf = (t: Tuple): KalshiRow => ({
  ticker: t[0], title: t[1], subtitle: t[2], topic: t[3],
  price_cents: t[6] ?? t[7] ?? null, yes_bid_cents: t[5], volume: t[8], closes_at: t[9], url: url(t[4]), venue: "kalshi",
});

/** A row is in topic `id` when its topic is `id` or a child of it ("sports.nfl" is in "sports" and in "sports.nfl"). */
export const inTopic = (topic: string, id: string) => topic === id || topic.startsWith(`${id}.`);

export interface KalshiQuery { q?: string; topics?: string[]; categories?: string[]; page: number; page_size: number }

const tokens = (q: string) => q.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

/** Rows whose title, label or ticker contain every word of q, in the topics asked for (OR within topics and
 *  categories, AND between them and with q), biggest volume first. `now` (unix s) hides markets that already closed. */
export function searchKalshi(ix: KalshiIndex, query: KalshiQuery, now = Date.now() / 1000): KalshiPage {
  const words = query.q ? tokens(query.q) : [];
  const topics = query.topics?.length ? query.topics : undefined;
  const cats = query.categories?.length ? query.categories : undefined;
  const hits: number[] = [];
  for (let i = 0; i < ix.rows.length; i++) {
    const t = ix.rows[i]!;
    if (t[9] !== null && t[9] <= now) continue;
    if (topics && !topics.some((id) => inTopic(t[3], id))) continue;
    if (cats && !cats.some((id) => inTopic(t[3], id))) continue;
    const h = ix.hay[i]!;
    if (words.length && !words.every((w) => h.includes(w))) continue;
    hits.push(i);
  }
  const size = Math.min(Math.max(1, query.page_size), KALSHI_PAGE_MAX);
  const pages = Math.max(1, Math.ceil(hits.length / size));
  const page = Math.min(Math.max(1, query.page), pages);
  return { total: hits.length, page, page_size: size, pages, rows: hits.slice((page - 1) * size, page * size).map((i) => rowOf(ix.rows[i]!)) };
}
