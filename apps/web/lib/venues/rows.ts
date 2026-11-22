// F4: the rows of the "Same outcome, every venue" block. Pure, so the rules are unit-tested (rows.test.ts).
import { DASH, odds, price } from "@/lib/format";
import type { VenueQuote } from "@/lib/types";

export const VENUE_ORDER = ["polymarket", "us", "kalshi"] as const;
export const VENUE_LABEL: Record<(typeof VENUE_ORDER)[number], string> = { polymarket: "Polymarket", us: "Polymarket US", kalshi: "Kalshi" };

export interface VenueRow {
  venue: (typeof VENUE_ORDER)[number]; label: string;
  listed: boolean;
  chance: string;               // the venue's price as a % ("62%"), DASH when listed without a price
  pays: string | null;          // "1.59x", or null when no payout after fees is known for this venue (Kalshi today)
  best: boolean;                // "Pays most here"
  bestLabel: string | null;     // the badge text when best: qualified when a listed venue's fee is not counted
}

/** "Pays most here" goes to the single highest multiplier among venues that HAVE one. A tie marks nobody, and a venue
 *  with no multiplier (Kalshi until its fee formula is sourced, engine/venues.py) never gets it. */
export function venueRows(venues: VenueQuote[] | undefined): VenueRow[] {
  const by = new Map((venues ?? []).map((v) => [v.venue, v]));
  const mults = (venues ?? []).flatMap((v) => (v.multiplier !== null && v.multiplier > 0 ? [v.multiplier] : []));
  const top = Math.max(...mults, 0);
  const leaders = mults.filter((x) => x === top).length;
  // A listed venue with no multiplier is not in the comparison, so the badge must say so ("Kalshi fee not counted").
  const uncounted = (venues ?? []).filter((v) => v.multiplier === null || v.multiplier <= 0).map((v) => VENUE_LABEL[v.venue]);
  const badge = uncounted.length ? `Pays most here (${uncounted.join(" and ")} fee not counted)` : "Pays most here";
  return VENUE_ORDER.map((venue) => {
    const v = by.get(venue);
    const mult = v?.multiplier ?? null;
    const best = mult !== null && mult > 0 && mult === top && leaders === 1;
    return {
      venue, label: VENUE_LABEL[venue], listed: !!v,
      chance: v ? price(v.price) : DASH,
      pays: mult !== null && mult > 0 ? odds(1 / mult) : null,
      best, bestLabel: best ? badge : null,
    };
  });
}
