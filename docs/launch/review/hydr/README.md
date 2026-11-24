# T-hydr: intermittent React #418 at 390 (evidence)

Walk-through 1 (on branch `claude/brave-turing-j05kro`: `docs/launch/review/walkthrough-1/findings.md`, `prod-hydration.log`,
`prod-probe3.log`, `prod-walk*.log`; harness `hyd.js`) saw `Minified React error #418 (HTML)` on prod 137ad1f at 390 with touch on
`/m/<id>`, `/signup?next=`, `/state?next=`. What those logs show: 1 hit in 24 loads (`prod-hydration.log`: "loads 24 hits 1"), 0 in 18 at 1440
(`prod-probe3.log`), and exactly one #418 each in `prod-walk.log`, `prod-walk-console.log` and `prod-walk.json`. The "4 in about 42 loads" figure
from the task brief is not in any committed log, so it is not relied on here. Outcome of this investigation: **reproduced (prod and a
local production build), narrowed to React's hydration cursor at the `<main>` host fiber; blocking metadata
(`htmlLimitedBots`) took the local rate from 4/600 to 0/600 (see the A/B below, shipped in T-hydr2).**

## Reproduction (rates)
Set `PW_CHROMIUM_PATH` to a Chromium binary if Playwright's own is not installed. `probe/patch-react-dom.py` builds the logging react-dom chunk used by `hyd3.mjs`; `prod-hit-rows.json` holds per-load timings of the prod run with its one hit.
Harness shape (`probe/hyd2.mjs`, `probe/hyd5.mjs`): one Playwright context at 390x844, `isMobile`, `hasTouch`, iPhone UA,
`timezoneId America/New_York`, 4 pages round-robin (`/m/<id>`, `/signup`, `/state`, `/login`), `waitUntil: networkidle` + 1.2 s.
Prod runs are read-only: every non-GET request aborted, tz cookie set client side. "log" = committed file in this folder.

| Target | Loads | Hits | Log |
|---|---|---|---|
| prod, harness shape (tz cookie) | 48 | 1 (`/signup`) | none (console output only) |
| prod, harness shape | 120 | 1 (`/login`) | `prod-hit-rows.json` |
| prod, fresh context per load, no tz cookie | 150 | 0 | none |
| prod, react-dom chunk patched to log | 240 | 0 | none (hyd3_run2, not kept) |
| local signed-out production build | 240 | 1 (`/state`) | `hyd2_local_base.log` |
| same, patched chunk (`probe/hyd3.mjs`) | 480 | 4 (0.8%) | `hit-with-fiber-stack.log` |
| same, patched chunk, call-stack variant | 494 | 5 (1.0%) | `hit-with-call-stack.log` (ends at a page crash) |
| same, CPU throttle 6x, new page per load | 160 | 0 | `hyd4_cpu6.log` |
| same, through a chunk-splitting/jitter proxy | 240 | 0 | `hyd2_jit.log` |
| local **demo-mode** build (not signed out) | 120 | 0 | none |
| **A/B arm A: final as is** (`probe/hyd5.mjs`) | 600 | **4** (3 `/state`, 1 `/signup`) | `arm-A-final.log` |
| **A/B arm B: `htmlLimitedBots: /.*/`** | 600 | **0** | `arm-B-htmlLimitedBots.log` |

Correction: an earlier draft said patching react-dom hides the error. It does not: the patched local runs hit at 0.8-1.0%,
the same rate as unpatched (about 0.4-0.7%). The patched prod run found none in 240, which at that rate is within chance.
Hit loads were not slow: in the prod run with a hit (`prod-hit-rows.json`) the hit load had TTFB 25 ms and body 99 ms, at or below that run's medians (26 ms and 104.5 ms). Caution: my first "signed-out" local runs hit a
stale demo server on the same port; those numbers were discarded and rerun.

### Instrumented throws vs counted hits
The logs hold more `HYDR418` lines than `HIT` lines (8 vs 4, 14 vs 5). Two harness artifacts, not extra errors:
`hyd3.mjs` prints each throw live and then dumps the whole list again at the end (4 live + 4 repeated = 8), and in the
call-stack run each throw prints two lines (`HYDR418S` call stack, `HYDR418C` fiber) and 7 throws were seen against 5 counted hits;
a hit is counted per load, and a throw that lands after the 1.2 s wait is reset by the next load's `err = null` (not
verified per case, the run then crashed).

### htmlLimitedBots A/B (local signed-out production builds, same harness, run concurrently)
- A (final): 4 hits in 600 loads (0.67%). B (`htmlLimitedBots: /.*/`): 0 in 600. If B had A's rate, 0 in 600 would
  happen about 2% of the time.
