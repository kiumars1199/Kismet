# F8 #44 production check: final 651462b (Vercel dpl_EGbQP6P66MRV5XiyUhTRJAsuCHjJ, READY)
This is a headless, signed-out check of kismetodds.com with no bypass header and no bot block met. Details are in probe.log; screenshots are {390,1440}-*.png.

## Verified on production
- **Help line in the footer, on every page checked** (/, /signup, /track-record, and the signup redirects for /account, /bets and /markets), at 390 and 1440:
  - 1-800-MY-RESET links to tel:+18006973738.
  - "chat online" links to ncpgambling.org/chat.
  - "source" links to ncpgambling.org's helpline page.
- **18+ gate on /signup:** the checkbox reads "I'm 18 or older and agree to the Terms and Privacy Policy". The Google button is gated by the same box in code (LoginForm needTerms); the Google button is visible on prod.
- **RiskNote on the signed-out home page:** 4 "Bet on Polymarket US" buttons, each with "Bet only what you can afford to lose" next to it (4/4) at both widths.
- The footer disclaimer "Market analytics, not financial advice. Based on past results. 18+." is present.

## Not verified on production (needs a signed-in account)
- **Not verified:** the pause flow, the RiskNote on /bets, the /markets note, and the /account help line.
- **Why:** signed out, /bets, /markets and /account return 307 to /signup. I made no prod account, because that would be a live Supabase write.
- **What's needed:** a prod test account from main, or OK to rely on the branch e2e (launch-f08-pause.spec.ts) reviewed earlier.
