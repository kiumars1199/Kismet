# F13 #51 round 3, 4c3d82a (draft; waiting on CI web)
- vitest lib/share + og-bet + account-wall 27/27; tsc 0 (fresh install); eslint on the touched dirs clean.
- Probe (probe.txt): signed-out /api/share/link returns 401. Signed in, it returns /m/<id>?ref=<code>&s=<side>&sig=<22>.
  - og: a valid sig gives the numbers image (~48 KB). Unsigned, unsigned+side, forged, other-side and the old ?side= all give a teaser that is byte-identical to the unsigned one.
  - /m og:description: a valid sig gives "Pays X · Bets like this won about N in 10 before."; every other case gives TEASER_DESCRIPTION; og:image and twitter:image match.
- Sheet at 390 and 1440 for Free, Pro and Premium: drawer opened on side 0 ("Not recommended"), yet the sheet shared side 1, the recommended one. No horizontal scroll.
- Note: markets whose best side has edge <= 0 (245/501 in fixtures) still get a signed numbers card for the best side. The drawer never labels the best side "Not recommended", so this matches the claim; the owner can choose a teaser for non-flags.
- Note: the HMAC key is derived from UNSUBSCRIBE_SECRET with domain separation; rotating that secret also kills old share previews (they fall back to the teaser). No expiry on sigs.

## CI web: failure (job 137520666681)
- vitest 1544/1544 and e2e 156 passed. e2e-paid: 49 passed, 1 failed.
- The failure is t291-plans.spec.ts:5, `apiRequestContext.get: read ECONNRESET`, right after the dev server logged "approaching the used memory threshold, restarting".
- This is the same test and the same mechanism as round 2 (f1b08ce).
- final 34f672f web: success. final 5a65227 web: cancelled.
- Verdict: FAIL (CI only). The failure reproduced twice on this branch and never on final.
