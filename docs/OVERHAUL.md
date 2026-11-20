# Overhaul spec (Nov 20, 2026)

Owners' verdict on kismetodds.com: confusing, slow, looks like generic AI output, doesn't sell.
Audience: casual bettors placing 1–2 bets on their phone. Not traders, not statisticians.
Be ambitious: fix the whole experience, not the smallest change that satisfies each line.

Every item has a check. An item is done only when its check passes and the evidence (command output,
numbers, or screenshot path) is pasted under it in `docs/OVERHAUL-REPORT.md`.

## 0. Research first (one subagent, ~30 min, before lanes A, B, D start)
- Study 8–10 consumer landing pages and apps people like (Robinhood, Kalshi, Polymarket, Action Network,
  Duolingo, Cash App, Linear, Stripe) and current landing-page / copywriting guidance (5-second test,
  one idea per screen, plain words, mobile first).
- Output: `docs/research/overhaul.md` with 10 rules we follow, each with an example we copy.
- Check: file exists; lanes A, B and D cite its rules in their commits.

## A. First screen and landing page (`/`, signed out)
- First screen at 390×844 and 1440×900 answers in 5 seconds: what it is, who it's for, what to do next.
  One headline, one sentence, one "Sign up free" button, one real bet card in the new style.
- Banned on the landing page: "edge", "spread", "pts", "model", "priced below their record", "$1 share",
  "walk-forward", "EV", "t-stat", any stats table, any chart, any count above 3 digits.
- Below the first screen, in this order: 3 steps in everyday words, 3 real bets, plans, a 5-question FAQ,
  one link "See how we track results" → /track-record.
- Remove the market-says/won-before explainer bars and "Bars use the first best bet below."
- Write 3 headline options; ship the one the research supports; list the other two in the report.
- Check: grep of the rendered `/` HTML finds none of the banned words; screenshots at both sizes in the report.

## B. Cards, Best bets, filters (whole app)
- A bet card shows only: plain title ("Crystal Palace to win", never "Will Crystal Palace FC win on
  2026-11-21?"), "Bet {side}", "Wins about 7 in 10", "$10 wins $5.60", a 1–3 star value rating, closing
  time, "Bet on Polymarket" button. Everything else goes inside a "Why this bet?" expand.
- Free users' locked cards: a solid card with a lock icon and "Unlock N more bets". No fades or blurs
  (on a phone they look like a glitch).
- Best bets page: "Today's top 5" first, then "More bets". No tier or section jargon.
- Filters: one chip row (top 6 sports + More, Today / This week, Safer / Balanced / Bigger payouts);
  the rest behind "More filters". Results update without flashing the old list.
- Check: e2e asserts each card has at most 7 visible text elements outside "Why this bet?"; banned-word
  grep on `/bets` and the card component; before/after screenshots.

## C. Speed (measured, prod)
Measured Nov 20: `/` TTFB 5.3 s cold, 0.8 s warm. Every page returns `cache-control: private, no-store`
and `x-vercel-cache: MISS`. Cold cost = loading and parsing the full markets file on a new instance.
Owners report about 5 s after each click.
- The engine writes small precomputed files each scan (`top.json` with every field cards need,
  `counts.json` with every count shown anywhere, per-category lists). Pages read these, not markets.json.
- Signed-out pages (`/`, `/pricing`, `/about`, `/track-record`, legal) are static + ISR, cached at the
  edge, revalidated on demand by `ops/upload.py` after each upload.
- Signed-in pages: prefetch nav links, render a skeleton instantly, cache everything not per-user.
- Lazy-load charts and the drawer; landing page JS < 150 KB gzipped.
- Check (prod, after deploy, numbers in the report): signed-out pages `x-vercel-cache: HIT`; cold TTFB
  < 500 ms; Lighthouse mobile LCP < 2.0 s, INP < 200 ms, CLS < 0.05 on `/`, `/bets`, `/pricing`,
  `/track-record`. A change with no measured gain doesn't count.

## D. iPhone
- Playwright WebKit at 390×844 and 430×932 on every page: no horizontal scroll, tap targets ≥ 44 px,
  sticky header never covers content, modals and keyboard usable, no loading flashes.
- Check: these viewports run in the e2e suite and pass; screenshots of every page in the report.

## E. Results and the live record (investigate first)
Live ledger: 1,117 settled best bets at −2.2%. Walk-forward backtest: +17%. That gap is the business risk.
- Find out why: entries priced at the real ask after fees? Edge tier mixed in? 90¢+ favourites
  dominating (small wins, big losses)? Categories losing live (weather: 590 settled) that the backtest
  is weak on? Any lookahead in the backtest? Is the big negative May week a data bug?
- Write `docs/research/live-vs-backtest.md`: findings, plus the filter change that would have made live
  match. Ship it behind a flag, default off, and report the numbers with it on and off.
- Placement (owners' call): performance numbers do not lead anywhere. None on the landing page;
  /track-record keeps them, live and test side by side in plain words, never removed or cherry-picked.
  Fix a bad week only if it's a proven data bug, and say so on the page.
- /track-record readability: one headline number per section, one-sentence explanations, no t-stats or
  cents-per-share up front (move them into a "Details" expand). Retitle "Do predicted edges come true?"
  to "Bets we rated higher did better" if the data still says so.
- Check: the research file exists with numbers; /track-record screenshots in the report.

## Rules
- Use parallel subagents, one lane per agent, each on its own branch, merged into `final` when green.
  Lanes A, B and D touch the same components: give B the card and filter components, A only the landing
  files, and D fixes layout after A and B merge.
- Don't change prices, plans, the disclaimer, or compliance rules in CLAUDE.md.
- Keep lint, typecheck, unit and e2e green. Production deploys are done by hand: end with
  "ready to deploy: <sha>".
