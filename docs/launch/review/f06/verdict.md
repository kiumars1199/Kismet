# F6 #46 review (b9051cb..c68d2b7; branch head 5fb6c47, which also has the F1 and F2 fixes merged in): FAIL

Checks on 5fb6c47: lint OK, typecheck OK, build OK. vitest lib/venues + lib/check + check-api: 64/64. guides.test covers 3 steps per venue,
the source URL and date, no cents, and 7 deepLink cases (6 or more required). e2e launch-f06-howto: 1/1. check:js `/` is 142.8 kB and `/check` is 131.0 kB, both OK.
At 390 and 1440 (probe.txt): no hscroll, CLS ≤ 0.004, disclaimer present. The 3 steps, the venue toggle and the link are correct for the
US-twin market 6417673 (intl link, US link) and the plain market 6635049.

## Findings
1. Done-when not met: "open from a card". /bets has 0 "How to bet this" controls on cards at 390 and 1440. The guide only opens
   on /check, and the e2e opens it there. A comment says "the card button comes with the BetCard task".
2. The default venue is the one US users are least likely to be able to use. For a market with a US twin, the guide opens on
   Polymarket (polymarket.com). F9's config marks that venue "restricted" in all 51 states. The guide shows no availability line
   (`availability` is not passed, avail=0), so a US bettor is sent there first. Depends on F9: wire F9's line into the slot, and consider defaulting to Polymarket US when a twin exists.
3. Step sources aren't one tap away. Every step has a source URL and date in config, but the panel only says "Steps from <venue>'s
   own help pages." It has no link and no date (sources=[] in the probe).
4. Low: "Bet only what you can afford to lose." shows twice in a row on /check with the guide open (afford=2): once in HowToBet and once in CheckClient.
   Switch to F8's RiskNote once #44 merges.
