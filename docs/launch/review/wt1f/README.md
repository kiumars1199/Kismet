# T-wt1f: keep direction words when shortening titles

Bug (reviewer): lib/fit-clamp.ts could drop the word that says which way a rate moves: "Will the Bank of Israel decrease the Bank of Israel Interest Rate by 25 bps at the November
meeting?" became "Will the Bank of Israel … Bank … Israel Interest Rate … 25 … at the November meeting?", identical to its "increase" sibling at 360, 390 and 1440.

Fix (`apps/web/lib/fit-clamp.ts`): (0) a word that already appeared earlier in the title (the second "Bank of Israel") is dropped before any distinct word; (1) the kept words now include
increase, decrease, hike, cut, raise, lower, no, not, change, yes (with above, below, over, under, more, less, before, after, win, lose ...), which survive like numbers do.

Tests first (red before, 9 failing): `lib/fit-clamp.test.ts` direction words at budgets 86, 98, 110: siblings differ, a repeated phrase goes before 'decrease', and every real title with a
direction word differs from its opposite; the real flags.json no-clash tests stay green (21 of 21). `e2e-paid/launch-wt1e.spec.ts`: the same siblings in the real box at 360, 390, 1440.

Real-title browser measure (2,769 distinct titles in output/flags.json), `browser-measure.log`: 360: 23 shortened (0.8%), 0 over 2 lines, 0 clashes; 390: 22, 0, 0; 1440: 20, 0, 0 (before: 23, 22, 20).

## Review 2 (sibling thresholds)
Failing before: "29°C or higher" vs plain "29°C" (Rio de Janeiro), highest vs lowest temperature, "fewer than 225,000" vs "at 225,000" showed the same shortened line.
Fix: kept words now also include higher, highest, lowest, fewer, greater, up, down, rise, fall, exceed, exactly, gain, and an "or" right before a kept word stays with it ("or higher", "or below").
Tests first (red: 3 failing at budgets 86, 98, 110): `lib/fit-clamp.test.ts` sibling pairs (or higher vs exact, or below vs exact, highest vs lowest, fewer/greater vs at, rise vs fall, exceed vs exactly);
`e2e-paid/launch-wt1e.spec.ts` the same pairs in the real box at 360, 390, 1440. The fit now also requires the line to be no wider than its box.
Real-title measure re-run (2,769 distinct titles): 360: 23 shortened, 0 over 2 lines or over width, 0 clashes; 390: 22, 0, 0; 1440: 20, 0, 0. See `browser-measure.log`.
Note: "highest" is a deciding word now, so for a "highest temperature in <city>" title the city and the range are shortened later than before only if the line has room; the test for it uses a budget of 84.

## Review 3 (break-it set)

Reviewer 2 found pre-existing gaps. Tests first (red: `vitest-r3-red.log`, 3 failures at budgets 86/98/110), then green (`vitest-r3-green.log`, 21 of 21).
- KEEP adds reach, dip, drop, hit, bottom, fewest, outside, between, minimum, maximum, min, max, positive, negative, weekend, weekday.
- Small joining words are kept with the word after them: "or" + a deciding word, "at" + least/most, and by/in/on + a month or weekday ("by November 30" vs "on November 30", "by December 2026" vs "in December 2026").
- Pairs added to SIBLINGS (unit at 86/98/110, browser at 360/390/1440): top/bottom, reach/dip to, drop to/hit, between/outside, minimum/maximum, min/max, positive/negative, by/on date, by/in month, at least vs exact and vs at most, fewest/most, weekend/weekday.
- One older test premise moved (budget 84 to 92) because "between" is now kept with the city.
- Browser e2e (`browser-measure-r3-full.log`): 12 of 12; real titles 360: 23 shortened, 390: 22, 1440: 20; 0 over 2 lines, 0 clashes.
- Reviewer 2's scripts re-run on this code (`break-set-r3-measure.log`): real 2,769 titles at 360/390/1440: shortened 23/22/20, over 2 lines 0, over width 0, clashes 0, direction words lost 0, 389 swapped pairs same line 0; the 27-pair break set: same line 0; long shapes: 0.
