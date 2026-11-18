# Audit run 2

MarketEdge final audit, second run.

Auditor: an independent agent that built none of this code. It checked and fixed nothing.
Target: branch `final` at `f8adde4` ("STATUS: red-team fix decisions, webhook retry kept"), checked out as `audit2`.
Date: 2026-11-17.
Spec: `docs/OVERNIGHT.md` §3, items 1–11.

How the audit ran:
- Every check ran on fresh `git archive origin/final` copies in a scratch directory, never in the working tree.
- `clean/` was used for the tests, the e2e runs and the extension zip.
- `prod/` was set up by following `SETUP.md` from scratch: a new Python venv, `pip install -r requirements.txt`, `python -m engine scan`, then `pnpm i --frozen-lockfile` and `pnpm build` with `DEMO_MODE` unset and every key empty. `pnpm exec next start -p 3820` served it.
- `mock/` ran the `E2E_MOCK=1` dev server on port 3830, with `ADMIN_EMAILS=admin-audit@example.com`, `KALSHI_TRADING_ENV=demo` and the fresh `output/*.json` from `prod/`.
- Seeded users (free, pro, premium, admin) were made through the mock magic link and the mock checkout, which sends a signed Stripe webhook. Their cookies were saved as Playwright storage states.
- Only ports 3800–3899 were used. A red-team agent was running at the same time, so the machine was heavily loaded (load average up to 37). Where that affected a result, the section says so.
- No Supabase, Stripe, Upstash, Vercel or Kalshi account exists. Where the in-repo mocks fully cover a check, it is marked PASS, and the live step is listed under "Owner verification".
- Docs, STATUS.md, REDTEAM.md and commit messages were not taken as proof of anything. Every claim below was re-checked.

## Summary

| # | Item | Result |
|---|------|--------|
| 1 | Tests | PASS |
| 2 | Production build | **FAIL** (fail 1) |
| 3 | Every page × every state | PASS |
| 4 | Quality | **FAIL** (fails 5 and 6) |
| 5 | Data correctness | PASS |
| 6 | Security | **FAIL** (fails 2 and 3) |
| 7 | Multipliers and combos | PASS |
| 8 | Trading safety | PASS |
| 9 | Billing | PASS |
| 10 | Legal and wording | **FAIL** (fail 4) |
| 11 | Publication readiness | **FAIL** (fails 1 and 5) |

There are 6 passes and 5 fails. The numbered "Fails to fix" list at the end gives file:line, the symptom and a repro for each fail.

---

## 1. Tests: PASS

- **Clean install.** `pnpm i --frozen-lockfile` on a fresh copy of `final`, in `apps/web` and `apps/extension`, exited 0.
- **pytest.** `pytest -q` gave `40 passed in 0.90s`.
- **typecheck.** `pnpm typecheck` in `apps/web` exited 0. In `apps/extension` it also exited 0.
- **lint.** `pnpm lint` in `apps/web` runs with `--max-warnings 0`. It exited 0 with zero warnings. `apps/extension` has no lint script.
- **Unit tests.** `pnpm test` in `apps/web` gave `Test Files 51 passed (51)`, `Tests 335 passed (335)`. In `apps/extension` it gave `Tests 42 passed (42)`.
- **e2e, demo project** (`pnpm e2e`, which runs `next build && next start`, `PW_PORT=3810`): `52 passed (1.6m)`. This covers S1–S6, S8 ("Run now fires one alert…"), search, trading-paper, multipliers, the axe pass and the headers spec.
- **e2e, paid project** (`E2E_MOCK=1`, `playwright.paid.config.ts`): the first run gave `5 passed, 1 failed`. The failure was "keyboard only: search → drawer → save → upgrade reaches /pricing". It timed out after 5 s waiting for the `Saved` locator, on a 13.5 s run. As the brief requires, I re-ran that test once alone (`PW_PORT=3811`). It passed in 35.6 s. I judge it a load-related flake, not a fail. The passing paid tests are admin (2 tests), paywall-pages, S7 upgrade and account delete.
- The mock dev server printed a `SyntaxError` for `app/e2e-mock/[...path]/route.ts:175` during the paid run. That route is mock-only and returns 404 in the production build (see item 11).

## 2. Production build: FAIL

Passing parts:
- `pnpm build` with `DEMO_MODE` unset and every key empty exited 0 (`BUILD_EXIT=0`).
- `/pricing` shows "Coming soon" on both paid plan buttons. No dev or demo banner appears on any page.
- `/login` says "Sign-in isn't available yet. You can browse on the Free plan…". "Everything is unlocked" does not appear (`curl -s localhost:3820/login | grep -c "Everything is unlocked"` gives 0). See `docs/screenshots/audit/audit2-login-1440.png`.
- Once the newest scan was at least 15 minutes old, the free tier worked: 25 banded rows on `/`, `/markets`, every `/m/[id]` and `/event/[id]`.

