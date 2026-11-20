# Audit: OVERNIGHT §3, run 3

Final audit of Kismet, run 3.

- **Auditor:** a fresh agent that built none of this code. It changed no product code; it only checked and reported.
- **Target:** `final` at `c151ac7` ("Merge branch 'agent/audit2' into final"), checked out as branch `agent/audit3`. That commit includes T-285 (the run 2 fixes) and the MCP server work (T-280 `cdded64`, T-281 `3af67b7`, T-280 `301c83f`).
- **Date:** 2026-11-20.
- **Spec:** `docs/OVERNIGHT.md` §3, items 1–11. Also used: `docs/README.md`, `docs/12-test-plan.md`, `docs/15-security.md`, `docs/01-product.md` (Compliance), `CLAUDE.md`, and the MCP brief (endpoint, tools, plan gates, robots, "try to break it").

**Verdicts:**
- **PASS:** checked and met.
- **FAIL:** not met. Each one gives file:line, a repro and the evidence.
- **BLOCKED:** needs something this environment can't provide (a live Supabase, Stripe, Vercel or Upstash account, or network access to Polymarket). Each one says what would unblock it.

When a mock or unit test covers a check and only the live part is blocked, the check is PASS for what was tested and BLOCKED for the live part. Both are listed.

## Setup

- **Clean clone** `$S/clean4`: `git clone` at `c151ac7`, a new Python venv, `pnpm i --frozen-lockfile` for web and extension. Node 22; pnpm 12.21.0 for web (its `packageManager`) and 10.28.0 for the extension (`item1/pnpm_i.txt`, `item1/ext_i.txt`).
- **Keyless production build** (item 2, the anonymous crawls, Lighthouse, axe): `pnpm build` and `next start -p 3161` under `env -i`, with `DEMO_MODE` off and no keys at all.
- **Wired production build** `$S/clean5` on `:3161`: a second `pnpm build` with `NODE_ENV=production` and the in-repo Supabase and Stripe mock as the backend (`NEXT_PUBLIC_SUPABASE_URL=http://localhost:3160/e2e-mock/supabase`, fake keys, `KALSHI_TRADING_ENV=demo`, `TRADING_ALLOWLIST=audit3-premium@example.com`, `ADMIN_EMAILS=audit3-admin@example.com`). This is a real production server (rate limiter on, per-instance memory store), so signed-in plans, the MCP server and the limits could be tested on a production build for the first time. The env is in `audit-evidence/setup/wired-env.sh` with the fake key bodies redacted.
- **E2E mock** on `:3160`: `E2E_MOCK=1 next dev` from the clean clone (`audit-evidence/setup/mock3160.sh`). It stands in for Supabase (auth, REST, and as the OAuth server for MCP tokens) and Stripe.
- **Seeded users:** created through the mock's magic link, then given a plan by PATCHing `subscriptions` with the mock's service key: Free, Pro, Premium, a beta tester (live comp grant) and the admin. Storage states are not committed (they hold session tokens).
- **MCP tokens:** the mock accepts any JWT whose `sub` is a known user, so "an OAuth access token" here is a JWT carrying a `client_id` claim, minted by the probe. Real issuance (DCR, PKCE, consent, token, revoke) needs Supabase's OAuth server and is BLOCKED.
- Ports 3160 and 3161 only. All browser checks use Playwright Chromium. `$S` is the session scratchpad, not committed.

**Evidence:** everything is under `audit-evidence/`, replaced wholesale for this run (no run 2 files remain; they are in commit `e1b9740`). Helper scripts sit next to their output. Token-like strings are redacted.

## Summary

