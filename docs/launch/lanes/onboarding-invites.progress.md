# onboarding-invites progress

- F5 (topics at signup) · PR https://github.com/kiumars1199/Kismet/pull/47 (branch launch/onboarding-f05, commit 2325297) · re-fixed after review fail #1
  Fixes: real 307 from middleware via server-set `me_topics` cookie (no DB call), page-level redirect removed; post-onboarding landing CLS 0.051 @390, 0.017 @1440 (was 1.848); screenshots repo-relative in docs/launch/review/f05/.
  Evidence (apps/web): pnpm test 1443/1443; typecheck + lint clean; build + check:js "142.5 kB gzipped; budget 150 kB: OK"; e2e-paid launch-f05-topics 4 passed (warm-up, 390, 1440, skip); qa-c-settings + overhaul-funnel pass.
  Needs lead: apply supabase/migrations/20261122000100_profile_topics_off.sql.
- F13 (share + invite) · built on branch launch/onboarding-f13, PR not yet open
  Done: migration 20261122000200_invites.sql (invite_codes, invites, invite_rewards, RLS own-read, no client writes, restrictive OAuth policy, grant_invite_reward() service-role only);
  lib/invites/{core,server,signin}.ts; /invite/<code>; /api/invite; /api/og/bet/<id> (Free-banded numbers); ShareSheet in the bet drawer; InvitePanel + QR (React SVG, `qrcode` 1.5.4) on /account; first-sign-in hook in lib/auth/finish.ts; e2e-mock rpc.
  Tests: lib/invites/core.test.ts (15), server.test.ts (9), test/invites-sql.test.ts (11, PGlite: RLS, no client writes, reward once at 5 / stacks / never lowers), lib/share/bet-facts.test.ts, test/og-bet.test.ts, supabase/tests/invites.test.sql, e2e-paid/launch-f13-invite.spec.ts. Full vitest 1493/1493.
  Env var for Q: INVITE_IP_SALT (server secret; unset = address checks skipped, never printed).
  Next: build + check:js, evidence in docs/launch/review/f13/, PR.
- F12 (digest) · not started.
- F13 #51 ready: merged origin/final; tsc, lint clean; vitest 1502 pass (one timing test flaky under load, passes alone); check:js 142.6 kB OK; chromium e2e launch-f13 3 passed; evidence docs/launch/review/f13/evidence.md.
- F12 (digest) · branch launch/onboarding-f12: built; evidence docs/launch/review/f12/evidence.md; opt-in default off logged in decisions.md. Migration 20261122000300_digest.sql for lead.
