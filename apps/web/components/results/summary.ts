// T-296: /track-record in plain words (docs/OVERHAUL.md §E, §G3). One headline per section, every figure read from
// backtest.json or ledger_summary.json, never typed in. Pure, so the page and the unit tests share it.
// Findings behind the wording: docs/research/live-vs-backtest.md.
import { chosenResult } from "@/lib/data/model";
import { exactCount, formatCount, pct, ret } from "@/lib/format";
import { JUDGE_T, liveReturn, sinceDay, type Proof } from "@/lib/proof";
import type { BacktestFile, BacktestRecord, LedgerStats, LedgerSummary } from "@/lib/types";
import type { WeekDir } from "@/lib/trackRecord";

/** Fewest bets a group needs before a section's headline uses it. */
export const MIN_BETS = 30;

export interface Headline { value: string; tone: "pos" | "neg" | "flat"; sentence: string }
const ok = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
const tone = (x: number | null | undefined): Headline["tone"] => (!ok(x) || x === 0 ? "flat" : x > 0 ? "pos" : "neg");
const bets = (n: number) => `${exactCount(n)} settled bet${n === 1 ? "" : "s"}`;
const evs = (n: number) => `${exactCount(n)} event${n === 1 ? "" : "s"}`;

/** The live record counted the honest way: each bet once (`first`, re-flags at a lower price dropped) when the
 *  summary has it, else the raw rows (summaries written before `first` existed). */
export const liveBase = (l: LedgerSummary | null | undefined): LedgerStats | null => (l ? (l.first ?? l) : null);

/** Distinct events among settled bets, from the US record only. engine/ledger.summarize groups by `event_id`, which
 *  rows logged before the US venue shipped don't have, so in `first` (and the raw totals) each of those markets counts
 *  as its own event (Nov 20 ledger: 739 "events" for 742 bets, really ~179 games and city-days), and that stays true
 *  as new rows arrive. Rows with a US price are all logged by the new code, which writes `event_id`, so the US
 *  record's count is the only one shown as a sample size until old rows get an `event_id`. */
export function usEvents(l: LedgerSummary | null | undefined): number | null {
  const u = l?.us;
  return u?.graded && ok(u.events) ? u.events : null;
}

/** Polymarket US record (the only venue US users can trade): settled US-listed bets at the US price and fee. */
export function usHeadline(l: LedgerSummary | null | undefined): Headline {
  const u = l?.us;
  if (!u?.graded) {
    return {
      value: "—", tone: "flat",
      sentence: u?.entries
        ? `${exactCount(u.entries)} best bet${u.entries === 1 ? "" : "s"} on Polymarket US logged at the US price, none settled yet.`
        : "No bets on Polymarket US logged yet. Every best bet listed there is logged at its US price and fee.",
    };
  }
  const r = liveReturn(u);
  return {
    value: ret(r), tone: tone(r),
    sentence: `Return on ${bets(u.graded)}${usEvents(l) !== null ? ` in ${evs(usEvents(l)!)}` : ""} you could place on Polymarket US, $1 a bet at the US price plus its fee.`,
  };
}

/** The whole live record (international prices), each bet counted once. */
export function liveHeadline(l: LedgerSummary | null | undefined, since: string | null): Headline {
  const s = liveBase(l);
  if (!s) return { value: "—", tone: "flat", sentence: "No live record on this data yet. It starts with the first logged best bet." };
  if (!s.graded) {
    return { value: "—", tone: "flat", sentence: `${formatCount(s.entries)} best bets logged${since ? ` since ${since}` : ""}, none settled yet.` };
  }
  const r = liveReturn(s);
  return {
    value: ret(r), tone: tone(r),
    sentence: `Return on ${bets(s.graded)} logged${since ? ` since ${since}` : ""}, $1 a bet at the real asking price plus the fee.`,
  };
}

/** "Including international-only bets US users couldn't place: N (mostly weather)." null when there are none. */
export function intlOnlyNote(l: LedgerSummary | null | undefined): string | null {
  const n = l?.intl_only?.graded;
  if (!l || !n || !l.us?.entries) return null;   // before US prices were logged every bet reads as international-only
  const top = Object.entries(l.by_category).sort((a, b) => b[1].graded - a[1].graded)[0];
  const mostly = top && top[1].graded * 2 > l.graded ? ` (mostly ${top[0]})` : "";
  return `Including international-only bets US users couldn't place: ${exactCount(n)}${mostly}.`;
}

