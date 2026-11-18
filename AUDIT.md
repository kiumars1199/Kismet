# Audit run 3

MarketEdge final audit, third run.

Auditor: an independent agent that built none of this code. It checked and fixed nothing.
Target: branch `final` at `47e5d3a` ("T-190: picomatch 2.x (eslint dev tooling) also uses the vendored fix; full pnpm audit has no high"), checked out as `audit3`.
Date: 2026-11-17 to 2026-11-18.
Spec: `docs/OVERNIGHT.md` §3, items 1–11.

How the audit ran:
- Every check ran on copies of `origin/final` in a scratch directory, never in the working tree:
  - `clean/` and `prod/` are `git archive` copies.
  - `gclone/` is a real `git clone` at `47e5d3a`. `ops/tests/secrets.test.mjs` needs a git repo, so the unit tests ran here.
- `prod/` was set up by following `SETUP.md` from scratch:
  - a new Python venv and `pip install -r requirements.txt`;
  - `python -m engine scan`;
  - `pnpm i --frozen-lockfile` and `pnpm build`, with `DEMO_MODE` unset and every key empty.
- The production build was served on ports 4220 and 4222. Port 4221 served the same build with the `*-prev.json` files removed, to test the "first update shortly" state.
- A second production build in `gclone/` used `NEXT_PUBLIC_SITE_URL=http://localhost:4250` and was served on port 4250. This follows `ops/ship.md` "Smoke test against a local production build". It was used for `smoke-prod.sh` and Lighthouse.
- An `E2E_MOCK=1` dev server ran on port 4230 with these settings:
  - `ADMIN_EMAILS=admin-audit3@example.com`;
  - `KALSHI_TRADING_ENV=demo`;
  - the paid-config env;
  - the fresh `prod/output`.
- Seeded users (free, pro, premium, admin) were created through the mock magic link and the mock Stripe checkout, which sends a signed webhook. Their cookies were saved as Playwright storage states.
- Only ports 4200–4299 were used.
- The machine was loaded the whole time. The load average was 14–31, mostly from iCloud daemons (fileproviderd, bird, cloudd) plus my own dev server. Every Lighthouse batch records the load.
- No Supabase, Stripe, Upstash, Vercel or Kalshi account exists. A check is marked PASS where the in-repo mocks fully cover it. Each live step is listed under "Owner verification".
- I did not accept docs, STATUS.md, REDTEAM.md or commit messages as proof. I re-checked every claim below myself.
- Scratch helpers stayed in the scratch directory and are not committed. They include `crawl.mjs`, `kbd.mjs`, `probe.py`, `hammer.py`, `webhook.mjs`, a scratch Playwright spec for the extension, and two scratch vitest files.

## Summary

| # | Item | Result |
|---|------|--------|
| 1 | Tests | **FAIL** (fail 2) |
| 2 | Production build | PASS |
| 3 | Every page × every state | PASS |
| 4 | Quality | **FAIL** (fail 5) |
| 5 | Data correctness | **FAIL** (fail 1) |
| 6 | Security | PASS |
| 7 | Multipliers and combos | **FAIL** (fail 3) |
| 8 | Trading safety | PASS |
| 9 | Billing | PASS (mock) |
| 10 | Legal and wording | PASS (placeholders listed) |
| 11 | Publication readiness | **FAIL** (fail 4) |

Fails, in order of severity:
1. The freshness pill shows the newest scan's age to Free users, who see the delayed scan.
2. One paid e2e test fails, and it failed again on its solo re-run.
3. Two raw counts do not use `formatCount`.
4. `ops/vercel-env.mjs` would push the whole shell environment to Vercel.
5. Lighthouse mobile performance is still not at or above 90.

## 1. Tests: FAIL

- `pytest`: 43 passed.
- `apps/web`:
  - `pnpm i --frozen-lockfile`: exit 0.
  - `pnpm typecheck`: exit 0.
  - `pnpm lint --max-warnings 0`: exit 0.
  - `pnpm test` on the git clone: 54 files, 353 tests passed. The ops node tests passed 24 of 24.
  - On an archive copy, `ops/tests/secrets.test.mjs` refuses to run because there is no git repo ("Refusing: git does not ignore .env.secrets-test-…"). This is a note about the copy, not a fail.
- `apps/extension`: `pnpm i --frozen-lockfile` exit 0, typecheck exit 0, 42 tests passed.
- Demo e2e (`pnpm e2e`, PW_PORT 4210): 52 passed (1.6 m). This includes `a11y.spec.ts` (axe on every page plus the drawer and keyboard specs) and `search.spec.ts`.
- Paid e2e (`E2E_MOCK=1`, `playwright.paid.config.ts`, PW_PORT 4211): 4 passed, 2 failed.
  - Passed: `paywall-pages.spec.ts:8`, `s7-upgrade.spec.ts:29` (S7 sign up → upgrade with Stripe → Pro unlocks), `s7-upgrade.spec.ts:59` (account delete), `s7-upgrade.spec.ts:77` (keyboard only: search → drawer → save → upgrade reaches /pricing).
  - Failed: `admin.spec.ts:32` and `admin.spec.ts:69`. Both timed out in the `signIn` helper (`e2e-paid/admin.spec.ts:16-19`). After "Skip setup", the page stayed on `/onboarding?next=%2Faccount` instead of reaching `/account`.
  - Solo re-runs, once each, as the brief requires:
    - `admin.spec.ts:32` on PW_PORT 4212 passed (1.5 m).
    - `admin.spec.ts:69` on PW_PORT 4213 **failed again** (1.3 m) with the same symptom: `Expected pattern: /\/account$/ Received string: "http://localhost:4213/onboarding?next=%2Faccount"`. Load average was about 20–31.
  - What the failing test asserts, a normal user and an anonymous visitor getting 404 on every admin page and API route, is true by my own checks (item 6). The failure is in its sign-in step. A manual repro on the warm mock server reached `/account` on the second "Skip setup" click, so the cause may be the cold dev compile of `/account` under load. Under the brief's rule it is still a fail (fail 2).

