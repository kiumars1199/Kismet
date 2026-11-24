// F1: Free gets 1 check a day, counted on the server per account (signed out: per device, an IP hash). Pro/Premium: no limit.
// Counted with lib/abuse.ts distinct(): Upstash in production (shared across instances); without Upstash it is
// per instance (memory), which is for dev / demo only. Re-opening the same market + side the same day is free,
// like the Free "3 exact reveals a day" (lib/data/reveals.ts); a different one is the next check.
import { e2eMockOn } from "@/lib/e2e-mock";
import { createHash } from "node:crypto";
import { clientIp, distinct } from "@/lib/abuse";
import { quota, type Tier } from "@/lib/entitlements";

/** The device the signed-out counter is keyed on: the platform IP. Under the e2e mock only (e2eMockOn(): E2E_MOCK=1, in a production build only with E2E_PROD_BUILD=1, never on Vercel)
 *  a test may name its own device with `x-e2e-device`, so one test's check doesn't use up the next test's. */
export function deviceOf(req: Request): string {
  if (e2eMockOn()) {
    const d = req.headers.get("x-e2e-device");
    if (d) return `e2e:${d.slice(0, 64)}`;
  }
  return clientIp(req);
}

export const CHECK_TTL_MS = 26 * 3_600_000;
export const utcDay = (now = Date.now()) => new Date(now).toISOString().slice(0, 10);

/** The counter's key: per UTC day, per user id (signed in) or per hashed device. The raw IP is never stored. */
export function checkKey(userId: string | null | undefined, ip: string, now = Date.now()): string {
  const who = userId ? `u:${userId}` : `ip:${createHash("sha256").update(ip).digest("hex").slice(0, 24)}`;
  return `check:${who}:${utcDay(now)}`;
}

/** ok = this check may compute. `left` = checks remaining today (Infinity on paid plans). */
export async function countCheck(req: Request, tier: Tier, userId: string | null | undefined, marketId: string, side: number, now = Date.now()): Promise<{ ok: boolean; left: number }> {
  const limit = quota(tier, "checks_day");
  if (limit === Infinity) return { ok: true, left: Infinity };
  const r = await distinct(checkKey(userId, deviceOf(req), now), [`${marketId}:${side}`], limit, CHECK_TTL_MS);
  return { ok: r.ok, left: Math.max(0, limit - r.size) };
}

// T-wt2i: a hint the /check page reads on the server so a Free visitor who has used today's check gets the limit card in the first HTML
// (no skeleton, no screenful of reserved height that collapses later). Set by /api/check when the allowance is used up; only a hint:
// the API still answers every check, and a different answer replaces the card.
export const CHECK_USED_COOKIE = "chk_used";
export const CHECK_USED_MAX_AGE = 26 * 3_600;
/** "<utc day>|<market>:<side>": the check that used the allowance. */
export const checkUsedCookie = (marketId: string, side: number, now = Date.now()) => `${utcDay(now)}|${marketId}:${side}`;
/** True when today's allowance was used by a different market or side than the one being opened (re-opening that one is free). */
export function limitHinted(cookie: string | undefined | null, marketId: string | undefined, side: number, now = Date.now()): boolean {
  if (!cookie || !marketId) return false;
  const bar = cookie.indexOf("|");
  if (bar < 0 || cookie.slice(0, bar) !== utcDay(now)) return false;
  return cookie.slice(bar + 1) !== `${marketId}:${side}`;
}

/** A combo counts once, under this key: the sorted market:side list, so the same set in any order is the same check. */
export const comboKey = (legs: { m: string; side: number }[]): string =>
  `combo:${createHash("sha256").update(legs.map((l) => `${l.m}:${l.side}`).sort().join("|")).digest("hex").slice(0, 24)}`;
