// F2: the combo checker's math. Pure. Combined chance = product of the legs' chances; multiplier = product of each leg's
// multiplier after fee (= lib/combos.ts combo().pays for the same legs); net edge = combined chance − 1/multiplier, the same
// meaning as F1's net_edge; score = F1's formula with n = the smallest leg sample. The chance assumes the legs are
// independent, which same-event legs are not (flagged).
import { comboPrice } from "@/lib/combos";
import { chancePct, pricePct } from "@/lib/chance";
import { paysAfterFee } from "./pays";
import type { CheckBase } from "./compute";
import { cleanEventLine } from "@/lib/format";
import { score } from "./score";

export const MIN_COMBO_LEGS = 2;
export const MAX_COMBO_LEGS = 10;

/** Legs from one event move together, so the combined chance (a product) is likely off and a score on it would mislead: no score. */
export const NOT_SCORED_SAME_EVENT = "Not scored: legs from the same event";

export interface ComboLeg {
  key: string;            // market id + side, for duplicates
  marketId: string;
  side: 0 | 1;
  question: string;
  outcome: string;
  eventId: string;
  event: string;
  base: CheckBase;
}

export interface ComboNumbers { legs: number; chance: number; multiplier: number; edge: number; score: number | null }
export interface ComboCheck {
  error: "too_few" | "no_model" | null;
  noModel: string | null;       // the first leg without a model chance
  numbers: ComboNumbers | null;
  sameEvent: string[];          // event names that appear on more than one leg
  scoreNote: string | null;     // why there is no score (same-event legs), else null
  drop: { index: number; numbers: ComboNumbers } | null;   // the leg whose removal raises the score most
}


function numbersOf(legs: ComboLeg[]): ComboNumbers | null {
  if (legs.some((l) => l.base.winProb === null)) return null;
  const chance = legs.reduce((a, l) => a * l.base.winProb!, 1);
  const multiplier = 1 / comboPrice(legs.map((l) => l.base));   // the tray's payout rule (lib/combos.ts)
  const edge = chance - 1 / multiplier;
  const n = Math.min(...legs.map((l) => l.base.n ?? 0));
  return { legs: legs.length, chance, multiplier, edge, score: sameEvents(legs).length ? null : score(edge, n) };
}

export function sameEvents(legs: Pick<ComboLeg, "eventId" | "event">[]): string[] {
  const count = new Map<string, number>();
  for (const l of legs) count.set(l.eventId, (count.get(l.eventId) ?? 0) + 1);
  return [...new Set(legs.filter((l) => count.get(l.eventId)! > 1).map((l) => l.event))];
}

type AdviceLeg = Pick<ComboLeg, "eventId" | "event"> & Partial<Pick<ComboLeg, "key" | "question" | "outcome" | "base">>;

/** Of two legs from one event, the one whose removal leaves the better combo (the checkCombo "weakest leg" rule: higher score, then
 *  higher edge). Null when the legs are not scored yet, or when it makes no difference. Only the combo's own legs are used. */
function weakerOfPair(legs: AdviceLeg[], pair: AdviceLeg[]): AdviceLeg | null {
  if (legs.some((l) => !l.base || l.base.winProb === null)) return null;
  const full = legs as ComboLeg[];
  const rest = (gone: AdviceLeg) => numbersOf(full.filter((l) => l !== gone))!;
  const [a, b] = pair.map(rest);
  const sa = a!.score ?? -1, sb = b!.score ?? -1;
  if (sa !== sb) return sa > sb ? pair[0]! : pair[1]!;
  if (Math.abs(a!.edge - b!.edge) < 1e-12) return null;
  return a!.edge > b!.edge ? pair[0]! : pair[1]!;
}

/** With no score for same-event legs, say which leg to drop: 'Drop one of the two Denmark vs. Norway bets. "Q" (Yes) is the weaker one.'
 *  (one line per event; the weaker leg is named once the legs are scored, and left out when they are equal or not scored yet). */
export function sameEventAdvice(legs: AdviceLeg[]): string[] {
  const by = new Map<string, { event: string; legs: AdviceLeg[] }>();
  for (const l of legs) { const e = by.get(l.eventId); if (e) e.legs.push(l); else by.set(l.eventId, { event: cleanEventLine(l.event), legs: [l] }); }
  return [...by.values()].filter((e) => e.legs.length > 1).map((e) => {
    if (e.legs.length !== 2) return `Keep one of the ${e.legs.length} ${e.event} bets and drop the rest.`;
    const weak = weakerOfPair(legs, e.legs);
    return `Drop one of the two ${e.event} bets.${weak?.question ? ` "${weak.question}" (${weak.outcome}) is the weaker one.` : ""}`;
  });
}

export function checkCombo(legs: ComboLeg[]): ComboCheck {
  const sameEvent = sameEvents(legs);
  const blocked = legs.find((l) => l.base.winProb === null);
  if (legs.length < MIN_COMBO_LEGS) return { error: "too_few", noModel: blocked?.question ?? null, numbers: null, sameEvent, scoreNote: null, drop: null };
  if (blocked) return { error: "no_model", noModel: blocked.question, numbers: null, sameEvent, scoreNote: null, drop: null };
  const numbers = numbersOf(legs)!;
  let drop: ComboCheck["drop"] = null;
  if (legs.length > MIN_COMBO_LEGS) {
    legs.forEach((_, i) => {
      const n = numbersOf(legs.filter((__, j) => j !== i))!;
      if (!drop || (n.score ?? -1) > (drop.numbers.score ?? -1) || ((n.score ?? -1) === (drop.numbers.score ?? -1) && n.edge > drop.numbers.edge)) drop = { index: i, numbers: n };
    });
  }
  return { error: null, noModel: null, numbers, sameEvent, scoreNote: sameEvent.length ? NOT_SCORED_SAME_EVENT : null, drop };
}

/** Adds a leg: refused when it's already there (same market, either side) or the combo is full. */
export function addLeg(legs: ComboLeg[], leg: ComboLeg): { legs: ComboLeg[]; refused: "duplicate" | "full" | null } {
  if (legs.some((l) => l.marketId === leg.marketId)) return { legs, refused: "duplicate" };
  if (legs.length >= MAX_COMBO_LEGS) return { legs, refused: "full" };
  return { legs: [...legs, leg], refused: null };
}

/** A leg's line under its title: the price you pay, and once scored the chance and payout. The chance is the cautious one (the tray's
 *  one chance, docs/18 §5), and says so: the card and drawer show the central estimate for a single bet. */
export function legLine(l: { outcome: string; price: number }, b?: CheckBase): string {
  const head = `Bet ${l.outcome} at ${pricePct(l.price)}`;
  if (!b) return head;
  return `${head} · ${b.winProb === null ? "No model chance" : `${chancePct(b.winProb)} chance (cautious)`} · pays ${paysAfterFee(1 / (b.ask + b.fee))}`;
}