The fail: **the app crashes for its first 15 minutes after a fresh scan.**
- Steps: follow `SETUP.md` on a fresh copy, so `python -m engine scan` writes `output/markets.json` and `output/flags.json` but no `markets-prev.json` or `flags-prev.json`. Then `pnpm build && pnpm exec next start -p 3820`.
- For the next 15 minutes:
  - `/about`, `/m/[id]` and `/event/[id]` return HTTP 500 with the styled error page, "Reference: 2546934538" (`docs/screenshots/audit/audit2-fresh-scan-500-1440.png`).
  - `/api/flags` and `/api/markets` return 503 "Data is temporarily unavailable".
  - `/` and `/markets` render, but show "Couldn't load best bets." (`audit2-fresh-scan-home-1440.png`, `audit2-fresh-scan-markets-1440.png`).
  - The server log says `[store] no markets-prev.json: Free tier can't be served the delayed scan`.
- At about 18:23, when the scan turned 15 minutes old, every page recovered without a restart.
- Cause: `apps/web/lib/data/store.ts:238` (`loadDelayed`) throws when the `-prev` files are missing, and `getStoreFor` (around line 252) passes the error into Server Components. Only `ops/upload.py` writes the `-prev` files, and `SETUP.md` does not run it.
- The same thing happens after every local `engine scan`, so anyone following `SETUP.md` meets a broken app first.

## 3. Every page × every state: PASS

How it was checked:
- `crawl.mjs` (Playwright, Chromium) visits 28 routes plus three `/m/[id]`, one `/event/[id]` and one `/?m=` drawer URL, at 390 and 1440 px. It applies light throttling through CDP (40 ms latency, 10 Mbit/s) and waits 2.2 s between pages so the deliberate rate limit is not hit.
- On each page it records console errors and warnings, page errors, any visible `NaN`, `undefined`, `null` or `[object Object]`, whether the disclaimer is in the footer, horizontal scroll, 5xx and 429 responses, the text "closes in closed" and the text "Everything is unlocked". It then requests every internal link it found.
- States: logged out on the production build (3820); free, pro, premium and admin on the mock server (3830), each with its own seeded storage state.

Results:

| State | Server | Page views | Links checked | Session check | Result |
|---|---|---|---|---|---|
| logged out | production build :3820 | 66 | 100, all 200 | n/a | clean |
| free | mock :3830 | 66 | 101 | `tier=free` at start, after 390 and after 1440 | clean |
| pro | mock :3830 | 66 | 139 | `tier=pro` at start, after 390 and after 1440 | clean |
| premium | mock :3830 | 66 | 282 | `tier=premium` at start, after 390 and after 1440 | clean |
| admin (`admin-audit@example.com`) | mock :3830 | 66 | 107, all 200 | signed in throughout | clean |

- "Clean" means: 0 console errors or warnings, 0 page errors, 0 visible `NaN`/`undefined`/`null`/`[object Object]`, the disclaimer on every page, 0 horizontal scroll at 390 px, 0 responses with status 5xx, 0 responses with status 429, no "closes in closed" and no "Everything is unlocked". The only console lines were the expected "Failed to load resource: … 404" on `/no-such-page` and, for non-admins, on the `/admin*` pages.
- Non-admins (logged out, free, pro, premium) got 404 on all five admin pages (`/admin`, `/admin/users`, `/admin/health`, `/admin/settings`, `/admin/audit`) at both widths: `grep -c '"st":404' logs/crawl-<tier>.log` gives 12 for each (5 routes × 2 widths plus `/no-such-page` × 2). See `audit2-admin-anon-404.png`.
- The admin got 200 on all five admin pages at both widths, with "Signed in as admin-audit@example.com" (`audit2-admin-health-1440.png`).
- Link-check errors that were load timeouts, not app errors, were each re-requested alone with the same session, and all returned 200: free `/alerts?market=6642655&side=0` (ECONNRESET); pro `/account`, `/event/1195475`, `/journal`, `/markets`, `/pricing`, `/privacy`, `/settings` (30 s timeouts); premium `/track-record` (30 s timeout).

Static checks on the shipped code:
- `grep -rnE "TODO|FIXME" apps/web/app apps/web/components apps/web/lib apps/extension/src`: 0 hits.
- `grep -rn "console.log" apps/web/app apps/web/components apps/web/lib apps/extension/src`: 0 hits.
- `grep -rni "lorem" apps/web apps/extension/src --exclude-dir=node_modules --exclude-dir=.next`: 0 hits.

