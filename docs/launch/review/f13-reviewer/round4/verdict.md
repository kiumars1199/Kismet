# F13 #51 79639df round 4: FAIL
Demo next start of 79639df with UNSUBSCRIBE_SECRET set; signatures computed with the same HMAC. og.txt, og-*.png. Unit lib/share 9/9.
1. "Flagged" is implemented as best.edge > 0, not membership in flags. Fixture: 256 markets with best.edge > 0, 151 flags; 105 positive-edge
   non-flags. 6771258 (not in flags.json, edge 0.0503, side 1) with a valid sig renders the numbers card ("Pays 1.08x", "won over 9 in 10 before")
   and the numbers og:description. /api/share/link signs it as well. Fix: isShareable = store.flagsById.has(id) && side === best.side_index.
2. Passing: flagged 6674492 with valid sig -> numbers card + numbers description; no sig -> teaser. Edge <= 0 (7101594) with valid sig -> teaser image (same bytes as no sig).
Note: in demo mode the /m og:description fallback for 7101594 is the model line (teaser() is false without auth); non-demo uses TEASER_DESCRIPTION.
Note: link route judges isShareable on the user's store, the image on the Free store; can disagree briefly between scans.
CI: web in progress (flake question open); python, supply-chain success.
