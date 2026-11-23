# F15 evidence (apps/web, 2026-11-22)

- pnpm typecheck: clean. pnpm lint: clean (--max-warnings 0).
- pnpm test: 118 of 119 files, 1470 of 1471 tests pass. Only failure: test/api.test.ts apply() p95 timing (flaky under load, passes alone).
- New tests: test/admin-metrics-sql.test.ts (6, real migrations in PGlite, seeded fixture, hand-computed), test/admin-metrics.test.ts (8, dollars/cents, totals, dashes), lib/billing/ledger.test.ts (4, webhook stores amount_cents), test/rls.test.ts function list includes admin_metrics.
- e2e-paid launch-f15-admin.spec.ts: passed (2 payments $31.98 from cents, $0 invoice not a payment, 1 cancel, 30 rows, dash before ledger, no page scroll at 390 px).
- e2e-paid admin.spec.ts fails on origin/final too in this environment (page.goto ERR_ABORTED, 2.0m each, dev server under memory limit); not caused by this change.
- pnpm build && pnpm check:js: / first-load JS 142.5 kB gzipped; budget 150 kB: OK.
- Migration 20261122000300_admin_metrics.sql is additive; admin_overview untouched; function is service-role only (rls.test.ts checks search_path and no anon/authenticated execute).
