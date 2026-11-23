# F2 #45 round 2, head cfe2306 (local next dev, fixtures, DATA_CLOCK=scan, E2E_MOCK=1)
- typecheck, lint OK; vitest lib/check + check-api + check-combo-api 57/57 -> checks.log
- build OK; check:js / 142.8 kB; /check/combo 127.8 kB -> checks.log
- e2e launch-f02-combo 3/3 -> e2e-combo.log; paid launch-f01-limit 4/4 incl. the new Free combo test -> e2e-paid-limit.log
- /api/check/leg returns market/outcome/price/side/venue only (paid e2e asserts keys). Prior finding 1 fixed.
- "Why these numbers?" expand: pays product, chance product, smallest-leg sample, each leg's basis (e2e asserts). Prior finding 2 fixed.
- Free, signed out (free-third-leg.txt, free-ui.log, signedout-{390,1440}-free-{2,3}legs.png): the page scores as soon as there are 2 legs,
  which spends the day's check; adding a 3rd leg is a new set -> 429 and the upgrade card replaces the numbers. Drop-weakest also changes the set.
- /api/check/combo returns each leg's full single result (chance, edge, score) for Free: e.g. 6654469 0.8514/0.1122/78, 6674176 0.8171/0.1455/84.
