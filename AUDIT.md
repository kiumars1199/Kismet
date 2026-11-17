# MarketEdge final audit, run 1

Auditor: an independent agent that built none of this code. It checked and fixed nothing.
Target: branch `final` at `5b7d177` ("STATUS.md: final build state, flags, owner values, known issues").
Date: 2026-11-17.
Spec: `docs/OVERNIGHT.md` §3, items 1–11.

How the audit ran:
- Every check ran on fresh clones of `origin/final` in a scratch directory, never in the working tree.
- `clean/` was used for tests, e2e, the mock dev server and the extension zip.
- `prod/` was used for `pnpm build` with `DEMO_MODE` unset and every key empty. `pnpm start` served it on port 3320.
- The `E2E_MOCK=1` dev server ran on port 3330. It had paid features on and `KALSHI_TRADING_ENV=demo`.
- No Supabase, Stripe or Kalshi account exists. Where the in-repo mocks fully cover a check, it is marked PASS, and the live step is listed under "Owner verification".

## Summary

| # | Item | Result |
|---|------|--------|
| 1 | Tests | PASS |
| 2 | Production build | **FAIL** |
| 3 | Every page × every state | **FAIL** |
| 4 | Quality | **FAIL** |
| 5 | Data correctness | PASS |
| 6 | Security | **FAIL** |
| 7 | Multipliers and combos | **FAIL** |
| 8 | Trading safety | PASS |
| 9 | Billing | PASS |
| 10 | Legal and wording | **FAIL** |
| 11 | Publication readiness | **FAIL** |

There are 4 passes and 7 fails. The numbered "Fails to fix" list at the end gives file:line, the symptom and a repro for each fail.

---

## 1. Tests: PASS

- **Clean install.** Ran `pnpm i --frozen-lockfile` on a fresh clone of `final` in `apps/web` and `apps/extension`. Exit 0.
- **pytest.** `pytest -q` gave `40 passed` (engine/tests and ops/tests).
- **typecheck.** `pnpm typecheck` in apps/web exited 0.
- **lint.** `pnpm lint` ran with `--max-warnings 0` and exited 0, with zero warnings.
- **unit tests.** `pnpm test` (Vitest): 45 files, 281 tests passed.
- **e2e.** Ran `PW_PORT=3310 pnpm e2e`. Results: 50 passed in the demo project, 3 passed in the paid project, exit 0.
  - Specs covered: S1–S6, S7 (upgrade and account delete), S8 alerts ("Run now fires one alert, running again keeps one"), search, trading-paper, multipliers, headers and a11y.
- **Extension.** In apps/extension, `pnpm test` gave 37 passed, and typecheck exited 0.

## 2. Production build: FAIL

- **PASS: build.** `pnpm build` succeeded with `DEMO_MODE` unset and every key empty (`prod/` clone, `logs/build.log`).
- **PASS: app runs.** The app starts with `pnpm start -p 3320`.
- **Not a crash: /api/health.** It returns 503 with `stale: true`. The bundled data is about 925 min old, and `db` and `ratelimit` are both "off". This is the expected response with no keys.
- **PASS: free tier works.** Anonymous users get 25 rows with ranges instead of exact numbers.
- **PASS: paid buttons.** /pricing shows "Coming soon" twice (Pro and Premium). Screenshot: `docs/screenshots/audit/anon-pricing-1440.png`.
- **PASS: no dev banners.** Grepped the HTML of every page. There is no "Stripe not configured", no "Draft" and no demo banner.
- **PASS: no crashes.** The 56-page crawl on the prod build had no 500s and no error overlays.
- **FAIL: false copy in production.**
  - `/login` and `/account` say "Accounts aren't switched on here. Everything is unlocked and saved in this browser."
  - The text renders whenever `!authEnabled()`, and a production build with empty keys meets that condition.
  - It is false: the same build caps free users at 25 banded rows. A visitor is told everything is unlocked, then sees locked data.
  - This is leftover demo/dev copy. Screenshots: `docs/screenshots/audit/anon-login-1440.png` and `anon-account-390.png`.