/** Where the test's bets really fall: the weeks that had any, and the share in the last two weeks. Replaces
 *  "Testing on 1 year of past markets" (folds × days), which counts weeks with no bets as tested. */
export interface TestWeeks { first: number | null; last: number | null; weeks: number; withBets: number; total: number; lastTwoShare: number | null }
export function testWeeks(b: BacktestFile | null | undefined): TestWeeks {
  const folds = ((b && chosenResult(b)?.folds) ?? []) as (BacktestRecord & { start: number })[];
  const days = ok(b?.test_days) ? (b!.test_days as number) : 7;
  const has = folds.filter((f) => (f.flags ?? 0) > 0);
  const total = folds.reduce((s, f) => s + (f.flags ?? 0), 0);
  const lastTwo = folds.slice(-2).reduce((s, f) => s + (f.flags ?? 0), 0);
  return {
    first: has.length ? has[0].start : null,
    last: has.length ? has.at(-1)!.start + days * 86400 - 1 : null,
    weeks: folds.length, withBets: has.length, total,
    lastTwoShare: total ? lastTwo / total : null,
  };
}

/** "past markets from Aug 29 to Nov 13, 99% of bets in the last 2 weeks" */
export function testSpanText(w: TestWeeks): string {
  if (w.first === null || w.last === null) return "past markets";
  const tail = w.lastTwoShare !== null && w.lastTwoShare >= 0.5 ? `, ${pct(w.lastTwoShare)} of bets in the last 2 weeks` : "";
  const y = (t: number) => new Date(t * 1000).getUTCFullYear();
  const day = (t: number) => (y(w.first!) === y(w.last!) ? sinceDay(t) : `${sinceDay(t)}, ${y(t)}`);
  return `past markets from ${day(w.first)} to ${day(w.last)}${tail}`;
}

/** The testing card: the chosen walk-forward taker record. */
export function testHeadline(r: BacktestRecord | null | undefined, w: TestWeeks): Headline {
  if (!r?.flags) return { value: "—", tone: "flat", sentence: "No test has run on this data yet." };
  return {
    value: ret(r.roi_pct), tone: tone(r.roi_pct),
    sentence: `Return on ${formatCount(r.flags)} best bets on ${testSpanText(w)}, each picked by a model that only knew earlier weeks.`,
  };
}

/** Settled events the live record needs before it can be compared with the test: the test's events scaled by
 *  (JUDGE_T ÷ t)², the same rule as lib/proof betsNeeded but on events, the honest sample (bets on one game or one
 *  day's weather win or lose together). null when the test made no money or is too thin. */
export function eventsNeeded(r: BacktestRecord | null | undefined): number | null {
  if (!r || !ok(r.events) || r.events < MIN_BETS || !ok(r.roi_pct) || r.roi_pct <= 0 || !ok(r.t_stat) || r.t_stat <= 0) return null;
  return Math.max(1, Math.ceil(r.events * (JUDGE_T / r.t_stat) ** 2));
}

/** The site proof line with the §G3 corrections for this page: the test span from folds[] (not folds × days); the
 *  live record counted by bet once; and "enough to compare" judged on events, which only the US record counts
 *  reliably (see usEvents), so with no settled US bets no call is made. `help` is kept (it starts "Testing: "). */
export function trackProof(p: Proof, b: BacktestFile | null | undefined, l: LedgerSummary | null | undefined, since: number | null): Proof {
  const r = b ? chosenResult(b)?.taker : null;
  const test = r && ok(r.roi_pct) && r.flags
    ? `In testing on ${testSpanText(testWeeks(b))}: best bets, ${ret(r.roi_pct)} per bet${r.roi_pct < 0 ? " (lost money)" : ""}.`
    : null;
  const s = liveBase(l);
  const need = eventsNeeded(r);
  const head = since ? `Live since ${sinceDay(since)}` : "Live so far";
  const n = s?.graded ?? 0;
  const e = usEvents(l);
  const roi = liveReturn(s);
  const enough = need !== null && e !== null && e >= need;
  let live: string;
  if (!s) live = "Live record: starts with the first logged best bet.";
  else if (!n) live = `${head}: ${exactCount(s.entries)} logged, none settled yet.`;
  else {
    const us = e !== null ? `; on Polymarket US ${bets(l!.us!.graded)} in ${evs(e)}, ${ret(liveReturn(l!.us))}` : "";
    live = need === null || e === null ? `${head}: ${bets(n)}, ${ret(roi)}${us}.`
      : enough ? `${head}: ${bets(n)}, ${ret(roi)}${us}, enough to compare with testing.`
        : `${head}: ${bets(n)}, ${ret(roi)}${us}, still too few to judge (needs ~${formatCount(need)} events).`;
  }
  return { ...p, test, live, line: [test, live].filter(Boolean).join(" "), needs: need, settled: n, liveRoi: roi, enough };
}

