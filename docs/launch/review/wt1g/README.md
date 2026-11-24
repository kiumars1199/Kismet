# T-wt1g: inflected direction words in fit-clamp

From reviewer 2's r3 follow-ups (all pre-existing on final; none hit a real title).
Tests first: `vitest-red.log` (3 failures at budgets 86/98/110), then `vitest-green.log` (22 of 22).

- KEEP adds beats, loses, lost, won, leads, lead, trails, trail, last, latest, earliest (wins, beat, lose, second, third were already kept). "Trail Blazers" is capitalised so it was always kept: no new clash.
- "to" after "up" is kept ("up to 285", not "up ... 285").
- New SIBLINGS pairs (unit at 86/98/110, browser at 360/390/1440): beat vs lose to, beats vs loses to, wins vs loses, won vs lost, lead vs trail, first vs last, 1st vs last, first vs second, second vs third, earliest vs latest, up to vs at least, up to vs exact.
- Browser spec `e2e-paid/launch-wt1e.spec.ts`: 12 of 12 (`browser-measure.log`); real titles 360: 23 shortened, 390: 22, 1440: 20; 0 over 2 lines, 0 clashes (same counts as before).
- Reviewer 2's r2 and r3 scripts (9 candidate sets incl. the 2,769 real titles, 389 swapped pairs, 27-pair break set, long shapes, the r3 "new" set of 16 pairs) re-run on this code in a real browser at 360/390/1440: over 2 lines 0, over width 0, clashes 0, direction words lost 0, same visible line 0 (`reviewer-scripts-r2-r3.log`).
- City dropped before direction words at tight widths: measured, no real title clashes at any width.
