// A chance or a price shown as a percentage, with the extremes kept honest (T-wt3h). Its own small module on purpose: the combo views that
// use it load lazily, and lib/format.ts (which the landing page's first load carries whole) must not grow by what only they need.
const DASH = "—";

/** A chance (a leg's, a combo's): like pct, but never "0%" for a chance above 0 or "100%" for one below 1: "<1%" and ">99%". */
export function chancePct(p: number | null | undefined): string {
  if (typeof p !== "number" || !Number.isFinite(p)) return DASH;
  if (p > 0 && p < 0.005) return "<1%";
  if (p < 1 && p >= 0.995) return ">99%";
  return `${Math.round(p * 100)}%`;
}

/** A price shown as a percentage (0.999 → ">99%", 0.002 → "<1%"): the same rule as a chance, so it never reads "100%" or "0%" when it is not exactly that. */
export const pricePct = chancePct;
