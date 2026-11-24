# T-hydr: intermittent React #418 at 390 (evidence; no code fix)

Walk-through 1 saw `Minified React error #418 (HTML)` on prod 137ad1f at 390 with touch on `/m/<id>`, `/signup?next=`,
`/state?next=` (4 in ~42 loads, then 1 in 24; 0 in 18 at 1440). Outcome of this investigation: **reproduced (prod and a
local production build), narrowed to React's hydration cursor at the `<main>` host fiber, root cause not proven, no
mitigation measured to help, so no code change is shipped.**

## Reproduction (rates)
Harness shape (`probe/hyd2.mjs`): one Playwright context at 390x844, `isMobile`, `hasTouch`, iPhone UA,
`timezoneId America/New_York`, `tz` cookie set, 4 pages round-robin (`/m/<id>`, `/signup`, `/state`, `/login`),
`waitUntil: networkidle` + 1.2 s. Read-only on prod: every non-GET request aborted, no POST, tz cookie set client side.

| Target | Loads | Hits |
|---|---|---|
| prod, harness shape | 48 | 1 (`/signup`) |
| prod, harness shape | 120 | 1 (`/login`) |
| prod, fresh context per load, no tz cookie | 150 | 0 |
| prod, harness shape with the react-dom chunk patched to log (changes timing) | 240 | 0 |
| local production build, signed out (`DEMO_MODE=false`, placeholder Supabase), harness shape | 240 | 1 (`/state`) |
| same, patched chunk (stack logging) | ~150 | 1 (`/signup`) |
| same, CPU throttle 6x, new page per load | 160 | 0 |
| same, through a chunk-splitting/jitter proxy (`probe/proxy.mjs`) | 240 | 0 |
| local **demo-mode** build (not signed out) | 120 | 0 |

Hit loads were not slow (prod hit: TTFB 25 ms, body 99 ms, both median). So it is rare (about 0.4-2%), not driven by
network timing in anything I could vary, and not a demo-mode artifact. Caution: my first "signed-out" local runs hit a
stale demo server on the same port; those numbers were discarded and rerun.

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
- `htmlLimitedBots: /.*/` (blocking metadata, so no B:0) and a synchronous-metadata variant: not run. At a ~0.4% base
  rate each arm needs 500+ loads (about 20 min of one core) and the box was memory-starved by other lanes; a
  smaller sample cannot show an improvement, so I did not ship either as a "mitigation".
- A 20x-per-page prod-build e2e: with a ~0.4% per-load rate a 60-load test would fail only ~20% of the time on the
  broken build and would flake CI on any future recurrence, so I did not add it. If a deterministic trigger is found,
  turn `probe/hyd4.mjs` into the guard.
- Next step if someone continues: run the two arms above at >=500 loads each with `probe/hyd4.mjs` on a signed-out
  build; or file against Next 15.5.29 / React 19.2 with the stack above (stale hydration cursor at `main` after a
  streamed-boundary reveal).

Files: `probe/hyd2.mjs` (harness shape, one page reused), `probe/hyd4.mjs` (new page per load, crash tolerant),
`probe/proxy.mjs` (chunk jitter proxy), logs from the runs above.
