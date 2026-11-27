// T-wt3e (#107 review notes): N3 one chance on screen, N2 old saved legs re-quoted, N4 the pruned-leg note.
import { describe, expect, it } from "vitest";
import { buildStore, loadRaw } from "@/lib/data/store";
import { comboBaseOf } from "@/lib/check/compute";
import { legLine } from "@/lib/check/combo";
import { chanceLine } from "@/lib/card";
import { droppedNote, legOf, LEG_V, requoteLeg } from "@/lib/combos";
import { betQuote } from "@/lib/betFigures";
import type { StoreMarket } from "@/lib/types";

async function usMarket() {
  const s = buildStore(await loadRaw());
  return [...s.byId.values()].find((m) => !!m.us && m.venue !== "us") as StoreMarket;
}

describe("N3: the checker's leg chance is labelled like the tray's, and is never above the card's number", () => {
  it("one bet: the card shows the central chance, the checker line shows the cautious one and says so", async () => {
    const m = await usMarket();
    const s = m.best;
    const card = chanceLine(s.win_prob);                       // BetCard and drawer headline: "88% chance to win"
    const line = legLine({ outcome: s.outcome, price: s.ask }, comboBaseOf(m, s));
    const lowPct = Math.round(s.win_prob_low * 100);
    expect(line).toContain(`${lowPct}% chance (cautious)`);
    expect(line).toMatch(/pays \d/);
    const cardPct = Number(/^(\d+)%/.exec(card)?.[1] ?? NaN);
    if (Number.isFinite(cardPct)) expect(lowPct).toBeLessThanOrEqual(cardPct);   // cautious never reads higher than the card
    expect(line).not.toBe(card);
  });
  it("no model chance, and no numbers before a leg is scored", () => {
    expect(legLine({ outcome: "Yes", price: 0.5 })).toBe("Bet Yes at 50%");
    expect(legLine({ outcome: "Yes", price: 0.5 }, { winProb: null, n: null, ask: 0.5, fee: 0.01, edge: null, feeRate: 0, venue: "intl" })).toContain("No model chance");
  });
});

describe("N2: tray legs saved before the deploy are re-quoted through betQuote", () => {
  it("an old leg (international ask and fee on a US card) gets the card's price and the version mark; the rest is kept", async () => {
    const m = await usMarket();
    const s = m.best;
    const fresh = legOf(m, s);
    expect(fresh.v).toBe(LEG_V);
    const old = { ...fresh, ask: s.ask, fee: s.fee, v: undefined, closes_at: 123 };
    delete (old as { v?: number }).v;
    const q = betQuote(m, s);
    const out = requoteLeg(old, m, s);
    expect(out.ask).toBe(q.ask);
    expect(out.fee).toBe(q.fee);
    expect(out.v).toBe(LEG_V);
    expect(out.closes_at).toBe(123);
    expect(out.market_id).toBe(old.market_id);
    expect(m.us!.ask !== s.ask || m.us!.fee !== s.fee).toBe(true);   // the fixture case really differs, so this test can fail
  });
});

describe("N4: the pruned-leg note", () => {
  it("says it plainly, singular and plural", () => {
    expect(droppedNote(1)).toBe("One bet left your combo because it closed.");
    expect(droppedNote(3)).toBe("3 bets left your combo because they closed.");
    expect(droppedNote(0)).toBe("");
  });
});
