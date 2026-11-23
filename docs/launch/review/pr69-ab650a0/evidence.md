# #69 ab650a0 review (UI): AppliedPills as links, StateLink SSR href, f05 pre-hydration test, CI timeout 45
Runtime: paid mock, next dev :3311 (p69.log). Baseline on final 2aa61a1, same probe (final-2aa61a1/p69-final.log).
- The pill and "Clear all" are <a href>. "Your topics" href=/bets?fav=0; Clear all on a fav=1 view: /bets?fav=0; Chance pill on /bets?wp=0.6&fav=0 -> /bets?fav=0.
  No <button> is left in the Applied filters list. 44 px tall. Free/Pro/Premium x 390/1440 = 6/6.
- Keyboard: focus the pill, Enter -> soft navigation (0 document requests, window marker kept), URL bare /bets, pill gone, topics_off saved
  (a bare /bets reload stays unfiltered). /bets?fav=0 holds (no 307 back to fav=1). Focus after the pill is removed goes to BODY (same as final).
- CLS of the pill tap: same numbers as final per plan and width (390: 0.010-0.018; 1440 Pro/Premium 0.036).
  Free 1440 shows 0.52 on removing a filter (bets-list + locked-bets move when the sample swaps in, more than 500 ms after the tap).
  Final 2aa61a1 shows the identical 0.5221 on the same step, so it is pre-existing, not from #69.
- StateLink SSR: curl / -> 4x href="/state?next=%2F"; on /bets the link is /state?next=%2Fbets.
- Open redirect: 22 /state?next= payloads, all same-origin, 0 off-site requests (last block of p69.log).
- No page errors; disclaimer present; no horizontal scroll; no cents.
- Specs: f05 count>0 became first().toBeVisible (equivalent, waits); f09 href "/state" became a /^\/state\?next=%2F/ regex (stricter);
  overhaul button->link role swaps only; new pre-hydration test aborts /_next/static JS, asserts not hydrated, href fav=0, and the click clears it.
  vitest (from the earlier review): p95 budget kept, retry removed. Nothing skipped.
- CI web ab650a0: success (job 137631217010; e2e 199 + 32 + 29 passed).
