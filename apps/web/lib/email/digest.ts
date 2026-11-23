// F12: morning digest run (cron: /api/digest/run, daily). Opted-in users only (profiles.digest_opt_in, default off).
// The bets are the same flags for everyone: computed once per topic set from the user's own chosen topics, never from
// their positions. One email per user per UTC day (digest_emails claim, released if the send fails).
// Pure over injected deps so tests use a fake send; the route wires Supabase + the existing sendEmail.
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { digestEmail, MAX_DIGEST_BETS, type DigestBet } from "./digest-templates";
import { digestUnsubscribeUrl, sendEmail, type Email } from "./index";

export interface DigestUser { user_id: string; email: string; topics: string[] }
export interface DigestDeps {
  users: () => Promise<DigestUser[]>;
  /** Top flags for a topic set (empty = no topic filter), already limited to MAX_DIGEST_BETS. */
  betsFor: (topics: string[]) => Promise<DigestBet[]>;
  claim: (userId: string, day: string) => Promise<boolean>;
  release: (userId: string, day: string) => Promise<void>;
  send: (e: Email) => Promise<{ sent: boolean }>;
  unsubscribe: (userId: string) => string;
  timeZone?: string;
}

export const topicsKey = (topics: string[]) => [...new Set(topics)].sort().join("|");

export async function runDigest(deps: DigestDeps, now = Date.now()): Promise<{ users: number; sent: number; skipped_no_bets: number; failed: number }> {
  const users = await deps.users();
  const day = new Date(now).toISOString().slice(0, 10);
  const cache = new Map<string, Promise<DigestBet[]>>();
  const betsOf = (topics: string[]) => {
    const k = topicsKey(topics);
    if (!cache.has(k)) cache.set(k, deps.betsFor([...new Set(topics)].sort()).then((b) => b.slice(0, MAX_DIGEST_BETS)));
    return cache.get(k)!;
  };
  let sent = 0, skipped = 0, failed = 0;
  for (const u of users) {
    try {
      const bets = await betsOf(u.topics);
      if (!bets.length) { skipped++; continue; }   // nothing to say today: no empty email
      if (!(await deps.claim(u.user_id, day))) continue;
      try {
        if ((await deps.send(digestEmail({ to: u.email, bets, unsubscribeUrl: deps.unsubscribe(u.user_id), now, timeZone: deps.timeZone }))).sent) { sent++; continue; }
      } catch (e) {
        await deps.release(u.user_id, day).catch(() => {});
        throw e;
      }
      await deps.release(u.user_id, day).catch(() => {});   // email not configured: a later run can send
    } catch (e) {
      failed++;
      console.error("[digest] send failed:", e instanceof Error ? e.message : e);
    }
  }
  return { users: users.length, sent, skipped_no_bets: skipped, failed };
}

/** digest_emails (supabase/migrations/20261122000400_digest.sql): service role only. */
export function supabaseDigestClaims(db: SupabaseClient) {
  return {
    claim: async (user_id: string, day: string) => {
      const { data, error } = await db.from("digest_emails").upsert({ user_id, day }, { onConflict: "user_id,day", ignoreDuplicates: true }).select("day");
      if (error) throw new Error(`digest_emails: ${error.message}`);   // migration not applied: send nothing
      return (data?.length ?? 0) > 0;
    },
    release: async (user_id: string, day: string) => { await db.from("digest_emails").delete().eq("user_id", user_id).eq("day", day); },
  };
}

export const defaultSend = sendEmail;
export const defaultUnsubscribe = digestUnsubscribeUrl;
