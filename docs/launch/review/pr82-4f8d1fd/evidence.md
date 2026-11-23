# #82 4f8d1fd (diff from ce71c04): PASS
The diff is text-only.
- cleanEventLine moved to lib/format.ts; teaser re-exports it.
- It is applied to: the signed-in /event <title>, the EventView breadcrumb and h1, the /m breadcrumb event crumb, and the MarketDetail drawer event link.
- No className or markup changes. New unit test: test/event-name-clean.test.ts.
Pro at 390 on the paid mock :3338 (p82b.log, p82c.log):
- /m/6674492 and /m/6654452: the crumbs read "... > Denmark vs. Norway > <question>" and "... > Singapore vs. Brazil > ...". No "More Markets" anywhere. CLS 0.
- /event/1313371: title "Denmark vs. Norway · Kismet", h1 "Denmark vs. Norway", crumb cleaned. CLS 0.
- MarketDetail drawer (?m= on /markets and /bets): the event link is a single line (20 px, the same 19.5 px line height) with text cleaned. Drawer CLS 0.
- No sideways scroll, disclaimer present, no cents.
