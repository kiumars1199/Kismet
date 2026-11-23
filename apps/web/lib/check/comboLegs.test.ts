import { describe, expect, it } from "vitest";
import { MAX_COMBO_LEGS } from "./combo";
import { addStored, COUNT_COOKIE, parseStored, reservedLegs, STORE_KEY, type StoredLeg } from "./comboLegs";
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
  it("the cookie's count, at least one for a ?m= link, clamped to the maximum, junk is zero", () => {
    expect(COUNT_COOKIE).toBe("kismet_combo_n");
    expect(reservedLegs(undefined, undefined)).toBe(0);
    expect(reservedLegs("2", undefined)).toBe(2);
    expect(reservedLegs("0", "123")).toBe(1);
    expect(reservedLegs("3", "123")).toBe(3);
    expect(reservedLegs("99", undefined)).toBe(MAX_COMBO_LEGS);
    for (const bad of ["", "x", "-4", "NaN"]) expect(reservedLegs(bad, undefined), bad).toBe(0);
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

