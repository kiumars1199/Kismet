import "server-only";
// F13 invites, server side (service role): the user's code, recording a sign-up that came from a link, the
// progress counter. Every function takes the client so tests can pass the fake. Never throws into sign-in:
// callers wrap recordSignup in try/catch.
import type { SupabaseClient } from "@supabase/supabase-js";
import { REWARD_AT, emailDomain, evaluateInvite, isInviteCode, newInviteCode, type GuardResult } from "./core";

type Db = Pick<SupabaseClient, "from" | "rpc" | "auth">;
const first = async <T,>(q: PromiseLike<{ data: unknown }>): Promise<T | null> => (((await q).data as T[] | null) ?? [])[0] ?? null;

/** The user's invite code, created on first use. */
export async function getOrCreateCode(db: Pick<SupabaseClient, "from">, userId: string): Promise<string> {
  const have = await first<{ code: string }>(db.from("invite_codes").select("code").eq("user_id", userId).limit(1));
  if (have) return have.code;
  for (let i = 0; i < 5; i++) {
    const code = newInviteCode();
    const { error } = await db.from("invite_codes").insert({ user_id: userId, code });
    if (!error) return code;
    if (error.code !== "23505") throw new Error(error.message);
    const raced = await first<{ code: string }>(db.from("invite_codes").select("code").eq("user_id", userId).limit(1));   // a parallel call won
    if (raced) return raced.code;
  }
  throw new Error("could not create an invite code");
}

/** Remember an address hash the owner used (last 5): a sign-up from one of them is the owner's own session. */
export async function recordInviterIp(db: Pick<SupabaseClient, "from">, userId: string, hash: string | null): Promise<void> {
  if (!hash) return;
  const row = await first<{ ip_hashes: string[] }>(db.from("invite_codes").select("ip_hashes").eq("user_id", userId).limit(1));
  if (!row) return;
  const next = [...row.ip_hashes.filter((h) => h !== hash), hash].slice(-5);
  await db.from("invite_codes").update({ ip_hashes: next }).eq("user_id", userId);
}

export interface Progress { verified: number; target: number; rewarded: boolean; comp_until: string | null }

export async function inviteProgress(db: Pick<SupabaseClient, "from">, userId: string): Promise<Progress> {
  const { data } = await db.from("invites").select("status").eq("inviter_id", userId).eq("status", "verified");
  const reward = await first<{ outcome: string; comp_until: string | null }>(db.from("invite_rewards").select("outcome, comp_until").eq("inviter_id", userId).limit(1));
  return { verified: (data as unknown[] | null)?.length ?? 0, target: REWARD_AT, rewarded: reward?.outcome === "granted", comp_until: reward?.outcome === "granted" ? reward.comp_until : null };
}

/** A new account arrived through `code`. Stores the row (verified, pending or rejected with a reason) and, when it
 *  counts, asks the database for the reward (it grants once at 5). null = no such code or already recorded. */
export async function recordSignup(
  db: Db,
  a: { user: { id: string; email?: string | null; email_confirmed_at?: string | null }; code: string; ipHash: string | null; now?: number },
): Promise<GuardResult | null> {
  if (!isInviteCode(a.code)) return null;
  const owner = await first<{ user_id: string; ip_hashes: string[] }>(db.from("invite_codes").select("user_id, ip_hashes").eq("code", a.code).limit(1));
  if (!owner) return null;
  const seen = await first<{ id: string }>(db.from("invites").select("id").eq("invitee_id", a.user.id).limit(1));
  if (seen) return null;

  const { data: inviterUser } = await db.auth.admin.getUserById(owner.user_id);
  const { data: rows } = await db.from("invites").select("email_domain, ip_hash, created_at, status").eq("inviter_id", owner.user_id);
  const siblings = ((rows ?? []) as { email_domain: string | null; ip_hash: string | null; created_at: string; status: string }[]).filter((r) => r.status !== "rejected");
  const now = a.now ?? Date.now();
  const result = evaluateInvite({
    inviter: { id: owner.user_id, email: inviterUser?.user?.email ?? null, ipHashes: owner.ip_hashes ?? [] },
    invitee: { id: a.user.id, email: a.user.email ?? null, emailVerified: !!a.user.email_confirmed_at, ipHash: a.ipHash },
    siblings, now,
  });
  const { error } = await db.from("invites").insert({
    inviter_id: owner.user_id, invitee_id: a.user.id, code: a.code, ip_hash: a.ipHash, email_domain: emailDomain(a.user.email),
    status: result.status, reject_reason: result.status === "rejected" ? result.reason : null,
    created_at: new Date(now).toISOString(), verified_at: result.status === "verified" ? new Date(now).toISOString() : null,
  });
  if (error) return null;   // lost a race to the unique invitee_id: already recorded
  if (result.status === "verified") await db.rpc("grant_invite_reward", { p_inviter: owner.user_id });
  return result;
}

/** Run on every sign-in (not just the first): (1) an invite recorded as "pending" because the invitee's email wasn't
 *  confirmed yet becomes "verified" once it is, and asks for the inviter's reward; (2) a user with an invite code asks
 *  again for their own reward, which a trial or paid Premium put off until they were eligible. Both are cheap no-ops
 *  when there is nothing to do. */
export async function settleInvites(
  db: Pick<SupabaseClient, "from" | "rpc">,
  user: { id: string; email_confirmed_at?: string | null },
  now: number = Date.now(),
): Promise<void> {
  if (user.email_confirmed_at) {
    const row = await first<{ id: string; inviter_id: string }>(db.from("invites").select("id, inviter_id").eq("invitee_id", user.id).eq("status", "pending").limit(1));
    if (row) {
      const { error } = await db.from("invites").update({ status: "verified", verified_at: new Date(now).toISOString() }).eq("id", row.id).eq("status", "pending");
      if (!error) await db.rpc("grant_invite_reward", { p_inviter: row.inviter_id });
    }
  }
  const own = await first<{ user_id: string }>(db.from("invite_codes").select("user_id").eq("user_id", user.id).limit(1));
  if (own) await db.rpc("grant_invite_reward", { p_inviter: user.id });
}