## 3. Every page × every state: FAIL

Method: `crawl.mjs` ran Playwright Chromium with CDP throttling (40 ms latency, 10 Mbit/s down).
- It visited 28 routes at 390 and 1440 px, which is 56 page-views per state.
- The routes were every static page, plus 3 `/m/[id]` and 3 `/event/[id]` pages taken from live data, plus `/no-such-page`.
- For every internal `<a href>` found, it requested the link and checked for a 200.
- It also recorded console messages and searched the visible text.

| State | Server | Page-views | Links checked | Result |
|---|---|---|---|---|
| logged out | prod build :3320 | 56 | 124, all 200 | clean, except the expected 404 console line on `/no-such-page` |
| free (seeded via mock magic link) | mock :3330 | 56 | 70, all 200 | clean, except the same expected 404 |
| pro (mock checkout + signed webhook) | mock :3330 | 56 | 109, all 200 | clean, except the same expected 404 |
| premium (mock checkout + signed webhook) | mock :3330 | 56 | 110, all 200 | clean, except the same expected 404 |

- **PASS: no NaN, undefined, null or "[object Object]" on screen.** Checked in every state.
- **PASS: disclaimer.** It is in the footer of every page.
- **PASS: no horizontal scroll at 390 px.**
- **PASS: no lorem ipsum.** Ran `grep -rniE "lorem|ipsum"` over the shipped source: 0 hits.
- **PASS: no TODO or FIXME.** Ran `grep -rnE "TODO|FIXME"` over `apps/web/{app,components,lib}` and `apps/extension/src`: 0 hits.
- **PASS: no `console.log` in shipped code.** The only hit is `apps/extension/scripts/zip.mjs:16`, a build script that is not shipped.
- **Note: dev-only console warnings.** "[Fast Refresh] performing full reload" appeared on the mock dev server. These come from dev mode and never ship.
- **FAIL: cards show "closes in closed".**
  - On the prod home page, Best-bets cards read "Tue 2:45 PM · closes in closed". Screenshot: `docs/screenshots/audit/anon-home-1440.png`.
  - Cause: `/api/flags` still serves markets whose `closes_at` has passed (for example market 6674492, `closes_at` 1794944700), and `closesIn()` (`lib/format.ts:89`) returns the word "closed".
  - The grammar breaks at `BetCard.tsx:59`, `MyList.tsx:78` and `MarketDetail.tsx:136`. A closed market is also still listed as a bet with an edge.
  - It is not only stale data. Right after a fresh `python3 -m engine scan` (`scanned_at` 1794952529), `/api/flags` still returned 9 of 25 rows whose `closes_at` was already in the past.

## 4. Quality: FAIL

- **PASS: Lighthouse mobile.** Two runs per page on the prod build. Scores are performance / accessibility / best practices / SEO; reports are in the scratch `lh/*.json`.
  - `/`: 94/100/96/100, then 96/100/96/91
  - `/about`: 95/100/96/91, then 97/100/96/91
  - `/pricing`: 91/100/96/91, then 94/100/96/91
  - Every score is at least 90. Best practices and SEO lose points on "inspector issues" and the missing meta description.
  - The runs overlapped with the crawl on the dev server. That can only lower scores, so the PASS stands.