## 2. Production build: PASS

- `SETUP.md` §0 from scratch: `pnpm build` gives `BUILD_EXIT=0` with every key empty.
- **Run 2's fail 1 (500 for 15 minutes after a fresh scan) is fixed.**
  - The first scan at 21:56:09 moved the committed output into `*-prev.json`.
  - On a server with the prev files removed (port 4221), within 15 minutes of the scan:
    - `/`, `/markets`, `/about`, `/m/x` and `/event/x` all return 200 with a styled "New prices are on the way… first update shortly" state. Screenshots: `docs/screenshots/audit/audit3-noprev-home-1440.png`, `audit3-noprev-markets-1440.png`, `audit3-noprev-about-1440.png`, `audit3-noprev-m_x-1440.png`, `audit3-noprev-event_x-1440.png`.
    - The API returns 503 `delayed_pending`.
  - The same server recovered without a restart at the 15-minute mark: 200 with normal data at 22:11:28.
- Notes, not fails:
  - In the pending state, the browser console logs one "Failed to load resource: 503" on `/` and `/markets`.
  - The `/markets` subtitle still says "Loading markets…" in that state.

## 3. Every page × every state: PASS

`crawl.mjs` visits every route in each state. It runs at 390 and 1440 px with light network throttling and follows every internal link. On each page it flags:
- console errors and warnings;
- NaN, undefined, null and "[object Object]" on screen;
- lorem ipsum;
- dev banners;
- a missing footer disclaimer;
- horizontal scroll;
- HTTP status 5xx or 429.

The routes are every public page, every account page, `/admin`, `/admin/users`, `/admin/health`, `/admin/settings`, `/admin/audit`, a 404 page, 3 market pages, an event page, an open drawer and a search. That is 33 routes at 2 widths. A 404 counts as expected only where the state should get it (`/admin*` for non-admins).

| State | Server | Views | Issues | Links checked | Bad links |
|---|---|---|---|---|---|
| logged out | prod 4220 | 66 | 0 | 105 | 0 |
| free | mock 4230 | 66 | 0 | 116 | 0 |
| pro | mock 4230 | 66 | 0 | 284 | 0 |
| premium | mock 4230 | 66 | 0 | 284 | 0 |
| admin | mock 4230 | 66 | 0 | 109 | 1 (expected, see below) |

- `/api/me` was checked before the crawl, after the 390 px pass and after the 1440 px pass. The pro, premium and admin re-crawls record the signed-in user and the admin flag. The free crawl ran before the restart below, and its final link pass got 200 from `/api/account/export`, which needs a session.
- The first pro crawl was discarded. Halfway through, the mock dev server printed "⚠ Server is approaching the used memory threshold, restarting...". The restart wiped the mock's in-memory users, so the session went anonymous: `/api/me` became `free`, and `/api/account/export` returned 401.
  - That is a property of the `next dev` mock harness, not of the app.
  - I re-seeded pro, premium and admin and crawled them again. The numbers above are from that second crawl.
  - During the re-crawl, the dev server grew to 3.3 GB and took up to 90 s per page. The premium crawl died on a 30 s `/api/me` timeout, and the admin crawl died on 60 s `goto` timeouts.
  - I restarted the mock server (log `mock-server2.log`), re-seeded premium and admin, and crawled them once more. The premium row above is from that run.
  - The admin crawl on the restarted server crashed in my crawler: a 60 s `goto` timeout on `/m/5747718` at 1440 px, then "Execution context was destroyed" in `page.evaluate`. That page had rendered (h1 and disclaimer present). I raised the crawler's `goto` timeout and made it wait for the load event before reading the page.
  - The next admin crawl finished, but `/api/me` read `nouser:free` at every check. The mock had restarted on its memory threshold again (`mock-server2.log` line 6091) and wiped the seeded admin, so I discarded that run.
  - I re-seeded the admin and crawled once more with no restart in between. The admin row above is from that run. `/api/me` read `free+admin` at all 3 checks.
  - All 5 admin pages (`/admin`, `/admin/users`, `/admin/health`, `/admin/settings`, `/admin/audit`) returned 200 at both widths, with h1 "Admin", the disclaimer, no console errors and no horizontal scroll.
  - The one bad link is `/api/admin/export`, which returned 403 to the crawler's plain GET. That is the deliberate cross-site guard (`sameSiteRequest`, `apps/web/app/api/admin/export/route.ts:22`). I checked it by hand as the admin: no `Sec-Fetch-Site` header gave 403, `Sec-Fetch-Site: cross-site` gave 403, and `Sec-Fetch-Site: same-origin` gave 200 `text/csv` with `content-disposition: attachment; filename="marketedge-users-2026-11-18.csv"` and the expected header row. It is not a fail.
- Screenshots: `docs/screenshots/audit/audit3-<state>-<page>-<390|1440>.png`, for example `audit3-anon-home-390.png`, `audit3-free-markets-1440.png` and `audit3-pro-m_6970277-390.png`.
- Static checks on the shipped code:
  - `grep -rn "TODO\|FIXME"` over `apps/web/{app,components,lib}` and `apps/extension/src` finds 0.
  - `console.log` appears only in `lib/execution.test.ts` (a test) and in Next.js and PostHog third-party bundles.
  - "lorem" appears 0 times.
