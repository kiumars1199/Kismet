# F3 fix #59 4e52f3d (head moved from bb4ce62): PASS with notes (local; prod recheck after merge)

Green: pytest 162 (engine+ops); typecheck; lint; vitest polymarket-index+kalshi-search 22/22; full vitest 1481/1482
(only api.test apply() p95 timing at load avg ~11; 7/7 alone); build; check:js 144.4 kB; e2e launch-f03-search 16/16.
CI: python + supply-chain success; web success (rechecked). Branch is behind final 34f672f (F15), merges clean.

Probe (demo next start, signed out), probe.log + screenshots:
- /api/meta counts: polymarket 526 = 501 priced + 25 index-only; polymarket_priced 501. By construction
  counts.polymarket >= index rows (= keyset open+accepting two-outcome count at crawl time), so >= 95% holds locally.
- /markets?q=Zorbland 390/1440: "Open on Polymarket (1)", 1 row, "Not priced yet", link polymarket.com/event/<slug>, SSR, no hscroll, disclaimer.
- /markets?t=sports.nba: "Also open on Polymarket (3)", past-close row labeled "Past close time, waiting for the result", listed last.
- Strip hidden on ven=kalshi, on /api/flags, page 2 (pg=2 -> 400 for Free anyway).
- CLS: 390 0.018-0.020, 1440 0.001-0.011 (one cold 0.028 footer shift on the first 1440 load); the strip itself never shifts.
