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
