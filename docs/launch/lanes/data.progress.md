# data progress

Update after every task: task · status · evidence (commands + last output lines, PR, preview URL) · next step.

## F3 (in progress, branch launch/data-f03, plan approved by main)
Done and committed (3 commits):
- engine/kalshi_topics.py + test (152 pytest pass; fixture of 122 series, taxonomy_ids.json synced by test/taxonomy-ids.test.ts)
- kalshi_index.json side file (every open market, columnar), uploaded via ops/upload.py SIDE_FILES + refresh.yml line
- web: lib/data/kalshi-index.ts, store getKalshiIndex, `venue` filter key `ven`, /api/markets venue/topic, /api/meta counts.{polymarket,kalshi}
- vitest: filters round trip incl. venue, kalshi-search (13 tests); full vitest run: all pass except the one updated kalshi.test.ts expectation (fixed)
Todo: /markets UI (venue chip + Kalshi rows, "No price yet"), BestBets empty state "No edge right now" (own commit), Best-bets category coverage list, e2e launch-f03-search, perf numbers (local/synthetic), lint/build/check:js, PR.
