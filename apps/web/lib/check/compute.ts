// F1: one bet's numbers at an editable price and stake. Pure, with no input beyond market/side/price/stake, so every
// account gets identical results. At the card's own price it reproduces betQuote (same chance, multiplier, edge).
import { betQuote, type BetQuote } from "@/lib/betFigures";
import { feePerShare } from "@/lib/calc";
import { feeRate } from "@/lib/execution";
import { score } from "./score";
import type { Market, Side } from "@/lib/types";

export const MIN_STAKE = 1;
export const MAX_STAKE = 100_000;

/** What the client needs to recompute locally: a price or stake edit makes no network call. */
export interface CheckBase {
  winProb: number | null;   // our chance (0-1); null = the model can't price this side
  n: number | null;         // sample size behind it (the drawer's "eff." figure)
  ask: number;              // the card's price
  fee: number;              // the card's fee at that price
  edge: number | null;      // the card's edge at that price (engine-rounded): shown as is at the card's own price
  feeRate: number;          // fee = rate × p × (1 − p), for any other price
  venue: BetQuote["venue"];
}

export function baseOf(m: Pick<Market, "us" | "best" | "category">, s: Side): CheckBase {
  const q = betQuote(m, s);
  const ask = q.ask ?? s.ask;
  const fee = q.fee ?? s.fee;
  const rate = ask > 0 && ask < 1 && Number.isFinite(fee) ? fee / (ask * (1 - ask)) : feeRate(m.category);
  return {
    winProb: Number.isFinite(s.win_prob) ? s.win_prob : null,
    n: Number.isFinite(s.model_neff) ? s.model_neff : null,
    ask, fee, edge: q.edge, feeRate: rate, venue: q.venue,
  };
}

export type CheckError = "price_range" | "stake_range" | "no_model";
export interface CheckResult {
  price: number; stake: number;
  chance: number | null;        // our chance
  marketPct: number;            // the price as a chance
  multiplier: number | null;    // payout per $1 if it wins, after fee
  edge: number | null;          // our chance − price − fee, as a fraction (×100 for points)
  score: number | null;
  payout: number | null;        // stake × multiplier
  profit: number | null;        // estimated: stake × multiplier × chance − stake
  error: CheckError | null;
}

export function validate(price: number, stake: number): CheckError | null {
  if (!Number.isFinite(price) || price <= 0 || price >= 1) return "price_range";
  if (!Number.isFinite(stake) || stake < MIN_STAKE || stake > MAX_STAKE) return "stake_range";
  return null;
}

export const ERROR_TEXT: Record<CheckError, string> = {
  price_range: "Price must be between 1% and 99%.",
  stake_range: "Stake must be between $1 and $100,000.",
  no_model: "No model chance for this market",
};

export function compute(b: CheckBase, price: number, stake: number): CheckResult {
  const bad = validate(price, stake);
  const empty: CheckResult = { price, stake, chance: b.winProb, marketPct: price, multiplier: null, edge: null, score: null, payout: null, profit: null, error: bad };
  if (bad) return empty;
  const own = price === b.ask;   // the card's own price: the card's own fee and edge, so the figures are identical
  const fee = own && Number.isFinite(b.fee) ? b.fee : feePerShare(price, b.feeRate);
  const mult = 1 / (price + fee);
  const base: CheckResult = { ...empty, multiplier: mult, payout: stake * mult };
  if (b.winProb === null) return { ...base, error: "no_model" };
  const edge = own && b.edge !== null ? b.edge : b.winProb - price - fee;
  return { ...base, edge, score: score(edge, b.n), profit: stake * mult * b.winProb - stake };
}
