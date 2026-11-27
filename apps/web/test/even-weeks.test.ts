// Nov 21 (Q on #6): the site leads with backtest.json's even_weeks run when it has best bets.
import { describe, expect, it } from "vitest";
import { chosenResult, headlineBacktest } from "@/lib/data/model";
import { evenNote, siteProof, testSpan } from "@/lib/proof";
import type { BacktestFile } from "@/lib/types";

const W = 604_800, T0 = 1_764_720_000;   // Dec 3 2025
const run = (weeks: number[], roi: number, flags: number, hl: number | null): BacktestFile => ({
  chosen_half_life_days: hl, test_days: 7, folds: weeks.length, ran_at: T0 + 60 * W,
  results: { [String(hl ?? "None")]: {
    taker: { flags, events: Math.round(flags / 2), win_rate: 0.78, roi_pct: roi, t_stat: 5 },
    folds: weeks.map((n, i) => ({ start: T0 + i * W, flags: n })),
  } },
} as unknown as BacktestFile);

// production: almost every bet in the last two weeks; even: bets spread over most weeks
const prod = run([...Array(50).fill(0).map((_, i) => (i % 10 === 0 ? 5 : 0)), 400, 380], 11, 805, 90);
const even = { ...run(Array(52).fill(0).map((_, i) => (i < 10 ? 0 : 70)), 6.4, 2940, null), sample: { days: 365, window_days: 30, per_window: 150, per_niche_month: 300 } };

describe("headlineBacktest", () => {
  it("serves the even run with the production run kept as `concentrated`", () => {
    const h = headlineBacktest({ ...prod, even_weeks: even } as BacktestFile);
    expect(chosenResult(h)?.taker.roi_pct).toBe(6.4);
    expect(h.chosen_half_life_days).toBeNull();
    expect(chosenResult(h.concentrated!)?.taker.roi_pct).toBe(11);
    expect(h.concentrated!.even_weeks).toBeUndefined();
    expect(headlineBacktest(h)).toBe(h);   // idempotent (the store rebuilds from its own copy)
  });
  it("falls back to the file as is without a usable even run", () => {
    expect(headlineBacktest(prod)).toBe(prod);
    const empty = { ...prod, even_weeks: run([0, 0], 0, 0, null) } as BacktestFile;
    expect(headlineBacktest(empty)).toBe(empty);
    expect(headlineBacktest({} as BacktestFile)).toEqual({});
  });
  it("headline and span read the even run; the note names the production figure as secondary", () => {
    const h = headlineBacktest({ ...prod, even_weeks: even } as BacktestFile);
    const p = siteProof({ backtest: h, ledger: null, since: null });
    expect(p.test).toContain("+6.4% per bet");
    expect(testSpan(h)).toContain("bets in 42 of 52 weeks");
    const note = evenNote(h)!;
    expect(note).toContain("sampled evenly across the year (up to 150");
    expect(note).toMatch(/\+11(\.0)?% per bet over 805 bets/);
    expect(evenNote(prod)).toBeNull();
  });
});
