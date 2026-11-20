// T-296: /track-record plain-words helpers. US record first, each bet once, events as the sample, honest test span.
import { describe, expect, it } from "vitest";
import fixture from "@/test/fixtures/backtest.json";
import { ret } from "@/lib/format";
import { siteProof } from "@/lib/proof";
import type { BacktestFile, LedgerStats, LedgerSummary } from "@/lib/types";
import {
  biggestGroup, compareSentence, eventsNeeded, eventsOf, intlOnlyNote, liveBase, liveHeadline, ratedHigher, testHeadline, testSpanText,
  testWeeks, trackProof, usHeadline, weeksHeadline,
} from "./summary";

const b = fixture as unknown as BacktestFile;
const taker = b.results[String(b.chosen_half_life_days ?? "None")].taker;
const S = (graded: number, wins: number, avg_pnl: number, events?: number, entries = graded): LedgerStats =>
  ({ entries, graded, wins, losses: graded - wins, avg_pnl, avg_clv: null, events });
const NOV17 = Date.UTC(2026, 10, 17) / 1000;

// raw rows (re-flags counted twice) vs each bet once; one cent per share either way so returns are easy to read
const raw = S(862, 667, -0.017, 179, 2687);
const first = S(593, 460, -0.0056, 179, 2294);
const base: LedgerSummary = { ...raw, by_category: { weather: S(547, 430, -0.002), sports: S(315, 237, -0.043) }, updated_at: NOV17 };

describe("live record: four states", () => {
  it("no ledger: says the record has not started", () => {
    expect(usHeadline(undefined).value).toBe("—");
    expect(liveHeadline(undefined, null).sentence).toMatch(/No live record/);
    expect(intlOnlyNote(undefined)).toBeNull();
  });
  it("ledger written before the US venue (no `us`, no `first`): falls back to the raw rows", () => {
    expect(usHeadline(base)).toMatchObject({ value: "—" });
    expect(usHeadline(base).sentence).toMatch(/No bets on Polymarket US logged yet/);
    expect(liveBase(base)).toBe(base);
    expect(liveHeadline(base, "Nov 17").sentence).toMatch(/^Return on 862 settled bets in 179 events logged since Nov 17/);
  });
  it("US bets logged but none settled", () => {
    const l = { ...base, first, us: { ...S(0, 0, 0, 0, 12), avg_pnl: null, by_category: {} } };
    expect(usHeadline(l)).toEqual({ value: "—", tone: "flat", sentence: "12 best bets on Polymarket US logged at the US price, none settled yet." });
  });
  it("US record settled: leads with its return, events counted", () => {
    const u = S(40, 36, 0.05, 9);
    const l = { ...base, first, us: { ...u, by_category: {} }, intl_only: S(553, 424, -0.01) };
    const h = usHeadline(l);
    expect(h.tone).toBe("pos");
    expect(h.value).toBe(ret((40 * 0.05) / (36 - 40 * 0.05) * 100));
    expect(h.sentence).toMatch(/^Return on 40 settled bets in 9 events you could place on Polymarket US/);
    // headline whole record uses `first` (each bet once), not the raw rows
    expect(liveHeadline(l, null).sentence).toMatch(/^Return on 593 settled bets in 179 events/);
    expect(intlOnlyNote(l)).toBe("Including international-only bets US users couldn't place: 553 (mostly weather).");
  });
});

describe("event counts from rows without event ids", () => {
  it("are not shown as a sample size, and the live line makes no 'enough' call on them", () => {
    const l = { ...base, first: S(742, 573, 0.0103, 739) };
    expect(eventsOf(l.first)).toBeNull();
    expect(eventsOf(first)).toBe(179);
    expect(liveHeadline(l, null).sentence).toMatch(/^Return on 742 settled bets logged,/);
    const p = trackProof(siteProof({ backtest: b, ledger: l, since: NOV17 }), b, l, NOV17);
    expect(p.live).toBe(`Live since Nov 17: 742 settled bets, ${ret(p.liveRoi)}.`);
    expect(p.enough).toBe(false);
    // no US rows logged yet: every bet would read as international-only, so no note
    expect(intlOnlyNote({ ...l, intl_only: S(742, 573, 0.01) })).toBeNull();
  });
});

