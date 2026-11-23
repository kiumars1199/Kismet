# F11 #58 989acfa: conflict check (merge of final ac1b517 into 2ec06f2)
- Merge parents: 2ec06f2 (F11 r3) + ac1b517 (final). `git show --remerge-diff`: one conflict, CheckClient.tsx (imports + the bet section).
  Resolution keeps both: LogBetButton import and render (above), HowToBet import and render (below). Dropped only F11's own
  `<p>Bet only what you can afford to lose.</p>`; final had already replaced that paragraph with HowToBet, so this matches final.
- `git diff ac1b517 989acfa -- apps/web`: 13 files, all F11's (CheckClient +5 is the LogBetButton block; JournalView, LogBetButton(+test),
  BetCard +2, BestBets +2, launch-f11-log.spec, journal*.ts, schemas/types, settle-one.test). Nothing of final removed. Plus F11's migration + rls test.
- `git merge-tree` against current final df105f8: clean. PR mergeable_state: unstable (CI running), no longer dirty.
- Runtime (paid mock, next dev :3310), /check?m=<first card>&side=0, signed out / Free / Pro x 390 / 1440: check-merge.log
  - before a venue is picked: 0 afford notes; after picking a venue in How to bet: exactly 1, 56 px under "Open on Polymarket" (the deep link).
  - Pro: log-bet ("I placed this") present above the guide; Free/out: none on /check.
  - 3 steps, avail line, disclaimer present, no horizontal scroll, no cents.
