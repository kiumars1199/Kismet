// Polymarket US quote (docs/research/polymarket-us.md): Free sees where to bet and the US price, never the exact
// US edge or return (those are Pro numbers, like the international ones).
import { describe, expect, it } from "vitest";
import { gateMarket } from "@/lib/data/gate";
import type { StoreMarket } from "@/lib/types";

const { getStore } = await import("@/lib/data/store");
const store = await getStore();

describe("us quote gate", () => {
  const base = store.flags[0] ?? store.markets[0];
  const m = { ...base, us: { slug: "aec-x", url: "https://polymarket.us/market/aec-x", side: 0, ask: 0.52, fee: 0.0237,
    edge: 0.031, roi_pct: 5.7 } } as StoreMarket;

  it("free: link and price kept, edge and return hidden", () => {
    const g = gateMarket(m, "free");
    expect(g.us).toEqual({ ...m.us, edge: null, roi_pct: null });
    expect(m.us!.edge).toBe(0.031);   // the stored market is not mutated
  });

  it("paid: unchanged", () => {
    expect(gateMarket(m, "pro").us).toEqual(m.us);
  });

  it("no US twin: stays null", () => {
    expect(gateMarket({ ...base, us: null } as StoreMarket, "free").us).toBeNull();
  });
});
