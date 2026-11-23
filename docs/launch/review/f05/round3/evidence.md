# F5 #47 round 3 (head 9b07e14): FAIL

Head 9b07e14 confirmed by fetch. Branch still doesn't contain final 651462b (merge-base check fails).
Checks: typecheck, lint OK (on this head, after clearing a stale .next).

## PR's own paid spec (e2e-paid.log, e2e-paid-rerun.log)
- Run 1: 3 passed, 2 failed. "picks ... at 1440px" failed with "page crashed" (box memory; it passed on the rerun).
- The new test "topics cleared elsewhere ...; sign-out drops the hint ..." failed on both runs at line 175:
  after Sign out, `me_topics` is still set, value `<uid>|on:` with a fresh 15-minute expiry. So something rewrote it after the sign-out response deleted it.

## Probe: a returning user after the 15-minute hint is gone (run/f05r3.spec.ts, probe2.log, screenshots)
User picks NFL and skips setup. Then no Kismet tab is open (about:blank) and `me_topics` is cleared, as it would be the next day; session cookies are kept.
- GET /bets → 200 (no redirect); GET / → 200.
- First document: url /bets, "Your topics" pill count 0; after networkidle still /bets, pill 0 (390-bets-after-hint-expired.png, 1440-...).
- Only the second load redirects (307 to /bets?fav=1&t=sports.nfl), because /api/me on the first page rewrote the hint.
(probe.log, the first run, looked filtered only because the onboarding tab was still polling /api/me in the background.)

## Findings
1. Done-when 1 regresses: with a 15-minute hint, a user who comes back after 15 minutes (the normal case: next day) gets an unfiltered / and /bets on the first load, with no pill. Their topics apply only from the second page view. Round 2 opened filtered on every later visit. The stated limit (one stale redirect) is fine. The opposite case (no redirect at all after 15 minutes) is not.
   Possible fix: keep a long-lived hint but validate it. Rewrite it on every /api/me (done), bind it to the uid (done), and clear it on sign-out (fix 2). Then the only staleness is the documented one stale redirect after a change on another device.
2. The PR's own new test fails 2/2: the hint survives sign-out (rewritten with the user's id after the delete). Likely a request still in flight from the signed-in page (/api/me) lands after the sign-out response.
