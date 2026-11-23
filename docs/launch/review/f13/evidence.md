# F13 evidence (share image, invite link + QR, 5-sign-up Premium reward)

Branch launch/onboarding-f13, merged with origin/final. Run in apps/web.

- `pnpm typecheck`: clean. `pnpm lint`: clean (max-warnings 0).
- `pnpm exec vitest run`: 1502 passed, 5 skipped. One timing test (`test/api.test.ts` p95 < 150 ms over 15k rows) failed under full-suite load; it passes alone (7/7) and is unrelated to F13.
- F13 unit/SQL tests: lib/invites/core (15), server (9), test/invites-sql (11, PGlite: RLS, no client writes, reward once at 5, stacks, never lowers), bet-facts, og-bet.
- `pnpm build && pnpm check:js`: "/: first-load JS 142.6 kB gzipped; budget 150 kB: OK".
- `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium PW_PORT=3240 pnpm exec playwright test launch-f13 -c playwright.paid.config.ts --project=chromium`: 3 passed. CLS on /account at 390 px: 0.0000.
- Screenshots (this folder): 1440 px account-0-of-5-1440, share-sheet-3-of-5-1440, account-5-of-5-premium-1440; 390 px account-390, share-sheet-390.
- Needs lead: apply supabase/migrations/20261122000200_invites.sql. Q sets server secret INVITE_IP_SALT (unset = address checks skipped).
