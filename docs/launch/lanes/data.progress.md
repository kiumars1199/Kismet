# data progress

## F3 · done, PR open · https://github.com/kiumars1199/Kismet/pull/42 (branch launch/data-f03, 5 commits)
Evidence (full detail in the PR body):
- pytest engine+ops: 153 passed. vitest: 1449 passed (one apply() p95 timing test flaked under parallel load, passes alone 7/7).
- typecheck, lint clean. build + check:js: "/: first-load JS 142.5 kB gzipped; budget 150 kB: OK".
- e2e launch-f03-search.spec.ts: 6 passed (port 3210), 390 and 1440 px.
- perf LOCAL/SYNTHETIC: 207K-row index + real 13,971-market store: rss 343 MB; 20 queries p95 66-85 ms.
- Best bets coverage: sports 832, weather 234, politics 3, crypto/culture/tech/finance/geopolitics 0 (engine tier rule, not an allowlist); "No edge right now" shown.
- Preview URL: none yet (not deployed by me). Production counts check is the reviewer's after merge.
Caveats: topic-map fixture is hand-written (optimistic 95%); ops/upload.py and refresh.yml touched (side file); workflow change untested in CI.
Next: F4 (same event, three venues): send plan to main first (touches lib/types.ts + docs/03 + engine matching).
