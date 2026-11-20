# Overhaul research R2: data for non-experts, usability (T-294)

> **PROVISIONAL: no source page could be opened (Nov 20, 2026).** Every outbound host was refused by the session's
> network proxy (`HTTP/1.1 403 Forbidden (agent proxy: no rule or network setting allows this host)`; WebFetch:
> `getaddrinfo ENOTFOUND`). The only evidence below is **WebSearch result snippets** from this session. Each source
> is tagged `[snippet, not opened]`. Claims come from those snippets; a claim that did not appear in a search result
> was dropped. **Which URL a claim belongs to is best-guess where marked `(attribution unconfirmed)`**: the search
> summaries did not always say which listed page a sentence came from. Lanes may use these rules as working defaults, but **should not cite them as final `(R-n)` until the
> lead allows the hosts listed at the end and someone opens the pages.**

Read with `docs/OVERHAUL.md` §B and `docs/overhaul-contract.md` §Card. The 8 rules are numbered R2-1…R2-8 so the
lead can fold them into the 15 in `docs/research/overhaul.md`.

---

## The 8 candidate rules

### R2-1. Say the win chance as "N in 10", with the same denominator on every card
- **Why:** Natural frequencies helped people reason better than percentages in Gigerenzer & Hoffrage (1995): correct
  answers went from 16% to 46% in one study, as later reviews report. Risk-communication guidance adds that a
  **consistent denominator** is what lets people compare, and that **small denominators** are understood best. Caveats from
  the same results: the 1995 work is about Bayesian inference tasks, not one win chance; the benefit depends on numeracy;
  and an FDA-hosted review calls the percentage vs frequency evidence "mixed". So treat it as a reasonable default,
  not a proven win for our exact wording.
