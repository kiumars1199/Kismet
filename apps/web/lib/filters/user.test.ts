import { describe, expect, it } from "vitest";
import { defaultState } from "./state";
import { resolveUserFilters } from "./user";

const ctx = { favorites: ["weather", "sports.nfl"], watchlistIds: new Set(["a"]) };

describe("resolveUserFilters", () => {
  it("turns favorites_only into topics; the server gets fav=1 only as a marker beside those topics (Free first-screen fallback)", () => {
    const r = resolveUserFilters({ ...defaultState(), favorites_only: true, watchlisted_only: true }, ctx);
    expect(r.state.topics).toEqual(["weather", "sports.nfl"]);
    expect(r.state.favorites_only).toBe(true);
    expect(r.state.watchlisted_only).toBeUndefined();
    expect([r.keep("a"), r.keep("b")]).toEqual([true, false]);
  });
  it("no marker without topics (nothing to filter by)", () => {
    const r = resolveUserFilters({ ...defaultState(), favorites_only: true }, { ...ctx, favorites: [] });
    expect(r.state.favorites_only).toBeUndefined();
  });
  it("leaves state alone when no user filter is on", () => {
    const r = resolveUserFilters(defaultState(), ctx);
    expect(r.state.topics).toBeUndefined();
    expect(r.keep("b")).toBe(true);
  });
});