| # | Item | Verdict |
|---|------|---------|
| 1 | Tests on a clean clone | PASS (one load flake noted) |
| 2 | Production build, no keys | PASS |
| 3 | Every page × every state | **FAIL** (2: 3-b, 3-c). Run 2's 3-a is **fixed** |
| 4 | Quality | PASS (observations) |
| 5 | Data correctness | PASS |
| 6 | Security | PASS for everything testable here (run 2's 6-a is **fixed**); live parts BLOCKED |
| 7 | Multipliers and combos | PASS |
| 8 | Trading safety | PASS |
| 9 | Billing | PASS on the mock; Stripe test mode BLOCKED |
| 10 | Legal and wording | **FAIL** (1: 10-b). Run 2's 10-a is **fixed** |
| 11 | Publication readiness | PASS; engine scan and Chrome Web Store BLOCKED |
| MCP | MCP server (T-280/281) | **FAIL** (2: MCP-a, MCP-b); everything else PASS; real OAuth BLOCKED |

**FAILs:** 3-b, 3-c, 10-b, MCP-a, MCP-b. Details in the FAIL list at the end.

---

## Run 2 FAILs, re-verified

| Run 2 FAIL | Now | Evidence |
|---|---|---|
| **3-a** hydration #418 for visitors outside UTC | **Fixed.** `components/market/When.tsx` renders UTC on the server and local time after hydration. 0 hydration messages on `/`, `/bets`, `/markets`, `/m/:id` in New York and Tokyo, signed out (keyless prod, 2 runs each) and signed in as Free, Pro, Premium, beta and admin (wired prod; also `/account`, `/watchlist`, `/alerts`, `/journal`, `/dashboards`, `/tools`, `/settings`, `/track-record`, admin pages): 148 page loads. After hydration the card shows local time (UTC "Sun 12:00 AM", New York "Sat 7:00 PM", Tokyo "Sun 9:00 AM"). | `item3/hyd-prod-anon.txt`, `item3/hyd-wired.txt`, `item3/hyd-wired2.txt`, `item3/when-local.txt` |
| **6-a** auth email limit vs `docs/15` | **Fixed.** `docs/15-security.md:27` now says 5 per 15 min per email, matching `lib/abuse.ts:19`; `test/ratelimit.test.ts` asserts the window. | `item6/ratelimit-doc.txt` |
| **10-a** unsubscribe missing in auth emails | **Fixed.** All four `supabase/templates/*.html` carry "Unsubscribe from Kismet emails" (to `/alerts`) and the disclaimer; `test/auth-email-templates.test.ts` keeps them in sync with `lib/email/templates.ts:authEmailHtml`. App mail has `List-Unsubscribe` + one-click (`lib/email/index.ts:55`). | `item10/email-checks.txt` |

Note on 3-a: the hydration runs on the wired build also found a different, intermittent #418, on the signed-in 404 page only. It is time-zone independent (seen in UTC) and is filed as **3-b**.

## 1. Tests: PASS

On the clean clone `$S/clean4` at `c151ac7` (`item1/`):

| Check | Result |
|---|---|
| `pip install -r requirements.txt`, `pytest -q` | `66 passed` |
| `pnpm i --frozen-lockfile` (web, extension) | exit 0 |
| `pnpm typecheck` | exit 0 |
| `pnpm lint` (`--max-warnings 0`) | exit 0, no warnings |
| `pnpm test` | vitest 82 files, 541 tests passed (including `test/mcp.test.ts`, `test/app-token.test.ts`); ops node tests 27/27 |
| Extension typecheck + test | exit 0, 42 tests |
| `pnpm e2e` demo config | `56 passed` |
| `pnpm e2e` paid config (`PW_PORT=3160`) | `10 passed` (solo run) |

**Flake (observation, not a fail):** the paid suite ran twice while other heavy jobs shared the machine, and each time one different test failed with `ECONNRESET` from Playwright's `apiRequestContext.get` (`paywall-pages.spec.ts:90` at `/api/flags`; `admin.spec.ts:69` at `/api/kalshi`). The dev server logged no error. Run alone, the suite passed 10/10 (`item1/e2e_paid_rerun2.txt`). Worth a `retries: 1` on the paid config or running it alone in CI.

## 2. Production build, DEMO_MODE off, empty keys: PASS

- `pnpm build` under `env -i` with no keys: exit 0 (`item2/prod-build.txt`).
- Every page serves; `/pricing` shows "Coming soon" for paid plans; no dev banner; no 5xx (item 3 crawl).
- MCP with no keys: `/api/mcp` answers 401 "Sign-in is not configured", and both `/.well-known/oauth-protected-resource*` routes answer 404 (`item2/keyless-mcp.txt`).
- `/api/health` is 503 by design without Upstash (as in run 2).

## 3. Every page × every state: FAIL (2)

**How checked:** `item3/crawl.cjs` (Playwright, 390 and 1440 px, CDP throttling 40 ms / 1.25 MB/s). Per page: console errors and warnings, page errors, failed requests, `NaN`/`undefined`/`null`/`[object Object]`/lorem/TODO/FIXME in visible text, banned words, footer disclaimer, horizontal scroll; then every internal link is fetched (paced). `item3/hyd.cjs` loads a page N times and counts hydration errors. `item3/summ.py` prints the summaries.

| State | Server | TZ | Page loads | Links | Broken | Evidence |
|---|---|---|---|---|---|---|
| Signed out | keyless prod | UTC / New York / Tokyo | 74 each | 66 | 0 | `item3/prod-anon-{utc,ny,tokyo}-summary.txt` |
| Free | wired prod | New York | 74 | 63 | 0 | `item3/wired-free-ny-summary.txt` |
| Pro | wired prod | New York | 74 | 274 | 0 | `item3/wired-pro-ny-summary.txt` |
| Premium | wired prod | New York | 74 | 274 | 0 | `item3/wired-premium-ny-summary.txt` |
| Beta (Premium + live comp) | wired prod | New York | 74 | 276 | **1** (`/kalshi`, see 3-c) | `item3/wired-beta-ny-summary.txt` |

Sessions were confirmed with `/api/me` after the runs (right email and tier, no redirect to `/signup`).

**In every state:** disclaimer in every footer; no `NaN`/`undefined`/`null`/`[object Object]`/lorem in visible text; no horizontal scroll at 390 px; 0 broken links except the beta tester's `/kalshi` (3-c). The only console errors are expected:
- 404s by design: `/admin*` for non-admins, `/combos` and `/kalshi` for non-beta users, `/no-such-page`.
- `/m/*`: `/api/book` 502, because the proxy blocks `clob.polymarket.com` (environment). The page shows "The live order book didn't answer".
- Banned-word hits that are not the banned meaning: `/terms` "We give no guarantee that any estimate is right"; `/track-record` "when you pick a payout" (verb). Listed for the owner because the rule is literal.

**Source:** 0 `TODO`/`FIXME` and 0 `console.log` in `app`, `components`, `lib`, `middleware.ts` (tests excluded) and the extension `src`, including the new MCP files (`item3/todo-grep.txt`).

### FAIL 3-b: intermittent hydration error #418 on the signed-in 404 page

- **What:** `Minified React error #418` (`args[]=HTML`, "server rendered HTML didn't match the client") as a page error on the 404 page, signed in only.
- **Repro:** wired prod, any signed-in plan, `/no-such-page` (or any unknown path) with light throttling (40 ms, 1.25 MB/s). `node item3/hyd.cjs http://localhost:3161 premium /no-such-page 1280 10 out.txt`.
- **Rate** (`item3/hyd-404-rate.txt`): throttled signed in 2/10; unthrottled signed in 0/10; signed out throttled 0/10; `/m/999999999` (a dead market id, which also renders the not-found UI) signed in 0/10. Earlier runs hit it with Free, Pro, Premium and beta, in UTC, New York and Tokyo (`item3/hyd-wired.txt`, `hyd-wired2.txt`, `hyd-saved.txt`, `hyd-404-prem.txt`). Not seen on the dev server (8/8 clean, `hyd-dev-404.txt`), so the message is minified only.
- **What it is not:** the server HTML is deterministic. 10 signed-in fetches are byte-identical once nonces are removed (`item3/h404-determinism.txt`). Not time-zone related.
- **Where:** `apps/web/app/not-found.tsx` rendered in the shell `apps/web/app/layout.tsx:40-46` (`Header`, `Footer`, `MobileNav`, `LazyHosts`). Root cause not isolated. Since it needs a session and slow loading, the likely cause is a client component in the shell whose first render reads auth/session state that `AuthBoot` (`components/shell/LazyHosts.tsx`) can set before the not-found segment finishes hydrating.
- **Fix:** reproduce with a non-minified production build (`next build --no-mangling` or React's dev build) to get the mismatching node; make any shell component that reads client auth/store state render the server value on its first pass (`useSyncExternalStore` with a server snapshot, as `When.tsx` now does). Then re-run `hyd.cjs` 20× signed in.
- **Severity:** low (an unknown URL, signed in, slow network), but §3 item 3 says "no console errors".

### FAIL 3-c: beta testers get a nav link to `/kalshi`, which is a 404

- **What:** a beta tester (live comp grant) sees "Kalshi" in the header and the mobile "More" menu. The link answers 404, because `output/` has no `kalshi.json`.
- **Repro:** wired prod, sign in as the beta tester, open `/` at 390 px, open the menu, click "Kalshi": 404 page. The crawl found it: `BROKEN {'link': '/kalshi', 'from': '/@390', 'status': 404}` (`item3/wired-beta-ny-summary.txt:100-101`; the direct loads at `:25` and `:74` are 404 too). `ls output/` has no `kalshi.json`.
- **Where:** `apps/web/components/shell/nav.ts:31` (`BETA_LINKS` includes `/kalshi`), shown when `canBeta` at `apps/web/components/shell/Header.tsx:53` and `apps/web/components/shell/MobileNav.tsx:17`. Then `apps/web/app/kalshi/page.tsx:14-15` calls `notFound()` when `getKalshi()` (`lib/data/store.ts:310-321`) finds no file.
- **When it happens:** `kalshi.json` is written only by `engine/__main__.py:75` (`pipeline/fetch_kalshi.py`, "no-op unless KALSHI_DATA_PERMISSION=true"). The page comment says testers see Kalshi "even with KALSHI_DATA_PERMISSION off", so for testers the link is broken whenever that permission is off, which is the current state.
- **Fix:** show the link only when the Kalshi data is there (pass a server flag such as `hasKalshi` into the shell), or have `/kalshi` render an empty "no Kalshi data yet" state for testers instead of a 404.
- **Severity:** low (beta testers only), but it is a broken link in §3 item 3.

## 4. Quality: PASS (with observations)

| Check | Result | Evidence |
|---|---|---|
| Lighthouse mobile, median of 3, `TZ=America/New_York` | `/` 94/98/100/91, `/about` 95/100/100/91, `/pricing` 94/100/100/91 (perf/a11y/BP/SEO) | `item4/lighthouse-median.txt`, `item4/lighthouse-runs.txt` (summary of the raw JSON, which was 11 MB and is not committed) |
| axe, signed out, keyless prod: 27 routes × 2 widths (adds `/oauth/consent`, `/m/6654466`) | 0 serious/critical | `item4/axe-prod-anon.txt` |
| axe signed in, wired prod, Free and Premium, 27 routes × 2 widths each | 0 serious/critical | `item4/axe-wired-{free,premium}.txt` |
| Keyboard-only search → drawer → save → upgrade | PASS: `e2e-paid` keyboard spec, in the 10/10 run (item 1) | `item1/e2e_paid_rerun2.txt` |
| Drawer focus trap and Escape | PASS: `e2e/a11y.spec.ts` (item 1) | `item1/e2e_demo.txt` |
| `prefers-reduced-motion` | PASS in code: `app/globals.css:152` turns off animation; not re-run in a browser this time (code unchanged since run 2's browser check, `e1b9740:audit-evidence/item4/reduced-motion.txt`) | |

**Observations:** moderate axe rules only (`heading-order` on `/`, `/bets`, `/m`; `landmark-unique` on `/pricing`). SEO 91 is the `meta-description` audit. A design review against the Chosen design was not repeated (only the MCP UI changed visually: `/account` "Use Kismet in Claude" card and one `/pricing` row, both checked as text in the MCP section).

## 5. Data correctness: PASS

| Check | Result | Evidence |
|---|---|---|
| Fees and returns, 20 sampled flags (new seed 31337) | recomputed with `pipeline.common.taker_fee`: fee, edge, edge_low, ROI match, 0 mismatches | `item5/formulas.txt` |
| API vs `output/*.json`, Pro, wired prod | `/api/markets?ps=50`: 168 rows, 2,352 side fields (ask, fee, win_prob, win_prob_low, edge, edge_low, roi_pct) and `execution`, 0 mismatches | `item5/apicmp.txt`, `item5/apicmp.cjs` |
| Card vs API | `/m/6674492` as Pro shows +30% estimated return, "similar past bets returned +24%", record 95% / +20% / 7.5K: same numbers as `/api/markets/6674492` (roi_pct 30.26, realistic return) and as MCP `get_market` | `mcp/pro-get-market.txt` |
| Free capped in the server response | Free: `/api/flags?ps=1000` → 10 rows, page_size 50; `pg=2` → page 1, the same 10 rows; `/api/markets?pg=99999` → page 1. Pro: `pg=2` → page 2, `pg=99999` → 400. Free `/api/markets/:id` gets ranges (`edge [0.2, null]`, `roi_pct [20, 50]`), no capacity. | `item6/paywall-prod.txt`, `item5/caps.txt` |
| Free delayed in the server response | Fixture `DATA_DIR`: newest scan (every question prefixed `NEWSCAN`) plus `*-prev.json` 20 min older; server clock moved to 5 min after the newest scan (`item5/clock.cjs`). Free: `/api/flags`, `/api/markets`, `/api/markets/:id`, `/`, `/markets`, `/m/:id` contain 0 `NEWSCAN`, `/api/meta` `scanned_at` = the previous scan. Pro and Premium: the same URLs contain `NEWSCAN` (32–201 hits) and the newest `scanned_at`. Signed out: APIs 401, pages show the previous scan. | `item5/free-delay.txt` |

## 6. Security: PASS for everything testable here; live parts BLOCKED

| Sub-check | Verdict | Evidence |
|---|---|---|
| Paid data as anon/Free through the API (wired prod, paced) | **PASS.** Anon: 401 on every data route, `/api/admin/export` 404. Free: 10 rows, paging ignored, ranges only, `/api/kalshi` 404, curve 400. No theta/covariance anywhere. | `item6/paywall-prod.txt`, `paywall.mjs` |
| Another user's rows with the anon key | **BLOCKED** (live Supabase). PGlite `test/rls.test.ts` passed, now including the restrictive "no oauth clients" policy and the 3-session cap. | item 1 |
| Forged webhook | **PASS** (mock): wrong secret, unsigned, garbage, 10-min-old timestamp all 400; a validly signed body claiming premium leaves the tier at pro (tier re-read from Stripe) | `item9/billing-mock.txt` B1–B5 |
| Replayed webhook | **PASS**: second delivery `{"duplicate":true}` | `item9/billing-mock.txt` C1–C2 |
| Rate limits | **PASS** on prod builds. Anonymous: `/api/markets` 429 at 31, `/api/suggest` at 121. Signed in (new this run): Premium `/api/markets` 429 at 61; `POST /api/auth/magic-link` 429 at 6 (5/min/IP); MCP Premium refused at call 61, Pro at call 4. Live Upstash (cross-instance) **BLOCKED**. | `item6/hammer-prod.txt`, `item6/hammer-signedin-prod.txt`, `mcp/mcp-probe.txt` C2–C4 |
| AI crawler / user-agent matrix | **PASS**: training bots 403 everywhere but `robots.txt`; `*-User` agents 200 on public pages and `/llms.txt`, 403 on app pages and APIs; browsers 200 | `item6/ua-matrix-prod.txt` |
| Headless bots | **BLOCKED** (Vercel BotID only runs on Vercel) | |
| Headers | **PASS**: nonce CSP with `strict-dynamic`, HSTS, XFO DENY, nosniff, Referrer-Policy, Permissions-Policy; `/api/mcp` `private, no-store` | `item6/headers-prod.txt` |
| `pnpm audit` | **PASS**: `--prod` clean for web and extension; full web audit 1 moderate (minimatch via eslint, dev only); extension full clean | `item6/pnpm-audit-*.txt` |
| `pip-audit` | **PASS**: no known vulnerabilities | `item6/pip-audit.txt` |
| gitleaks, full history (336 commits) | **PASS**: no leaks with `.gitleaksignore`; without it 18 findings, exactly the 18 ignored fingerprints (all fake fixtures, reviewed in run 2), 0 new | `item6/gitleaks-*.txt` |
| Client bundles | **PASS**: keyless and wired `.next/static` have 0 hits for `e2e-service`, `sk_test_`, `whsec_`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `service_role`, `eyJhbGciOi`, `UNSUBSCRIBE_SECRET`; control: the public anon key value is inlined in 5 `.next/server` files, so the build had the env, and reaches no static file. `check-bundle`: 146 files, no secrets. | `item6/bundle-grep*.txt` |
| Cookies | **PASS, observed** on the production build (new this run): session cookie `sb-localhost-auth-token` and PKCE verifier cookies `Secure; HttpOnly; SameSite=lax`; `me_terms` the same. Live HTTPS domain **BLOCKED**. | `item6/cookies-prod.txt` |
| OAuth consent decision (CSRF) | **PASS**: `POST /api/oauth/decision` 403 with a foreign or missing Origin; 400 on a bad decision; same-origin unknown id 400 "expired or already used"; signed out 401 | `mcp/oauth-decision.txt` |

## 7. Multipliers and combos: PASS

No code in this area changed since run 2 (`git diff cb2f21e c151ac7` touches only MCP, auth, bots, email and the `When` component). The covering tests passed in item 1: `test/multipliers.test.ts:84` (10x, 14%, +4 pts in tier `edge`), `lib/format.test.ts` (round-down), `lib/combos.test.ts` (2- and 3-leg math, same-event warning), `test/multipliers.test.ts:34` (losing combo backtest hides suggestions), e2e `multipliers.spec.ts`. Raw-count grep: only bounded counts (`legs.length`, `step of STEPS.length`, a page's `rows.length`); every total uses `formatCount`/`<Count>`, including the MCP text (`lib/mcp/server.ts:108,184,206`: 2,282 shows as "2.2K", 1,069 as "1K"). Evidence `item7/count-grep.txt`.

## 8. Trading safety: PASS

- **Off unless configured** (wired prod, `item8/trade-prod.txt`): with `KALSHI_TRADING_ENV=demo` but no `NEXT_PUBLIC_EXTENSION_ID`, `/api/trade/config` says `enabled:false` for everyone, the allow-listed user included (`app/api/trade/config/route.ts:9`, RT-14). `/api/trade/nonce` is 403 with a foreign or missing Origin.
- **Keys never leave the extension; transfer scope rejected** (`item8/extension-keys.txt`, `keyinspect.cjs`, extension built for `:3160`, fresh Chromium profile): a trade-only key connects, stored as a non-extractable Ed25519 `CryptoKey` in IndexedDB; 0 requests carry key material; no PEM in `chrome.storage` or page storage. Keys with `write::transfer` or `write::*` are refused with a clear message.
- **Confirm per order, caps, no order without a click:** not re-exercised in a browser here (needs the extension ID trusted by a live deploy). Covered by the passing e2e `trading-paper` spec and `lib/trade/trade.test.ts` (nonce one-time, tamper, expiry) in item 1. The MCP server registers 5 read-only tools and nothing that places an order (`lib/mcp/server.ts:254-274`).

## 9. Billing: PASS on the mock; Stripe test mode BLOCKED

`item9/billing.cjs` against the mock (`item9/billing-mock.txt`):
- A: checkout → signed webhooks → `pro` (trialing).
- B/C: forged and replayed webhooks, as in item 6.
- D: `cancel_at_period_end` keeps Pro; `subscription.deleted` at period end → `free`.
- E: Payment Link with an unsigned `client_reference_id` is ignored (tier stays free; the resulting webhook answers 500 so Stripe retries, as noted in run 2); a signed one → `pro`.
- F: `DELETE /api/account` cancels the Stripe subscription and signs the user out.

**BLOCKED:** Stripe test mode end to end (needs Stripe test keys and a deployed webhook URL).

## 10. Legal and wording: FAIL (1)

| Check | Result | Evidence |
|---|---|---|
| Legal pages present and in the footer | `/terms`, `/privacy`, `/refunds`, `/disclaimer`, `/contact`, `/about` all 200 and linked in the footer; no unfilled placeholders | `item10/legal-prod.txt` |
| Disclaimer on every page, extension popup, MCP results, `/account` MCP card, auth emails, `llms.txt` | PASS (crawls; popup.html in the zip; probe; templates) | item 3, `item11/extension-zip.txt`, `mcp/` |
| 18+ gate at signup | PASS: checkbox "I'm 18 or older…"; the API refuses without it (400 "Tick the box to confirm you're 18 or older…") | `item10/legal-prod.txt` |
| No guaranteed/expected-profit claims in meta, OG, emails | PASS | `item10/meta-og.txt` |
| Responsible-gambling resources on `/disclaimer` | PASS: 1-800-GAMBLER, ncpgambling.org | `item10/legal-prod.txt` |
| Unsubscribe in every email | PASS (10-a fixed) | `item10/email-checks.txt` |
| Banned words | **FAIL 10-b** | below; `item10/banned-grep.txt` |

### FAIL 10-b: "picks" in the onboarding tour

- **Where:** `apps/web/components/onboarding/Tour.tsx:20`: "Results shows how past **picks** actually did, wins and losses, so you can judge the numbers yourself."
- **Repro:** sign in, open `/?tour=1` (or finish onboarding), click Next to step 5 of 5. Screenshot `item10/tour-picks.jpg`, text `item10/tour-steps.txt`.
- **Why it fails:** "pick" is on the banned list, and here it is the noun the rule targets (betting picks). The line predates run 2 (`e5f02175`); run 2 missed it because the tour only shows after onboarding.
- **Fix:** "Results shows how past flagged bets actually did…" (or "past best bets").
- **Also listed (verb, not the banned meaning, but the rule is literal):** `Tour.tsx:13` "Pick how much it pays"; `app/track-record/page.tsx:101` "when you pick a payout"; `app/terms/page.tsx:103` "We give no guarantee…". The owner should decide whether the verb is acceptable; `Tour.tsx:13` could be "Choose how much it pays".

## 11. Publication readiness: PASS; engine scan and Web Store BLOCKED

- **robots / sitemap:** see MCP section for robots. Sitemap: 11 URLs, no `/oauth`, `/api` or app pages (`item11/discovery.txt`).
- **No test users, seed data or debug routes in prod:** `/e2e-mock/*` 404 on the production build; no seed identities in bundles.
- **Error pages styled:** 404 is the shell with header, footer, disclaimer (see 3-b for its hydration flake).
- **Icons and OG:** `/icon.svg`, `/apple-icon.png`, `/opengraph-image`, `/twitter-image` 200; `/favicon.ico` 404 but not linked (observation).
- **Email templates render:** `test/auth-email-templates.test.ts` and the email unit tests passed; the four Supabase templates contain the button, disclaimer and unsubscribe.
- **Extension:** `pnpm build && pnpm ext:zip`, also with `KISMET_ORIGIN=https://kismetodds.com`: MV3, permissions `storage`, `sidePanel`, host permissions only the site and the Kalshi demo API, CSP `script-src 'self'`; the popup carries the disclaimer; loads in a fresh Chromium profile (`keyinspect.cjs`) (`item11/extension-zip.txt`). Chrome Web Store review **BLOCKED**.
- **SETUP.md from scratch:** the clean clone install, tests, build and start work (items 1–2). `python -m engine update` fails at `gamma-api.polymarket.com` (proxy block): **BLOCKED** (`item11/engine-scan.txt`).

---

## MCP server (T-280, T-281): FAIL (2); real OAuth BLOCKED

Black-box probe `mcp/mcp-probe.mjs` against the wired production build, output `mcp/mcp-probe.txt` (labels A1… below). Plus the site-side checks.

### Endpoint and auth

| Check | Result |
|---|---|
| `/api/mcp`, streamable HTTP | PASS: `initialize` 200 (`2025-06-18`), serverInfo + instructions; `tools/list`; JSON or SSE by `Accept`; GET/DELETE 405; `Cache-Control: private, no-store` (B1–B3) |
| Discovery | PASS: `401` carries `WWW-Authenticate … resource_metadata="…/.well-known/oauth-protected-resource/api/mcp"`; PRM lists `resource …/api/mcp` and the Supabase auth server; 404 when Supabase is unset (item 2) |
| Missing / garbage / forged / expired / no-`exp` / Basic / empty `client_id` token | PASS: all 401 (A1–A3, A6–A9) |
| Site session token as bearer, or site cookie at `/api/mcp` | PASS: 401 "Not an OAuth access token" / "Missing Authorization header" (A4, A5) |
| MCP token on the site | PASS: as a cookie, `/api/me` shows signed out, data routes 401, `/account` and `/bets` redirect to `/signup`, `DELETE /api/account` 401; as a bearer header, refused everywhere (E1–E3) |
| Token → user, plan, beta through `getMe()` | PASS: Free/Pro/Premium/beta behave per plan (C, D8) |
| Consent UI | PASS: `/oauth/consent` signed out → `/login?next=…`; no id → "This link is missing its request"; bad id → "This request has expired or was already used"; decision route Origin-checked (`mcp/ui-mcp.txt`, `mcp/oauth-decision.txt`) |
| Real OAuth 2.1: DCR, PKCE, consent approve, token issue, refresh, revoke; AS metadata at `<project>/.well-known/oauth-authorization-server/auth/v1` | **BLOCKED**: needs a Supabase project with the OAuth server on |

### Tools and rules

| Check | Result |
|---|---|
| 5 tools, all `readOnlyHint: true`, `destructiveHint: false`; no banned words in tool metadata | PASS (B2) |
| `best_bets` filters (category, pays min/max, tier, closing within, limit ≤ 25) | PASS: limit 100 → 25 rows; filters work (D1) |
| Same data as the site, no new data | PASS: `best_bets` default and `tier all + sports`, and `search_markets "bitcoin"`, return the same 25 ids in the same order as `/api/flags?g=0` / `/api/markets?g=0` for the same Premium and Pro users (`mcp/d2.txt`). `get_market` for a Pro token matches the Pro site numbers (`mcp/pro-get-market.txt`). |
| `get_market` shows verdict, price check, sample, model level, backtest basis | PASS (D3) |
| `track_record`, `my_list` | PASS: `my_list` keeps the saved order, no re-ranking, another user's row not leaked (D6, D7) |
| Search injection (SQL, regex, HTML, prompt injection, unicode, path traversal) | PASS: treated as text (D4, D5) |
| Free: no access | PASS: all 5 tools refused with a pricing link and the disclaimer (C1) |
| Pro: 3 calls a day, then an upgrade message | PASS: calls 1–3 OK, 4 and 5 "upgrade" (C2); a JSON-RPC batch of 4 is counted per call (C3). Per instance without Upstash: live cross-instance cap **BLOCKED** |
| Premium: unlimited but 60/min | PASS: refused at call 61, "Try again in 57 seconds" (C4) |
| Beta features only for beta users | PASS by code and unit test (`lib/mcp/server.ts:87-88`, `test/mcp.test.ts`): the venue shows Kalshi only when `canBeta`. Black-box: the beta tester gets results; the data has no Kalshi tickers, so the Kalshi branch could not be exercised (D8) |
| Disclaimer at the end of every result | **FAIL MCP-a** (input-validation results) |
| No personalized picks | PASS: same lists for everyone; `my_list` only lists the user's saved markets in saved order |
| Origin handling | **FAIL MCP-b** |
| `/pricing` "Use Kismet in Claude" on Premium | PASS: Premium card "Use Kismet in Claude, ChatGPT and Cursor (read-only connector)"; table row "— / 3 calls a day / Yes" |
| `/account` setup steps | PASS: per plan text (Free "Part of Premium (Pro includes 3 calls a day)", Pro "3 calls a day", Premium "up to 60 calls a minute"), server URL, steps for Claude, Claude Code, ChatGPT, Cursor, disclaimer; no banned words (`mcp/ui-mcp.txt`) |
| robots.txt | PASS: GPTBot, ClaudeBot, CCBot, Google-Extended (and others) `Disallow: /`; ChatGPT-User, Claude-User, Perplexity-User allowed on `/`, `/pricing`, `/about`, `/track-record`, legal pages and `/llms.txt`, then `Disallow: /`; `*` disallows `/api/`, `/oauth` (`item11/discovery.txt`) |
| `/llms.txt` | PASS: exists, carries the disclaimer, MCP URL, tools and plans |

### FAIL MCP-a: input-validation errors come back without the disclaimer

- **Spec:** "every result ends with 'Market analytics, not financial advice. Based on past results. 18+.'"
- **What happens:** when arguments fail the zod schema, the SDK returns a tool result (`isError: true`) such as "Input validation error: Invalid arguments for tool best_bets: limit: Too small: expected number to be >=1". It never reaches `done()` (`apps/web/lib/mcp/server.ts:40`), so it has no disclaimer.
- **Repro** (any token with access): `tools/call best_bets {"limit":0}`; also `limit` 25.5 or `"50"`, `page` 1001, `tier "bogus"`, `categories ["admin"]`, `search_markets` with a 121-character or empty query. `mcp/mcp-probe.txt` D1 and D5 rows marked `endsWithDisclaimer=false`.
- **Where:** schemas at `apps/web/lib/mcp/server.ts:116-117` (`LIMIT`, `PAGE`) and the tool input objects below them; the error text is produced by the SDK's validation before the handler.
- **Fix:** validate inside the handler: register lenient input schemas (or `z.unknown()` fields with `.describe`) and run the strict zod parse in the gated handler, returning `done([...], true)` on failure; or wrap `server.registerTool` so validation failures are re-wrapped with `DISCLAIMER`. Add a `test/mcp.test.ts` case for `limit: 0`.
- **Related observation:** `LIMIT` has no `.max`, so `tools/list` advertises `"maximum": 9007199254740991` while the description says 25. Add `.max(MAX_LIMIT)` (a larger value would then be a validation error, which with the fix above carries the disclaimer) or keep the clamp and advertise 25 in the JSON schema.
- **Not counted as a fail:** an unknown tool name returns a JSON-RPC protocol error (`-32602`, B6), not a tool result.

### FAIL MCP-b: `/api/mcp` does not validate the `Origin` header

- **Spec:** the MCP streamable HTTP transport says servers MUST validate the `Origin` header on all incoming connections (DNS-rebinding protection) and answer 403 when it is present and not allowed. The brief lists "CORS and Origin handling" under "try to break it".
- **What happens:** `POST /api/mcp` with `Origin: http://evil.example` and a valid token returns 200 and the tool list (B4). No CORS headers are sent (OPTIONS 204 without `Access-Control-Allow-Origin`), so a browser page on another origin cannot read the response; and because auth is a bearer token (no ambient cookie), a cross-site page cannot ride a user's session. Practical risk is low; this is a spec-conformance gap.
- **Where:** `apps/web/app/api/mcp/route.ts:23-27` (`serve` authenticates and hands off; no Origin check). The SDK in use exports `originValidationResponse(req, allowedOrigins)`, which is not used.
- **Fix:** in `serve`, before `authenticate`: if an `Origin` header is present and is not the site origin (or an explicit allowlist of client origins), return 403. Requests without `Origin` (server-side MCP clients such as Claude's connectors) stay allowed. Add a test.

### MCP observations (not fails)

1. **No rate limit before auth.** 130 unauthenticated POSTs to `/api/mcp` all got 401, never 429 (`item6/hammer-prod.txt`); each one with a bearer token triggers a Supabase `auth.getUser` call. Add a per-IP limit in front of `authenticate`.
2. **No audience binding.** `requireBearerAuth`/`verifyBearerToken` is used without `expectedResource`, so any Supabase OAuth access token with a `client_id` (for another resource on the same project) is accepted. Acceptable while the project has one resource; set it if more are added.
3. **PRM `resource` on the bare path.** `/.well-known/oauth-protected-resource` (no suffix) also returns `resource: …/api/mcp`. RFC 9728 expects the metadata at the bare path to describe the origin resource. Clients use the suffixed URL from `WWW-Authenticate`, so this works in practice.
4. **`docs/15-security.md` does not list `mcp_premium` (60/min) or `mcp_pro_daily` (3/day)** from `lib/abuse.ts:22-23`.
5. **The restrictive "no oauth clients" RLS policy** (`supabase/migrations/20261120000000_oauth_clients_no_tables.sql`) is applied to the tables that exist when it runs. Tables added later need it again; worth a test that every RLS table has it.
6. **Supabase Auth endpoints with an app token** (for example `PUT /auth/v1/user` to change email or password) are outside what the migration covers; whether Supabase allows that for OAuth-client tokens is **BLOCKED** (needs a live project).

---

## FAIL list

| ID | File:line | Repro | Suggested fix |
|---|---|---|---|
| **3-b** | `apps/web/app/not-found.tsx` in the shell `apps/web/app/layout.tsx:40-46` (root cause not isolated; suspect a shell client component reading auth state set by `AuthBoot`) | Signed in, throttled, `/no-such-page`: #418 in 2/10 loads (`item3/hyd-404-rate.txt`) | Get the unminified diff; give the offending component a server snapshot for its first render; re-run `hyd.cjs` 20× |
| **3-c** | `apps/web/components/shell/nav.ts:31`, `Header.tsx:53`, `MobileNav.tsx:17`; `apps/web/app/kalshi/page.tsx:14-15` | Beta tester, menu → "Kalshi" → 404 (no `output/kalshi.json`) (`item3/wired-beta-ny-summary.txt:100-101`) | Show the link only when the data exists (server flag), or an empty state instead of `notFound()` |
| **10-b** | `apps/web/components/onboarding/Tour.tsx:20` "past picks" | `/?tour=1`, step 5 (`item10/tour-picks.jpg`). Also literal hits, verb use: `Tour.tsx:13` "Pick how much it pays", `apps/web/app/track-record/page.tsx:101` "when you pick a payout" | "past flagged bets" / "past best bets"; verbs: "Choose how much it pays", "when you choose a payout" |
| **MCP-a** | `apps/web/lib/mcp/server.ts:116-117` (+ SDK validation path; `done()` at `:40` bypassed) | `tools/call best_bets {"limit":0}` → isError result with no disclaimer (`mcp/mcp-probe.txt` D1, D5) | Validate in the handler and return through `done()`, or wrap validation errors with `DISCLAIMER`; and advertise the 25 cap in the `LIMIT` schema |
| **MCP-b** | `apps/web/app/api/mcp/route.ts:23-27` | `POST /api/mcp` with `Origin: http://evil.example` + token → 200 (`mcp/mcp-probe.txt` B4) | 403 when `Origin` is present and not allowed (`originValidationResponse` from the SDK); allow absent Origin |

## BLOCKED list

| What | Unblock with |
|---|---|
| Real Supabase OAuth 2.1 (DCR, PKCE, consent approve, token issue/refresh/revoke, AS discovery) | A Supabase project with the OAuth server enabled, the site deployed, and a real MCP client (Claude connector or `claude mcp add`) |
| RLS against a real `client_id` token; another user's rows with the anon key; pgTAP `supabase/tests/rls.test.sql` | Supabase project or local Supabase CLI: `supabase db test`, then REST calls with user A's JWT and an OAuth app token |
| Whether an app token can call Supabase Auth's own endpoints (`PUT /auth/v1/user`) | Live Supabase project |
| Cross-instance rate limits (Pro 3/day, Premium 60/min, site limits) | `UPSTASH_REDIS_REST_*` on a deploy with more than one instance |
| Headless-bot defense | Vercel deploy with BotID and Bot Protection |
| Stripe test mode end to end | Stripe test keys and a deployed webhook endpoint |
| Cookies on the real HTTPS domain | A deploy (flags already observed on the production build) |
| Chrome Web Store review | Store submission |
| Engine scan (`python -m engine all`) and `/api/book` live order book | Network access to `gamma-api.polymarket.com` and `clob.polymarket.com` |

## Observations (not fails)

1. Paid e2e: one `ECONNRESET` flake per run under load (item 1).
2. Moderate axe rules only; Lighthouse SEO 91 on `meta-description` (item 4).
3. `/favicon.ico` is 404 (not linked; `/icon.svg` serves).
4. An unsigned Payment Link checkout leaves a webhook answering 500 for Stripe's retry window (`RetryLater`), as in run 2.
5. `/alerts` signed out (the auth-email unsubscribe target) redirects to `/signup?next=/alerts`; `/login?next=/alerts` would suit a recipient who already has an account.
6. MCP observations 1–6 above.
7. `/api/backtest` answers 200 signed out (the public track record's data); by design, as `/track-record` is public.
