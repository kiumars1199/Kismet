# Red-team run 1 (2026-11-17)

Scope: `origin/final` at the time of the run, attacked on localhost only.

- **Target A, production build:** `pnpm build && next start -p 3400`, `NODE_ENV=production`, `DEMO_MODE` unset,
  no Supabase/Stripe/Upstash keys, real `output/` data (12,598 markets), plus `E2E_MOCK=1` and
  `STRIPE_API_BASE=http://localhost:3400` set at runtime to check they are ignored.
- **Target B, dev server with the in-app mock:** `next dev -p 3410`, the env from `playwright.paid.config.ts`
  (`E2E_MOCK=1`, mock Supabase + Stripe), plus `KALSHI_TRADING_ENV=demo`, `TRADING_ALLOWLIST=trader@x.test`,
  `EXT_SIGNING_SECRET`, `CRON_SECRET`, `UNSUBSCRIBE_SECRET`, same real data. Sessions came from
  `ops/redteam/login.sh` (magic link through the mock inbox, plans bought through the mock checkout):
  `free@x.test` (Free), `pro@x.test` (Pro, trialing), `trader@x.test` (Premium, allow-listed for trading).
- Functions that need a database or the extension runtime were run in-process: `ops/redteam/web-repro.test.ts`
  (PGlite with the real migration, real `insertRow`, real limiter) and `ops/redteam/ext-cap-race.test.ts` (the real
  `background.ts` with a stubbed `chrome.*`). Copy each into the app's `test/` folder to run it.

No real external service was contacted. Routes whose exploitation would call Polymarket, Kalshi, Stripe or
Resend were checked only up to the point before the outbound call (see "Not exercised").

## Findings

| ID | Severity | Title |
|---|---|---|
| RT-01 | High | Signed-out reveal allowance is a cookie: exact numbers for every market, anonymously |
| RT-02 | High | Rate limits fail open in production without Upstash (spec limits not enforced at all) |
| RT-03 | Medium | Free 25-row / page-1 cap bypassed by filter partitioning: 95% of the scan in 36 s |
| RT-04 | Medium | Filter thresholds are an oracle for exact expected return and win chance |
| RT-05 | Medium | Payment Link `client_reference_id` pointing at another user hijacks their billing |
| RT-06 | Medium | Extension daily spend cap is bypassed by concurrent `place` intents |
| RT-07 | Low | Rate-limit key is the client-supplied `X-Forwarded-For` |
| RT-08 | Low | Plan quotas are count-then-insert: parallel inserts exceed them |
| RT-09 | Low | Kalshi key scope check is a deny-list: unknown or differently cased money scopes pass |
| RT-10 | Low | Extension sign-in token refreshes forever, after sign-out and account deletion, keeping the old tier |
| RT-11 | Low | RLS lets a user forge `accepted_terms_at` / `onboarded_at` and skip plan quotas with their own JWT |
| RT-12 | Low | Unauthenticated `/api/ext/telemetry` buffers bodies of any size |
| RT-13 | Low | Signed-in `/login?next=<non-ASCII>` returns 500 |
| RT-14 | Low | `/api/health` advertises that rate limits are off; prod falls back to the public dev extension ID |
| RT-15 | Info | Tier-shaped API responses carry no `Cache-Control: private` / `Vary: Cookie` |

---

### RT-01 · High · Signed-out reveal allowance lives in a client cookie

- **Where:** `apps/web/lib/data/reveals.ts:24-33` (signed-out branch), reached from `apps/web/app/api/markets/[id]/route.ts`.
- **What:** Free gets exact numbers for 3 markets a day via `?detail=1`. Signed out, the count is kept only in the
  `me_reveals` cookie. A client that doesn't send it starts at 3 every request. Combined with RT-02/RT-03 (ids for
  the whole scan), this gives the full, exact (Pro-shaped) scan to an anonymous scraper.
- **Repro:**
  ```bash
  python3 -I ops/redteam/reveal_reset.py http://localhost:3410 5      # honest client vs cookie dropped
  python3 -I ops/redteam/bulk_scrape.py  http://localhost:3400 /tmp/ids.json
  python3 -I ops/redteam/exact_dump.py   http://localhost:3400 /tmp/ids.json 16
  ```
