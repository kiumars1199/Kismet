# Post-merge prod smoke: final a7c3ae5 (F13 #51 33521d6, #75, #76, F4 #52)
Vercel dpl_9nYXz6x33fN6JgGwKmXExzoLmrhL, production, READY. Signed out on kismetodds.com in headless Chromium at 390 and 1440. Log: pm52.log.

| Check | Result |
|---|---|
| "/" state link | 4x href="/state?next=%2F" at 390 and 1440 (#75) |
| /api/og/bet/6596313 | 200 image/png 1200x630, 48796 B: the teaser card (og-6596313.png): title, category, sign-up line, disclaimer, no model output, no cents |
| og with forged sig (?s=0&sig=deadbeef) | 200, the same teaser bytes (falls back, no leak) |
| og with unknown id | 404 text/plain (not 500) |
| /api/invite/ref POST (bad code, or {}) | 204; GET 405; no 500 |
| /api/invite GET signed out | 401 |
| /m/6596313 signed out | 200 teaser: disclaimer, no cents, no venues block (expected); og:image = /api/og/bet/6596313 |
| /api/markets/6596313 (and ?detail=1) signed out | 401 JSON, not 500 |
| /account, /bets signed out | redirect to /signup?next=... |
| Disclaimer, no cents, no sideways scroll | all pages, both widths |
| pageerrors / 5xx responses | none |
| manifest links | 2 per page (1-2 in head), same as 40acce0 (the F10 head link plus Next's metadata link); unchanged |

Not checkable signed out: the venues block and the "Pays most here" badge on /m (the page is a teaser; the API is 401). That is covered by e2e launch-f04-venues 8/8 on 6bed452.
