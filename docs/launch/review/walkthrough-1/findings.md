# WT1 official walk: TikTok first-time visitor, prod final 137ad1f, signed out. Verdict: FAIL
Path: /m/6596313?ref=abcd1234 (referer tiktok; same market as the dry run) -> teaser "Sign up free" -> /signup?next=/m/6596313 -> /pricing -> /state -> /m footer + helpline -> / -> /login?next=.
Widths: 390x844 (mobile, touch) and 1440x900. Checks at DSF 1, screenshots at DSF 2 (prod-<w>-<step>-{fold,full}.png).
Logs: prod-walk.log/json, prod-walk-console.log, prod-probe3.log, prod-hydration.log (+hit SSR/DOM html), prod-ttfb.txt, prod-linkcheck.txt, local-137ad1f.log.
Non-GET calls to /api/funnel were aborted (no live writes); /api/tz, /api/state and /api/invite/ref only set cookies. The ERR_FAILED console lines are those aborted POSTs.
SPEC.md has no WT1 "Done when"; applied the global rules (CLS < 0.1, 390/1440, no cents, disclaimer, basis one tap away) plus the brief's 44 px tap targets.
See the reviewer reply for the item-by-item list.
