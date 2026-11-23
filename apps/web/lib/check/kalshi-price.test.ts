import { describe, expect, it } from "vitest";
import { kalshiOwnPrices } from "./kalshi-price";

const rows = [
  ["KXA-1", "A", "", "other", "KXA", 40, 44, 43, 10, null],
  ["KXB-1", "B", "", "other", "KXB", null, null, 61, 5, null],
  ["KXC-1", "C", "", "other", "KXC", null, 50, null, 5, null],
  ["KXD-1", "D", "", "other", "KXD", 99, 100, 99, 5, null],
] as unknown as Parameters<typeof kalshiOwnPrices>[0];
const yesBest = { index: 0 as const, outcome: "Yes" };
const noBest = { index: 1 as const, outcome: "No" };

describe("kalshiOwnPrices: per side, matching engine/venues.py kalshi_price", () => {
  it("best side Yes: Yes side = Yes ask, other side = 1 - yes bid (what No costs)", () => {
    expect(kalshiOwnPrices(rows, ["kxa-1"], yesBest)).toEqual({ ticker: "KXA-1", prices: { 0: 0.44, 1: 0.6 } });
  });
  it("best side named for a team (not No): that side is Kalshi's Yes", () => {
    expect(kalshiOwnPrices(rows, ["kxa-1"], { index: 1, outcome: "Colts" })?.prices).toEqual({ 1: 0.44, 0: 0.6 });
  });
  it("best side No: that side costs 1 - yes bid, the other side is the Yes ask", () => {
    expect(kalshiOwnPrices(rows, ["kxa-1"], noBest)?.prices).toEqual({ 1: 0.6, 0: 0.44 });
  });
  it("the No side never gets the Yes ask", () => {
    const p = kalshiOwnPrices(rows, ["kxa-1"], yesBest)!.prices;
    expect(p[1]).not.toBe(0.44);
  });
  it("no yes bid: the No-side price is missing, not guessed", () => {
    expect(kalshiOwnPrices(rows, ["kxc-1"], yesBest)?.prices).toEqual({ 0: 0.5, 1: null });
  });
  it("Yes falls back to the last trade when there is no ask", () => {
    expect(kalshiOwnPrices(rows, ["kxb-1"], yesBest)?.prices[0]).toBe(0.61);
  });
  it("prices outside 1-99 cents or unknown ticker -> null / missing", () => {
    expect(kalshiOwnPrices(rows, ["kxd-1"], yesBest)?.prices[0]).toBeNull();
    expect(kalshiOwnPrices(rows, ["nope"], yesBest)).toBeNull();
  });
});
