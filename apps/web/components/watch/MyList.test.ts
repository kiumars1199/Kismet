import { describe, expect, it } from "vitest";
import { failureKind, status } from "./MyList";

const future = { closes_at: Math.floor(Date.now() / 1000) + 7 * 86400 } as never;
const past = { closes_at: Math.floor(Date.now() / 1000) - 3600 } as never;

describe("My list status on fetch errors", () => {
  it("only a 404 counts as gone", () => {
    expect(failureKind(new Error("/api/markets/x: HTTP 404"))).toBe("gone");
    for (const code of [403, 429, 500, 503]) expect(failureKind(new Error(`/api/markets/x: HTTP ${code}`))).toBe("error");
    expect(failureKind(new TypeError("Failed to fetch"))).toBe("error");
  });
  it("a failed load says Couldn't load, not Closed", () => {
    expect(status("error", future).label).toBe("Couldn't load");
    expect(status("error", null).label).toBe("Couldn't load");
  });
  it("still says Closed when the market is gone or its close time passed", () => {
    expect(status("gone", future).label).toBe("Closed");
    expect(status("error", past).label).toBe("Closed");
  });
});
