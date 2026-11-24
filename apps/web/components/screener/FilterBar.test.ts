import { describe, expect, it } from "vitest";
import { MULTI, barPatch, barValues } from "./FilterBar";
import { todayHeading } from "@/lib/format";
import type { FilterState } from "@/lib/filters/state";

const win = { today: { closes_after_h: undefined, closes_within_h: 24 }, week: { closes_after_h: undefined, closes_within_h: 168 } };
const st = (topics?: string[]) => ({ topics, sort: { key: "roi", dir: "desc" } }) as unknown as FilterState;

describe("filter bar with saved topics", () => {
  it("one topic names it, 2+ read as 'Your topics', none is Everything", () => {
    expect(barValues(st(["sports.nfl"]), win).sport).toBe("t:sports.nfl");
    expect(barValues(st(["sports.nfl", "sports.ncaab"]), win).sport).toBe(MULTI);
    expect(barValues(st(), win).sport).toBe("");
  });
  it("Apply with the multi value leaves the topics alone", () => {
    const p = barPatch({ sport: MULTI, mult: "", date: "", from: "", to: "" }, win);
    expect("topics" in p || "categories" in p).toBe(false);
  });
});
describe("todayHeading", () => {
  it("reads right for one", () => {
    expect(todayHeading(1)).toBe("Today's top bet");
    expect(todayHeading(5)).toBe("Today's top 5");
  });
});
