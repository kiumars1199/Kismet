// T-45: server alert evaluator over a mocked Supabase + mocked email.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MarketsResponse } from "@/lib/api";
import type { Market, Side } from "@/lib/types";
import { fakeSupabase } from "./fakeSupabase";

const sendEmail = vi.fn(async (_e: { to: string; html: string; text: string; unsubscribeUrl: string }) => ({ sent: true }));
vi.mock("@/lib/email", async (orig) => ({ ...(await orig<typeof import("@/lib/email")>()), sendEmail: (e: never) => sendEmail(e) }));

// F10: never a real push. The sender is a mock; its result says what the push service answered.
type Sub = { endpoint: string; keys: { p256dh: string; auth: string } };
const sendPush = vi.fn(async (_s: Sub, _p: { title: string; body: string; url: string }): Promise<"sent" | "gone" | "failed"> => "sent");
let pushOn = true;
vi.mock("@/lib/alerts-push", () => ({ pushConfigured: () => pushOn, sendPush: (s: Sub, p: never) => sendPush(s, p) }));

const { runServerAlerts, webhookUrl } = await import("@/lib/alerts-server");

const side = (i: 0 | 1): Side => ({
  side_index: i, outcome: i ? "No" : "Jaguars", ask: 0.72, mid: 0.715, fee: 0.01, win_prob: 0.79, win_prob_low: 0.76,
  edge: 0.06, edge_low: 0.03, roi_pct: 7.2, model_level: "nmt", model_neff: 800, model_events: 190,
});
const market = (id: string): Market => ({
  id, question: `Q ${id}`, event: "E", event_id: "e", slug: "s", url: "u", tokens: ["1", "2"], category: "sports", niche: "nfl",
  market_type: "moneyline", tags: [], hours_to_close: 30, closes_at: 1795370400, horizon_h: 24, volume: 1, liquidity: 1, spread: 0.01,
  validated: true, backtest: null, sides: [side(0), side(1)], best: side(0),
});
const page = (ids: string[]): MarketsResponse =>
  ({ total: ids.length, page: 1, page_size: 50, pages: 1, rows: ids.map((id) => ({ market: market(id) as never, side: side(0) })), facets: {} as never });
const src = (ids = ["a"]) => ({
  fetchMarkets: async () => page(ids),
  fetchMarket: async (id: string) => market(id),
  fetchBook: async () => null,
});
const rule = (o: Record<string, unknown> = {}) => ({
  id: "r1", user_id: "u1", name: "Loose", enabled: true, kind: "preset_match", query: { v: 1 }, market_id: null, side_index: null,
  threshold: 1, channels: ["email"], webhook_url: null, cooldown_minutes: 60, quiet_hours: null, last_fired_at: null, created_at: "", ...o,
});
const db = (rules: Record<string, unknown>[], tier = "pro", tz = "UTC") => fakeSupabase({
  alert_rules: rules,
  profiles: [{ user_id: "u1", timezone: tz, odds_format: "cents" }],
  subscriptions: [{ user_id: "u1", tier }],
  alert_events: [], watchlist: [],
}, { u1: "trader@example.test" });
const NOON = new Date("2026-11-16T12:00:00Z");