- **PASS: axe.** `e2e/a11y.spec.ts` asserts zero serious or critical violations (wcag2a, wcag2aa, wcag21a, wcag21aa). It covers 22 static pages, `/event`, `/m` and the open drawer, and it passed.
- **PASS: reduced motion.** With `prefers-reduced-motion: reduce`, there were 0 running animations and 0 elements with an animation or transition longer than 11 ms (`kbd.mjs`).
- **Keyboard-only walkthrough (search, drawer, save, upgrade).** The free user signed in through the mock magic link.
  - PASS, search: the search box is reached in 8 Tabs, and focus is visible.
  - PASS, search results: ArrowDown plus Enter opens the results.
  - PASS, drawer: Enter on a market opens it.
  - PASS, save: Save is reached in 5 Tabs. Enter shows "Saved", and the row appears in `/api/data` watchlist.
  - PASS, checkout: on `/pricing`, "Start trial" is reached in 18 Tabs. Enter runs checkout, and the tier becomes `pro`.
  - Screenshots: `docs/screenshots/audit/kbd-1-search.png` to `kbd-4-upgraded.png`.
- **FAIL: drawer has no focus trap.**
  - `DrawerHost.tsx:70` declares `role="dialog" aria-modal="true"`, but Tab moves out of the open drawer into the background page.
  - Shown by the auditor's scratch scripts `kbd2.mjs`/`kbd3.mjs` on the prod build: the focused element was outside `[role=dialog]` while the drawer stayed visible.
- **FAIL: focus not restored after Esc.**
  - After the drawer closes with Esc, `document.activeElement` is `BODY`, not the card that opened it.
  - The restore at `DrawerHost.tsx:50` (`prev?.focus?.()`) captures the wrong element when the drawer opens by URL or after re-renders.
- **FAIL: no keyboard upgrade path from the product.**
  - On `/`, the only `a[href="/pricing"]` sits inside a `display:none` dialog. The footer (`/about /terms /privacy /refunds /disclaimer /contact /status`) has no Pricing link, and the drawer has no upgrade link.
  - A keyboard user can only reach the upgrade through "How it works", then `/about`, then "Compare every feature". Shown by the auditor's scratch scripts `kbd4.mjs` and `kbd5.mjs`, which Tab through `/` until focus wraps.
- **Note: Esc once did not close the drawer.** On the mock run, Esc pressed while focus was on Save failed to close it. The same step worked on the prod build, so it is not counted as a fail.
- **PASS: design review.** Screenshots at 390 and 1440 px were compared against `docs/design/project/Hybrid.dc.html` and `MobileHybrid.dc.html`. Cards, borders, spacing, emerald accent and truncation all match.

## 5. Data correctness: PASS

- **PASS: cards match the API.** `cards.mjs` compared the first 9 Best-bets cards on `/` with `/api/flags` (Pays, price in ¢, chance, ROI range): 0 mismatches.
- **PASS: API matches the output files.** The values in `/api/flags` equal `output/markets.json` after free-tier banding.
- **PASS: fees and returns.** `fees.py` sampled 20 bets from `output/flags.json` and recomputed fee, edge and ROI with `engine.scan.taker_fee` and `FEE_RATE`: 0 mismatches.
- **PASS: freshness pill.** It reads "Updated 16 h ago · data may be stale", and `/api/meta` `scanned_at` gives an age of 949 min.
- **PASS: free tier is capped on the server.**
  - `probe.py` and `probe2.py` requested with `ps=200`, `page_size=1000`, `tier=pro` and an `x-tier: premium` header.
  - Every request returned 25 rows with ranges instead of exact values.
  - Market-detail, event and flags responses are banded, and `stakes` is `[]`.
- **PASS: free tier is delayed on the server.** The 15-min delay (`lib/data/store.ts` `DELAY_MIN`) is enforced in the server and covered by `test/delay.test.ts`. It cannot be seen live because the bundled data is already more than 15 min old.

## 6. Security: FAIL

- **PASS: paid data as anonymous or free.** Covered by `probe.py` (item 5). No query parameter or header unlocks exact numbers.
- **PASS: another user's rows with the anon key.** `test/rls.test.ts` runs the real migrations on pglite with the `anon` and `authenticated` roles, and cross-user reads and writes return nothing. A live check is under Owner verification.
- **PASS: forged webhook.** `webhook.mjs` against the mock server:
  - unsigned: 400
  - wrong secret: 400
  - timestamp 1 h old: 400
