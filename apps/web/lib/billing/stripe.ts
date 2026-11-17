// Stripe billing (docs/08 § Billing, docs/14 §2, docs/15 § Billing). Server only.
// Two modes, picked by config: Checkout (keys + price ids in env) or Payment Links (config/site.json).
// Either way the tier is written only here, from verified webhook events.
import Stripe from "stripe";
import { site } from "@/lib/site";
import type { Tier } from "@/lib/entitlements";
import { sendEmail, siteUrl, unsubscribeUrl } from "@/lib/email";

export const PRICE_KEYS = ["pro_monthly", "pro_yearly", "premium_monthly", "premium_yearly"] as const;
export type PriceKey = (typeof PRICE_KEYS)[number];

const PRICE_ENV: Record<PriceKey, string> = {
  pro_monthly: "STRIPE_PRICE_PRO_MONTHLY", pro_yearly: "STRIPE_PRICE_PRO_YEARLY",
  premium_monthly: "STRIPE_PRICE_PREMIUM_MONTHLY", premium_yearly: "STRIPE_PRICE_PREMIUM_YEARLY",
};
export const priceId = (k: PriceKey) => process.env[PRICE_ENV[k]] ?? "";
const links = () => site.stripe.paymentLinks as Record<PriceKey, string>;

/** Stripe API client, or null when STRIPE_SECRET_KEY is empty. STRIPE_API_BASE (dev/e2e only) points it at a mock. */
export function stripeClient(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  const base = process.env.NODE_ENV !== "production" && process.env.STRIPE_API_BASE ? new URL(process.env.STRIPE_API_BASE) : null;
  return new Stripe(key, base
    ? { host: base.hostname, port: Number(base.port), protocol: base.protocol.replace(":", "") as "http" | "https", maxNetworkRetries: 0 }
    : { maxNetworkRetries: 2 });
}

/** "checkout" when keys + all 4 price ids are set (preferred), "links" when all 4 payment links are, else null. */
export function billingMode(): "checkout" | "links" | null {
  if (!process.env.STRIPE_WEBHOOK_SECRET) return null;
  if (site.stripe.mode !== "links" && process.env.STRIPE_SECRET_KEY && PRICE_KEYS.every(priceId)) return "checkout";
  if (PRICE_KEYS.every((k) => links()[k])) return "links";
  return null;
}

/** Payment Link with the user attached so the webhook can match them (docs/14 §2). */
export function paymentLinkUrl(k: PriceKey, user: { id: string; email: string }): string {
  const u = new URL(links()[k]);
  u.searchParams.set("client_reference_id", user.id);
  if (user.email) u.searchParams.set("prefilled_email", user.email);
  return u.toString();
}

/** Tier for a price: env price ids first, then price metadata.tier, then the amount (Payment Links have no ids in env). */
export function tierFromPrice(p: { id: string; unit_amount?: number | null; metadata?: Record<string, string> | null } | null | undefined): Tier | null {
  if (!p) return null;
  for (const k of PRICE_KEYS) if (priceId(k) && priceId(k) === p.id) return k.startsWith("premium") ? "premium" : "pro";
  const meta = p.metadata?.tier;
  if (meta === "pro" || meta === "premium") return meta;
  const usd = (p.unit_amount ?? -1) / 100;
  const hit = PRICE_KEYS.find((k) => site.prices_usd[k] === usd);
  return hit ? (hit.startsWith("premium") ? "premium" : "pro") : null;
}

const PAYING = new Set(["trialing", "active", "past_due"]);

export interface SubscriptionRow {
  stripe_customer_id: string; stripe_subscription_id: string; tier: Tier; status: string;
  current_period_end: string | null; cancel_at_period_end: boolean; trialed_at?: string;
}

/** What the webhook needs from the database. Production: supabaseBillingDb() (service role). Tests: in memory. */
export interface BillingDb {
  seen(eventId: string): Promise<boolean>;
  markSeen(eventId: string, type: string): Promise<void>;
  linkCustomer(userId: string, customerId: string): Promise<void>;
  userForCustomer(customerId: string): Promise<string | null>;
  emailFor(userId: string): Promise<string | null>;
  upsertSubscription(userId: string, row: SubscriptionRow): Promise<void>;
}

