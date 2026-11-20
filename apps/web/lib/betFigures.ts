// T-289: every figure and label a bet shows, in one place. BetCard, MarketCard, the drawer headline, the /about preview
// card, the screener table, My list, CSV and the MCP text all read from here, so a card can't say one number while the
// drawer says another, and a label can't contradict its number (outside tester, Nov 20).
import { cardReturn, chance, money, pays, payoutIfWins, pct, price, recordLabel, winsAbout, type Chance, type RecordLabel } from "@/lib/format";
import type { Side } from "@/lib/types";

const ok = (x: number | null | undefined): x is number => typeof x === "number" && Number.isFinite(x);

type S = Pick<Side, "ask" | "fee" | "edge" | "win_prob" | "ranges">;

/** Is the edge after the fee above zero? Free sides carry a band (numeric `edge` is only its low end), so the band
 *  decides: "under 0" is not positive, "0–2¢" and up are. */
export function edgeAbove0(s: Pick<Side, "edge" | "ranges">): boolean {
  return s.ranges ? s.ranges.edge[0] !== null : ok(s.edge) && s.edge > 0;
}

/** The gap in points of win chance: how often bets like this won minus the price (before the fee), [lo, hi] in
 *  probability. Exact sides: one number. Free sides only have win_prob floored to 5% and the edge band, so the gap is
 *  where both say it is: [floor, floor + 5%) ∩ [edge band + fee]. Built only from fields Free already receives. */
export function gapRange(s: S): [number, number] | null {
  if (!ok(s.ask) || !ok(s.win_prob)) return null;
  if (!s.ranges) return [s.win_prob - s.ask, s.win_prob - s.ask];
  const fee = ok(s.fee) ? s.fee : 0;
  const [elo, ehi] = s.ranges.edge;
  const lo = Math.max(s.win_prob - s.ask, elo === null ? -Infinity : elo + fee);
  const hi = Math.min(s.win_prob + 0.05 - s.ask, ehi === null ? Infinity : ehi + fee);
  return lo <= hi ? [lo, hi] : [lo, lo];
}

const signed = (p: number) => `${p < 0 ? "−" : "+"}${Math.abs(p)}`;
/** "+13 pts", "+1 pt", "−2 pts", Free "+5–9 pts". Whole points; a band whose ends round alike is one number. */
export function gapPts(s: S): string {
  const g = gapRange(s);
  if (!g) return "—";
  const [a, b] = g.map((x) => Math.round(x * 100)) as [number, number];
  if (a === b) return `${signed(a)} ${Math.abs(a) === 1 ? "pt" : "pts"}`;
  return a < 0 && b > 0 ? `${signed(a)} to ${signed(b)} pts` : `${signed(a)}–${Math.abs(b)} pts`;
}

/** Hover for the points: what they measure, and that the fee comes out of them. */
export const PTS_HELP =
  "Points of win chance: how often bets like this have won, minus the price. 70¢ implies 70%; if bets like it won 80%, that's +10 pts. The fee comes out of this gap.";

export type VerdictTone = "up" | "thin" | "down";
/** The price verdict, from the same quantities as the points beside it: the gap (pts) and the edge after the fee. */
export function verdict(s: S): { text: string; tone: VerdictTone } {
  if (edgeAbove0(s)) return { text: "Better price than usual", tone: "up" };
  const g = gapRange(s);
  if (g && g[1] > 0) return { text: "Won more often than the price, not by enough to cover the fee", tone: "thin" };
  return { text: "Priced above how often bets like it won", tone: "down" };
}

/** Chance label (docs/06 bands) only when the edge is above zero: "Leans your way" on a bet priced too high misleads. */
export function sideChance(s: Pick<Side, "edge" | "ranges" | "win_prob">): Chance | null {
  return edgeAbove0(s) ? chance(s.win_prob) : null;
}
/** Sample-size label; "Strong record" only on a bet whose edge is above zero ("Thin record" is a caution and stays). */
export function sideRecord(s: Pick<Side, "edge" | "ranges" | "model_neff">): RecordLabel | null {
  const r = recordLabel(s.model_neff);
  return r === "Strong record" && !edgeAbove0(s) ? null : r;
}

/** The one return a bet shows: card, drawer headline and MCP (docs/17 fix 1: what similar past bets returned when known,
 *  else the model's estimate; Free sees its band). */
export const RETURN_LABEL = "Estimated return";   // never "expected" (docs/01 Compliance, test/profit-claim.ts)
export const RETURN_LABEL_LONG = "estimated return at today's price";
export const RETURN_HELP_ONE =
  "What a $1 bet like this one returned on average at today's price, after the fee: what similar past bets earned, or the model's estimate when there is no such record yet. Any single bet can lose.";
/** The FAQ entry that explains why this differs from "how bets like this did in testing" and the live record. */
export const RETURNS_FAQ = "/about#returns";

export interface BetFigures {
  ask: number;
  pays: string;            // "1.6x", before fees
  wins: string;            // "8–9 in 10"
  winPct: string;          // "85%"
  pts: string;             // "+13 pts"
  verdict: { text: string; tone: VerdictTone };
  chance: Chance | null;
  record: RecordLabel | null;
  ret: { roi: number | null; text: string; realistic: boolean };
  stake: number;
  stakeText: string;       // "$100"
  payout: number | null;   // stake / (ask + fee)
  payoutText: string;      // "$158"
  /** "Pays 1.6x before fees · Bet $100 → get $158 after fees if it wins" */
  feeLine: string;
  feeHelp: string;
}

/** Every figure for one side at one price (`ask`, default the scan ask; pass the live ask so Pays and the payout agree)
 *  and the user's default stake. */
export function betFigures(s: Side, opts: { ask?: number; stake?: number } = {}): BetFigures {
  const ask = ok(opts.ask) ? opts.ask : s.ask;
  // the edge moves cent for cent with the price; a Free band stays as sent (Free has no live price)
  const at = { ...s, ask, edge: s.ranges ? s.edge : s.edge + s.ask - ask };
  const stake = ok(opts.stake) && opts.stake > 0 ? opts.stake : 100;
  const payout = payoutIfWins(stake, at);
  const payoutText = money(payout);
  const r = cardReturn(s);
  const feeHelp = `Pays = $1 ÷ ${price(ask)} price. Polymarket's fee here is ${price(s.fee)} per share, so ${money(stake)} buys ${payout === null ? "—" : (payout).toFixed(1)} shares at ${price(ask + (ok(s.fee) ? s.fee : 0))} each; each pays $1 if it wins. If it loses, you lose the stake.`;
  return {
    ask,
    pays: pays(ask),
    wins: winsAbout(s.win_prob),
    winPct: pct(s.win_prob),
    pts: gapPts(at),
    verdict: verdict(at),
    chance: sideChance(at),
    record: sideRecord(at),
    ret: { roi: r.roi, text: r.text, realistic: r.realistic },
    stake,
    stakeText: money(stake),
    payout,
    payoutText,
    feeLine: `Pays ${pays(ask)} before fees · Bet ${money(stake)} → get ${payoutText} after fees if it wins`,
    feeHelp,
  };
}
