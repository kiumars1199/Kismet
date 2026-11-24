# T-wt1e: fit-based bet line + small-phone H1 overlap

Files: `apps/web/lib/fit-clamp.ts` (+test), `components/auth/BetLine.tsx`, `components/auth/AuthPage.tsx`, `components/auth/LoginForm.tsx`, `app/layout.tsx`,
`e2e-paid/launch-wt1e.spec.ts`.

1. The line on /signup?next= is now "Sign up for the verdict on: <title>". The title is shown whole when it fits 2 lines in the real box (measured in the browser after
   hydration, again on resize / font load) and is shortened only as far as needed, in this order: filler words (lowercase, no digit) from the middle outward; names and other
   non-digit words; the deciding words (win, above, second ...); then the middle of the text. Numbers and dates survive longest. Before hydration the full title is there,
   clamped to 2 lines. The button text on the page is still "Create account", under the H1 "Create your free account", and the line itself starts with "Sign up".
2. The `-mt-6` that pulled the H1 under the site header at 360x640 is gone: on short screens (max-height 700px) the main padding top is 8 px, the H1 22 px, the bet line 12 px
   and the 18+ box a little tighter instead. H1 top is 79 px, header bottom 69 px (it was 71 vs 69 with the negative margin).
3. Note (not changed): /terms and other prerendered pages stamp `<body data-tier="free">` for everyone, because a prerendered page has no session. It only hides the
   "I placed this" slot, which those pages don't have, so it is harmless.

Evidence in this folder: `red-clamp.txt` (old clamp), `red-h1-overlap.log`, `green-measure.log` (Chromium, real output/flags.json: 2,769 distinct titles).
Real titles through the real box: 360: 23 shortened (0.8%), 0 over 2 lines, 0 clashes; 390: 22, 0, 0; 1440: 20, 0, 0.
