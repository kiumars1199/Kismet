import { describe, expect, it } from "vitest";
import { getStoreFor } from "@/lib/data/store";
import { betFigures } from "@/lib/betFigures";
import { gateMarket } from "@/lib/data/gate";
import { betFacts } from "./bet-facts";

describe("betFacts (share image text)", () => {
  it("says what the drawer says for the same Free-banded side (pays, wins about, won before), for 25 bets", async () => {
    const store = await getStoreFor("free");
    const ids = [...store.flagsById.keys()].slice(0, 25);
    expect(ids.length).toBe(25);
    for (const id of ids) {
      const f = betFacts(store, id)!;
      const m = gateMarket(store.flagsById.get(id)!, "free");
      const d = betFigures(m.best, { market: m });
      expect(f.mult ?? "—").toBe(d.pays);
      expect(f.chance).toBe(d.wins === "—" ? null : `Bets like this won ${/^over/.test(d.wins) ? "" : "about "}${d.wins} before`);
      if (f.chance) expect(f.chance).not.toMatch(/%/);   // one figure, said once
      const pct = Math.round(Number(m.best.win_prob) * 100);
      if (pct > 1 && pct < 99) expect(pct % 5).toBe(0);   // Free sees the chance in 5-point steps, never the exact one
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
