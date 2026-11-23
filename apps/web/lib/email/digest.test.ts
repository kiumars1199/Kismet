// F12: morning digest. Rendered email (no cents, disclaimer, unsubscribe link and header, <= 5 bets), the run (opted-in
// users only, same bets for the same topics, once a day, nothing when no bets), the cron route and the opt-out.
// Resend is a fake send: nothing leaves the process.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DISCLAIMER } from "./templates";
import { digestEmail, MAX_DIGEST_BETS, type DigestBet } from "./digest-templates";
import { runDigest, topicsKey, type DigestDeps, type DigestUser } from "./digest";
import { digestBets } from "./digest-bets";
import { getStore, getStoreFor } from "@/lib/data/store";
import { freeSample } from "@/lib/data/respond";
import { freeView } from "@/lib/data/gate";
import { betFigures } from "@/lib/betFigures";
import { sendEmail, unsubscribeToken, verifyUnsubscribe } from "./index";
import { GET as digestRun } from "@/app/api/digest/run/route";
import { POST as unsubPost } from "@/app/api/unsubscribe/route";

const bet = (i: number): DigestBet => ({ id: `m${i}`, title: `NFL · Game ${i} <b>`, outcome: i % 2 ? "Jaguars" : "Yes", ask: 0.66, fee: 0.02, win_prob: 0.79, side_index: 0, closes_at: 1795370400 });
const NOW = Date.parse("2026-11-23T12:07:00Z");
const UNSUB = "https://kismet.test/api/unsubscribe?t=abc.def";

