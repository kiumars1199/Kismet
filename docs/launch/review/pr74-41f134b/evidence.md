# #74 41f134b: /markets count-line CLS

Setup: paid mock on :3323, with /api/meta delayed 900 ms. Raw results are in p74.log.

| Width | View | Count line (before/after meta) | Lines of text | CLS |
|---|---|---|---|---|
| 390 | all markets | 40/40 px | 2 | 0 |
| 390 | ?ven=kalshi | 40/40 px | 1 (20 px blank) | 0 |
| 768 | all markets | 20/20 px | 1 | 0.014–0.015 |
| 768 | ?ven=kalshi | 20/20 px | 1 | 0.0002 |
| 1440 | all markets | 20/20 px | 1 | 0.014–0.015 |
| 1440 | ?ven=kalshi | 20/20 px | 1 | 0.0006 |

- Rows cover Free, Pro and Premium.
- The 0.014–0.015 at 768 and 1440 comes from the table's TH rows (y unchanged, height 57), not from the count line.
- Signed out: /markets redirects to /signup?next=...
- At 768, the page scrolls sideways: the table is 1294 px wide inside a 768 px viewport. #74 does not touch the table, so this was already there.
- No cents, disclaimer present.
