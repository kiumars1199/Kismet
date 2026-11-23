# F6 #46 3668ac3 — round 2 verdict: PASS with notes

Checks: vitest 1546/1546; e2e f06 + f01 + f08-risknote 13/13; check:js 146.6 kB (budget 150); CI web/python/supply-chain green; merges clean with final 34f672f.
Probe (probe.txt): signed out / CA / NV at 390 and 1440 on /, /bets, /markets, /check?m=6417673. CLS <= 0.013, no horizontal scroll, disclaimer present.
12 cards, each with "How to bet this". Each guide has 3 steps and 3 sources, puts the availability line above the link, and preselects no venue.

Notes
1. Availability is always "Check <venue> for your state". The cause is that `lib/venues/guides.ts` `venueStatus` stubs "unverified" until F9 #48 merges, so real per-state availability is not verifiable yet.
2. Opening the guide adds the "afford to lose" RiskNote next to the guide link (by design, round-1 #4).
3. f01b ae4e3eb: an identical duplicate `kalshi_matched_ticker?: string` still raises TS2300. Data's planned line removal on rebase handles it.

Found in review (on final 34f672f, not caused by F6)
4. /event/<id> at 390 has a CLS of 0.436 in 8 of 15 cold loads; the other loads score 0.004. At 1440 it is 0.01 on every load, and the /bets control scores 0.004 on every load.
   - Source: the FOOTER is painted at y479 and pushed off-screen when the event view streams in, a single 0.432 shift at 150–510 ms.
   - Cause: `app/event/[id]/page.tsx:62` wraps `<EventView>` in a bare `<Suspense>` with no fallback, so the first paint has an empty main.
   - Evidence: event-final-cls.log, event-final/*.png.
   - An earlier spike (event-final-stale-build/) was measured against a stale server with 400s on every asset. It is discarded.
