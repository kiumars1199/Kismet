import { describe, expect, it } from "vitest";
import { MAX_COMBO_LEGS } from "./combo";
import { addStored, comboUrl, legsParam, parseLegsParam, parseStored, reservedLegs, STORE_KEY, type StoredLeg } from "./comboLegs";
import { isActive } from "@/components/shell/nav";

const leg = (id: string, side: 0 | 1 = 0): StoredLeg => ({ key: `${id}:${side}`, marketId: id, side, question: `Q${id}`, outcome: "Yes", eventId: `e${id}`, event: `E${id}`, price: 0.5 });

describe("combo legs kept between pages (sessionStorage)", () => {
  it("round-trips and ignores anything malformed", () => {
    expect(parseStored(JSON.stringify([leg("1"), leg("2", 1)]))).toEqual([leg("1"), leg("2", 1)]);
    for (const bad of [null, "", "not json", "{}", "[1,2]", JSON.stringify([{ key: "x" }]), JSON.stringify([{ ...leg("1"), price: "x" }])]) expect(parseStored(bad as string | null)).toEqual([]);
  });
  it("drops duplicate markets (either side) and caps at the combo maximum", () => {
    expect(parseStored(JSON.stringify([leg("1"), leg("1", 1), leg("2")])).map((l) => l.key)).toEqual(["1:0", "2:0"]);
    const many = Array.from({ length: MAX_COMBO_LEGS + 3 }, (_, i) => leg(String(i)));
    expect(parseStored(JSON.stringify(many))).toHaveLength(MAX_COMBO_LEGS);
  });
  it("addStored refuses a duplicate market or a full combo, otherwise appends", () => {
    expect(addStored([leg("1")], leg("2")).legs.map((l) => l.key)).toEqual(["1:0", "2:0"]);
    expect(addStored([leg("1")], leg("1", 1))).toMatchObject({ refused: "duplicate" });
    const full = Array.from({ length: MAX_COMBO_LEGS }, (_, i) => leg(String(i)));
    expect(addStored(full, leg("zz"))).toMatchObject({ refused: "full" });
  });
  it("has a stable storage key", () => { expect(STORE_KEY).toBe("kismet.combo.legs.v1"); });
});

describe("room reserved for legs on first paint (T-89c)", () => {
  it("one leg when the URL carries ?m=, nothing otherwise (no state shared between tabs)", () => {
    expect(reservedLegs("123")).toBe(1);
    expect(reservedLegs(undefined)).toBe(0);
    expect(reservedLegs("")).toBe(0);
    expect(reservedLegs(undefined, "a:0,b:1,c:0")).toBe(3);   // a shared link or a reload: the server knows how many
    expect(reservedLegs("9", "a:0,b:1")).toBe(2);
  });
});

describe("nav: /check is current only on /check", () => {
  it("/check/combo is not /check, and vice versa; other items keep their sub-pages", () => {
    expect(isActive("/check", "/check")).toBe(true);
    expect(isActive("/check/combo", "/check")).toBe(false);
    expect(isActive("/check/combo", "/check/combo")).toBe(true);
    expect(isActive("/check", "/check/combo")).toBe(false);
    expect(isActive("/markets/x", "/markets")).toBe(true);
    expect(isActive("/", "/bets")).toBe(true);
  });
});


describe("the legs in the URL (?legs=id:side,id:side) (T-wt3b)", () => {
  it("round-trips, in order", () => {
    const refs = [{ m: "6674492", side: 0 as const }, { m: "us-77", side: 1 as const }];
    expect(legsParam(refs)).toBe("6674492:0,us-77:1");
    expect(parseLegsParam("6674492:0,us-77:1")).toEqual(refs);
    expect(comboUrl(refs, true)).toBe("/check/combo?legs=6674492%3A0%2Cus-77%3A1&check=1");
    expect(comboUrl(refs, false)).toBe("/check/combo?legs=6674492%3A0%2Cus-77%3A1");
    expect(comboUrl([], false)).toBe("/check/combo");
  });
  it("validates ids and sides, drops duplicates, caps at 10", () => {
    expect(parseLegsParam(null)).toEqual([]);
    expect(parseLegsParam("")).toEqual([]);
    expect(parseLegsParam("1:2,x:y,:0,<b>:0,1:0,1:1,a b:0")).toEqual([{ m: "1", side: 0 }]);   // bad side, bad id, empty id, markup, space: dropped; the 2nd market 1 is a duplicate
    expect(parseLegsParam("a:0,b:1,c")).toEqual([{ m: "a", side: 0 }, { m: "b", side: 1 }, { m: "c", side: 0 }]);   // a missing side means 0
    const many = Array.from({ length: 14 }, (_, i) => `m${i}:0`).join(",");
    expect(parseLegsParam(many)).toHaveLength(MAX_COMBO_LEGS);
    expect(parseLegsParam("x".repeat(500) + ":0")).toEqual([]);
  });
});
