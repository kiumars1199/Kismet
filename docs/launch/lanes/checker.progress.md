# checker progress

- F1 bet checker · PR up, awaiting lead review · https://github.com/kiumars1199/Kismet/pull/43 (branch launch/checker-f01)
  Evidence: typecheck/lint clean; vitest 1471 pass (only api.test.ts p95 timing flaked under load, passes alone); check:js "142.5 kB ... budget 150 kB: OK";
  e2e launch-f01-checker 6 passed; e2e-paid launch-f01-limit 2 passed. No preview URL checked yet (lead).
  Shared files touched: entitlements.ts (checks_day), DrawerGate.tsx (/check exact path), public-paths.ts (/check, /api/check), sitemap.ts.
  Not done: Kalshi's own price (needs F3/F4), signed-out word search (/api/suggest needs account).
- F2 combo checker · next (needs plan to main first). F6 · after F2.