- **Observed:**
  ```
  -- honest browser (keeps the me_reveals cookie)
  6674492 roi=30.26 win=0.9255 EXACT reveals_left=2
  6671884 roi=29.16 win=0.9303 EXACT reveals_left=1
  6671865 roi=28.18 win=0.9358 EXACT reveals_left=0
  6117510 roi=20 win=0.8 banded reveals_left=0
  -- same markets, cookie dropped on every request
  6117510 roi=27.3 win=0.8168 EXACT reveals_left=2
  6671856 roi=26.84 win=0.9384 EXACT reveals_left=2
  ...
  {"ids": 13236, "results": {"exact": 13236}, "seconds": 15.7}     # production build, anonymous
  ```
- **Impact:** The asset the threat model ranks first ("the data is the product") is fully extractable without an
  account, 15 minutes delayed, in about 95 s from one IP. The code comment already flags the cookie reset; the chain
  with RT-02/RT-03 makes it a full dump rather than "a few extra reveals".

### RT-02 · High · Rate limits fail open in production without Upstash

- **Where:** `apps/web/lib/abuse.ts:75` (`noop` limiter), `:88` (chosen when Upstash env is missing), `:113`
  (Upstash error → serve). `/api/health` reports `ratelimit:"off"` with 503, but every route keeps serving.
- **Repro (Target A, production build):** the bulk scrape above, plus
  ```bash
  python3 -I ops/redteam/bulk_scrape.py http://localhost:3400
  for i in $(seq 1 12); do curl -s -o /dev/null -w '%{http_code} ' -H 'Origin: http://localhost:3410' \
    -H 'content-type: application/json' -d '{"email":"victim@x.test","accept":true}' http://localhost:3410/api/auth/magic-link; done
  ```
- **Observed:**
  ```
  {"markets_scraped": 13236, "reported_total": 13971, "requests": 5536, "http_status": {"200": 5536}, "seconds": 36.4}
  200 200 200 200 200 200 200 200 200 200 200 200          # spec: 5/min per IP and 5/hour per address
  prod.log: [abuse] UPSTASH_REDIS_REST_URL/TOKEN not set: rate limits are OFF
  ```
  5,536 requests in 36 s against a 60/min rule, zero 429s. The `pages` rule (50 pages/min), `book` 30/min,
  `checkout` 10/hour, `auth_email` 5/hour and the anomaly log (`noteRows`) are all no-ops.