- Production, logged out: paid buttons say "Coming soon", and there are no dev banners.

## 4. Quality: FAIL

**Lighthouse** (`npx lighthouse@12`, mobile default, simulated throttling, Playwright Chromium 1255) on the 4250 production build. Scores are performance / accessibility / best practices / SEO.

Batch 1. `uptime` before each page: `/` 15.01, `/about` 20.20, `/pricing` 24.39 (1-minute load average).

| Page | Run 1 | Run 2 | Run 3 | Perf median |
|---|---|---|---|---|
| `/` | 81 / 100 / 96 / 91 | 89 / 100 / 96 / 91 | 93 / 100 / 96 / 100 | 89 |
| `/about` | 81 / 100 / 96 / 91 | 82 / 100 / 96 / 91 | 89 / 100 / 96 / 91 | 82 |
| `/pricing` | 93 / 100 / 96 / 91 | 88 / 100 / 96 / 91 | 87 / 100 / 96 / 91 | 88 |

Batch 2, taken during the item 3 re-crawl. `uptime` before each page: `/` 11.38, `/about` 20.07, `/pricing` 28.27.

| Page | Run 1 | Run 2 | Run 3 | Perf median |
|---|---|---|---|---|
| `/` | 86 / 100 / 96 / 100 | 89 / 100 / 96 / 91 | 86 / 100 / 96 / 91 | 86 |
| `/about` | 91 / 100 / 96 / 91 | 96 / 100 / 96 / 91 | 93 / 100 / 96 / 91 | 93 |
| `/pricing` | 94 / 100 / 96 / 91 | 83 / 100 / 96 / 91 | 92 / 100 / 96 / 91 | 92 |

Performance medians over all 6 runs per page:
- `/`: 87.5 (81, 86, 86, 89, 89, 93).
- `/about`: 90 (81, 82, 89, 91, 93, 96).
- `/pricing`: 90 (83, 87, 88, 92, 93, 94).

`/about` was lower in batch 1 than in run 2 (81–89 against 86–92) and higher in batch 2, so the load drives most of the spread. `/` never reached a 90 median in either batch.

- Accessibility (100), best practices (96) and SEO (91–100) meet the bar on every run.
- The best-practices deduction is one "Content security policy" inspector issue. CDP shows it is `kEvalViolation` at `_next/static/chunks/3183-….js:108340`. That is zod v4's JIT probe `try{return Function(""),!0}catch{…}`. The CSP blocks it as intended, and zod falls back. It is a note, not a fail.
- The SEO deduction is `meta-description` on some runs. The server HTML has the tag, but Next 15 streams it into the body: it is at byte 55916, after `</head>` at byte 2370. It is a note, not a fail.
- **Performance on `/` is below 90 (fail 5).** Its median is 89 in batch 1, 86 in batch 2 and 87.5 over all 6 runs. `/about` and `/pricing` reach exactly 90 over 6 runs, but each has single runs of 81–83. The low audits are only Total Blocking Time (215–481 ms) and Largest Contentful Paint (1.6–3.5 s). Both are CPU-bound, and the machine's load average was 11–28 throughout. I cannot show that the threshold is met for `/`, and only barely for the other two.

**axe:** zero serious or critical violations. `e2e/a11y.spec.ts` passed for every page (`/`, `/about`, `/pricing`, `/markets`, `/login`, `/account`, `/onboarding`, `/watchlist`, `/journal`, `/alerts`, and the rest) and for the open drawer.

**Keyboard-only walkthrough** (`kbd.mjs`, production 4222, logged out, `reducedMotion: "reduce"`):
- Pressing `/` focuses the search combobox ("Search a team, city or “3x”"). Typing "barcelona", then ArrowDown and Enter goes to `/?q=FC+Barcelona`.
- A result title link ("Exact Score: FC Barcelona 2 - 1 Villarreal CF?") is reached in 24 Tabs. Enter opens the "Market details" dialog with focus inside it (`audit3-kbd-drawer-1440.png`).
- "Save" is reached in 5 Tabs. Enter toggles it to "Saved", with focus kept and the dialog still open (`audit3-kbd-save-1440.png`).
- After Esc, "Pricing" is reached in 25 Tabs, and Enter goes to `/pricing`. Esc closing the drawer and returning focus is asserted by `a11y.spec.ts:41`, which passed.
- The signed-in variant passed in the paid e2e: `s7-upgrade.spec.ts:77` "keyboard only: search → drawer → save → upgrade reaches /pricing".
- The drawer focus trap and focus return passed in `a11y.spec.ts:41`.

**Reduced motion:**
- `globals.css:136` sets every animation and transition to 0.01 ms under `prefers-reduced-motion: reduce`.
- With the setting emulated, the longest animation-duration and transition-duration on the page were both 0.01 ms, and `matchMedia` matched.

**Design review:** I compared the screenshots (`audit3-anon-home-1440.png`, `audit3-anon-home-390.png`, `audit3-kbd-drawer-1440.png`, `audit3-pro-*`, the OG images) with `docs/design/project/Hybrid.dc.html` and `MobileHybrid.dc.html`.
- They match the chosen design: dark theme, emerald accent, rounded-xl cards with thin borders, 16 px mobile gutters, and the card anatomy (league chip, title, "Pays N.Nx", price line, estimated return, market-vs-won bars, `$100 → +$20–$50`).
- On mobile, the search placeholder and the topics banner end in an ellipsis on one line, as designed.
- I found no misalignment, broken borders or low-contrast text.

## 5. Data correctness: FAIL

