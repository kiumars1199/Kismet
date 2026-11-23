# F12 #55 round 2 eabe0f5: PASS with notes (CI web/python/supply-chain green, job 137559327129)

Head eabe0f5 (2 commits on 6210623: merge of final + eabe0f5 fixes). Clean vs latest final. Unit lib/email + rls + account-wall 70/70.
Live: paid mock (next dev, CRON_SECRET set), probe.log here.

1. /api/digest/run in PUBLIC_API. Through the middleware, signed out: right secret -> 200 {"ran":true,...};
   wrong secret -> 401 {"error":"unauthorized"} (route's own 401, not the sign-in wall); no secret -> 401. PASS
2. Payout = betQuote().paysText (lib/email/digest-bets.ts). 6674492: site 1.45x, 1/ask 1.471; template prints
   "pays 1.45x". Fallback paysOf() is ask+fee, never the bare price. PASS
   Note: the unit test's digestBets branch is `if (found)` and 6674492 is NOT in the fixture top 5 (top 5 = 7077574,
   7077573, 7078474, 7078473, 6674485), so that half is vacuous; the email render half carries the check.
3. Free: digestBets(free, "rv-user-1") = 6674176, 6674473, 7077573, 7077574, 6673360; all in the site's /bets Free
   sample for u:rv-user-1 (listBody on the Free store). Figures come from freeView (banded like the site).
   Pro/Premium = live top 5, same as site Pro list. Free never shares the paid cache. PASS
4. Paused: 5 opted-in users (Free, Pro, Premium, Pro paused +24 h, Pro pause ended 1 h ago) ->
   {"users":5,"sent":0,"skipped_no_bets":0,"skipped_paused":1,"failed":0}. sent 0 = no Resend key (claims released). PASS
Gap: no email body captured live (Resend URL hard-coded, no mock outbox); body checked by unit render.
