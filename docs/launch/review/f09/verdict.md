# F9 #48 review (8434b9e; branch head 09d9ca1): FAIL

Checks on 09d9ca1: lint OK, typecheck OK, build OK, vitest lib/venues + lib/account + helpline 14/14,
e2e launch-f09-availability 3/3. check:js `/` 143.8 kB (OK, still static ○). `/bets` 196.3 kB is over 150 kB,
but final is 190 kB first-load too, so that isn't new.

Done-when: config has 51 entries for each venue, each with a source URL and a checked date; the unit test fails on a missing one; the e2e covers restricted, unknown and saved. All met.

## Findings
1. Some deep links have no availability note. On /markets, each row has an icon-only link to polymarket.com
   (aria-label "Open on Polymarket. Bet only what you can afford to lose."). That is 81 links at 390 px and 14 at 1440 px. None has an availability line,
   even with us_state=NV, where config says polymarket_intl is "restricted". The note "Polymarket: not available in Nevada" only
   appears after opening the row. See probe.txt (lines=0 on /markets) and 390-NV-markets-row.png.
2. The main bet buttons never say "available" or "not available". Kalshi and Polymarket US are "unverified" in all 51 states,
   so /bets and / always show "Check Polymarket US for <state>" (or "Check Kalshi for ..."). Only the intl link in "Why this bet?"
   gets a definite answer. That meets Done-when literally, but the user never sees "available in your state". The lead or Q needs to decide on sourcing.

## Notes (not findings)
- / stays static and still shows the saved state (probe: NV gives "Check Polymarket US for Nevada" on /).
- /markets CLS of 0.42 at 390 and 0.275 at 1440 isn't from this PR: the branch doesn't contain the F3 fix yet. Re-check after rebase.
- No hscroll, and the disclaimer is on every page tested, at 390 and 1440, for no state, NV and NY. CLS elsewhere is ≤ 0.004.
