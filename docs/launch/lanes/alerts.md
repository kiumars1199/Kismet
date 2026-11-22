# Lane: alerts (builder, Sonnet, wave 2)
Read `_common.md` first. Features: **F10**, **F16** in `SPEC.md`.

**You own:** the web app manifest (`app/manifest.ts`, new), the service worker (`public/sw.js`, new),
`apps/web/app/api/push/`, `apps/web/lib/alerts*.ts`, `apps/web/app/api/alerts/`, `apps/web/components/alerts/`.
**Don't touch:** engine (ask the data lane for big-trade data), billing, checker, journal.

**Build on:**
- Alerts today: `lib/alerts.ts`, `lib/alerts-server.ts`, cron `app/api/alerts/run`, tests `lib/alerts.test.ts`,
  `test/alerts-cron.test.ts`, `test/alerts-email.test.ts`. Rules live in `alert_rules` (see `lib/repo/schemas.ts`).
  Add a `push` channel beside email and in-app; existing channels must keep working unchanged.
- `push` is already a Pro feature in `lib/entitlements.ts`. Big-trade alerts (F16) are Premium only.
- Web push needs VAPID keys from env (Q pastes them; list them in your PR). Store subscriptions in a new table via
  an additive migration with RLS. iOS needs the site installed to the home screen (iOS 16.4+): show an install hint.
- Big trades: Polymarket's public trades data; document the source URL and the $10,000 threshold.
- Never send pushes to real users in testing; use a mock sender in tests.

**Tests:** `pnpm test` (extend alerts-cron for dedupe), Lighthouse installability on the preview, e2e for the
subscribe button, unit test that Free and Pro never get F16.