- **PASS: replayed webhook.** A valid `customer.subscription.created` gives 200 and tier premium. Sending the same event id again gives `{"duplicate":true}`, and the tier is unchanged.
- **PASS: rate limits.** They are off locally because Upstash is not configured. `test/ratelimit.test.ts` covers the limiter, and a live check is under Owner verification.
- **PASS: AI crawlers.** GPTBot, ClaudeBot, CCBot, PerplexityBot and Google-Extended get 403.
- **Owner verification: headless bots.** HeadlessChrome, python-requests and curl get 200 locally, because BotID only runs on Vercel.
- **PASS: headers.** `curl -I` shows:
  - CSP with a per-request nonce, `strict-dynamic` and `frame-ancestors 'none'`
  - HSTS `max-age=63072000; includeSubDomains`
  - `X-Frame-Options: DENY`
  - Referrer-Policy and Permissions-Policy
  - `X-Content-Type-Options: nosniff`
- **PASS: pip-audit.** "No known vulnerabilities found".
- **FAIL: `pnpm audit --prod` has a high.**
  - In apps/web: **1 high**, picomatch 4.0.7 (GHSA-fc5q-39xc-vjpf), via `@sentry/nextjs > @sentry/cloudflare > vite > picomatch`; plus 2 moderate (glob, minimatch).
  - apps/extension has the same high through vite.
  - STATUS.md says there is no high, which is out of date.
- **PASS: secrets in git history.** `secrets.py` is a gitleaks-equivalent regex scan of all 185 commits and 1002 blobs. The only hits are lockfile integrity hashes and the PEM header string in a form label and a test fixture, and only `.env.example` files were ever committed.
- **PASS: client bundles.** `pnpm check:bundle` reports "101 files, no secrets". A manual grep of `.next/static` for `SERVICE_ROLE`, `sk_live`, `sk_test`, `whsec_` and `STRIPE_SECRET` found 0 hits.
- **PASS: cookies.** Session cookies are HttpOnly and `SameSite=Lax`. Secure is off on http localhost, and the unit test asserts Secure in production.

## 7. Multipliers and combos: FAIL

- **PASS: 10x bet in tier 2.**
  - The engine test `test_ten_x_long_shot_is_tier_edge` passes.
  - The e2e multipliers spec also passes: a 10x bet with a 14% chance and +4 pts appears under "More bets with an edge".
- **PASS: combo math.** A scratch Vitest file, not committed, checked hand-computed cases against `combo()` in `lib/combos.ts`. All 4 cases pass.
  - Two legs on different events: ask 0.5, fee 0.0125, q 0.6, q_low 0.55; and ask 0.4, fee 0.012, q 0.5, q_low 0.45. Expected: price 0.21115, q 0.3, q_low 0.2475, pays 4.73597, ret 0.42079, `has_edge` true.
  - Three identical legs (ask 0.8, fee 0.008, q 0.85, q_low 0.8): price 0.527514, q 0.614125, ret 0.164187, `has_edge` false.
  - Two legs on the same event produce the warning `["Game X"]`.
- **PASS: same-event warning.** It appears for legs from the same event. Covered by the e2e spec and checked by hand.
- **PASS: losing combos hidden.** Suggested combos are hidden when the combo backtest ROI is at or below 0 (`lib/data/combos.ts:40`, `test/multipliers.test.ts`).
- **PASS: `formatCount` never rounds up.** 9,999, 99,999, 999,999, 1,999,999, 10,000, 1,484,104 and 1,738,882 give 9.9K, 99K, 999K, 1.9M, 10K, 1.4M and 1.7M.
- **FAIL: raw counts bypass `formatCount`.**
  - `basis()` in `lib/format.ts:110` uses `toLocaleString`, so it prints "4,236 events" and "N eff. samples".
  - That text is shown on screen in the drawer's "Details for pros" (`MarketDetail.tsx:225`) and in tooltips (`:149`, `:155`, `:181`, `:195`).
  - `MarketDetail.tsx:244` also prints a raw count ("All {n} markets in this event").

