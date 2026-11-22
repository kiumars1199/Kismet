# Lane: onboarding-invites (builder, Sonnet)
Read `_common.md` first. Features: **F5**, **F13**, **F12** in `SPEC.md`.

**You own:** `apps/web/app/onboarding/`, `apps/web/app/signup/`, `apps/web/components/onboarding/`,
`apps/web/app/invite/`, `apps/web/components/share/`, `apps/web/app/api/og/`, digest email files under
`apps/web/lib/email/` (new `digest*.ts`). **Don't touch:** engine, checker, billing internals, journal. Home/Best
bets (`app/page.tsx`, `components/screener/BestBets.tsx`) are shared: ask the lead.

**Build on:**
- Onboarding already saves topics to the profile: `components/onboarding/Onboarding.tsx`, `OnboardingNudge.tsx`,
  `lib/activation.ts` (`nudgeOnServer`), user filters in `lib/filters/user.ts`. F5 makes Home/Best bets open with
  those filters plus a one-tap "Your topics" pill (`components/screener/AppliedPills.tsx` pattern).
- Never rank by the user's own bets. A topic filter returns the same flags for everyone.
- Share image: copy `app/opengraph-image.tsx` (fonts `app/Inter-Regular.ttf`, `SpaceGrotesk-Bold.ttf`).
- Invite reward: `subscriptions.comp_tier` / `comp_expires_at` and `effectiveTier()` in `lib/entitlements.ts`;
  grants pattern in `supabase/migrations/20261119000300_plan_grants.sql`. New tables via additive migration with RLS.
- Digest: `lib/email/lifecycle.ts` + `lifecycle-templates.ts` + `app/api/lifecycle/run` show the cron + template +
  one-click unsubscribe pattern (`app/api/unsubscribe`). Never send to real users in testing.

**Order:** F5 (blocks launch), then F13, then F12.

**Tests:** paid e2e `launch-f05-topics`; unit tests for self-referral and reward (≥ 5 + reward cases), digest
render test; `supabase/tests` RLS for invite rows.
