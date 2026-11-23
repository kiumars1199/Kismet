// F4: the rows of the "Same outcome, every venue" block. Pure, so the rules are unit-tested (rows.test.ts).
import { DASH, odds, price } from "@/lib/format";
import type { VenueQuote } from "@/lib/types";

export const VENUE_ORDER = ["polymarket", "us", "kalshi"] as const;
export const VENUE_LABEL: Record<(typeof VENUE_ORDER)[number], string> = { polymarket: "Polymarket", us: "Polymarket US", kalshi: "Kalshi" };

export interface VenueRow {
  venue: (typeof VENUE_ORDER)[number]; label: string;
  listed: boolean;
  chance: string;               // the venue's price as a % ("62%"), DASH when listed without a price
  pays: string | null;          // "1.59x", or null when no payout after fees is known for this venue (an old venues.json without Kalshi's)
  best: boolean;                // "Pays most here"
  bestLabel: string | null;     // the badge text when best
  missing: string;              // what an unlisted row says: "Not listed", or "Not available right now" for Kalshi when its snapshot was filtered by age or delay
}

/** "Pays most here" goes to the single highest multiplier among venues that HAVE one (every venue's fee is counted: Kalshi's is
 *  its standard taker fee, engine/venues.py). A tie marks nobody; a venue with no multiplier (an older venues.json) never gets it.
 *  kalshiUnavailable: Kalshi lists this market but its snapshot is filtered out by age or delay (Market.kalshi_unavailable). */
export function venueRows(venues: VenueQuote[] | undefined, kalshiUnavailable = false): VenueRow[] {
  const by = new Map((venues ?? []).map((v) => [v.venue, v]));
  const mults = (venues ?? []).flatMap((v) => (v.multiplier !== null && v.multiplier > 0 ? [v.multiplier] : []));
  const top = Math.max(...mults, 0);
  const leaders = mults.filter((x) => x === top).length;
  return VENUE_ORDER.map((venue) => {
    const v = by.get(venue);
    const mult = v?.multiplier ?? null;
    const best = mult !== null && mult > 0 && mult === top && leaders === 1;
    return {
      venue, label: VENUE_LABEL[venue], listed: !!v,
      chance: v ? price(v.price) : DASH,
      pays: mult !== null && mult > 0 ? odds(1 / mult) : null,
      best, bestLabel: best ? "Pays most here" : null,
      missing: venue === "kalshi" && kalshiUnavailable ? "Not available right now" : "Not listed",
    };
  });
}

export interface VenueBasis { venue: VenueRow["venue"]; label: string; source: string; at: number | null; match: string | null }

/** The basis of each listed venue's number, one tap away (CLAUDE.md rule 3): where the price is from, when, and for Kalshi
 *  how sure the match is. The Polymarket and US prices are the scan's own (the same numbers the card shows). */
export function venueBasis(venues: VenueQuote[] | undefined): VenueBasis[] {
  return VENUE_ORDER.flatMap((venue) => {
    const v = (venues ?? []).find((x) => x.venue === venue);
    if (!v) return [];
    const source = venue === "polymarket" ? "Polymarket's own best ask for this outcome, plus its fee"
      : venue === "us" ? "Polymarket US best ask for this outcome, plus its fee (the price on the card)"
      : "Kalshi's price for this outcome, matched by title, date and numbers; Kalshi's fee is counted in its payout (standard Kalshi fee: some Kalshi markets use a different one)";
    const match = venue === "kalshi" && v.conf != null ? `match ${Math.round(v.conf * 100)}% sure` : null;
    return [{ venue, label: VENUE_LABEL[venue], source, at: v.at ?? null, match }];
  });
}
