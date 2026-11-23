# #62 70d8f6b: PASS with notes
Demo next start of 70d8f6b, fresh browser per load, 8 loads each (cls-70d8f6b.log); CSS 200.
/event/1335826: 390 0.003-0.004, 1440 0.009-0.039. /m/7078474: 390 0.010-0.012, 1440 0.006-0.010. /m/6674492: 390 0.011-0.012, 1440 0.006-0.010.
No 0.432 footer swap in 48 loads (before: 0.432 in about 30-50% of loads at 390).
Skeleton (JS off, so the streamed fallback stays): muted low-contrast blocks, no oversized grey flash; /m 358x844 at 390, /event 358x902; footer below the fold.
After load: footer present with the disclaimer, no skeleton left, no hscroll, at 390 and 1440. CI green.
Notes: 1) without JS the page stays on the skeleton (content is in the hidden streamed chunk), same as before with an empty main.
2) /event at 1440 is shorter than the 900 px skeleton, so the footer moves up from 1012 to 763 on arrival; it's below the fold, which is why it measures 0.01-0.04.
3) Conflicts with F14 59831df in app/m/[id]/page.tsx (same lines).
