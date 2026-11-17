# MarketEdge setup

This guide walks through every account to create and every value to paste, in order.
Each step points to the detailed notes in `docs/setup-notes/`.
Every key goes in the platform's env settings: Vercel for the web app, Railway or Fly for the engine.
For local runs, put keys in `apps/web/.env.local`, which git ignores. Never put a key in a committed file.
`apps/web/.env.example` lists every web variable, empty. `.env.example` at the repo root lists the engine's variables.

## 0. Run it locally (no accounts needed)

You need Python 3.12+, Node 22 and pnpm.

```bash
pip install -r requirements.txt
```
```bash
python3 -m engine scan
```
```bash
cd apps/web && pnpm i --frozen-lockfile && pnpm dev
```
Open http://localhost:3000. Outside production, demo mode is the default: no login, no billing, every feature
unlocked, data read from `output/`. Checks: `pnpm lint && pnpm typecheck && pnpm test && pnpm e2e`, plus
`python3 -m pytest -q engine/tests ops/tests`.

`python3 -m engine all` also re-fits the model. That needs the market history in `data/`; the first run bootstraps it,
which takes about an hour.

## 1. Accounts to create, in order

| # | Account | What for | Detailed steps |
|---|---|---|---|
| 1 | GitHub repo settings and a fine-grained read-only token | `live` data branch, CI, Dependabot | `docs/setup-notes/ops.md` §3 |
| 2 | Supabase project (us-east-1) | Auth, user database, private `scan` bucket | `docs/setup-notes/lane-l.md` §1, then `ops.md` §1 |
| 3 | Google Cloud OAuth client | "Continue with Google" | `lane-l.md` §2 |
| 4 | Stripe: test mode first, live at launch | Checkout or 4 Payment Links, portal, webhook | `lane-l.md` §3 |
| 5 | Domain and DNS | Canonical site, email | §3 below |
| 6 | Resend, with SPF, DKIM and DMARC | Magic links (through Supabase SMTP) and alert emails | `ops.md` §7 |
| 7 | Upstash Redis (us-east-1) | Rate limits and one-time trading nonces. **Required in production** | `ops.md` §8, `security.md` |
| 8 | Sentry (Next.js project) | Errors, with PII scrubbing | `ops.md` §5 |
| 9 | PostHog (cookieless) | Product analytics | `ops.md` §6 |
| 10 | Railway, or Fly.io | Engine container: scan every 10 min, update and fit hourly, backtest daily | `ops.md` §2 |
| 11 | Vercel: Pro when charging | Web app, API, crons, Firewall, BotID | `ops.md` §4, `security.md` |
| 12 | Better Stack or UptimeRobot | Uptime checks on `/api/health` and `/api/meta` | `ops.md` §9 |
| 13 | Chrome Web Store developer account | The extension (Premium) | `trading-extension.md` §4–5, `docs/STORE_LISTING.md` |
| 14 | Kalshi **demo** account and a trade-only demo key (optional) | Paper trading tests | `trading-extension.md` §1–2 |

## 2. Every value and where it goes

**Vercel → Project → Settings → Environment Variables** (root directory `apps/web`):

