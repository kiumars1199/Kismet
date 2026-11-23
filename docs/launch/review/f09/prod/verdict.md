# F9 prod check: kismetodds.com, final 5a65227 (dpl_8VG66VkNJSgGCS2hMRtdHTrSWzKY). Verdict: FAIL (item 1)

1. Signed out at 390 and 1440, the landing page has 4 cards. Each shows "Check your state" (data-status=no-state) above "Bet on Polymarket US". The link is a 44 px target, there is no horizontal scroll, and the disclaimer is present.
   - Clicking it goes to /settings#state, which the account wall sends to /signup?next=%2Fsettings (curl: 307). A signed-out visitor cannot set a state, so the note can never change for them. Evidence: click.txt, *-after-check-your-state.png.
   - /bets and /markets redirect signed-out visitors to sign-up, as designed.
   - The cookie-only /api/state route is public, so a fix is either a public state picker (e.g. a /state page or an inline select) or allowing /settings#state when signed out.
2. /m/6970124 at 390, signed out on prod: 6 cold loads, CLS 0 on every load. The page is the teaser, with no availability or bet buttons, and the disclaimer is present.
   - Pro on prod: blocked, because there are no test accounts.
   - Instead I measured a local build of 5a65227 in demo mode (the full signed-in view; local-5a65227/cls.log), 10 loads each:
     a. Every load shifts 0.15–0.18, because the action row wraps to a second line when the client-only "Trade (paper)" button mounts. TradeButton returns null until /api/trade/config resolves, and the link icon then drops to a new row, pushing everything below down by 50 px.
     b. Loads 1–2 of 10 also show the 0.432 footer swap. The footer paints at y479 under an empty main, from a bare <Suspense> around MarketDetail in app/m/[id]/page.tsx:75. This is the same mechanism as /event. It happens on a warm server, so it is not specific to the first request.
   - On prod, (a) only applies if the paper ticket shows for that user, i.e. when KALSHI_TRADING_ENV=demo and the user is allow-listed.
