// F3: Kalshi markets are searchable and filterable by topic on /api/markets, and /api/meta counts by venue.
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MarketsResponse, MetaResponse } from "@/lib/api";
import { indexFromFile, indexFromKalshi, searchKalshi, inTopic } from "@/lib/data/kalshi-index";
import type { KalshiFile, KalshiIndexFile } from "@/lib/types";
import fixture from "./fixtures/kalshi.json";

vi.mock("@/lib/auth/server", () => ({ getMe: async () => ({ user: { id: "u1", email: "u@x.test" }, tier: "premium", beta: false }) }));

const SCAN = 1795111601;   // the fixture's fetched_at: "now" under DATA_CLOCK=scan
const req = (path: string) => new Request(`http://test${path}`);
const load = async () => {
  vi.resetModules();   // fresh 120 s Kalshi cache per test
  vi.stubEnv("DATA_CLOCK", "scan");
  return { markets: (await import("@/app/api/markets/route")).GET, meta: (await import("@/app/api/meta/route")).GET };
};

describe("searchKalshi (pure)", () => {
  const ix = indexFromKalshi(fixture as unknown as KalshiFile);

  it("fixture has at least 20 Kalshi rows, biggest volume first", () => {
    expect(ix.rows.length).toBeGreaterThanOrEqual(20);
    const v = ix.rows.map((r) => r[8]);
    expect(v).toEqual([...v].sort((a, b) => b - a));
  });

  it("topic filter: a leaf id, a parent id and OR within topics", () => {
    const nfl = searchKalshi(ix, { topics: ["sports.nfl"], page: 1, page_size: 50 }, SCAN);
    expect(nfl.total).toBe(4);
    expect(nfl.rows.every((r) => r.topic === "sports.nfl" && r.venue === "kalshi")).toBe(true);
    const sports = searchKalshi(ix, { topics: ["sports"], page: 1, page_size: 50 }, SCAN);
    expect(sports.total).toBeGreaterThan(nfl.total);
    expect(sports.rows.every((r) => r.topic.startsWith("sports."))).toBe(true);
    expect(searchKalshi(ix, { topics: ["sports.nfl", "crypto.bitcoin"], page: 1, page_size: 50 }, SCAN).total).toBe(6);
    expect(searchKalshi(ix, { categories: ["crypto"], page: 1, page_size: 50 }, SCAN).total).toBe(3);
  });

  it("q: every word must match title, label or ticker; q and topic combine", () => {
    expect(searchKalshi(ix, { q: "barkley touchdown", page: 1, page_size: 50 }, SCAN).rows.map((r) => r.subtitle)).toEqual(["Saquon Barkley"]);
    expect(searchKalshi(ix, { q: "bitcoin", page: 1, page_size: 50 }, SCAN).total).toBe(2);
    expect(searchKalshi(ix, { q: "bitcoin", topics: ["sports"], page: 1, page_size: 50 }, SCAN).total).toBe(0);
    expect(searchKalshi(ix, { q: "kxnflgame", page: 1, page_size: 50 }, SCAN).total).toBe(2);   // a ticker works too
  });

  it("pages, and clamps the page and page size", () => {
    const p = searchKalshi(ix, { page: 2, page_size: 10 }, SCAN);
    expect(p.rows.length).toBe(10);
    expect(p.pages).toBe(Math.ceil(p.total / 10));
    expect(searchKalshi(ix, { page: 99, page_size: 10 }, SCAN).page).toBe(p.pages);
    expect(searchKalshi(ix, { page: 1, page_size: 9999 }, SCAN).page_size).toBe(50);
  });

  it("a market with no price has price_cents null (the UI says 'No price yet'); closed markets are hidden", () => {
    const r = searchKalshi(ix, { q: "unpriced", page: 1, page_size: 5 }, SCAN).rows[0]!;
    expect(r.price_cents).toBeNull();
    expect(searchKalshi(ix, { page: 1, page_size: 50 }, SCAN + 365 * 86400).total).toBe(1);   // only the 2099 market is still open
  });

  it("inTopic is a prefix match on dot boundaries", () => {
    expect(inTopic("sports.nfl", "sports")).toBe(true);
    expect(inTopic("sportsbar.x", "sports")).toBe(false);
  });

  it("indexFromFile reads the columnar kalshi_index.json", () => {
    const f: KalshiIndexFile = {
      meta: { source: "Kalshi", attribution: "", fetched_at: 1, n: 2, columns: [] },
      rows: [["A-1", "Alpha", "Yes", "sports.nfl", "KXA", 40, 42, null, 10, null], ["B-1", "Beta", "Yes", "crypto.bitcoin", "KXB", null, null, 30, 99, null]],
    };
    const r = searchKalshi(indexFromFile(f), { page: 1, page_size: 5 }, 5);
    expect(r.rows.map((x) => [x.ticker, x.price_cents, x.url])).toEqual([["B-1", 30, "https://kalshi.com/markets/kxb"], ["A-1", 42, "https://kalshi.com/markets/kxa"]]);
  });
});