- **Free tier is capped and delayed on the server.**
  - `probe.py` sent `ps`, `page` and `tier` parameters, an `x-tier` header and forged cookies to `/api/flags` and `/api/markets`. Every response had at most 25 rows, all banded (ranges, no exact `roi_pct`, `stakes: []`).
  - While the newest scan was under 15 minutes old, the anonymous API rows equalled the `flags-prev.json` scan: 25 checked, 0 mismatched.
- **Cards equal the API.** `cards.mjs` compared every card on `/` with the same page's `/api/flags` rows, checking price, "Pays", "wins about", "Won before" and the return band. 10 matched and 0 mismatched.
- **API values equal `output/*.json`.** `/api/flags` values equal `flags.json` exactly.
- **Fees and returns match the engine formulas.** I recomputed 20 sampled bets (40 sides) as `fee = FEE_RATE[cat]·p·(1−p)`, `edge = q − (p + fee)`, `roi = edge / cost · 100`.
  - All matched.
  - Three low-priced sides differ by 0.02–0.04 roi points. This comes from the 4-decimal rounding of `q` and `fee` in the output.
- No closed market appears as a bet: 0 rows with a past `closes_at`.
- **Freshness pill: FAIL (fail 1).** Free and logged-out users see the delayed scan, but the "Updated N min ago" pill and the "Scanned N min ago" subtitle show the age of the newest scan.
  - `/api/meta` is not tier-aware. On the mock server, anonymous and pro cookies both get `scanned_at 1794970569`.
  - At the same moment, on port 4220, logged-out pages served data from `flags-prev.json` (`scanned_at 1794895125`, about 21 hours older).
  - `audit3-freshness-home-1440.png` shows "Updated 9 min ago" over that 21-hour-old data.
  - How far off the pill is depends on the deployment path:
    - On the engine container path (`SETUP.md` row 10, `ops/scheduler.py` `SCAN_EVERY = 600`, a scan every 10 minutes, a 15-minute delay), Free always sees the previous scan. The pill understates the data's age by roughly 10–25 minutes.
    - On the GitHub Actions path (`.github/workflows/refresh.yml`, cron `17 */2 * * *`), Free sees the previous scan for 15 minutes after each scan. During that window the pill says "Updated 0–15 min ago" over data about 2 hours older.
  - The pill tooltip "A new scan runs about every 2 hours" is right for the Actions path and wrong for the container path.

## 6. Security: PASS

- **Headers** (`curl -I`):
  - `strict-transport-security`, `x-content-type-options: nosniff`, `referrer-policy`, `x-frame-options: DENY` and `permissions-policy` are present.
  - The CSP has a per-request nonce, `strict-dynamic` and `frame-ancestors 'none'`.
- **Admin is hidden** (run 2 fail 3 is fixed):
  - Logged out and as a free user, every `/admin*` page returns 404. `/api/admin` and `/api/admin/export` return 404 for GET, POST, PUT, PATCH and DELETE.
  - The admin user sees `/admin`; this was crawled.
  - `/e2e-mock/*` and `/api/data` return 404. `/api/settle/run` and `/api/alerts/run` return 401 without the secret.
- **Paid data as anon or free:**
  - `/api/markets/<id>` for a market outside the top 25 is banded, with 0 stakes.
  - Combos and events are gated. A paid-as-free replay (`paid_as_free.py`) got only banded rows.
- **Another user's rows:** the PGlite RLS suite `apps/web/test/rls.test.ts` passed 17 tests, including "user B sees none of user A's rows" and "anon sees nothing". Running it against the live project with the anon key is under Owner verification.
- **Rate limits** (in-memory limiter, no Upstash):
  - `/api/markets` ×40 gave 27×200 then 13×429 (`Retry-After: 58`).
  - `/api/flags` ×40 gave 40×429, because that minute was already spent.
  - `/api/suggest` ×250 gave 120×200 and 130×429.
  - A spoofed `X-Forwarded-For` did not reset the limit: 40×429.
  - The row quota returned 429 after 1,440 distinct markets (`Retry-After: 2672`), under the 1,500-row hourly budget.
  - `/api/health` returns 503 `{"ok":false}` without Upstash, which is by design.
- **Crawlers:**
  - GPTBot, ClaudeBot, CCBot, PerplexityBot, Google-Extended and Bytespider get 403.
  - HeadlessChrome, python-requests and curl get 200, because BotID runs only on Vercel (Owner verification).
- **Stripe webhooks** (`webhook.mjs` against the mock server):
  - Unsigned, wrong-secret, one-hour-old timestamp and tampered-body requests all get 400.
  - A replayed event id returns `{"duplicate":true}`.
  - A raw, unsigned `client_reference_id` is ignored.
- **Cookies:**
  - The auth cookies on the mock server are HttpOnly and SameSite=Lax.
  - Secure is set when `NODE_ENV=production`: `middleware.ts:10` has `secure: process.env.NODE_ENV === "production"`, and its unit test passes.
  - The production build sets no cookies at all without Supabase (`curl -D -` on `/`, `/markets` and `/login` on port 4222 shows no `Set-Cookie`). The mock server runs in dev mode, so I could not observe `Secure` on a live response. That check is listed under Owner verification.
- **Dependencies** (run 2 fail 2 is fixed):
  - `apps/web` `pnpm audit --prod`: no known vulnerabilities.
  - `apps/web` full `pnpm audit`: 1 moderate (minimatch, eslint-only).
  - `apps/extension` `pnpm audit`: none.
  - `pip-audit`: none.
