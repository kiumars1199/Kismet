// The beta list on its own (no imports), so light modules (the footer, OG images) can read it. Rules: lib/beta.ts.
export type Gated = "combos" | "kalshi";
/** Still in beta. Combos (docs/18 §5, docs/19 P5) and the Kalshi page (docs/16 §2, waiting on Kalshi's permission). */
export const BETA_FEATURES: readonly Gated[] = ["combos", "kalshi"];
