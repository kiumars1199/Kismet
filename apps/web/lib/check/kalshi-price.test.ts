import { describe, expect, it } from "vitest";
import { kalshiOwnPrice } from "./kalshi-price";

const rows = [
  ["KXA-1", "A", "", "other", "KXA", 40, 44, 43, 10, null],
  ["KXB-1", "B", "", "other", "KXB", null, null, 61, 5, null],
  ["KXC-1", "C", "", "other", "KXC", null, null, null, 5, null],
  ["KXD-1", "D", "", "other", "KXD", 99, 100, 99, 5, null],
] as unknown as Parameters<typeof kalshiOwnPrice>[0];

describe("kalshiOwnPrice", () => {
  it("uses the ask, any letter case", () => expect(kalshiOwnPrice(rows, ["kxa", "kxa-1"])).toEqual({ ticker: "KXA-1", yes_price: 0.44 }));
  it("falls back to the last trade", () => expect(kalshiOwnPrice(rows, ["kxb-1"])?.yes_price).toBe(0.61));
  it("no price, 100c or unknown ticker -> null", () => {
    expect(kalshiOwnPrice(rows, ["kxc-1"])).toBeNull();
    expect(kalshiOwnPrice(rows, ["kxd-1"])).toBeNull();
    expect(kalshiOwnPrice(rows, ["nope"])).toBeNull();
  });
});
