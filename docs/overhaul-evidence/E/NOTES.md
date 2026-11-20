# Lane E evidence (T-296): results and the live record

Findings and numbers: `docs/research/live-vs-backtest.md`. Scripts: `scripts/ledger/*.py` (python3, stdlib).

## Screenshots of /track-record
| File | Data |
|---|---|
| `before-track-record-{390x844,1440x900}[-full].png` | `test/fixtures`, page as on `overhaul` 3f92f0a |
| `after-track-record-{390x844,1440x900}[-full].png` | `test/fixtures` (no `ledger_summary.json`, so the live cards show their empty state) |
| `after-realledger-track-record-{390x844,1440x900}[-full].png` | fixtures + the real `live`-branch `backtest.json`, the live ledger re-graded Nov 20 and its summary from the merged `engine/ledger.summarize` (no US rows yet) |

```bash
cd apps/web
DATA_SOURCE=local DATA_DIR=test/fixtures DATA_CLOCK=scan DEMO_MODE=true pnpm build
DATA_SOURCE=local DATA_DIR=test/fixtures DATA_CLOCK=scan DEMO_MODE=true pnpm exec next start -p 3221
node --input-type=module - after < ../../scripts/ledger/shoot.mjs           # Chromium /opt/pw-browsers/chromium
# real-ledger set: same, DATA_DIR=<scratch dir>, port 3222, PW_PORT=3222, prefix after-realledger
```

## What changed on the page
- Three cards up top: **Live on Polymarket US** (first; empty until US rows settle), **Live, every best bet** (each bet
  counted once via `first`), **Testing on past weeks**. One headline number and one sentence each; t-stat, cents per
  share, all logged rows and the full tables are in "Details".
- "Testing on 1 year of past markets" is gone from this page: the span comes from `folds[]` ("from Nov 30, 2025 to
  Nov 14, 2026, 86% of bets in the last 2 weeks"). `lib/proof.testSpan` (folds × days) still says "1 year" on other
  pages: not lane E's file.
- "Enough to compare" is judged on events (test events × (2 ÷ t)²), taken from the US record only: rows logged
  before the US venue have no `event_id`, so `first.events` counts each market as an event (739 for 742 bets).
- Edge section title is computed: "Bets we rated higher did better" only when every edge group of 30+ test bets
  earned more than the one below (true on the fixture, false on production Nov 20: 13.1 / 14.0 / 10.2 / 16.9¢).
- No week was changed: the May week is not a proven data bug.
- Charts stay in `app/track-record/Charts.tsx`.

## Gates
- `pnpm lint`, `pnpm typecheck`: clean. `pnpm test`: 93 files, 676 tests passed (14 new in `components/results/summary.test.ts`).
- `engine`: `python3 -m pytest -q tests`: 77 passed (after merging `overhaul`).
- e2e (`PW_PORT=3220`, `--workers=1`) a11y + proof + s6: 37 passed on the final run; on an earlier run 1 failed (proof.spec drawer
  test, `/` drawer, untouched by lane E), passed on rerun.
