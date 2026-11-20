// T-288: the one Best bets count. /status, /about, admin health, the landing page, Best bets (/ and /bets, whose
// unfiltered headline runs this same query through listBody) and the Free sample ("N more on Pro") all count
// with these functions, so one scan gives one number on every page and every reload.
import { apply, type Row } from "@/lib/filters/apply";
import { BEST_BETS_VERDICTS, FilterState } from "@/lib/filters/state";
import type { Store } from "./store";

/** The Best bets page's own query with no filters touched: best tier, price check "worth it" or "thin", the default
 *  40% chance floor, open markets only (apply drops closed ones at the request clock). */
export const bestBetsQuery = (patch: Partial<FilterState> = {}): FilterState =>
  FilterState.parse({ view: "flags", verdicts: BEST_BETS_VERDICTS, ...patch });

/** Every row of the unfiltered Best bets list, in page order (flat, one page holding them all). */
export const bestBetsRows = (store: Store): Row[] =>
  apply(store, { ...bestBetsQuery({ group_by_event: false }), page: 1, page_size: Number.MAX_SAFE_INTEGER }).rows;

export type BestBetsSection = (typeof BEST_BETS_VERDICTS)[number];
export interface BestBetsCount {
  total: number;
  /** Price-check sections of the list; they always add up to `total`. */
  sections: Record<BestBetsSection, number>;
}

/** Best bets right now in this store, and how they split by price check. */
export function bestBetsCount(store: Store): BestBetsCount {
  const rows = bestBetsRows(store);
  const sections = Object.fromEntries(BEST_BETS_VERDICTS.map((v) => [v, 0])) as Record<BestBetsSection, number>;
  for (const r of rows) {
    const v = r.market.execution?.verdict as BestBetsSection | undefined;
    if (v && v in sections) sections[v]++;
  }
  return { total: rows.length, sections };
}
