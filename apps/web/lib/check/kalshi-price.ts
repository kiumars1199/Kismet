// F1: Kalshi's own Yes price for the ticker in a pasted Kalshi link (ask, else last trade), 0-1; null when Kalshi has none.
import type { KalshiIndexFile } from "@/lib/types";

export function kalshiOwnPrice(rows: KalshiIndexFile["rows"], parts: string[]): { ticker: string; yes_price: number } | null {
  const low = parts.map((p) => p.toLowerCase());
  const row = rows.find((t) => low.includes(t[0].toLowerCase()));
  const cents = row ? (row[6] ?? row[7]) : null;
  return row && cents != null && cents >= 1 && cents <= 99 ? { ticker: row[0], yes_price: cents / 100 } : null;
}