- **Sources** `[snippet, not opened]`:
  [Gigerenzer & Hoffrage 1995, PDF](https://pages.ucsd.edu/~scoulson/203/GG_How_1995.pdf) ·
  [Hoffrage et al. 2015 review](https://pmc.ncbi.nlm.nih.gov/articles/PMC4604268) ·
  [numeracy caveat, Cambridge-hosted paper](https://www.cambridge.org/core/product/7197DAAA5CC39185A3E4E02FD36A6FD0/core-reader) ·
  [limited health literacy systematic review (natural frequencies beat %; use a consistent denominator)](https://www.sciencedirect.com/science/article/pii/S0738399123003245) ·
  [oncology patients: small denominators best understood](https://pmc.ncbi.nlm.nih.gov/articles/PMC6143261/) ·
  [FDA: same denominator throughout; evidence mixed](https://www.fda.gov/media/111650/download)
- **Kismet example:** "Wins about 7 in 10". **Change to copy:** `lib/format.ts winsAbout()` today switches to
  `1 in N` below 35% ("1 in 4", "1 in 7"), so two cards on one page use different denominators. Keep `/10` on cards
  for every bet down to "about 1 in 10", and say "less than 1 in 10" below that. The exact `1 in N` can go inside
  "Why this bet?". **Ownership:** `winsAbout()` also feeds the drawer, CSV and MCP text, and no lane owns `lib/format.ts`.
  So lane B should add a card-only formatter in `lib/card.ts` (e.g. `winsInTen(p)`), or the lead decides whether to change `winsAbout` everywhere.

### R2-2. Show the payout as "stake → what you get back", in dollars, after fees
- **Why:** The consumer apps put a dollar outcome next to the stake instead of making people do the math with odds.
  Robinhood's event pages show an estimated cost and a "Payout if Yes is correct" line, and its learn article separates
  **profit** from **payout**. Kalshi's trade panel has a "Max payout" line. Sportsbook guides say books show the
  potential payout automatically as you build the slip. The same results show apps disagree on whether "to win"
  means profit only (DraftKings guide) or total return (FanDuel guide). So **one wording must be picked and used everywhere**.
- **Sources** `[snippet, not opened]`:
  [Robinhood: profit vs payout](https://robinhood.com/us/en/learn/articles/profit-vs-payout-event-contracts/) ·
  [Robinhood: how event contracts work](https://robinhood.com/us/en/support/articles/how-event-contracts-work/) ·
  [Robinhood event page (estimated cost, "Payout if Yes is correct"; attribution unconfirmed: the snippet said "individual listings", this is one of the listed event pages)](https://robinhood.com/us/en/prediction-markets/tennis/events/ben-shelton-vs-rafael-jodar-group-stage-match-nov-19-2026/) ·
  [Kalshi game page ("Max payout")](https://kalshi.com/markets/kxnbagame/magic-vs-nets/kxnbagame-26nov20orlbkn) ·
  [DraftKings betting guide PDF (to win = profit)](https://foxwoods.com/sites/default/files/2026-05/Draftkings-Betting-Guide-Foxwoods.pdf) ·
  [FanDuel guide (payout includes stake; attribution unconfirmed between fanduel.com guide pages)](https://www.fanduel.com/guides/parlay-betting)
- **Kismet example:** The contract's "$10 wins $5.60" is **profit-only** wording, while today's card says
  "Bet $100 → get $158 after fees if it wins" (total back). Pick one. Recommended: **"$10 wins $5.60"** (profit, after the fee), with
  "You get $15.60 back if it wins, $0 if it loses" first line inside "Why this bet?". Use the fixed $10 on cards, not the
  user's default stake, so every card compares on the same base (same idea as R2-1).

### R2-3. Plain words on the card, jargon one tap away (progressive disclosure)
- **Why:** NN/G defines progressive disclosure as showing the few important options first and deferring advanced or rarely used ones to
  a secondary screen. It improves learnability, efficiency and error rate. The path to the second level must be obvious, and
  there should be **one** way to reach it. Heuristic #2 "match between system and the real world": internal terms
  make people stop and decode, even frequent users. Their Vanguard app review cites balances up front, holdings behind a tap.
- **Sources** `[snippet, not opened]`:
  [NN/G progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/) ·
  [NN/G 10 heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/) ·
  [NN/G Vanguard mobile app](https://www.nngroup.com/articles/vanguard-mobile-app/)
- **Kismet example:** The card shows no "pts", "edge", "Estimated return", price-as-of, tier note or record pill. One
  `<details data-testid="why">` labelled "Why this bet?" holds all of them, in plain sentences first and numbers second (see card layout below).
  Drop the per-figure ⓘ tips and title-attribute hovers on the card: they are a second and third route to the same basis, and hover doesn't exist on a phone.

### R2-4. A value rating needs a word label, not stars alone
- **Why:** NN/G (rating scales) says people find word-labelled scales easier to understand than unlabelled ones. Action Network's
  projections grade bets by edge and give a plain threshold ("at least a Grade of B or +3.5% Edge"). Other betting sites use
  1–5 star confidence. A study of app reviews found star scores can hide what the text says. So **stars must say what they
  measure**. Note: I found no source on how people read star ratings specifically, so this rule rests on the labelled-scale finding.
- **Sources** `[snippet, not opened]`:
  [NN/G rating scales](https://www.nngroup.com/articles/rating-scales/) ·
  [Action Network NBA projections (grade from edge)](https://actionnetwork.com/nba/projections) ·
  [mHealth review study: stars hide concerns](https://arxiv.org/pdf/2202.10620)
- **Kismet example:** `★★☆ Good value` with `aria-label="Value: 2 of 3 stars"`. The word sits next to the stars
  (Great / Good / Fair value). "Why this bet?" says in one sentence why it got that many (rule below).

### R2-5. Few chips up front, everything else behind one "More filters" button
- **Why:** Baymard: horizontal filter toolbars get troublesome past **6–8 filter types**. (A Baymard article
  titled "Consider Promoting Important Filters (61% Don't)" also turned up, but only its title, so it backs nothing here.) On mobile they recommend showing applied filters as a horizontally scrolling row
  of **removable chips** above results, with a visible cue that the row scrolls (for example, a truncated last chip). eBay's
  design system uses chips for common high-priority filters. SAP Fiori says the chip bar should hold only the most-used filters.
- **Sources** `[snippet, not opened]`:
  [Baymard: be careful with horizontal filtering toolbars](https://baymard.com/blog/horizontal-filtering-sorting-design) ·
  [Baymard: applied filters overview](https://baymard.com/blog/how-to-design-applied-filters) ·
  [Baymard guideline 2572: applied filters on mobile](https://baymard.com/guidelines/2572-applied-filters-on-mobile) ·
  [eBay Playbook filtering patterns](https://playbook.ebay.com/design-system/patterns/filtering-patterns) ·
  [SAP Fiori filter feedback bar](https://www.sap.com/design-system/fiori-design-android/v26-1/components/filter-feedback-bar/usage)
- **Kismet example:** see "Filter chip row" below: 3 chip groups (sport, when, style) plus "More filters", never more.

### R2-6. Loading: nothing under 1 s, skeleton cards for 1–10 s, and keep the old list while filters change
- **Why:** NN/G: under 1 second, show no skeleton or spinner (a flash is distracting). For a full page under 10 s, use skeleton screens. Use a
  spinner only for a single module. Over 10 s, use a progress bar. The thresholds come from Nielsen's response-time limits (1 s
  keeps flow, 10 s keeps attention). A Viget test found spinner users rated the wait more positively, so skeletons don't
  speed up perceived waits by themselves. Use them for layout stability, not as a speed trick. React: updates wrapped in a
  Transition (or `useDeferredValue`) keep the current content on screen instead of the Suspense fallback.
- **Sources** `[snippet, not opened]`:
  [NN/G skeleton screens 101](https://www.nngroup.com/articles/skeleton-screens/) ·
  [NN/G response time limits](https://www.nngroup.com/articles/response-times-3-important-limits/) ·
  [NN/G progress indicators](https://www.nngroup.com/articles/progress-indicators/) ·
  [Viget: a bone to pick with skeleton screens](https://viget.com/articles/a-bone-to-pick-with-skeleton-screens) ·
  [react.dev Suspense](https://react.dev/reference/react/Suspense) ·
  [react.dev useDeferredValue](https://react.dev/reference/react/useDeferredValue)
- **Kismet example:** `/bets` first load shows 5 grey card shapes the same size as real cards (no layout shift). Tapping
  a chip keeps the current cards (dimmed to ~60% opacity, chip shows pressed state) until the new list arrives
  (`startTransition` around the filter state). This meets §B "results update without flashing the old list".

### R2-7. Show the filter state and result count; never make people remember what's on
- **Why:** Heuristic #1 (visibility of system status): show current state so people can tell what their last action did.
  Heuristic #6 (recognition rather than recall): keep options and choices visible. Baymard's applied-filter chips do
  both at once.
- **Sources** `[snippet, not opened]`:
  [NN/G 10 heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/) ·
  [Baymard: applied filters overview](https://baymard.com/blog/how-to-design-applied-filters)
- **Kismet example:** Selected chips are filled emerald with a ✕. Under the row, show "12 bets · Soccer · Today", with a
  "Clear" link. The "More filters" button shows a count when hidden filters are on: "More filters (2)". Empty result:
  "No bets match. Try This week" with that chip as a button.

### R2-8. Thumb-sized targets: 44 px minimum, bigger for the main button
- **Why:** NN/G: touch targets at least 1 cm × 1 cm physical (Parhi, Karlson & Bederson), with spacing between them, and
  larger for primary calls to action and for use on the move. Apple HIG says 44 × 44 pt and Android 48 × 48 dp (as cited in the same results).
- **Sources** `[snippet, not opened]`:
  [NN/G touch target size](https://www.nngroup.com/articles/touch-target-size/) ·
  Apple 44 / Google 48 figures came from arXiv results in the same search, attribution unconfirmed between
  [2101.05244](https://arxiv.org/pdf/2101.05244) and [2403.13690](https://arxiv.org/pdf/2403.13690)
- **Kismet example:** Chips at least 44 px tall with 8 px gaps. "Bet on Polymarket" is full card width and 48 px tall.
  The whole "Why this bet?" summary row is the tap target, not just the text.

---

## Recommended card layout (contract §Card, 7 visible text elements)

```
┌──────────────────────────────────────────┐
│ Crystal Palace to win              ★★☆   │  1 plain title · 5 stars + word (aria "Value: 2 of 3 stars")
│ Bet Yes                     Good value   │  2 "Bet {side}"
│                                          │
│ Wins about 7 in 10                       │  3 big, the headline number (R2-1)
│ $10 wins $5.60                           │  4 profit after fee on a fixed $10 (R2-2)
│ Closes Sat 3:00 PM                       │  6 closing time
│ ┌──────────────────────────────────────┐ │
│ │          Bet on Polymarket           │ │  7 <VenueButton m s />, full width, 48px (R2-8)
│ └──────────────────────────────────────┘ │
│ Why this bet?                         ⌄  │  expand (not counted), one route to the basis (R2-3)
└──────────────────────────────────────────┘
```
The star glyphs and their word count as element 5. If e2e counting is strict, put the word in the aria-label only and
show it again first thing inside "Why this bet?".

**Moves into "Why this bet?"** from today's `BetCard.tsx`, in this order, plain sentence first:
1. "You get $15.60 back if it wins, $0 if it loses." (fee included; Polymarket's fee here is N¢)
2. Why the stars: "Bets like this won about 8 in 10 times. The price says 7 in 10. That gap is the value." (today's `pts` and verdict)
3. How sure we are: "Based on about 270 similar past bets" (today's Strong/Thin record pill and `recordHelp`)
4. Estimated return per $1, after fees (today's `RETURN_LABEL` line and its ⓘ text)
5. Price and when it was read (today's price line, live arrow, `price-as-of`)
6. What the estimate is built from (`model_level`, CLAUDE.md rule 3) in plain words, e.g. "Based on: soccer match
   winners closing within a day". The word "model" is banned on the card component (`lib/banned.ts`), so never print the level's raw name.
7. How bets like this did in testing: the existing `testedLine()` sentence ("Bets like this won N of M in testing…"),
   losing records included. This is the backtest record CLAUDE.md rule 3 asks for. A /track-record link alone would be a second tap.
8. Notes and tier caution (`rowNotes`, `TierNote`, `LowerConfidence`)
9. League / topic, watch star and alert bell (these are actions, not text. Lane B decides whether they stay as icon-only buttons in the header)
10. Link: "See how we track results" → /track-record (for the live record, on top of item 7)

Wording check for everything above: no `lib/banned.ts` words ("edge", "spread", "pts", "model"…) because the banned grep
runs on the card component, and no `test/profit-claim.ts` pattern ("expected return", "guaranteed"…). "Estimated return per $1"
and "Great/Good/Fair value" pass both.

Rule 3 of CLAUDE.md holds: every number above is one tap from the card.

## Star-rating rule (recommended)

Stars are the **same for everyone** (CLAUDE.md rule 4). They must also be **the same for Free and Paid on the same bet**,
so they can only use quantities both tiers receive at the same resolution. Checked in the repo:
- `roi_pct` reaches Free only as a band, with cuts at **0 / 5 / 10 / 20 / 50 %** (`lib/data/gate.ts`, `ROI`). Paid has the exact
  value, so Paid must band it the same way before comparing. **Cutoffs sit only on those band edges.**
- `model_neff` reaches Free exact (not in the gate), so `recordLabel()` (Strong ≥ 100 / Thin) is the same on both tiers.
- Don't use `cardReturn()` for stars. It switches between `realistic_edge` and `roi_pct` depending on the row and tier,
  so two users could see different stars.

Two plain questions:

- **How big is the gap?** The `roi_pct` band (estimated return per $1 after fees).
- **How much history is behind it?** `recordLabel(model_neff)`: Strong or Thin.

| Stars | Word | Rule (`roi_pct` band low end, record) | Plain explanation shown in "Why this bet?" |
|---|---|---|---|
| ★★★ | Great value | ≥ **10%** **and** Strong record | "A big gap between the price and how bets like this did, backed by lots of similar past bets." |
| ★★☆ | Good value | ≥ **10%** with Thin record, **or** **5–10%** with Strong record | "A real gap, but either smaller or with fewer similar past bets behind it." |
| ★☆☆ | Fair value | any other band above 0 | "A small gap, or few similar past bets. Worth a look, not a strong case." |
| (none) | — | band below 0 (edge after fee not above zero) | see below |

- The 5% / 10% cutoffs are **proposals** on existing band edges. Action Network's "+3.5% edge" floor (snippet above)
  suggests the low cut is in a sane range. Lane B should check on `test/fixtures` that roughly the top 5 of a normal day
  get ★★★ (move to the 20% edge if far more do). Pin them in `lib/card.ts` `stars(s)` with a unit test at each boundary,
  for both an exact (Paid) and a banded (Free) side.
- **Edge not above zero:** the contract says 1–3 stars, but a card can still show such a bet (the live price moved, or
  My list). Recommend `stars(s)` return `null` there, and the card show "No value at today's price" in place of the
  stars. **Flag to lead:** that is outside the contract's 1–3; the alternative (forcing 1 star) would label an overpriced bet as "Fair value".
- Stars never say "sure" or "likely to win". They rate the **price**, not the outcome (a 2-in-10 long shot can be ★★★).
  Put that sentence once in the FAQ.

## Filter chip row (recommended)

```
[Soccer] [NFL] [NBA] [NHL] [Tennis] [UFC] [More ▾] │ [Today] [This week] │ [Safer] [Balanced] [Bigger payouts] │ [More filters (0)]
```
- One horizontally scrolling row on phones (two rows wrap on desktop). The last visible chip is cut in half so the
  scroll is obvious (Baymard, R2-5). Sticky under the header.
- Three groups only: **sport** (top 6 by current bet count from `counts.json` + "More"), **when** (Today / This
  week, single choice, tap again to clear), **style** reusing the repo's existing `chance()` bands in `lib/format.ts`: Safer = "Leans your way"
  (win_prob ≥ 55%), Balanced = "Coin flip" (40–55%), Bigger payouts = "Long shot" (< 40%). That matches the onboarding tour's
  "Bigger payouts win less often". No Safer/Balanced preset exists yet in `lib/` or docs/04/13, so these are new). Everything else (price range, volume, venue, closing window) goes behind "More filters", a bottom sheet with a
  sticky "Show N bets" button.
- 44 px chips (R2-8), selected = filled emerald + ✕ (R2-7), result count line under the row, old list stays while the new one loads (R2-6).
- Filters are the user's own and may be saved, but the sort is the same server-side ranking for everyone (rule 4).

## 5 pages to imitate

No screenshot could be taken: Playwright's Chromium goes through the same proxy, and the CONNECT 403 on every host
below was conclusive, so `pnpm i` and the screenshot script were not run. Retake at 390×844 once hosts are allowed,
into `docs/research/screens/<name>.png`.

| # | Page | What to copy | Screenshot |
|---|---|---|---|
| 1 | Robinhood event page, e.g. https://robinhood.com/us/en/prediction-markets/tennis/events/ben-shelton-vs-rafael-jodar-group-stage-match-nov-19-2026/ | "Payout if Yes is correct" line under an estimated cost: dollars, not odds (R2-2) | blocked: robinhood.com |
| 2 | Robinhood learn, https://robinhood.com/us/en/learn/articles/profit-vs-payout-event-contracts/ | The profit vs payout wording, to make "$10 wins $5.60" vs "you get $15.60 back" consistent | blocked: robinhood.com |
| 3 | Kalshi game market, https://kalshi.com/markets/kxnbagame/magic-vs-nets/kxnbagame-26nov20orlbkn | Big % chance per side, buy panel with dollar input and "Max payout" | blocked: kalshi.com |
| 4 | Action Network projections, https://actionnetwork.com/nba/projections | Grade derived from edge with a stated threshold: model for our labelled stars (R2-4) | blocked: www.actionnetwork.com (actionnetwork.com not probed, assumed blocked) |
| 5 | Polymarket app (App Store listing https://apps.apple.com/us/app/polymarket/id6648798962; behaviour described in https://www.actionnetwork.com/prediction-markets/a-beginners-guide-to-polymarket-everything-you-need-to-know-about-contracts-pricing) | Probability + payout multiplier on one card ("$10 at 2.3x returns about $23"), swipe-to-buy. Snippet from the Action Network review, not the listing | blocked: polymarket.com; apps.apple.com not probed, assumed blocked |

Note: `docs/overhaul-evidence/before/bets-390x844.png` shows the signup wall, not bet cards, so it can't serve as the
card "before" reference. Lane B should capture `/bets` signed in (or in DEMO_MODE).

## Blocked hosts (ask the lead to allow, then reopen the pages)

**Needed to verify the rules:** www.nngroup.com, media.nngroup.com, baymard.com, pages.ucsd.edu,
pmc.ncbi.nlm.nih.gov, www.ncbi.nlm.nih.gov, www.cambridge.org, www.sciencedirect.com, www.fda.gov, react.dev,
viget.com, playbook.ebay.com, www.sap.com, arxiv.org, robinhood.com, learn.robinhood.com, kalshi.com,
news.kalshi.com, actionnetwork.com, www.actionnetwork.com, foxwoods.com, www.fanduel.com, frontiersin.org, pure.mpg.de, www.algolia.com

Hosts in these lists that are **not** in the curl probe below were not probed and are assumed blocked
(every probed host was blocked): e.g. react.dev, arxiv.org, apps.apple.com, actionnetwork.com.

**Needed for screenshots:** robinhood.com, kalshi.com, actionnetwork.com, polymarket.com, apps.apple.com,
sportsbook.draftkings.com, sportsbook.fanduel.com, rithmm.com, cash.app

Probed directly with curl (all `403 agent proxy: no rule or network setting allows this host`): www.nngroup.com,
baymard.com, news.kalshi.com, pmc.ncbi.nlm.nih.gov, polymarket.com, kalshi.com, robinhood.com,
www.actionnetwork.com, sportsbook.draftkings.com, sportsbook.fanduel.com, rithmm.com, cash.app, pages.ucsd.edu,
www.cambridge.org, help.kalshi.com, docs.polymarket.com, learn.polymarket.com, en.wikipedia.org.

**Not covered (no usable search result):** Cash App's display patterns, and Rithmm's rating method (its App Store copy
mentions win probabilities and "high-confidence" picks; one third-party wiki notes it has little public track record).
Neither is used in a rule.
