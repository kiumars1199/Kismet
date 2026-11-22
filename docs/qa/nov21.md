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

## 2. Backtest headline leads with even weeks ("Nov21: backtest even weeks")
- Engine: `python -m engine backtest-even` samples closed markets evenly over the year (data/even), runs the same
  walk-forward test, writes output/backtest_even.json; `attach-even` copies it into backtest.json as `even_weeks`.
  Railway runs it at most weekly in a background thread, so scans keep their 15 min cadence.
- Site: when `even_weeks` has best bets it is the headline everywhere (cards, /track-record, MCP, llms.txt), with one
  line: "Bets in N of 52 weeks", plus how the sample was drawn and what the production-history run gave.
- Local run (Nov 21): +6.45% per bet, t 2.41, 302 bets over 204 events, bets in 25 of 52 weeks. Lane B's note had
  3,098 bets in 42 weeks; I could not reconcile the two (different sample: Lane B's set is not in the repo). Per Q,
  the site ships whatever the engine computes; production shows the figure from Railway's first weekly run, and keeps
  the old headline until then.

## 3. Alerts ("Nov21: alerts Free note")
- Email on by default for new rules on paid plans: already in place (AlertsView `blank(emailNow())`); existing rules
  are not touched (no migration), so they keep their channels.
- Cron stays daily (vercel.json, 13:00 UTC).
- Free: a short note under the title ("On Free, alerts reach you only while Kismet is open in a tab. Pro adds email…")
  with a See plans link; no email switch in the editor. e2e-paid covers Free (note shown) and Pro (no note).
- Pro email end to end: see "Alerts email check" below (after deploy).

## CI flake: S7 checkout wait ("Nov21: S7 checkout wait")
- PR #24 (combos) went red on e2e-paid S7: "Confirming your payment with Stripe…" still showing at 30 s. Unrelated to
  combos; passed 3/3 locally. A rerun wasn't possible (the GitHub integration can't rerun jobs: 403), so per Q's rule
  it's fixed in its own PR: the checkout-status waits now match the page's own 60 s poll window (S7 and the alerts
  spec; billing already used 60 s). #24 was closed and reopened as a fresh PR after this merged (one working branch).

## CI race: checkout status after mock Stripe ("Nov21: checkout-status race")
- The disk-fix PR (#26) went red on e2e-paid billing and settings, neither touched by it. The 60 s wait from #25 was the
  wrong fix: after checkout, CheckoutStatus shows "Payment confirmed" only if /api/me already says paid on its first
  load. If its 2 s poll sees the plan change first, it reloads plain /account, which has no status line, so a test
  waiting for the text fails no matter how long it waits. S7, alerts and billing now use one helper
  (`e2e-paid/checkout.ts`) that accepts either the confirmed text or the reload to /account. If the page gives up after
  60 s, the test still fails.
- Settings: the "Settings" click right after sign-in sometimes did nothing (it landed before /account hydrated), so it
  is now retried until the URL is /settings.
- App behaviour unchanged. Fixed in its own PR ahead of the disk fix; #26 closed and reopened after.

## Outage: Railway disk full (Nov 21 21:49 UTC to the hotfix, "Nov21: disk-full fix")
- What broke: the 5 GB Railway volume filled (Errno 28 from 21:49). Kalshi's response cache was never pruned, so it
  grew until the disk was full. The next fit wrote a truncated model.json (cut at 552,960 bytes), and every scan
  after that failed with a JSON decode error, so the site kept serving the last good scan and went stale.
- Fix: the scheduler prunes Kalshi cache files older than their TTL before every tick, and logs disk use (largest
  data/ and output/ entries) at start and whenever free space drops under 10%. Every engine JSON write now goes
  through `dump_atomic` (temp file, then rename), so a full disk leaves the old file whole instead of a broken one.
  A test fails if any engine file goes back to `json.dump(..., open(...))`.
- Item 5 (Kalshi): cache max age now equals the fetch TTL; the scan log and meta show per-field fill rates.
- Recovery check (Railway logs after deploy): see below.

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

- Outage hotfix shipped ahead of the other open PRs (production was down; smallest fix that stops the disk filling
  and stops a full disk from corrupting model.json).
- Alerts email check runs on the real 13:00 UTC cron: CRON_SECRET is stored as sensitive and can't be read, so the
  endpoint can't be called by hand. Safest: wait for the scheduled run instead of rotating the secret.
- PR #24 (combos) was closed after the S7 checkout flake and is reopened as a fresh PR once the S7 wait fix is in.
- Scheduler state file (item C) saves only last-run times; the in-memory flags (true/false) are left out, so a
  restart never carries a stale "already done" flag.

(Safest reading taken when the list left a choice.)
