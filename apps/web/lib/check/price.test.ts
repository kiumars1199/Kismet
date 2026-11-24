import { describe, expect, it } from "vitest";
import { compute, type CheckBase } from "./compute";
import { effectivePrice, fillText } from "./price";

const base = (ask: number, fee: number, winProb = 0.9995): CheckBase => ({ winProb, n: 500, ask, fee, edge: null, feeRate: 0.02, venue: "intl" });

describe("T-wt3i: the Price field is filled with the market's exact price", () => {
  it("fillText: a whole percent inside 1–99%, decimals at the extremes (never 100 or 1 for 0.999 or 0.008)", () => {
    expect([0.68, 0.6823, 0.5, 0.01, 0.99].map(fillText)).toEqual(["68", "68", "50", "1", "99"]);
    expect([0.999, 0.9996, 0.008, 0.0004, 0.995].map(fillText)).toEqual(["99.9", "99.96", "0.8", "0.04", "99.5"]);
  });

  it("effectivePrice: the exact price while the text is unchanged, the typed value (guarded) once it is edited", () => {
    expect(effectivePrice("99.9", 0.999)).toEqual({ price: 0.999, fromMarket: true });
    expect(effectivePrice("68", 0.6823)).toEqual({ price: 0.6823, fromMarket: true });
    expect(effectivePrice("70", 0.6823)).toEqual({ price: 0.7, fromMarket: false });
    expect(effectivePrice("99.9", null)).toEqual({ price: 99.9 / 100, fromMarket: false });
    expect(Number.isNaN(effectivePrice("", 0.5).price)).toBe(true);
  });

  it("compute: a market price above 99% or below 1% is scored, with no price error", () => {
    const hi = compute(base(0.999, 0.0001), 0.999, 100, true);
    expect(hi.error).toBeNull();
    expect(hi.marketPct).toBe(0.999);
    expect(hi.multiplier).toBeCloseTo(1 / 0.9991, 6);
    expect(hi.score).not.toBeNull();
    const lo = compute(base(0.008, 0.0002, 0.02), 0.008, 100, true);
    expect(lo.error).toBeNull();
    expect(lo.multiplier).toBeCloseTo(1 / 0.0082, 6);   // scored at 0.8%, not at 1%
  });

  it("compute: the card's own price is the market's even when the caller does not say so; a typed one is still guarded", () => {
    expect(compute(base(0.999, 0.0001), 0.999, 100).error).toBeNull();
    expect(compute(base(0.5, 0.01), 0.999, 100).error).toBe("price_range");
    expect(compute(base(0.5, 0.01), 0.005, 100).error).toBe("price_range");
    expect(compute(base(0.5, 0.01), 0.999, 100, false).error).toBe("price_range");
  });

  it("compute: a market price that is not a price at all (0, 1, NaN) is still an error", () => {
    for (const p of [0, 1, NaN]) expect(compute(base(0.5, 0.01), p, 100, true).error).toBe("price_range");
  });
});
