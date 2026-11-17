// Shared number formatting and plain-language labels (docs/06 § Display language). Every lane uses these;
// never format a user-facing number another way. Missing values render "—".
import type { Side } from "@/lib/types";

const ok = (x: number | null | undefined): x is number => typeof x === "number" && Number.isFinite(x);
export const DASH = "—";

/** 0.68 → "68¢" (one decimal under 10¢ or when not whole: 0.055 → "5.5¢") */
export function price(p: number | null | undefined): string {
  if (!ok(p)) return DASH;
  const c = p * 100;
  return `${Math.abs(c - Math.round(c)) < 0.05 ? Math.round(c) : c.toFixed(1)}¢`;
}
/** payout per $1 from the ask (docs/13 §3): 0.33 → "3.0x", 0.08 → "13x"; no ask → "—" */
export function pays(ask: number | null | undefined): string {
  if (!ok(ask) || ask <= 0) return DASH;
  const x = 1 / ask;
  return `${x >= 10 ? Math.round(x) : x.toFixed(1)}x`;
}
export const PAYS_HELP = "What $1 returns if this side wins: $1 ÷ price, before the fee.";
/** 0.79 → "79%" */
export function pct(p: number | null | undefined): string {
  return ok(p) ? `${Math.round(p * 100)}%` : DASH;
}
/** expected return from roi_pct: 33.2 → "+33%", 4.6 → "+4.6%", -2 → "−2%" */
export function ret(roiPct: number | null | undefined): string {
  if (!ok(roiPct)) return DASH;
  const a = Math.abs(roiPct);
  const n = a >= 10 ? Math.round(a).toString() : a.toFixed(1).replace(/\.0$/, "");
  return `${roiPct < 0 ? "−" : "+"}${n}%`;
}
/** cents edge for Pro mode: 0.051 → "+5.1¢" */
export function edge(e: number | null | undefined): string {
  if (!ok(e)) return DASH;
  return `${e < 0 ? "−" : "+"}${Math.abs(e * 100).toFixed(1)}¢`;
}
/** Free tier (T-44): the API sends `ranges` instead of exact numbers. "+5–10%", "under 0%", "over +50%". */
type Band = [number | null, number | null];
const span = ([lo, hi]: Band, f: (x: number) => string, unit: string) =>
  lo === null ? `under ${f(hi ?? 0).replace(/^\+/, "")}` : hi === null ? `over ${f(lo)}` : `${f(lo).slice(0, -unit.length)}–${f(hi).replace(/^\+/, "")}`;
/** Expected return for a side: exact, or its band on the Free tier. */
export function sideRet(s: Pick<Side, "roi_pct" | "ranges">): string {
  return s.ranges ? span(s.ranges.roi_pct, ret, "%") : ret(s.roi_pct);
}
/** Edge per share for a side: exact, or its band on the Free tier. */
export function sideEdge(s: Pick<Side, "edge" | "ranges">): string {
  return s.ranges ? span(s.ranges.edge, (e) => edge(e).replace(".0¢", "¢"), "¢") : edge(s.edge);
}
/** "$100 bet → expect +$33": exact, or its band on the Free tier ("+$5–$10"), so a band's low end never reads as exact. */
export function sideProfit(s: Pick<Side, "roi_pct" | "ranges">): string {
  if (!s.ranges) {
    const p = expectedProfit(s.roi_pct);
    return money(p === null ? null : Math.round(p), true);
  }
  const [lo, hi] = s.ranges.roi_pct;
  const f = (x: number) => money(x, true);
  return lo === null ? `under ${f(hi ?? 0).replace(/^\+/, "")}` : hi === null ? `over ${f(lo)}` : `${f(lo)}–${f(hi).replace(/^\+/, "")}`;
}
/** $1,234 (whole dollars ≥ $100, cents below) ; signed adds +/− */
export function money(usd: number | null | undefined, signed = false): string {
  if (!ok(usd)) return DASH;
  const a = Math.abs(usd);
  const s = a >= 100 ? Math.round(a).toLocaleString("en-US") : a.toFixed(2).replace(/\.00$/, "");
  return `${signed ? (usd < 0 ? "−" : "+") : usd < 0 ? "−" : ""}$${s}`;
}
/** "$100 bet → expect +$33": expected profit on a stake from roi_pct */
export function expectedProfit(roiPct: number | null | undefined, stake = 100): number | null {
  return ok(roiPct) ? (roiPct / 100) * stake : null;
}

export type Chance = "Likely to hit" | "Leans your way" | "Coin flip" | "Long shot";
/** chance label from win_prob: ≥80% Likely to hit, 55–80% Leans your way, 40–55% Coin flip, <40% Long shot */
export function chance(winProb: number | null | undefined): Chance | null {
  if (!ok(winProb)) return null;
  return winProb >= 0.8 ? "Likely to hit" : winProb >= 0.55 ? "Leans your way" : winProb >= 0.4 ? "Coin flip" : "Long shot";
}
/** "Bet Yes at 68¢" */
export function betLine(s: Pick<Side, "outcome" | "ask">): string {
  return `Bet ${s.outcome} at ${price(s.ask)}`;
}
/** "similar past bets returned": realistic_edge / (ask + fee), as roi % */
export function realisticReturn(s: Pick<Side, "realistic_edge" | "ask" | "fee">): number | null {
  return ok(s.realistic_edge) && s.ask + s.fee > 0 ? (s.realistic_edge / (s.ask + s.fee)) * 100 : null;
}
/** closes in: unix seconds → "45m", "19h", "3 days"; past → "closed" */
export function closesIn(closesAt: number | null | undefined, now = Date.now()): string {
  if (!ok(closesAt)) return DASH;
  const m = (closesAt * 1000 - now) / 60000;
  if (m <= 0) return "closed";
  if (m < 60) return `${Math.max(1, Math.round(m))}m`;
  const h = m / 60;
  if (h < 48) return `${Math.round(h)}h`;
  return `${Math.round(h / 24)} days`;
}
/** "12 min ago" from unix seconds */
export function ago(unixSec: number | null | undefined, now = Date.now()): string {
  if (!ok(unixSec)) return DASH;
  const m = Math.max(0, (now - unixSec * 1000) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${Math.round(m)} min ago`;
  const h = m / 60;
  return h < 48 ? `${Math.round(h)} h ago` : `${Math.round(h / 24)} days ago`;
}
/** tooltip text explaining expected return (show once per page) */
export const RETURN_HELP =
  "If you made this kind of bet many times, this is the average profit per dollar, based on how similar past bets resolved. Any single bet can lose.";
/** model basis tooltip: "Model: NFL · totals · ~24 h · 812 eff. samples · 190 events" */
export function basis(m: { niche: string; market_type: string; horizon_h: number }, s: Pick<Side, "model_neff" | "model_events" | "model_level">): string {
  const lvl = { all: "all markets", cat: "category", niche: "niche", nmt: "niche + type" }[s.model_level] ?? s.model_level;
  return `Model: ${m.niche.toUpperCase()} · ${m.market_type} · ~${m.horizon_h} h · ${Math.round(s.model_neff).toLocaleString("en-US")} eff. samples · ${s.model_events.toLocaleString("en-US")} events (${lvl} level)`;
}
