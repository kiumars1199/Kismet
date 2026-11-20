# Overhaul report (Nov 20, 2026)

Evidence for every item in `docs/OVERHAUL.md` (sections 0, A–G). Raw lane notes: `docs/overhaul-evidence/<lane>/NOTES.md`.
Before screenshots and prod headers (taken 16:58 UTC, before any change): `docs/overhaul-evidence/before/`.

## Decisions made without Q
1. **Push once at the end.** Q chose this when asked; recorded here because CLAUDE.md now says every push to `final` deploys prod. All lanes merge on local `overhaul`; one push to `final` after all gates pass on the merged tree.
2. **Playwright browser path.** The pinned Playwright (1.65.1) wants Chromium build 1255; the sandbox has 1243. Added an opt-in `PW_CHROMIUM_PATH` launch override to both Playwright configs (unset = old behaviour, CI unaffected). WebKit 27.2 was downloaded for §D after opening the Playwright CDN on the session network.
3. **Network.** Created a personal cloud environment "MarketEdge" for this session (Playwright CDN, kismetodds.com, Polymarket hosts, research sources). No secrets added.
4. **Lane F1 superseded by `claude/us-venue`** (Q's instruction). F1's own WIP fetcher (`worktree-agent-aef7f199d3acc4117`, `pipeline/fetch_polymarket_us.py`) is not merged, to avoid duplicate matcher code. Its live findings (gateway endpoints, slug patterns, 27% exact-bet coverage, 46/46 side agreement) are kept in the F1 evidence notes.
5. **Migration numbering.** `alert_events(rule_id)` index renumbered to `20261120000400_…` so it doesn't collide with lane F2–4's `…0200_funnel_events.sql`.
6. **Banned-word rule** (§A/§B checks): one helper, `apps/web/lib/banned.ts`. Whole words, case-insensitive, on visible text + `<title>` + meta/og/twitter descriptions; scripts, RSC payloads and URLs excluded (so "scripts" ≠ pts, "event" ≠ EV). Landing also bans counts above 3 digits (times and years excluded).
7. **Bets with no value after fees get no stars.** The spec says 1–3 stars; forcing 1 star on an overpriced bet would call it "Fair value". `stars()` returns null and the card says "No value at today's price".
8. **"$10 wins $5.60" means profit after fees** (the spec's wording), used consistently on every card. The old card said "get $X back" (total); mixing the two was confusing.
9. **Research rule IDs.** Lanes cite rules by their research IDs (R1-n, R2-n); `docs/research/overhaul.md` lists the final 15 under those same IDs, so citations made before consolidation stay valid.
10. **Lane B started before R1 finished.** Cards and filters rest on R2's rules (data display, usability), which were ready. Lane A (landing copy) waits for R1's value proposition.
11. **Lane E's live-filter result (`flag_max_edge`, default off) ships as a flag, not on.** Its held-out gain is noise-sized and the candidates weren't pre-registered.
12. **Payout wording vs Polymarket.** Polymarket's trade sheet says "To win $19.89" for the *total* payout. The card keeps the spec's "$10 wins $X" (profit); the first line of "Why this bet?" states the total ("If it wins you get $X back"), and the card never says "To win".
13. **Banned-count regex fix.** R1 found `BIG_COUNT` matched "Unlock 14 more" (the M of "more"). Fixed with a no-letter lookahead; tests cover it.
14. **Lane E merge conflict in `engine/scan.py`.** Kept both sides: G's `cap_per_event` runs after E's `is_best` (which now includes the optional `flag_max_edge`). Engine tests after the merge: 99 passed.
15. **Proof line keeps the test's +14%, with its concentration stated.** `lib/proof.ts` now says the span and "86% of bets in the last 2 weeks" instead of "1 year" and drops "enough to compare". It still quotes production's backtest number, because the even rebuild (+2%) was run locally on a different sample and isn't what production publishes. Replacing the headline number waits on a production re-run (see Waiting for Q).
16. **G5 cap reported both ways.** The scan holds slots for lines already in the ledger, so live behaviour is closest to "first 2 per game" (−0.9%), not "best 2" (+2.1%). Both are in the table; neither is a claim the cap improves returns.

## Waiting for Q
- Apply Supabase migrations `20261120000200_funnel_events.sql`, `20261120000300_lifecycle_emails.sql`, `20261120000400_alert_events_rule_id_index.sql` to the live project (not applied by agents).
- Set secrets: GitHub `RESEND_API_KEY`, `ALARM_EMAIL_FROM`; Vercel `RESEND_API_KEY`, `EMAIL_FROM`, `UNSUBSCRIBE_SECRET`, `CRON_SECRET`. Rerun `node ops/stripe-setup.mjs` so the webhook subscribes to `invoice.paid` (touches live Stripe config).
- **Re-run the backtest on production data with an even history.** The public test has 86–87% of its best bets in the last 2 weeks; on an evenly sampled local rebuild that share is 0.9% and the result is about +2% per bet (t < 1). Backfill the fetch (it keeps only the newest 2,000 events per tag) and re-run; until then the "enough to compare" bar (~10 US events, from the concentrated run's t of 34.7) is too low — the even rebuild implies ~1,340 events. Research doc §5, §7.
- **`engine/ledger.py` same-payout picks** include rows logged before `control.jsonl` existed (no `event_id`), so the picks' event count is inflated. The page hides that count until it is fixed.
- `vercel.json` now has 3 crons; confirm the Vercel plan allows it (fallback: run trial reminders from `/api/settle/run`).

## Merged
- PR #3 `claude/us-venue` (kiumars1199/Kismet): merged via `overhaul` (3 commits: 29282c9, d40090f, ddf9cfd).

## 0. Research — PASS
- `docs/research/overhaul.md`: 15 rules (IDs R1-1…R1-8, R2-1…R2-6, R2-8; R2-7 merged into R2-5), each with source links and an example to copy; chosen value proposition; 5 pages to imitate with screenshots in `docs/research/screens/` (polymarket-trade, polymarket-sports, polymarket-game, robinhood-event, actionnetwork-projections). Lane files: `overhaul-r1.md` (256 lines), `overhaul-r2.md` (238 lines, with a "Removed claims" table).
- Sources: every source was downloaded and read on Nov 20 (curl + text extraction). The first R2 pass ran before the hosts were opened and used search snippets; it was redone after the network change and unverifiable claims were deleted.
- Not reachable even after allowlisting: kalshi.com (bot wall, HTTP 429), news.kalshi.com (403), pmc.ncbi.nlm.nih.gov (reCAPTCHA), sportsbook.fanduel.com (403). No rule rests on them.
- Chosen headline "Which Polymarket bets are worth it today?" and sentence "Placing a bet or two? Kismet shows which Polymarket bets look like good value today, how often bets like them win, and what $10 pays." Scoring is judgment against stated 5-second criteria, not a user test.
- Citation check: see the `git log` grep under §A, §B, §D below.

## E. Results and the live record — PASS
Research file: `docs/research/live-vs-backtest.md` (§1–8). Lane notes: `docs/overhaul-evidence/E/NOTES.md`. Data: `origin/live` @ ecbc3a7 (Nov 19 19:47 UTC) plus public Gamma/CLOB reads.

Why live (−2.1%) trails the test (+14–17%):
| Question in §E | Answer | Evidence |
|---|---|---|
| Real ask after fees? | No. Replaying entries at the logged ask moves the test −0.2¢ (12.21¢ → 12.02¢ mean charge); +2.1% → +1.9% per bet | §7, `scripts/ledger/calibrate_ask.py` |
| Edge tier mixed in? | No, the ledger logs Best bets only | §2 |
| 90¢+ favourites? | No, price ≥ 60¢ filter: −1.2% in-sample | §3 table |
| Weather? | Roughly break-even (+0.9%, 333 settled); sports lost (−2.7%), two soccer games = 93% of the loss | §2, `cap_check.txt` |
| Lookahead? | None found in snapshot prices near close | `scripts/ledger/lookahead.py`, §2 |
| May week a data bug? | Not proven; left unchanged | §2 |
| Real cause | Model win chances too high live: predicted 86.6% vs 77.4% won; and the test's sample is 86–87% in the last 2 weeks | §1, §5 |

Filter behind a flag (`flag_max_edge = 0.10`, default off, `config/demo.json`):
| Rule | In-sample (862 rows) | Held-out (149 rows) | Distinct bets |
|---|---|---|---|
| Off | −2.1% | +9.6% | 742 bets, +1.3% |
| On | −1.7% | +12.6% | 574 bets, +1.9% |

Re-run of the walk-forward test (local even rebuild: 34,679 markets, 10,733 events):
| Pricing | Bets | Events | Per bet | Per event | t (by event) |
|---|---|---|---|---|---|
| Mid + ½ spread | 432 | 214 | +2.1% | +0.9% | 0.80 |
| Ask, median premium (+1.05¢ from 593 live asks) | 474 | 237 | +1.9% | +1.9% | 0.71 |
| Ask, mean premium | 463 | 231 | +2.8% | +2.5% | 1.07 |

Filters chosen on older folds (Nov 19, 2025–Sep 16, 2026), reported on the newest 8 (Sep 23–Nov 11): at the ask, 23 events, −19.1% per event, t −0.81; "validated" selects nothing. Too small to judge.

`lib/proof.ts` (feeds /pricing, /about, llms.txt, MCP, /track-record):
- Before: "Testing on 1 year of past markets: best bets, +14% per bet. Live since Nov 17: 742 settled bets, +1.3%, enough to compare with testing."
- After: "In testing on past markets from Nov 30, 2025 to Nov 14, 2026, 86% of bets in the last 2 weeks: best bets, +14% per bet. Live since Nov 17: 742 settled bets, +1.3%." "Enough to compare" is now counted in US events only and doesn't appear until they settle.

/track-record (G3 too): order is US record → "Kismet's picks vs other bets at the same payout" (events) → whole record with the international-only line → testing. One headline number per card; t-stat and ¢/share inside "Details". "Bets we rated higher did better" is computed and only shows when true (it isn't on Nov 20 production: 13.1/14.0/10.2/16.9¢).
Screenshots: `docs/overhaul-evidence/E/before-track-record-{390x844,1440x900}.png`, `after-track-record-*.png`, `after-realledger-track-record-*.png` (real live ledger).
Tests: `engine/tests/test_max_edge.py`, `engine/tests/test_ask_price.py`; engine suite 99 passed on the merged tree.

## G4. US-native scan — PASS
Behind `US_NATIVE_SCAN` (default off). Live run with it on, Nov 20 (`docs/overhaul-evidence/G/NOTES.md`):
```
polymarket us native: 347 scored of 8747 open US markets
meta.us {'ok': True, 'markets': 84703, 'matched': 6785, 'native': 347, 'best_on_us': 116, 'best_us_edge': 105}
native flags 19 (culture 9, finance 8, politics 2), native Best bets 0
```
First result: "US Diesel Prices This Month: Above $5.70", No at 73¢, fee 1.9¢, 10.6¢ edge, link `polymarket.us/event/usdsl-month-2026-11-30` (opens, G6). Fixed in passing: US `outcomes` order is unreliable, so the long side is put first. Tests: `engine/tests/test_us_native.py` (flag off → 0 native, on → 4 native, 1 Best bet logged as `venue: "us"`).

## G5. Best bets capped per game — PASS
`max_best_per_event = 2` (config). Live scan Nov 20: 589 Best bets capped, max 2 per event over 459 events. Retroactive on the live ledger (`python3 scripts/ledger/cap_check.py`, full table `docs/overhaul-evidence/G/cap_check.txt`):
| Rule | Settled | Events | Per bet | Return |
|---|---|---|---|---|
| No cap | 593 | 178 | −0.56¢ | −0.7% |
| Cap 2, best ranked | 317 | 178 | +1.64¢ | +2.1% |
| Cap 2, first logged (closest to live behaviour) | 317 | 178 | −0.71¢ | −0.9% |
| Cap 1 | 178 | 178 | −0.61¢ | −0.8% |
Not monotonic; weak evidence on returns. The cap does what it's for: one game's lines can't flood the list or the record. Tests: `engine/tests/test_best_cap.py`; backtest twin `engine/backtest.cap_mask`.

## G6. Polymarket US link — PASS (pattern changed)
`/market/<slug>` does **not** open the market (desktop: 307 to home; iPhone: 307 to the app-install link). `/event/<event slug>` does, on both. `US_URL` is now `https://polymarket.us/event/{slug}`; 60 of 60 sampled sports twins confirmed. Raw: `docs/overhaul-evidence/G/linkcheck.json`; screenshots `docs/overhaul-evidence/G/shots/` (desktop Chromium 1440×900 and WebKit iPhone 15 for each URL).