- **Is the picomatch advisory really cleared?** Yes.
  - Both lockfiles override picomatch to `file:../../vendor/picomatch`.
  - `vendor/picomatch/lib/parse.js` carries the MarketEdge patch for nested extglob quantifiers.
  - My own fuzz of 17 GHSA-fc5q-39xc-vjpf shapes (`+(*)`, `+(*a)`, `*(*a)`, `+(a|aa)`, `+(+(a))` and others, against 30–5,000-character inputs) ran in 0–1 ms each.
- **Secrets in git history:** a gitleaks-equivalent regex scan of all 250 commits (`secrets_scan.py`) had 21 hits, all obvious fakes:
  - `FAKEFAKE` keys;
  - a test JWT whose signature is the literal string "signature";
  - `whsec_mocksecret`;
  - a PEM placeholder label and a test PEM body `AAAA`.
  - Only `.env.example` and `apps/web/.env.example` were ever added to git.
- **Client bundles:** `pnpm check:bundle` reports "121 files in .next/static, no secrets". My own grep of `.next/static` for `SUPABASE_SERVICE_ROLE`, `STRIPE_SECRET_KEY`, `sk_live_`, `sk_test_`, `whsec_`, `UPSTASH_REDIS_REST_TOKEN`, `CRON_SECRET`, `EXT_SIGNING_SECRET`, `UNSUBSCRIBE_SECRET` and `service_role` found 0.

## 7. Multipliers and combos: FAIL

- **Combo math** (scratch vitest with hand-computed cases): all pass.
  - Two legs: price 0.21115, ret 0.420791, `has_edge` true.
  - Three legs at 0.8: price 0.527514, ret 0.164187, `has_edge` false on `q_low`.
  - Same-event legs: `same_event` is `["Game X"]`.
  - Kalshi combo at 30¢ with Q 0.4: fee 0.02, edge 0.08, ret 0.25.
- **The multiplier tests pass**, including "the 10x bet with a 14% chance shows in tier edge" and "hides a leg count that lost money in testing".
- **`formatCount` never rounds up:** 999, 1K, 1.9K, 9.9K, 99K, 999K, 1.9M, 1.4M and 9.9B for 999, 1000, 1999, 9999, 99999, 999999, 1999999, 1484104 and 9,999,999,999.
- **Raw counts (fail 3):** two places print counts without `formatCount`.
  - `components/search/SearchCombobox.tsx:132` prints `` `${e.count} open` ``. The next line formats topic counts with `formatCount`. The largest entity count I saw was 104 ("San Jose State"), so it can pass 999.
  - `components/journal/JournalView.tsx:88` prints `String(s.bets)`. The journal has no limit for Pro and Premium.

## 8. Trading safety: PASS

- **The production build has trading off.**
  - `/api/trade/config` returns `{"enabled":false,"env":null}`.
  - `/api/trade/nonce` returns 404 "Trading is off.".
  - Nonce verification returns 404.
- **Scratch spec with the real extension** (`e2e-audit/trade-audit.spec.ts`): demo build on PW_PORT 4241, the extension built with `ME_ORIGIN` and loaded in a clean Chromium profile, and Kalshi's demo API mocked with real Ed25519 signature checks. 1 passed (1.3 m). The first attempt failed only because my spec expected the over-cap check on the confirm screen. The ticket blocks it earlier, so I fixed the spec and re-ran it.
  - A key that also has `write::transfer` is rejected: "This key also allows write::transfer. For safety MarketEdge only accepts trade-only keys…" (`audit3-ext-transfer-scope-rejected.png`).
  - A $40 order at 5¢ against the default $25 per-order cap: the ticket shows "Over your $25 per-order limit." and "Review order" is disabled. 0 orders reached Kalshi (`audit3-ext-cap-refused.png`). The extension enforces the same cap in `capError` (`apps/extension/src/kalshi/trade.ts`, unit tested in `test/trade.test.ts`).
  - Every order needs a confirm: 0 orders at Kalshi on the confirm screen, 1 after "Place paper order".
  - The key never leaves the extension:
    - 69 requests went to 3 hosts (the extension, the app, demo Kalshi). The PEM appeared in 0 of them, and the key id appeared in 0 requests outside Kalshi.
    - Extension storage held only `{"spend":{"cents":198,…}}`.
    - Page `localStorage` and `sessionStorage` held neither the PEM nor the key id.
- `scopeError` unit tests cover `write`, `write::transfer`, `write::fcm_risk`, a missing `read`, and case and whitespace variants.

## 9. Billing: PASS (mock)

These ran with signed webhooks against the mock server (`webhook.mjs`), using the paid e2e Stripe mock:
- A signed `client_reference_id` linked the customer, then the account became premium.
- A replay of the same event returned `{"duplicate":true}`.
- `cancel_at_period_end` kept premium until the end of the period.
- `customer.subscription.deleted` dropped the account to free.
- Account delete with a live subscription cancels it: `s7-upgrade.spec.ts:59` passed.

S7 (sign up → Checkout → webhook → Pro unlocks) passed in the paid e2e.

Observation, not a spec fail: there is no event-ordering check in `lib/billing/stripe.ts` `handleEvent`. An older subscription event with a different id, delivered late, overwrites newer state. In my test pro became premium. That refutes run 2's note that the user "stays pro".

## 10. Legal and wording: PASS

- **Footer:** the disclaimer "Market analytics, not financial advice. Based on past results. 18+." is on every crawled page in every state. It also appears in the extension popup (`audit3-ext-popup.png`) and in every email.
- **Legal pages:** `/terms`, `/privacy`, `/refunds`, `/disclaimer`, `/contact` and `/status` all return 200. The footer links all of them, plus How it works and Pricing.
- **Responsible gambling:** `/disclaimer` names 1-800-GAMBLER and the National Council on Problem Gambling (ncpgambling.org).
- **18+ at sign-up:**
  - The `/login` checkbox "I'm 18 or older and agree to the Terms" is `required`.
  - The server enforces it with `accept: z.literal(true)` in `app/api/auth/magic-link/route.ts:14`. `accept:false` gives 400 "Enter a valid email and tick the box".
  - The OAuth callback redirects to `/login?error=terms` without it.
