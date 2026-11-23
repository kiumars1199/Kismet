// F16 big-trade source. Server only.
//
// SOURCE (documented, public, no key): Polymarket Data API v2 "List trades", read 2026-11-23:
//   docs.polymarket.com/api-reference/feeds/list-trades.md   ("All data routes are public; no API key or token is required.")
//   GET https://data-api.polymarket.com/v2/trades?event_id=<up to 20 ids>&filter_type=CASH&filter_amount=10000&taker_only=true&limit=<n>
//   Row fields used: size (shares), price (USDC per share), timestamp (epoch s), transaction_hash, condition_id, outcome,
//   outcome_index, token_id, side. The row has no dollar field, so dollars = size x price here (docs: "bare sizes are shares").
//   v1 retires 2026-11-02 (docs.polymarket.com/migrate/data-api-v1-to-v2.md), so this uses /v2.
// THRESHOLD: one trade (one fill row, taker side) worth $10,000 or more. filter_amount=10000 with filter_type=CASH asks the
// API to pre-filter; the code re-checks size x price itself so a unit surprise never produces a false alert.
// Not verified against the live API from the build sandbox (its network blocks data-api.polymarket.com): the row shape
// follows the docs and parsing is tolerant, so an unexpected row is dropped, never fatal.
import "@/lib/zod-jitless";
import { z } from "zod";

import { BIG_TRADE_USD } from "@/lib/alerts";
export { BIG_TRADE_LOOKBACK_H, BIG_TRADE_USD } from "@/lib/alerts";
const BASE = "https://data-api.polymarket.com/v2/trades";
const CHUNK = 20;   // docs: event_id takes at most 20 distinct values

export interface BigTrade { token_id: string; side: "BUY" | "SELL" | null; outcome: string | null; usd: number; price: number; ts: number; tx: string }

const Row = z.object({
  size: z.coerce.number(), price: z.coerce.number(), timestamp: z.coerce.number(),
  token_id: z.string().min(1), transaction_hash: z.string().optional(),
  side: z.string().optional(), outcome: z.string().nullish(),
});
const Page = z.object({ data: z.array(z.unknown()) });

/** Rows of a /v2/trades page that are well formed. Anything else is skipped. */
export function parseTrades(raw: unknown): BigTrade[] {
  const page = Page.safeParse(raw);
  if (!page.success) return [];
  const out: BigTrade[] = [];
  for (const r of page.data.data) {
    const t = Row.safeParse(r);
    if (!t.success || !Number.isFinite(t.data.size) || !Number.isFinite(t.data.price)) continue;
    out.push({
      token_id: t.data.token_id, side: t.data.side === "BUY" || t.data.side === "SELL" ? t.data.side : null,
      outcome: t.data.outcome ?? null, usd: t.data.size * t.data.price, price: t.data.price, ts: t.data.timestamp,
      tx: t.data.transaction_hash ?? `${t.data.token_id}:${t.data.timestamp}:${t.data.size}`,
    });
  }
  return out;
}

/** Recent trades worth $10,000 or more in these Polymarket events (newest first, one page of up to 200 per chunk).
 *  ponytail: one page; a very busy event could push an older big trade off it, so raise `limit` or follow next_cursor. */
export async function fetchBigTrades(eventIds: string[], sinceSec: number): Promise<BigTrade[]> {
  const ids = [...new Set(eventIds)];
  const out: BigTrade[] = [];
  for (let i = 0; i < ids.length; i += CHUNK) {
    const q = new URLSearchParams({
      event_id: ids.slice(i, i + CHUNK).join(","), filter_type: "CASH", filter_amount: String(BIG_TRADE_USD), taker_only: "true", limit: "200",
    });
    const res = await fetch(`${BASE}?${q}`, { cache: "no-store", signal: AbortSignal.timeout(8_000) });
    if (!res.ok) throw new Error(`Polymarket trades HTTP ${res.status}`);
    out.push(...parseTrades(await res.json()).filter((t) => t.usd >= BIG_TRADE_USD && t.ts >= sinceSec));
  }
  return out;
}
