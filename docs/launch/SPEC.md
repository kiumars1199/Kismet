# Kismet launch spec (F1–F16)

Definition of done for the launch build. Builders build to it; the reviewer checks against it. A "Done when" line
is met only with evidence: a command and its output, a passing named test, or a screenshot path. Changing a line
after work starts needs an entry in `docs/launch/decisions.md`.

Rules that apply to every feature (CLAUDE.md):
- Users never see cents. Payouts are multipliers (`1.47x`), chances and prices are percentages (`68%`), gaps are points.
- No personalized picks. Bets, scores and flags are the same for everyone. User topics are filters only.
- Every number has its basis one tap away ("Why this bet?" / Details). Default views stay plain language.
- Every page footer shows "Market analytics, not financial advice. Based on past results. 18+."
- Each feature has empty, loading and error states with no layout jump (CLS < 0.1 on the page's e2e run).
- `pnpm check:js` stays at or under 150 kB. The data contract (`apps/web/lib/types.ts` = `docs/03-data-model.md`)
  is updated in the same PR as any engine output change.
- Plans: Free, Pro, Premium (`apps/web/lib/entitlements.ts`). The server enforces; the UI mirrors.
- Test at 390 px and 1440 px. Tests go in `apps/web/e2e/launch-fNN-*.spec.ts` (Playwright, fixture data, DEMO_MODE as
  in `playwright.config.ts`) or `apps/web/e2e-paid/launch-fNN-*.spec.ts` when plans matter (in-app mock).
  Unit tests sit next to the code (`*.test.ts`); engine tests are under `engine/tests/`.

---

## F1 · Bet checker (lane: checker)
**User sees.** `/check`: paste a Polymarket, Polymarket US or Kalshi link, or search by words, or tap "Check" on any
bet card (the URL carries `?m=<id>&side=<0|1>`). Result: our chance, market %, multiplier, edge (points) and a
0–100 score. The formula is printed under the score in plain words. Side, price and stake are editable; every
number updates as you type. The answer depends only on market, side, price and stake, never on the user.
**Score.** `score = clamp(0, 100, round(50 + 250 × net_edge × sqrt(min(n, 400) / 400)))` where `net_edge` is our
chance minus the price after fees and spread (the engine's `net_edge`), and `n` is the model level's sample size.
Our chance below the price gives a score under 50. A side the model can't price shows "No model chance for this
market" and no score.
**Edge cases.** Unknown or closed link → "We couldn't find an open market at that link" plus search. Price 0% or
100% is rejected with a message. Stake has a $1 minimum and $100,000 maximum. A Kalshi link resolves to the
Kalshi market's own price.
**Access.** Pro and Premium: unlimited. Free: 1 check a day, counted on the server per account (signed out: per
IP-hashed device, same limit). The second check shows the upgrade card and does not compute.
**Done when**
- `/check` loads at 390 px and 1440 px with no horizontal scroll, and every card on `/`, `/bets` and `/markets` has a "Check" link to `/check?m=…&side=…`.
- Pasting each of 3 link shapes (polymarket.com/event/…, polymarket.us/…, kalshi.com/markets/…) resolves to the same market id the card uses (unit test `lib/check/parse-link.test.ts`, at least 9 cases).
- The checker's chance, market %, multiplier and edge for a market equal the card's and drawer's numbers for that side (e2e `launch-f01-checker.spec.ts` compares all three on 3 fixture markets).
- Changing price from 60% to 50% updates multiplier, edge and score without reload, in under 100 ms (no network call).
- The formula text is on the page and the unit test `lib/check/score.test.ts` covers ≥ 8 cases, including clamp at 0/100 and the no-model case.
- `POST /api/check` with a Free account: first call 200, second call the same UTC day 429 `{ code: "check_limit" }` (e2e-paid `launch-f01-limit.spec.ts`). Pro and Premium: 20 calls all 200.
- Two different accounts checking the same market/side/price/stake get byte-identical result JSON (unit test).

## F2 · Combo checker (lane: checker)
**User sees.** `/check/combo`: add 2–10 legs from any market and any venue (search, paste link, or "Add to combo"
from a card). Shows combined chance (product of the legs' chances), payout multiplier (product of the leg
multipliers after fees), edge, and score (same formula as F1, with `n` = the smallest leg sample). Legs from the
same event are flagged "Same event: these legs move together, the combined chance is likely off". It suggests the
weakest leg to drop (the leg whose removal raises the score most) with the new numbers.
**Edge cases.** 1 leg → "Add at least one more leg". 11th leg refused. A leg with no model chance blocks the score
and says which one. Duplicate leg refused.
**Access.** Same as F1 (counts against the same daily check). Suggested combos on `/combos` stay Premium.
**Done when**
- `lib/check/combo.test.ts`: combined chance and payout match hand-computed values for 2, 3 and 10 legs; same-event flag fires; the weakest leg is the one whose removal raises score most (≥ 6 cases).
- e2e `launch-f02-combo.spec.ts`: add 3 legs from cards, see the combined numbers, remove the suggested weakest leg with one tap, numbers update.
- Adding a 2nd leg from the same event shows the same-event warning.
- The combo tray's multiplier and the checker's agree for the same legs.

## F3 · Every market searchable, full topic tree (lane: data)
**User sees.** Search and filters on `/markets` cover every open Polymarket market (~18K) and every open Kalshi
market (~207K, from `kalshi.json`), using the topic tree in `lib/taxonomy.ts`. Kalshi series are mapped to the same
topic ids. Best bets cover every category the model can price; a category with none says "No edge right now".
**Edge cases.** The browser still never downloads `markets.json` whole (server filters and pages, 120 s cache).
Kalshi rows with no price show "No price yet" and are excluded from Best bets.
**Done when**
- `python -m pytest -q engine/tests` passes, including a new test that maps ≥ 95% of open Kalshi series in a fixture to a non-`other` topic id that exists in `lib/taxonomy.ts`.
- `GET /api/markets?venue=kalshi&topic=sports.nfl` returns Kalshi rows; `GET /api/markets?q=<a Kalshi title word>` finds Kalshi rows (e2e `launch-f03-search.spec.ts` on fixture data with ≥ 20 Kalshi rows).
- `/api/meta` reports counts by venue; on production `counts.polymarket ≥ 15000` and `counts.kalshi ≥ 150000` (reviewer checks after merge).
- Every top-level taxonomy category shows either Best bets or "No edge right now" on `/bets?topic=<id>`.
- Server memory on the store load stays under 1 GB with full Kalshi data (measured, number in the PR).
- p95 `/api/markets` under 500 ms on the preview for 20 sample queries (command output in the PR).

## F4 · Same event, three venues (lane: data)
**User sees.** In the drawer and on `/m/<id>`: the same outcome's price on Polymarket, Polymarket US and Kalshi
side by side (multiplier and %), with "Pays most here" on the highest payout after fees. Missing venue: "Not listed".
**Done when**
- The engine emits `venues: [{ venue, price, multiplier, url }]` per matched market (in `output/venues.json`, written after the Kalshi crawl and merged into markets by id on load); `lib/types.ts` and `docs/03-data-model.md` updated in the same PR.
- Matching precision ≥ 95% on a hand-labeled fixture of ≥ 40 pairs (pytest).
- e2e `launch-f04-venues.spec.ts`: a fixture market with 3 venues shows 3 rows and exactly one "Pays most here".
- No cents anywhere in the block.

## F5 · Pick topics at signup (lane: onboarding-invites)
**User sees.** Signup asks for sports and topics (chips from `lib/taxonomy.ts`, skippable). Home and Best bets open
filtered to them, with a visible "Your topics" pill that clears in one tap. These are filters, never picks.
**Done when**
- New account picks NFL + Politics → `/` and `/bets` open with those topic filters applied and the pill visible (e2e-paid `launch-f05-topics.spec.ts`).
- Skip → unfiltered views; topics are editable in `/settings`.
- The flags returned for a topic filter are the same set any other user gets with that filter (unit test on the API).

## F6 · How to place this bet (lane: checker)
**User sees.** On every card and in the checker: "How to bet this" opens a 3-step guide for that venue (Polymarket,
Polymarket US, Kalshi) and a deep link that opens the market on the venue.
**Done when**
- Guide text lives in one config (`lib/venues/guides.ts`) with 3 steps per venue; unit test checks every venue has exactly 3 steps and a URL builder.
- Deep links for fixture markets open the right venue URL pattern (unit, ≥ 6 cases).
- e2e `launch-f06-howto.spec.ts`: open the guide from a card at 390 px, see 3 steps and the link, close it.
- F9 availability shows above the deep link.

## F7 · Live payments by config only (lane: trust)
**User sees.** Nothing new; going live is an env change.
**Done when**
- Live price IDs read from env (`STRIPE_PRICE_*`); no price ID or key is in the repo (grep in the PR shows 0 hits).
- Webhook handles checkout, subscription updated/deleted, invoice paid/failed; Stripe receipts on (documented).
- `docs/launch/go-live.md` lists each env var, where Q pastes it, and a 5-step test (live charge + refund).
- `pnpm test` covers test vs live mode selection by env (unit).

## F8 · Responsible betting (lane: trust)
**User sees.** 18+ confirmation at signup (exists: verify). A "Bet only what you can afford to lose" note next to
every bet/deep-link button. Help-line links (the national helpline as NCPG lists it today: 1-800-MY-RESET / 1-800-697-3738, call or text, plus chat; sourced from ncpgambling.org with date) in the footer and `/account`.
Account self-pause: 24 h, 7 d or 30 d; while paused the app shows only the pause screen with the end time.
**Done when**
- e2e `launch-f08-pause.spec.ts`: pause 24 h → every app page shows the pause screen; the API returns 423 for data routes; the end time is shown in the user's time zone.
- The note is next to every bet button (e2e counts buttons and notes on `/bets`).
- Help-line source URL and date are in `config/site.json` or the sources file.

## F9 · Venue availability (lane: trust)
**User sees.** Before any bet button or deep link: "Kalshi: available in your state" / "not available in <state>",
and Polymarket US availability, from a sourced config (URL + date per entry). The state is chosen by the user
(saved) or unknown ("Check your state").
**Done when**
- `config/venue-availability.json` has every US state for each venue with a source URL and checked date; unit test fails if any entry lacks them.
- e2e `launch-f09-availability.spec.ts`: set state to a restricted one → the note says not available, shown above the button.

## F10 · Install and web push (lane: alerts)
**User sees.** Kismet installs to the home screen (iOS 16.4+ included) via manifest + service worker. Web push for:
a new best bet in my topics, a price I set, closing soon, settled. Existing in-app and email alerts keep working.
**Done when**
- Lighthouse PWA installability passes on the preview (`manifest`, icons 192/512, service worker).
- `POST /api/push/subscribe` stores a subscription (RLS; unit test with the fake Supabase).
- The alert evaluator sends one push per event, none twice (unit test, extends `test/alerts-cron.test.ts`).
- Email and in-app alerts unchanged (existing tests pass).
- Never sends to real users in testing.

## F11 · Bet tracker (lane: tracker)
**User sees.** "I placed this" on any card or the checker logs the bet in one tap (side, price, stake prefilled).
Bets settle automatically from venue results. P&L by sport and topic, and "Beat the closing price" per bet.
Synced to the account (Supabase, RLS).
**Done when**
- One tap from a card adds a row to `/journal` (e2e `launch-f11-log.spec.ts`).
- Settlement job marks fixture bets won/lost and P&L matches hand math (unit, ≥ 6 cases, includes fees).
- RLS test: user B can't read user A's bets (`supabase/tests`).
- P&L by topic adds up to the total.

## F12 · Morning digest email (lane: onboarding-invites)
**Done when**
- A cron route builds one email per opted-in user with the top bets in their topics (same bets for everyone with those topics), with a one-click unsubscribe (existing List-Unsubscribe pattern).
- Unit test renders the email and checks: no cents, disclaimer, unsubscribe link, ≤ 5 bets.
- Never sent to real users in testing (Resend test mode or mock).

## F13 · Share and invite (lane: onboarding-invites)
**User sees.** A share image for any bet card (OG image route), and a personal invite link + QR code. 5 verified
sign-ups from your link earn 1 free month of Premium via `subscriptions.comp_tier = 'premium'` and
`comp_expires_at`. A live "3 of 5" counter on `/account` and in the share sheet.
**Done when**
- `GET /api/og/bet/<id>` returns a 1200×630 PNG with the bet's multiplier and %, no cents.
- Self-referral blocked: same account, same email domain + IP hash within 24 h, or the inviter's own sessions don't count (unit, ≥ 5 cases).
- Reward grants once at 5, stacks onto an existing comp end date, never lowers a paid plan (unit).
- Migration is additive; RLS keeps invite rows private to the inviter.

## F14 · Price history chart (lane: data)
**Done when**
- The engine stores per-market price history, downsampled (≤ 200 points per market) and capped (≤ 90 days); total file size in the PR.
- `GET /api/markets/<id>/history` serves it; the drawer shows a Recharts line in % with the basis line "Prices from <venue>, every <interval>".
- e2e `launch-f14-history.spec.ts`: the chart renders for a fixture market; empty state "No price history yet".

## F15 · Admin metrics (lane: trust)
**Done when**
- `/admin` shows daily signups, trials, paid users, revenue (in dollars), churn and invites for the last 30 days.
- Numbers match a seeded fixture (unit); non-admins still get 404 (existing test passes).

## F16 · Big trade alert (Premium, lane: alerts)
**Done when**
- When a single trade ≥ $10,000 hits a market a Premium user follows, that user gets one alert (push/in-app/email per their channels) within one scan.
- Free and Pro never get it (unit). Detection source and threshold are documented with a source URL.
