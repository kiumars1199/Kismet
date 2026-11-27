// T-wt3c (F2 "Done when": the combo tray's multiplier and the checker's agree for the same legs): one payout rule (the venue-aware
// betQuote price of each leg, fee included) and one chance rule (the cautious chance, docs/18 §5 "one chance on screen", Marc #15/#74).
import { describe, expect, it } from "vitest";
import { buildStore, loadRaw } from "@/lib/data/store";
import { combo, legOf, legProblem, comboPrice } from "@/lib/combos";
import { comboBaseOf } from "@/lib/check/compute";
import { checkCombo, type ComboLeg } from "@/lib/check/combo";
import type { StoreMarket } from "@/lib/types";

async function threeLegs() {
  const s = buildStore(await loadRaw());
  const all = [...s.byId.values()] as StoreMarket[];
  const pick: StoreMarket[] = [];
  // at least one leg on a US-listed card (the case that disagreed: the tray priced it at the international fee)
  for (const m of all.filter((x) => !!x.us && x.venue !== "us")) { if (!pick.some((p) => p.event_id === m.event_id)) pick.push(m); if (pick.length === 1) break; }
  for (const m of all) { if (pick.length >= 3) break; if (!pick.some((p) => p.event_id === m.event_id)) pick.push(m); }
  return pick;
}
const trayLegs = (ms: StoreMarket[]) => ms.map((m) => legOf(m, m.best));
const checkerLegs = (ms: StoreMarket[]): ComboLeg[] => ms.map((m) => ({ key: `${m.id}:${m.best.side_index}`, marketId: m.id, side: m.best.side_index, question: m.question, outcome: m.best.outcome, eventId: m.event_id, event: m.event, base: comboBaseOf(m, m.best) }));

describe("tray and checker agree for the same legs", () => {
  it("the same multiplier and the same chance, with a US-listed leg among them", async () => {
    const ms = await threeLegs();
    expect(ms).toHaveLength(3);
    expect(ms.some((m) => !!m.us)).toBe(true);
    const tray = combo(trayLegs(ms));
    const n = checkCombo(checkerLegs(ms)).numbers!;
    expect(n.multiplier).toBeCloseTo(tray.pays, 9);
    expect(n.chance).toBeCloseTo(tray.q_low, 12);   // the cautious chance on both
    expect(n.edge > 0).toBe(tray.has_edge);          // "beats the price" reads the same on both
    expect(n.edge).toBeCloseTo(tray.q_low - 1 / tray.pays, 9);
  });
  it("a leg's price is the card's (betQuote): the tray no longer uses the international ask and fee on a US card", async () => {
    const ms = await threeLegs();
    const us = ms.find((m) => !!m.us)!;
    const leg = legOf(us, us.best);
    const base = comboBaseOf(us, us.best);
    expect(leg.ask).toBe(base.ask);
    expect(leg.fee).toBe(base.fee);
    expect(comboPrice([leg])).toBeCloseTo(base.ask + base.fee, 12);
  });
  it("the payout is one function: comboPrice is the product of (ask + fee)", () => {
    expect(comboPrice([{ ask: 0.5, fee: 0.01 }, { ask: 0.4, fee: 0.02 }])).toBeCloseTo(0.51 * 0.42, 12);
  });
});

describe("the tray still refuses same-event legs, and says where to check them", () => {
  it("names the combo checker", () => {
    const leg = { market_id: "2", event_id: "e1", event: "Game", question: "Q", closes_at: undefined };
    const msg = legProblem(leg, [{ market_id: "1", event_id: "e1" }], 1);
    expect(msg).toContain("Results in one event move together, so pick a different event.");
    expect(msg).toContain("You can still check them together in the combo checker.");
  });
});
