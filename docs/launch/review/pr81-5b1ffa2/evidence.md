# #81 5b1ffa2 (same tree as 080398e): FAIL
Paid mock :3342 from wt81 (p81.log, p81b.log). Free, Pro, and Pro with columns turned on, at 768/1024/1280/1366/1440/1920.
Default columns (Free and Pro) pass:
- At 1280/1366/1440/1920 the table fits its box (1214/1300/1374/1598 px). The page never scrolls sideways.
- The header sticks at top 64 after scrolling 700 px. The fade is display:none.
- At 768/1024 the fade shows (data-on true, opacity 1), hides at the scroll end (data-on false, opacity 0), and comes back at scrollLeft 0. CLS is at most 0.027.
Pro with extra columns fails:
- All 21 columns on (table 2173–2234 px): at 1280/1366/1440/1920 the box is overflow visible, so the whole page scrolls sideways (scrollWidth 2267/2206/2267/2334 vs viewport). There is no fade (it is xl:hidden), although data-on is "true".
- One extra column on at 1280: table 1272 px in a 1214 px box. The page scrolls sideways (scrollWidth 1305–1316 vs 1280).
- At 768/1024 with all columns, the table scrolls inside its box correctly, but the header does not stick (expected below xl).
- Before #81 (a98ee96) this page overflow happened only from 1440 up. #81 extends it to 1280/1366.
Suggested fix: make overflow-visible conditional on the table fitting. `more` already detects the overflow (it stays true under overflow-visible, so there is no flip-flop). Use className `more ? "overflow-x-auto" : "overflow-x-auto xl:overflow-visible"` and show the fade at xl when `more`. Add a spec: a Pro user with all columns at 1280 and 1440 has scrollWidth == innerWidth.
