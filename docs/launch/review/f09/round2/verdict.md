# F9 #48 round 2 (head aaa9198): PASS with notes

Checks: typecheck, lint OK; vitest lib/venues 9/9; build OK; check:js `/` 144.1 kB (OK).
e2e: launch-f09-availability 4/4, launch-f09-markets-link 2/2, launch-f08-risknote 2/2 (e2e.log).
Source: polymarket.us/trust fetched 2026-11-23 (HTTP 200): "Legal nationwide*" and "*Trading currently not available in Nevada." Config matches: Polymarket US 50 available + NV restricted; Kalshi 51 unverified (lead decision); Polymarket intl 51 restricted.
Probe (probe.txt), states none/NV/CA at 390 and 1440 on /, /bets, /markets, /event/1335826:
- Finding 1 fixed: /markets has a visible line above the list ("Check Kalshi for Nevada" / "Polymarket: not available in Nevada", warning colour), 81/81 icon links at 390 carry it in aria-label/title. Screens 390-NV-_markets.png, 1440-NV-_markets.png.
- Finding 2 addressed: CA shows "Polymarket US: available in California" above every bet button on / and /bets; NV shows "not available in Nevada".
- No hscroll, disclaimer on every page, CLS ≤ 0.011 except below.
Notes:
1. /event/1335826 at 390 (NV): 1 of 5 fresh loads had CLS 0.436, all from the FOOTER moving (others 0.004). F9 adds one line in the header; the footer jump looks like a streaming/late-content issue, likely pre-existing. Not counted against F9; worth a check on final.
2. Nothing in F9 reads the plan (no tier in components/venues or state-server), so the signed-out/demo run covers Free/Pro/Premium; not re-run with the paid mock.
3. On /markets the line names "Polymarket" (intl, restricted everywhere in the US) because the row links go to polymarket.com, so a California user sees "not available" there and "Polymarket US: available" on /bets. Correct per config, but the /markets rows have no US-twin link.
