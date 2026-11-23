# F5 #47 round 2: head 2325297 (unchanged after fetch)

## Checks
- typecheck, lint: pass. vitest filters: 10/10 (checks.log)
- e2e-paid launch-f05-topics.spec.ts: 4/4 (e2e-paid.log). Screenshots: ../{390,1440}-{1-pick-topics,2-bets-filtered,3-cleared}.png
- CLS on the onboarding landing: 0.0512 at 390, 0.0172 at 1440. On /bets: 0.0507 at 390, 0.0172 at 1440. Under 0.1.
- The round-1 findings are fixed: the real 307 is asserted, SHOTS is repo-relative, and CLS is under 0.1.

## Done when
1. NFL + Politics, then `/` and `/bets` open filtered with the pill: MET (spec).
2. Skip gives unfiltered views, and topics can be edited in /settings: MET (spec; new user B after skip: cookie `on:`, /bets 200, pill count 0).
3. Same flag set for any user with the same filter: MET (unit).

## Findings
1. MEDIUM. The topics cookie goes stale across devices (cookie-probe.log, device1-still-filtered-after-clear-elsewhere.png).
   Steps: user A on device 1 picks NFL, giving cookie `on:sports.nfl`. A signs in on device 2 and clears the pill, so device 2's cookie becomes `off:sports.nfl`.
   Result: device 1 still has `on:sports.nfl`, and /bets still returns 307 to `/bets?fav=1&t=sports.nfl`.
   Cause: middleware decides from the `me_topics` cookie (1-year max-age), and `/api/me` writes it only when it is absent.
   A filter the user turned off keeps applying on their other devices for up to a year.
   This undoes the round-1 "stays cleared on a second device" behaviour, and that test is no longer in the spec.
2. LOW, from reading the code (not reproduced). `/api/auth/signout` does not clear `me_topics` (signout 303; the cookie after is still `on:sports.nfl`).
   The cookie isn't tied to a user. A new account resets it on onboarding (verified), but an existing user B signing in on the same browser would get user A's filter, because `/api/me` only writes the cookie when it is absent.
   Fix for both: clear the cookie on sign-out and always refresh it from the profile in /api/me, or store the uid in the cookie.

## Note
- The branch is not merged with current final (its parent is 4a93a49; F3, F7 and F8 are not in it).
