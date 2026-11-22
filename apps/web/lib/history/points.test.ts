import { describe, expect, it } from "vitest";
import { basisLine, intervalWords, pointsOf, tickPct } from "./points";

describe("price history helpers", () => {
  it("pointsOf expands the columnar series to { t, p } with p as a 0..1 price", () => {
    expect(pointsOf({ side: 0, t0: 1000, dt: 3600, p: [500, 520, 480] })).toEqual([
      { t: 1000, p: 0.5 }, { t: 4600, p: 0.52 }, { t: 8200, p: 0.48 },
    ]);
  });

  it("intervalWords: whole hours and days in plain words", () => {
    expect(intervalWords(3600)).toBe("hour");
    expect(intervalWords(6 * 3600)).toBe("6 hours");
    expect(intervalWords(24 * 3600)).toBe("day");
    expect(intervalWords(48 * 3600)).toBe("2 days");
    expect(intervalWords(36 * 3600)).toBe("36 hours");
  });

  it("basisLine names the venue and the interval", () => {
    expect(basisLine("Polymarket", 6 * 3600)).toBe("Prices from Polymarket, every 6 hours");
    expect(basisLine("Polymarket", 3600)).toBe("Prices from Polymarket, every hour");
  });

  it("tickPct shows whole percents, never cents", () => {
    expect(tickPct(0.5)).toBe("50%");
    expect(tickPct(0.123)).toBe("12%");
    expect(tickPct(0.004)).toBe("0%");
  });
});
