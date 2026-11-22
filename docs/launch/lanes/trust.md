# Lane: trust (builder, Sonnet)
Read `_common.md` first. Features: **F7**, **F8**, **F9**, **F15** in `SPEC.md`.

**You own:** `apps/web/lib/billing/`, `apps/web/app/api/stripe/`, `apps/web/app/account/`, `apps/web/app/admin/`,
`apps/web/components/admin/`, legal pages (`app/terms`, `app/privacy`, `app/disclaimer`, `app/refunds`),
`config/site.json`, `config/venue-availability.json`, `docs/launch/go-live.md`. **Don't touch:** engine, checker,
journal, onboarding.

**Build on:**
- Stripe: `lib/billing/stripe.ts`, `plans.ts`, `db.ts`, webhook in `app/api/stripe/webhook/`; setup script
  `ops/stripe-setup.mjs`, env push `ops/vercel-env.mjs`, runbook `ops/ship.md`. F7 is mostly: prove every price ID
  and key comes from env, test the mode switch, and write `go-live.md`. Never type keys.
- 18+: signup already has an 18+/Terms checkbox (`app/signup`, `components/auth`); verify and add the e2e.
- Self-pause (F8): add `paused_until` to a server-owned column (see `supabase/migrations/20261118000200_server_owned_columns.sql`
  for the pattern), enforce in `middleware.ts`-adjacent server checks and data routes (423). Middleware is shared: ask.
- Help lines and state availability (F8, F9): research on the web; every entry has a source URL and a checked date.
- Admin (F15): `app/admin/page.tsx`, `components/admin/Stats.tsx`, `SignupsChart.tsx`, SQL in
  `supabase/migrations/20261118000000_admin.sql`. Revenue shows dollars, never cents.

**Order:** F7, F8, F9 (all block launch), then F15.

**Tests:** `pnpm test` (billing tests in `lib/billing/stripe.test.ts`), paid e2e `launch-f08-pause`,
e2e `launch-f09-availability`, `test/admin*.test.ts` must keep passing.
