# F16 #57 e3287b0: FAIL
Head unchanged (e3287b0), mergeable clean, CI web/python/supply-chain green. Stacked on #56 3234b82 (migration 000600 after 000500).
Unit: alerts-bigtrade + security + alerts* 49/49 (wtf01b at e3287b0).
UI (next dev, E2E mock, probe.log, *.png): Big trade kind shown only to Premium at 390 and 1440; Free/Pro editors list 5 kinds; Premium creates a
big_trade rule and the list shows "When one trade of $10,000 or more hits ...". No horizontal scroll; disclaimer on every page. Signed out /alerts -> /signup.
Source doc fetched (polymarket-list-trades-doc.md): URL, event_id <= 20, filter_type CASH, taker_only, size=shares, price=USDC all match lib/bigtrade.ts.
1. "within one scan" not met: scans run every 30 min (refresh.yml), the evaluator runs once a day (vercel.json 0 13 * * *), nothing POSTs
   /api/alerts/run after a scan. Worst case ~24 h. No decisions.md entry. Fix: a decision entry, or a post-scan trigger.
2. Not verified live: data-api.polymarket.com is proxy-blocked here too. The doc does not state the sort direction of the event_id feed, which serves a
   fixed 3-year window. The code reads one page of 200 and keeps ts >= now-25h; if the feed is oldest first, the rule never fires on an old event.
3. Followed US-venue markets have event_id "us:<id>" (types.ts); that value goes into the same event_id chunk. If the API rejects it with 400, the
   whole chunk throws and the rule sends nothing that run. Fix: send only Polymarket (non-"us:") event ids.
4. Minor: no cap on hits per rule (other kinds slice 10); a global rule plus a per-market rule on the same market alert twice for one trade.
