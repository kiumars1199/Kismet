import { describe, expect, it } from "vitest";
import { getStoreFor } from "@/lib/data/store";
import { chanceLine } from "@/lib/card";
import { gateMarket } from "@/lib/data/gate";
import { betFacts } from "./bet-facts";

describe("betFacts (share image text)", () => {
  it("shows the Free card's banded chance, never the exact one, for 25 bets", async () => {
    const store = await getStoreFor("free");
    const ids = [...store.flagsById.keys()].slice(0, 25);
    expect(ids.length).toBe(25);
    for (const id of ids) {
      const f = betFacts(store, id)!;
      const exact = store.flagsById.get(id)!;
      expect(f.chance).toBe(chanceLine(gateMarket(exact, "free").best.win_prob));
      const pct = Number(/^(\d+)%/.exec(f.chance ?? "")?.[1] ?? 0);
      if (pct > 1 && pct < 99) expect(pct % 5).toBe(0);   // Free sees the chance in 5-point steps
    }
  });
  it("has a multiplier like 1.47x and no dollar amounts or cents", async () => {
    const store = await getStoreFor("free");
    const f = betFacts(store, [...store.flagsById.keys()][0]!)!;
    expect(f.mult).toMatch(/^\d+(\.\d+)?x$/);
    expect(JSON.stringify(f)).not.toMatch(/\$|¢|cents/);
  });
  it("null for an unknown id; the requested side when given", async () => {
    const store = await getStoreFor("free");
    expect(betFacts(store, "nope")).toBeNull();
    const id = [...store.flagsById.keys()][0]!;
    expect(betFacts(store, id, 0)!.side).not.toBe(betFacts(store, id, 1)!.side);
  });
});
