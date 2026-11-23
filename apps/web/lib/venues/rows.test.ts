import { describe, expect, it } from "vitest";
import { venueRows } from "./rows";
import type { VenueQuote } from "@/lib/types";

const q = (venue: VenueQuote["venue"], price: number | null, multiplier: number | null): VenueQuote => ({ venue, price, multiplier, url: `https://x/${venue}` });

describe("venueRows", () => {
  it("3 venues: exactly one 'Pays most here', on the highest multiplier", () => {
    const rows = venueRows([q("polymarket", 0.62, 1.55), q("us", 0.6, 1.64), q("kalshi", 0.6, null)]);
    expect(rows.map((r) => r.listed)).toEqual([true, true, true]);
    expect(rows.filter((r) => r.best).map((r) => r.venue)).toEqual(["us"]);
    expect(rows.map((r) => r.pays)).toEqual(["1.55x", "1.64x", null]);
  });

  it("Kalshi has a multiplier and a %, and can win 'Pays most here'; the badge is plain (its fee is counted)", () => {
    const rows = venueRows([q("polymarket", 0.7, 1.4), q("kalshi", 0.69, 1.4184)]);
    const k = rows.find((r) => r.venue === "kalshi")!;
    expect(k).toMatchObject({ listed: true, chance: "69%", pays: "1.42x", best: true, bestLabel: "Pays most here" });
    expect(rows.find((r) => r.venue === "polymarket")!.best).toBe(false);
    const three = venueRows([q("polymarket", 0.62, 1.55), q("us", 0.6, 1.64), q("kalshi", 0.6, 1.6)]);
    expect(three.filter((r) => r.best).map((r) => r.venue)).toEqual(["us"]);
    expect(three.find((r) => r.best)!.bestLabel).toBe("Pays most here");
    expect(three.filter((r) => r.bestLabel).length).toBe(1);
  });

  it("a venue with no multiplier (old venues.json) shows its % only and never wins", () => {
    const rows = venueRows([q("polymarket", 0.7, 1.4), q("kalshi", 0.2, null)]);
    expect(rows.find((r) => r.venue === "kalshi")).toMatchObject({ listed: true, chance: "20%", pays: null, best: false });
    expect(rows.find((r) => r.venue === "polymarket")!.bestLabel).toBe("Pays most here");
  });

  it("Kalshi missing: 'Not listed', or 'Not available right now' when its snapshot was filtered by age or delay", () => {
    const base = [q("polymarket", 0.5, 2), q("us", 0.5, 2.1)];
    expect(venueRows(base).find((r) => r.venue === "kalshi")!.missing).toBe("Not listed");
    expect(venueRows(base, true).find((r) => r.venue === "kalshi")!).toMatchObject({ listed: false, missing: "Not available right now" });
    expect(venueRows(base, true).find((r) => r.venue === "us")!.missing).toBe("Not listed");   // only Kalshi's snapshot is time-filtered
  });

  it("a missing venue is 'not listed' (no price, no payout); a tie marks nobody", () => {
    const rows = venueRows([q("polymarket", 0.5, 2), q("us", 0.5, 2)]);
    expect(rows.find((r) => r.venue === "kalshi")).toMatchObject({ listed: false, chance: "—", pays: null, best: false });
    expect(rows.some((r) => r.best)).toBe(false);
  });

  it("no cents anywhere: prices read as %, payouts as multipliers", () => {
    for (const r of venueRows([q("polymarket", 0.625, 1.58), q("us", 0.04, 20), q("kalshi", 0.33, 1.4)])) {
      expect(`${r.chance} ${r.pays ?? ""}`).not.toMatch(/¢|\$/);
    }
  });

  it("no venues at all: every row not listed", () => {
    expect(venueRows(undefined).every((r) => !r.listed && !r.best)).toBe(true);
  });
});