beforeEach(() => { vi.stubEnv("UNSUBSCRIBE_SECRET", "test-secret"); sendEmail.mockClear(); sendPush.mockClear(); pushOn = true; });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("alerts cron (T-45)", () => {
  it("fires once, emails with a one-click unsubscribe link, and a second run is a no-op", async () => {
    const d = db([rule()]);
    const first = await runServerAlerts(d as never, src(), NOON);
    expect(first).toMatchObject({ users: 1, events: 1, emails: 1, errors: 0 });
    const mail = sendEmail.mock.calls[0]![0];
    expect(mail.to).toBe("trader@example.test");
    expect(mail.unsubscribeUrl).toMatch(/\/api\/unsubscribe\?t=/);
    expect(mail.html).toContain(mail.unsubscribeUrl.replace(/&/g, "&amp;"));
    expect(mail.text).toContain(mail.unsubscribeUrl);
    expect(d.tables.alert_events).toHaveLength(1);
    expect(d.tables.alert_events![0]).toMatchObject({ user_id: "u1", rule_id: "r1", market_id: "a", sent_channels: ["in_app", "email"] });
    expect(d.tables.alert_rules![0]!.last_fired_at).toBe(NOON.toISOString());

    const again = await runServerAlerts(d as never, src(), NOON);
    expect(again.events).toBe(0);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(d.tables.alert_events).toHaveLength(1);
  });

  it("dedupe_key stops a repeat in the same cooldown bucket even when memory is lost", async () => {
    const d = db([rule({ kind: "market_price", market_id: "a", side_index: 0, threshold: 0.8, channels: [] })]);
    const live = { ...src(), fetchBook: async () => ({ book_ok: true, best_ask: 0.7, net_edge: 0.05, fee_at_ask: 0.01 }) as never };
    expect((await runServerAlerts(d as never, live, NOON)).events).toBe(1);
    expect((await runServerAlerts(d as never, live, new Date(NOON.getTime() + 5 * 60_000))).events).toBe(0);
    expect(d.tables.alert_events).toHaveLength(1);
  });

  it("honors quiet hours in the user's timezone", async () => {
    const d = db([rule({ quiet_hours: [22, 7] })], "pro", "America/New_York");   // 12:00Z = 07:00 New York: awake
    const night = db([rule({ quiet_hours: [22, 8] })], "pro", "America/New_York"); // 07:00 is inside [22, 8)
    expect((await runServerAlerts(night as never, src(), NOON)).events).toBe(0);
    expect(sendEmail).not.toHaveBeenCalled();
    expect((await runServerAlerts(d as never, src(), NOON)).events).toBe(1);
  });

  it("skips disabled rules and free-tier users", async () => {
    expect((await runServerAlerts(db([rule({ enabled: false })]) as never, src(), NOON)).events).toBe(0);
    expect((await runServerAlerts(db([rule()], "free") as never, src(), NOON)).events).toBe(0);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("posts webhooks only for Premium and only to the allowed prefixes", async () => {
    const posts: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (u: string) => { posts.push(u); return new Response("{}", { status: 200 }); }));
    const hook = "https://discord.com/api/webhooks/1/abc";
    await runServerAlerts(db([rule({ channels: ["discord"], webhook_url: hook })], "pro") as never, src(), NOON);
    expect(posts).toEqual([]);
    const d = db([rule({ channels: ["discord"], webhook_url: hook })], "premium");
    const c = await runServerAlerts(d as never, src(), NOON);
    expect(posts).toEqual([hook]);
    expect(c.webhooks).toBe(1);
    expect(d.tables.alert_events![0]!.sent_channels).toEqual(["in_app", "discord"]);
    posts.length = 0;
    await runServerAlerts(db([rule({ channels: ["discord"], webhook_url: "https://evil.test/api/webhooks/x" })], "premium") as never, src(), NOON);
    expect(posts).toEqual([]);
    expect(webhookUrl("discord", "https://discord.com/api/webhooks/../../evil")).toBeNull();
    expect(webhookUrl("telegram", "https://api.telegram.org.evil.test/bot1/sendMessage")).toBeNull();
    expect(webhookUrl("telegram", "https://api.telegram.org/bot1:x/sendMessage?chat_id=5")).not.toBeNull();
  });

  describe("web push (F10)", () => {
    const subs = (n = 1) => Array.from({ length: n }, (_, i) => ({ id: `s${i}`, user_id: "u1", endpoint: `https://fcm.googleapis.com/fcm/send/${i}`, keys: { p256dh: "p", auth: "a" } }));
    const withSubs = (rules: Record<string, unknown>[], tier = "pro", n = 1) => {
      const d = db(rules, tier);
      d.tables.push_subscriptions = subs(n);
      return d;
    };

    it("sends one push per event to each of the user's devices, and a second run sends none", async () => {
      const d = withSubs([rule({ channels: ["push"] })], "pro", 2);
      const first = await runServerAlerts(d as never, src(), NOON);
      expect(first).toMatchObject({ events: 1, pushes: 1, errors: 0 });
      expect(sendPush).toHaveBeenCalledTimes(2);   // one event, two devices
      const body = sendPush.mock.calls[0]![1];
      expect(body.title).toBeTruthy();
      expect(body.url).toBe("/m/a");
      expect(`${body.title} ${body.body}`).not.toMatch(/\d¢|cents|bet this/i);
      expect(d.tables.alert_events![0]!.sent_channels).toEqual(["in_app", "push"]);
      sendPush.mockClear();
      expect((await runServerAlerts(d as never, src(), NOON)).pushes).toBe(0);
      expect((await runServerAlerts(d as never, src(), new Date(NOON.getTime() + 60_000))).pushes).toBe(0);
      expect(sendPush).not.toHaveBeenCalled();
      expect(d.tables.alert_events).toHaveLength(1);
    });

    it("email, push and in-app on one rule all go out once", async () => {
      const d = withSubs([rule({ channels: ["email", "push"] })], "premium");
      const c = await runServerAlerts(d as never, src(), NOON);
      expect(c).toMatchObject({ emails: 1, pushes: 1 });
      expect(d.tables.alert_events![0]!.sent_channels).toEqual(["in_app", "email", "push"]);
    });

    it("a rule without the push channel sends no push", async () => {
      const d = withSubs([rule({ channels: ["email"] })]);
      await runServerAlerts(d as never, src(), NOON);
      expect(sendPush).not.toHaveBeenCalled();
    });

    it("Free never gets a push, even with a stored subscription and a push rule", async () => {
      const d = withSubs([rule({ channels: ["push"] })], "free");
      expect((await runServerAlerts(d as never, src(), NOON)).pushes).toBe(0);
      expect(sendPush).not.toHaveBeenCalled();
    });

    it("VAPID keys not set: no send and push is not claimed", async () => {
      pushOn = false;
      const d = withSubs([rule({ channels: ["push"] })]);
      const c = await runServerAlerts(d as never, src(), NOON);
      expect(c).toMatchObject({ events: 1, pushes: 0, errors: 0 });
      expect(sendPush).not.toHaveBeenCalled();
      expect(d.tables.alert_events![0]!.sent_channels).toEqual(["in_app"]);
    });

    it("a gone subscription (404/410) is deleted; a failure is counted and never retried", async () => {
      const d = withSubs([rule({ channels: ["push"] })], "pro", 2);
      sendPush.mockImplementationOnce(async () => "gone").mockImplementationOnce(async () => "failed");
      const c = await runServerAlerts(d as never, src(), NOON);
      expect(c).toMatchObject({ events: 1, pushes: 0, errors: 1 });
      expect(d.tables.push_subscriptions!.map((s) => s.id)).toEqual(["s1"]);
      expect(d.tables.alert_events![0]!.sent_channels).toEqual(["in_app"]);
      sendPush.mockClear();
      await runServerAlerts(d as never, src(), NOON);
      expect(sendPush).not.toHaveBeenCalled();
    });

    it("a user with no device gets the in-app event only", async () => {
      const d = db([rule({ channels: ["push"] })], "pro");
      expect(await runServerAlerts(d as never, src(), NOON)).toMatchObject({ events: 1, pushes: 0, errors: 0 });
      expect(d.tables.alert_events![0]!.sent_channels).toEqual(["in_app"]);
    });
  });

  describe("settled alerts (F10)", () => {
    const priced = rule({ id: "p1", kind: "market_price", market_id: "a", side_index: 0, threshold: 0.5, channels: [] });
    const settledRule = (o: Record<string, unknown> = {}) => rule({ id: "s1", kind: "settled", market_id: null, query: null, threshold: null, channels: ["push"], ...o });
    const closed = { fetchMarket: async () => null };
    const settle = (resolved: boolean, winner: 0 | 1 | null = 0) => vi.fn(async () => ({ resolved, winner_side_index: winner, closing_prices: [null, null] as [null, null] }));
    const withSubs = (rules: Record<string, unknown>[], tier = "pro") => {
      const d = db(rules, tier);
      d.tables.push_subscriptions = [{ id: "s0", user_id: "u1", endpoint: "https://fcm.googleapis.com/fcm/send/0", keys: { p256dh: "p", auth: "a" } }];
      return d;
    };

    it("fires once when a market the user has a rule on resolves, then never again", async () => {
      const d = withSubs([priced, settledRule()]);
      const fetchSettlement = settle(true, 0);
      const s = { ...src(), fetchSettlement };
      const first = await runServerAlerts(d as never, s, NOON);
      expect(first).toMatchObject({ events: 1, pushes: 1, errors: 0 });
      const ev = d.tables.alert_events![0]!;
      expect(ev).toMatchObject({ rule_id: "s1", market_id: "a", sent_channels: ["in_app", "push"] });
      expect((ev.payload as { message: string }).message).toMatch(/Jaguars/);
      // later runs, even past the rule's cooldown, stay silent
      sendPush.mockClear();
      const later = await runServerAlerts(d as never, s, new Date(NOON.getTime() + 3 * 3600_000));
      expect(later.events).toBe(0);
      expect(sendPush).not.toHaveBeenCalled();
    });

    it("stays quiet while the market is open", async () => {
      const d = withSubs([priced, settledRule()]);
      expect((await runServerAlerts(d as never, { ...src(), fetchSettlement: settle(false) }, NOON)).events).toBe(0);
    });

    it("a rule bound to one market watches that market only", async () => {
      const d = withSubs([settledRule({ market_id: "zzz" })]);
      const fetchSettlement = settle(true);
      await runServerAlerts(d as never, { ...src(), fetchSettlement }, NOON);
      expect(fetchSettlement).toHaveBeenCalledWith("zzz");
      expect(d.tables.alert_events![0]!.market_id).toBe("zzz");
    });

    it("works when the market has already left the live data (no title) and says no winner for a void", async () => {
      const d = withSubs([priced, settledRule()]);
      await runServerAlerts(d as never, { ...closed, fetchMarkets: src().fetchMarkets, fetchBook: src().fetchBook, fetchSettlement: settle(true, null) }, NOON);
      const p = d.tables.alert_events![0]!.payload as { title: string; message: string };
      expect(p.title).toBeTruthy();
      expect(p.message).toMatch(/no winner/i);
    });

    it("Free never gets it", async () => {
      const d = withSubs([priced, settledRule()], "free");
      expect((await runServerAlerts(d as never, { ...src(), fetchSettlement: settle(true) }, NOON)).events).toBe(0);
    });
  });
});
