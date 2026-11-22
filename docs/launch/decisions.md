# Decisions made while Q was away

Format: date · decision · why. Newest last.

- Nov 22 · `docs/launch/` lives on branch `claude/brave-turing-j05kro` and the main checkout at `/home/user/MarketEdge`. Builders read it by absolute path from their worktrees and write only their own `lanes/<name>.progress.md`; the lead commits and pushes these files. · Builders branch from `origin/final`, which doesn't have these docs.
- Nov 22 · PR #33 (Marc) was green but on an old base (before #32/#34/#36). Merged `final` into its branch (no rebase: it's Marc's branch) and re-ran CI before merging. · The lead's rule is "rebase on final and run full suites"; a merge commit gets the same base without rewriting someone else's history.
- Nov 22 · Smoke S3/S5: `playwright.preview.config.ts` + `preview-smoke.yml` run against `*.vercel.app` previews only; the config refuses any other host. The repo secret `VERCEL_AUTOMATION_BYPASS_SECRET` is Q's to add; until then the job skips with a warning. · Q: no bot-protection bypass on production; never type keys.
- Nov 22 · F1/F2 score formula: `50 + 250 × net_edge × sqrt(min(n,400)/400)`, clamped 0–100. · The plan asks for a 0–100 score with its formula on the page; this one is 50 at zero edge, rises with edge, and shrinks toward 50 when the sample is small, so the basis (sample size) is visible in the number.
- Nov 22 · F2 combo checker access follows the plan (Pro and Premium unlimited, Free 1 a day, shared with F1). Suggested combos on `/combos` stay Premium (docs/19 P3). · The plan states checker access explicitly; it doesn't mention `/combos`.
- Nov 22 · Kalshi data: `KALSHI_DATA_PERMISSION=true` is live on Vercel and Railway (`apps/web/lib/beta-list.ts`), so F3/F4/F16 use Kalshi data. Kalshi trading stays paper-only. · Root STATUS.md's "off until written permission" is older than beta-list.ts.
- Nov 22 · The three walk-throughs are the reviewer's, on kismetodds.com after all merges. Steps Vercel BotID blocks for a headless browser on production are re-run on the last preview with the bypass header, and the gap is noted. · Q refused a production bypass.
- Nov 22 · `docs/launch/STATUS.md` "Review result" column uses the exact words "passed review" only after the reviewer's pass on that feature's merged code. · The goal is literal, and a builder's self-check is not a review.
