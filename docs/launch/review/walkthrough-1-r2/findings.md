# Walk-through 1 re-walk (r2)

UPDATE: re-walked on final 6da7905 (folder 6da7905/) and on 73e7d67 (folder 73e7d67/), which is the verdict below. The top-level files are from the first pass on 053b671.

## Final verdict on 73e7d67
Every STATUS item is still fixed. CLS is 0 everywhere, the disclaimer is on every page, and no cents, no sideways scroll, no jargon and no personal picks were found, at 360/375/390/1440 for both ids. The new teaser "Check this bet" / "Add to combo checker" links are 44 px. Sign up free and Create account clear the tab bar. The /signup BetLine after #121 is 2 lines, not clipped and not over width, and "between" is kept in the DICK'S line.

Problems:
- [nit] On /pricing, the inline "account page" link is 91x17 (inline text, so WCAG 2.5.8 exempts it).
- [nit] (watch) One React #418 (args HTML) pageerror appeared once, on 6da7905, in the first walk after a fresh `next start` (360, id 6596313; the step was not recorded). It did not come back in the 180 warm loads (/m, /signup, /state x20 at 360/390/1440), the 9 cold-start first loads, the 8 full walks on 73e7d67, or the 4 cold-start walks at 360 (6da7905/run.out, 6da7905/hydration-20x.log, 73e7d67/*). There is no reproduction, so there is no fix to point at.

Verdict: PASS. No blockers and no should-fix.

---
# First pass: final 053b671, local `next build && next start`, E2E_MOCK=1, E2E_PROD_BUILD=1, live data from output/ (port 3755)

Path: TikTok deep link /m/<id>?ref=abcd1234 (ids 6596313, 5730354) -> teaser -> "Sign up free" -> /signup -> /state?next= -> /pricing -> back.
Widths: 360x640, 375x667, 390x844 (iPhone 13, touch), 1440x900. Evidence: walk.log, *-fold.png / *-full.png, hydration-20x.log, targets-tabs.log, back-debug.log.

## Items from the STATUS "Walk-through 1" Problems list
- /m subtitle dedupe: FIXED. The subtitle shows only "Closes in 2 days · Nov 26, 2026, 11:59 PM EST"; the event near-duplicate no longer appears (both ids).
- "Sign up free" clears the tab bar: FIXED. The CTA sits above the tab-bar top (583/610/787 px at 360/375/390), and elementFromPoint lands on the CTA.
- Hydration #418: FIXED. /m, /signup and /state were each loaded 20 times at 390 (iPhone) and at 1440: 0 console errors, 0 page errors, 0 #418.
- "2026?." double punctuation: FIXED. The text reads "...November 26, 2026?".
- "Create account" clears the tab bar: FIXED. The button sits at 525-573 (360/375) and 550-598 (390), and the hit test lands on the button.
- Teaser copy: FIXED. "Market price: Yes 83%" / "Yes 41%".
- /state h1: FIXED. It reads "Your state".
- Active Sign up tab: FIXED. The bottom-nav "Sign up" has aria-current=page and the accent style; the header shows only Kismet + Log in.
- Tap targets >=44 px: FIXED for every control in the path. The Google button and nav items are 44 px; the 18+ checkbox is 20x20 but its label is 358x54.

## New checks
- CLS: 0.000 at every step and width (limit 0.02).
- The disclaimer is on every page. No cents, no sideways scroll, no jargon and no personalized picks were found. Back from /pricing returns to /state.
- Bet title on /signup after #119: 2 lines at 360-390, not clipped, not over width (checked on both a short and a long real title).

## Problems
- [nit] On /pricing, the inline "account page" link (href /account) is 91x17 at every width. It sits inside a sentence far down the page, so WCAG 2.5.8 exempts it as an inline link. Optional: add padding or a block-level link.

Verdict: PASS. No blockers and no should-fix; one optional nit.

Caveats (setup artifacts, not app issues):
- This was a local production build with the e2e mock, not kismetodds.com. Browser checks against prod are denied from this container.
- The header says "Updated 7 days ago · data may be stale" because output/ was scanned Nov 17.
- counts/top/venues come from fixtures.
- Google sign-in was checked for visibility only; it was not exercised.
