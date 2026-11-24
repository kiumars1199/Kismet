import { describe, expect, it } from "vitest";
import { combo } from "@/lib/combos";
import { addLeg, checkCombo, MAX_COMBO_LEGS, NOT_SCORED_SAME_EVENT, sameEventAdvice, type ComboLeg } from "./combo";
import { score } from "./score";

const leg = (id: string, ask: number, fee: number, q: number | null, o: Partial<ComboLeg> = {}): ComboLeg => ({
  key: `${id}:0`, marketId: id, side: 0, question: `Q${id}`, outcome: "Yes", eventId: `e${id}`, event: `Event ${id}`,
  base: { winProb: q, n: 400, ask, fee, edge: null, feeRate: 0, venue: "intl" }, ...o,
});

describe("checkCombo", () => {
  it("2 legs: hand-computed chance, multiplier, edge, score", () => {
    const r = checkCombo([leg("1", 0.5, 0, 0.6), leg("2", 0.4, 0, 0.5)]);
    expect(r.numbers!.chance).toBeCloseTo(0.3, 12);            // 0.6 × 0.5
    expect(r.numbers!.multiplier).toBeCloseTo(5, 9);           // 2 × 2.5
    expect(r.numbers!.edge).toBeCloseTo(0.3 - 0.2, 12);        // chance − 1/5
    expect(r.numbers!.score).toBe(score(0.1, 400));
  });
  it("3 legs with fees", () => {
    const legs = [leg("1", 0.5, 0.01, 0.6), leg("2", 0.3, 0.02, 0.4), leg("3", 0.7, 0.01, 0.8)];
    const r = checkCombo(legs).numbers!;
    expect(r.chance).toBeCloseTo(0.6 * 0.4 * 0.8, 12);
    expect(r.multiplier).toBeCloseTo(1 / (0.51 * 0.32 * 0.71), 9);
  });
  it("10 legs", () => {
    const legs = Array.from({ length: 10 }, (_, i) => leg(String(i), 0.8, 0, 0.9));
    const r = checkCombo(legs).numbers!;
    expect(r.chance).toBeCloseTo(0.9 ** 10, 12);
    expect(r.multiplier).toBeCloseTo(1.25 ** 10, 9);
  });
  it("score uses the smallest leg sample", () => {
    const small = leg("2", 0.4, 0, 0.5); small.base.n = 100;
    const r = checkCombo([leg("1", 0.5, 0, 0.6), small]).numbers!;
    expect(r.score).toBe(score(r.edge, 100));
  });
  it("agrees with the combo tray (lib/combos.ts combo) for the same legs", () => {
    const legs = [leg("1", 0.5, 0.01, 0.6), leg("2", 0.3, 0.02, 0.4), leg("3", 0.7, 0.01, 0.8)];
    const c = combo(legs.map((l) => ({ ask: l.base.ask, fee: l.base.fee, q: l.base.winProb!, q_low: l.base.winProb!, event_id: l.eventId, event: l.event })));
    const r = checkCombo(legs).numbers!;
    expect(r.multiplier).toBeCloseTo(c.pays, 9);
    expect(r.chance).toBeCloseTo(c.q, 12);
  });
  it("same-event legs are flagged", () => {
    const r = checkCombo([leg("1", 0.5, 0, 0.6, { eventId: "x", event: "Game" }), leg("2", 0.4, 0, 0.5, { eventId: "x", event: "Game" }), leg("3", 0.4, 0, 0.5)]);
    expect(r.sameEvent).toEqual(["Game"]);
    expect(checkCombo([leg("1", 0.5, 0, 0.6), leg("2", 0.4, 0, 0.5)]).sameEvent).toEqual([]);
  });
  it("same-event legs: no score (null), chance, payout and edge stay; the note says why; other combos still score", () => {
    const same = checkCombo([leg("1", 0.5, 0, 0.6, { eventId: "x", event: "Game" }), leg("2", 0.4, 0, 0.5, { eventId: "x", event: "Game" })]);
    expect(same.numbers!.score).toBeNull();
    expect(same.numbers!.chance).toBeCloseTo(0.3, 12);
    expect(same.numbers!.multiplier).toBeCloseTo(5, 9);
    expect(same.scoreNote).toBe(NOT_SCORED_SAME_EVENT);
    expect(NOT_SCORED_SAME_EVENT).toBe("Not scored: legs from the same event");
    const other = checkCombo([leg("1", 0.5, 0, 0.6), leg("2", 0.4, 0, 0.5)]);
    expect(other.numbers!.score).not.toBeNull();
    expect(other.scoreNote).toBeNull();
  });
  it("a 3-leg combo with two same-event legs is not scored, and no drop suggestion cites a score", () => {
    const r = checkCombo([leg("1", 0.5, 0, 0.6, { eventId: "x", event: "Game" }), leg("2", 0.4, 0, 0.5, { eventId: "x", event: "Game" }), leg("3", 0.4, 0, 0.5)]);
    expect(r.numbers!.score).toBeNull();
    expect(r.scoreNote).toBe(NOT_SCORED_SAME_EVENT);
  });
  it("suggests dropping the leg whose removal raises the score most, with the new numbers", () => {
    const legs = [leg("1", 0.5, 0, 0.7), leg("bad", 0.6, 0, 0.3), leg("3", 0.5, 0, 0.7)];
    const r = checkCombo(legs);
    expect(r.drop!.index).toBe(1);
    expect(r.drop!.numbers.score!).toBeGreaterThan(r.numbers!.score!);
    expect(r.drop!.numbers.legs).toBe(2);
  });
  it("one leg → too few; a leg with no model chance blocks and is named", () => {
    expect(checkCombo([leg("1", 0.5, 0, 0.6)]).error).toBe("too_few");
    const r = checkCombo([leg("1", 0.5, 0, 0.6), leg("2", 0.4, 0, null)]);
    expect(r.error).toBe("no_model");
    expect(r.noModel).toBe("Q2");
    expect(r.numbers).toBeNull();
  });
  it("two legs: nothing to drop (the combo would be one leg)", () => {
    expect(checkCombo([leg("1", 0.5, 0, 0.6), leg("2", 0.4, 0, 0.5)]).drop).toBeNull();
  });
});

