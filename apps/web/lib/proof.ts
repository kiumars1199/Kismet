// T-290 (outside tester, Nov 20): wherever the backtest return appears, the live record sits next to it, in one line,
// with every figure computed from backtest.json and ledger_summary.json (never typed in). Pure: server pages, the
// drawer, the MCP text and llms.txt all call proofLine, so they can't drift apart.
import { exactCount, formatCount, ret } from "@/lib/format";
import { chosenResult } from "@/lib/data/model";
import type { BacktestFile, BacktestRecord, LedgerStats, LedgerSummary } from "@/lib/types";

const ok = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
/** backtest.json's top-level run fields (typed loosely in BacktestFile). */
type Span = { [k: string]: unknown };

/** The t-statistic a result needs before we call it different from zero; the same bar Results uses (paysRead). */
export const JUDGE_T = 2;
/** Fewest test bets behind a threshold; under this the test itself is too thin to say what "enough" means. */
const MIN_TEST_BETS = 30;

/**
 * Settled live bets needed to tell a return the size of the test's from zero.
 *
 * Rule: a mean return μ measured over n bets has t = μ ÷ (σ / √n), so t grows with √n. The test reached
 * t_test over n_test bets, with the spread of single-bet results (σ, event-clustered like the engine's t-stat)
 * that real bets showed. Keeping μ and σ, the n that reaches t = JUDGE_T is
 *     n = n_test × (JUDGE_T ÷ t_test)²
 * e.g. 10,027 test bets at t = 16.8 → ~143 settled bets. Rounded up. null when the test made no money, has no
 * t-stat or has under MIN_TEST_BETS bets: then there is no positive result for the live record to confirm.
 */
export function betsNeeded(r: Pick<BacktestRecord, "flags" | "roi_pct" | "t_stat"> | null | undefined): number | null {
  if (!r || !ok(r.flags) || r.flags < MIN_TEST_BETS || !ok(r.roi_pct) || r.roi_pct <= 0 || !ok(r.t_stat) || r.t_stat <= 0) return null;
  return Math.max(1, Math.ceil(r.flags * (JUDGE_T / r.t_stat) ** 2));
}

/**
 * Live return in % of money staked, the same definition as the backtest's roi_pct (total profit ÷ total cost).
 * The grader logs one $1 share per best bet with pnl = (won ? 1 : 0) − ask − fee (engine/ledger.py), so over the
 * settled bets Σcost = wins − Σpnl, and Σpnl = avg_pnl × graded. null with nothing settled.
 */
export function liveReturn(l: Pick<LedgerStats, "graded" | "wins" | "avg_pnl"> | null | undefined): number | null {
  if (!l || !l.graded || !ok(l.avg_pnl)) return null;
  const pnl = l.avg_pnl * l.graded;
  const cost = l.wins - pnl;
  return cost > 0 ? (pnl / cost) * 100 : null;
}

/** How long the walk-forward test ran, in words: folds × days per fold. "1 year", "18 months", "12 weeks", "9 days". */
export function testSpan(b: Span | null | undefined): string | null {
  const td = b?.test_days, fr = b?.folds_run, f = b?.folds;
  const days = ok(td) ? td * (ok(fr) ? fr : ok(f) ? f : 0) : 0;
  if (!days) return null;
  if (days >= 330) {
    const y = Math.round((days / 365) * 2) / 2;
    if (Number.isInteger(y)) return `${y} year${y === 1 ? "" : "s"}`;
    return `${Math.round(days / 30.4)} months`;
  }
  if (days >= 56) return `${Math.round(days / 7)} weeks`;
  return `${days} day${days === 1 ? "" : "s"}`;
}

const DAY = { month: "short", day: "numeric", timeZone: "UTC" } as const;
/** "Nov 17" (UTC, so server and browser agree). */
export const sinceDay = (unix: number) => new Date(unix * 1000).toLocaleDateString("en-US", DAY);