- **Impact:** A production deploy that forgets two env vars (or an Upstash outage) has no bot or cost protection:
  scraping (RT-01/RT-03), magic-link mail bombing of any address (Supabase's own SMTP limit is the only cap), and
  unbounded outbound fetches through `/api/book` and `/api/settle` (each `/api/settle` call fans out to up to 200
  Gamma + 400 CLOB requests; its only gate is an `Origin` header any non-browser client sets). DEMO_MODE fails closed;
  this control fails open.

### RT-03 · Medium · Free row cap bypassed by filter partitioning

- **Where:** `apps/web/lib/data/respond.ts:114` (Free = page 1 of whatever filter the caller sends),
  `apps/web/lib/data/gate.ts:66-67`.
- **What:** Free is limited to 25 rows, page 1, but every filter combination is a fresh page 1, and `total` says
  when a window holds more than 25. Splitting by category, price window (`p0`/`p1`) and close time (`ca`/`cw`)
  enumerates the whole scan.
- **Repro:** `python3 -I ops/redteam/bulk_scrape.py http://localhost:3400` (anonymous, production build).
- **Observed:** `{"markets_scraped": 13236, "reported_total": 13971, "requests": 5536, "http_status": {"200": 5536}}`.
  Each row carries exact `ask`, `mid`, `fee`, `volume`, `liquidity`, `model_neff`, `tokens`, plus banded returns.
- **Impact:** Bulk scraping of the market list, the input for RT-01. The 25-row cap does not limit what a client
  can collect, only how many requests it takes.

### RT-04 · Medium · Filter thresholds are an oracle for the exact numbers

- **Where:** `apps/web/lib/data/respond.ts:114` → `lib/filters/apply.ts` filters on exact store values;
  banding (`gate.ts`) runs after. `roi` (roi_min), `wp` (win_prob_min), `e` (edge_min) are all accepted from Free.
- **Repro:** `python3 -I ops/redteam/filter_oracle.py http://localhost:3400 6674492`
- **Observed:** Free row shows `"roi_pct": 20, "win_prob": 0.9, "ranges": {"roi_pct": [20, 50]}`; the oracle returns
  `{"market": "6674492", "exact_roi_pct": 30.26, "exact_win_prob": 0.9255, "requests": 60}`; the store holds
  `roi_pct 30.26, win_prob 0.9255`. The market is isolated with its own (exact, public) `ask` as a ±0.0005 price
  window; isolation fails for markets sharing a price with >25 others, which a close-time window fixes (as in RT-03).
- **Impact:** Signed-in Free users (whose reveals are DB-counted, so RT-01 doesn't apply) and anyone else recover
  the exact Pro numbers for chosen markets with ~60 requests each. Ranges are cosmetic as long as Free may filter
  and sort on the exact fields.

### RT-05 · Medium · Payment Link `client_reference_id` → another user's billing

- **Where:** `apps/web/lib/billing/stripe.ts:106-110` (`checkout.session.completed` trusts `client_reference_id` and
  re-links that user to the payer's customer), `:96` (later events find the user via `userForCustomer`).
  In Payment Link mode the id is a URL parameter the payer can change (`paymentLinkUrl`, `:39-44`).
- **Repro (Target B):** the mock creates a checkout session with `client_reference_id=<victim id>` and no
  metadata, exactly what an edited Payment Link produces, "pays" (the mock sends the signed webhooks), then the
  payer cancels (signed `customer.subscription.deleted`, as Stripe would send):
  ```bash
  python3 -I ops/redteam/clientref_hijack.py http://localhost:3410 b255a3ea-1b4d-42a2-b51d-3fde67e75a0b "<pro@x.test cookies>"
  ```
- **Observed:**
  ```
  victim before: {'tier': 'pro', 'status': 'trialing'}
  victim after attacker's checkout: {'tier': 'pro', 'status': 'active'}     # victim row now = attacker's customer/sub
  webhook: 200 {"received":true}
  victim after attacker cancels: {'tier': 'free', 'status': 'canceled'}
  ```
- **Impact:** Someone who knows a user's id downgrades them while the victim's real Stripe subscription keeps
  billing, now orphaned (its events find no user → `RetryLater` 500s forever), and "Delete account" cancels the
  attacker's subscription instead of the victim's. User ids aren't public (they appear in unsubscribe tokens and
  the account export), which keeps this Medium. Checkout mode sets the id server-side, but the handler doesn't
  distinguish the two.

### RT-06 · Medium · Extension daily spend cap bypassed by concurrent orders

- **Where:** `apps/extension/src/background.ts:140` (cap checked against spend read before any await) and `:146`
  (spend written only after `checkNonce` + `placeOrder` resolve). No lock between the two.
- **Repro:** copy `ops/redteam/ext-cap-race.test.ts` to `apps/extension/test/`, then
  `pnpm exec vitest run test/ext-cap-race.test.ts --silent=false`. Caps $25/order and $25/day; orders of
  40 × 50¢ = $20.70 each, each with its own valid nonce.
- **Observed:** sequentially the second order is refused (`ok:false`); fired together:
  `concurrent results: [ true, true, true ] orders placed: 3 spend recorded (cents): 6210`.
- **Impact:** $62.10 placed against a $25 daily cap. The cap is the last line of defence if the site is compromised
  (script on our origin can mint nonces with the user's cookie) or the user double-submits. Paper trading only
  today; this matters before `KALSHI_TRADING_ENV=prod`.

### RT-07 · Low · Rate-limit key is the client-supplied `X-Forwarded-For`

- **Where:** `apps/web/lib/abuse.ts:96`.
- **Repro:** copy `ops/redteam/web-repro.test.ts` to `apps/web/test/`, `pnpm exec vitest run test/web-repro.test.ts --silent=false`.
- **Observed:** `same IP: 60/61 allowed; rotated X-Forwarded-For: 61/61 allowed`.
- **Impact:** Anywhere the first XFF hop isn't set by a trusted proxy (self-hosting, another CDN, a misconfigured
  front), anonymous limits are per-request. On Vercel the platform rewrites XFF, which is why this is Low; keying on
  `x-real-ip`/the platform IP header first would remove the dependency.

### RT-08 · Low · Plan quotas are count-then-insert

- **Where:** `apps/web/lib/repo/server.ts:70-71` then `:73`.
- **Repro:** `ops/redteam/web-repro.test.ts` (real `insertRow`, Free tier, a DB stub with 5 ms latency).
- **Observed:** `statuses: 200 ×20, rows stored: 20` for a plan that allows 1 preset; the 21st sequential insert
  gets 403. (On the E2E mock the count isn't implemented, so `ops/redteam/quota_race.sh` stores 20 even
  sequentially there; that part is a mock limitation, not app behaviour.)
- **Impact:** Free users exceed preset/watchlist quotas (and Pro its dashboard/alert-rule quotas) with parallel
  requests. Low value; a DB constraint or trigger would make it exact.

### RT-09 · Low · Kalshi key scope check is a deny-list

- **Where:** `apps/extension/src/kalshi/trade.ts:79`.
- **Repro:** `ops/redteam/ext-cap-race.test.ts` (second test).
- **Observed:**
  ```
  ["read","write::trade","WRITE::TRANSFER"] -> ACCEPTED
  ["read","write::trade","transfer"] -> ACCEPTED
  ["read","write::trade","write:transfer"] -> ACCEPTED
  ["read","write::trade","admin"] -> ACCEPTED
  ```
- **Impact:** docs/15 says "require `read` + `write::trade` only". Any scope Kalshi adds later, or any spelling
  other than lowercase `write::…`, is accepted. An allow-list (`every(s => s === "read" || s === "write::trade" || s.startsWith("read::"))`)
  matches the doc.

### RT-10 · Low · Extension token outlives sign-out and account deletion

- **Where:** `apps/web/app/api/ext/token/refresh/route.ts:9-11` (re-issues with the old `sub` and `tier`; the
  `ponytail:` comment notes it).
- **Repro (Target B):** sign in a Premium account, `POST /api/ext/token`, `DELETE /api/account`, then refresh 4 times.
- **Observed:** `/api/me` with the old cookies → `"user":null,"tier":"free"`; refresh #4 →
  `{'k': 'ext', 'sub': 'gone2@x.test', 'tier': 'premium', ...} tier premium`.
- **Impact:** A deleted, downgraded or signed-out-everywhere user keeps a valid "premium" extension token forever.
  Today the server never reads this token for data (the extension's API calls are shaped by cookies), so the effect
  is limited to the extension's own UI and gating; it becomes a real paywall bypass the day an API trusts it.

### RT-11 · Low · Own-row RLS is wider than the API

- **Where:** `supabase/migrations/20261117000000_init.sql:139-140` (profile update on every column) and the
  "own rows" policies (no tier or quota awareness).
- **Repro:** `ops/redteam/web-repro.test.ts` (PGlite, real migration, as `authenticated` user A).
- **Observed:**
  ```
  terms forge: {"rows":[{"accepted_terms_at":"2000-01-01T00:00:00.000Z"}],"error":null}
  free user alert_rules (API limit 0): {"rows":[{"n":30}],"error":null}
  free user journal (Pro feature): {"rows":[{"id":"9f56a623-…"}],"error":null}
  tier update: {"rows":[],"error":null}          # held: no update policy
  tier insert: … "new row violates row-level security policy for table \"subscriptions\""   # held
  tier now: [{"tier":"free"}]
  ```
- **Impact:** A user who calls PostgREST directly with their own access token (readable from their own cookie)
  can rewrite their 18+/Terms timestamp and store unlimited rows. Needs the anon key, which this build does not ship
  to browsers, hence Low. Tier stays server-controlled (held); the alert cron also ignores Free rules.

### RT-12 · Low · Unbounded request bodies on an unauthenticated route

- **Where:** `apps/web/app/api/ext/telemetry/route.ts:13` (`req.json()` with no size limit, no auth). Same pattern
  in `/api/trade/nonce/verify`, `/api/settle`, `/api/combos/kalshi`; `readBody` (`lib/repo/server.ts`) checks size only
  after reading the whole body.
- **Repro (production build):** a 200 MB JSON body: `curl --data-binary @big.json http://localhost:3400/api/ext/telemetry`.
- **Observed:** `400` after 0.3 s; server RSS 65 MB → 411 MB for one request, 623 MB peak with 8 in parallel.
- **Impact:** Memory pressure / OOM on self-hosted or long-lived instances. Vercel's 4.5 MB function body limit
  mitigates it there.

### RT-13 · Low · `/login?next=<non-ASCII>` → 500 when signed in

- **Where:** `apps/web/app/login/page.tsx:21` (`redirect(next)` with a value `safeNext` accepts).
- **Repro (Target B):** `curl -b free.jar 'http://localhost:3410/login?next=/%E3%80%80/evil.test'`
- **Observed:** `HTTP/1.1 500`, dev error `Invalid character in header content ["location"]`. Not an open redirect
  (all 9 redirect payloads stayed on-origin, see Held), just an unhandled error page.

### RT-14 · Low · Information exposure: health and extension ID

- **Where:** `apps/web/app/api/health/route.ts:42`; `apps/web/lib/trade/server.ts:30`.
- **Observed (production build):**
  `GET /api/health` → `{"ok":false,…,"db":"not configured","stripe":"not configured","ratelimit":"off"}` (tells a
  scraper RT-02 is open); `GET /api/trade/config` → `"extensionId":"cgoaaiaghbckpalppklocajbdpoelmbd"`, the dev
  ID whose manifest public key is in the repo. Anyone can load an unpacked extension with that key and get that ID,
  and `siteOrExtension` accepts `Origin: chrome-extension://<that id>` for `/api/ext/token` when
  `NEXT_PUBLIC_EXTENSION_ID` is unset in production.
- **Impact:** Recon value; the extension-ID part only matters if the env var is forgotten.

### RT-15 · Info · No cache directives on tier-shaped responses

- **Observed (production build):** `/api/markets`, `/api/combos`, `/api/backtest`, `/api/model/curve`: no
  `Cache-Control`, and `Vary` doesn't include `Cookie`. Only `/api/suggest` sends `private, max-age=30`.
- **Impact:** None on Vercel defaults (functions aren't cached without `s-maxage`). A shared cache in front of a
  self-hosted deploy could serve one tier's body to another. `Cache-Control: private, no-store` on the tier-shaped
  routes closes it.

---

## Attempted and held

Production exposure (Target A)
- `/e2e-mock/supabase/_inbox`, `/_reset`, `/v1/checkout/sessions` with `E2E_MOCK=1` + `NODE_ENV=production` → 404 (mock and rewrite both gated on non-production).
- `STRIPE_API_BASE` set in production → ignored (`stripeClient` checks `NODE_ENV`).
- DEMO_MODE unset in production → `/api/me` `demo:false, tier:"free"`; fails closed.
- No source maps served (`/_next/static/**.map` 404, none built); no secret env names or key shapes in `.next/static` (only `NEXT_PUBLIC_POSTHOG_*`, `SENTRY_DSN`, `VERCEL_ENV`); Supabase anon key not in the client bundle.
- Error bodies on malformed input are generic JSON (`token must be a CLOB token id`, `Curve not found`, `Event not found`, `bad query`); no stacks in production.
- Trading with `KALSHI_TRADING_ENV` empty: `/api/trade/nonce/verify` → 404, `/api/trade/config` → `enabled:false`.

Cron / ops
- `/api/alerts/run`, `/api/settle/run`: no header, `Bearer `, `Bearer undefined`, lowercase `bearer <secret>`, `x-vercel-cron: 1` → 401 on both targets; no `CRON_SECRET` set → 401; comparison is SHA-256 + `timingSafeEqual`.

Auth, CSRF, redirects
- Open redirect via `/login?next=`: `//evil.test`, `/\evil.test`, `%2F%2Fevil.test`, `/%09/evil.test`, `https://evil.test`, `/%5Cevil.test`, `/%2F%2Fevil.test` → `/`; `/.%2F%2Fevil.test` → `Location: /.//evil.test` (same origin). Callback and onboarding use the same `safeNext`.
- CSRF on `/api/data/presets` with cookies: `Origin: https://evil.test`, `Origin: null` with text/plain, no Origin (DELETE `/api/account`), `Origin: http://localhost:3410.evil.test` → 403.
- `/api/trade/nonce` cross-origin or without Origin → 403; as a non-allow-listed user → 403.
- `/api/ext/token` with `Origin: chrome-extension://<id>` and no session → 401.
- Login CSRF via a foreign `/auth/callback?code=` relies on Supabase PKCE (the code verifier cookie lives in the initiating browser); not exploitable on real Supabase, not testable on the mock (it skips PKCE).

Data API (IDOR, mass assignment, zod)
- PATCH / DELETE another user's preset by id → `null`/204 with nothing changed (victim still has the row).
- `{"user_id":"x"}` patch → 400; `{"tier":"premium"}` on `/api/data/profile` → 400; `/api/data/subscriptions` → 404.
- `{"import":{"__proto__":[…],"constructor":[…],"profile":{"__proto__":{"tier":"premium"}}}}` → `imported:{}`, tier unchanged.
- Free → `/api/data/journal` 403; Free → alert rule 403 (limit 0); 300 KB body → 400.
- `/api/account/export`, `/api/data` unauthenticated → 401.

Paywall
- `/api/book?tokens=` batch as Free/anon → 403; extra keys → 400 (strict zod); repeated `tokens` → 403.
- Free `pg=5&ps=200` → page 1, 25 rows; Pro past the last page → 400; `pg=0`/negative/NaN/Infinity params dropped.
- `/api/combos` Free: `ret`, `q`, leg `q` banded/floored (exact `price`/`pays` only); Premium gets exact values.
- `/api/suggest` anonymous → banded `roi_pct` with `ranges`.
- Signed-in Free reveals counted in `drawer_reveals` (insert-only RLS, no delete policy: `delete … returning *` → 0 rows).

Billing
- Stripe webhook: replay of the same event id → `duplicate:true`; timestamp −10 min → 400; wrong secret → 400 (`ops/redteam/webhook_checks.py`).
- `subscriptions` update/insert as the user (PGlite, real policies) → 0 rows / RLS violation; tier stays `free`.
- Checkout mode: `client_reference_id` and `metadata.user_id` come from the server session, not the request body (`price` is the only accepted key).

Trading
- Nonce replay → 403; nonce with a tampered payload (count 10 → 1000) → 403; verify with no cookies works but only for the exact payload (nonce is not user-bound, so it is only as secret as the page that holds it); `__proto__` body → 400; `count`/`price_cents` bounded by zod in both web and extension.
- Extension `onMessageExternal` re-checks `sender.origin === API` and an own-property allow-list of message types; vault/caps messages only from `chrome-extension://` pages; private key imported non-extractable; `ping` exposes masked key id only.

Injection
- `/markets?q=<script>…"><img onerror>` → rendered escaped in input value, text and RSC payload.
- CSP in production: per-request nonce + `strict-dynamic`, no `unsafe-eval`, `object-src 'none'`, `frame-ancestors 'none'`, `base-uri 'self'`; HSTS, nosniff, DENY, Referrer-Policy present.
- `/m/<html>` → 404; OG image is free-shaped and text-only (`ImageResponse`).
- Alert webhook URLs restricted by regex at the API and re-checked after URL normalization in the cron; unsubscribe token is HMAC + exp with `timingSafeEqual`, three-part tokens refused; unsubscribe page reflects nothing from the request.
- Extension side panel and vault UI escape every API string (`esc()`); extension pages CSP `script-src 'self'`.

## Not exercised (would call a real external service)
- `/api/book` single-token as Free returns live `best_ask`/`book_mid` (live data is a Pro feature) and its per-token
  cache in `lib/book.ts` is unbounded; `/api/settle` fan-out. Both need Polymarket CLOB/Gamma to demonstrate.
- 3-session limit and global sign-out revocation: enforced by Supabase (`enforce_session_limit` trigger, GoTrue);
  the mock does not model sessions. Covered by the existing PGlite trigger test, not re-attacked here.
- Kalshi demo exchange calls from the extension.