describe("addLeg", () => {
  it("refuses a duplicate market (either side) and an 11th leg", () => {
    const a = leg("1", 0.5, 0, 0.6);
    expect(addLeg([a], { ...a, side: 1, key: "1:1" }).refused).toBe("duplicate");
    let legs: ComboLeg[] = [];
    for (let i = 0; i < MAX_COMBO_LEGS; i++) legs = addLeg(legs, leg(String(i), 0.5, 0, 0.6)).legs;
    expect(legs).toHaveLength(10);
    expect(addLeg(legs, leg("x", 0.5, 0, 0.6))).toEqual({ legs, refused: "full" });
  });
});

describe("sameEventAdvice (no score, so say which leg to drop)", () => {
  const e = (id: string, ev: string, evId: string) => leg(id, 0.5, 0, 0.6, { eventId: evId, event: ev });
  it("two legs: 'Drop one of the two <event> bets.'; more: keep one; clean event name", () => {
    expect(sameEventAdvice([e("1", "Denmark vs. Norway - More Markets", "x"), e("2", "Denmark vs. Norway - More Markets", "x"), e("3", "Other", "y")])).toEqual(["Drop one of the two Denmark vs. Norway bets."]);
    expect(sameEventAdvice([e("1", "Game", "x"), e("2", "Game", "x"), e("3", "Game", "x")])).toEqual(["Keep one of the 3 Game bets and drop the rest."]);
    expect(sameEventAdvice([e("1", "A", "x"), e("2", "A", "x"), e("3", "B", "y"), e("4", "B", "y")])).toEqual(["Drop one of the two A bets.", "Drop one of the two B bets."]);
    expect(sameEventAdvice([e("1", "A", "x"), e("2", "B", "y")])).toEqual([]);
  });
});

