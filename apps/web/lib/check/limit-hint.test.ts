import { describe, expect, it } from "vitest";
import { checkUsedCookie, limitHinted } from "./limit";

const NOW = Date.UTC(2026, 10, 24, 12);
describe("limitHinted", () => {
  const used = checkUsedCookie("m1", 0, NOW);
  it("is true for another market or side on the same UTC day", () => {
    expect(limitHinted(used, "m2", 0, NOW)).toBe(true);
    expect(limitHinted(used, "m1", 1, NOW)).toBe(true);
  });
  it("is false for the market that used the allowance (re-opening it is free)", () => {
    expect(limitHinted(used, "m1", 0, NOW)).toBe(false);
  });
  it("is false the next UTC day, with no cookie, or with no market", () => {
    expect(limitHinted(used, "m2", 0, NOW + 24 * 3_600_000)).toBe(false);
    expect(limitHinted(undefined, "m2", 0, NOW)).toBe(false);
    expect(limitHinted(used, undefined, 0, NOW)).toBe(false);
    expect(limitHinted("garbage", "m2", 0, NOW)).toBe(false);
  });
});
