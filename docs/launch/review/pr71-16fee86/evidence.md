# #71 16fee86: Free empty-topics heading + one manifest link
Paid mock, next dev :3309. Logs: p71.log, p71-390.log, p71-delay.log, p71-find.log, curl.log; screenshots *-empty.png / *-after.png.

## F5 heading + button
- The Free sample is random per user, so a topic that empties it was searched for per user (sports.cfb: 6 bets in the topic, none in the sample).
- Free 390 and 1440: h1 "Today's free bets aren't in your topics" + button "Show today's free bets" (44 px). Click -> URL /bets
  (topics, categories and fav cleared), h1 "10 of 34 bets where the odds lean your way", 10 cards. Load CLS 0.003 (1440) / 0.016 (390).
- Pro with the same topic: "6 bets where the odds lean your way", no button. Signed out: /bets -> signup (no topics). Disclaimer present, no horizontal scroll, no cents.
- CLS after the click (layout-shift entries, hadRecentInput excluded):
  - localhost, data back in 0.5-0.75 s: 1440 0.0029 (the 0.765 shift lands inside the 500 ms input window); 390 0.076 (lands at 748 ms).
  - /api/flags delayed 1.5 s (route): 1440 **0.7654**; 390 0.0758.
  - The big shift: heading row collapses (button removed: DIV y245->193, y399->347) and bets-list / locked-bets move when the sample arrives.
  - Baseline: final 2aa61a1, Free 1440, removing any filter pill gives 0.5221 from the same bets-list/locked-bets swap (pr69-ab650a0/final-2aa61a1).
- Copy basis: singular/plural ("pick" / "bets") comes from `total` (bets in the user's topics), not from the size of the free sample.
- A topic with 0 flagged bets: "0 bets where the odds lean your way", no button (total = 0), same for Pro.

## F10 manifest
- /manifest.webmanifest 200, content-type application/manifest+json, cache-control public max-age=3600, name Kismet, 3 icons (all 200 image/png).
- Exactly one <link rel=manifest>, in <head>: SSR on / /pricing /bets /state /login (curl), and in the DOM after hydration on every probed page.
- CDP Page.getAppManifest: no errors. getInstallabilityErrors: only "in-incognito" (Playwright contexts), no manifest/icon errors.
- sw: /sw.js 200 application/javascript; public/ and the push code are untouched by the diff; the SW is still registered by PushToggle only.
- CI web 16fee86: success (job 137620701945).
