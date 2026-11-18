# Ship MarketEdge: the morning runbook

The shortest path from zero to live. Each step is a command unless it can only be done by a person
(**By hand**). Times are rough. Steps are in order: later ones need values from earlier ones.

Every script prints what it will do and changes nothing until you add `--yes`. Each one is safe to run
twice. Run them from the repo root. `SETUP.md` has the long form and the reasons, and the detailed notes
are in `docs/setup-notes/`.

All production values go in one file, `apps/web/.env.prod`. Git ignores it, and Next.js never loads it,
so local `pnpm dev` and the e2e tests can't pick up production keys by mistake.

Total: about 2.5 hours of your time, plus waiting for DNS, the first engine run (~1 hour) and the lawyer.

| # | Step | Time |
|---|---|---|
| 1 | Tools | 5 min |
| 2 | Accounts (by hand) | 45 min |
| 3 | Secrets file | 1 min |
| 4 | Owner and legal values | 5 min |
| 5 | Paste provider keys | 15 min |
| 6 | Supabase | 20 min |
| 7 | Stripe (test mode) | 5 min |
| 8 | Preflight | 2 min |
| 9 | Vercel project and env | 15 min |
| 10 | DNS (by hand) | 15 min + waiting |
| 11 | Engine on Railway (by hand) | 10 min + ~1 h first run |
| 12 | Deploy and smoke test | 10 min |
| 13 | Firewall and uptime (by hand) | 10 min |
| 14 | Go live: Stripe live mode | 20 min |
| 15 | Extension (by hand) | 30 min |

---

## 1. Tools (5 min)

You need Node 22+, pnpm, Python 3.12, and two CLIs:

```bash
cd apps/web && pnpm i --frozen-lockfile && cd ../..
brew install supabase/tap/supabase
npm i -g vercel
```

Stripe needs no CLI. The script uses the Stripe SDK that the app already installs.

## 2. Accounts (by hand, 45 min)

Create these. Keep each dashboard open, because step 5 pastes keys from them. `SETUP.md` §1 has the details.

- **Domain** at any registrar.
- **GitHub repo settings**: Actions → Workflow permissions = Read and write. Turn on Dependabot alerts.
  Add a branch protection rule on `main` that requires `web-ci / web` and `web-ci / python`.
  Create a fine-grained token for this repo only, with Contents: Read-only (`docs/setup-notes/ops.md` §3).
- **Supabase** project in us-east-1. Save the database password in your password manager.
- **Stripe** account. Stay in test mode for now.
- **Upstash** Redis database in us-east-1, Regional.
- **Resend** account.
- **Sentry** project (Next.js) and **PostHog** project. Both are optional, but recommended.
- **Vercel**: the Pro plan, because Hobby rejects the 5-minute cron and doesn't allow commercial use.
- **Railway** (or Fly.io) for the engine.
- **Google Cloud** project for "Continue with Google". You do the OAuth consent screen in step 6.

Start the **lawyer review** of `/terms`, `/privacy`, `/refunds`, `/disclaimer` and `/contact` now, because
it takes the longest. Run `pnpm dev` in `apps/web` and send the lawyer those pages, or wait for the deploy.

## 3. Secrets file (1 min)

```bash
node ops/secrets.mjs --yes
```

This creates `apps/web/.env.prod` from `apps/web/.env.example` (mode 600) with `DEMO_MODE=false` and
`DATA_SOURCE=supabase`. It also generates `CRON_SECRET`, `UNSUBSCRIBE_SECRET` and `EXT_SIGNING_SECRET`.
It never replaces a value that is already set.

## 4. Owner and legal values (5 min)

```bash
node ops/site-config.mjs --domain marketedge.com --support-email help@marketedge.com \
  --operator-names "Your Name and Partner Name" --state Delaware --refund-policy first_charge_7_days \
  --response-time "2 business days" --address "Street, City, ST 00000"
```

Read the diff, then run the same command again with `--yes`. Commit `config/site.json`. Nothing in it is
secret. `--last-updated` defaults to today. For Payment Links instead of Checkout, add
`--stripe-mode links --link-pro-monthly <url> ...` (`node ops/site-config.mjs --help` lists the flags).

