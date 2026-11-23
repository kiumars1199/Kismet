# F2 #45 ef73b2f round 3: PASS with notes
typecheck/lint OK; vitest lib/check+test/check 60/60; build OK; check:js 144.6 kB; e2e f02-combo+f01-checker 14/14; e2e-paid f01-limit 5/5 (incl. Free 3 legs, one explicit check, drop recompute, 1 call); CI web success; merges clean with final.
Probe (probe.log, probe2.log): 3 legs, nothing scored until tap (0 calls), tap -> 1 call, 5.49x; remove -> 3.79x, still 1 call; no hscroll; disclaimer; button 44px.
CLS: load 0.043 @390 / 0.007 @1440; with 2 programmatic leg adds 0.141 @390 / 0.025 @1440.
Notes: per-leg winProb/edge for up to 10 legs in one Free check (shown on leg lines); test comment says otherwise.
