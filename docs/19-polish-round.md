# 19 · Polish round before marketing (owner feedback, Nov 19)

Live at kismetodds.com (Stripe test mode). Work on `final`, one commit per task, push, keep CI green.
Use agent teams, Fable as advisor, Impeccable for all UI. Research before building where noted, and write
what you found in `docs/research/polish-round.md` (sources linked).

## P1. Landing page for logged-out visitors
- `/` for a signed-out visitor is a real landing page; signed-in users land on Best bets. `/about` stays as the long version.
- Sections: hero (one-line mission + live counter of bets found today + a real card from today's scan), "how it works"
  in 3 steps with simple animated graphics (market price vs. how often bets like it actually won → the gap → you bet),
  proof (track record chart, past bets tested, honest "most lose, the edge is the price"), pricing preview, FAQ,
  final CTA "See today's bets free". Real numbers from the API only, no invented stats or testimonials.
- Research 5–8 strong fintech/consumer landing pages (e.g. Robinhood, Kalshi, Polymarket, Linear, Ramp, Mercury)
  for structure and motion; don't copy. Fast: LCP < 2 s on mobile.

## P2. Sign up and onboarding
- Header shows both "Sign up" (primary) and "Log in". `/signup` and `/login` share the flow but have the right copy.
- Google sign-in: the button must not 400. Hide it unless `NEXT_PUBLIC_GOOGLE_AUTH=1`; owner will turn it on once
  Google OAuth is configured in Supabase. Magic link is the default.
- Skippable first-run tour after sign-up. Research how good products do it (Linear, Notion, Duolingo, Robinhood,
  Figma, Slack): short checklist + 3–5 spotlight steps (Best bets card anatomy, Pays filter, search, save/alerts,
  Results page), "Skip" on every step, can be replayed from the account menu. Stored in profiles.onboarded_at.

## P3. Free vs. paid (make paying obviously better)
- Free: 10 Best bets a day, a random sample per user per day (seeded by user/IP + date, so it doesn't change on refresh),
  prices at least 15 min behind, no combos, no alerts, 1 preset, watchlist 10. The rest of the list shows blurred
  locked cards with "Unlock all N bets" → pricing. Enforce on the server (rows trimmed before they leave the API).
- Pro: everything live. Premium: + extension, combos, text/push alerts, paper trading (as now).
- Update pricing comparison table, entitlements, tests and the RLS quota trigger if limits change.

## P4. Clearer numbers on cards
- Replace "$100 → +$20–$50" (unclear, and reads like promised profit). Use "Bet $10 → get $13 if it wins"
  (the stake follows the user's default stake; payout = stake ÷ price, after fees). Keep "wins about N in 10".
- Remove or rename "Likely to hit" so it can't read as a promise; use a neutral confidence label
  ("Strong record" / "Thin record") tied to the backtest sample.
- Audit every number on the site for "would a casual person understand this in 2 seconds?"

## P5. More mid-multiplier bets (2x–10x)
- Backfill more history: `fetch_closed --days 730 --per-tag 4000` (resumable) and refit. Report how many bets.
- Show the `by_pays` backtest for 2–3x, 3–5x, 5–10x on /results. If those bands really lose money in testing, say so
  plainly on the Pays filter ("history says long shots are usually overpriced") instead of hiding it.
- Check the tier-2 rule actually admits mid-multiplier bets (min samples, price floor 0.03) and that the Pays counts
  in the dropdown match what the list shows. Combos page per docs/18 (+ the /combos spec in STATUS.md decisions):
  browse by 2x+/3x+/5x+/10x+, legs from different events, only combos whose cautious chance beats the price.

## P6. Speed
- Measure first: Lighthouse + Vercel Speed Insights + server timings on /, /m/*, search, filters, drawer.
- Targets: TTFB < 300 ms cached, route change < 150 ms, filter change < 100 ms.
- Likely fixes: cache the scan in memory per instance + `stale-while-revalidate` on read APIs; precompute flags/
  pays counts at scan time; prefetch links; stream heavy sections; trim client JS (bundle analyzer); no blocking
  BotID on plain page loads.

## P7. UI that doesn't look AI-generated
- Research real products traders use daily (Robinhood, Kalshi, Polymarket, Linear, Stripe dashboard, Arc).
  Write down 10 concrete patterns to adopt (density, type scale, one accent used sparingly, tabular numbers,
  real icons, consistent 8-pt spacing, fewer badges/pills, fewer borders, clear hierarchy, keyboard shortcuts).
- Apply with Impeccable: tighter cards, fewer repeated labels per card, persistent left/top nav with clear
  current page, breadcrumbs on market pages, better empty/loading states, subtle motion only where it helps.
- Before/after screenshots at 390 and 1440 for every page into `docs/screenshots/polish/`.

## P8. Admin
- `kismetodds@gmail.com` is admin (ADMIN_EMAILS) — confirm it works after sign-in.
- "Grant plan" by email: Pro or Premium, optional expiry, works even if the person hasn't signed up yet
  (pending grant applied on first sign-in). List, edit, revoke; every change in admin_audit_log.

## P9. More improvements (find them)
- Do a fresh-eyes pass as a first-time user on phone and desktop, and list the 15 biggest friction points; fix them.
- Stale-data banner: once the engine host runs, it should never show; until then keep it honest.

## Done = the full audit (docs/OVERNIGHT.md §3) passes again, by a fresh auditor, loop to zero fails. Deploy via
push to `final` (Vercel project `kismet` builds it), then run `ops/smoke-prod.sh https://kismetodds.com`.
