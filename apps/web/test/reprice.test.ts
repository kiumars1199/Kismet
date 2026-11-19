// Live re-pricing (lib/reprice.ts): batched /prices, 15 s cache, timeout falls back to the scan price,
// edge / Pays / tier recomputed, bets that lost their edge dropped.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiRow, MarketsResponse } from "@/lib/api";
import { _clearPriceCache, livePrices, repricePage, repriceRow } from "@/lib/reprice";
import { priceAsOf } from "@/lib/format";
import type { Side, StoreMarket } from "@/lib/types";

const side = (i: 0 | 1, ask: number, win_prob: number): Side => ({
  side_index: i, outcome: i ? "No" : "Yes", ask, mid: ask, fee: 0, win_prob, win_prob_low: win_prob - 0.03,
  edge: win_prob - ask, edge_low: win_prob - 0.03 - ask, roi_pct: 0, model_level: "cat", model_neff: 500, model_events: 100,
  realistic_edge: 0.05,
});
const row = (id: string, ask: number, win_prob: number): ApiRow => {
  const s = side(0, ask, win_prob);
  const market = {
    id, question: id, tokens: [`t-${id}`, `n-${id}`], category: "sports", tier: "best", sides: [s, side(1, 1 - ask, 1 - win_prob)], best: s,
    execution: { book_ok: true, best_bid: ask - 0.01, best_ask: ask, book_mid: ask, spread: 0.01, spread_cost: 0, fee_at_ask: 0,
      gross_edge: 0.1, net_edge: 0.1, retention: 0.9, stakes: [], verdict: "worth it" },
  } as unknown as StoreMarket;
  return { market, side: s };
};
const page = (rows: ApiRow[]): MarketsResponse =>
  ({ total: 40, page: 1, page_size: 20, pages: 2, rows, facets: {} } as unknown as MarketsResponse);

function stubPrices(prices: Record<string, { BUY: string; SELL: string }>) {
  const fn = vi.fn(async (_url: string, _init?: RequestInit) => Response.json(prices));
  vi.stubGlobal("fetch", fn);
  return fn;
}

beforeEach(() => _clearPriceCache());
afterEach(() => vi.unstubAllGlobals());

describe("live re-pricing", () => {
  it("asks /prices once per request for every token on the page, and caches 15 s", async () => {
    const fn = stubPrices({ "t-a": { BUY: "0.40", SELL: "0.41" }, "t-b": { BUY: "0.30", SELL: "0.31" } });
    const q = await livePrices(["t-a", "t-b", "t-a"], 1_000_000);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn.mock.calls[0]![0]).toBe("https://clob.polymarket.com/prices");
    expect(JSON.parse(fn.mock.calls[0]![1]!.body as string)).toHaveLength(4);   // BUY + SELL per token
    expect(q.get("t-a")).toEqual({ at: 1_000_000, ask: 0.41, bid: 0.4 });
    await livePrices(["t-a", "t-b"], 1_014_000);   // still fresh
    expect(fn).toHaveBeenCalledTimes(1);
    await livePrices(["t-a"], 1_016_000);          // 16 s later: asked again
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("falls back to the scan price when the CLOB times out or errors", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new DOMException("timed out", "TimeoutError"); }));
    const p = page([row("a", 0.4, 0.55)]);
    expect(await repricePage(p)).toBe(p);
    vi.stubGlobal("fetch", vi.fn(async () => new Response("down", { status: 503 })));
    expect(await repricePage(p)).toBe(p);
  });

  it("recomputes edge, fee, Pays, verdict and keeps the row with a timestamp", () => {
    const r = repriceRow(row("a", 0.4, 0.55), new Map([["t-a", { at: 5, ask: 0.45, bid: 0.44 }]]))!;
    expect(r.side.ask).toBe(0.45);
    expect(r.side.fee).toBeCloseTo(0.0124, 4);   // sports 5% fee: 0.05 * 0.45 * 0.55
    expect(r.side.edge).toBeCloseTo(0.55 - 0.45 - 0.012375, 4);
    expect(r.side.roi_pct).toBeCloseTo((0.087625 / 0.462375) * 100, 1);
    expect(r.market.best.ask).toBe(0.45);   // Pays = 1 / ask
    expect(r.market.execution!.net_edge).toBe(r.side.edge);
    expect(r.market.execution!.verdict).toBe("worth it");
    expect(r.side.realistic_edge).toBeLessThanOrEqual(r.side.edge);
    expect(r.price_at).toBe(5);
  });

  it("drops a bet that lost its edge and moves a best bet with no pessimistic edge to the edge tier", async () => {
    stubPrices({
      "t-gone": { BUY: "0.54", SELL: "0.55" },    // ask 55c on a 55% chance: no edge left
      "t-weak": { BUY: "0.50", SELL: "0.51" },    // edge ~2.75c but win_prob_low - ask - fee < 0
      "t-keep": { BUY: "0.30", SELL: "0.31" },
    });
    const out = await repricePage(page([row("gone", 0.4, 0.55), row("weak", 0.4, 0.55), row("keep", 0.3, 0.5), row("nolive", 0.3, 0.5)]));
    expect(out.rows.map((r) => r.market.id)).toEqual(["weak", "keep", "nolive"]);
    expect(out.total).toBe(39);
    expect(out.rows[0]!.market.tier).toBe("edge");
    expect(out.rows[1]!.market.tier).toBe("best");
    expect(out.rows[2]!.price_at).toBeUndefined();   // no live quote: scan price, no "Price as of"
  });

  it("shrinks event groups to the rows left", async () => {
    stubPrices({ "t-a": { BUY: "0.54", SELL: "0.55" }, "t-b": { BUY: "0.30", SELL: "0.31" }, "t-c": { BUY: "0.30", SELL: "0.31" } });
    const p = { ...page([row("a", 0.4, 0.55), row("b", 0.3, 0.5), row("c", 0.3, 0.5)]), total_groups: 5,
      groups: [{ start: 0, count: 1 }, { start: 1, count: 2 }] } as unknown as MarketsResponse;
    const out = await repricePage(p);
    expect(out.groups).toEqual([{ start: 0, count: 2 }]);
    expect(out.total_groups).toBe(4);
  });

  it("reads 'Price as of Xs ago'", () => {
    expect(priceAsOf(100_000, 112_000)).toBe("Price as of 12s ago");
    expect(priceAsOf(0, 5 * 60_000)).toBe("Price as of 5 min ago");
  });
});
