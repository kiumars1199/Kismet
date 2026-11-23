# #80 d21a714: PASS with notes
Paid mock :3341 from wt80 (p80.log, p80b.log). Base comparison: final + #82 on :3338 (base/p80-base.log).
Plans checked: out, Free and Pro at 390 and 1440.
- /pricing: the Free plan heading is at y=443 (signed out) or 499 (signed in) at 390, inside the 844 first screen. At 1440 the plans are at y=402.
  The stats sit in a closed <details> "How it did in testing" (a 44 px summary). When opened, it shows the test sentence and basis.
- Free copy: "10 of today's best bets, picked at random each day" on the plan card and in the comparison table. No "chosen at random" on /pricing or /.
- CLS: /pricing at most 0.0006; / is 0.0024 (390) and 0.0138 (1440); /account at most 0.0011. No sideways scroll, disclaimer present, no cents, no page errors.
- HelpLine links are now 44 px tall; widths are 101, 62 and 44 ("source" is padded 2.5 px each side). Line height is unchanged (16 px footer, 20 px /account).
  - /account at 390: 4 lines and 80 px, the same as base. Looks the same.
  - Footer at 390: 4 lines (60 px) vs 3 lines (48 px) on base. "chat online" is inline-flex now, so it can't wrap mid-link and moves to the next line. The source link shows as "source ," with a visible gap before the comma.
- LockedBets still says "Free shows 10 Best bets a day, chosen at random, with delayed prices." (LockedBets.tsx:27).
