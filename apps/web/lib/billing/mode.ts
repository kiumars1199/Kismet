// Test vs live Stripe, decided only by the environment (F7). The secret key's prefix says which account it talks to;
// price ids and the webhook secret come from env too, so going live is an env change and never a code change.
export type StripeMode = "live" | "test";

/** "live" for sk_live_ / rk_live_, "test" for sk_test_ / rk_test_, null for an empty or unrecognised key. */
export function stripeMode(env: Record<string, string | undefined> = process.env): StripeMode | null {
  const m = /^(?:sk|rk)_(live|test)_\w{10,}$/.exec(env.STRIPE_SECRET_KEY ?? "");
  return m ? (m[1] as StripeMode) : null;
}
