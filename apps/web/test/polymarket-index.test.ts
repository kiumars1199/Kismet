// F3 fix: every open Polymarket market is searchable even when the scan does not price it; counts.polymarket covers them.
import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MarketsResponse, MetaResponse } from "@/lib/api";
import { countUnpriced, indexFromPmFile, searchUnpriced } from "@/lib/data/polymarket-index";
import type { PolymarketIndexFile } from "@/lib/types";
import fixture from "./fixtures/polymarket_index.json";

vi.mock("@/lib/auth/server", () => ({ getMe: async () => ({ user: { id: "u1", email: "u@x.test" }, tier: "premium", beta: false }) }));

const ix = indexFromPmFile(fixture as unknown as PolymarketIndexFile);
const req = (path: string) => new Request(`http://test${path}`);
const load = async () => {
  vi.resetModules();
  vi.stubEnv("DATA_CLOCK", "scan");
  return { markets: (await import("@/app/api/markets/route")).GET, meta: (await import("@/app/api/meta/route")).GET };
};

describe("searchUnpriced (pure)", () => {
  const none = new Set<string>();
  it("fixture has at least 20 rows, biggest volume first", () => {
    expect(ix.rows.length).toBeGreaterThanOrEqual(20);
    const v = ix.rows.map((r) => r[7]);
    expect(v).toEqual([...v].sort((a, b) => b - a));
  });
  it("words, topics and categories narrow; priced ids are left out; a market past its close time stays, last", () => {
    expect(searchUnpriced(ix, none, { q: "zorbland" }).rows.map((r) => r.id)).toEqual(["9000001"]);
    expect(searchUnpriced(ix, none, { topics: ["sports.nba"] }).total).toBe(3);   // the past-dated NBA row still accepts orders: counted, listed last
    expect(searchUnpriced(ix, none, { topics: ["sports.nba"] }).rows.map((r) => r.id)).toEqual(["9000002", "9000003", "9000025"]);
    const nba = searchUnpriced(ix, none, { topics: ["sports.nba"] }, 1794873437);
    expect(nba.rows.map((r) => r.waiting)).toEqual([false, false, true]);   // the past-dated row says so
    expect(searchUnpriced(ix, none, { categories: ["sports"], excludeCategories: ["sports"] }).total).toBe(0);
    expect(searchUnpriced(ix, none, { categories: ["crypto"] }).total).toBe(20);
    expect(searchUnpriced(ix, new Set(["9000001"]), { q: "zorbland" }).total).toBe(0);
  });
  it("returns at most 10 rows, with the real total, and a polymarket.com link", () => {
    const p = searchUnpriced(ix, none, { categories: ["crypto"], limit: 500 });
    expect(p.rows).toHaveLength(10);
    expect(p.total).toBe(20);
    expect(p.rows[0]!.url).toMatch(/^https:\/\/polymarket\.com\/event\//);
  });
  it("countUnpriced skips ids the scan prices", () => {
    expect(countUnpriced(ix, new Set(["6417673"]))).toBe(ix.rows.length - 1);
  });
});

describe("/api/markets and /api/meta with the Polymarket index (fixture)", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("a word only in an unpriced market is found, labelled Not priced yet via `unpriced`, never in rows", async () => {
    const b = (await (await (await load()).markets(req("/api/markets?q=Zorbland"))).json()) as MarketsResponse;
    expect(b.rows).toEqual([]);
    expect(b.unpriced!.total).toBe(1);
    expect(b.unpriced!.rows[0]!.question).toContain("Zorbland");
  });
  it("a topic filter carries unpriced matches; page 2 and venue=polymarket do not", async () => {
    const { markets } = await load();
    const nba = (await (await markets(req("/api/markets?t=sports.nba"))).json()) as MarketsResponse;
    expect(nba.unpriced!.total).toBe(3);
    const p2 = (await (await markets(req("/api/markets?t=sports.nba&ps=1&pg=2"))).json()) as MarketsResponse;
    expect(p2.unpriced).toBeUndefined();
    const plain = (await (await markets(req("/api/markets"))).json()) as MarketsResponse;
    expect(plain.unpriced).toBeUndefined();
  });
  it("venue=polymarket keeps the strip; a filter the index cannot apply hides it; excluded categories are honoured", async () => {
    const { markets } = await load();
    const get = async (qs: string) => (await (await markets(req(`/api/markets?${qs}`))).json()) as MarketsResponse;
    expect((await get("q=Zorbland&ven=polymarket")).unpriced!.total).toBe(1);
    expect((await get("q=Zorbland&cw=3")).unpriced).toBeUndefined();   // closes within 3 h: no close-time or price data on these rows
    expect((await get("q=Zorbland&p0=0.2")).unpriced).toBeUndefined();   // price filter
    expect((await get("t=sports.nba&xc=sports")).unpriced).toBeUndefined();
    expect((await get("q=Quillfeather&s=closes")).unpriced!.total).toBe(1);   // sort alone is fine
  });
  it("counts.polymarket = priced + unpriced, polymarket_priced = the scan's rows", async () => {
    const b = (await (await (await load()).meta()).json()) as MetaResponse;
    expect(b.counts.polymarket_priced).toBe(b.counts.markets);
    expect(b.counts.polymarket).toBe(b.counts.markets + fixture.rows.length - 1);   // 6417673 is priced already
  });
});

describe("Kalshi index keeps the last good copy (F3 fix)", () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });
  it("a source that loses kalshi_index.json does not shrink the count to the top of kalshi.json", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "kix-"));
    copyFileSync(path.join(__dirname, "fixtures/kalshi.json"), path.join(dir, "kalshi.json"));
    const rows = Array.from({ length: 300 }, (_, i) => [`T-${i}`, `Title ${i}`, "Yes", "other", "KX", 40, 42, null, i, null]);
    writeFileSync(path.join(dir, "kalshi_index.json"), JSON.stringify({ meta: { source: "Kalshi", attribution: "", fetched_at: 1, n: 300, columns: [] }, rows }));
    vi.resetModules();
    vi.stubEnv("DATA_DIR", dir);
    vi.stubEnv("DATA_SOURCE", "local");
    vi.useFakeTimers({ toFake: ["Date"] });
    const { getKalshiIndex } = await import("@/lib/data/store");
    expect((await getKalshiIndex())!.rows).toHaveLength(300);
    rmSync(path.join(dir, "kalshi_index.json"));
    vi.setSystemTime(Date.now() + 10 * 60_000);   // past the 120 s cache
    expect((await getKalshiIndex())!.rows).toHaveLength(300);   // not the ~25 rows of the kalshi.json fallback
  });
});