beforeEach(() => { vi.stubEnv("UNSUBSCRIBE_SECRET", "test-secret"); vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://kismet.test"); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("digestEmail", () => {
  const e = digestEmail({ to: "a@example.test", bets: Array.from({ length: 9 }, (_, i) => bet(i)), unsubscribeUrl: UNSUB, now: NOW, timeZone: "UTC" });
  it("shows at most 5 bets", () => {
    expect(MAX_DIGEST_BETS).toBe(5);
    expect((e.html.match(/Open in Kismet/g) ?? []).length).toBe(5);
    expect(e.text).not.toContain("Game 5");
  });
  it("uses multipliers and percentages, never cents or dollars-and-cents", () => {
    for (const s of [e.html, e.text, e.subject]) {
      expect(s).not.toMatch(/\d\s?¢|\$\d+\.\d{2}|cents/i);
    }
    expect(e.text).toContain("1.47x");   // 1 / (0.66 + 0.02): after the fee, never the bare price (1 / 0.66 = 1.52x)
    expect(e.text).not.toContain("1.52x");
    expect(e.text).toContain("79%");
  });
  it("carries the disclaimer, the unsubscribe link in body and header, and escapes titles", () => {
    expect(e.html).toContain(DISCLAIMER);
    expect(e.text).toContain(DISCLAIMER);
    expect(e.unsubscribeUrl).toBe(UNSUB);
    expect(e.html).toContain(UNSUB);
    expect(e.text).toContain(UNSUB);
    expect(e.html).not.toContain("<b>");
  });
  it("never says bet this / guarantees", () => {
    expect(e.html + e.text).not.toMatch(/guarantee|sure thing|can'?t lose|risk[- ]free|bet this|\bpick\b/i);
  });
});

const users: DigestUser[] = [
  { user_id: "u1", email: "one@example.test", topics: ["sports.nfl"], tier: "pro" },
  { user_id: "u2", email: "two@example.test", topics: ["sports.nfl"], tier: "premium" },
  { user_id: "u3", email: "three@example.test", topics: ["crypto.bitcoin"], tier: "pro" },
  { user_id: "u4", email: "four@example.test", topics: [], tier: "pro" },
];
function deps(over: Partial<DigestDeps> = {}) {
  const sent: { to: string; text: string }[] = [];
  const claimed = new Set<string>();
  const betsFor = vi.fn(async (topics: string[], _u: DigestUser) => (topics[0] === "crypto.bitcoin" ? [] : [bet(1), bet(2)]));
  const d: DigestDeps = {
    users: async () => users,
    betsFor,
    claim: async (u, day) => (claimed.has(`${u}|${day}`) ? false : (claimed.add(`${u}|${day}`), true)),
    release: async (u, day) => void claimed.delete(`${u}|${day}`),
    send: async (m) => (sent.push({ to: m.to, text: m.text }), { sent: true }),
    unsubscribe: (u) => `https://kismet.test/api/unsubscribe?t=${u}`,
    timeZone: "UTC",
    ...over,
  };
  return { d, sent, betsFor };
}

describe("runDigest", () => {
  it("builds the bets once per topic set and sends the same bets to everyone with those topics", async () => {
    const { d, sent, betsFor } = deps();
    const r = await runDigest(d, NOW);
    expect(betsFor).toHaveBeenCalledTimes(3);   // nfl, bitcoin, (none)
    expect(sent.map((s) => s.to)).toEqual(["one@example.test", "two@example.test", "four@example.test"]);
    const body = (t: string) => t.split("\n").filter((l) => !l.includes("api/unsubscribe")).join("\n");
    expect(body(sent[0]!.text)).toBe(body(sent[1]!.text));   // same bets; only the personal unsubscribe link differs
    expect(r).toEqual({ users: 4, sent: 3, skipped_no_bets: 1, skipped_paused: 0, failed: 0 });
  });
  it("sends a user at most once a day, and retries after a failed send", async () => {
    const { d, sent } = deps();
    await runDigest(d, NOW);
    await runDigest(d, NOW);
    expect(sent).toHaveLength(3);
    let fail = true;
    const b = deps({ send: async (m) => { if (fail) throw new Error("boom"); b.sent.push({ to: m.to, text: m.text }); return { sent: true }; } });
    expect((await runDigest(b.d, NOW)).failed).toBe(3);
    fail = false;
    expect((await runDigest(b.d, NOW)).sent).toBe(3);
  });
  it("does not send when email is switched off (send returns sent: false) and releases the claim", async () => {
    const { d } = deps({ send: async () => ({ sent: false }) });
    expect((await runDigest(d, NOW)).sent).toBe(0);
    expect((await runDigest(d, NOW)).users).toBe(4);
  });
  it("skips a user whose pause is still running; sends again once it has ended", async () => {
    const paused = [
      { ...users[0]!, paused_until: new Date(NOW + 3_600_000).toISOString() },   // ends in an hour
      { ...users[1]!, paused_until: new Date(NOW - 3_600_000).toISOString() },   // ended an hour ago
      { ...users[3]!, paused_until: null },
    ];
    const { d, sent } = deps({ users: async () => paused });
    const r = await runDigest(d, NOW);
    expect(sent.map((s) => s.to)).toEqual(["two@example.test", "four@example.test"]);
    expect(r).toMatchObject({ users: 3, sent: 2, skipped_paused: 1 });
  });
  it("Free users get their own list (asked per user); paid users share one per topic set", async () => {
    const two = [{ ...users[0]!, user_id: "f1", tier: "free" as const }, { ...users[0]!, user_id: "f2", email: "f2@example.test", tier: "free" as const }, users[1]!, { ...users[0]! }];
    const { d, betsFor } = deps({ users: async () => two });
    await runDigest(d, NOW);
    expect(betsFor.mock.calls.filter(([, u]) => u.tier === "free").map(([, u]) => u.user_id)).toEqual(["f1", "f2"]);
    expect(betsFor.mock.calls.filter(([, u]) => u.tier !== "free")).toHaveLength(1);   // pro + premium + pro, same topics: built once
  });
  it("topicsKey ignores order and duplicates", () => {
    expect(topicsKey(["b", "a", "a"])).toBe(topicsKey(["a", "b"]));
  });
});

describe("cron route and opt-out", () => {
  it("refuses a request without the cron secret", async () => {
    vi.stubEnv("CRON_SECRET", "s");
    expect((await digestRun(new Request("https://x.test/api/digest/run"))).status).toBe(401);
  });
  it("the cron reaches the route through the middleware: signed out + right secret runs, no secret is 401", async () => {
    vi.stubEnv("CRON_SECRET", "s");
    const { signedOutAccess } = await import("@/lib/auth/public-paths");
    expect(signedOutAccess("/api/digest/run")).toBe("public");   // the middleware lets the cron through (a bare 401 wall means nothing is ever sent)
    const ok = await digestRun(new Request("https://x.test/api/digest/run", { headers: { authorization: "Bearer s" } }));
    expect(ok.status).toBe(200);
    expect((await ok.json()).ran).toBe(false);   // reached the handler (no Supabase service role in this test)
    expect((await digestRun(new Request("https://x.test/api/digest/run", { headers: { authorization: "Bearer wrong" } }))).status).toBe(401);
  });
  it("the digest unsubscribe token verifies as a digest token and the general one does not", () => {
    const t = unsubscribeToken("u1", undefined, "test-secret", NOW, "digest");
    expect(verifyUnsubscribe(t, "test-secret", NOW)).toMatchObject({ u: "u1", k: "digest" });
    expect(verifyUnsubscribe(unsubscribeToken("u1", undefined, "test-secret", NOW), "test-secret", NOW)?.k).toBeUndefined();
  });
  it("POST /api/unsubscribe with a digest token turns the digest off for that user only", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://db.test");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "svc");
    const calls: { url: string; method: string; body?: string }[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url: String(url), method: init?.method ?? "GET", body: init?.body as string | undefined });
      return new Response("[]", { status: 200 });
    }));
    const t = unsubscribeToken("u1", undefined, "test-secret", Date.now(), "digest");
    const res = await unsubPost(new Request(`https://kismet.test/api/unsubscribe?t=${t}`, { method: "POST" }));
    expect(res.status).toBe(200);
    const patch = calls.find((c) => c.method === "PATCH")!;
    expect(patch.url).toContain("/rest/v1/profiles?user_id=eq.u1");
    expect(JSON.parse(patch.body!)).toEqual({ digest_opt_in: false });
    expect(calls.some((c) => c.url.includes("alert_rules"))).toBe(false);
    expect(typeof sendEmail).toBe("function");
  });
});

