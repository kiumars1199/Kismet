# PR #63 e52cafb (F9 fix: safe next + NV note on static "/") — reviewer round 2
Verdict: PASS with notes (code). CI web red only from the next-dev memory restart (fixed by #65).
Run: own worktree at e52cafb, next dev on 3302 with the paid config env (DEMO_MODE=false, E2E_MOCK=1). Plans via mock sign-in + comp_tier.

1. safeNext (lib/venues/next-path.ts, commit 33a6c9b): rejects any char 0x00-0x1f / 0x7f, then resolves against a dummy origin,
   requires the same origin, rebuilds pathname+search+hash and rejects a result starting "//" or /state. Unit 37/37 (next-path, state-route, account-wall, seo, venues).
   Runtime, signed out, /state?next=<p> then pick TX (off-site requests intercepted; probe.log): 20 hostile payloads incl. %09 %0A %0D %0D%0A, leading %09,
   //, /\, /\t\, /.//, /..//, /%2E//, https:, javascript:, %00, %7F, %1F, leading space -> Back href "/" and no navigation; 0 off-site requests.
   U+2028 -> "/%E2%80%A8/evil.example" and %2509 -> "/%09/evil.example": both same-origin paths (404 on site), not redirects.
   Valid: /?us=0 -> /?us=0; /m/7077574 -> /m/7077574; /bets?x=1#why -> /bets, then the signed-out /signup wall (expected).
2. Signed-out "/" -> Check your state -> NV -> "/": note "Polymarket US: not available in Nevada" at 390 and 1440.
   Also Free, Pro, Premium (tier confirmed via /api/me). CLS of the flow 0-0.0006, cold reload of "/" with the cookie 0-0.0006 (all < 0.1).
   No hscroll, disclaimer present, no cents. Screenshots shots/<plan>-<w>-after-NV.png.
   PR spec e2e-paid/launch-f09-state-static: 2/2 passed (e2e-paid-state-static.log).
3. "/" still static: next build shows "┌ ○ /  1.44 kB 137 kB  5m  1y" (build.log); /state and /api/state are ƒ. check:js / 144.8 kB (budget 150).
4. typecheck, lint (0 warnings) pass (checks.log).
5. CI on e52cafb: python, supply-chain, Vercel success; web failure: vitest 1595 passed, demo e2e 194 passed, paid 59 passed / 1 failed
   (s7-upgrade toHaveURL) right after "Server is approaching the used memory threshold, restarting..." (ci-web-e52cafb.log line 2449). Same cause #65 fixes.
Notes: (a) needs a re-run of CI after #65 lands (22 commits behind final, merges clean); (b) the GET /api/state round trip means the note shows
"Check your state" briefly on "/" before swapping to the state text (no shift, min-h-4 holds the line).