describe("/api/markets and /api/meta with Kalshi (fixture)", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("venue=kalshi&topic=sports.nfl returns only Kalshi NFL rows", async () => {
    vi.stubEnv("KALSHI_DATA_PERMISSION", "true");
    const res = await (await load()).markets(req("/api/markets?venue=kalshi&topic=sports.nfl"));
    expect(res.status).toBe(200);
    const b = (await res.json()) as MarketsResponse;
    expect(b.rows).toEqual([]);
    expect(b.kalshi!.total).toBe(4);
    expect(b.kalshi!.rows.every((r) => r.topic === "sports.nfl" && r.url.startsWith("https://kalshi.com/"))).toBe(true);
  });

  it("the short URL keys work too (ven=kalshi&t=...)", async () => {
    vi.stubEnv("KALSHI_DATA_PERMISSION", "true");
    const b = (await (await (await load()).markets(req("/api/markets?ven=kalshi&t=crypto"))).json()) as MarketsResponse;
    expect(b.kalshi!.total).toBe(3);
  });

  it("q finds Kalshi rows with no venue param, beside the Polymarket rows", async () => {
    vi.stubEnv("KALSHI_DATA_PERMISSION", "true");
    const b = (await (await (await load()).markets(req("/api/markets?q=Jokic"))).json()) as MarketsResponse;
    expect(b.kalshi!.rows.map((r) => r.title)).toEqual(["Nikola Jokic points"]);
  });

  it("no q, no venue: the body is the Polymarket page, no kalshi field", async () => {
    vi.stubEnv("KALSHI_DATA_PERMISSION", "true");
    const b = (await (await (await load()).markets(req("/api/markets?c=sports"))).json()) as MarketsResponse;
    expect(b.kalshi).toBeUndefined();
    expect(b.rows.length).toBeGreaterThan(0);
  });

  it("without KALSHI_DATA_PERMISSION: an old venue=kalshi link gets the normal Polymarket list (not an error) and q adds no Kalshi rows", async () => {
    const { markets } = await load();
    for (const url of ["/api/markets?venue=kalshi", "/api/markets?ven=kalshi&t=sports.nfl"]) {
      const res = await markets(req(url));
      expect(res.status).toBe(200);
      const b = (await res.json()) as MarketsResponse;
      expect(b.kalshi).toBeUndefined();
      expect(b.rows.length).toBeGreaterThan(0);
    }
    const b = (await (await markets(req("/api/markets?q=Jokic"))).json()) as MarketsResponse;
    expect(b.kalshi).toBeUndefined();
  });

  it("/api/meta counts by venue", async () => {
    vi.stubEnv("KALSHI_DATA_PERMISSION", "true");
    const b = (await (await (await load()).meta()).json()) as MetaResponse;
    expect(b.counts.polymarket).toBe(b.counts.markets);
    expect(b.counts.kalshi).toBe(28);
    vi.unstubAllEnvs();
    expect(((await (await (await load()).meta()).json()) as MetaResponse).counts.kalshi).toBe(0);
  });
});
