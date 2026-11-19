# 08 · Auth & billing

## Auth (Supabase)
- Providers: email magic link, Google OAuth. No passwords.
- On first sign-in: create `profiles` and `subscriptions(tier='free')` rows (DB trigger on `auth.users` insert).
- Signup screen requires checking "I'm 18 or older and agree to the Terms" (store `accepted_terms_at`).
- Local → account migration: if `localStorage` has presets/watchlist/favorites/journal, show
  "Import 4 presets and 12 watched markets into your account?" → bulk insert, then clear local.
- Server components read the session with `@supabase/ssr`; API routes verify the JWT.

## Billing (Stripe)
Products: `Kismet Pro` ($11.99/mo, $99.99/yr), `Kismet Premium` ($19.99/mo, $169.99/yr). 7-day trial.
```
Upgrade button → POST /api/stripe/checkout {price} → Stripe Checkout (customer = stripe_customer_id or new,
  client_reference_id = user_id, trial_period_days = 7 if never trialed) → success_url /settings/billing?ok=1
Manage → POST /api/stripe/portal → Stripe Customer Portal (change plan, cancel, invoices, card)
Webhook /api/stripe/webhook (verify signature):
  checkout.session.completed      → link customer ↔ user
  customer.subscription.created|updated|deleted
                                  → upsert subscriptions {tier from price id, status, current_period_end,
                                    cancel_at_period_end}; tier = 'free' if status not in (trialing, active, past_due)
  invoice.payment_failed          → email "update your card" (Stripe handles dunning)
```
Idempotency: store processed `event.id` in a `stripe_events` table; skip repeats.

Payment risk: Stripe restricts some gambling-related businesses. Describe the product as
"prediction market analytics software". Keep Lemon Squeezy or Paddle as a fallback
(same webhook shape behind `lib/billing/provider.ts`).

## Entitlements
```ts
const LIMITS = {
  free:    { live: false, delayMin: 15, rows: 25, exactEdge: false, flagsPerDay: 3, presets: 1,
             dashboards: 0, watchlist: 10, alerts: 0, channels: [], execution: "verdict", journal: false,
             csv: false, extension: false, filters: "basic" },
  pro:     { live: true, delayMin: 0, rows: 200, exactEdge: true, flagsPerDay: Infinity, presets: 25,
             dashboards: 3, watchlist: Infinity, alerts: 20, channels: ["email","push"], execution: "full",
             journal: true, csv: true, extension: false, filters: "all" },
  premium: { ...pro, presets: Infinity, dashboards: Infinity, alerts: 100,
             channels: ["email","push","telegram","discord"], extension: true },
}
useEntitlements() // client: from /api/me; server: getEntitlements(userId) (cached 60 s)
```
Gates are enforced **server-side** in API routes (trimming fields and rows), and mirrored in the UI
with `<UpgradeGate>`. Demo mode (no auth configured) runs as `premium` so the demo shows everything, including the extension.
