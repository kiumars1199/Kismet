import { describe, expect, it } from "vitest";
import { REWARD_AT, emailDomain, evaluateInvite, ipHash, isInviteCode, newInviteCode, inviteUrl, type GuardInput } from "./core";

const NOW = Date.parse("2026-11-22T12:00:00Z");
const hrs = (h: number) => new Date(NOW - h * 3_600_000).toISOString();
const base = (over: Partial<GuardInput> = {}): GuardInput => ({
  inviter: { id: "u-inviter", email: "pat@inviter.test", ipHashes: ["h-inviter"] },
  invitee: { id: "u-new", email: "sam@friend.test", emailVerified: true, ipHash: "h-new" },
  siblings: [],
  now: NOW,
  ...over,
});

describe("evaluateInvite (self-referral guard)", () => {
  it("counts a clean, verified sign-up", () => {
    expect(evaluateInvite(base())).toEqual({ status: "verified" });
  });
  it("rejects the same account", () => {
    expect(evaluateInvite(base({ invitee: { id: "u-inviter", email: "other@x.test", emailVerified: true, ipHash: "h-new" } }))).toEqual({ status: "rejected", reason: "self" });
  });
  it("rejects the same email address under another account id", () => {
    expect(evaluateInvite(base({ invitee: { id: "u-new", email: "Pat@Inviter.test", emailVerified: true, ipHash: "h-new" } }))).toEqual({ status: "rejected", reason: "self" });
  });
  it("rejects a sign-up from one of the inviter's own sessions (same address hash)", () => {
    expect(evaluateInvite(base({ invitee: { id: "u-new", email: "sam@friend.test", emailVerified: true, ipHash: "h-inviter" } }))).toEqual({ status: "rejected", reason: "inviter_session" });
  });
  it("rejects a second sign-up from the same email domain and address within 24 hours", () => {
    const siblings = [{ email_domain: "friend.test", ip_hash: "h-new", created_at: hrs(23) }];
    expect(evaluateInvite(base({ siblings }))).toEqual({ status: "rejected", reason: "same_domain_and_ip_24h" });
  });
  it("counts the same domain and address once 24 hours have passed", () => {
    const siblings = [{ email_domain: "friend.test", ip_hash: "h-new", created_at: hrs(25) }];
    expect(evaluateInvite(base({ siblings })).status).toBe("verified");
  });
  it("counts the same domain from a different address, or the same address from a different domain", () => {
    expect(evaluateInvite(base({ siblings: [{ email_domain: "friend.test", ip_hash: "h-other", created_at: hrs(1) }] })).status).toBe("verified");
    expect(evaluateInvite(base({ siblings: [{ email_domain: "other.test", ip_hash: "h-new", created_at: hrs(1) }] })).status).toBe("verified");
  });
  it("leaves an unverified email pending, not counted", () => {
    expect(evaluateInvite(base({ invitee: { id: "u-new", email: "sam@friend.test", emailVerified: false, ipHash: "h-new" } }))).toEqual({ status: "pending" });
  });
  it("without an address hash (no salt configured) the address rules are skipped, the account rules still apply", () => {
    const noIp = { id: "u-new", email: "sam@friend.test", emailVerified: true, ipHash: null };
    expect(evaluateInvite(base({ invitee: noIp, siblings: [{ email_domain: "friend.test", ip_hash: null, created_at: hrs(1) }] })).status).toBe("verified");
    expect(evaluateInvite(base({ invitee: { ...noIp, id: "u-inviter" } }))).toEqual({ status: "rejected", reason: "self" });
  });
});

describe("invite codes, links and address hashes", () => {
  it("makes 8-character codes that pass isInviteCode, deterministic for a given rng", () => {
    const code = newInviteCode(() => 0.5);
    expect(code).toHaveLength(8);
    expect(isInviteCode(code)).toBe(true);
    expect(newInviteCode(() => 0.5)).toBe(code);
    expect(new Set(Array.from({ length: 50 }, () => newInviteCode())).size).toBe(50);
  });
  it("rejects malformed codes", () => {
    for (const bad of ["", "short", "UPPERCASE", "has space", "../../etc", "abcdefghi", "abc-defg"]) expect(isInviteCode(bad)).toBe(false);
  });
  it("builds the invite URL", () => {
    expect(inviteUrl("https://kismetodds.com", "abcd2345")).toBe("https://kismetodds.com/invite/abcd2345");
  });
  it("hashes an address with the salt; no salt means no hash; the address never appears", () => {
    const a = ipHash("203.0.113.7", "salt-one");
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(a).not.toContain("203");
    expect(ipHash("203.0.113.7", "salt-one")).toBe(a);
    expect(ipHash("203.0.113.7", "salt-two")).not.toBe(a);
    expect(ipHash("203.0.113.7", undefined)).toBeNull();
    expect(ipHash("", "salt-one")).toBeNull();
  });
  it("reads the email domain", () => {
    expect(emailDomain("Sam@Friend.TEST")).toBe("friend.test");
    expect(emailDomain(null)).toBeNull();
    expect(emailDomain("nope")).toBeNull();
  });
  it("rewards at 5", () => { expect(REWARD_AT).toBe(5); });
});
