# Nov 21, 2026: Q's decision list, run log

Summary: (filled in at the end)

Rules followed: one fix group per PR ("Nov21: <topic>"), merged only with tsc, lint, vitest, pytest, check:js,
affected e2e and the Vercel preview all green.

## 1. CI install (PR #21, "Nov21: CI install")

- Root cause, not the #17 workaround: `apps/web/node_modules` was committed as a symlink (mode 120000) pointing at
  this container's path. Every fresh checkout got a dangling `node_modules`, so pnpm couldn't make its slot dir.
  Untracked it; `.gitignore` now ignores `node_modules` (file or dir), not only `node_modules/`.
- Vercel install command: debug `pwd; ls` dropped. `rm -rf node_modules` kept (harmless, guards a cached checkout).
- CI had been red at install for days, so the e2e suite hadn't run in CI. Once install passed, these surfaced:
  - WebKit wasn't installed, so both iPhone projects failed to launch. web-ci now installs `chromium webkit`.
  - `ops/tests/stripe-setup.test.mjs` still expected the old yearly prices; updated to $119.99 / $199.99.
  - Real bug (5 tests): on Best bets the "Choose your topics" nudge appeared ~1 s after load (it waited for the
    profile, #22 Nov 20) and pushed every card down 62 px, so a tap aimed at a card landed on the gap. Logged with
    a layout-shift observer and click tracing. Fix: the server reads the profile and decides, so the nudge is in the
    first HTML (`nudgeOnServer`, lib/activation.ts). The client still takes over once the profile loads.
  - Demo mode's header also filled in Combos/Kalshi after /api/me. The layout now passes demo mode the same header
    hint signed-in users get (demo counts as signed in: accounts off).
  - `multipliers.spec` expected the old copy "lost money in testing"; QA-B (19e5dcc) deliberately changed it to
    "(lost money)". Assertion updated.
  - `multipliers.spec` combo #42 was flaky (seeded localStorage after load, the tray's own save raced it). Seeded
    with addInitScript instead.
  - iPhone (WebKit, first real run in CI): the "If you bet" stake label was an inline 15 px line around a 44 px
    input, flagged as a small tap target on /, /bets, /about. The label is now a 44 px flex row.

- Paid #22 (onboarding banner dismiss saved to the account) failed on CI: the nudge is now in the first HTML, so a tap
  could land before the profile loaded and the save went nowhere. Dismiss now waits for the profile, then saves. The
  test also waits for hydration before tapping.

## Q's answers (Nov 21, before going away)

- Alerts email check: throwaway Pro test account, mail to Resend's test inbox (delivered@resend.dev), deleted after.
- Backtest headline: ship whatever the engine's even-weeks run computes (no hard-coded figure).
- Production writes OK without asking: test account, test alert rule, merging green PRs.
- D: leave the thresholds as they are and document them. /api/health (and admin health) use
  HEALTH_MAX_DATA_AGE_MIN = 60 min on the live scan. /status says "late" after 45 min (+ the plan's delay, so 60 for
  Free), `lib/freshness.ts` SCAN_LATE_MIN. The stale-alarm email (ops/stale_alarm.mjs, GitHub, every 15 min) fires
  at 45 min on the anonymous /api/meta, which serves the newest scan at least 15 min old; healthy that copy is at
  most 15 + scan gap, so 40 min at a 25-min gap. Prod at 17:20 UTC: /api/health ok, /api/meta 19 min old.
- 6: keep the hidden same-width slot. On prerendered pages (/, /about) the server can't know the visitor's zone, so
  the clock time is an invisible placeholder until load; "closes in" text is identical server and client (checked
  on kismetodds.com with JS off vs on, no hydration errors). Dynamic pages use the tz cookie / Vercel IP zone.

## Decided without Q

- Nudge dismiss: save deferred until the profile is ready (safest: never drops the save, no UI change).
- Demo header renders signed-in from the server (demo always acts signed in), so no 62px shift after hydration.

(Safest reading taken when the list left a choice.)
