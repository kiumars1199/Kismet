# F14 #53 head 05e7f98 (stacked on F4 da59363; local next start, fixtures, DEMO_MODE=true)
- pytest engine/tests 149 passed; typecheck, lint OK; vitest lib/history + history-route 10/10; build OK; check:js / 142.5 kB; /m/[id] 180.1 kB (same as F4: Recharts is lazy).
- e2e launch-f14-history 4/4 (e2e.log).
- probe.log: CLS /m/6674492 (chart) 0.003 @390, 0.002 @1440; drawer 0.003 / 0.011; /m/7078474 (no history) 0.188 @390, 0.108 @1440.
  Attribution (probe.log, delay 0 and 1500 ms): one shift 0.185 at 390 whose source is the history-empty div (h-[200px] flex items-center).
- Screenshots {390,1440}-{m-history,m-empty,drawer-history}.png.
- engine/history.py: one series per FLAG row only (docstring + PR body), so unflagged markets always show "No price history yet".
- PR body size: 280 series 232 KB / 85 KB gz at fixture scale, x10 extrapolated (~2.3 MB / 0.85 MB gz); not measured on a live run.
