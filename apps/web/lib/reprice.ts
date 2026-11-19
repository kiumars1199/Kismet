// Live re-pricing of the flag list (server only). Before a paid user's Best bets page leaves the server, the current
// CLOB price of each bet on that page replaces the scan price: edge, fee, Pays (1 / ask), verdict and tier are
// recomputed and a bet that lost its edge is dropped. One batched POST /prices per request, cached 15 s per token;
// on a timeout or error the row keeps its scan price (no price_at, so the card shows no "Price as of").
import type { ApiRow, MarketsResponse } from "@/lib/api";
import { feeRate } from "@/lib/execution";
import type { Side } from "@/lib/types";
import { MIN_EDGE } from "@/lib/book";

const CLOB = "https://clob.polymarket.com";
const TTL_MS = 15_000;
const TIMEOUT_MS = 1_500;

type Quote = { at: number; ask: number; bid: number | null };
// ponytail: per-instance in-memory cache, unbounded by token count; shared cache if traffic grows
const cache = new Map<string, Quote>();
export const _clearPriceCache = () => cache.clear();

/** Current best ask / bid per token. BUY and SELL are both asked and the higher is taken as the ask, so the result
 *  doesn't depend on which side Polymarket labels which. Missing tokens = no live price. */
export async function livePrices(tokens: string[], now = Date.now()): Promise<Map<string, Quote>> {
  const out = new Map<string, Quote>();
  const need: string[] = [];
  for (const t of new Set(tokens.filter(Boolean))) {
    const hit = cache.get(t);
    if (hit && now - hit.at < TTL_MS) out.set(t, hit);
    else need.push(t);
  }
  if (!need.length) return out;
  try {
    const res = await fetch(`${CLOB}/prices`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(need.flatMap((token_id) => [{ token_id, side: "BUY" }, { token_id, side: "SELL" }])),
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as Record<string, { BUY?: string | number; SELL?: string | number }>;
    for (const t of need) {
      const px = [Number(data?.[t]?.BUY), Number(data?.[t]?.SELL)].filter((x) => Number.isFinite(x) && x > 0 && x < 1);
      if (!px.length) continue;
      const q = { at: now, ask: Math.max(...px), bid: px.length > 1 ? Math.min(...px) : null };
      cache.set(t, q);
      out.set(t, q);
    }
  } catch {
    // timeout or CLOB error: these rows keep the scan price
  }
  return out;
}

const r4 = (x: number) => Math.round(x * 1e4) / 1e4;

/** The side at a new ask, same formulas as the engine (engine/scan.py, lib/execution.ts check()). */
export function sideAt(s: Side, ask: number, cat: string): Side {
  const fee = feeRate(cat) * ask * (1 - ask);
  const edge = s.win_prob - ask - fee;
  return {
    ...s, ask: r4(ask), fee: r4(fee), edge: r4(edge), edge_low: r4(s.win_prob_low - ask - fee),
    roi_pct: Math.round((edge / (ask + fee)) * 1e4) / 100,
    realistic_edge: s.realistic_edge == null ? s.realistic_edge : r4(Math.min(s.realistic_edge, edge)),
  };
}

/** One row at its live price, or null when the bet lost its edge. Rows without a live quote come back unchanged. */
export function repriceRow(r: ApiRow, quotes: Map<string, Quote>): ApiRow | null {
  const q = quotes.get(r.market.tokens?.[r.side.side_index] ?? "");
  if (!q) return r;
  const side = sideAt(r.side, q.ask, r.market.category);
  if (side.edge < MIN_EDGE) return null;
  const m = r.market;
  const isBest = m.best.side_index === side.side_index;
  // Tier can only drop: "best" also needs a positive pessimistic edge (engine is_flag); validation isn't re-run.
  const tier = m.tier === "best" && side.edge_low <= 0 ? "edge" : m.tier;
  const ex = m.execution;
  const execution = ex && isBest ? (() => {
    const mid = q.bid !== null ? (q.ask + q.bid) / 2 : q.ask;
    const gross = side.win_prob - mid;
    const retention = gross > 0 ? side.edge / gross : 0;
    return {
      ...ex, best_ask: side.ask, best_bid: q.bid, book_mid: r4(mid), spread: r4(q.ask - (q.bid ?? q.ask)),
      fee_at_ask: side.fee, net_edge: side.edge, gross_edge: r4(gross),
      ...(ex.retention !== undefined ? { retention: r4(retention) } : {}),
      verdict: side.edge >= MIN_EDGE && retention >= 0.5 ? ("worth it" as const) : ("thin" as const),
    };
  })() : ex;
  return {
    market: {
      ...m, ...(tier ? { tier } : {}), ...(execution ? { execution } : {}),
      sides: m.sides.map((x) => (x.side_index === side.side_index ? side : x)),
      best: isBest ? side : m.best,
    },
    side,
    price_at: q.at,
  };
}

/** A flags page at live prices: rows that lost their edge leave, totals and event groups shrink to match. */
export async function repricePage(page: MarketsResponse, now = Date.now()): Promise<MarketsResponse> {
  if (!page.rows.length) return page;
  const quotes = await livePrices(page.rows.map((r) => r.market.tokens?.[r.side.side_index] ?? ""), now);
  if (!quotes.size) return page;
  const next = page.rows.map((r) => repriceRow(r, quotes));
  const rows = next.filter((r): r is ApiRow => r !== null);
  const dropped = page.rows.length - rows.length;
  const groups = page.groups?.map((g) => {
    const before = next.slice(0, g.start).filter(Boolean).length;
    return { ...g, start: before, count: next.slice(g.start, g.start + g.count).filter(Boolean).length };
  }).filter((g) => g.count > 0);
  const total_groups = page.total_groups !== undefined && groups && page.groups
    ? Math.max(0, page.total_groups - (page.groups.length - groups.length)) : page.total_groups;
  return { ...page, rows, total: Math.max(0, page.total - dropped), ...(groups ? { groups, total_groups } : {}) };
}
