// /api/kalshi and /kalshi (docs/03 § kalshi.json): off unless KALSHI_DATA_PERMISSION=true (docs/16 §2); every row credits
// Kalshi and links to kalshi.com; shared-cacheable body.
import { afterEach, describe, expect, it, vi } from "vitest";
import type { KalshiFile } from "@/lib/types";

const load = async () => {
  vi.resetModules();   // fresh kalshi.json cache per test
  return (await import("@/app/api/kalshi/route")).GET;
};

describe("/api/kalshi", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("404s with the flag off, even though kalshi.json exists", async () => {
    const GET = await load();
    const res = await GET();
    expect(res.status).toBe(404);
    expect(res.headers.get("cache-control")).toBe("no-store");
    vi.stubEnv("KALSHI_DATA_PERMISSION", "1");   // only the exact string "true" turns it on
    expect((await (await load())()).status).toBe(404);
  });

  it("404s with the flag on when the scan wrote no kalshi.json", async () => {
    vi.stubEnv("KALSHI_DATA_PERMISSION", "true");
    vi.stubEnv("DATA_DIR", "test/fixtures/missing");
    expect((await (await load())()).status).toBe(404);
  });

  it("flag on: kalshi.json shape, sorted by volume, Kalshi credit and kalshi.com links, CDN cache", async () => {
    vi.stubEnv("KALSHI_DATA_PERMISSION", "true");
    const res = await (await load())();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("public, s-maxage=120, stale-while-revalidate=600");
    const body = (await res.json()) as KalshiFile;
    expect(body.meta).toMatchObject({ source: "Kalshi", attribution: expect.stringContaining("Kalshi") });
    expect(body.markets.map((m) => m.ticker)).toEqual(["KXNBAGAME-26NOV19LACSAS-SAS", "KXELONMARS-99"]);
    for (const m of body.markets) {
      expect(m).toMatchObject({ source: "Kalshi", url: expect.stringMatching(/^https:\/\/kalshi\.com\//) });
      expect(Object.keys(m).sort()).toEqual(["close_time", "event_ticker", "series_ticker", "source", "subtitle", "ticker", "title", "url", "volume", "yes_ask_cents", "yes_bid_cents"]);
    }
    for (const c of body.combos) {
      expect(c.source).toBe("Kalshi");
      expect(["kalshi_quote", "legs_product"]).toContain(c.price_basis);
      for (const l of c.legs) expect(l.url).toMatch(/^https:\/\/kalshi\.com\//);
    }
  });
});

describe("/kalshi page", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("is notFound with the flag off", async () => {
    vi.resetModules();
    const { default: Page } = await import("@/app/kalshi/page");
    await expect(Page()).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;404|NEXT_NOT_FOUND/);
  });
});
