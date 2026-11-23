# #82 168ca05 (fixes for #79 notes): PASS with one note
Run: paid mock (signed out) on :3338 from wt82, probe p82.mjs (log p82.log), 390x844 and 1440x900.
(a) Header: /login -> Sign up only (hdrSignup=1, hdrLogin=0); /signup (all next= variants) -> Log in only (0/1). Same after soft nav teaser -> /signup -> /login. / and /m show both.
(b) " - More Markets" stripped: 6654452 shows "Singapore vs. Brazil", 6674167 "RCD Mallorca vs. FC Barcelona", 6674473 "Denmark vs. Norway". 6674492 (title "Denmark vs. Norway: Both Teams to Score") hides the event line (dedupe).
CLS: /m 0 at both widths, /signup and /login 0, / 0.0024 (390) and 0.0138 (1440). No page errors, no sideways scroll, disclaimer present, no cents, no model numbers.
signup-bet: names the bet; a forged title is ignored; unknown id, next=/bets and //evil show nothing.
Note: /event/1313371 teaser h1 and <title> still read "Denmark vs. Norway - More Markets" (eventTeaser uses raw ms[0].event). Outside the /m ask; apply cleanEventLine there too.
CI at review time: python, supply-chain, Vercel OK; web in progress.
