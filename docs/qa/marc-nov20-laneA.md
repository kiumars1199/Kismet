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

## Items

| # | Status | Evidence |
|---|---|---|
| 46/60 | Fixed in code, not verified live (needs the deploy and a paid login) | Branch `claude/qa-a-stale-scan`. Four gaps were still open after PR #4 and #7. (1) Stale-while-revalidate had no age limit, so the first request to an instance idle for an hour got that hour-old scan. A copy is now served without waiting only if it was confirmed current in the last 5 min (`SWR_MAX_MS`). An older copy waits up to 10 s (`WAIT_MS`) for the reload, then falls back. (2) A load landing between the markets.json and flags.json uploads (about 1 s apart on Railway) could pair two scans. Such a torn load is now refused, for the `-prev` pair too. (3) An instance that sat unrefreshed demoted its old copy to `prev`, the Free delayed copy, even when it was many scans back. Such a copy is now dropped, and the published `*-prev.json` decides instead. (4) The header pill and the stale banner showed `/api/meta`'s scan, which can come from another server instance, instead of the scan of the cards on screen. List responses now carry `scanned_at`. Best bets, All markets and /status publish their body's scan, and the header pill shows that scan (`lib/scanClock.ts`). "Show more" restarts from page 1 when the next page comes from a different scan, so no bet is skipped or repeated. Tests: `test/store-stale.test.ts` (an hour-idle copy, a slow reload, a failed reload, no step back to an older scan, a torn upload). Live sampler script: `sampler.sh` in the lane scratchpad (sparse `/api/meta` and `/status` probes). |
