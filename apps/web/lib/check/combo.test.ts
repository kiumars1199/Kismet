import { describe, expect, it } from "vitest";
import { combo } from "@/lib/combos";
import { addLeg, checkCombo, legLine, MAX_COMBO_LEGS, NOT_SCORED_SAME_EVENT, sameEventAdvice, type ComboLeg } from "./combo";
import { score } from "./score";
import { paysAfterFee } from "./pays";

describe("pays after the fee below 1x (T-wt3i)", () => {
  it("a price of 0.999 plus its fee pays less than 1x, and says so", () => {
    expect(paysAfterFee(1 / (0.9995 + 0.001))).toBe("less than 1x");
    expect(paysAfterFee(1 / (0.999 + 0.0004))).toBe("1.00x");
    expect(paysAfterFee(1)).toBe("1.00x");
    expect(paysAfterFee(1.47)).toBe("1.47x");
    expect(legLine({ outcome: "No", price: 0.999 }, { winProb: 0.999, n: 100, ask: 0.9995, fee: 0.001, edge: null, feeRate: 0.02, venue: "intl" })).toBe("Bet No at >99% · >99% chance (cautious) · pays less than 1x");
  });
});

describe("legLine at the extremes (T-wt3h)", () => {
  it("a price of 0.999 reads >99%, not 100%, and 0.002 reads <1%", () => {
    expect(legLine({ outcome: "No", price: 0.999 })).toBe("Bet No at >99%");
    expect(legLine({ outcome: "Yes", price: 0.002 })).toBe("Bet Yes at <1%");
    expect(legLine({ outcome: "Yes", price: 0.68 })).toBe("Bet Yes at 68%");
  });
});

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

describe("sameEventAdvice names the weaker leg once the legs are scored (T-wt3e)", () => {
  const e = (id: string, q: number | null, o: Partial<ComboLeg> = {}) => leg(id, 0.5, 0, q, { eventId: "x", event: "Denmark vs. Norway - More Markets", ...o });
  it("a pair: names the leg whose removal leaves the better combo; the line still starts 'Drop one of the two <event> bets.'", () => {
    const out = sameEventAdvice([e("1", 0.7), e("2", 0.55)]);
    expect(out).toEqual(['Drop one of the two Denmark vs. Norway bets. "Q2" (Yes) is the weaker one.']);
    expect(sameEventAdvice([e("1", 0.55), e("2", 0.7)])).toEqual(['Drop one of the two Denmark vs. Norway bets. "Q1" (Yes) is the weaker one.']);
  });
  it("equal legs: says either, names none", () => {
    expect(sameEventAdvice([e("1", 0.6), e("2", 0.6)])).toEqual(["Drop one of the two Denmark vs. Norway bets."]);
  });
  it("unscored legs (no model chance): no name", () => {
    expect(sameEventAdvice([e("1", null), e("2", 0.6)])).toEqual(["Drop one of the two Denmark vs. Norway bets."]);
  });
  it("a pair inside a bigger combo uses the whole combo; only the combo's own legs matter", () => {
    const legs = [e("1", 0.7), e("2", 0.55), leg("3", 0.5, 0, 0.6, { eventId: "y", event: "Other" })];
    expect(sameEventAdvice(legs)).toEqual(['Drop one of the two Denmark vs. Norway bets. "Q2" (Yes) is the weaker one.']);
  });
  it("3 or more from one event: unchanged", () => {
    expect(sameEventAdvice([e("1", 0.7), e("2", 0.55), e("3", 0.6)])).toEqual(["Keep one of the 3 Denmark vs. Norway bets and drop the rest."]);
  });
});

