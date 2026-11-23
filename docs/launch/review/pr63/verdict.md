# #63 315b0db (public /state): FAIL
Run: wt51 at 315b0db, next dev on 3291 with the paid config env (DEMO_MODE=false, E2E_MOCK=1), signed out. probe.txt, probe-cookie-run.txt, screenshots.
1. Open redirect: /state?next=%2F%09%2Fevil.example (also %0A, %0D) passes safeNext ("/\t/evil.example"). Back link href "/\t/evil.example",
   and after picking a state location.assign goes off-site (chrome-error: DNS for evil.example). WHATWG URL strips tab/CR/LF:
   new URL("/\t/evil.example", origin) -> https://evil.example/. Fix: reject any char < 0x20 (or resolve with new URL(v, origin) and require same origin + path).
2. Landing round trip shows no NV note: "/" is force-static, so after the pick the visitor lands back on "/" with "Check your state" again
   (cookie us_state=NV set; landing notes still 4x "Check your state", "Bet on Polymarket US" button). Signed-out /m shows no availability note at all.
   So signed out, the NV note is never visible. Either make the landing note client-read the cookie, or return to a page that renders it.
Passing: GET /state 200 signed out (no 307), noindex meta; /settings still 307 (expected); //, /\, https://, javascript:, /state loop -> rejected (Back "/" and no navigation);
"/ /evil.example" stays same-origin (/%20/evil.example). Unit next-path/account-wall/seo 23/23. 390 and 1440: no hscroll, disclaimer present.
CI: python, supply-chain success; web in progress.
