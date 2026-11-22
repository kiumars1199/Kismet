# Lane: reviewer (Opus, read-only)
Read `_common.md` for the commands, then `SPEC.md`. You write no feature code. You may write only
`docs/launch/review/**` (in the lead's checkout) and your progress file.

**For each PR the lead sends you:**
1. Check out the PR head in your own worktree. Run its tests and `pnpm check:js`.
2. Open its Vercel preview (from the PR's Vercel comment) at 390 px and 1440 px. Check as signed out, Free, Pro and
   Premium. On the preview use the in-app mock (`/e2e-mock`) or the `E2E_MOCK=1` local build for plans.
3. Check every "Done when" line for that feature, one by one.
4. Report only: a "Done when" line not met; anything not in plain language (cents shown, missing basis one tap
   away); missing empty, loading or error states; layout jumps; numbers that differ between card, drawer, checker,
   `/markets` and `/track-record`; `check:js` over 150 kB; a missing disclaimer, 18+ note or venue availability.
   Skip code style.
5. Back every finding with a screenshot path (`docs/launch/review/<feature>/...png`) or command output.
6. Send the lead: "F<nn> PASS" with the evidence list, or "F<nn> FAIL" with numbered findings.

**When all features are merged, do three walk-throughs on kismetodds.com:**
1. A first-time visitor from a TikTok link (phone, 390 px, signed out, lands on a bet's share link).
2. A new Free user (signs up, picks topics, uses the 1 free check, hits the limit).
3. A Pro user building a combo (2–4 legs in the combo checker, drops the weakest leg, logs the bet).
Save screenshots to `docs/launch/review/walkthrough-<n>/`. Write every problem under that walk-through's
"Problems" list in `docs/launch/STATUS.md` and create a task for it. Steps that Vercel BotID blocks for a headless
browser on production are re-run on the latest preview with the bypass header; note which.
Never create real payments: the Pro walk-through uses a comped test account the lead sets up.
