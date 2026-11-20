import { describe, expect, it } from "vitest";
import { freshness, nextScanIn, nextScanMin } from "./freshness";

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

describe("next scan", () => {
  const at = (iso: string) => Date.parse(iso);
  it("counts to the next even-hour :17 slot in UTC", () => {
    expect(nextScanMin(at("2026-11-17T02:11:00Z"))).toBe(6);
    expect(nextScanMin(at("2026-11-17T02:17:00Z"))).toBe(120);
    expect(nextScanMin(at("2026-11-17T03:00:00Z"))).toBe(77);
    expect(nextScanIn(at("2026-11-17T02:11:00Z"))).toBe("6 min");
    expect(nextScanIn(at("2026-11-17T03:00:00Z"))).toBe("1 h 17 min");
  });
});

describe("P9: stale notices stay off while scans run", () => {
  it("a scan as old as the slowest scanner's gap (30 min fallback) plus a slow run is still fresh", () => {
    const now = Date.parse("2026-11-20T12:00:00Z");
    expect(freshness(now / 1000 - 30 * 60, now)).toBe("fresh");
    expect(freshness(now / 1000 - 2 * 3600, now)).toBe("fresh");
    expect(freshness(now / 1000 - 3.5 * 3600, now)).toBe("amber");
  });
});
