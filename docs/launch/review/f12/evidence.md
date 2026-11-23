# F12 evidence (morning digest)
Branch launch/onboarding-f12 on origin/final. In apps/web:
- tsc clean, eslint clean (max-warnings 0).
- vitest: 1484 passed (lib/email/digest.test.ts: 11 tests: no cents, disclaimer, unsubscribe link + header, <= 5 bets, same bets per topic set, once a day, retry after failed send, cron secret, digest unsubscribe token + opt-out). test/cron.test.ts and test/rls.test.ts updated for the new cron and table.
- `pnpm build && pnpm check:js`: "/: first-load JS 144.6 kB gzipped; budget 150 kB: OK".
- chromium paid e2e qa-c-settings + overhaul-funnel (onboarding path with the new unticked checkbox): 4 passed (run on the F13 base, same onboarding code).
- Never sent: tests use a fake send; no Resend key is read outside lib/email sendEmail (disabled when unset).
- Needs lead: apply supabase/migrations/20261122000400_digest.sql (profiles.digest_opt_in default false, digest_emails). Cron: /api/digest/run daily 12:17 UTC in vercel.json.
