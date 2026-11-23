# Reviewer: F15 #49 c8d68a1 with #50 850bdd3 cherry-picked (local only)

## Checks
- typecheck, lint: pass. vitest admin-metrics-sql (PGlite seeded fixture, hand-computed), admin-metrics, ledger, rls and the billing tests: 12 files, 94/94 pass (checks.log).
- e2e-paid (e2e-paid.log):
  - admin.spec.ts 2/2 with #50's 300 s timeout (1.3 min and 50 s).
  - launch-f15-admin 1/1.
  - Reviewer shots: non-admin /admin 404, signed-out /admin 404.
- build and check:js: / is 142.5 kB, under the 150 kB budget (build.log).
- #50 changes only 2 lines in apps/web/e2e-paid/admin.spec.ts (test.setTimeout). Both PRs merge cleanly with final 651462b (both are based on cd9f672).

## Done when
1. /admin shows daily sign-ups, trials, payments and paying users now, revenue in dollars, cancellations, and invites sent and verified for 30 UTC days: MET. See 1440-admin.png and 390-admin.png; at 390 the table scrolls inside its box and the page has no horizontal scroll.
2. A seeded fixture unit test passes, and non-admins still get 404: MET.

## Notes (low)
1. Two blocks on the same page disagree (screenshots).
   - The new "Last 30 days" block shows "MRR (estimate) $0.00" and "1 canceled". The existing "Revenue (Stripe subscriptions)" block shows "$0" and "0 canceled since the 1st".
   - The sources differ (stripe_events against subscriptions), but an admin sees two MRR formats and two churn numbers. Either merge the blocks or label the source.
2. MRR counts yearly subscribers at the monthly list price. The existing overview does the same, and the label says "estimate".
3. Revenue shows a dash until the migration is applied and invoice.paid is enabled on the live webhook. The F234 notes say to rerun ops/stripe-setup.mjs. Invites read 0 until the F13 table exists (its columns match the F13 migration).
