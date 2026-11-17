# 01 · Product

## One line
MarketEdge is a screener for Polymarket (and later Kalshi) that shows which contracts are
priced **below their real win chance**, after fees and after the cost of buying at the ask,
with the evidence behind every number.

## Who it's for
| User | Wants | What MarketEdge gives them |
|---|---|---|
| Active sports bettor on Polymarket | Better prices on games they'd bet anyway | Niche filters (league, market type), edge on each side, stake table |
| Weather / niche trader | Fast scan of daily markets | Weather filters (city, high/low, day), live flags 6–24 h out |
| Casual trader | "Is this bet any good?" | Win chance vs price, plain-English verdict, extension badge |
| Data-minded trader | Proof | Backtest record, calibration charts, sample sizes |

Not for: market makers, high-frequency bots, copy-trading/whale watchers (out of scope at launch).

## Core promise, in the app's own words
"Same 2x payout, different odds. We show which ones historically win more often than their
price says, after fees, and whether you can actually get that price right now."

## Tiers
| | Free | Pro $19/mo | Premium $29/mo |
|---|---|---|---|
| Market screener (all open markets) | Yes, 15-min delay, top 25 rows per view | Live, unlimited | Live, unlimited |
| Win chance + edge on each market | Edge shown as a range ("2–5¢") | Exact | Exact |
| Flags (validated shortlist) | 3 per day revealed | All | All |
| Filters | Category, niche, price | All (`04-filters.md`) | All |
| Saved presets | 1 | 25 | Unlimited |
| Dashboards (multi-panel) | — | 3 | Unlimited |
| Watchlist / saved bets | 10 | Unlimited | Unlimited |
| Alerts | — | Email + web push, 20 rules | + Telegram/Discord webhook, 100 rules |
| Execution check (order book, stake table, capacity) | First-share verdict only | Full | Full |
| Bet journal + CLV + P&L | — | Yes | Yes |
| Track record / calibration pages | Yes | Yes | Yes |
| Chrome extension badges | — | — | Yes |
| CSV export | — | Yes | Yes |

7-day free trial on Pro and Premium. Annual = 2 months free.
Prices are a starting point (`11-research.md` has competitor pricing).

## Demo scope (tonight → this week)
Must have, all real data:
1. Screener with search, filters, sorting, grouping by event (F-01, F-02, F-03)
2. Market detail drawer: win-chance curve, execution check, stake table, evidence (F-04, F-05)
3. Flags page (validated shortlist) (F-06)
4. Saved presets + favorite topics, saved in localStorage for the demo (F-07, F-08)
5. Watchlist in localStorage (F-09)
6. Track record page from `backtest.json` (F-14)
7. Calculators: edge, Kelly, payout (F-15)
8. Landing page + pricing page (static) (F-20)

## Paid v1 (week 2)
Everything in Demo, plus: auth, Stripe, server-side presets/watchlist/dashboards, alerts (email + push),
bet journal with CLV, feature gates, onboarding, Chrome extension (Premium).

## Later
Kalshi (after written permission), cross-venue comparison, whale/large-trade feed, mobile PWA polish,
team accounts, public API.

## Compliance guardrails (product rules, not legal advice)
- **No personalized picks.** Flags, edges and verdicts are computed the same for every user.
  Users choose their own filters, presets and favorite topics (topic level only). The app never
  reads a user's positions to tell them what to buy. Showing a user's own positions or journal
  next to market data is fine.
- **No auto-trading, no order placement** in the app or extension. Links open the market on the venue.
- **No profit promises.** Copy says "historically", "estimated", "based on past results".
  The backtest page shows losses and limitations as plainly as wins.
- **18+**, disclaimer on every page and in the extension popup, ToS acceptance at signup.
- **Kalshi data only with written permission** (their Developer Agreement bans commercial reuse).
  Polymarket data is public.
- Positioning everywhere: "market analytics", not "tips" or "picks".
