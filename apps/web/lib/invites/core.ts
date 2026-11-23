// F13 invites, the pure parts: codes, links, salted address hashes and the self-referral guard. Server wiring is in
// lib/invites/server.ts; the tables and the reward are in supabase/migrations/20261122000200_invites.sql.
import { createHmac } from "node:crypto";

export const REWARD_AT = 5;          // verified sign-ups for the reward
export const REWARD_DAYS = 30;       // Premium comp (stacks onto an existing comp end date)
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";   // no 0/o/1/l/i: easy to read out loud
const CODE = /^[a-z0-9]{8}$/;

export const isInviteCode = (s: string): boolean => CODE.test(s);
export function newInviteCode(rng: () => number = () => crypto.getRandomValues(new Uint32Array(1))[0]! / 2 ** 32): string {
  return Array.from({ length: 8 }, () => ALPHABET[Math.floor(rng() * ALPHABET.length)]).join("");
}
export const inviteUrl = (origin: string, code: string) => `${origin.replace(/\/$/, "")}/invite/${code}`;

export function emailDomain(email: string | null | undefined): string | null {
  const m = /^[^@\s]+@([^@\s]+)$/.exec((email ?? "").trim().toLowerCase());
  return m ? m[1]! : null;
}

/** Salted, one-way hash of an address (salt: INVITE_IP_SALT). The address itself is never stored. null = can't hash. */
export function ipHash(ip: string | null | undefined, salt: string | undefined): string | null {
  if (!ip || !salt) return null;
  return createHmac("sha256", salt).update(ip).digest("hex").slice(0, 32);
}

export interface GuardInput {
  inviter: { id: string; email: string | null; ipHashes: string[] };
  invitee: { id: string; email: string | null; emailVerified: boolean; ipHash: string | null };
  /** The inviter's other sign-ups (any status except rejected): domain and address hash with their time. */
  siblings: { email_domain: string | null; ip_hash: string | null; created_at: string }[];
  now: number;
}
export type GuardResult = { status: "verified" | "pending" } | { status: "rejected"; reason: "self" | "inviter_session" | "same_domain_and_ip_24h" };

const DAY = 24 * 3_600_000;

/** Whether a sign-up from an invite link counts toward the reward.
 *  Never counts: the inviter's own account or email; a sign-up from an address the inviter has used (their own
 *  sessions); a second sign-up from the same email domain and the same address within 24 hours of another.
 *  Counts only once the email is verified. */
export function evaluateInvite({ inviter, invitee, siblings, now }: GuardInput): GuardResult {
  const mine = (inviter.email ?? "").trim().toLowerCase();
  const theirs = (invitee.email ?? "").trim().toLowerCase();
  if (invitee.id === inviter.id || (mine && mine === theirs)) return { status: "rejected", reason: "self" };
  if (invitee.ipHash && inviter.ipHashes.includes(invitee.ipHash)) return { status: "rejected", reason: "inviter_session" };
  const domain = emailDomain(invitee.email);
  if (invitee.ipHash && domain && siblings.some((s) => s.ip_hash === invitee.ipHash && s.email_domain === domain && now - Date.parse(s.created_at) < DAY)) {
    return { status: "rejected", reason: "same_domain_and_ip_24h" };
  }
  return { status: invitee.emailVerified ? "verified" : "pending" };
}
