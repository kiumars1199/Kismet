// F1: the JSON /api/check returns. A pure function of (market, side, price, stake): nothing about the caller goes in,
// so two accounts get byte-identical bodies (test/check-api.test.ts).
import { basis } from "@/lib/format";
import { venueLinks, type VenueId } from "@/lib/venues/guides";
import { baseOf, compute, type CheckBase, type CheckResult } from "./compute";
import type { StoreMarket } from "@/lib/types";

export interface CheckResponse {
  market: { id: string; question: string; event: string; event_id: string; url: string; closes_at: number; category: string; niche: string; market_type: string; horizon_h: number; venue: "polymarket" | "polymarket-us"; links: { venue: VenueId; url: string | null }[] };
  /** Both sides' inputs, so switching side recomputes in the browser. */
  sides: { index: 0 | 1; outcome: string; base: CheckBase; basis: string }[];
  side: 0 | 1;
  result: CheckResult;
}

export function buildCheck(m: StoreMarket, sideIndex: 0 | 1, price: number | undefined, stake: number): CheckResponse | null {
  const s = m.sides.find((x) => x.side_index === sideIndex);
  if (!s) return null;
  const base = baseOf(m, s);
  return {
    market: {
      id: m.id, question: m.question, event: m.event, event_id: m.event_id, url: m.url, closes_at: m.closes_at, category: m.category, niche: m.niche,
      market_type: m.market_type, horizon_h: m.horizon_h, venue: m.venue === "us" ? "polymarket-us" : "polymarket", links: venueLinks(m),
    },
    sides: m.sides.map((x) => ({ index: x.side_index, outcome: x.outcome, base: baseOf(m, x), basis: basis(m, x) })),
    side: sideIndex,
    result: compute(base, price ?? base.ask, stake),
  };
}
