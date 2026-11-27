// Walk-through 2 nit: "+12% over over 13 thousand tested bets" read the duplicate word.
import { describe, expect, it } from "vitest";
import { bandTested, liveSoFar } from "./Why";

describe("Why this bet? counts in words", () => {
  it("one 'over' with a thousand-scale tested count", () => {
    expect(bandTested({ flags: 13_400, roi_pct: 12, win_rate: 0.55 }).text).toMatch(/^\+12% over 13 thousand tested bets/);
    expect(bandTested({ flags: 13_400, roi_pct: 12 }).text).not.toMatch(/over over/);
  });
  it("small counts still read 'over N tested bets'", () => {
    expect(bandTested({ flags: 240, roi_pct: 8 }).text).toMatch(/^\+8% over 240 tested bets/);
  });
  it("the live record has the same rule", () => {
    const t = liveSoFar({ settled: 8_312, liveRoi: 0.05, live: "" } as never).text;
    expect(t).not.toMatch(/over over/);
    expect(t).toMatch(/over 8 thousand settled best bets$/);
  });
});
