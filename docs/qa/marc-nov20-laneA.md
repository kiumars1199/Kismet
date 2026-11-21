# Marc's QA list (Nov 20, 2026): Lane A log

Lane A covers items 46/60, 2, the count group (6, 26, 49, 56, 57, 59, 63, 70, 71), 25, 13/40, 27/29, 34/44/67 and
68/69/50/47. Each row gives the status and the evidence. "Not verified live" means the code is fixed and tested, but the
proof on kismetodds.com needs the deploy, a paid login, or both.

## Evidence gathered before any fix (Nov 21, 00:20–01:40 UTC)

- **Engine cadence (Railway, service Kismet, deploy logs).** Scan starts: 00:28:39, 00:43:36, 00:58:29 and 01:20:44 UTC.
  That is one scan every 15 min (`SCAN_EVERY_SEC` is set on Railway; its value is redacted, but the ticks are 900 s
  apart). The hourly update, fit and grade (01:13 to 01:18) push that hour's scan back to about 22 min. Each upload
  writes markets.json, then flags.json about 1 s later.
- **Anonymous `/api/meta`, sampled sparsely.** It served scan 1795222710 (00:58 UTC) until at least 01:34, 35 min after
  that scan. This is by design: Free is served the newest scan that is at least 15 min old, and the 01:20 scan was not
  yet 15 min old. Free therefore sees data 15 to about 37 min old.
- **Vercel runtime logs for the last 55 min.** No `[store]` load failures. Hobby keeps only 1 h of logs, so nothing older
  can be checked.

## Summary

1. Scan freshness: one request uses one scan, there are no torn or hour-old copies, and the header pill shows the cards' own scan (46/60, PR #11). Every "N min ago" ticks from the page's one clock (2, 34, 44, 67).
2. Counts: one shared count per bet. The Free count is tier-aware, numbers have thousands separators, "Show more" counts correctly, and the /status record is in plain words (6, 25, 26, 49, 56, 57, 59, 63, 70, 71).
3. Sort and search: "Biggest payout" sorts by the after-fee payout and keeps the same set as other sorts. A bad sort link says so. Search folds ø, æ, ß and similar letters (47, 50, 68, 69).
4. Plan: the plan stays "unknown" and /api/me is retried until it answers, so no Pro upsell appears on a guess (13, 40). The landing JS budget fell from 150.2 to 141.9 kB (PR #14).
5. Open: sortPays moves to B's betQuote (US price on US cards) once B's return branch merges. The paid-only fixes are not verified live.

## Teaser test clock (main's request, branch `claude/qa-a-teaser-clock`)

`test/teaser.test.ts` "signed-out landing" failed from Nov 21 on ("one bet per game: expected 3 to be 4"). Cause: the Free
daily sample is seeded by the UTC day, so the test's result moved with the calendar date. The describe block now fakes
`Date` at the fixture scan plus Free's delay plus 5 min (`DELAY_MIN.free`), so Free's delayed copy is ready and the day
is fixed. It passes (11/11), and the full vitest run passes (`api.test` timing flaked under load, then passed alone).
Live check, Nov 21 at about 02:30 UTC: kismetodds.com/ shows 1 hero card plus 3 more (4 distinct markets: 6827615,
6834474, 6840961, 6970279), with no placeholders.

## Items

| # | Status | Evidence |
|---|---|---|
| 46/60 | Fixed in code, not verified live (needs the deploy and a paid login) | Branch `claude/qa-a-stale-scan`. Four gaps were still open after PR #4 and #7. (1) Stale-while-revalidate had no age limit, so the first request to an instance idle for an hour got that hour-old scan. A copy is now served without waiting only if it was confirmed current in the last 5 min (`SWR_MAX_MS`). An older copy waits up to 10 s (`WAIT_MS`) for the reload, then falls back. (2) A load landing between the markets.json and flags.json uploads (about 1 s apart on Railway) could pair two scans. Such a torn load is now refused, for the `-prev` pair too. (3) An instance that sat unrefreshed demoted its old copy to `prev`, the Free delayed copy, even when it was many scans back. Such a copy is now dropped, and the published `*-prev.json` decides instead. (4) The header pill and the stale banner showed `/api/meta`'s scan, which can come from another server instance, instead of the scan of the cards on screen. List responses now carry `scanned_at`. Best bets, All markets and /status publish their body's scan, and the header pill shows that scan (`lib/scanClock.ts`). "Show more" restarts from page 1 when the next page comes from a different scan, so no bet is skipped or repeated. Tests: `test/store-stale.test.ts` (an hour-idle copy, a slow reload, a failed reload, no step back to an older scan, a torn upload). Live sampler script: `sampler.sh` in the lane scratchpad (sparse `/api/meta` and `/status` probes). |
