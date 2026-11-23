# PR #68 a9974f1 (fix/f12-digest-test, tests only) — reviewer
Verdict: PASS (code review + my own mutations; no UI).
- Diff: lib/email/digest.test.ts only (+63/-2). The `if (found)` guard is gone: the test now asserts bets.length > 0 and checks every returned bet's
  pays against betFigures() on the same market/side.
- New tests: Free bets = that user's daily sample (min(5, sample size), no duplicates); paid = exactly 5 with >5 eligible single-bet games;
  Free reads the Free store (fixture where live and Free stores differ, clock pinned); unknown topic -> [] for Free and paid.
- Baseline 20/20. My mutations of lib/email/digest-bets.ts (each run separately, file restored after):
  M1 Free reads stores.live -> 1 fail; M2 cap 6 (page_size+slice) -> 4 fail; M3 no slice -> 3 fail; M4 topics ignored -> 1 fail;
  M5 wrong Free sample key -> 1 fail; M6 Free treated as paid -> 1 fail. 6/6 caught.
- Note: the empty-topic test checks digestBets() returns []; "no email is sent" for an empty list is covered by the existing runDigest test (skipped_no_bets: 1).
