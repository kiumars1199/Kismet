# Marc's QA list (Nov 20, 2026): Lane B log

Lane B: one return figure per bet, edge labels, payout-band records, FAQ, backtest vs live, /about Top 3, ledger.
Q was away. Where the brief left a choice, the reading taken is written next to the item.

## Group 1: one return figure (`claude/qa-b-return`, "QA-B: 55, 31, 20, 37, 54, 5, 14, 51, 28")

Core decision: a card shows ONE return figure, the estimated return after the fee at the card's price
(`roi_pct` = win chance × payout after fee − 1). "Why this bet?" shows the same number, then "Similar past bets
in testing" and "Live record so far", each with its count.

| item | status | evidence |
|---|---|---|
| 55, 31, 20, 37, 54 (card, drawer, table, "If you bet now" disagree) | fixed (not verified live) | `lib/betFigures.ts` `betQuote()` is the one source for venue, price, fee, payout after fee (`pays` number + `paysText`), return (`retText`, band on Free) and the arithmetic line. BetCard, Why, MarketDetail, MarketCard, MarketTable, dashboard panels and the MCP server all read it. One payout per bet, after the fee; the stake box is $10 × that payout. `test/one-return.test.tsx`: every fixture best bet, exact and Free, card = Why = compact card = stake box, and the shown return = shown chance × shown payout − 1 to print rounding (Free: the formula over the 5% chance floor reaches the band). |
| (main's note 2) Free must not leak the exact return | done | `why-math` ("90% × 1.39x − 1 ≈ +25%") only renders when the quote is exact; Free sees "Free shows a range." Asserted for every fixture bet in `one-return.test.tsx`. |
| (main's note 3) n next to each drawer figure | done | Estimated return: "Based on about N similar past bets". Testing: "N tested bets, won Y%". Live: "N settled best bets", or "No settled bets yet" when 0. |
| (main's note 4) 7 slots at 390px | done | Return sits inside the existing value slot (stars + "+25% est. return"). New e2e `overhaul-cards.spec.ts` "390×844: one return figure in the value slot, 7 slots, nothing overflows". |
| 5 (edge labels don't match their numbers) | fixed | Verdict, "pts" and chance are now computed from the side at the quote's price (`atQuote`), so a US card's label and number come from the same US price. `gapPts` adapts precision so a positive gap never prints "0 pts" and zero prints unsigned; `gapRange` returns the floored gap when ranges don't overlap. Unit tests in `test/bet-figures.test.tsx`. |
| 14, 51 (one tested figure per payout band) | fixed | Why's "Similar past bets in testing" reads `backtest.by_pays` (the same source as /track-record "By payout"). Under 30 tested bets it says "too few tested bets to show a return (N tested bets)" instead of a number (`TESTED_MIN`, `bandTested`). The older "similar past bets" line from `realistic_edge` was removed, so there is one tested figure. |
| 28 (/about Top 3) | fixed | `lib/topBets.ts` ranks by the shown return (`betFigures(...).ret.roi`, venue-aware); /about renders the real `BetCard` ($10 stake, one return, same wording) instead of its own preview card. |
| 69 (Biggest payout sort) | handed to Lane A | `BetQuote.pays` (a number, after the fee) is exported for A's sort. No sort logic changed here. |

Gates: typecheck, lint clean; full chromium e2e 79 passed, 1 failed (trading-paper: `apps/extension` has no node_modules in this container, so its `pnpm build` fails; the branch does not touch the extension). s6.spec "landing (/about)" updated for the BetCard Top 3; vitest all green except `test/teaser.test.ts` "one bet per game" (fails identically
on origin/final 67faeaf; date-dependent Free sample, Lane A area); `pnpm build` OK; `pnpm check:js` 149.4 kB
(budget 150); e2e multipliers, overhaul-cards, proof, s3-drawer, a11y: 49 passed (chromium, port 3102,
`PW_CHROMIUM_PATH=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome` because Playwright 1.65.1's own build is
not downloaded in this container).

Left for other lanes: the Pro "Edge" column and server-side sorts use international numbers while US cards show
US numbers (Lane A, relevant to #69); My list uses the international return; the "Leans your way (55–80%)" filter
label is chance-based (Lane A filters).

## Group 2: FAQ and test vs live (`claude/qa-b-faq`, on top of `claude/qa-b-return`, "QA-B: 4, 48, 3, 36, 35")

| item | status | evidence |
|---|---|---|
| 4 (FAQ "win often" vs "won 90%" vs losing money) | fixed (not verified live) | `HIT_RATE_VS_PROFIT` now says most best bets win because most pay under 1.5x, and that a record can win most bets and still lose money. On /about and /pricing it is followed by the live facts (`hitRateLive`: "Live so far: 78% of 1,155 settled best bets won, and together they returned −1.3%."). |
| 48 ("everyone sees the same numbers") | fixed | Free sees bands, so that claim was false. `SAME_FOR_EVERYONE`: bets picked the same way for everyone, never from your bets; Free sees fewer, later, as ranges. Used on /about and /pricing; /terms, /disclaimer and the landing FAQ reworded to match. |
| 48 (cancel path) | fixed | /pricing "Can I cancel any time?" links to /account and names the **Manage billing or cancel** button (exists in `components/auth/AccountActions.tsx`, shown to users with a Stripe customer; /terms, /refunds, /contact already said this). |
| 3 (no reason given for test vs live gap) | already on final | `calibration()` in `lib/proof.ts` appends "Why live trails testing: our win chances have run high, bets we gave X% won Y%" to every proof line once 50+ bets settled (seen on kismetodds.com Nov 21: "87% won 78%"). Why this bet?'s "Live record so far" now carries it too (group 1). |
| 36, 35 ("52 weeks") | fixed | `testSpan` always names the weeks that had bets and their concentration: "past markets from Feb 25 to Nov 18 (bets in N of 52 weeks, 81% in the last 2)". /track-record's method note says "replays 52 weeks one at a time, but only N of them had best bets, with X% of all test bets in the last two". e2e `proof.spec.ts` asserts the clause on /track-record, /about, /pricing. |

Gates: typecheck, lint clean; vitest green except the pre-existing teaser test; e2e proof, s6, s1-landing, a11y 14 + 41 passed; check:js 149.6 kB.
