// Results page (T-26, F-14) helpers. Pure: every figure comes straight from backtest.json (chosen half-life)
// and is formatted with lib/format. Nothing is recomputed, so the page always equals the file.
import { chosenResult } from "@/lib/data/model";
import { edge, formatCount, ret } from "@/lib/format";
import type { BacktestFile, BacktestRecord } from "@/lib/types";

export interface Fold extends BacktestRecord { start: number }
export interface EdgeBucket { predicted_lo: number; predicted_hi: number; flags: number; predicted_edge: number; realized_edge: number }

const ok = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
const int = (x: number | undefined) => (ok(x) ? formatCount(x) : "—");   // docs/18 §4; exact on hover in the UI
const tstat = (x: number | undefined) => (ok(x) ? x.toFixed(1) : "—");
const cents = (r: BacktestRecord) => (ok(r.pnl_cents_per_share) ? edge(r.pnl_cents_per_share / 100) : "—");
const winRate = (x: number | undefined) => (ok(x) ? `${Math.round(x * 100)}%` : "—");

/** One record as display strings (tables and tiles share it). */
export function fmtRecord(r: BacktestRecord | undefined) {
  const x = r ?? { flags: 0 };
  return {
    bets: int(x.flags), events: int(x.events), won: winRate(x.win_rate),
    ret: ret(x.roi_pct), cents: cents(x), t: tstat(x.t_stat),
  };
}

export type TileKey = "bets" | "ret" | "cents" | "t" | "events";
export interface Tile { key: TileKey; label: string; help: string; value: number | undefined; text: string; baseline: string; baseline_value?: number }

/** Headline tiles: strategy (taker at the ask) vs "every bet, no filter" baseline. */
export function tiles(b: BacktestFile): Tile[] {
  const r = chosenResult(b);
  const s = r?.taker ?? { flags: 0 }, base = r?.baseline_all_bets_taker ?? { flags: 0 };
  const S = fmtRecord(s), B = fmtRecord(base);
  return [
    { key: "bets", label: "Best bets tested", help: "Bets that would have been best bets in weeks the model had never seen.", value: s.flags, text: S.bets, baseline: B.bets, baseline_value: base.flags },
    { key: "ret", label: "Average return (ROI)", help: "Average profit per dollar staked, after Polymarket's fee, buying at the estimated asking price.", value: s.roi_pct, text: S.ret, baseline: B.ret },
    { key: "cents", label: "Per $1 share", help: "Average profit in cents on a share that pays $1 if it hits.", value: s.pnl_cents_per_share, text: S.cents, baseline: B.cents },
    { key: "t", label: "Confidence (t-stat)", help: "How far the result sits from zero given its noise. Above 2 is unlikely to be luck alone.", value: s.t_stat, text: S.t, baseline: B.t },
    { key: "events", label: "Separate events", help: "Distinct games, weather days or questions. Bets on one event move together, so this is the honest sample size.", value: s.events, text: S.events, baseline: B.events, baseline_value: base.events },
  ];
}

const DAY = { month: "short", day: "numeric", timeZone: "UTC" } as const;
/** Weekly folds with dates formatted server-side (avoids hydration mismatch). Return is null on empty weeks. */
export function foldRows(b: BacktestFile) {
  const folds = (chosenResult(b)?.folds ?? []) as Fold[];
  return folds.map((f) => ({
    week: new Date(f.start * 1000).toLocaleDateString("en-US", DAY),
    bets: f.flags ?? 0,
    ret: f.flags && ok(f.roi_pct) ? f.roi_pct : null,
    retText: f.flags ? ret(f.roi_pct) : "no bets",
  }));
}

/** Predicted vs realized edge per bucket, in ¢ per $1 share. */
export function bucketRows(b: BacktestFile) {
  const rows = (chosenResult(b)?.edge_buckets ?? []) as EdgeBucket[];
  return rows.map((e) => ({
    bucket: e.predicted_hi >= 1 ? `${Math.round(e.predicted_lo * 100)}¢+` : `${Math.round(e.predicted_lo * 100)}–${Math.round(e.predicted_hi * 100)}¢`,
    bets: e.flags,
    predicted: +(e.predicted_edge * 100).toFixed(2),
    realized: +(e.realized_edge * 100).toFixed(2),
  }));
}

/** Rows of a record map, biggest sample first. */
export function recordRows(map: Record<string, BacktestRecord> | undefined) {
  return Object.entries(map ?? {})
    .sort((a, b) => (b[1].flags ?? 0) - (a[1].flags ?? 0))
    .map(([key, r]) => ({ key, r, f: fmtRecord(r) }));
}
