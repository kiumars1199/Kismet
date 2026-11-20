# 19 · Polish round before marketing (owner feedback, Nov 19)

Live at kismetodds.com (Stripe test mode). Work on `final`, one commit per task, push, keep CI green.
Use agent teams, Fable as advisor, Impeccable for all UI. Research before building where noted, and write
what you found in `docs/research/polish-round.md` (sources linked).

## P1. Landing page for logged-out visitors
- `/` for a signed-out visitor is a real landing page; signed-in users land on Best bets. `/about` stays as the long version.
- T-276 (supersedes the list below where they differ): an account is required for the app. Landing order: hero
  (promise, 3 steps, "Sign up free"), teaser (3 real best bets, then 6 blurred placeholders with no data, "Sign up free
  to see all X bets"), proof in plain words with the basis on hover, plans, FAQ, disclaimer. HANDOFF § Account required.
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

### P7 done (T-282): the 10 patterns and where they landed
Done by hand: the Impeccable skill was not available in this environment. Sources are first-party pages from
Robinhood, Kalshi, Polymarket, Linear and Stripe (full notes in `docs/research/polish-round-2.md`). Arc is left out:
no first-party design source could be found. No icon dependency was added.

1. **One accent, used sparingly** (Robinhood's single accent in "purposeful pops", [newsroom](https://robinhood.com/us/en/newsroom/a-new-visual-identity);
   Linear keeps brand color out of the chrome, [redesign](https://linear.app/now/how-we-redesigned-the-linear-ui)).
   Green now means action or a positive number. The card verdict line is `text-soft`, card hover is a neutral border
   and a raised surface, the active nav tab is a neutral fill (desktop) or a thin bar over the label (phone), not green text.
2. **Tabular numbers** ([MDN `font-variant-numeric`](https://developer.mozilla.org/en-US/docs/Web/CSS/font-variant-numeric)).
   `table, [data-num], dd, kbd` get `tabular-nums` globally; the freshness pill too. Body-wide tabular figures were tried
   and reverted: they widened "1K" and wrapped "wins about" on phone cards.
3. **A small type scale** (Linear: a display face for headings only). Page titles are one step (28 phone, 34 desktop);
   the card's one big number is 28 px.
4. **Fewer pills: one state tag per card** ([polymarket.com](https://polymarket.com) cards carry at most one tag).
   Topic is plain muted text on cards and in the table; a card shows New *or* Lower confidence, never both; the
   "fair fill / spread eats it" counts are plain text, not bordered chips.
5. **Fewer borders** (Refactoring UI, "use fewer borders"; Linear's surface levels). The card footer rule is gone, the
   bell is a borderless icon button, the price chips lost their outline.
6. **8-pt spacing** ([Material spacing](https://material.io/design/layout/spacing-methods.html)). Header gap 24, card grid
   gap 16, phone list gap 12, table rows 4 px tighter so more rows fit.
7. **Real icons, one set** (Stripe Apps icons: fixed sizes, `currentColor`, [docs](https://docs.stripe.com/stripe-apps/components/icon.md?app-sdk-version=9)).
   `components/kit/icons.tsx`: 24-grid, 2 px stroke, `currentColor`, `aria-hidden`. The "↗" glyphs on venue links, the
   trade ticket, the combo tray and the extension connect page are now the ExternalLink icon.
8. **One big number per card** ([Ström-Awn, UI density](https://mattstromawn.com/writing/ui-density/)). The card keeps
   Pays + wins + price + record; the "Market says / Won before" bars live in the drawer and on the market page. The
   basis stays one hover away (the record title and the "similar past bets" info icon).
9. **Persistent nav with a clear current page, and breadcrumbs** (Stripe full-page apps: a detail page breadcrumbs back
   to its list, [docs](https://docs.stripe.com/stripe-apps/patterns/full-page-apps); Linear's [2024 UI](https://linear.app/changelog/2024-03-20-new-linear-ui)).
   The desktop header is one sticky 64 px row with `aria-current` on the filled tab; table headers stick under it.
   `/m/[id]` reads Best bets › topic › event › market, `/event/[id]` Best bets › topic › event, the signed-out teaser
   Home › market. On phones the middle crumbs collapse. The topic crumb opens All markets filtered to that topic.
10. **Keyboard first** (Linear: Cmd/Ctrl+K and a `?` sheet, [guide](https://linear.app/enablement/guide/navigating-linear)).
    Cmd/Ctrl+K focuses search from anywhere (alias of `/`), listed in the `?` sheet with j/k/Enter/w/a/f.

States and motion: empty states are one dashed card with an icon, one line of help, a primary reset and a way out
("Look in All markets"); skeletons match the new card height. The only motion is a 160 ms fade-up on empty states,
off under `prefers-reduced-motion`. Screenshots: `docs/screenshots/polish/p7/before-*` and `after-*`, 390 and 1440 px.

## P8. Admin
- `kismetodds@gmail.com` is admin (ADMIN_EMAILS) — confirm it works after sign-in.
- "Grant plan" by email: Pro or Premium, optional expiry, works even if the person hasn't signed up yet
  (pending grant applied on first sign-in). List, edit, revoke; every change in admin_audit_log.

## P9. More improvements (find them)
- Do a fresh-eyes pass as a first-time user on phone and desktop, and list the 15 biggest friction points; fix them.
- Stale-data banner: once the engine host runs, it should never show; until then keep it honest.

## Done = the full audit (docs/OVERNIGHT.md §3) passes again, by a fresh auditor, loop to zero fails. Deploy via
push to `final` (Vercel project `kismet` builds it), then run `ops/smoke-prod.sh https://kismetodds.com`.
