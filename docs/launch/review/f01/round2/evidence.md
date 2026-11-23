# F1 #43 round 2, head 8818178 (local next dev, fixtures, DATA_CLOCK=scan, E2E_MOCK=1; port 3291)
- typecheck, lint OK; vitest 1488 passed, 1 failed (test/api.test.ts apply() p95 timing, known load flake, same on final) -> vitest.log
- build OK; check:js / 142.7 kB OK; /check 129.3 kB OK -> checkjs.log, build.log
- e2e launch-f01-checker 9/9 -> e2e-checker.log; e2e-paid launch-f01-limit 3/3 in one run -> e2e-paid-limit.log
- closed market 6674492, real clock -> 404 "We couldn't find an open market at that link"; price 0.5% -> 400 price_range -> closed-market-repro.txt
- UI probe (probe-ui.log): CLS on /check?m=…: result 0 (390) / 0.001 (1440); unknown id ("missing") 0.371 at 390, 0.016 at 1440;
  Free-limit card 0.298 at 390, 0.016 at 1440. No hscroll, footer disclaimer present, no cents, on all. Screenshots signedout-{390,1440}-{result,missing,limit,price-0.5,empty}.png