## 5. Paste provider keys (by hand, 15 min)

Open `apps/web/.env.prod` and fill in:

| Variable | Where |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://<your domain>` |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project settings → API |
| `STRIPE_SECRET_KEY` | Stripe → Developers → API keys (test `sk_test_…` for now) |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Upstash → database → REST API |
| `RESEND_API_KEY`, `EMAIL_FROM` | Resend → API keys; `MarketEdge <alerts@mail.<domain>>` |
| `GITHUB_DATA_TOKEN` | the token from step 2 |
| `NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_POSTHOG_KEY` | Sentry and PostHog project settings |

`ADMIN_EMAILS` comes filled in from the example. Leave the Stripe price ids and the webhook secret empty,
because step 7 fills them in.

## 6. Supabase (20 min)

```bash
supabase login
ops/supabase-setup.sh <project-ref>          # read the plan
ops/supabase-setup.sh <project-ref> --yes
```

The script runs these steps:

1. `supabase link`. It asks for the database password.
2. `supabase db push`, which applies every migration.
3. The pgTAP RLS tests. They need Docker; without it this step only warns.
4. It creates the private `scan` bucket.

The script then prints a checklist of dashboard settings that have no CLI. Do each one by hand: the auth
redirect URLs, the Google provider, SMTP through Resend, OTP expiry at 15 minutes, the Security Advisor and
backups. The Google provider needs a Google Cloud OAuth client and its consent screen (`docs/setup-notes/lane-l.md` §2).

## 7. Stripe, test mode (5 min)

```bash
node ops/stripe-setup.mjs          # reads your account, shows what it would create
node ops/stripe-setup.mjs --yes
```

This creates the Pro and Premium products and the 4 prices from `config/site.json` → `prices_usd`. It also
creates the webhook endpoint `https://<domain>/api/stripe/webhook` with the 5 events the app handles, and
the Customer Portal settings. It writes the price ids and the webhook signing secret into the empty lines
of `apps/web/.env.prod`. The secret is shown only once, when the endpoint is created. Keep it.

## 8. Preflight (2 min)

```bash
cd apps/web && pnpm preflight && cd ../..
```

Fix every `BLOCK` line, then run it again. It exits 0 when nothing blocks. Warnings are optional features,
such as no Sentry, or an extension that isn't published yet.

## 9. Vercel project and env (15 min)

