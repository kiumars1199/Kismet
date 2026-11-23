# Go live with payments (F7)

Going live is an environment change. No price ID, key or secret is in the repo; `lib/billing/mode.test.ts` scans for them.
Q pastes every value into Vercel himself. Never paste a key into chat, a PR or a file in the repo.

Test or live is picked by `STRIPE_SECRET_KEY`: `sk_test_...` is test, `sk_live_...` is live (`lib/billing/mode.ts`).
Price IDs and the webhook secret must come from the same Stripe mode as the key.

## Environment variables (Vercel > Project > Settings > Environment Variables, Production)

| Variable | Where it comes from | Where Q pastes it |
|---|---|---|
| `STRIPE_SECRET_KEY` | Stripe Dashboard (live mode) > Developers > API keys > Secret key, or a restricted key with write on products, prices, webhook endpoints, portal configurations | Vercel env, Production, mark Sensitive. Or `node ops/vercel-env.mjs` from your own terminal reading `apps/web/.env.prod` |
| `STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_PRICE_PRO_YEARLY`, `STRIPE_PRICE_PREMIUM_MONTHLY`, `STRIPE_PRICE_PREMIUM_YEARLY` | `node ops/stripe-setup.mjs --yes --live` creates the products and prices from `config/site.json` and fills empty lines in the env file | Vercel env, Production |
| `STRIPE_WEBHOOK_SECRET` | Created by the same script, or Dashboard > Developers > Webhooks > the endpoint `https://kismetodds.com/api/stripe/webhook` > Signing secret (`whsec_...`) | Vercel env, Production, Sensitive |
| `STRIPE_PORTAL_URL` (optional) | Only if you use a fixed portal link | Vercel env |

`STRIPE_API_BASE` must stay empty in production (it is ignored when `NODE_ENV=production`, and `pnpm preflight` blocks it).

Webhook events the endpoint must send (the handler acts on exactly these; `ops/stripe-setup.mjs` reads them from the source):
`checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`,
`customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`.

## Receipts on

Stripe emails receipts only in live mode, and only when the setting is on:
Dashboard > Settings > Business > Customer emails > Payments > turn on **Successful payments** (and **Refunds**).
For subscription emails (failed payment, trial ending, cancellation) see Settings > Billing > Subscriptions and emails,
and keep Subscription management on so each email links to cancellation.
Source: https://docs.stripe.com/receipts and https://docs.stripe.com/invoicing/send-email (read 2026-11-22).
Kismet also sends its own first-charge receipt from the webhook (`lib/email/lifecycle.ts`).

## Before the switch

1. `cd apps/web && pnpm preflight --live` shows no blockers (a test key is a blocker with `--live`).
2. Customer Portal has a saved configuration (Dashboard > Settings > Billing > Customer portal: cancel subscriptions, switch plans, update card). Without it, "Manage billing" fails.

## 5-step live test (live charge and refund)

1. Sign up on kismetodds.com with a real email you control. Plan shows Free on `/account`.
2. `/pricing` > Pro monthly > Checkout > pay with a real card. Expect `/account` to show Pro within a few seconds.
3. Stripe Dashboard (live) > Developers > Webhooks > the endpoint > Recent deliveries: `checkout.session.completed`, `customer.subscription.created` and `invoice.paid` all show 200. A 500 means Stripe retries; check Vercel logs.
4. Check the receipt email arrived (Stripe receipt, plus Kismet's own).
5. Refund and cancel: Dashboard > Payments > the charge > Refund. Then `/account` > Manage billing > Cancel plan. Expect the plan to return to Free at period end (immediately if you cancel in the Dashboard with "Immediately"). Confirm `customer.subscription.deleted` shows 200.

Roll back: set `STRIPE_SECRET_KEY` to the test key (and the matching test price IDs and webhook secret) and redeploy.
