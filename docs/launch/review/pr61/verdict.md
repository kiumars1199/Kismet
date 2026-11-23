# #61 2da4dab: FAIL (CI only), product PASS
- Unit tests: components/onboarding 5/5. Build OK. e2e tour-drawer 2/2 (local).
- Probe (probe.txt), demo build, at 390 and 1440:
  - /bets?m=<id> with the flag set: the drawer is open and focused, no tour shows, and the flag is kept.
  - Escape closes the drawer, then the tour appears at "1 of 5".
  - Skip tour clears the flag, and the tour stays gone after a reload.
  - Without the drawer, /bets starts the tour normally at "1 of 5".
- CI web failed (job log pr61-ci.log): e2e-paid qa-c-billing net::ERR_ABORTED on /account after next dev ECONNRESETs. #61 touches only Tour, and final 67cab85 web is green.
- Note: the MutationObserver watches body/subtree on every page for every user, even when no tour is pending. Gate it on step !== null.
- Note (pre-existing): focus is not moved to the tour's Next button. After the drawer closes it returns to the card link, and on a normal start it stays on body.