export interface Proof {
  test: string | null;      // "Testing on 1 year of past markets: +8.4% per bet."
  live: string;             // "Live since Nov 17: 35 settled bets, −1.7%, still too few to judge (needs ~143)."
  line: string;             // both, one sentence each
  help: string;             // the basis, for the hover
  needs: number | null;
  settled: number;
  liveRoi: number | null;
  enough: boolean;
}

/**
 * The proof line: test result, then the live record beside it.
 * `record` is the test result being shown (overall taker, or a category's); `live` the matching ledger totals
 * (overall, or ledger.by_category[cat]); `since` the first logged best bet (unix s); `who` names the group.
 */
export function proofLine(o: {
  record: BacktestRecord | null | undefined;
  backtest: Span | null | undefined;
  live: LedgerStats | null | undefined;
  since: number | null | undefined;
  updatedAt?: number | null;
  who?: string;
}): Proof {
  const span = testSpan(o.backtest);
  const r = o.record;
  const who = o.who ? `${o.who}, ` : "";
  const test = r && ok(r.roi_pct) && r.flags
    ? `${span ? `Testing on ${span} of past markets` : "In testing"}: ${who}${ret(r.roi_pct)} per bet${r.roi_pct < 0 ? " (lost money)" : ""}.`
    : null;
  const needs = betsNeeded(r);
  const l = o.live;
  const settled = l?.graded ?? 0;
  const roi = liveReturn(l);
  const enough = needs !== null && settled >= needs;
  const head = o.since ? `Live since ${sinceDay(o.since)}` : "Live so far";
  const bets = (n: number) => `${exactCount(n)} settled bet${n === 1 ? "" : "s"}`;
  let live: string;
  if (!l) live = "Live record: starts with the first logged best bet.";
  else if (!settled) live = `${head}: ${exactCount(l.entries)} logged, none settled yet${needs ? ` (needs ~${formatCount(needs)} to judge)` : ""}.`;
  else if (needs === null) live = `${head}: ${bets(settled)}, ${ret(roi)}.`;
  else if (!enough) live = `${head}: ${bets(settled)}, ${ret(roi)}, still too few to judge (needs ~${formatCount(needs)}).`;
  else live = `${head}: ${bets(settled)}, ${ret(roi)}, enough to compare with testing.`;

  const help = [
    r && r.flags ? `Testing: ${exactCount(r.flags)} past best bets${ok(r.events) ? ` in ${exactCount(r.events)} events` : ""}, each judged by a model fitted only on what came before; return = total profit ÷ total staked, after the fee.` : null,
    "Live: every best bet is logged when it is shown and graded when its market settles; return = total profit ÷ total staked, one $1 share per bet at the asking price plus the fee.",
    needs !== null && r ? `"Needs ~${formatCount(needs)}": settled bets it takes for a return the size of the test's to stand out from zero (t ≈ ${JUDGE_T}) given how much single bets varied in testing: ${exactCount(r.flags)} test bets × (${JUDGE_T} ÷ t-stat ${r.t_stat!.toFixed(1)})².` : null,
    l && o.updatedAt ? `Updated ${sinceDay(o.updatedAt)}.` : null,
  ].filter(Boolean).join(" ");
  return { test, live, line: [test, live].filter(Boolean).join(" "), help, needs, settled, liveRoi: roi, enough };
}

/** The site-wide line: the chosen backtest result's taker record beside the whole live ledger. */
export function siteProof(o: { backtest: BacktestFile | null | undefined; ledger: LedgerSummary | null | undefined; since: number | null | undefined }): Proof {
  return proofLine({
    record: o.backtest ? chosenResult(o.backtest)?.taker : null,
    backtest: o.backtest, live: o.ledger, since: o.since, updatedAt: o.ledger?.updated_at, who: "best bets",
  });
}

/** T-290: hit rate is not profit. The one answer to "do best bets win / can I lose", used by every FAQ. */
export const HIT_RATE_VS_PROFIT =
  "Most best bets win often but pay little; the edge is that over many bets the wins should cover the losses. Any single bet can lose.";