/** One sentence that puts live and test side by side, without judging more than the numbers allow. */
export function compareSentence(l: LedgerSummary | null | undefined, r: BacktestRecord | null | undefined): string | null {
  const live = liveReturn(liveBase(l));
  if (live === null || !r?.flags || !ok(r.roi_pct)) return null;
  if (Math.abs(r.roi_pct - live) < 1) return "So far live bets are doing about as well as testing.";
  return live < r.roi_pct
    ? `So far live bets are doing worse than testing (${ret(live)} vs ${ret(r.roi_pct)}). The live record is young: bets on one game or one day's weather win or lose together, so a few results move it a lot.`
    : `So far live bets are doing better than testing (${ret(live)} vs ${ret(r.roi_pct)}). The live record is young, so this can change quickly.`;
}

/** Week by week: "N of M weeks made money", plus how much of the test sits in its last two weeks. */
export function weeksHeadline(rows: { bets: number; dir: WeekDir }[]): { value: string; sentence: string; lastTwoShare: number | null } {
  const withBets = rows.filter((x) => x.bets > 0);
  const up = rows.filter((x) => x.dir === "up").length;
  const total = rows.reduce((s, x) => s + x.bets, 0);
  const lastTwo = rows.slice(-2).reduce((s, x) => s + x.bets, 0);
  const share = total ? lastTwo / total : null;
  const tail = share !== null && share >= 0.5 ? ` ${pct(share)} of all test bets come from the last two weeks.` : "";
  return {
    value: `${up} of ${withBets.length}`,
    sentence: `test weeks with best bets made money. Each bar is one week; red weeks lost money.${tail}`,
    lastTwoShare: share,
  };
}

/** "Bets we rated higher did better" only while the test says so: the actual result rises with the rating across
 *  every edge group of at least MIN_BETS bets (and there are at least two such groups). */
export function ratedHigher(rows: { bets: number; realized: number }[]): { holds: boolean; title: string; sentence: string } {
  const g = rows.filter((x) => x.bets >= MIN_BETS);
  const holds = g.length >= 2 && g.every((x, i) => i === 0 || x.realized >= g[i - 1].realized) && g.at(-1)!.realized > g[0].realized;
  return holds
    ? { holds, title: "Bets we rated higher did better", sentence: "In testing, each step up in our rating earned more per bet than the step below." }
    : { holds, title: "Did bets we rated higher do better?", sentence: "In testing, not consistently: a higher rating did not always earn more per bet." };
}

/** By category / by time before close: how many groups made money, and the biggest one. */
export function biggestGroup<T extends { name: string; r: BacktestRecord }>(rows: T[], what: string): Headline | null {
  const big = rows.filter((x) => (x.r.flags ?? 0) >= MIN_BETS);
  const top = [...big].sort((a, b) => (b.r.flags ?? 0) - (a.r.flags ?? 0))[0];
  if (!top) return null;
  const made = big.filter((x) => (x.r.roi_pct ?? 0) > 0).length;
  return {
    value: `${made} of ${big.length}`, tone: made === big.length ? "pos" : made === 0 ? "neg" : "flat",
    sentence: `${what} with at least ${MIN_BETS} test bets made money. The biggest, ${top.name}, returned ${ret(top.r.roi_pct)}.`,
  };
}

/** By payout: share of best bets that pay under 1.5x. */
export function paysHeadline(best: Record<string, BacktestRecord | undefined> | undefined): Headline | null {
  const all = Object.values(best ?? {}).reduce((s, x) => s + (x?.flags ?? 0), 0);
  const low = best?.["<1.5x"]?.flags ?? 0;
  if (!all) return null;
  return { value: pct(low / all), tone: "flat", sentence: "of best bets pay less than 1.5x: they win often and pay little, so one loss undoes several wins." };
}
