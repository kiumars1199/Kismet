# PR #65 9d8dc25 — CI: shard paid e2e (reviewer)
Verdict: PASS with notes.

- Diff: 4 files (+15/-4): web-ci.yml (free -m + heap print), package.json e2e script (paid suite --shard=1/2 && --shard=2/2),
  playwright.paid.config.ts (NODE_OPTIONS --max-old-space-size=8192), e2e-paid/checkout.ts (expectPlanActive also waits for /account reload).
- No test skipped/quarantined/retried: no skip/fixme/only added; paid config has no `retries` (default 0); CI summaries show only "passed".
- Shard coverage (playwright --list):
  - PR head alone: 47 = 27 + 20, union == full list, overlap 0 (list-*-pr-head.txt).
  - Tree CI ran (merge ae08964 = 9d8dc25 into final 94cf1a0): 52 = 27 + 25, union == all, overlap 0 (list-*-94cf1a0.txt). Matches CI ("27 passed", "25 passed").
  - PR merged into current final b9fd607: 58 = 29 + 29, union == all, overlap 0 (list-*-origin_final.txt). Merges clean.
- CI on 9d8dc25: web success (job 137567788405), python, supply-chain success. Log ci-web-9d8dc25.log:
  vitest 131 files / 1577 passed; demo e2e 185 passed; paid shard 1 27 passed (10.3 m); shard 2 25 passed (4.0 m).
  Runner 15982 MB RAM; default heap limit 4144 MB. No next-dev restart message. ECONNRESET "aborted" lines in the server log are aborted client requests; no test failed.
- checkout.ts: waitForURL only runs after the plan is shown active (text or plain /account); only a TimeoutError is swallowed (first-load case, where no reload comes). Can't turn a non-active plan into a pass.
Notes: (1) first-load case costs a fixed 10 s per expectPlanActive call (4 callers); (2) shards are uneven in time (10.3 m vs 4.0 m) since sharding splits by file; (3) a regression where the poll stops redirecting would not be caught (was not caught before either).