describe("digestBets: the same numbers and the same bets the site shows", () => {
  it("the payout is the site's after-the-fee text: 6674492 reads 1.45x, as on /m", async () => {
    const live = await getStore();
    const m = live.byId.get("6674492")!;
    const drawer = betFigures(m.best, { market: m }).pays;   // what /m/6674492 shows for the recommended side
    expect(drawer).toBe("1.45x");
    const bets = await digestBets({ live, free: live }, "premium", "u-paid", []);
    const found = bets.find((b) => b.id === "6674492");
    if (found) expect(found.pays).toBe(drawer);
    // a bet built from that market renders the same text in the email
    const e = digestEmail({ to: "a@example.test", bets: [{ id: m.id, title: "T", outcome: m.best.outcome, ask: m.best.ask, fee: m.best.fee ?? null, pays: drawer, win_prob: m.best.win_prob, side_index: m.best.side_index as 0 | 1, closes_at: m.closes_at }], unsubscribeUrl: UNSUB, now: NOW, timeZone: "UTC" });
    expect(e.text).toContain("pays 1.45x");
    expect(e.text).not.toContain(`pays ${(1 / m.best.ask).toFixed(2)}x`);   // not the bare price
  });
  it("a Free digest holds only ids from that user's Free sample for the day; paid users get the live top bets", async () => {
    const live = await getStore();
    const free = await getStoreFor("free");
    const sample = freeSample(freeView(free), "u:free-user-1");
    const bets = await digestBets({ live, free }, "free", "free-user-1", []);
    expect(bets.length).toBeGreaterThan(0);
    for (const b of bets) expect(sample.has(b.id), b.id).toBe(true);
    const other = await digestBets({ live, free }, "free", "free-user-2", []);
    for (const b of other) expect(freeSample(freeView(free), "u:free-user-2").has(b.id)).toBe(true);
    const paid = await digestBets({ live, free }, "pro", "paid-user", []);
    expect(paid.length).toBe(5);
    expect(paid.some((b) => !sample.has(b.id))).toBe(true);   // the live top 5 is not limited to the Free sample
  });
});
