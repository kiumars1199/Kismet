// F4: venues.json is merged into the store by id; missing, malformed or stale = no venues, never an error.
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildStore, loadRaw, usableVenues } from "@/lib/data/store";
import type { VenuesFile } from "@/lib/types";

const file = (generated_at: number): VenuesFile => ({
  meta: { n: 1, kalshi: true, generated_at },
  venues: { "6674492": { venues: [{ venue: "polymarket", price: 0.5, multiplier: 1.9, url: "u" }, { venue: "kalshi", price: 0.52, multiplier: null, url: "k" }] } },
});

describe("venues in the store", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("merges by id into markets and flags; markets without an entry have none", async () => {
    const raw = await loadRaw();
    const s = buildStore({ ...raw, venues: file(raw.markets.meta.scanned_at) });
    expect(s.byId.get("6674492")!.venues!.map((v) => v.venue)).toEqual(["polymarket", "kalshi"]);
    expect(s.flagsById.get("6674492")!.venues).toHaveLength(2);
    expect(s.markets.filter((m) => m.venues).length).toBe(1);
  });

  it("the fixture venues.json covers 3 markets, 2 of them with a Kalshi quote that has a null multiplier", async () => {
    const s = buildStore(await loadRaw());
    const withV = s.markets.filter((m) => m.venues);
    expect(withV.length).toBe(3);
    expect(withV.filter((m) => m.venues!.some((v) => v.venue === "kalshi" && v.multiplier === null)).length).toBe(2);
  });

  it("no venues.json, a malformed one, or a stale one (outside DATA_CLOCK=scan) = no venues", async () => {
    const raw = await loadRaw();
    expect(buildStore({ ...raw, venues: undefined }).markets.some((m) => m.venues)).toBe(false);
    expect(buildStore({ ...raw, venues: { meta: file(1).meta } as unknown as VenuesFile }).markets.some((m) => m.venues)).toBe(false);
    vi.stubEnv("DATA_CLOCK", "real");
    const at = raw.markets.meta.scanned_at;
    expect(usableVenues(file(at - 4 * 3600), at)).toBeUndefined();
    expect(usableVenues(file(at + 4 * 3600), at)).toBeUndefined();
    expect(usableVenues(file(at + 600), at)).toBeDefined();
  });
});