- **Emails** (rendered with a scratch vitest, screenshots `audit3-email-alert_html-600.png`, `audit3-email-signin_html-600.png` and `audit3-email-payfail_html-600.png`): the alert, sign-in and payment-failed templates all go through `layout()`. Each has the Unsubscribe link and the disclaimer, in both the HTML and the text part. The alert text reads "Yes at 68¢ · won 92% before · estimated return +33% · …".
- **Banned words** (`words.py` over 17 rendered pages, plus a source grep):
  - "pick", "lock", "guaranteed", "sure thing" and "can't lose" do not appear in any shipped UI text.
  - `/admin`: `words.py` runs logged out, where `/admin*` is a 404, so it does not cover the admin pages. The signed-in admin crawl (item 3) found the disclaimer on all 10 admin views (5 pages at 2 widths). Its token check covers placeholder text only, not the banned words. For those, `grep -rniE "\b(picks?|locks?|locked|guaranteed?|sure thing|can.?t lose|expected)\b" app/admin components/admin` finds 0 matches in the 10 admin source files.
  - The only hits are code identifiers and the negation on `/terms`: "We give no guarantee that any estimate is right…".
- **Expected-profit wording, judged.** No rendered page contains "expected". These are the strings I judged:
  - "+14% avg return in testing" (home stats);
  - "Estimated return +20–50%" and "$100 → +$20–$50" (cards);
  - "+0–5% estimated return, based on past results … Past results: +$0–$5 per $100 bet" (`/m/[id]`);
  - "Average profit per dollar staked, after Polymarket's fee…" and "If you made this kind of bet many times, this is the average profit per dollar, based on how similar past bets resolved" (`/about`, `/track-record`, `/tools`);
  - "Estimated at entry" (journal chart);
  - "Bet-sizing and estimated-return calculators for prediction markets, based on past results." (`/tools` meta).

  Each is framed as an estimate or a past result. None claims an expected profit, so they pass. I also judged the chip "Likely to hit" (shown for bets with a high win chance). It is not on the banned list and describes the win chance, not profit, so it is acceptable.
- **Placeholders** (listed, not failed): `config/site.json` has empty `domain`, `support_email`, `legal.operator_names`, `governing_state`, `mailing_address`, `refund_policy`, `response_time`, `last_updated`, and the four Stripe payment links and `portal_url`. They render as:
  - `/terms`: `[[GOVERNING_STATE]]`, `[[LAST_UPDATED]]`, `[[OPERATOR_NAMES]]`, `[[SUPPORT_EMAIL]]`;
  - `/privacy`: `[[LAST_UPDATED]]`, `[[OPERATOR_NAMES]]`, `[[SUPPORT_EMAIL]]`;
  - `/refunds`: adds `[[REFUND_POLICY]]` and `[[RESPONSE_TIME]]`;
  - `/disclaimer`, `/contact`, `/status`: `[[OPERATOR_NAMES]]`, plus `[[LAST_UPDATED]]`, `[[RESPONSE_TIME]]` and `[[SUPPORT_EMAIL]]` where used;
  - the footer: "© 2026 [[OPERATOR_NAMES]]".

## 11. Publication readiness: FAIL

- **robots.txt:** 200. It disallows 28+ AI user agents and the private routes (`/auth/`, `/login`, `/onboarding`, `/account`, `/settings`, `/watchlist`, `/journal`, `/alerts`, `/dashboards`, `/admin`), and it carries a `Sitemap:` line.
- **sitemap.xml:** 200, with 12 `<loc>` entries, `/about` included. Without `NEXT_PUBLIC_SITE_URL` they point at `http://localhost:3000`. With it set (the 4250 build), they point at the right origin.
- **404:** a styled page ("This page doesn't exist", with links to Best bets and All markets), plus the header, footer and disclaimer.
- **500:** a styled error boundary, read in source but not triggered in production. `app/error.tsx` shows "500", "Something went wrong on our side", a status-page link, "Try again" and "Go to Best bets" inside the shell. There is no `app/global-error.tsx`, so an error in the root layout itself would fall back to Next's default page. That is a note, not a fail.
- **Favicon:** `<link rel="icon" href="/icon.svg">` returns 200 `image/svg+xml`. `/favicon.ico` itself returns 404, which is harmless because the link tag is present.
- **OG images** (run 2 fail 5 is fixed):
  - `/opengraph-image` returns 200 PNG (`audit3-og-site.png`).
  - The longest title in the scan, "Will Jean-Michel Basquiat's “Untitled (Leonardo and His Five Grotesque Heads)” sell for between $40m and $50m at auction?" (121 characters), wraps and ends with a clean ellipsis (`audit3-og-longest-6766310.png`).
  - A 95% market (`audit3-og-high-6970277.png`) and a two-line title (`audit3-og-long-6742228.png`) render with nothing cut off.
- **Extension:**
  - `ME_ORIGIN=https://marketedge.example pnpm ext:zip` wrote `marketedge-extension-0.1.0.zip`.
  - Unzipped manifest: MV3; permissions `storage` and `sidePanel` only; host permissions are the app origin and `external-api.demo.kalshi.co`; extension pages CSP `script-src 'self'`.
  - It contains 0 `eval(` and 0 `new Function`, and no remote code.
  - Loaded in a clean Chromium profile, the service worker registered. The popup rendered "Signed out … Paper trading Off … Market analytics, not financial advice. Based on past results. 18+." (`audit3-ext-popup.png`). Its only console error is the expected DNS failure for the placeholder domain.
