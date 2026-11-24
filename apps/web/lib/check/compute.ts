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

/** The leg inputs the COMBO checker scores with: the same price (venue-aware betQuote, fee included) as baseOf, and the cautious chance
 *  (win_prob_low), the one chance the combo tray shows (docs/18 §5, Marc #15/#74): one rule for the tray and the checker. */
export function comboBaseOf(m: Pick<Market, "us" | "best" | "category">, s: Side): CheckBase {
  const b = baseOf(m, s);
  return { ...b, winProb: Number.isFinite(s.win_prob_low) ? s.win_prob_low : b.winProb };
}

export type CheckError = "price_range" | "stake_range" | "no_model";
export interface CheckResult {
  price: number; stake: number;
  chance: number | null;        // our chance
  marketPct: number;            // the price as a chance
  multiplier: number | null;    // payout per $1 if it wins, after fee
  edge: number | null;          // our chance − price − fee, as a fraction (×100 for points)
  gap: number | null;           // our chance − price (before the fee): the points the card and drawer show
  score: number | null;
  payout: number | null;        // stake × multiplier
  profit: number | null;        // estimated: stake × multiplier × chance − stake
  error: CheckError | null;
}

/** A TYPED price must be 1–99%. A price that comes from the market (fromMarket) may be outside that (a 99.9% side is still a real price): it only has to be a price (between 0 and 1, exclusive). */
export function validate(price: number, stake: number, fromMarket = false): CheckError | null {
  if (fromMarket ? !(Number.isFinite(price) && price > 0 && price < 1) : !Number.isFinite(price) || price < 0.01 - 1e-9 || price > 0.99 + 1e-9) return "price_range";
  if (!Number.isFinite(stake) || stake < MIN_STAKE || stake > MAX_STAKE) return "stake_range";
  return null;
}

export const ERROR_TEXT: Record<CheckError, string> = {
  price_range: "Price must be between 1% and 99%.",
  stake_range: "Stake must be between $1 and $100,000.",
  no_model: "No model chance for this market",
};

export function compute(b: CheckBase, price: number, stake: number, fromMarket = false): CheckResult {
  const own = price === b.ask;   // the card's own price: the card's own fee and edge, so the figures are identical
  const bad = validate(price, stake, fromMarket || own);
  const empty: CheckResult = { price, stake, chance: b.winProb, marketPct: price, multiplier: null, edge: null, gap: null, score: null, payout: null, profit: null, error: bad };
  if (bad) return empty;
  const fee = own && Number.isFinite(b.fee) ? b.fee : feePerShare(price, b.feeRate);
  const mult = 1 / (price + fee);
  const base: CheckResult = { ...empty, multiplier: mult, payout: stake * mult };
  if (b.winProb === null) return { ...base, error: "no_model" };
  const edge = own && b.edge !== null ? b.edge : b.winProb - price - fee;
  return { ...base, edge, gap: b.winProb - price, score: score(edge, b.n), profit: stake * mult * b.winProb - stake };
}
