# F10 #56 62f1858 (delta 3234b82..62f1858): FAIL (merge conflict only; code passes)
- PR is dirty: apps/web/test/rls.test.ts conflicts with final (final added admin_metrics to the security-definer list; this adds
  claim_push_subscription). Union of both lists resolves it. No CI ran on 62f1858 (only Vercel Preview Comments).
- sw.js safePath: new URL(u, origin), keeps only same origin, else "/"; used in push and notificationclick. "//host", "/\t/host" and absolute
  off-origin URLs all fall to "/". sw.test covers it.
- 000550 claim_push_subscription: security definer, search_path '', revoke from public/anon/authenticated, grant to service_role. rls.test (real SQL)
  shows B can't upsert over A's row, authenticated and anon get "permission denied", wrong or missing keys -> false, exact keys -> moves to B. Cap 10 in SQL.
- Second account: the route falls back to the claim when the upsert fails (push-subscribe.test: moves with matching keys, not with other keys, not without admin).
  Gap: not run in a browser (headless has no push service, and the e2e mock has no rpc claim_push_subscription).
Unit (wtf01b @62f1858): push-subscribe + sw + rls 43/43.
