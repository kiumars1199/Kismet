# post-merge a98ee96 (F14 + #74 + #77): PASS
## Prod (kismetodds.com, signed out; pm98.log)
390/768/1024/1440: every page returns 200, the disclaimer is present, no cents, no sideways scroll, no page errors and no 5xx.
/m/6596313 is the teaser. /markets, /markets?ven=kalshi and /kalshi redirect to /signup?next=...
History API: 401 signed out, also 401 for an unknown id. markets/[id] and /api/kalshi: 401. og: 200 PNG. The / state link is %2F.
## Paid mock at a98ee96 (:3337)
F14 chart (p53.log): Free, Pro, Premium and Premium-trade at 390 and 1440.
- /m/6674492 draws the chart and its curve, with basis "Prices from Polymarket, every 11 hours. Chance of Yes."
- /m/7078474 shows the empty state "No price history for this market yet".
- CLS is at most 0.0063. History API returns 200 with 196/197 points; an unknown id returns 200 empty. Signed out, the API returns 401 and /m is the teaser.
- Trade and combo slots are gated per plan. Venues block: 5 rows, with "Pays most here". No cents, disclaimer present.
/markets and Kalshi view (p74.log): out, Free, Pro and Premium at 390/768/1024/1440.
- Signed out, both redirect to signup.
- Signed in, CLS is at most 0.015 and the count line is stable. There's no sideways scroll, and the Kalshi view shows "29 Kalshi markets match".
- One earlier run hit a "Switched to client rendering" message. That run was disturbed: the server was then OOM-killed under memory pressure. It did not recur in the clean rerun.
Overflow and sticky (p77.log, Free and Pro at 768–1440): the page never scrolls sideways (sw == cw).
- 768/1024: the table scrolls inside its box (overflow-x auto) and the header stays in view.
- 1440: the table fits and the header sticks at top 64.
- 1280/1366: the table is 1245–1261 px in a 1214 px box at 1280, and at 1366 the header scrolls off (top -42). This is the known #77 follow-up that #81 fixes, not a regression from this merge.
