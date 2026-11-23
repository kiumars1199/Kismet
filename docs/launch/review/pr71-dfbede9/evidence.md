# #71 r3 at dfbede9: PASS with notes
Diff from 561b0d2: a merge of final (aad8475) plus dfbede9.
- Product change (BestBets.tsx): shortSample = sample && rows < free_daily. It gets min-h-[100svh], and the upsell and locked card are pinned with mt-auto.
- Spec change: /api/flags answers are shaped by the test (empty for t=, the first 3 rows for val=1), so the test no longer depends on the day's sample.
Probe (paid mock :3340; p71g.mjs, logs p71g-few3.log and p71g-few1.log). /api/flags is delayed 1.5 s and the URL is changed with pushState (no input, so every shift counts).
CLS (390 / 1440):
- all->few: 0.019 / 0.049–0.053
- few->all: 0.017 / 0.036
- few->empty: 0.001 / 0.026
- empty->few: 0.001 / 0.0001
- all->few, scrolled to the list: 0.159 / 0.028–0.035. Cause (p71h.log): the filter-pill row ("Tested on past data | Clear all", 44 px plus gap) is inserted above the list when the URL gains a filter. A real user adds filters from the controls at the top, so the pill appears within the input window (hadRecentInput), and the user is at the top anyway. Only a no-input pushState while scrolled scores it. The same mechanism explains the earlier 0.149 flake; the spec now scrolls to the top.
Blank stretch between the last card and the pinned upsell:
- 390: 16 px (3 cards) and 37 px (1 card). Not visible as a gap.
- 1440: 231 px (3 cards) and 242 px (1 card). The cards fill 1 to 3 of the 4 grid columns, then there's about 240 px of space, then "Track your bets with Pro" and the locked card ("Unlock 33 more bets"), then the footer.
Judgement as a first-time Free user on a quiet day: it reads as the end of a short list, then the upsell. It does not look broken. Screenshots: few1/1440-all-_few-full.png, few3/1440-all-_few-fold.png.
The empty case (0 rows) at 1440 still has the large (~800 px) reserved area, judged earlier: the heading and the "Show today's free bets" button explain it above the fold.
