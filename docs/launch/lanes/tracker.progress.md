# tracker progress

Update after every task: task · status · evidence (commands + last output lines, PR, preview URL) · next step.

(no tasks started)

## F11 (wave 2) · plan sent to main, awaiting approval
Branch launch/tracker-f11 from origin/final. Found existing: journal table+RLS, JournalView, lib/journal.ts, settle routes, drawer "Log this bet". Gaps: one-tap button, by-sport/topic sums, beat-close wording, tests (unit >=6, RLS sql, e2e launch-f11-log). No code yet.

## F11 · done, PR #58 (head 89ee86e)
Evidence: tsc, eslint, vitest 1480 pass (funnel-db flaked once under load, passes alone), check:js 145.8 kB, chromium e2e launch-f11-log + overhaul-cards + s6 pass. pgTAP journal checks written, not runnable here. Open question for main: Polymarket docs say 50/50 markets redeem $0.50/token, but journal treats "void" as P&L 0 (refund); left unchanged.

## F11 update · 50/50 fix, head 31bf544: new result 'split' + migration 20261123000100_journal_split.sql; void stays 0. tsc/lint/vitest (api.test timing flake under load) /e2e launch-f11-log pass.

## F9 tap-target fix pushed to launch/trust-f9 head 7b83e4f; CI pending. #58 re-verified at 31bf544: build ok, check:js 145.8 kB, overhaul-cards+s6 15 pass.
