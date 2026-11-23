// F8: a paused account's extension calls answer 423. The worker remembers it, stops using cached event data, and the popup says why.
import { describe, expect, it } from "vitest";
import { pausedUntil, pauseLine } from "../src/pause";

const res = (status: number, body: unknown) => ({ status, body });

describe("pausedUntil", () => {
  it("reads the end time from a 423 paused body", () => {
    expect(pausedUntil(res(423, { code: "paused", until: "2026-11-30T12:00:00.000Z" }))).toBe("2026-11-30T12:00:00.000Z");
  });
  it("is null for other statuses, other 423s and junk", () => {
    expect(pausedUntil(res(200, { code: "paused", until: "2026-11-30T12:00:00.000Z" }))).toBeNull();
    expect(pausedUntil(res(423, { code: "other" }))).toBeNull();
    expect(pausedUntil(res(423, { code: "paused", until: "not a date" }))).toBeNull();
    expect(pausedUntil(res(423, null))).toBeNull();
  });
});

describe("pauseLine", () => {
  const now = Date.parse("2026-11-23T12:00:00Z");
  it("says when it ends, in plain words", () => {
    expect(pauseLine("2026-11-30T12:00:00.000Z", now)).toBe("Your account is paused until Nov 30. Kismet is off in the meantime.");
  });
  it("is null once the pause has ended, or with no pause", () => {
    expect(pauseLine("2026-11-22T12:00:00.000Z", now)).toBeNull();
    expect(pauseLine(null, now)).toBeNull();
  });
});