## 8. Trading safety: PASS

- **PASS: off without the env var.** With no `KALSHI_TRADING_ENV`, `/api/trade/config` returns `enabled:false` on the prod build, and the extension hides trading.
- **PASS: every order needs a confirm.**
  - `placeOrder` has exactly one call site: the Confirm handler in `TradeTicket.tsx`, which shows "Every order needs this confirmation".
  - `test/no-auto-trade.test.ts` passes. It greps for any other call path.
  - The e2e `trading-paper.spec.ts` loads the real MV3 extension with the demo env. Kalshi is mocked at the network layer, and the spec checks `KALSHI-ACCESS-SIGNATURE` against a generated test key.
  - Every order also needs a one-time server nonce.
- **PASS: caps.** The cap and scope tests pass, and over-cap orders are refused before signing.
- **PASS: keys stay in the extension.**
  - `kalshi/vault.ts` imports the PEM as a **non-extractable** WebCrypto key and keeps it in IndexedDB.
  - Code review of every extension `fetch` shows none of them sends the PEM.
  - A clean-profile run of the extension showed empty `chrome.storage`.
- **PASS: transfer-scope keys rejected.** The scope tests pass.

## 9. Billing: PASS

- **PASS: checkout to tier up.** The e2e S7 spec (paid project) passes: checkout, then signed webhook, then the tier rises.
- **PASS: cancel to tier down at period end.**
  - `webhook.mjs`: `cancel_at_period_end` keeps premium, and `customer.subscription.deleted` drops the user to free.
  - After that, a request with a spoofed tier still gets only 25 rows.
- **PASS: Payment Link path.** `checkout.session.completed` with `client_reference_id` gives 200, and the user maps correctly.
- **PASS: duplicate events.** A duplicate event id returns `{"duplicate":true}` and has no effect.
- **PASS: account delete cancels the subscription.** Covered by an e2e spec.

## 10. Legal and wording: FAIL

- **PASS: legal pages.** `/terms`, `/privacy`, `/refunds`, `/disclaimer` and `/contact` all return 200.
- **PASS: footer links.** The footer links `/about /terms /privacy /refunds /disclaimer /contact /status`.
- **Placeholders (listed, not failed).** These come from `config/site.json`: `[[OPERATOR_NAMES]]`, `[[SUPPORT_EMAIL]]`, `[[GOVERNING_STATE]]`, `[[LAST_UPDATED]]`, `[[REFUND_POLICY]]` and `[[RESPONSE_TIME]]`.
- **PASS: disclaimer on every page.** "Market analytics, not financial advice. Based on past results. 18+." appears on every page (crawl) and in the extension popup and side panel (`docs/screenshots/audit/extension-popup.png`, `extension-sidepanel.png`).
- **PASS: 18+ gate.** The 18+ checkbox is required at sign-up (S7).
- **PASS: banned words.** Grepped for `pick|lock|guaranteed|sure thing|can't lose`. The only hits are code identifiers and "We give no guarantee", which is a negation.
- **PASS: responsible-gambling resources.** `/disclaimer` lists 1-800-GAMBLER and ncpgambling.org.
- **FAIL: expected-profit claims.** The spec says "no claim of … expected profit anywhere, including meta tags, OG images and emails". The build makes that claim in:
  - `app/m/[id]/opengraph-image.tsx` and the `/m/[id]` meta description: "Bet Yes at 70¢ · +20–50% expected return" (`docs/screenshots/audit/og-market.png`).
  - The alert email (`lib/alerts.ts:42`): "expected return".
  - On-page copy: `MarketDetail.tsx:332` has an "Expected profit" column, `MarketDetail.tsx:165` says "$100 bet → expect …", and `Calculators.tsx:77` ("$100 bet → expect …") and `:208` ("Expected profit, all bets") use the same wording.