describe("test span from folds[], not folds × days", () => {
  const w = testWeeks(b);
  it("counts weeks with bets and the share in the last two weeks", () => {
    expect(w.weeks).toBe(12);
    expect(w.withBets).toBe(8);
    expect(w.total).toBe(taker.flags);
    expect(w.lastTwoShare).toBeCloseTo((4532 + 4619) / 9666, 6);
  });
  it("reads as dates, never as '1 year'", () => {
    expect(testSpanText(w)).toBe("past markets from Aug 29 to Nov 14, 95% of bets in the last 2 weeks");
    expect(testHeadline(taker, w).sentence).not.toMatch(/year/);
    expect(testSpanText(testWeeks(null))).toBe("past markets");
    // a span across New Year names both years
    const ny = { first: Date.UTC(2025, 10, 30) / 1000, last: Date.UTC(2026, 10, 14) / 1000, weeks: 50, withBets: 42, total: 100, lastTwoShare: 0.86 };
    expect(testSpanText(ny)).toBe("past markets from Nov 30, 2025 to Nov 14, 2026, 86% of bets in the last 2 weeks");
  });
});

describe("proof line for this page", () => {
  it("keeps the test return and the 'Testing: ' basis, judges live on events", () => {
    const l = { ...base, first };
    const p = trackProof(siteProof({ backtest: b, ledger: l, since: NOV17 }), b, l, NOV17);
    expect(p.test).toBe(`In testing on past markets from Aug 29 to Nov 14, 95% of bets in the last 2 weeks: best bets, ${ret(taker.roi_pct)} per bet.`);
    expect(p.help).toMatch(/^Testing: /);
    const need = eventsNeeded(taker)!;
    expect(need).toBe(Math.ceil(1394 * (2 / 18.51) ** 2));
    expect(p.live).toBe(`Live since Nov 17: 593 settled bets in 179 events, ${ret(p.liveRoi)}, enough to compare with testing.`);
    const few = { ...l, first: S(20, 15, -0.01, 4) };
    expect(trackProof(siteProof({ backtest: b, ledger: few, since: NOV17 }), b, few, NOV17).live)
      .toBe(`Live since Nov 17: 20 settled bets in 4 events, ${ret((-0.2 / 15.2) * 100)}, still too few to judge (needs ~${need} events).`);
  });
  it("no events needed when the test lost money", () => {
    expect(eventsNeeded({ ...taker, roi_pct: -1 })).toBeNull();
  });
});

describe("headlines", () => {
  it("compares live with test in one sentence", () => {
    expect(compareSentence({ ...base, first }, taker)).toMatch(/^So far live bets are doing worse than testing/);
    expect(compareSentence(undefined, taker)).toBeNull();
  });
  it("retitles the edge section only when every big group earns more than the one below", () => {
    expect(ratedHigher([{ bets: 100, realized: 2 }, { bets: 100, realized: 3 }, { bets: 100, realized: 5 }]).title).toBe("Bets we rated higher did better");
    // production Nov 20: 13.1, 14.0, 10.2, 16.9 — not monotonic, keep the question
    expect(ratedHigher([{ bets: 9e3, realized: 13.1 }, { bets: 9e3, realized: 14 }, { bets: 5e3, realized: 10.2 }, { bets: 3e3, realized: 16.9 }]).holds).toBe(false);
    // a tiny group out of order does not count
    expect(ratedHigher([{ bets: 100, realized: 2 }, { bets: 5, realized: 0 }, { bets: 100, realized: 4 }]).holds).toBe(true);
  });
  it("weeks: N of M up, and flags a test that sits in its last two weeks", () => {
    const h = weeksHeadline([{ bets: 0, dir: "none" }, { bets: 10, dir: "down" }, { bets: 90, dir: "up" }, { bets: 100, dir: "up" }]);
    expect(h.value).toBe("2 of 3");
    expect(h.sentence).toMatch(/95% of all test bets come from the last two weeks/);
  });
  it("groups: counts only groups with enough bets", () => {
    const h = biggestGroup([
      { name: "Sports", r: { flags: 500, roi_pct: 12 } }, { name: "Weather", r: { flags: 100, roi_pct: -3 } }, { name: "Tiny", r: { flags: 3, roi_pct: 90 } },
    ], "Categories")!;
    expect(h.value).toBe("1 of 2");
    expect(h.sentence).toBe("Categories with at least 30 test bets made money. The biggest, Sports, returned +12%.");
  });
});
