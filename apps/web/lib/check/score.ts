// F1/F2 score (docs/launch/decisions.md, Nov 22): 50 + 250 × net_edge × sqrt(min(n, 400) / 400), clamped 0–100.
// 50 at zero edge; a small sample pulls the score toward 50, so the basis shows in the number.
export const SCORE_FORMULA =
  "Score = 50 + 250 × (our chance − price after fee) × √(past bets behind it ÷ 400, at most 1), kept between 0 and 100. 50 means the price is fair; higher means a better price than bets like this usually get; fewer past bets pull it toward 50.";

const ok = (x: number | null | undefined): x is number => typeof x === "number" && Number.isFinite(x);

/** netEdge: our chance minus the price after fee (a fraction, e.g. 0.08). n: the model level's sample size
 *  (side.model_neff, the figure the drawer shows). null when there is no model chance (the page says "No model chance"). */
export function score(netEdge: number | null | undefined, n: number | null | undefined): number | null {
  if (!ok(netEdge) || !ok(n) || n < 0) return null;
  const raw = 50 + 250 * netEdge * Math.sqrt(Math.min(n, 400) / 400);
  return Math.max(0, Math.min(100, Math.round(raw)));
}
