// T-288: the zone and clock for this request's server render (lib/zone.ts). Root layout passes them to <ClockProvider>.
import "server-only";
import { cookies, headers } from "next/headers";
import { TZ_COOKIE, TZ_HEADER, pickZone } from "./zone";

/** `zone`: the zone to render in (cookie, else Vercel header, else null); `saved`: the cookie's own zone, if any. */
export async function requestClock(): Promise<{ zone: string | null; saved: string | null }> {
  try {
    const [c, h] = await Promise.all([cookies(), headers()]);
    const cookie = c.get(TZ_COOKIE)?.value;
    return { zone: pickZone(cookie, h.get(TZ_HEADER)), saved: pickZone(cookie, null) };
  } catch {
    return { zone: null, saved: null };   // outside a request (build, tests)
  }
}

export const requestZone = async (): Promise<string | null> => (await requestClock()).zone;
