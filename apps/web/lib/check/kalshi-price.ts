// F1: Kalshi's own price for each side of the matched market, for the ticker in a pasted Kalshi link (0-1; null = Kalshi has no
// usable price for that side). Mirrors engine/venues.py kalshi_price: the matched side is the market's best side, and it is
// Kalshi's Yes unless its outcome is "No". Kalshi's Yes costs its ask (else the last trade); its No costs 1 - the Yes bid.
import type { KalshiIndexFile } from "@/lib/types";

export type KalshiSidePrices = { ticker: string; prices: { 0: number | null; 1: number | null } };

const ok = (cents: number | null | undefined) => (cents != null && cents >= 1 && cents <= 99 ? cents / 100 : null);

export function kalshiOwnPrices(rows: KalshiIndexFile["rows"], parts: string[], best: { index: 0 | 1; outcome: string }): KalshiSidePrices | null {
  const low = parts.map((p) => p.toLowerCase());
  const row = rows.find((t) => low.includes(t[0].toLowerCase()));
  if (!row) return null;
  const yes = ok(row[6] ?? row[7]);
  const no = row[5] == null ? null : ok(100 - row[5]);
  const yesSide = best.outcome.toLowerCase() === "no" ? ((1 - best.index) as 0 | 1) : best.index;
  const prices = { 0: null, 1: null } as KalshiSidePrices["prices"];
  prices[yesSide] = yes;
  prices[(1 - yesSide) as 0 | 1] = no;
  return { ticker: row[0], prices };
}
