import { describe, expect, it } from "vitest";
import { isPaused, pauseEnd, pausedResponse } from "./pause";

const NOW = Date.parse("2026-11-22T12:00:00Z");
describe("self-pause", () => {
  it("24 h, 7 d and 30 d end that long after now", () => {
    expect(pauseEnd("24h", NOW)).toBe("2026-11-23T12:00:00.000Z");
    expect(pauseEnd("7d", NOW)).toBe("2026-11-29T12:00:00.000Z");
    expect(pauseEnd("30d", NOW)).toBe("2026-12-22T12:00:00.000Z");
  });
  it("is on only while the end is in the future", () => {
    expect(isPaused("2026-11-22T12:00:01Z", NOW)).toBe(true);
    expect(isPaused("2026-11-22T12:00:00Z", NOW)).toBe(false);
    for (const v of [null, undefined, "", "nope"]) expect(isPaused(v, NOW)).toBe(false);
  });
  it("never shortens an active pause", () => {
    const cur = pauseEnd("30d", NOW);
    expect(pauseEnd("24h", NOW + 1000, cur)).toBe(cur);
    expect(pauseEnd("7d", NOW, pauseEnd("24h", NOW))).toBe(pauseEnd("7d", NOW));
    expect(pauseEnd("24h", NOW, "2026-01-01T00:00:00Z")).toBe(pauseEnd("24h", NOW));   // an old, finished pause doesn't count
  });
  it("data routes get a 423 with the end time while paused, nothing otherwise", async () => {
    const r = pausedResponse({ paused_until: "2026-11-23T12:00:00.000Z" }, NOW)!;
    expect(r.status).toBe(423);
    expect(await r.json()).toMatchObject({ code: "paused", until: "2026-11-23T12:00:00.000Z" });
    expect(pausedResponse({ paused_until: null }, NOW)).toBeNull();
    expect(pausedResponse({}, NOW)).toBeNull();
  });
});
