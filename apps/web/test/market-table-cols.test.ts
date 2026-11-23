// /markets: the pinned default columns always fit the box with at least 24 px to spare (a fixed table is as wide as its columns, so this is a
// pure number), and Market gets the room: >= 260 px at 1280 and >= 300 px at 1366 once the box shares out the slack.
import { describe, expect, it } from "vitest";
import { boxAt, COL_CLASS, DEFAULT_COLUMNS, defaultSum, marketAt, MARKET_MIN, widthAt } from "@/lib/market-table-cols";

const VIEWPORTS = [1280, 1300, 1365, 1366, 1399, 1400, 1439, 1440, 1536, 1920];
describe("market table column widths", () => {
  it.each(VIEWPORTS)("at %i px the default columns fit the box with 24 px to spare", (vw) => {
    expect(defaultSum(vw)).toBeLessThanOrEqual(boxAt(vw) - 24);
  });
  it("Market (the flexible column) gets at least 260 px at 1280 and 300 px at 1366", () => {
    for (const [vw, min] of [[1280, 260], [1366, 300]] as const) expect(marketAt(vw), `Market at ${vw}`).toBeGreaterThanOrEqual(min);
  });
  it("Volume added at 1280 still fits the box (it narrows Market instead of making the box scroll)", () => {
    const ids = [...DEFAULT_COLUMNS, "volume"];
    expect(ids.reduce((a, id) => a + widthAt(id, 1280), 0)).toBeLessThanOrEqual(boxAt(1280) - 24);
    expect(marketAt(1280, ids)).toBeGreaterThanOrEqual(MARKET_MIN);
  });
  it("Bet has room for 'Miami (OH) · 69% pays 1.41x' from 1440 px (240 px)", () => {
    expect(widthAt("bet", 1440)).toBe(240);
  });
  it("every column has a width, and the default list is the 10 default columns", () => {
    expect(DEFAULT_COLUMNS).toHaveLength(10);
    for (const id of DEFAULT_COLUMNS) expect(id in COL_CLASS, id).toBe(true);
    expect(COL_CLASS.market).toBe("");   // the one flexible column
    expect(Object.keys(COL_CLASS)).toHaveLength(23);
  });
});
