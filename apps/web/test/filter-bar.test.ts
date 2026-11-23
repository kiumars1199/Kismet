// Mark's filter bar (Nov 20, date range Nov 22): bar values ↔ FilterState, round trip.
import { describe, expect, it } from "vitest";
import { barPatch, barValues, dayEnd, dayOf, dayStart } from "@/components/screener/FilterBar";
import { defaultState } from "@/lib/filters/state";

const win = { today: { closes_after_h: undefined, closes_within_h: 8.5 }, week: { closes_after_h: undefined, closes_within_h: 100 } };
const none = { from: "", to: "" };

describe("filter bar", () => {
  it("round-trips sport, multiplier and date", () => {
    const v = { sport: "t:sports.soccer", mult: "2-3", date: "week", ...none };
    const s = { ...defaultState(), ...barPatch(v, win) };
    expect(s.topics).toEqual(["sports.soccer"]);
    expect([s.pays_min, s.pays_max]).toEqual([2, 3]);
    expect(s.closes_within_h).toBe(100);
    expect(barValues(s, win)).toEqual(v);
  });
  it("any topic in the tree, not only sports with bets (tennis, stocks)", () => {
    expect({ ...defaultState(), ...barPatch({ sport: "t:sports.tennis", mult: "", date: "", ...none }, win) }.topics).toEqual(["sports.tennis"]);
    expect({ ...defaultState(), ...barPatch({ sport: "t:finance.stocks", mult: "", date: "", ...none }, win) }.topics).toEqual(["finance.stocks"]);
  });
  it("an old category link, open-ended multipliers and any date", () => {
    const s = { ...defaultState(), ...barPatch({ sport: "c:weather", mult: "5+", date: "", ...none }, win) };
    expect(s.categories).toEqual(["weather"]);
    expect([s.pays_min, s.pays_max]).toEqual([5, undefined]);
    expect(s.closes_within_h).toBeUndefined();
    expect(barValues({ ...s, pays_min: undefined, pays_max: 1.5 }, win).mult).toBe("lt1.5");
  });
  it("picked dates: a range, a single day, and To before From", () => {
    const r = barPatch({ sport: "", mult: "", date: "custom", from: "2026-11-20", to: "2026-11-23" }, win);
    expect(r.closes_from).toBe(dayStart("2026-11-20"));
    expect(r.closes_to).toBe(dayEnd("2026-11-23"));
    expect(r.closes_within_h).toBeUndefined();
    expect(barValues({ ...defaultState(), ...r }, win)).toMatchObject({ date: "custom", from: "2026-11-20", to: "2026-11-23" });
    const one = barPatch({ sport: "", mult: "", date: "custom", from: "2026-11-24", to: "" }, win);
    expect([one.closes_from, one.closes_to]).toEqual([dayStart("2026-11-24"), dayEnd("2026-11-24")]);
    const swapped = barPatch({ sport: "", mult: "", date: "custom", from: "2026-11-25", to: "2026-11-22" }, win);
    expect([swapped.closes_from, swapped.closes_to]).toEqual([dayStart("2026-11-22"), dayEnd("2026-11-25")]);
    expect(dayOf(dayStart("2026-11-22"))).toBe("2026-11-22");
  });
  it("all empty clears the filters", () => {
    expect(barPatch({ sport: "", mult: "", date: "", ...none }, win)).toEqual({
      closes_from: undefined, closes_to: undefined,
      topics: undefined, categories: undefined, pays_min: undefined, pays_max: undefined, closes_after_h: undefined, closes_within_h: undefined });
  });
});