| Variable | Value | From step |
|---|---|---|
| `DEMO_MODE` | `false` (or leave unset) in production. Only exactly `true` turns demo on | — |
| `DATA_SOURCE` | `supabase` (`local` for development) | 2 |
| `GITHUB_DATA_TOKEN` / `GITHUB_DATA_REPO` / `GITHUB_DATA_REF` | token / `kiumars1199/marketedge` / `live` | 1 |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API | 2 |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key. Sensitive, server only | 2 |
| `NEXT_PUBLIC_SITE_URL` | `https://<your domain>` | 5 |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Stripe → Developers | 4 |
| `STRIPE_PRICE_PRO_MONTHLY` / `_PRO_YEARLY` / `_PREMIUM_MONTHLY` / `_PREMIUM_YEARLY` | price ids. Leave empty in Payment Links mode | 4 |
| `STRIPE_PORTAL_URL` | optional portal login link | 4 |
| `RESEND_API_KEY` / `EMAIL_FROM` | Resend sending key / `MarketEdge <alerts@mail.<domain>>` | 6 |
| `UNSUBSCRIBE_SECRET` | `openssl rand -hex 32` | — |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Upstash REST URL and token | 7 |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry DSN | 8 |
| `NEXT_PUBLIC_POSTHOG_KEY` / `NEXT_PUBLIC_POSTHOG_HOST` | PostHog project key / host | 9 |
| `CRON_SECRET` | `openssl rand -hex 32` | — |
| `HEALTH_MAX_DATA_AGE_MIN` | `30` (use `150` if only the GitHub fallback runs) | — |
| `EXT_SIGNING_SECRET` | `openssl rand -base64 48`. Required outside demo mode | — |
| `NEXT_PUBLIC_EXTENSION_ID` / `NEXT_PUBLIC_EXTENSION_STORE_URL` | Chrome Web Store id / listing URL | 13 |
| `KALSHI_TRADING_ENV` | **leave empty in production.** `demo` turns on paper trading | 14 |
| `TRADING_ALLOWLIST` | emails allowed to paper-trade when trading is on | 14 |
| `ADMIN_EMAILS` | `marcyamin10@gmail.com,kiumarsmomtaz@gmail.com`. Who can open `/admin`. Empty means no admins. Also apply `supabase/migrations/20261118000000_admin.sql` | `docs/setup-notes/admin.md` |
| `KALSHI_DATA_PERMISSION` | leave empty until Kalshi grants data permission in writing | — |

Leave these empty everywhere except tests: `E2E_MOCK`, `STRIPE_API_BASE`, `DATA_DIR`, `KALSHI_DEMO_*`.

**Railway or Fly (engine service)**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and optionally `BACKTEST_HOUR_UTC`.

**`config/site.json`** (committed; nothing in it is secret): `domain`, `support_email`, `legal.*` (operator names,
governing state, mailing address, refund policy, response time, last updated). If you use Payment Links, also fill
`stripe.mode = "links"` and `stripe.paymentLinks.*`. Empty values show as `[[PLACEHOLDER]]` on the site.

**Supabase dashboard**: run `supabase/migrations/*.sql`. Set the Auth redirect URLs, the Google provider, and custom
SMTP through Resend. Set the magic-link OTP expiry to 15 minutes and keep email rate limits on. Then run the
Security Advisor (`lane-l.md`, `security.md`).

**Stripe dashboard**: create the products and prices, the webhook endpoint `https://<domain>/api/stripe/webhook`
(5 events), and the Customer Portal settings. Turn on a 7-day trial in Checkout (the app sends it).

## 3. Domain and DNS

1. Buy the domain at any registrar.
2. In Vercel → Domains, add the apex and `www`, and create the A/CNAME records Vercel shows. Set `NEXT_PUBLIC_SITE_URL`.
3. Resend: add `mail.<domain>` and create the SPF, DKIM, DMARC and MX records (`ops.md` §7).
4. Supabase Auth → Site URL = `https://<domain>`. Redirect URL = `https://<domain>/auth/callback`.
5. Build the extension for the domain: `ME_ORIGIN=https://<domain> pnpm ext:zip` (`trading-extension.md` §4).

## 4. Deploy

1. Push to `main`. Vercel builds `apps/web`, and Railway builds `engine/Dockerfile`.
2. Vercel → Firewall: Bot Protection = Challenge, AI Bots = Deny, and OWASP if your plan has it, then Publish
   (`security.md`).
3. Check each of these:
   - `curl -s https://<domain>/api/health` returns 200 with `db: ok`, a supabase data source, and rate limiting on.
   - `curl -I https://<domain>/` shows the CSP, HSTS, `X-Frame-Options` and `Referrer-Policy` headers.
   - `curl -i https://<domain>/api/alerts/run` returns 401.
   - A new sign-up lands on Free.
   - Pricing opens Checkout.
4. Add the uptime monitors (`ops.md` §9).

## 5. Roll back

- **Web**: Vercel → Deployments → last good → **Promote to Production**, or `vercel rollback`.
- **Engine**: Railway → Deployments → last good → **Redeploy**. On Fly: `fly releases`, then `fly deploy --image <ref>`.
- **Data**: a scan that fails the data checks is never uploaded. To drop the current scan, delete the files in the
  `scan` bucket. The web app falls back to the GitHub `live` branch.
- **Database**: Supabase backups (Pro), or the nightly `pg_dump`. Write migrations forward-only.

Before you charge money or turn on real trading, see `LAUNCH_TODO.md`.
