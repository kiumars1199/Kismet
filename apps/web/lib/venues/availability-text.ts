// F9: the one sentence shown above a bet button. Pure and client-safe (no config import).
export type VenueKey = "kalshi" | "polymarket_us" | "polymarket_intl";
export type AvailStatus = "available" | "restricted" | "unverified";

/** Name of the venue as users read it. */
export const VENUE_NAMES: Record<VenueKey, string> = { kalshi: "Kalshi", polymarket_us: "Polymarket US", polymarket_intl: "Polymarket" };

/** "Kalshi: available in Texas" / "not available in Texas" / "check Kalshi for Texas" (not sourced) / "Check your state" (no state). */
export function availabilityLine(venue: VenueKey, stateName: string | null, status: AvailStatus | null): string {
  const name = VENUE_NAMES[venue];
  if (!stateName || !status) return "Check your state";
  if (status === "available") return `${name}: available in ${stateName}`;
  if (status === "restricted") return `${name}: not available in ${stateName}`;
  return `Check ${name} for ${stateName}`;
}