- **Owner scripts, default dry-run mode:**
  - `node ops/secrets.mjs`: "Dry run (add --yes to write)". It lists the three secrets it would generate. Exit 0.
  - `node ops/site-config.mjs --domain … --yes`-less run: shows the diff. Exit 0, and `config/site.json` is unchanged (`git status` clean).
  - `node ops/stripe-setup.mjs --domain marketedge.example`, with no key: prints the plan (4 prices, 2 products, webhook with 5 events, portal). Exit 0.
  - `node ops/preflight.mjs`: 24 blockers and 6 warnings, all expected on an unconfigured clone (missing env keys, `ADMIN_EMAILS`, the `site.json` fields). Exit 1, as designed.
  - `bash ops/supabase-setup.sh abcdefghijklmnopqrst`: prints the 4-step plan and the dashboard checklist. Exit 0.
  - `python ops/checks.py prod/output`: "data checks ok", exit 0.
  - `python ops/upload.py` without credentials: "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required", exit 1, uploads nothing.
  - Not run: `ops/lib.mjs` is a shared library, not a script, and `ops/redteam/` is the red-team harness, not an owner script.
  - `ops/scheduler.py` has no dry-run mode (`--once` runs a real tick). I evaluated `plan()` without running any job: on a fresh clone it plans `bootstrap, update, fit, grade, scan`, and after a fit and a backtest it plans `bootstrap, scan`.
  - **`node ops/vercel-env.mjs` (fail 4).** With no `apps/web/.env.prod` or `.env.local`, it falls back to the whole process environment (`ops/lib.mjs:49`). It then plans to push every non-empty variable: "Dry run (add --yes to run): 138 commands from process environment".
    - The planned commands include `PATH`, `HOME`, `PWD`, `OLDPWD`, `SHELL`, `TMPDIR`, `SSH_AUTH_SOCK`, `HOMEBREW_*` and the agent's session variables, including `CLAUDE_CODE_MESSAGING_TOKEN`.
    - `--yes` is refused only while preflight has blockers. Preflight reads the same process environment, so an owner who exports the real keys in their shell would pass preflight.
    - That run would then push their shell environment, tokens included, to Vercel Production and Preview. It would also override `PATH` and `HOME` there.
- **`ops/smoke-prod.sh`:**
  - Against port 4222 (built without `NEXT_PUBLIC_SITE_URL`): 16 passed, 2 failed. The two fails are `/api/health → 200 (got 503)` and `og:image http://localhost:3000/… (got 000)`. Both are expected for that build.
  - Run the documented way (`ops/ship.md` "Smoke test against a local production build": `DEMO_MODE=false NEXT_PUBLIC_SITE_URL=http://localhost:4250`, `SMOKE_EXPECT_HEALTH=503 ops/smoke-prod.sh http://localhost:4250`): **18 passed, 0 failed**.
- **`SETUP.md` from scratch** works (item 2).

## Fails to fix

1. **The freshness pill and "Scanned N ago" show the newest scan's age to Free and logged-out users, who see the delayed scan** (item 5).
   - Where:
     - `apps/web/components/header/FreshnessPill.tsx:18` reads `scanned_at` from `/api/meta`.
     - `apps/web/components/screener/BestBets.tsx:246` renders "Scanned {ago(scanned)}".
     - `apps/web/app/api/meta/route.ts` is not tier-aware: it uses `getStore()`, not `getStoreFor(tier)`.
     - The pill tooltip hard-codes "A new scan runs about every 2 hours". That is true for `refresh.yml` but not for the 10-minute engine container.
   - Symptom: logged out, the pill said "Updated 9 min ago" while the cards came from a scan 21 hours older (`docs/screenshots/audit/audit3-freshness-home-1440.png`). In production the pill understates the age of Free data:
     - by about 10–25 minutes on every Free page with the engine container;
     - by about 2 hours during the 15 minutes after each scan with the Actions refresh.
   - Repro:
     1. Run `python -m engine scan` on a copy that already has output, which leaves a `*-prev.json`.
     2. Start `pnpm build && pnpm exec next start -p 4220` with `DEMO_MODE` unset.
     3. Compare `curl -s localhost:4220/api/meta | jq .meta.scanned_at` with `jq .meta.scanned_at output/flags-prev.json`. The anonymous `/api/flags` rows match the prev file, but the pill shows the meta age.
2. **Paid e2e `admin.spec.ts:69` fails, including its solo re-run** (item 1).
   - Where: the `signIn` helper in `apps/web/e2e-paid/admin.spec.ts:16-19`. After "Skip setup", the page stays on `/onboarding?next=%2Faccount` for the whole 60 s `toPass` window.
   - Symptom: in the full run, `:32` and `:69` failed. In solo re-runs, `:32` passed and `:69` failed again: `Expected pattern: /\/account$/ Received string: "http://localhost:4213/onboarding?next=%2Faccount"`. Load average was 20–31.
   - What the test asserts (404 for non-admins) holds by direct checks (item 6), so this may be the cold dev compile of `/account` under load. It still has to pass.
   - Repro: `cd apps/web && PW_PORT=4213 pnpm exec playwright test -c playwright.paid.config.ts e2e-paid/admin.spec.ts:69`.
