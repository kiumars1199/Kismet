# #72 8d77871: #67 follow-ups (F8 ext pause)
Unit: vitest test/ext-pause.test.ts + test/paused-until-for-user.test.ts 7/7; extension test/pause.test.ts 4/4.
Mutations (scratch worktree, reverted): pause on every action -> "cancel while paused" fails; no pause check -> "paused: no new order" fails;
supabaseAdmin back outside the try -> paused-until-for-user fails. 3/3 caught.
Runtime (paid mock, next dev :3313, KALSHI_TRADING_ENV=demo, two allowlisted Premium users, valid place/cancel payloads): runtime.log
- unpaused A and B: token 200, nonce place 200, nonce cancel 200, refresh 200, bearer by-slug 200 (CORS *), no auth by-slug 401
- A paused: token 423, nonce place 423, nonce cancel 200 (nonce issued for action cancel), refresh 423, by-slug 423 (CORS kept);
  A's pre-pause token: refresh 423, by-slug 423. B unaffected.
- The 423 body is {error, code:"paused", until:ISO}: the shape the extension's pausedUntil() parses.
CI web 8d77871: success (job 137632956825). Merges cleanly with final 2aa61a1.
