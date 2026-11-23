# F12 #55 6210623: FAIL
Head 6210623, clean vs final, CI web/python/supply-chain green. Unit lib/email + cron + rls 54/54 (wtf01b).
Mock run (next dev, E2E_MOCK, CRON_SECRET=rv-cron): probe.log, PNGs.
1. BLOCKER: /api/digest/run is not in lib/auth/public-paths.ts (alerts/settle/lifecycle run are). With the right cron secret the middleware answers
   401 {"error":"Sign in to use this."}, so the Vercel cron never reaches the route and no digest is ever built. Unit tests call the handler
   directly, so they miss it. Fix: add "/api/digest/run", // CRON_SECRET.
2. The payout in the email is formatOdds(ask,"decimal") = 1/ask, before the fee. The site shows betQuote().paysText, which is after the fee.
   Same bet, different number: 6674492 is 1.45x on /m and 1.47x in the email. Fix: use betQuote paysText (DigestBet needs the fee).
3. Plans: the digest sends the top 5 live flags to every opted-in user, Free included. Free on the site gets a random sample of 10 a day,
   15 min delayed, and 3 reveals. Needs a decision: Pro+ only, or Free gets its own day's sample from the delayed store.
4. Self-paused users (F8 profiles.paused_until) are still emailed bets. Exclude paused_until > now.
Passing: the onboarding checkbox is unticked by default at 390 and 1440. Ticked -> /api/digest/optin {"on":true}; not ticked -> false.
Unsubscribe: a digest token turns off only the digest (unit). The template test covers no cents, the disclaimer, the unsubscribe link and <= 5 bets.
No key -> sendEmail sends nothing.
