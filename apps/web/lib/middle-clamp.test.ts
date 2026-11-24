// A long bet title is shortened in the MIDDLE, never at the end: the date that tells similar bets apart ("... on November 17?") stays.
import { describe, expect, it } from "vitest";
import { middleClamp } from "./middle-clamp";

const LONG = "Will the highest temperature in San Francisco be between 60-61°F on November 17?";

describe("middleClamp", () => {
  it("leaves a title that fits alone", () => {
    expect(middleClamp("Denmark vs. Norway: O/U 2.5", 52)).toBe("Denmark vs. Norway: O/U 2.5");
    expect(middleClamp("x".repeat(52), 52)).toBe("x".repeat(52));
  });
  it("keeps the start and the end of an 80-character title, within the limit", () => {
    const out = middleClamp(LONG, 52);
    expect(out.length).toBeLessThanOrEqual(52);
    expect(out.startsWith("Will the highest")).toBe(true);
    expect(out.endsWith("on November 17?")).toBe(true);
    expect(out).toContain(" … ");
  });
  it("keeps the range AND the date on a phone (52): '... 60-61°F on November 17?'", () => {
    expect(middleClamp(LONG, 52).endsWith("60-61°F on November 17?")).toBe(true);
  });
  it("tells the two similar bets apart: the 17th and the 18th stay different", () => {
    expect(middleClamp(LONG, 52)).not.toBe(middleClamp(LONG.replace("17", "18"), 52));
  });
  it("cuts at word boundaries (no half words) and never leaves a doubled space", () => {
    const out = middleClamp(LONG, 52);
    const [a, b] = out.split(" … ");
    expect(LONG.startsWith(a!.trimEnd())).toBe(true);
    expect(LONG.endsWith(b!.trimStart())).toBe(true);
    expect(out).not.toMatch(/\s{2}/);
  });
  it("one long unbroken word still fits the limit", () => {
    expect(middleClamp("a".repeat(120), 40).length).toBeLessThanOrEqual(40);
  });
});
