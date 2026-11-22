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

  it("badge text: qualified when a listed venue has no multiplier, plain when every listed venue has one", () => {
    const withKalshi = venueRows([q("polymarket", 0.62, 1.55), q("us", 0.6, 1.64), q("kalshi", 0.6, null)]).find((r) => r.best)!;
    expect(withKalshi.bestLabel).toBe("Pays most here (Kalshi fee not counted)");
    const plain = venueRows([q("polymarket", 0.62, 1.55), q("us", 0.6, 1.64)]);
    expect(plain.find((r) => r.best)!.bestLabel).toBe("Pays most here");   // Kalshi not listed is not "uncounted"
    expect(plain.filter((r) => r.bestLabel).length).toBe(1);
    expect(venueRows([q("polymarket", 0.6, 1.6), q("kalshi", 0.5, null)]).filter((r) => !r.best).every((r) => r.bestLabel === null)).toBe(true);
  });

  it("Kalshi has a % and no payout, and is never 'Pays most here', even at the lowest price", () => {
    const rows = venueRows([q("polymarket", 0.7, 1.4), q("kalshi", 0.2, null)]);
    const k = rows.find((r) => r.venue === "kalshi")!;
    expect(k).toMatchObject({ listed: true, chance: "20%", pays: null, best: false });
    expect(rows.find((r) => r.venue === "polymarket")!.best).toBe(true);
  });

  it("a missing venue is 'not listed' (no price, no payout); a tie marks nobody", () => {
    const rows = venueRows([q("polymarket", 0.5, 2), q("us", 0.5, 2)]);
    expect(rows.find((r) => r.venue === "kalshi")).toMatchObject({ listed: false, chance: "—", pays: null, best: false });
    expect(rows.some((r) => r.best)).toBe(false);
  });

  it("no cents anywhere: prices read as %, payouts as multipliers", () => {
    for (const r of venueRows([q("polymarket", 0.625, 1.58), q("us", 0.04, 20), q("kalshi", 0.33, null)])) {
      expect(`${r.chance} ${r.pays ?? ""}`).not.toMatch(/¢|\$/);
    }
  });

  it("no venues at all: every row not listed", () => {
    expect(venueRows(undefined).every((r) => !r.listed && !r.best)).toBe(true);
  });
});
