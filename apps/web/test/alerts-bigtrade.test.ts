// F16: a single trade of $10,000 or more on a market a Premium user follows gives that user one alert. Free and Pro never.
// No network: the trade feed is a mock here, and lib/bigtrade.ts is tested against a mocked fetch with the documented row shape.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MarketsResponse } from "@/lib/api";
import type { Market, Side } from "@/lib/types";
import { fakeSupabase } from "./fakeSupabase";

vi.mock("@/lib/email", async (orig) => ({ ...(await orig<typeof import("@/lib/email")>()), sendEmail: async () => ({ sent: true }) }));
const sendPush = vi.fn(async (): Promise<"sent" | "gone" | "failed"> => "sent");
vi.mock("@/lib/alerts-push", () => ({ pushConfigured: () => true, sendPush: () => sendPush() }));

const { runServerAlerts } = await import("@/lib/alerts-server");
const { BIG_TRADE_USD, fetchBigTrades, parseTrades } = await import("@/lib/bigtrade");

const side = (i: 0 | 1): Side => ({
  side_index: i, outcome: i ? "No" : "Jaguars", ask: 0.72, mid: 0.715, fee: 0.01, win_prob: 0.79, win_prob_low: 0.76,
  edge: 0.06, edge_low: 0.03, roi_pct: 7.2, model_level: "nmt", model_neff: 800, model_events: 190,
});
const market = (id: string): Market => ({
  id, question: `Q ${id}`, event: "E", event_id: "ev1", slug: "s", url: "u", tokens: ["tok0", "tok1"], category: "sports", niche: "nfl",
  market_type: "moneyline", tags: [], hours_to_close: 30, closes_at: 1795370400, horizon_h: 24, volume: 1, liquidity: 1, spread: 0.01,
  validated: true, backtest: null, sides: [side(0), side(1)], best: side(0),
});
const page = (): MarketsResponse => ({ total: 0, page: 1, page_size: 50, pages: 1, rows: [], facets: {} as never });
const NOON = new Date("2026-11-16T12:00:00Z");
const tsNow = Math.floor(NOON.getTime() / 1000);

const trade = (o: Record<string, unknown> = {}) => ({
  proxy_wallet: "0xabc", side: "BUY", size: 20_000, price: 0.62, timestamp: tsNow - 3600, transaction_hash: "0xhash1",
  condition_id: "0xcond", outcome: "Jaguars", outcome_index: 0, token_id: "tok0", ...o,
});
const src = (trades: ReturnType<typeof trade>[]) => {
  const fetchBigTrades = vi.fn(async () => parseTrades({ data: trades, pagination: { next_cursor: null } }));
  return { fetchMarkets: async () => page(), fetchMarket: async (id: string) => market(id), fetchBook: async () => null, fetchBigTrades };
};
const rule = (o: Record<string, unknown> = {}) => ({
  id: "b1", user_id: "u1", name: "Big trades", enabled: true, kind: "big_trade", query: null, market_id: "a", side_index: null,
  threshold: null, channels: ["push"], webhook_url: null, cooldown_minutes: 60, quiet_hours: null, last_fired_at: null, created_at: "", ...o,
});
const db = (rules: Record<string, unknown>[], tier: string) => {
  const d = fakeSupabase({
    alert_rules: rules, profiles: [{ user_id: "u1", timezone: "UTC", odds_format: "cents" }],
    subscriptions: [{ user_id: "u1", tier }], alert_events: [], watchlist: [],
    push_subscriptions: [{ id: "s0", user_id: "u1", endpoint: "https://fcm.googleapis.com/fcm/send/0", keys: { p256dh: "p", auth: "a" } }],
  }, { u1: "t@example.test" });
  return d;
};

