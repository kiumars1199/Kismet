// F9: venue availability by US state, from config/venue-availability.json (every entry has a source URL and a checked date).
// Server side: the root layout looks up the visitor's state once and hands the client three statuses.
import data from "../../../../config/venue-availability.json";
import { US_STATES } from "./states";
import type { AvailStatus, VenueKey } from "./availability-text";

export interface AvailEntry { status: AvailStatus; source_url: string; checked: string; note: string }
export const VENUE_KEYS = Object.keys(data.venues) as VenueKey[];
export const AVAILABILITY = data as unknown as { checked: string; states: Record<string, string>; venues: Record<VenueKey, { name: string; entries: Record<string, AvailEntry> }> };

export const entryFor = (venue: VenueKey, state: string): AvailEntry | null => AVAILABILITY.venues[venue]?.entries[state] ?? null;

/** What the client needs for one state: each venue's status. */
export function statusesFor(state: string | null): Record<VenueKey, AvailStatus> | null {
  if (!state || !Object.hasOwn(US_STATES, state)) return null;
  return Object.fromEntries(VENUE_KEYS.map((k) => [k, entryFor(k, state)?.status ?? "unverified"])) as Record<VenueKey, AvailStatus>;
}
