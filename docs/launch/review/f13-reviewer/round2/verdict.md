# F13 #51 f1b08ce (round 2): FAIL on CI only

The product checks pass. A green CI re-run makes this PASS with notes.

## CI
- The web job is red. One e2e-paid test (t291-plans) got ECONNRESET right after the dev server logged "approaching the used memory threshold, restarting".
- The same suite passed locally: t291-plans + launch-f13-invite 4/4.
- The demo e2e in CI was 156/156. Final 34f672f is green, so the rule says FAIL until a re-run.

## Local checks (E2E mock, next dev, port 3291)
- typecheck and lint pass; vitest 1538/1538.
- Round-1 items:
  - /api/og/bet is public: 200 image/png signed out, and 404 for an unknown id.
  - og:image and twitter:image on /m/<id> are the absolute /api/og/bet/<id> URL.
  - Twitterbot, facebookexternalhit, Slackbot and Discordbot get 200. GPTBot and ClaudeBot get 403.
  - robots allows /api/og/.
  - Pending invites are promoted on the next sign-in once confirmed (unit).
  - The reward is deferred, not lost (SQL tests: trial, paid Premium, open-ended comp).
  - The OG figures come from betFigures on the Free-banded market.
  - ?ref= is on Copy link for Free, Pro and Premium at 390 and 1440, and the me_invite cookie is set from /m/<id>?ref=.
  - A bad code or a cross-origin POST sets no cookie.
- The share sheet has no cents and no horizontal scroll at either width.

## Findings
1. MEDIUM, owner decision: the public route serves model output for any market id. The banded chance and payout come back for every id, with no rate limit and no account, which bypasses T-276 ("teasers carry no model output") and Free's 10-a-day quota, though only as an image. Signed out, og:description still says "Sign up free to see it" while the image shows the numbers. Option: sign the share URL (an HMAC of id+side) so only links people actually shared render numbers, and give unsigned requests the teaser card.
2. LOW, OG wording "wins about 8 in 10 · won 80% before" says one figure twice; "won 80% before" has no subject. Suggest one line, e.g. "Bets like this won about 8 in 10 before". "Pays" wraps above "1.49x" because the chance text takes the row. A Pro sharer's image says 8–9 in 10 / 85% while their drawer says 9 in 10 / 90% (Free band by design; the PR's "never disagrees" holds for Free only).
3. LOW (round-1 #6b still open): the sheet shares the drawer's open side, so a "Not recommended" side gets the same green "Pays 2.93x" card (6674492 side 1, wins about 1 in 20). The link preview (og:image without side) then shows the best side, which differs from the shared image.
4. LOW: the deferred reward is re-asked only on a fresh sign-in (finishSignIn). A user whose trial lapses while they stay signed in waits until the next sign-in. A Stripe subscription-ended hook would close this gap.
5. Pre-existing, not F13: at 390 on /bets?m=<id> with the tour flag set, the tour dialog sits behind the modal drawer and can't be dismissed.