beforeEach(() => { vi.stubEnv("UNSUBSCRIBE_SECRET", "s"); sendPush.mockClear(); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("big trade alert (F16)", () => {
  it("Premium: one $10,000+ trade on a followed market gives one alert (in-app + push), and a rerun gives none", async () => {
    const d = db([rule()], "premium");
    const s = src([trade()]);
    const first = await runServerAlerts(d as never, s, NOON);
    expect(first).toMatchObject({ events: 1, pushes: 1, errors: 0 });
    const ev = d.tables.alert_events![0]!;
    expect(ev).toMatchObject({ rule_id: "b1", market_id: "a", side_index: 0, sent_channels: ["in_app", "push"] });
    const p = ev.payload as { title: string; message: string };
    expect(p.message).toContain("$12,400");   // 20,000 shares x 0.62, whole dollars
    expect(p.message).toMatch(/62%/);
    expect(p.message).not.toMatch(/¢|cents|bet this/i);
    expect(s.fetchBigTrades).toHaveBeenCalledWith(["ev1"], expect.any(Number));
    sendPush.mockClear();
    expect((await runServerAlerts(d as never, s, new Date(NOON.getTime() + 3600_000))).events).toBe(0);
    expect(sendPush).not.toHaveBeenCalled();
  });

  it("ignores trades under $10,000, trades on other markets, and trades older than the look-back", async () => {
    const d = db([rule()], "premium");
    const s = src([
      trade({ size: 16_000, price: 0.62, transaction_hash: "0xsmall" }),            // $9,920
      trade({ token_id: "someone-else", transaction_hash: "0xother" }),
      trade({ timestamp: tsNow - 3 * 86_400, transaction_hash: "0xold" }),
    ]);
    expect((await runServerAlerts(d as never, s, NOON)).events).toBe(0);
    expect(BIG_TRADE_USD).toBe(10_000);
  });

  it("exactly $10,000 counts; two different trades are two alerts", async () => {
    const d = db([rule()], "premium");
    const s = src([trade({ size: 20_000, price: 0.5, transaction_hash: "0xa" }), trade({ transaction_hash: "0xb", token_id: "tok1", outcome: "No", outcome_index: 1 })]);
    expect((await runServerAlerts(d as never, s, NOON)).events).toBe(2);
  });

  it("a rule with no market watches the user's list and the markets of their other rules", async () => {
    const d = db([rule({ market_id: null }), rule({ id: "p1", kind: "market_price", market_id: "m9", threshold: 0.5, channels: [] })], "premium");
    d.tables.watchlist!.push({ user_id: "u1", market_id: "w1" });
    const s = src([]);
    await runServerAlerts(d as never, s, NOON);
    const calls = s.fetchBigTrades.mock.calls as unknown as [string[], number][];
    expect(calls.length).toBeGreaterThan(0);
    expect(calls[0]![0]).toEqual(["ev1"]);   // all three markets share one event id in this fixture
  });

  it("Free and Pro never get it, and the trade feed is never even called for them", async () => {
    for (const tier of ["free", "pro"]) {
      const d = db([rule()], tier);
      const s = src([trade()]);
      const c = await runServerAlerts(d as never, s, NOON);
      expect(c.events).toBe(0);
      expect(d.tables.alert_events).toHaveLength(0);
      expect(s.fetchBigTrades).not.toHaveBeenCalled();
    }
    expect(sendPush).not.toHaveBeenCalled();
  });

  it("a failing trade feed is one rule's problem: nothing sent, no crash", async () => {
    const d = db([rule()], "premium");
    const s = { ...src([]), fetchBigTrades: async () => { throw new Error("HTTP 500"); } };
    expect(await runServerAlerts(d as never, s, NOON)).toMatchObject({ events: 0 });
  });
});

describe("lib/bigtrade.ts: Polymarket Data API v2 /trades", () => {
  const body = { data: [trade(), { garbage: true }], pagination: { next_cursor: null } };
  it("asks the documented public endpoint with cash filter >= $10,000, event ids in chunks of 20, and no key", async () => {
    const urls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (u: string, init?: RequestInit) => {
      urls.push(u);
      expect(JSON.stringify(init?.headers ?? {})).not.toMatch(/authorization|api[-_]?key/i);
      return new Response(JSON.stringify(body), { status: 200 });
    }));
    const ids = Array.from({ length: 25 }, (_, i) => `e${i}`);
    const rows = await fetchBigTrades(ids, tsNow - 86_400);
    expect(urls).toHaveLength(2);
    const u = new URL(urls[0]!);
    expect(u.origin + u.pathname).toBe("https://data-api.polymarket.com/v2/trades");
    expect(u.searchParams.get("filter_type")).toBe("CASH");
    expect(u.searchParams.get("filter_amount")).toBe("10000");
    expect(u.searchParams.get("event_id")!.split(",")).toHaveLength(20);
    expect(rows.length).toBe(2);   // the garbage row is dropped, not fatal
  });
  it("computes dollars as shares x price itself and drops rows without a token or a time", () => {
    const rows = parseTrades({ data: [trade({ size: 3, price: 0.5 }), trade({ token_id: undefined }), trade({ timestamp: undefined })] });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ usd: 1.5, token_id: "tok0", outcome: "Jaguars", side: "BUY" });
  });
  it("a non-200 answer throws (the evaluator counts it as that rule failing)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("no", { status: 429 })));
    await expect(fetchBigTrades(["e1"], 0)).rejects.toThrow(/429/);
  });
});
