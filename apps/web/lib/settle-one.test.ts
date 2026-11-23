// F11: a market still on the board must not look resolved. Only a closed market with a 1/0 (or 50/50) price settles.
import { afterEach, describe, expect, it, vi } from "vitest";
import { settleOne } from "./settle";

let n = 0;
function gamma(m: Record<string, unknown>) {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => String(url).includes("prices-history")
    ? new Response(JSON.stringify({ history: [] }), { status: 200 })
    : new Response(JSON.stringify(m), { status: 200 })));
  return `t${++n}`;
}
afterEach(() => vi.unstubAllGlobals());

describe("settleOne", () => {
  it("an open market priced at 0/1 is not resolved", async () => {
    expect((await settleOne(gamma({ closed: false, outcomePrices: '["1","0"]' }))).resolved).toBe(false);
  });
  it("a closed market with no final price (0.62/0.38) is not resolved", async () => {
    expect((await settleOne(gamma({ closed: true, outcomePrices: '["0.62","0.38"]' }))).resolved).toBe(false);
  });
  it("a closed market whose UMA resolution is still disputed is not resolved", async () => {
    expect((await settleOne(gamma({ closed: true, umaResolutionStatus: "disputed", outcomePrices: '["1","0"]' }))).resolved).toBe(false);
  });
  it("a closed, resolved 1/0 market settles to side 0; 50/50 is a void-split", async () => {
    expect(await settleOne(gamma({ closed: true, umaResolutionStatus: "resolved", outcomePrices: '["1","0"]' }))).toMatchObject({ resolved: true, winner_side_index: 0 });
    expect(await settleOne(gamma({ closed: true, outcomePrices: '["0.5","0.5"]' }))).toMatchObject({ resolved: true, winner_side_index: null });
  });
});
