import { describe, expect, it } from "vitest";
import { MAX_COMBO_LEGS } from "./combo";
import { addStored, parseStored, STORE_KEY, type StoredLeg } from "./comboLegs";

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
