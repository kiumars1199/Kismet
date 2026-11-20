import { describe, expect, it } from "vitest";
import { gameTime } from "@/lib/format";
describe("gameTime time zone (audit run 2, 3-a)", () => {
  it("renders the same string anywhere when a zone is given", () => {
    const sat = Date.UTC(2026, 10, 21, 20, 30) / 1000;   // Sat 8:30 PM UTC
    const now = Date.UTC(2026, 10, 20, 12);
    expect(gameTime(sat, now, "UTC")).toBe("Sat 8:30 PM");
    expect(gameTime(sat, now, "America/New_York")).toBe("Sat 3:30 PM");
  });
});
