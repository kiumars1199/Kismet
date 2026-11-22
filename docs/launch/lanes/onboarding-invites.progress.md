# onboarding-invites progress

- F5 (topics at signup) · DONE, PR open: https://github.com/kiumars1199/Kismet/pull/47 (branch launch/onboarding-f05) · no preview URL yet
  Evidence (apps/web): vitest default-topics 4/4 + test/topic-filter-same-for-all 2/2; full pnpm test 1440/1441 (api.test.ts apply() p95 timing flaked under load, 7/7 alone); pnpm typecheck + lint clean; pnpm build + check:js "142.5 kB gzipped; budget 150 kB: OK"; PW_PORT=3240 playwright -c playwright.paid.config.ts e2e-paid/launch-f05-topics.spec.ts: 2 passed.
  Needs lead: apply supabase/migrations/20261122000100_profile_topics_off.sql (additive, profiles.topics_off boolean). Fixture has no open Politics topics, so the e2e picks NFL + NBA.
  BestBets.tsx not edited (server redirect made it unnecessary).
- F13 (share + invite) · not started; needs plan to main, migration, OG route. Next.
- F12 (digest) · not started.
