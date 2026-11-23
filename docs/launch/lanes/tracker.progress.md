# tracker progress

Update after every task: task · status · evidence (commands + last output lines, PR, preview URL) · next step.

(no tasks started)

## F11 (wave 2) · plan sent to main, awaiting approval
Branch launch/tracker-f11 from origin/final. Found existing: journal table+RLS, JournalView, lib/journal.ts, settle routes, drawer "Log this bet". Gaps: one-tap button, by-sport/topic sums, beat-close wording, tests (unit >=6, RLS sql, e2e launch-f11-log). No code yet.

## F11 · done, PR #58 (head 89ee86e)
Evidence: tsc, eslint, vitest 1480 pass (funnel-db flaked once under load, passes alone), check:js 145.8 kB, chromium e2e launch-f11-log + overhaul-cards + s6 pass. pgTAP journal checks written, not runnable here. Open question for main: Polymarket docs say 50/50 markets redeem $0.50/token, but journal treats "void" as P&L 0 (refund); left unchanged.
