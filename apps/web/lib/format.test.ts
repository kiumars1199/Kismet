import { describe, expect, it } from "vitest";
import { ago, chance, closesIn, edge, exactCount, expectedProfit, formatCount, money, pays, pct, price, realisticReturn, ret, sidePts, testedLine, winsAbout } from "./format";

describe("docs/18 numbers", () => {
  it("formatCount rounds down, never up", () => {
    expect([999, 1_000, 9_999, 10_000, 999_999].map(formatCount)).toEqual(["999", "1K", "9.9K", "10K", "999K"]);
    expect([9_666, 12_340, 778_152, 1_240_000, 1_333_014, 0, 7].map(formatCount)).toEqual(["9.6K", "12K", "778K", "1.2M", "1.3M", "0", "7"]);
    expect([1_000_000, 2_300, 9_999_999, null].map(formatCount)).toEqual(["1M", "2.3K", "9.9M", "—"]);
    expect(exactCount(1_333_014)).toBe("1,333,014");
  });
  it("wins about, points and the tested line", () => {
    expect([0.14, 0.1, 0.33, 0.5, 0.75, 0.97, 0].map(winsAbout)).toEqual(["1 in 7", "1 in 10", "1 in 3", "5 in 10", "8 in 10", "9 in 10", "—"]);
    expect([sidePts({ edge: 0.04 }), sidePts({ edge: 0.011 }), sidePts({ edge: 0.03, ranges: { roi_pct: [0, 5], edge: [0.02, 0.05] } })]).toEqual(["+4 pts", "+1 pt", "+2–5 pts"]);
    expect(testedLine({ flags: 111, win_rate: 0.0541, roi_pct: -41.85 })).toBe("Bets like this: won 5% of the time, lost money in testing (−42%)");
    expect(testedLine({ flags: 1186, win_rate: 0.14, roi_pct: 6 })).toBe("Bets like this: won 14% of the time, +6% return in testing");
    expect(testedLine({ combos: 2001, win_rate: 0.65, roi_pct: 25.71 }, "3-leg combos")).toBe("3-leg combos: won 65% of the time, +26% return in testing");
    expect([testedLine({ flags: 0 }), testedLine(undefined)]).toEqual([null, null]);
  });
});

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
