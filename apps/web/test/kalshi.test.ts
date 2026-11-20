// /api/kalshi and /kalshi (docs/03 § kalshi.json): in beta (lib/beta.ts), testers only, whatever KALSHI_DATA_PERMISSION
// says (docs/16 §2); everyone else 404. Every row credits Kalshi and links to kalshi.com.
import { afterEach, describe, expect, it, vi } from "vitest";
import type { KalshiFile } from "@/lib/types";

const h = vi.hoisted(() => ({ beta: false }));
vi.mock("@/lib/auth/server", () => ({ getMe: async () => ({ user: null, tier: "premium", beta: h.beta }) }));

const load = async () => {
  vi.resetModules();   // fresh kalshi.json cache per test
  return (await import("@/app/api/kalshi/route")).GET;
};

describe("/api/kalshi", () => {
  afterEach(() => { vi.unstubAllEnvs(); h.beta = false; });

  it("404s for anyone who isn't a tester, even a Premium plan with the flag on", async () => {
    const res = await (await load())();
    expect(res.status).toBe(404);
    expect(res.headers.get("cache-control")).toBe("no-store");
    vi.stubEnv("KALSHI_DATA_PERMISSION", "true");
    expect((await (await load())()).status).toBe(404);
  });

  it("404s for a tester when the scan wrote no kalshi.json", async () => {
    h.beta = true;
    vi.stubEnv("DATA_DIR", "test/fixtures/missing");
    expect((await (await load())()).status).toBe(404);
  });

  it("tester, flag off: kalshi.json shape, sorted by volume, Kalshi credit and kalshi.com links, never shared-cached", async () => {
    h.beta = true;
    const res = await (await load())();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
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
  afterEach(() => { vi.unstubAllEnvs(); h.beta = false; });

  it("is notFound for anyone who isn't a tester, flag on or off", async () => {
    vi.resetModules();
    const { default: Page } = await import("@/app/kalshi/page");
    await expect(Page()).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;404|NEXT_NOT_FOUND/);
    vi.stubEnv("KALSHI_DATA_PERMISSION", "true");
    await expect(Page()).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;404|NEXT_NOT_FOUND/);
  });

  it("renders for a tester with the flag off, under the Beta banner", async () => {
    h.beta = true;
    vi.resetModules();
    const { default: Page } = await import("@/app/kalshi/page");
    const el = (await Page()) as { props: { children: { props: { variant?: string } }[] } };
    expect(el.props.children[0]!.props.variant).toBe("banner");
  });
});

describe("/kalshi page (audit run 3, 3-c)", () => {
  afterEach(() => { vi.unstubAllEnvs(); h.beta = false; });
  const page = async () => { vi.resetModules(); return (await import("@/app/kalshi/page")).default; };

  it("a tester with no kalshi.json gets an empty state, not the 404 the nav link would lead to", async () => {
    h.beta = true;
    vi.stubEnv("DATA_DIR", "test/fixtures/missing");
    const el = await (await page())();
    expect(JSON.stringify(el)).toContain("No Kalshi data yet");
  });

  it("anyone else still gets the 404", async () => {
    await expect((await page())()).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;404|NEXT_NOT_FOUND/);
  });
});
