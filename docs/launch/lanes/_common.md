# Rules for every builder (read with your lane brief)

- Setup: you start in your own git worktree. Run `git fetch origin final && git checkout -B launch/<lane>-<task> origin/final`
  for each task branch. Never work in `/home/user/MarketEdge` (the lead's checkout) except to edit your own
  `docs/launch/lanes/<name>.progress.md` there.
- Spec: `/home/user/MarketEdge/docs/launch/SPEC.md` (absolute path, not in your branch). Decisions: `.../decisions.md`.
- Before coding a feature, send the lead (`SendMessage` to `main`) a 5–10 line plan: files, data shape, tests. Wait for "yes".
- Write the failing tests from the "Done when" lines first, then the code. Done = those tests pass.
- Mark a task done only with evidence pasted in your progress file: commands run and their last lines of output
  (tsc, lint, vitest, pytest if engine, `pnpm check:js`, your Playwright test), the PR URL and the preview URL.
- Commands (in `apps/web`): `pnpm i --frozen-lockfile`, `pnpm typecheck`, `pnpm lint`, `pnpm test`,
  `pnpm build && pnpm check:js`, `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium PW_PORT=<your port> pnpm exec playwright test <spec> --project=chromium --trace off`.
  Paid specs: `... -c playwright.paid.config.ts`. Engine (repo root): `python3 -m pytest -q engine/tests ops/tests`.
- Ports so lanes don't collide: data 3210, checker 3220, trust 3230, onboarding-invites 3240, alerts 3250, tracker 3260.
- Push your branch and open a PR to `final` titled `F<nn>: <title>`, one task per PR. Never push to `final`,
  never merge. Only the lead merges.
- Never write to live Stripe, Supabase, Resend, Railway or Vercel, and never type or commit keys. Database
  changes are new additive files in `supabase/migrations/`; only the lead applies them.
- Shared files (BetCard, BestBets, nav/header, pricing, `lib/entitlements.ts`, `lib/types.ts`): message the lead
  before touching one; the lead sequences those tasks so only one lane edits a shared file at a time.
- Users never see cents; no personalized picks; footer disclaimer on every page (CLAUDE.md).
- Facts about laws, states, help lines or venues come from a web source with URL and date, never memory.
- After every task, update your progress file: task, status, evidence, next step. If the session drops, a new lead
  reads only these files.