Notes on how the crawl evidence was gathered:
- The first logged-out and free crawls ran inside the 15-minute window after a fresh scan and saw 500/503 on most pages. Those logs were set aside and the crawls re-run after the window. That outage is fail 1, judged under items 2 and 11.
- The first paid crawls reused one saved storage state in two browser contexts. The mock Supabase rotated the refresh token, so the second context was signed out (`refresh_token_not_found` in the mock log). That is an artefact of the test harness, not the app. The crawler was changed to use one context per run, each tier was re-seeded right before its crawl, and `/api/me` was checked at the start and after each width (the "Session check" column).

## 4. Quality: **FAIL**

**Lighthouse** (12.8.2, mobile, default simulated throttling, Playwright's Chromium) on the production build:

| Page | Run A | Run B | Run C | Run D |
|---|---|---|---|---|
| `/` | 72 / 100 / 96 / 91 | 90 / 100 / 96 / 91 | 87 / 100 / 96 / 100 | 91 / 100 / 96 / 91 |
| `/about` | 92 / 100 / 96 / 91 | 92 / 100 / 96 / 91 | 91 / 100 / 96 / 91 | 86 / 100 / 96 / 91 |
| `/pricing` | 94 / 100 / 96 / 91 | 86 / 100 / 96 / 91 | 92 / 100 / 96 / 91 | 89 / 100 / 96 / 91 |

Scores are performance / accessibility / best practices / SEO.
- Accessibility (100), best practices (96) and SEO (91–100) meet the bar on every run. The best-practices deduction is one "Content security policy" inspector issue. The SEO deduction is `meta-description`, which Lighthouse did not find even though the server HTML has it (Next 15 streams metadata), so it is a note, not a fail.
- **Performance is not reliably at or above 90 (fail 6).** Every page scored 90 or more at least once, but each also scored below 90 (`/` 72 and 87, `/about` 86, `/pricing` 86 and 89). The only low audits were Total Blocking Time (300–420 ms) and Largest Contentful Paint (2.3–3.3 s), which are CPU-bound. The machine's load average was 11–37 during these runs and 33–54 afterwards, so an idle re-run was not possible in this session. I cannot show the threshold is met, so the item fails until an idle run confirms it.

**axe.** The e2e a11y spec passed: zero serious or critical violations on 22 pages and on the open drawer.

**Keyboard-only walkthrough** (`kbd.mjs`, production build, logged out):
- The search box is reached in 8 Tabs. Typing and Enter go to `/?q=…`.
- A bet card is reached in 24 Tabs. Enter opens the drawer and puts focus inside it (`audit2-kbd-drawer.png`).
- With the drawer open, 60 Tabs and 20 Shift+Tabs never moved focus outside the dialog (0 escapes).
- Esc closes the drawer, and focus returns to the card that opened it.
- The footer Pricing link is reached in 181 Tabs, and Enter goes to `/pricing` (`audit2-kbd-pricing.png`).
- Logged out, there is no Save button. The signed-in save step is covered by the paid e2e test "keyboard only: search → drawer → save → upgrade reaches /pricing", which passed on its solo re-run (item 1).
- A signed-in free keyboard run on the mock dev server could not be completed: under load, the drawer never got past its loading skeleton, so there was no Save button to reach. The Save step therefore rests on the paid e2e keyboard test above, which passed on its solo re-run.

**Reduced motion.** With `prefers-reduced-motion: reduce` emulated, `document.getAnimations()` returned 0 running animations, and no element had an animation or transition longer than 0.01 s.

**Design review.** I compared the production screenshots (`audit2-home-1440.png`, `audit2-home-390.png`, `audit2-pricing-390.png`, `audit2-kbd-drawer.png`, `audit2-fresh-scan-500-1440.png`) with `docs/design/project/Hybrid.dc.html`, `MobileHybrid.dc.html` and the reference shots in `docs/screenshots/`.
- Alignment, spacing, borders and contrast match the chosen design: dark theme, emerald accent, rounded-xl cards with thin borders, consistent 16 px mobile gutters, and the same card anatomy (league chip, title, "Pays N.Nx", price line, estimated return, market-vs-won bars).
- Truncation on mobile is acceptable: the search placeholder and the topics banner are clipped with an ellipsis, which is the intended single-line behaviour.
- One truncation defect: the market OG image cuts the line "Similar bets won 95% of the time befo…" off at the right edge (`audit2-og-market.png`). That is listed as a fail under item 11.

## 5. Data correctness: PASS

- **Cards equal the API.** `cards.mjs` read all 25 cards on `/` (free) and compared each with the same page's `/api/flags` response: price, pays multiplier, chance and return band. 25 cards, 0 mismatches. Prices under 10¢ are shown to one decimal (for example "3.4¢"), and the script accepts that form.
- **API equals `output/*.json`.** `probe.py` compared the 25 `/api/flags` rows with `output/flags.json` and `output/markets.json`: 0 mismatches. Every banded value contains the exact engine value.
- **Fees and returns on 20 sampled bets.** `fees.py` recomputed the fee, edge and return for both sides of 20 sampled bets (40 sides) with the engine's own formulas from `engine/`. 0 mismatches.
- **Freshness pill.** It read "Updated 8 min ago" when the scan was 7.5 minutes old.
- **Free is capped on the server.** `/api/markets` and `/api/flags` returned 25 rows, with returns as bands, whatever was sent in `ps`, `page_size`, `tier`, an `x-tier` header or a forged tier cookie.
- **Free is delayed on the server.** After a fresh scan, `/api/flags` returned 503 until the scan was 15 minutes old, and then served the previous scan. The delay is in the server response, not the client. (The 503 itself is fail 1.)
- **Free execution data is banded.** The free row's execution block has bands and `stakes: []`.
- **No closed markets.** After the restart, `curl -s localhost:3820/api/flags` returned 25 rows with 0 whose `closes_at` is in the past. `/api/markets?s=closes.asc` also had 0, and the soonest closed 70 s in the future.

## 6. Security: FAIL

**Dependencies (the fail).**
- `cd apps/web && pnpm audit --prod` and `cd apps/extension && pnpm audit` both report 1 high: picomatch ≤ 4.0.7, GHSA-fc5q-39xc-vjpf, "Patched versions: None", via `@sentry/nextjs > @sentry/cloudflare > vite > picomatch`. A full `pnpm audit` in `apps/web` reports 1 high and 1 moderate.
- STATUS.md records this as a lead decision ("build-time only, no upstream fix"). The spec says "`pnpm audit` and `pip-audit` with no high/critical". It has no exception for build-time packages or for advisories without a patch. So item 6 fails on the spec as written. Removing the path (for example by dropping or pinning the Sentry Cloudflare integration, or with a pnpm override once a fix exists) would clear it.
- `pip-audit -r requirements.txt`: "No known vulnerabilities found".

**Admin routes reveal themselves to non-admins (second fail).**
- `/admin`, `/admin/users`, `/admin/health`, `/admin/settings` and `/admin/audit` return 404 to logged-out, free, pro and premium users (crawl rows above, `audit2-admin-anon-404.png`). `GET /api/admin/export` also returns 404.
- But `GET /api/admin` returns **405** (logged out on the production build, and with the free cookie on the mock), and `POST /api/admin/export` returns **405**. A 405 tells a stranger the route exists. The brief says everyone who is not an admin gets a 404.

**Passing parts.**
- *Paid data as free or anon.* Server-capped at 25 banded rows whatever the parameters, headers or cookies (item 5). `/api/markets/7084699` (a flagged market outside the free top 25), fetched logged out, returns each side with `q: null` and `ranges` bands (`roi_pct: [10, 20]`), not the exact model values.
- *Another user's rows.* The PGlite RLS tests in `apps/web/test` pass: user B sees none of user A's rows in any user table, the anon role sees nothing, and admin tables are service-role only. The live check is under Owner verification.
- *Webhooks* (mock server, real `stripe` signature code, `webhook.mjs`):
  - Unsigned body: 400. Wrong secret: 400. Valid signature with a timestamp 1 hour old: 400. Body changed after signing: 400.
  - Replaying a delivered event: `{"duplicate":true}`, no state change.
  - A pro update followed by a replay of an older premium event: the user stays pro.
  - A raw, unsigned `client_reference_id` is ignored, and the subscription event for that customer returns 500 (Stripe will retry) instead of upgrading anyone.
- *Rate limits* (`hammer.py`, production build):
  - `/api/markets` 40 times quickly: 26 × 200, then 14 × 429 with `Retry-After: 4`.
  - `/api/flags` and `/api/markets/6970279` also returned 429 when hammered.
  - 40 requests with a different `X-Forwarded-For` and `X-Real-IP` each: 40 × 429, so header spoofing does not bypass the limit.
  - `/api/suggest` 250 times: 80 × 200, 170 × 429.
  - Distinct-row quota (`rowquota.py`, distinct `q=` searches 2.1 s apart): "call 134 q=Pelicans: 429 after 1452 distinct markets, 301s".
  - `/api/health` returns 503 `{"ok":false,…}` because the in-memory limiter is used without Upstash, as designed.
- *Crawlers.* GPTBot, ClaudeBot, CCBot, PerplexityBot, Google-Extended and Bytespider get 403 from the middleware. HeadlessChrome, python-requests and curl get 200; blocking those depends on Vercel BotID, which only runs on Vercel (Owner verification).
- *Headers* (`curl -I localhost:3820/`): `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `X-Frame-Options: DENY`, `Permissions-Policy`, and a `Content-Security-Policy` with a per-request nonce, `strict-dynamic` and `frame-ancestors 'none'`.
- *Secrets in git history.* gitleaks is not installed, so I ran an equivalent regex scan (Stripe `sk_`/`rk_`/`whsec_`, Supabase JWTs and service keys, PEM private keys, AWS, Google and generic `*_SECRET=`/`*_KEY=` assignments) over `git log --all -p` (225 commits). The only hits were a PEM placeholder in a form label and a test fixture key. Only `.env.example` files were ever committed.
- *Client bundles.* `pnpm check:bundle` printed "116 files in .next/static, no secrets". A manual grep of `.next/static` for `SUPABASE_SERVICE_ROLE`, `STRIPE_SECRET`, `sk_live`, `sk_test`, `whsec_`, `UPSTASH_REDIS_REST_TOKEN`, `RESEND_API_KEY` and `CRON_SECRET` found 0. The extension build also had 0.
- *Cookies.* Auth cookies are `HttpOnly` and `SameSite=Lax`. `Secure` is off on plain-http localhost; `middleware.ts` sets `secure: process.env.NODE_ENV === "production"`, and a unit test asserts `Secure` in production.

## 7. Multipliers and combos: PASS

- **10x bet with a 14% chance and a 4-point edge is in tier 2.** The engine tier tests (17 passed), the e2e multipliers spec and the vitest test "the 10x bet with a 14% chance shows in tier edge" all pass.
- **Combo math against hand-computed cases** (scratch vitest file, not committed):
  - Two legs on different events (ask 0.5, fee 0.0125, q 0.6, q_low 0.55; ask 0.4, fee 0.012, q 0.5, q_low 0.45): price 0.21115, q 0.3, q_low 0.2475, pays 4.735969, return 0.420791, `has_edge` true. Matches.
  - Three identical legs (ask 0.8, fee 0.008, q 0.85, q_low 0.8): price 0.527514, return 0.164187, `has_edge` false because q_low 0.512 is below the price. Matches.
  - Kalshi combo at 30¢ with Q 0.4: fee 2¢ (ceil of 1.47¢), edge 0.08, return 0.25. Matches.
- **Same-event legs are warned.** Two legs from "Game X" give `same_event: ["Game X"]`, which the UI shows as a warning.
- **Losing combos are hidden.** `apps/web/lib/data/combos.ts:43` drops suggested combos whose backtest return is 0 or less.
- **`formatCount` never rounds up.** 999 → "999", 1000 → "1K", 9999 → "9.9K", 99999 → "99K", 999999 → "999K", 1999999 → "1.9M", 1484104 → "1.4M".
- **Raw counts.** `grep -rn "toLocaleString" apps/web/components apps/web/lib` leaves only: `exactCount` (used in hovers and admin pages), the exact contract quantity in `TradeTicket`, a date title, and money formatting in `lib/format.ts:63`. `basis()` now uses `formatCount`, and `MarketDetail.tsx:254` uses `formatCount`. Run 1's raw counts are gone.

## 8. Trading safety: PASS

- **Off without `KALSHI_TRADING_ENV`.** On the production build, `/api/trade/config` returns `{"enabled":false,"env":null}` and `/api/trade/nonce` returns 404 "Trading is off.". The extension popup shows "Paper trading Off" (`audit2-extension-popup.png`).
- **Every order needs a confirm.** `placeOrder` has one call site, the Confirm button handler in `apps/web/components/trade/TradeTicket.tsx` (lines 197–240). Each order also needs a one-time server nonce, so a replayed message cannot place a second order.
- **Caps.** `apps/extension/src/background.ts:146` calls `capError(order, caps, spend)` before signing and refuses the order if it breaks the per-order or daily limit; the spend is reserved at `:150`. `caps.set` (`:201-205`) refuses a per-order limit above the daily limit. `capError` is covered by `apps/extension/test/trade.test.ts` (42 extension tests passed).
- **Keys never leave the extension.** A scratch Playwright spec loaded the built extension with `KALSHI_TRADING_ENV=demo`, imported a test key and placed a demo order. Across 79 requests (the extension origin, `localhost:3812` and `external-api.demo.kalshi.co`), the PEM appeared 0 times and the key id appeared 0 times outside Kalshi. Extension storage held only `{"spend":…}`, and the web page's localStorage held no PEM or key id. Keys are imported as non-extractable WebCrypto keys in IndexedDB.
- **Transfer-scope keys are rejected.** `apps/extension/src/kalshi/trade.ts:80` (`scopeError`) is an allow-list of `read`, `write::trade` and `read::x`. Any other scope, including transfer, is rejected.

## 9. Billing: PASS (mock)

- Checkout → webhook → tier up: the S7 e2e test passed, and `webhook.mjs` showed a signed `checkout.session.completed` plus `customer.subscription.created` taking a user to premium (185 rows visible).
- Portal cancel → tier down at period end: `cancel_at_period_end: true` keeps premium; `customer.subscription.deleted` drops to free.
- Payment Link with `client_reference_id`: a signed reference (`<uid>_<expiry>_<HMAC>`) links the customer and upgrades the user. An unsigned or tampered reference is ignored.
- Duplicate events: the second delivery returns `{"duplicate":true}` and changes nothing.
- Delete account cancels the subscription: `apps/web/lib/auth/delete.ts:13-23` calls `stripe.subscriptions.cancel` before deleting the user, and a failed cancel returns 502 and deletes nothing. The paid e2e S7 test deletes a paying pro account through the UI and reaches `/?deleted=1` with `/api/me` signed out, which can only happen after the mock cancel succeeded.
- The live Stripe test-mode run and the Customer Portal UI are under Owner verification.

## 10. Legal and wording: FAIL

Passing parts:
- `/terms`, `/privacy`, `/refunds`, `/disclaimer` and `/contact` all return 200 and are linked in every page's footer.
- `config/site.json` placeholders still shown (listed, not failed): `[[GOVERNING_STATE]]`, `[[LAST_UPDATED]]`, `[[OPERATOR_NAMES]]` and `[[SUPPORT_EMAIL]]` on `/terms`; the same plus `[[REFUND_POLICY]]` and `[[RESPONSE_TIME]]` on `/refunds`; `[[RESPONSE_TIME]]` on `/contact`; `© 2026 [[OPERATOR_NAMES]]` in every footer.
- The disclaimer "Market analytics, not financial advice. Based on past results. 18+." is in the footer of every crawled page and in the extension popup and side panel.
- The sign-up form requires the 18+ checkbox.
- `/disclaimer` lists 1-800-GAMBLER, 1-800-426-2537 and ncpgambling.org.
- Every email template (`lib/email/templates.ts`, including `paymentFailedEmail`) renders through `layout()`, which adds an Unsubscribe link and the disclaimer. Rendered: `audit2-email-alert.png`, `audit2-email-paymentFailed.png`.
- Banned words: `grep -rniE "\bpick|\block|guarantee|sure thing|can'?t lose"` over `apps/web/app`, `components`, `lib` and `apps/extension/src` finds only code (`Pick<…>`, a `LOCK` icon, `locked` state) and the negation "We give no guarantee". None is a fail.

The fail: **three places still claim expected profit.** The spec says "no claim of guaranteed or expected profit anywhere, including meta tags".
- `apps/web/components/market/MarketCard.tsx:53` labels the return on every compact (mobile) card "expected", so a free user on a phone reads "**+20–50% expected**" (`audit2-home-390.png`). This is the main list on mobile.
- `apps/web/app/tools/page.tsx:5`, the `/tools` meta description: "**Expected-return and bet-sizing calculators for prediction markets.**"
- `apps/web/components/journal/JournalView.tsx:122` and `:131` label a chart line "**Expected at entry**" and its tooltip "**Expected**". This is the user's own P&L journal, so it is weaker, but it still presents model profit as "expected".

Strings I judged and did **not** count as claims (each is labelled as an estimate or a past result):
- "Estimated return +20–50%" (desktop cards); "estimated return, based on past results" (OG image and `/m/[id]` meta).
- "$100 → +$20–50" and "$100 → over +$50" on cards.
- "+14% avg return in testing"; "Est. profit (past results)" (`MarketDetail.tsx` stakes table header).
- "Calculated profit, all bets" with "calculated return … at the win chances you entered" (`Calculators.tsx:208`), which is the user's own inputs.
- "Likely to hit" (a chance band) and "Bets where the odds lean your way".
- Alert email: "estimated return" (`lib/alerts.ts`).

## 11. Publication readiness: FAIL

Passing parts:
- **robots.txt** blocks the AI crawlers and disallows `/api`, `/auth`, `/login`, `/onboarding`, `/account`, `/settings`, `/watchlist`, `/journal`, `/alerts`, `/dashboards` and `/admin`.
- **sitemap.xml** lists the 12 public pages, including `/about` (`curl -s localhost:3820/sitemap.xml | grep -c about` gives 1). It uses the placeholder origin `http://localhost:3000` until the domain is set (Owner verification).
- **No debug routes in production.** `/e2e-mock/*` returns 404, `/api/data` 404, the cron route 401 without its secret, and `/admin` 404. No seeded or test user exists in the production build.
- **Error pages are styled**: the 404 page and the 500 page (`audit2-fresh-scan-500-1440.png`) use the app shell and footer.
- **Favicon and OG.** `/icon.svg` returns 200. `/`, `/about` and `/pricing` have `og:image` and `twitter:image` (`curl -s localhost:3820/ | grep -c og:image` gives 2). `/opengraph-image` is a 1200 × 630 PNG (`audit2-og-site.png`). `/m/[id]` has its own OG image and the meta "Bet Under at 71¢ · +20–50% estimated return, based on past results. Market analytics, not financial advice."
- **Email templates render** (item 10).
- **Extension.** `ME_ORIGIN=http://localhost:3820 pnpm ext:zip` produced a 15-file zip with manifest_version 3, permissions `storage` and `sidePanel` only, no `eval`, no `console.log`. Loaded unpacked in a clean Chromium profile (`ext.mjs`), the service worker registered, the popup and side panel rendered with the disclaimer, there were 0 console errors and storage was empty (`audit2-extension-popup.png`, `audit2-extension-sidepanel.png`).

The fails:
- **`SETUP.md` from scratch does not reach a working app at first.** Following it on a fresh copy reaches a running server, but for 15 minutes after the scan it serves 500s and 503s (fail 1, item 2).
- **The market OG image is cut off.** In `apps/web/app/m/[id]/opengraph-image.tsx:35`, "Similar bets won 95% of the time before…" runs past the right edge of the 1200 px image, so shared links show "befo" (`audit2-og-market.png`).

---

## Fails to fix

1. **Pages crash for 15 minutes after a fresh scan when no `*-prev.json` exists** (items 2 and 11).
   - Where: `apps/web/lib/data/store.ts:234` throws in `loadDelayed`, and `getStoreFor` (`:247-258`) returns that rejection to every caller. The API routes turn it into 503, which is the intended design, but the Server Components for `/about`, `/m/[id]` and `/event/[id]` do not catch it and render the 500 page; `/` and `/markets` show "Couldn't load best bets.".
   - Symptom: on a setup that follows `SETUP.md` (which never runs `ops/upload.py`, the only writer of `*-prev.json`), the app is broken for the first 15 minutes after every local `engine scan`. Server log: `[store] no markets-prev.json: Free tier can't be served the delayed scan`.
   - Repro: on a fresh clone, `python3 -m engine scan && cd apps/web && pnpm build && pnpm exec next start -p 3820`, then within 15 minutes `curl -s -o /dev/null -w '%{http_code}' localhost:3820/about` gives 500 and `curl -s -o /dev/null -w '%{http_code}' localhost:3820/api/flags` gives 503.
2. **High-severity dependency** (item 6).
   - Where: `apps/web/pnpm-lock.yaml` and `apps/extension/pnpm-lock.yaml`: picomatch ≤ 4.0.7 (GHSA-fc5q-39xc-vjpf, high, "Patched versions: None") via `@sentry/nextjs > @sentry/cloudflare > vite > picomatch`.
   - Symptom: the spec requires `pnpm audit` with no high or critical. STATUS.md accepts it as build-time only, but the spec has no such exception.
   - Repro: `cd apps/web && pnpm audit --prod`; `cd apps/extension && pnpm audit`.
3. **Admin API routes answer 405 instead of 404 to non-admins** (item 6).
   - Where: `apps/web/app/api/admin/route.ts` exports only `POST`, and `apps/web/app/api/admin/export/route.ts` exports only `GET`, so Next.js answers the other method with 405 before any admin check runs.
   - Symptom: a logged-out or free user can tell the routes exist. Every other admin URL gives 404.
   - Repro: `curl -s -o /dev/null -w '%{http_code}' localhost:3820/api/admin` gives 405; `curl -s -o /dev/null -w '%{http_code}' -X POST localhost:3820/api/admin/export` gives 405; `curl -s -o /dev/null -w '%{http_code}' localhost:3820/api/admin/nope` gives 404.
4. **Expected-profit wording** (item 10).
   - Where: `apps/web/components/market/MarketCard.tsx:53` (the label "expected" under the return on every compact card, so mobile reads "+20–50% expected"); `apps/web/app/tools/page.tsx:5` (meta description "Expected-return and bet-sizing calculators for prediction markets."); `apps/web/components/journal/JournalView.tsx:122` and `:131` ("Expected at entry", tooltip "Expected").
   - Symptom: the spec forbids any claim of expected profit, including meta tags. The rest of the app already says "estimated" or "past results".
   - Repro: `grep -rn "expected" apps/web/components/market/MarketCard.tsx apps/web/app/tools/page.tsx apps/web/components/journal/JournalView.tsx`; `curl -s localhost:3820/tools | grep -o '<meta name="description"[^>]*>'`; open `/` at 390 px wide.
5. **Market OG image text is cut off** (items 4 and 11).
   - Where: `apps/web/app/m/[id]/opengraph-image.tsx:33-35`. The right column has no width limit or wrapping, so "Similar bets won 95% of the time before" runs past 1200 px.
   - Symptom: shared market links show "Similar bets won 95% of the time befo" (`docs/screenshots/audit/audit2-og-market.png`).
   - Repro: `curl -s localhost:3820/m/6970279/opengraph-image -o og.png` and open `og.png`.
6. **Lighthouse mobile performance not confirmed at or above 90** (item 4).
   - Where: `/`, `/about` and `/pricing` on the production build.
   - Symptom: performance ranged 72–94 over four runs per page (`/` 72, 90, 87, 91; `/about` 92, 92, 91, 86; `/pricing` 94, 86, 92, 89). The only low audits were TBT (300–420 ms) and LCP (2.3–3.3 s). All runs were on a heavily loaded machine (load average 11–54), so the cause may be the machine, not the code.
   - Repro: on an idle machine, `pnpm build && pnpm start`, then `npx lighthouse http://localhost:3000/ --only-categories=performance` (mobile is the default), and the same for `/about` and `/pricing`. If all three give 90 or more on repeated runs, drop this fail.

## Owner verification

These need live accounts, so the mocks can only cover the code path:
- Supabase: run the RLS checks against the live project with the anon key (user B cannot read user A's rows), and send a real magic-link email.
- Stripe test mode end to end: Checkout, webhook delivery to the deployed URL, Customer Portal cancel, and a real Payment Link.
- Upstash: set the Redis keys so the shared limiter replaces the in-memory one and `/api/health` reports ok.
- Vercel BotID: confirm headless browsers and scripted clients are challenged on the deployed site.
- Kalshi demo: place one demo order from the extension with a real demo key.
- Domain: set the site origin so the sitemap, canonical URLs and OG URLs stop using `http://localhost:3000`, and fill the `config/site.json` placeholders.

## Fixed since run 1

Each of run 1's 11 fails was re-checked on `f8adde4`:

1. **"Everything is unlocked" in production: fixed.** `curl -s localhost:3820/login | grep -c "Everything is unlocked"` gives 0; `/login` says "Sign-in isn't available yet. You can browse on the Free plan…". The string remains only in the demo branch of `lib/auth/server.ts:18-22`. No crawled page in any state contained it.
2. **Closed markets shown as bets, "closes in closed": fixed.** `/api/flags` and `/api/markets?s=closes.asc` returned 0 rows with a past `closes_at` (soonest 70 s ahead). `closesLine` in `lib/format.ts` never returns "closed", and no crawled page contained "closes in closed".
3. **Drawer has no focus trap: fixed.** 60 Tabs and 20 Shift+Tabs inside the drawer gave 0 escapes. `DrawerHost.tsx` makes the page behind `inert` and wraps Tab.
4. **Focus not restored after the drawer closes: fixed.** After Esc, focus is back on the card that opened the drawer (keyboard walkthrough, item 4).
5. **No keyboard upgrade path: fixed.** The footer now links `/pricing` (`components/shell/Footer.tsx:16`), reached in 181 Tabs from the top of `/`. The drawer has a "See plans" link, used by the paid e2e keyboard test.
6. **High-severity dependency: not fixed.** picomatch ≤ 4.0.7 is still reported high (Fails to fix, 2).
7. **Raw counts not using `formatCount`: fixed.** `basis()` and `MarketDetail.tsx:254` use `formatCount`; exact counts remain only in hovers and admin pages (item 7).
8. **Expected-profit claims: mostly fixed, not fully.** The `/m/[id]` OG image and meta now say "estimated return, based on past results"; the alert email says "estimated return"; `MarketDetail` says "Est. profit (past results)"; `Calculators` says "Calculated profit". Still present: the `/tools` meta description, the "expected" label on compact cards, and the journal chart (Fails to fix, 4).
9. **Payment-failed email without unsubscribe or disclaimer: fixed.** `paymentFailedEmail` renders through `layout()`; the rendered HTML has the Unsubscribe link and the disclaimer (`audit2-email-paymentFailed.png`).
10. **Sitemap missing /about: fixed.** `curl -s localhost:3820/sitemap.xml | grep -c about` gives 1.
11. **No og:image on main pages: fixed.** `/`, `/about` and `/pricing` have `og:image` and `twitter:image`; `app/opengraph-image.tsx` and `app/twitter-image.tsx` exist and render 1200 × 630 PNGs.

So 9 of run 1's fails are fixed, 1 is partly fixed (8) and 1 is not fixed (6).