- **FAIL: unsubscribe missing in an email.**
  - The payment-failed email (`lib/billing/stripe.ts:123-126`) has only a `List-Unsubscribe` header. Its body has no unsubscribe link and no disclaimer.
  - The alert email template (`lib/email/templates.ts`) has both.
  - The comment in `lib/email/index.ts` promises an unsubscribe link in every body.

## 11. Publication readiness: FAIL

- **PASS: robots.** `/robots.txt` blocks the AI bots and disallows `/api/` and app-only pages.
- **FAIL: sitemap.** `/sitemap.xml` is missing `/about`. `app/sitemap.ts:5` `PUBLIC_PAGES` leaves it out, even though `/about` exists and the comment at line 1 says to add it once the landing page moves there.
- **Placeholder: sitemap and OG domain.** The URLs use `localhost:3000` because `config/site.json` has no domain yet. This is listed, not failed.
- **PASS: no debug routes in prod.**
  - `/e2e-mock/*` returns 404.
  - Cron routes return 401 without the secret.
  - `/api/data` returns 404 "Accounts are off".
  - No seeded users exist.
- **PASS: error pages.** The 404 page is styled (`docs/screenshots/audit/anon-no-such-page-390.png`). The 500 page (`app/error.tsx`; there is no `global-error.tsx`) was checked in code only, because no route can be made to throw.
- **PASS: favicon.** `icon.svg` returns 200.
- **FAIL: OG images.** `/`, `/about` and `/pricing` have no `og:image`. Only `/m/[id]` has an OG image, and it carries the wording problem in item 10.
- **PASS: email templates render.** The alert email rendered with its unsubscribe link and disclaimer. The payment-failed email gap is item 10. Magic-link emails live in Supabase (Owner verification).
- **PASS: extension.**
  - `ME_ORIGIN=https://example.com pnpm ext:zip` produced 15 files.
  - The MV3 manifest uses minimal permissions (`storage`, `sidePanel`), has a CSP, and has no `eval`.
  - In a clean Chromium profile the extension loaded and its service worker registered. The popup and side panel render with the disclaimer.
  - The popup's `/api/meta` 404 is expected with the fake origin.
- **PASS: SETUP.md from scratch.** On a fresh clone, these SETUP.md local steps ran:
  - `pip install -r requirements.txt` succeeded.
  - `python3 -m engine scan` exited 0 and reported "scanned 16484 markets, 1833 flags".
  - `pnpm i --frozen-lockfile`, `pnpm build` and `pnpm start` led to a running app.
  - Not run: the optional `python3 -m engine all` refit (SETUP.md line 26) and the deploy steps, which need accounts.

---

## Owner verification (needs live accounts)

1. Supabase:
   - RLS against the real project, with an anon key and two real users.
   - The magic-link and Google sign-in email templates.
2. Stripe test mode, end to end:
   - real Checkout
   - the Customer Portal cancel
   - a real `stripe trigger` of a duplicate event
   - a Payment Link with `client_reference_id`
3. Upstash rate limits under a hammer test, and Vercel BotID blocking HeadlessChrome and python-requests.
4. Kalshi demo:
   - a real demo key, with DevTools network and storage inspection while placing a confirmed order
   - rejection of a key with transfer scope
5. After the domain is set: the sitemap and OG URLs on the real domain, and the freshness pill on live data, which will also show the 15-min free delay.

## Fails to fix

1. **False "Everything is unlocked" copy in production.**
   - Where: `apps/web/app/login/page.tsx:35` and `apps/web/app/account/page.tsx:24`.
   - Symptom: a production build with empty keys says everything is unlocked, while free users are capped at 25 banded rows.
   - Repro: `pnpm build && pnpm start -p 3320`, then `curl -s localhost:3320/login | grep -o "Everything is unlocked"`.
