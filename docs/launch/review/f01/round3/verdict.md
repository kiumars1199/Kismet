# F1 #43 064f521 round 3: PASS with notes
typecheck/lint OK; vitest lib/check 22/22; build OK; e2e checker 11/11; e2e-paid f01-limit 3/3 (incl. limit card CLS<0.1 at 390/1440); CI web success.
Probe (probe.log): /check?m=no-such-market CLS 0.004 @390 (was 0.371), 0.002 @1440; no hscroll; disclaimer; missing card min-height 1000/700.
Kalshi own price: POST /api/check with kalshi.com links to open fixture Kalshi markets -> 404 not_found (kalshi-link-probe.txt). Nothing on final writes kalshi_ticker; F4 #52 engine/venues.py does. "Use it" sets the Yes price whatever side is selected.
