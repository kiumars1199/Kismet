# Ship Kismet

Vercel team `kismet9`, project `kismet`, Root Directory `apps/web`, domain `kismetodds.com`. Every script prints its
plan and changes nothing until `--yes`; each is safe to run twice. Run them from the repo root. `SETUP.md` has the long
form. Production values live in `apps/web/.env.prod` (git-ignored, never loaded by Next.js); `apps/web/.env.example` is
the full env list. **By hand** = no CLI or API.

1. **Tools:** Node 22+, pnpm, Python 3.12, `brew install supabase/tap/supabase`, `npm i -g vercel`,
   then `cd apps/web && pnpm i --frozen-lockfile && cd ../..`.
2. **By hand, accounts:** domain `kismetodds.com`; Supabase (us-east-1); Stripe (test mode); Upstash Redis (us-east-1);
   Resend; Sentry and PostHog (optional); Vercel Pro on team `kismet9`; Railway; Google Cloud OAuth client.
   GitHub: Actions read/write, Dependabot on, branch protection on `main` requiring `web-ci / web` and
   `web-ci / python`, and a fine-grained read-only token for this repo (`docs/setup-notes/ops.md` §3).
3. **Secrets file:** `node ops/secrets.mjs --yes` creates `apps/web/.env.prod` with the 3 app secrets.
4. **Owner values:** already in `config/site.json` (Kismet, kismetodds.com, kismetodds@gmail.com, Indiana). Check with
   `node ops/site-config.mjs --from config/site.json`.
5. **By hand, paste keys** into `apps/web/.env.prod`: `NEXT_PUBLIC_SITE_URL=https://kismetodds.com`, the Supabase URL,
   anon and service-role keys, `STRIPE_SECRET_KEY` (`sk_test_…`), the Upstash URL and token, `RESEND_API_KEY`,
   `EMAIL_FROM=Kismet <noreply@kismetodds.com>`, `GITHUB_DATA_TOKEN`, `GITHUB_DATA_REPO=<owner>/<repo>` of this repo,
   and the Sentry and PostHog keys.
6. **Supabase:** `supabase login`, then `ops/supabase-setup.sh <project-ref> --yes` (link, migrations, RLS tests,
   `scan` bucket). **By hand:** the dashboard checklist it prints (redirect URLs, Google provider, SMTP through Resend
   with sender `noreply@kismetodds.com`, 15-minute OTP, Security Advisor, backups).
7. **Stripe (test):** `node ops/stripe-setup.mjs --yes` creates the products, 4 prices, webhook and portal, and fills
   the empty price-id and webhook-secret lines.
8. **Preflight:** `cd apps/web && pnpm preflight && cd ../..`. Fix every `BLOCK`.
9. **Vercel:** create project `kismet` in team `kismet9` with Root Directory `apps/web` (`apps/web/vercel.json` sets the
   framework, install and build commands, region `iad1` and the two crons). Then
   `cd apps/web && vercel link --scope kismet9 --project kismet --yes && cd ../..` and `node ops/vercel-env.mjs --yes`
   (Production and Preview).
10. **By hand, DNS:** add `kismetodds.com` and `www` in Vercel → Domains and create the records it shows; add the SPF,
    DKIM, DMARC and MX records Resend shows for `kismetodds.com`. Wait for both to verify.
11. **By hand, engine:** Railway → deploy this repo, volume at `/app/data`, `SUPABASE_URL` and
    `SUPABASE_SERVICE_ROLE_KEY`, no public domain. The first run takes about 1 hour.
12. **Deploy and smoke test:** deploy `main`, then `CRON_SECRET=… ops/smoke-prod.sh https://kismetodds.com`. All
    PASS (health stays 503 until the first scan lands). **By hand:** a new sign-up lands on Free; Pricing opens Checkout.
13. **By hand, firewall and uptime:** Vercel Firewall Bot Protection = Challenge, AI Bots = Deny, Publish; uptime
    monitors on `/api/health` and `/api/meta`.
14. **Go live:** put `sk_live_…` in `.env.prod`, empty the 4 `STRIPE_PRICE_*` lines and `STRIPE_WEBHOOK_SECRET`, run
    `node ops/stripe-setup.mjs --yes --live`, `cd apps/web && pnpm preflight --live && cd ../..`,
    `node ops/vercel-env.mjs --yes`, and redeploy. **By hand:** one real purchase, cancel, refund. Let the data refresh
    run green for 48 hours before announcing.
15. **By hand, extension:** `KISMET_ORIGIN=https://kismetodds.com pnpm ext:zip`, upload to the Chrome Web Store; once
    approved set `NEXT_PUBLIC_EXTENSION_ID` and the store URL, `node ops/vercel-env.mjs --yes`, redeploy. Leave
    `KALSHI_TRADING_ENV` empty (`LAUNCH_TODO.md`).