2. **Closed markets shown as bets, with the text "closes in closed".**
   - Where: `apps/web/lib/format.ts:89` returns "closed" into `components/market/BetCard.tsx:59`, `components/watch/MyList.tsx:78` and `components/market/MarketDetail.tsx:136`. `/api/flags` does not drop markets whose `closes_at` has passed.
   - Repro: on a fresh clone, run `python3 -m engine scan`, then `pnpm build && pnpm start -p 3320`, then `curl -s localhost:3320/api/flags | jq '[.rows[] | select(.market.closes_at < now)] | length'`. The audit got 9 (of 25). Load `/`: cards read "closes in closed".
3. **Drawer has no focus trap.**
   - Where: `apps/web/components/market/DrawerHost.tsx:70`.
   - Symptom: in the `aria-modal` dialog, Tab moves focus to the page behind it.
   - Repro: open `/?m=6674492` and press Tab about 20 times. `document.activeElement.closest('[role=dialog]')` becomes null.
4. **Focus not restored after the drawer closes.**
   - Where: `apps/web/components/market/DrawerHost.tsx:50`.
   - Symptom: after Esc, focus is on `BODY`, not on the card that opened the drawer.
   - Repro: Tab to a card, press Enter, press Esc, then check `document.activeElement.tagName` (it is BODY).
5. **No keyboard upgrade path from the product.**
   - Where: `apps/web/components/shell/Footer.tsx`, which links /about through /status but not /pricing, and the drawer, which has no upgrade link.
   - Symptom: from `/`, the only focusable Pricing link is inside a `display:none` dialog.
   - Repro: on `/`, run `[...document.querySelectorAll('a[href="/pricing"]')].map(a => getComputedStyle(a.closest('dialog') ?? a).display)` in the console. Every value is `none`. Tab from the top of `/` until focus wraps: there is no `/pricing` stop.
6. **High-severity dependency.**
   - Where: `apps/web` and `apps/extension` lockfiles.
   - Symptom: picomatch 4.0.7 (GHSA-fc5q-39xc-vjpf, high) via `@sentry/nextjs > @sentry/cloudflare > vite`, plus 2 moderate (glob, minimatch).
   - Repro: `cd apps/web && pnpm audit --prod`.
7. **Raw counts not using `formatCount`.**
   - Where: `apps/web/lib/format.ts:110` (`basis()`, which uses `toLocaleString`), shown at `components/market/MarketDetail.tsx:225`, in tooltips at `:149`, `:155`, `:181` and `:195`, and the raw count at `:244`.
   - Symptom: "4,236 events" and "N eff. samples" shown exactly.
   - Repro: open any drawer and expand "Details for pros".
8. **Expected-profit claims in the OG image, meta, email and UI.**
   - Where: `apps/web/app/m/[id]/opengraph-image.tsx` and the `/m/[id]` metadata ("+20–50% expected return"), `apps/web/lib/alerts.ts:42`, `components/market/MarketDetail.tsx:165` and `:332`, and `components/tools/Calculators.tsx:77` and `:208`.
   - Repro: `curl -s localhost:3320/m/6674492 | grep -o 'expected return[^"]*'`.
9. **Payment-failed email has no unsubscribe link or disclaimer in the body.**
   - Where: `apps/web/lib/billing/stripe.ts:123-126`.
   - Repro: `sed -n 123,126p apps/web/lib/billing/stripe.ts`. The `html` is only the message and an account link. The one "unsubscribe" in the block is the `unsubscribeUrl` header option.
10. **Sitemap is missing /about.**
    - Where: `apps/web/app/sitemap.ts:5`.
    - Repro: `curl -s localhost:3320/sitemap.xml | grep -c about` returns 0.
11. **No og:image on the main pages.**
    - Where: `apps/web/app/layout.tsx:22`, whose `openGraph` has no `images`. No `opengraph-image` exists for `/`, `/about` or `/pricing`.
    - Repro: `curl -s localhost:3320/ | grep -c 'og:image'` returns 0.
