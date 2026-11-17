import { describe, expect, it } from "vitest";
import { combo, comboLabel, kalshiComboEdge } from "./combos";
import { winsAbout } from "./format";

// Hand-computed (docs/18 §5): A 60¢+1¢ fee, q 70%, low 65%; B 50¢+1¢, q 58%, low 54%; C 80¢+0.8¢, q 86%, low 82%.
const A = { ask: 0.6, fee: 0.01, q: 0.7, q_low: 0.65, event_id: "e1", event: "Event 1" };
const B = { ask: 0.5, fee: 0.01, q: 0.58, q_low: 0.54, event_id: "e2", event: "Event 2" };
const C = { ask: 0.8, fee: 0.008, q: 0.86, q_low: 0.82, event_id: "e3", event: "Event 3" };

describe("combo math", () => {
  it("two independent legs", () => {
    const c = combo([A, B]);
    expect(c.q).toBeCloseTo(0.406, 6);          // 0.70 × 0.58
    expect(c.q_low).toBeCloseTo(0.351, 6);      // 0.65 × 0.54
    expect(c.price).toBeCloseTo(0.3111, 6);     // 0.61 × 0.51
    expect(c.pays).toBeCloseTo(3.2144, 3);
    expect(c.ret).toBeCloseTo(0.30505, 4);      // (0.70/0.61)(0.58/0.51) − 1
    expect(c.has_edge).toBe(true);              // 0.351 > 0.3111
    expect(c.same_event).toEqual([]);
    expect(comboLabel(c, winsAbout(c.q))).toBe("Combo · 2 legs · pays 3.2x · wins about 1 in 2");
  });
  it("three legs: bigger return, lower chance", () => {
    const c = combo([A, B, C]);
    expect(c.q).toBeCloseTo(0.34916, 6);        // 0.406 × 0.86
    expect(c.q_low).toBeCloseTo(0.28782, 6);    // 0.351 × 0.82
    expect(c.price).toBeCloseTo(0.2513688, 7);  // 0.3111 × 0.808
    expect(c.ret).toBeCloseTo(0.389035, 5);     // 0.34916 / 0.2513688 − 1
    expect(c.has_edge).toBe(true);
    expect(c.ret).toBeGreaterThan(combo([A, B]).ret);
    expect(c.q).toBeLessThan(combo([A, B]).q);
  });
  it("no edge when the cautious chance doesn't beat the price", () => {
    const c = combo([{ ...A, q_low: 0.55 }, { ...B, q_low: 0.5 }]);   // 0.275 < 0.3111
    expect(c.has_edge).toBe(false);
    expect(c.ret).toBeGreaterThan(0);   // the headline return alone would have looked fine
  });
  it("warns on same-event legs", () => {
    expect(combo([A, { ...B, event_id: "e1", event: "Event 1" }, C]).same_event).toEqual(["Event 1"]);
  });
  it("Kalshi combo edge = Q − ask − fee(ask)", () => {
    const k = kalshiComboEdge(0.406, 30);   // fee = ceil(7 × 0.30 × 0.70)¢ = ceil(1.47)¢ = 2¢
    expect(k.fee).toBeCloseTo(0.02, 6);
    expect(k.edge).toBeCloseTo(0.086, 6);   // 0.406 − 0.30 − 0.02
    expect(k.ret).toBeCloseTo(0.26875, 5);  // 0.086 / 0.32
  });
});
