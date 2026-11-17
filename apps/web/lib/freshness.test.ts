import { describe, expect, it } from "vitest";
import { freshness } from "./freshness";

const now = 1_800_000_000_000;
const ago = (h: number) => now / 1000 - h * 3600;

describe("freshness", () => {
  it("is fresh up to 3 h, amber up to 6 h, red after", () => {
    expect(freshness(ago(0.2), now)).toBe("fresh");
    expect(freshness(ago(3), now)).toBe("fresh");
    expect(freshness(ago(3.01), now)).toBe("amber");
    expect(freshness(ago(6), now)).toBe("amber");
    expect(freshness(ago(6.01), now)).toBe("red");
  });
  it("treats a missing scan time as stale", () => {
    expect(freshness(undefined, now)).toBe("red");
    expect(freshness(Number.NaN, now)).toBe("red");
  });
});
