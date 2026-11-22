import { describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "@/test/fakeSupabase";
import { getOrCreateCode, inviteProgress, recordInviterIp, recordSignup } from "./server";
import { isInviteCode } from "./core";

const NOW = Date.parse("2026-11-22T12:00:00Z");
const emails = { inv: "pat@inviter.test", a: "a@one.test", b: "b@two.test", c: "c@three.test", d: "d@four.test", e: "e@five.test", f: "f@six.test" };

function setup() {
  const t = fakeSupabase({ invite_codes: [{ user_id: "inv", code: "abcd2345", ip_hashes: ["h-inv"] }], invites: [], invite_rewards: [] }, emails);
  const rpc = vi.fn(async () => ({ data: { granted: true }, error: null }));
  return { db: { ...t, rpc } as never, t, rpc };
}
const signup = (db: never, id: string, ip: string | null, verified = true) =>
  recordSignup(db, { user: { id, email: emails[id as keyof typeof emails], email_confirmed_at: verified ? "2026-11-22T11:00:00Z" : null }, code: "abcd2345", ipHash: ip, now: NOW });

describe("invite codes", () => {
  it("creates one code per user and returns the same one after", async () => {
    const t = fakeSupabase({ invite_codes: [] });
    const a = await getOrCreateCode(t as never, "u1");
    expect(isInviteCode(a)).toBe(true);
    expect(await getOrCreateCode(t as never, "u1")).toBe(a);
    expect(t.tables.invite_codes).toHaveLength(1);
  });
  it("keeps the owner's last 5 distinct address hashes", async () => {
    const t = fakeSupabase({ invite_codes: [{ user_id: "u1", code: "abcd2345", ip_hashes: ["1", "2", "3", "4", "5"] }] });
    await recordInviterIp(t as never, "u1", "6");
    await recordInviterIp(t as never, "u1", "6");
    expect(t.tables.invite_codes![0]!.ip_hashes).toEqual(["2", "3", "4", "5", "6"]);
  });
});

describe("recordSignup", () => {
  it("counts verified sign-ups and asks for the reward each time one lands", async () => {
    const { db, t, rpc } = setup();
    for (const id of ["a", "b", "c", "d", "e"]) expect(await signup(db, id, `h-${id}`)).toEqual({ status: "verified" });
    expect(t.tables.invites!.filter((r) => r.status === "verified")).toHaveLength(5);
    expect(rpc).toHaveBeenCalledTimes(5);
    expect(rpc).toHaveBeenLastCalledWith("grant_invite_reward", { p_inviter: "inv" });
  });
  it("an account counts once", async () => {
    const { db, t } = setup();
    await signup(db, "a", "h-a");
    await signup(db, "a", "h-a");
    expect(t.tables.invites).toHaveLength(1);
  });
  it("a sign-up from the inviter's own address is stored as rejected and never triggers the reward", async () => {
    const { db, t, rpc } = setup();
    expect(await signup(db, "a", "h-inv")).toEqual({ status: "rejected", reason: "inviter_session" });
    expect(t.tables.invites![0]).toMatchObject({ status: "rejected", reject_reason: "inviter_session" });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("two sign-ups from the same domain and address within 24 hours: the second is rejected", async () => {
    const { db } = setup();
    emails.b = "b@one.test";   // same domain as a
    try {
      expect((await signup(db, "a", "h-x"))?.status).toBe("verified");
      expect(await signup(db, "b", "h-x")).toEqual({ status: "rejected", reason: "same_domain_and_ip_24h" });
    } finally { emails.b = "b@two.test"; }
  });
  it("an unverified email is stored pending and doesn't count or reward", async () => {
    const { db, t, rpc } = setup();
    expect(await signup(db, "a", "h-a", false)).toEqual({ status: "pending" });
    expect(t.tables.invites![0]!.status).toBe("pending");
    expect(rpc).not.toHaveBeenCalled();
  });
  it("an unknown code does nothing", async () => {
    const { db, t } = setup();
    expect(await recordSignup(db, { user: { id: "a", email: emails.a, email_confirmed_at: "x" }, code: "zzzzzzzz", ipHash: null, now: NOW })).toBeNull();
    expect(t.tables.invites).toHaveLength(0);
  });
});

describe("inviteProgress", () => {
  it("reports verified count out of 5 and the reward", async () => {
    const { db, t } = setup();
    for (const id of ["a", "b", "c"]) await signup(db, id, `h-${id}`);
    expect(await inviteProgress(db, "inv")).toEqual({ verified: 3, target: 5, rewarded: false, comp_until: null });
    t.tables.invite_rewards!.push({ inviter_id: "inv", outcome: "granted", comp_until: "2026-12-22T00:00:00Z" });
    expect(await inviteProgress(db, "inv")).toMatchObject({ rewarded: true, comp_until: "2026-12-22T00:00:00Z" });
  });
});
