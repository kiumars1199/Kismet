# Walk-through 1 dry run: TikTok first-time visitor, prod a7c3ae5, signed out
Path: /m/6596313?ref=abcd1234 (referer tiktok.com; the og card was checked earlier: teaser PNG 1200x630), then "Sign up free", then /, /pricing, /signup (stopped at the form).
Widths: 390 (iPhone 13 profile, touch) and 1440. Logs: wt1.log, wt1b.log. Screenshots: <width>-<step>-{fold,full}.png, 390-1b-m-bottom.png, 390-2b-m-inpage-cta-fold.png.

## What works
- The og/twitter cards are right: summary_large_image, the bet title, "Sign up free to see it", the disclaimer.
- ?ref=abcd1234 is POSTed to /api/invite/ref, and me_invite is set (HttpOnly).
- The in-page "Sign up free" goes to /signup with hidden next=/m/6596313, so the visitor returns to the bet.
- Disclaimer on every page. No cents, no sideways scroll, no page or console errors, no 5xx.
- At the bottom of the scroll, the bottom tab bar doesn't cover the footer or helpline.
- Home at 390 above the fold: a clear headline, "Sign up free", "10 bets a day, free. No card.", and a live example bet. Its numbers agree with each other (85% x 1.43x gives about +22%, inside +20–50%).
- Signup: Google first, then password or email link, and an 18+ checkbox; the main button is above the fold at 390.

## Problems
No blockers.

| # | Sev | Where | Problem | Fix |
|---|---|---|---|---|
| 1 | should-fix | /m teaser, both widths | "Free accounts get10 best bets a day": a JSX line break drops the space (components/market/Teaser.tsx:35-36) | `get{" "}{FREE_BEST_BETS_A_DAY}` |
| 2 | should-fix | /m teaser | The subtitle "Will Trump publicly insult someone on...?" (t.event) is a truncated near-copy of the H1 and reads like a glitch | Hide t.event when it is a prefix of, or near-equal to, the title (normalize, strip "...?"), or show the event only for multi-market events |
| 3 | should-fix | /m teaser | A TikTok visitor gets only the title, a closing time and a sign-up box: nothing concrete about the bet, and most of the 390 screen is a generic pitch | Add the public facts that are not model output (T-276 allows them): the current market price as a % ("Yes 34% on Polymarket"), "closes in 3 days", and a locked, blurred verdict row ("Verdict: 🔒 Sign up free") so it's clear what signup unlocks |
| 4 | should-fix | /signup from a shared bet | Next is kept, but the page is generic ("Create your free account"), so the visitor loses the thread | When next=/m/<id>, add one line: "Sign up to see Kismet's verdict on <title>." |
| 5 | should-fix | /pricing at 390 | Above the plans is a ~470 px dense stats paragraph ("bets in 32 of 52 weeks, 6% in the last 2", "needs ~149 events", "live −3%"). Honest, but jargon for a newcomer, and it pushes the plans below the fold (Rule 3: plain by default, basis one tap away) | Keep one plain line ("Tested on past markets: +6.1% per bet. Live since Nov 17: −3% so far. See results"), and move the rest into a Details expand or below the plans |
| 6 | nit | /pricing Free card | "10 Best bets a day, chosen at random" can read as low quality | "10 of today's best bets, picked at random each day" |
| 7 | nit | footer at 390 | The helpline links "1-800-MY-RESET" and "source" are 15 px tall tap targets | Pad them to at least 44 px (inline-flex min-h-11) |
| 8 | nit | /signup | The header "Sign up" button and the bottom-nav "Sign up" still show while you're on /signup | Hide the header CTA on /signup and /login; the bottom tab already shows active |
| 9 | nit | /m vs home | Time formats differ: /m says "Closes Nov 26, 2026, 10:59 PM CST", home says "closes in 27h" | Add the relative time on /m: "Closes Thu 10:59 PM CST · in 3 days" |
| 10 | watch | /m first hit at 390 | 3.9 s to networkidle on a cold hit (1.5 s on the second width); possibly a cold function | Re-measure in the official run; if it repeats, prewarm or cache marketTeaser |

Skipped as instructed: the manifest links (#71), /markets table (#77), and BotID on headless /check.
