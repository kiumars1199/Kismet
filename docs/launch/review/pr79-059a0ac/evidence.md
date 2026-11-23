# #79 at 059a0ac: walk-through 1 onboarding fixes
Setup:
- Worktree based on final a7c3ae5.
- vitest test/teaser.test.ts: 13 passed.
- Paid e2e launch-walk1-shared-bet (PW_PORT 3333): 3/3 passed.
- Own probe p79.mjs on the paid mock, next dev :3334, signed out, 390 and 1440. Log: p79.log.

## /m teaser (6674492, 7077573, 7078474)
- CLS is 0 at both widths for all three, with no shift entries. (Home measured 0.0024 at 390 and 0.0138 at 1440, for reference.)
- The copy reads "Free accounts get 10 best bets a day".
- Subtitle dedupe works:
  - 7077573: "Miami (OH) vs. Kent State" is hidden under "Miami (OH) vs. Kent State: 1H Moneyline".
  - 7078474: hidden.
  - 6674492: "Denmark vs. Norway - More Markets" stays (it is not a prefix of the title).
- The price line shows side 0 only, in the "<outcome>: 68% priced by the market" form ("Yes: 68%", "Miami (OH): 71%", "Ball State: 32%"). It does not reveal which side Kismet flags.
- The closes line reads "Closed · Nov 17, 2026, 2:45 PM EST". The fixture markets are all closed against the real clock, so the "Closes in X" path was not seen here; vitest covers it.
- The locked row reads "🔒 Kismet's verdict: sign up to unlock it."
- No model output: no "x" multiplier, "Pays", edge, win chance or pts. No cents. Disclaimer present. No sideways scroll. No page errors.

## /signup
| URL | Result |
|---|---|
| next=/m/6674492 | "Sign up to see Kismet's verdict on Denmark vs. Norway: Both Teams to Score." |
| same, plus &title=EVIL TITLE | Same line from the store; "EVIL" is not on the page |
| next=/m/nope-nope | No bet line |
| next=/bets | No bet line |
| next=//evil.example/m/6674492 | No bet line |
- Soft navigation from the teaser CTA shows the bet line and hides the header Sign up.
- Going back to /m brings the header Sign up back.

## Header
- No "Sign up" in the header on /signup or /login, at both widths.
- Header "Sign up" is present on / and /m.
