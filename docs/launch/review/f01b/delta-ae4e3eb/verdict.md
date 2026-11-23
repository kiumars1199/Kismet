# f01b delta c7e0a4b..ae4e3eb: PASS with notes
Diff: resolveLink kalshi -> m.kalshi_matched_ticker ?? m.kalshi_ticker; Market.kalshi_matched_ticker?: string; test for 103 (+ bySlug index fix).
vitest lib/check 37/37 at ae4e3eb.
Probe on a LOCAL merge f01b + #52 (42ee0ba), dev demo :3291, fixture venues.json kalshi_ticker KXFIXTURE-6674492 (probe.log, PNGs):
 POST /api/check {link: kalshi.com/.../kxfixture-6674492} -> 200 market 6674492; unknown ticker -> 404 not_found.
 /check paste link at 390/1440 -> "Denmark vs. Norway: Both Teams to Score"; stubbed kalshi prices {0:.41,1:.62}: Yes "Use it" -> 41, No -> 62.
Notes: 1) git merges f01b and #52 without conflict but keeps BOTH kalshi_matched_ticker lines in Market -> tsc TS2300 Duplicate identifier.
 Whoever merges second must drop one line. 2) Alone (batch 1, without #52) nothing produces kalshi_matched_ticker, so Kalshi links still resolve to "missing" on prod until #52 lands.
