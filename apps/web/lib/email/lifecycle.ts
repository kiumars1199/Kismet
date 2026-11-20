// Lifecycle hooks (docs/OVERHAUL.md §F3–F4): what happens after a first sign-in and after each Stripe webhook event.
// T-299: the server funnel steps (signup_done, trial_start, paid).
// Never throws: a hook failing must not fail a sign-in or make Stripe retry a billing event that was applied.
import "server-only";
import type Stripe from "stripe";
import type { BillingDb } from "@/lib/billing/stripe";
import { recordFunnel, type FunnelDeps } from "@/lib/funnel-server";

/** A first sign-in older than this is an existing account accepting the terms late, not a sign-up. */
export const NEW_ACCOUNT_MS = 86_400_000;

export interface LifecycleDeps {
  funnel?: FunnelDeps;
  now?: () => number;
}

const idOf = (x: string | { id: string } | null | undefined) => (typeof x === "string" ? x : x?.id ?? null);

/** lib/auth/finish.ts, right after a first sign-in stored the 18+/Terms acceptance. */
export async function onFirstSignIn(user: { id: string; email?: string | null; created_at?: string }, deps: LifecycleDeps = {}): Promise<void> {
  try {
    const now = (deps.now ?? Date.now)();
    const created = Date.parse(user.created_at ?? "");
    if (!Number.isFinite(created) || now - created > NEW_ACCOUNT_MS) return;
    await recordFunnel("signup_done", user.id, {}, deps.funnel);
  } catch (e) {
    console.error("[lifecycle] first sign-in hook failed:", e instanceof Error ? e.message : e);
  }
}

/** lib/billing/stripe.ts handleWebhook, after an event was applied (once per event id). */
export async function afterBillingEvent(event: Stripe.Event, db: Pick<BillingDb, "userForCustomer" | "emailFor">, deps: LifecycleDeps = {}): Promise<void> {
  try {
    switch (event.type) {
      case "customer.subscription.created": {
        const sub = event.data.object;
        if (sub.status !== "trialing" && !sub.trial_start) return;
        const userId = sub.metadata?.user_id || (await userOf(db, sub.customer));
        if (userId) await recordFunnel("trial_start", userId, {}, deps.funnel);
        return;
      }
      case "invoice.paid": {
        const inv = event.data.object;
        if (!(inv.amount_paid > 0)) return;   // the $0 invoice that opens a trial is not a charge
        const userId = await userOf(db, inv.customer);
        if (userId) await recordFunnel("paid", userId, {}, deps.funnel);
        return;
      }
      default:
        return;
    }
  } catch (e) {
    console.error("[lifecycle] billing hook failed:", event.type, event.id, e instanceof Error ? e.message : e);
  }
}

async function userOf(db: Pick<BillingDb, "userForCustomer">, customer: string | { id: string } | null | undefined) {
  const id = idOf(customer);
  return id ? db.userForCustomer(id) : null;
}