**By hand:** in Vercel, go to Add New → Project and import the repo. Set **Root Directory = `apps/web`**
(the CLI can't set it). Skip the first deploy, or let it fail: the env isn't set yet. Then:

```bash
cd apps/web && vercel login && vercel link && cd ../..
node ops/vercel-env.mjs            # prints every `vercel env add`, secrets masked
node ops/vercel-env.mjs --yes      # Production + Preview; refuses while preflight has blockers
```

## 10. DNS (by hand, 15 min + waiting)

At your registrar:

- Add the A and CNAME records that Vercel → Domains shows for the apex and `www`.
- Add the SPF, DKIM, DMARC and MX records that Resend shows for `mail.<domain>` (`docs/setup-notes/ops.md` §7).

Wait until both show Verified.

## 11. Engine on Railway (by hand, 10 min + ~1 h first run)

In Railway, go to New Project → Deploy from GitHub repo, and choose this repo. Add a volume at `/app/data`.
Set the variables `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (the same values as in `.env.prod`). Don't
give it a public domain. The first run downloads the market history, which takes about 1 hour. Then the
`scan` bucket fills up. See `docs/setup-notes/ops.md` §2, which also covers Fly.

## 12. Deploy and smoke test (10 min)

Push to `main` (Vercel deploys it), or click Redeploy on the latest deployment. Then:

```bash
CRON_SECRET=<value from .env.prod> ops/smoke-prod.sh https://<domain>
```

All checks must PASS:

- health 200, with db ok, data source supabase and rate limiting on
- the security headers
- cron routes return 401
- robots.txt, sitemap.xml and og:image
- `/admin` and `/e2e-mock` return 404
- a 429 after a burst

Health stays 503 until the engine's first scan reaches the bucket. Run this before step 13: once Bot
Protection is on, the Vercel Firewall may challenge curl.

**By hand:** sign up with a new email and check that it lands on Free. Check that Pricing opens Stripe Checkout.

## 13. Firewall and uptime (by hand, 10 min)

- Vercel → Firewall: Bot Protection = Challenge, AI Bots = Deny, then Publish (`docs/setup-notes/security.md`).
- Better Stack or UptimeRobot: monitors on `https://<domain>/api/health` and `/api/meta` (`ops.md` §9).

## 14. Go live: Stripe live mode (20 min)

1. In `apps/web/.env.prod`, set `STRIPE_SECRET_KEY` to the live `sk_live_…` key. Empty the four
   `STRIPE_PRICE_*` lines and `STRIPE_WEBHOOK_SECRET`. Test-mode ids don't exist in live mode, and the
   scripts never replace a value that is already set.
2. Run these:

   ```bash
   node ops/stripe-setup.mjs --yes --live
   cd apps/web && pnpm preflight --live && cd ../..
   node ops/vercel-env.mjs --yes
   ```

3. Redeploy: Vercel → Deployments → latest → Redeploy (env changes need a new deploy).
4. **By hand:** make one real purchase, cancel it in the portal, and refund it in Stripe.

Before you announce, let the data refresh run for 48 hours. The Railway logs and `refresh.yml` must both stay green.

## 15. Chrome extension (by hand, 30 min + review)

Run `ME_ORIGIN=https://<domain> pnpm ext:zip` and upload the zip to the Chrome Web Store
(`docs/setup-notes/trading-extension.md` §4–5). Once it is approved:

1. Set `NEXT_PUBLIC_EXTENSION_ID` (and the store URL) in `.env.prod`.
2. Run `node ops/vercel-env.mjs --yes`.
3. Redeploy.

Real-money trading has its own legal checklist (`LAUNCH_TODO.md`). Leave `KALSHI_TRADING_ENV` empty.
Preflight blocks it.

---

## Script reference

| Command | Does | Writes |
|---|---|---|
| `node ops/secrets.mjs [--env f] --yes` | creates the env file, generates the 3 app secrets | local file only |
| `node ops/site-config.mjs <flags>\|--from f.json --yes` | fills and validates `config/site.json` | local file only |
| `ops/supabase-setup.sh <ref> [--env f] --yes` | link, db push, RLS tests, `scan` bucket, prints checklist | Supabase |
| `node ops/stripe-setup.mjs [--env f] [--domain d] --yes [--live]` | products, prices, webhook, portal | Stripe + empty env lines |
| `pnpm preflight [--env f] [--live]` (in `apps/web`) | reports missing, malformed or dangerous values, exit 1 on blockers | nothing |
| `node ops/vercel-env.mjs [--env f] --yes` | `vercel env add` for Production and Preview | Vercel |
| `ops/smoke-prod.sh <url>` | post-deploy PASS/FAIL checks | nothing (a 40-request burst on one log-only route) |

Tests: `cd apps/web && pnpm test:ops`, which also runs as part of `pnpm test` and CI. They use fakes and
local mocks only.

### Smoke test against a local production build

```bash
cd apps/web
DEMO_MODE=false NEXT_PUBLIC_SITE_URL=http://localhost:4040 pnpm build
DEMO_MODE=false NEXT_PUBLIC_SITE_URL=http://localhost:4040 pnpm exec next start -p 4040 &
cd ../.. && SMOKE_EXPECT_HEALTH=503 ops/smoke-prod.sh http://localhost:4040
```

Expected differences on localhost:

- `/api/health` is **503**, because a live production build without Upstash reports rate limiting as
  degraded. That is the production safeguard working.
- Build with `DEMO_MODE=false`. Demo mode has no traffic limits, so the 429 check would fail.
- `NEXT_PUBLIC_SITE_URL` must be the local origin, or og:image and the sitemap point at the wrong host.
- HSTS is sent over http too. Browsers ignore it there.
- `CRON_SECRET` health details aren't checked unless you set one at start.

Last run: 18 passed, 0 failed.
