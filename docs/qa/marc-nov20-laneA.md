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
| JS budget | Fixed, measured (asked by main) | Branch `claude/qa-a-js-budget`. The root 404 and error pages imported button class strings from the `"use client"` kit, so every page's HTML loaded the kit and `lib/format` through them. The strings moved to `components/kit/classes.ts`. Landing first load went from 150.2 to 141.9 kB gzipped (clean `pnpm build` with no env, then `pnpm check:js`). Containers disagree by about 1 kB because the env inlined at build time differs, and the e2e server rebuilds `.next` with DEMO_MODE. My earlier 140.8 came from a stale `.next`. |
| 6, 56, 59 | Fixed in code, not verified live | Branch `claude/qa-a-counts`. No "K" below 10,000: `formatCount` is exact with a comma under 10,000. Live before the fix: /track-record and /about showed "8.3K", and /status showed "1.9K settled". New `plural()` gives "1 bet", "1 more bet" and "1 row exported". |
| 49, 63 | Fixed in code, not verified live | One live-record count: `settledCount()` in `lib/data/counts.ts` counts each bet once (`liveBase`), the same base /track-record uses. It is used on /status, in `/api/meta` `results` and in the MCP record. Its parts (won + lost + void) add up to settled. Live before the fix: /status "1.9K settled · 1.5K won · 440 lost" vs /track-record "900 won · 255 lost". |
| 26, 57 | Fixed in code, not verified live | `bestBetsCount(store, { free })` counts the way the tier's list counts. With fewer than 10 US bets, Free's list widens to every venue, but /status and /about kept counting the US set only. `freeUsOn` moved into counts.ts. The test in `test/us-filter.test.ts` covers it. |
| 70, 71 | Fixed in code, not verified live | Best bets "Show more (N left)" now counts bets left (total minus the bets in the slots held). Before, it subtracted game slots from a bet total, so the counter never reached 0. The next page is now counted, not inferred from rows that live repricing can shrink. The button shows only while the server has another page, so there is no dead click past the last page, which used to get a 400. Covered by the `useScreener.test.tsx` "Show more" test. |
| 25 | Fixed in code, not verified live | Free /bets said "89 bets" (every match) above the 10-a-day sample. The count now reads "Showing 10 of 89 bets". The locked card already said "Free shows 10 Best bets a day". |