const idOf = (x: string | { id: string } | null | undefined) => (typeof x === "string" ? x : x?.id ?? null);

/** Subscription → row. tier = free unless status is trialing/active/past_due (docs/08). */
export function subscriptionRow(sub: Stripe.Subscription): SubscriptionRow {
  const item = sub.items?.data?.[0];
  const loose = sub as unknown as { current_period_end?: number };
  const end = loose.current_period_end ?? (item as unknown as { current_period_end?: number } | undefined)?.current_period_end;
  const tier = PAYING.has(sub.status) ? tierFromPrice(item?.price) ?? "free" : "free";
  return {
    stripe_customer_id: idOf(sub.customer)!,
    stripe_subscription_id: sub.id,
    tier, status: sub.status,
    current_period_end: end ? new Date(end * 1000).toISOString() : null,
    cancel_at_period_end: !!sub.cancel_at_period_end,
    ...(sub.trial_start ? { trialed_at: new Date(sub.trial_start * 1000).toISOString() } : {}),
  };
}

export class RetryLater extends Error {}

async function applySubscription(db: BillingDb, sub: Stripe.Subscription, userHint?: string | null) {
  const row = subscriptionRow(sub);
  const userId = userHint ?? sub.metadata?.user_id ?? (await db.userForCustomer(row.stripe_customer_id));
  // Payment Links: subscription events can beat checkout.session.completed. 500 → Stripe retries later.
  if (!userId) throw new RetryLater(`no user for customer ${row.stripe_customer_id}`);
  await db.upsertSubscription(userId, row);
}

export async function handleEvent(event: Stripe.Event, db: BillingDb, stripe: Stripe | null): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const s = event.data.object;
      const userId = s.client_reference_id;
      const customer = idOf(s.customer);
      if (!userId || !customer) return;   // not ours (no user attached)
      await db.linkCustomer(userId, customer);
      const subId = idOf(s.subscription);
      if (subId && stripe) await applySubscription(db, await stripe.subscriptions.retrieve(subId), userId);
      return;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      return applySubscription(db, event.data.object);
    case "invoice.payment_failed": {
      const customer = idOf(event.data.object.customer);
      const userId = customer && (await db.userForCustomer(customer));
      const email = userId && (await db.emailFor(userId));
      if (email) {
        const text = "We couldn't charge your card. Update it from your account page (Manage billing) to keep your plan.";
        await sendEmail({
          to: email, subject: "Your MarketEdge payment didn't go through", text: `${text}\n\n${siteUrl()}/account`,
          html: `<p>${text}</p><p><a href="${siteUrl()}/account">Open your account</a></p>`,
          unsubscribeUrl: unsubscribeUrl(userId),
        });
      }
      return;
    }
    default:
      return;
  }
}

/** Verify (raw body, signature, 5-minute timestamp tolerance), dedupe by event.id, apply. */
export async function handleWebhook(req: Request, db: BillingDb, stripe: Stripe | null, secret = process.env.STRIPE_WEBHOOK_SECRET): Promise<Response> {
  const sig = req.headers.get("stripe-signature");
  if (!secret || !sig) return Response.json({ error: "Not configured or unsigned" }, { status: 400 });
  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = Stripe.webhooks.constructEvent(raw, sig, secret, 300);
  } catch {
    return Response.json({ error: "Bad signature" }, { status: 400 });
  }
  if (await db.seen(event.id)) return Response.json({ received: true, duplicate: true });
  try {
    await handleEvent(event, db, stripe);
  } catch (e) {
    console.error("[stripe] webhook failed", event.type, event.id, e instanceof Error ? e.message : e);
    return Response.json({ error: "Retry" }, { status: 500 });
  }
  await db.markSeen(event.id, event.type);   // after success, so a failed event is retried
  return Response.json({ received: true });
}
