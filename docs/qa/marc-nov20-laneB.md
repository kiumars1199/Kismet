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

Gates: typecheck, lint clean; vitest all green except `test/teaser.test.ts` "one bet per game" (fails identically
on origin/final 67faeaf; date-dependent Free sample, Lane A area); `pnpm build` OK; `pnpm check:js` 149.4 kB
(budget 150); e2e multipliers, overhaul-cards, proof, s3-drawer, a11y: 49 passed (chromium, port 3102,
`PW_CHROMIUM_PATH=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome` because Playwright 1.65.1's own build is
not downloaded in this container).

Left for other lanes: the Pro "Edge" column and server-side sorts use international numbers while US cards show
US numbers (Lane A, relevant to #69); My list uses the international return; the "Leans your way (55–80%)" filter
label is chance-based (Lane A filters).
