// F14: pure helpers for the price-history chart (no React, no I/O).
import type { HistorySeries } from "@/lib/types";

export interface HistoryPoint { t: number; p: number }

/** The columnar series as points, p as a 0..1 price. */
export const pointsOf = (s: HistorySeries): HistoryPoint[] => s.p.map((v, i) => ({ t: s.t0 + i * s.dt, p: v / 1000 }));

/** "hour", "6 hours", "day", "2 days", "36 hours": the series' step in plain words. */
export function intervalWords(dt: number): string {
  const h = Math.round(dt / 3600);
  if (h <= 1) return "hour";
  if (h % 24 === 0) return h === 24 ? "day" : `${h / 24} days`;
  return `${h} hours`;
}

/** The basis line under the chart. */
export const basisLine = (venue: string, dt: number) => `Prices from ${venue}, every ${intervalWords(dt)}`;

/** Axis tick: a price as a whole percent. */
export const tickPct = (p: number) => `${Math.round(p * 100)}%`;
