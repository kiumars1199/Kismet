# F3 prod recheck, final 67cab85 (dpl_FZRXbSbQGLv3hXSxriFbVvUXh8Rn): PASS with notes
1. counts: prod /api/meta counts.polymarket 143222 (polymarket_priced 17632, kalshi 169377). Independent keyset crawl with engine/pm_index.crawl
   at 67cab85 (07:00:47Z, complete, 67 s): 143401 open+accepting two-outcome. 143222/143401 = 99.9% (>= 95%). keyset.txt, meta-*.json.
2. Search: prod /markets and /api/markets are signed-in only (307 /signup, 401): blocked on prod (no test account). Local: 315b0db (= 67cab85 + #63,
   no search change) demo next start with fixtures + the real 143401-row index: 12/12 random open markets found by question via /api/markets?q=.
   search-sample.txt.
3. /markets CLS at 390 (local, same build, 9 loads): 0.019-0.020 on 7, 0.068 on 2 (at 1-2 s the header line "476 markets match · 143.8K open
   (501 priced) · scanned N ago" goes 1 -> 2 lines, +20 px, shifting the Quick filter rows). Under 0.1. Prod not measurable signed out.
4. Disclaimer: present on prod /, /pricing, /about, and the 404 page.
