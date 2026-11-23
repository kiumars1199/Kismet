# F5 #47 ff7c5eb round 4: PASS with notes
typecheck/lint OK; vitest lib/filters+topics 10/10; e2e-paid launch-f05-topics 6/6 (incl. new returning-user 307 test); CI web/python/supply-chain success; contains final 34f672f.
Reviewer probe run/f05r4.spec.ts (probe.log, 390/1440 screenshots): hint `<uid>|on:sports.nfl`, expires in 365 d; next day (no tab open) GET /bets and / -> 307 /bets?fav=1&t=sports.nfl; first document has the pill at 390 and 1440. Hint cleared -> 200 (first view unfiltered, one stale view, the stated limit). Sign out -> signed-out GET /bets 307 /signup, hint gone.
