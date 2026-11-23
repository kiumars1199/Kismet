// F9: the visitor's chosen state, from a small cookie (set by POST /api/state), for the root layout. A prerendered page
// has no cookies, so it reads as "no state" and the note says "Check your state".
import "server-only";
import { cookies } from "next/headers";
import { unstable_rethrow } from "next/navigation";
import { STATE_COOKIE, US_STATES, validState } from "./states";
import { statusesFor } from "./availability";
import type { AvailStatus, VenueKey } from "./availability-text";

export interface AvailCtx { state: string | null; stateName: string | null; statuses: Record<VenueKey, AvailStatus> | null }

export async function requestAvailability(): Promise<AvailCtx> {
  try {
    const state = validState((await cookies()).get(STATE_COOKIE)?.value);
    return { state, stateName: state ? US_STATES[state]! : null, statuses: statusesFor(state) };
  } catch (e) {
    unstable_rethrow(e);
    return { state: null, stateName: null, statuses: null };
  }
}