3. **Raw counts without `formatCount`** (item 7).
   - Where:
     - `apps/web/components/search/SearchCombobox.tsx:132`: `` `${e.count} open` ``.
     - `apps/web/components/journal/JournalView.tsx:88`: `String(s.bets)`.
   - Symptom: an entity with 1,000 or more open markets would show "1234 open". A journal with 1,000 or more bets shows "1234", where the spec requires "1.2K". The topic count on the next line (`:133`) already uses `formatCount`.
   - Repro: `grep -n "e.count} open\|String(s.bets)" apps/web/components/search/SearchCombobox.tsx apps/web/components/journal/JournalView.tsx`.
4. **`ops/vercel-env.mjs` would push the whole shell environment to Vercel** (item 11).
   - Where: `ops/lib.mjs:49` (`return { env: { ...process.env }, source: "process environment", file: null }`) together with `commands()` in `ops/vercel-env.mjs:19-30`, which pushes every non-empty key that is not in `SKIP`.
   - Symptom: with no env file, the dry run plans 138 `vercel env add` commands, including `PATH`, `HOME`, `SSH_AUTH_SOCK` and session tokens such as `CLAUDE_CODE_MESSAGING_TOKEN`. With `--yes`, once preflight passes (for example, keys exported in the shell), it would push all of them, unmasked, to Production and Preview.
   - Existing guards:
     - The header prints "from process environment".
     - The full command list prints before the push loop starts (`vercel-env.mjs:44-45` vs `:55`).
     - `--yes` refuses while preflight has blockers.
     - On the documented path, `ops/secrets.mjs` (ship.md step 3) creates `.env.prod` first, so the fallback fires only off-script.
   - Even so, a silent fallback to the whole of `process.env` in a push-to-production tool is unsafe. It should use an allow-list (the keys in `.env.example`) or refuse when no env file exists.
   - Repro: in a clone without `apps/web/.env.prod` or `.env.local`, run `node ops/vercel-env.mjs | head -3` and `node ops/vercel-env.mjs | grep -c "vercel env add"`.
5. **Lighthouse mobile performance not at or above 90** (item 4; run 2's fail 6, still open).
   - Where: `/`, `/about` and `/pricing` on the production build.
   - Symptom: over 2 batches of 3 runs, the performance medians were 87.5 for `/` (81–93), 90 for `/about` (81–96) and 90 for `/pricing` (83–94). `/` was below 90 in both batches (89 and 86). The only low audits are TBT (215–481 ms) and LCP (1.6–3.5 s). The load average was 11–28, so the machine may be the cause, but I cannot show that the threshold is met.
   - Repro: on an idle machine, build with `DEMO_MODE=false NEXT_PUBLIC_SITE_URL=http://localhost:4250 pnpm build` and start it, then run `npx lighthouse@12 http://localhost:4250/` (mobile default) three times, and the same for `/about` and `/pricing`. If every median is 90 or more, drop this fail.

## Fixed since run 2

I re-checked each of run 2's 6 fails on `47e5d3a`:

1. **Pages crash for 15 minutes after a fresh scan: fixed.** With no `*-prev.json`, every page returns 200 with a styled "first update shortly" state, the API returns 503 `delayed_pending`, and the server recovers by itself at 15 minutes (item 2).
2. **High-severity dependency (picomatch): fixed.** It is vendored with a working ReDoS patch, and 17 attack shapes run in at most 1 ms. `pnpm audit --prod` is clean for web and extension. The full web audit shows 1 moderate, eslint-only, and no high (item 6).
3. **Admin API 405: fixed.** `/api/admin` and `/api/admin/export` return 404 to every method for anonymous and free users (item 6).
4. **Expected-profit wording: fixed.**
   - The compact card label is now "estimated".
   - The `/tools` meta is "Bet-sizing and estimated-return calculators for prediction markets, based on past results.".
   - The journal says "Estimated at entry".
   - No rendered page contains "expected"; only code identifiers remain.
5. **Market OG image cut off: fixed.** `lineClamp` and `minWidth: 0` in `app/m/[id]/opengraph-image.tsx`. The 121-character title and the 95% market render with nothing past the edge (item 11).
6. **Lighthouse performance: not fixed for `/`.** Its 6-run median is 87.5. `/about` and `/pricing` reach a median of 90 on a loaded machine (fail 5).

So 5 of run 2's 6 fails are fixed and 1 is still open. Run 3 found 4 new fails (1–4).

## Owner verification

These need live accounts. The mocks cover only the code path.

- **Supabase:**
  - Run the RLS checks against the live project with the anon key (user B cannot read user A's rows).
  - Send a real magic-link email.
  - Run `ops/supabase-setup.sh <ref> --yes`.
  - After a real sign-in on the deployed site, confirm the auth cookies carry `Secure; HttpOnly; SameSite=Lax`.
- **Stripe test mode end to end:**
  - Checkout.
  - Webhook delivery to the deployed URL.
  - Customer Portal cancel.
  - A real Payment Link, if `stripe.mode` is `links`.
  - Also consider whether out-of-order subscription events need a `created`/`current_period` guard (see item 9).
- **Upstash:** set the Redis keys, so that the shared limiter replaces the in-memory one and `/api/health` reports ok.
- **Vercel:**
  - Confirm BotID challenges headless browsers and scripted clients on the deployed site.
  - Set Root Directory to `apps/web`.
- **Kalshi demo:** place one demo order from the extension with a real demo key.
- **Domain and `config/site.json`:**
  - Fill the placeholders listed in item 10.
  - Set `NEXT_PUBLIC_SITE_URL`, so the sitemap, canonical URLs and OG URLs stop using `http://localhost:3000`.
- **Chrome Web Store:** publish the extension and set `NEXT_PUBLIC_EXTENSION_ID`.
