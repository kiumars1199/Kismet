import { describe, expect, it } from "vitest";
import { score, SCORE_FORMULA } from "./score";

describe("score", () => {
  it("zero edge is 50, whatever the sample", () => { expect(score(0, 400)).toBe(50); expect(score(0, 5)).toBe(50); });
  it("full sample: 50 + 250 × edge", () => { expect(score(0.1, 400)).toBe(75); expect(score(0.1, 1000)).toBe(75); });
  it("a negative edge is under 50", () => { expect(score(-0.04, 400)).toBe(40); });
  it("a small sample shrinks toward 50: n = 100 halves the move", () => { expect(score(0.1, 100)).toBe(63); });
  it("n = 0 gives 50", () => { expect(score(0.2, 0)).toBe(50); });
  it("clamps at 100", () => { expect(score(0.5, 400)).toBe(100); });
  it("clamps at 0", () => { expect(score(-0.5, 400)).toBe(0); });
  it("rounds to a whole number", () => { expect(Number.isInteger(score(0.0333, 250))).toBe(true); });
  it("no model chance (null / NaN) → no score", () => {
    expect(score(null, 400)).toBeNull();
    expect(score(0.1, null)).toBeNull();
    expect(score(NaN, 10)).toBeNull();
  });
  it("prints the formula in plain words", () => { expect(SCORE_FORMULA).toMatch(/50 \+ 250/); expect(SCORE_FORMULA).not.toMatch(/net_edge/); });
});
