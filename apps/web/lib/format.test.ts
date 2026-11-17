import { describe, expect, it } from "vitest";
import { ago, chance, closesIn, edge, expectedProfit, money, pays, pct, price, realisticReturn, ret } from "./format";

describe("format", () => {
  it("formats numbers per docs/06", () => {
    expect([price(0.68), price(0.055), price(null)]).toEqual(["68¢", "5.5¢", "—"]);
    expect([pct(0.792), ret(33.2), ret(4.62), ret(-2), ret(NaN)]).toEqual(["79%", "+33%", "+4.6%", "−2%", "—"]);
    expect([edge(0.051), edge(-0.02)]).toEqual(["+5.1¢", "−2.0¢"]);
    expect([money(2400), money(32.58, true), money(-8, true), money(25)]).toEqual(["$2,400", "+$32.58", "−$8", "$25"]);
    expect(expectedProfit(33, 100)).toBe(33);
    expect([pays(1 / 3), pays(0.5), pays(0.08), pays(0.99), pays(0), pays(null)]).toEqual(["3.0x", "2.0x", "13x", "1.0x", "—", "—"]);
  });
  it("chance labels use the docs/06 bands", () => {
    expect([chance(0.8), chance(0.79), chance(0.55), chance(0.5), chance(0.39), chance(undefined)])
      .toEqual(["Likely to hit", "Leans your way", "Leans your way", "Coin flip", "Long shot", null]);
  });
  it("relative times and realistic return", () => {
    const now = 1_000_000_000_000;
    expect([closesIn(now / 1000 + 1800, now), closesIn(now / 1000 + 19 * 3600, now), closesIn(now / 1000 + 72 * 3600, now), closesIn(now / 1000 - 5, now)])
      .toEqual(["30m", "19h", "3 days", "closed"]);
    expect(ago(now / 1000 - 12 * 60, now)).toBe("12 min ago");
    expect(realisticReturn({ realistic_edge: 0.1078, ask: 0.85, fee: 0.0064 })).toBeCloseTo(12.59, 1);
    expect(realisticReturn({ realistic_edge: null, ask: 0.5, fee: 0 })).toBeNull();
  });
});
