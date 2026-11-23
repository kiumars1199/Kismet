// F1: the JSON /api/check returns. A pure function of (market, side, price, stake): nothing about the caller goes in,
// so two accounts get byte-identical bodies (test/check-api.test.ts).
import { basis } from "@/lib/format";
import { baseOf, compute, type CheckBase, type CheckResult } from "./compute";
import type { StoreMarket } from "@/lib/types";

export interface CheckResponse {
  market: { id: string; question: string; event: string; event_id: string; url: string; closes_at: number; category: string; niche: string; market_type: string; horizon_h: number; venue: "polymarket" | "polymarket-us" };
  /** Both sides' inputs, so switching side recomputes in the browser. */
  sides: { index: 0 | 1; outcome: string; base: CheckBase; basis: string }[];
  side: 0 | 1;
  result: CheckResult;
  /** A Kalshi link: Kalshi's own price for each side of the matched market (0-1, null = none), from the ticker pasted. */
  kalshi?: { ticker: string; prices: { 0: number | null; 1: number | null } };
}

export function buildCheck(m: StoreMarket, sideIndex: 0 | 1, price: number | undefined, stake: number): CheckResponse | null {
  const s = m.sides.find((x) => x.side_index === sideIndex);
  if (!s) return null;
  const base = baseOf(m, s);
  return {
    market: {
      id: m.id, question: m.question, event: m.event, event_id: m.event_id, url: m.url, closes_at: m.closes_at, category: m.category, niche: m.niche,
      market_type: m.market_type, horizon_h: m.horizon_h, venue: m.venue === "us" ? "polymarket-us" : "polymarket",
    },
    sides: m.sides.map((x) => ({ index: x.side_index, outcome: x.outcome, base: baseOf(m, x), basis: basis(m, x) })),
    side: sideIndex,
    result: compute(base, price ?? base.ask, stake),
  };
}

/** What the combo checker needs to list a leg before it is scored: title, side, price, venue. No model numbers, so a lookup is not a check. */
export interface LegLookup {
  market: { id: string; question: string; event: string; event_id: string };
  side: 0 | 1;
  outcome: string;
  price: number;                       // the card's price for this side (a fraction)
  venue: CheckBase["venue"];
}

export function buildLeg(m: StoreMarket, sideIndex: 0 | 1): LegLookup | null {
  const s = m.sides.find((x) => x.side_index === sideIndex);
  if (!s) return null;
  const base = baseOf(m, s);
  return { market: { id: m.id, question: m.question, event: m.event, event_id: m.event_id }, side: sideIndex, outcome: s.outcome, price: base.ask, venue: base.venue };
}

/** /api/check/combo: per leg, only the inputs the combo view recomputes from (a Free check is one combo, not ten single checks). */
export interface ComboLegsResponse { legs: { m: string; side: 0 | 1; base: CheckBase; basis: string }[] }
