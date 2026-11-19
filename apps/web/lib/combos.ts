// Combo (parlay) math, docs/18 §5. Pure: shared by the combo tray (client), suggested combos (server) and tests.
// Legs must come from different events; same-event legs are correlated and the simple product is wrong, so
// combo() reports them and the UI warns.
import { feeCents } from "@/lib/trade/intent";
import type { Side, StoreMarket } from "@/lib/types";

export interface Leg {
  market_id: string; side_index: 0 | 1;
  question: string; outcome: string; event_id: string; event: string;
  url: string; kalshi_ticker?: string | null;
  ask: number; fee: number;
  q: number;        // our win chance (win_prob)
  q_low: number;    // cautious win chance (win_prob_low)
}
export const MIN_LEGS = 2;
/** Payout floors on the Combos page (docs/19 P5): 2x+, 3x+, 5x+, 10x+. */
export const COMBO_PAYS = [2, 3, 5, 10] as const;
export type ComboPays = (typeof COMBO_PAYS)[number];
export const MAX_LEGS = 6;

export const legOf = (m: Pick<StoreMarket, "id" | "question" | "event_id" | "event" | "url" | "kalshi_ticker">, s: Side): Leg => ({
  market_id: m.id, side_index: s.side_index, question: m.question, outcome: s.outcome, event_id: m.event_id, event: m.event,
  url: m.url, kalshi_ticker: m.kalshi_ticker ?? null, ask: s.ask, fee: s.fee, q: s.win_prob, q_low: s.win_prob_low,
});

export interface Combo {
  legs: number;
  q: number;            // Q = Π q_i
  q_low: number;        // Q_low = Π q_low_i ("combo confidence")
  price: number;        // fair combo price Π (ask_i + fee_i): buying each leg and rolling the winnings over
  pays: number;         // 1 / price
  ret: number;          // Π (1 + r_i) − 1 with r_i = q_i / (ask_i + fee_i) − 1; equals Q / price − 1
  has_edge: boolean;    // Q_low still beats the price
  same_event: string[]; // event names that appear on more than one leg (product is wrong for these)
}

const prod = (xs: number[]) => xs.reduce((a, b) => a * b, 1);

export function combo(legs: Pick<Leg, "ask" | "fee" | "q" | "q_low" | "event_id" | "event">[]): Combo {
  const q = prod(legs.map((l) => l.q));
  const q_low = prod(legs.map((l) => l.q_low));
  const price = prod(legs.map((l) => l.ask + l.fee));
  const ret = prod(legs.map((l) => 1 + (l.q / (l.ask + l.fee) - 1))) - 1;
  const seen = new Map<string, number>();
  for (const l of legs) seen.set(l.event_id, (seen.get(l.event_id) ?? 0) + 1);
  const same_event = [...new Set(legs.filter((l) => seen.get(l.event_id)! > 1).map((l) => l.event))];
  return { legs: legs.length, q, q_low, price, pays: price > 0 ? 1 / price : 0, ret, has_edge: q_low > price, same_event };
}

/** Kalshi combo (one contract that pays $1 if every leg wins): edge = Q − ask − fee(ask), fee per contract. */
export function kalshiComboEdge(q: number, askCents: number): { fee: number; edge: number; ret: number } {
  const fee = feeCents(1, askCents) / 100;
  const ask = askCents / 100;
  return { fee, edge: q - ask - fee, ret: (q - ask - fee) / (ask + fee) };
}

/** "Combo · 3 legs · pays 4.1x · wins about 1 in 3" */
export const comboLabel = (c: Pick<Combo, "legs" | "pays">, wins: string) =>
  `Combo · ${c.legs} legs · pays ${c.pays >= 10 ? Math.round(c.pays) : c.pays.toFixed(1)}x · wins about ${wins}`;