- HTML check (`probe/html-check.mjs`, exact iPhone Safari UA, `Accept-Encoding: identity`, 60 fetches per page after a cold first
  fetch; logs `html-check-A.txt`, `html-check-B.txt`, per-fetch rows `html-arm-*.json`, sample HTML `html-arm-*-state-{warm,cold}.html`):

  | | `/state?next=` | `/m/<id>` | `/signup` |
  |---|---|---|---|
  | A warm: `<title>` in head / pending `<!--$?-->` / `$RC` reveal script | 0 / 59 / 59 | 0 / 60 / 60 | 0 / 60 / 60 |
  | B warm: `<title>` in head / pending / reveal script | 59 / 0 / 0 | 60 / 0 / 0 | 60 / 0 / 0 |

  In A the metadata sits in a hidden `<div>` inside `<body>` behind 2 pending boundaries (B:0, B:1) revealed by `$RC/$RV`.
  In B `<title>`/`<meta>` are in `<head>` and nothing is pending.
- Why an earlier copy of the A HTML (`arm-A-state.html`, removed) showed the opposite (title in head, no pending boundary, an
  already-resolved `<div hidden><!--$--><!--/$--></div>`): it was the **first fetch after server start**. A cold server renders
  that request slowly (TTFB 7.3 s here), the metadata resolves before the first flush, and Next emits it inline. That cold
  case is `html-arm-A-final-state-cold.html` and is the same in B (B cold: title in head, no pending). Every later fetch is the
  streamed form in A. In prod this means the pending boundaries appear whenever the server is warm and the metadata is
  not ready at the first flush, which is why the hit SSR from the walk-through had `<!--$?-->` B:0/B:1.
- Both arms' HTML contain 7 `<!--$!-->` client-render bailout boundaries (the dynamic `ssr:false` hosts in `LazyHosts`);
  those are expected and identical in A and B.
- TTFB, local (not Vercel), 59-60 warm fetches per page, iPhone UA (`html-check-*.txt`): median A 8 / 10 / 9 ms
  (`/state`, `/m/<id>`, `/signup`), B 13 / 12 / 12 ms, so blocking metadata costs a few ms locally. An earlier ad-hoc curl run
  (not retained) had B faster (`/m/<id>` A 13, p90 33 vs B 8, p90 12; `/signup` 8 vs 6); the sign flipped, so treat both as
  noise around a few ms. The hit pages use static `metadata` constants, and `/m/[id]` reads the already-loaded market. Not
  measured on Vercel: watch TTFB after deploy.

## What the hit looks like
Patched react-dom (`a9b5e390-*.js`, `rD` = `throwOnHydrationMismatch`) to log at the throw
(`hit-with-fiber-stack.log`, `hit-with-call-stack.log`):
- The mismatch is the non-text kind ("HTML"), thrown from `beginWork` while beginning the **`<main>` HostComponent**
  fiber (a fresh fiber: no child, no memoizedProps).
- The next hydratable DOM node was already the page's `<section>` **inside** `<main>` (parent `MAIN`): the hydration
  cursor was inside `main` when React began `main`. That is a stale cursor: React was re-beginning `main` after having
  already claimed it (a retry/replay or a DOM mutation under a concurrent, yielding hydration), not a server/client
  difference in markup. The SSR HTML of the hit (`/state`) and the client tree agree on the pieces I checked
  (FreshnessPill placeholder, header, footer); the DOM snapshot in the walk-through is the client-render fallback after
  the error, so its diff against the SSR is mostly artifact.
- At flush time Next's streamed boundaries are pending (`<!--$?-->` B:0 metadata, B:1 outlet) with the React 19.2 reveal
  script (`$RC/$RV`, 300 ms throttle) that mutates the DOM inside `<main>`'s neighbourhood while hydration may be
  yielding. Plausible mechanism; not demonstrated.

## Ruled out (as the cause)
FreshnessPill/useNow (hydration render uses the request clock and the server snapshot, SSR placeholder matches);
MobileNav/AccountLink/Header `useMe` vs hint (server snapshot null on hydration); viewport/matchMedia reads in render
(`useDesktop` has a null server snapshot); `Date`/timezone/localStorage reads in render (none found in the layout
path); network chunk splitting and CPU throttling (0 hits at 240 and 160); BotID script injection (React 19 skips
unexpected head/body nodes; the BotID build itself was not tested, `NEXT_PUBLIC_BOTID` is Vercel-only).

## Not done
- A synchronous-metadata variant (other than blocking metadata) was not run.
- A 20x-per-page prod-build e2e ships with T-hydr2 together with a deterministic HTML assertion (metadata in head, none in body), because 20 loads alone would catch the old behaviour only about 12% of the time.
- Upstream: file against Next 15.5.29 / React 19.2 with the stack above (stale hydration cursor at `main` after a
  streamed-boundary reveal); T-hydr2 avoids the trigger rather than fixing React.

Files: `probe/hyd2.mjs` (harness shape, one page reused), `probe/hyd4.mjs` (new page per load, crash tolerant),
`probe/proxy.mjs` (chunk jitter proxy), logs from the runs above.
