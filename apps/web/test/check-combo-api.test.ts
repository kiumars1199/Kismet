// F2: a leg lookup carries no model numbers; a combo counts once under the sorted set and shares F1's daily allowance.
import { beforeEach, describe, expect, it } from "vitest";
import { memoryLimiter, setLimiter } from "@/lib/abuse";
import { comboKey, countCheck } from "@/lib/check/limit";
import { buildLeg } from "@/lib/check/response";
import type { StoreMarket } from "@/lib/types";
import fixture from "./fixtures/markets.json";

const markets = (fixture as unknown as { markets: StoreMarket[] }).markets;

describe("leg lookup", () => {
  it("returns title, side, price, venue and nothing about the model", () => {
    const leg = buildLeg(markets[0]!, 0)!;
    expect(Object.keys(leg).sort()).toEqual(["market", "outcome", "price", "side", "venue"]);
    const text = JSON.stringify(leg);
    for (const k of ["winProb", "win_prob", "model", "edge", "score", "neff"]) expect(text).not.toContain(k);
    expect(Object.keys(leg.market).sort()).toEqual(["event", "event_id", "id", "question"]);
  });
});

describe("combo key and the shared Free allowance", () => {
  beforeEach(() => setLimiter(memoryLimiter()));
  const req = new Request("http://x/api/check/combo");
  const A = [{ m: "1", side: 0 }, { m: "2", side: 1 }], B = [{ m: "1", side: 0 }, { m: "3", side: 0 }];
  it("same set in any order is one key; a different set is another", () => {
    expect(comboKey(A)).toBe(comboKey([...A].reverse()));
    expect(comboKey(A)).not.toBe(comboKey(B));
    expect(comboKey([{ m: "1", side: 0 }, { m: "2", side: 0 }])).not.toBe(comboKey(A));
  });
  it("Free: a combo is one check; the same set again is free; another combo or a single check is refused", async () => {
    const t = Date.parse("2026-11-22T10:00:00Z");
    expect((await countCheck(req, "free", "u1", comboKey(A), 0, t)).ok).toBe(true);
    expect((await countCheck(req, "free", "u1", comboKey([...A].reverse()), 0, t)).ok).toBe(true);
    expect((await countCheck(req, "free", "u1", comboKey(B), 0, t)).ok).toBe(false);
    expect((await countCheck(req, "free", "u1", "some-market", 0, t)).ok).toBe(false);
  });
  it("Free: a single check first, then a combo is refused", async () => {
    const t = Date.parse("2026-11-22T10:00:00Z");
    expect((await countCheck(req, "free", "u2", "some-market", 0, t)).ok).toBe(true);
    expect((await countCheck(req, "free", "u2", comboKey(A), 0, t)).ok).toBe(false);
  });
  it("Pro: never counted", async () => {
    for (let i = 0; i < 5; i++) expect((await countCheck(req, "pro", "u3", comboKey([{ m: String(i), side: 0 }, { m: "z", side: 0 }]), 0)).ok).toBe(true);
  });
});
