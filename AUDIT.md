# Audit run 3

Kismet final audit, third run.

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
  - The one bad link is `/api/admin/export`, which returned 403 to the crawler's plain GET. That is the deliberate cross-site guard (`sameSiteRequest`, `apps/web/app/api/admin/export/route.ts:22`). I checked it by hand as the admin: no `Sec-Fetch-Site` header gave 403, `Sec-Fetch-Site: cross-site` gave 403, and `Sec-Fetch-Site: same-origin` gave 200 `text/csv` with `content-disposition: attachment; filename="kismet-users-2026-11-18.csv"` and the expected header row. It is not a fail.
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
  - `vendor/picomatch/lib/parse.js` carries the Kismet patch for nested extglob quantifiers.
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
- **Scratch spec with the real extension** (`e2e-audit/trade-audit.spec.ts`): demo build on PW_PORT 4241, the extension built with `KISMET_ORIGIN` and loaded in a clean Chromium profile, and Kalshi's demo API mocked with real Ed25519 signature checks. 1 passed (1.3 m). The first attempt failed only because my spec expected the over-cap check on the confirm screen. The ticket blocks it earlier, so I fixed the spec and re-ran it.
  - A key that also has `write::transfer` is rejected: "This key also allows write::transfer. For safety Kismet only accepts trade-only keys…" (`audit3-ext-transfer-scope-rejected.png`).
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
  - `KISMET_ORIGIN=https://kismetodds.example pnpm ext:zip` wrote `kismet-extension-0.1.0.zip`.
  - Unzipped manifest: MV3; permissions `storage` and `sidePanel` only; host permissions are the app origin and `external-api.demo.kalshi.co`; extension pages CSP `script-src 'self'`.
  - It contains 0 `eval(` and 0 `new Function`, and no remote code.
  - Loaded in a clean Chromium profile, the service worker registered. The popup rendered "Signed out … Paper trading Off … Market analytics, not financial advice. Based on past results. 18+." (`audit3-ext-popup.png`). Its only console error is the expected DNS failure for the placeholder domain.
- **Owner scripts, default dry-run mode:**
  - `node ops/secrets.mjs`: "Dry run (add --yes to write)". It lists the three secrets it would generate. Exit 0.
  - `node ops/site-config.mjs --domain … --yes`-less run: shows the diff. Exit 0, and `config/site.json` is unchanged (`git status` clean).
  - `node ops/stripe-setup.mjs --domain kismetodds.example`, with no key: prints the plan (4 prices, 2 products, webhook with 5 events, portal). Exit 0.
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

---

# Audit run 4

Kismet final audit, fourth run.

Auditor: a fresh agent that built none of this code. It checked and fixed nothing.
Target: branch `final` at `1546929` ("Merge fix-audit3 (audit run 3 fails)"), checked out as worktree `audit4`.
Date: 2026-11-18.
Spec: `docs/OVERNIGHT.md` §3, items 1–11, plus the brief's extra checks (run 3 fails, the paid-suite `SyntaxError`, Lighthouse protocol, two runs of each e2e suite, ops dry runs, `smoke-prod.sh`).

How the audit ran:
- Everything ran outside `~/Desktop`, in a scratch directory:
  - `audit4/` is a git worktree at `1546929`. Unit tests, lint, typecheck and both e2e suites (twice each) ran here, after `pnpm i --frozen-lockfile` (exit 0 for web and extension).
  - `prod/`, `mock/`, `lh/` and `trade/` are `git archive` copies of `1546929`.
- `prod/` followed `SETUP.md` §0 from scratch: a new Python venv, `pip install -r requirements.txt`, `pytest`, `python -m engine scan` (01:59:57, 17,355 markets, 1,856 flags; it moved the committed scan into `*-prev.json`), `pnpm i --frozen-lockfile`, and `pnpm build` with `DEMO_MODE` unset and every key empty (`BUILD_EXIT=0`). Served with `next start` on port 4420.
- `lh/` is the same commit and the same `output/`, built with `NEXT_PUBLIC_SITE_URL=http://localhost:4450` (`ops/ship.md` "Smoke test against a local production build") and served on 4450. Used for `smoke-prod.sh`, OG images and Lighthouse.
- `mock/` ran the `E2E_MOCK=1` dev server on 4430 with the paid-config env, `ADMIN_EMAILS=admin-audit4@example.com`, `KALSHI_TRADING_ENV=demo` and `DATA_DIR=prod/output`. Seeded users (free, pro, premium, admin, and a separate webhook user) were created through the mock magic link and the mock Stripe checkout and saved as Playwright storage states.
- `trade/` ran run 3's scratch extension spec (`e2e-audit/trade-audit.spec.ts`, not committed) against a demo build on 4440.
- Only ports 4400–4499 were used. Every server I started was stopped before the commit.
- The machine was loaded by iCloud daemons throughout. `uptime` is recorded next to each e2e run and each Lighthouse batch.
- No Supabase, Stripe, Upstash, Vercel or Kalshi account exists. Where the in-repo mocks fully cover a check it is marked PASS; each live step is under "Owner verification".
- I did not accept commit messages, STATUS.md or run 3's text as proof. Every result below was re-run on `1546929`.
- Scratch helpers stayed in the scratch directory and are not committed (`crawl.mjs`, `seed.mjs`, `probe.py`, `cards.mjs`, `fees.mjs`, `webhook.mjs`, `hammer.py`, `kbd.mjs`, `fresh.mjs`, `chips.mjs`, `lh.sh`, two scratch vitest files, the trade spec).

## Summary

| # | Item | Result |
|---|------|--------|
| 1 | Tests | **FAIL** (fail 2) |
| 2 | Production build | PASS |
| 3 | Every page × every state | PASS |
| 4 | Quality | PASS |
| 5 | Data correctness | PASS |
| 6 | Security | PASS |
| 7 | Multipliers and combos | **FAIL** (fail 1) |
| 8 | Trading safety | PASS |
| 9 | Billing | PASS (mock) |
| 10 | Legal and wording | PASS (placeholders listed) |
| 11 | Publication readiness | PASS |

Every unit, demo e2e and paid e2e test passed, each e2e suite twice. All 5 of run 3's fails are fixed.

Fails, in order of severity:
1. Two raw counts do not use `formatCount`. The "Part of the game" filter chips show "Full game 8545", and the alerts Inbox tab count is not capped.
2. The paid e2e mock answers HEAD requests with a 500 ("Unexpected end of JSON input"). The plan-quota fast path is therefore never exercised in the paid suite.

## 1. Tests: FAIL

- `pytest -q` (new venv in `prod/`): 43 passed.
- `apps/web` in the worktree:
  - `pnpm i --frozen-lockfile`: exit 0.
  - `pnpm typecheck`: exit 0.
  - `pnpm lint` (`eslint . --max-warnings 0`): exit 0.
  - `pnpm test`: vitest 57 files, 360 tests passed; ops node tests 26 of 26 passed (the worktree is a git checkout, so `ops/tests/secrets.test.mjs` ran).
- `apps/extension`: `pnpm i --frozen-lockfile` exit 0, typecheck exit 0, 6 files, 42 tests passed.
- **Demo e2e** (`playwright.config.ts`, production build of the fixture data), 52 tests each run. That covers S1–S6, S8 (`alerts.spec.ts` "Run now fires one alert, running again keeps one"), search, trading-paper, multipliers, headers/CSP and `a11y.spec.ts` (axe on 21 pages plus the event page, a market page and the open drawer, and the two keyboard specs).
  - Run 1, PW_PORT 4410: **52 passed** (2.0 m). `uptime` load 16.2 before, 50.0 after (my prod build was running at the same time).
  - Run 2, PW_PORT 4413: **52 passed** (1.2 m). Load 22.4.
- **Paid e2e** (`playwright.paid.config.ts`, `E2E_MOCK=1` dev server), 6 tests each run: `admin.spec.ts:35` (admin sees /admin, flips the banner), `admin.spec.ts:72` (normal user and anonymous get 404 on every admin page and API route), `paywall-pages.spec.ts:8`, `s7-upgrade.spec.ts:30` (S7 sign up → Stripe → Pro unlocks), `s7-upgrade.spec.ts:60` (account delete), `s7-upgrade.spec.ts:78` (keyboard only: search → drawer → save → upgrade).
  - Run 1, PW_PORT 4411: **6 passed** (2.2 m). Load 33.2 after.
  - Run 2, PW_PORT 4414: **6 passed** (1.9 m). Load 12.7 after.
  - No failure in any of the four runs, so no solo re-runs were needed. Run 3's failing `admin.spec.ts:69` (now `:72`) passed in both runs.
- **The paid webserver's `SyntaxError: Unexpected end of JSON input` (fail 2).** It printed once in each paid run, during `s7-upgrade.spec.ts:78`. Stack: `rest (app/e2e-mock/[...path]/route.ts:175:27)`.
  - I re-ran `s7-upgrade.spec.ts:78` alone (PW_PORT 4412) on a scratch copy with one logging line added in front of `:175`. The request was `HEAD /e2e-mock/supabase/rest/v1/watchlist?select=id`, `Prefer: count=exact`, no body, from a signed-in user.
  - Source: `apps/web/lib/repo/server.ts:68`, `ctx.db.from(name).select("id", { count: "exact", head: true })`, the plan-quota fast path in `insertRow`. The keyboard spec's "Save" inserts a watchlist row.
  - Mechanism: the mock exports `handle` as GET, POST, PATCH and DELETE only (`route.ts:36`). Next serves HEAD through the GET export with `req.method` still `"HEAD"`. Inside `rest()` the GET branch (`req.method === "GET"`) is skipped, PATCH and DELETE don't match, and the request falls through to the POST insert path, which calls `await req.json()` on an empty body (`:175`). The PATCH branch at `:164` has the same unguarded `req.json()`; `:81` and `:200` already use `.catch(() => ({}))`.
  - Effect: the mock answers 500. supabase-js returns `count: null`, `(count ?? 0) >= limit` is false, and the insert goes ahead. So on the mock the quota fast path is silently skipped on every insert, and no paid e2e test can see a quota regression. The mock also has no `plan_quota` trigger. The quota itself is covered elsewhere: the PGlite tests `test/rls.test.ts` and `test/redteam.test.ts` exercise `plan_quota`.
  - Judgement: a real bug, but in the in-app test mock, not in a product route. Every product route that reads a body goes through `lib/body.ts` `readJson`, which returns `undefined` on empty or malformed JSON, and the handlers answer 400. In production `/e2e-mock/*` is 404 (checked on 4420 and by `smoke-prod.sh`), and real PostgREST answers HEAD. It is still a fail under this item: the paid suite passes while its harness 500s on a path the product depends on.

## 2. Production build: PASS

- `SETUP.md` §0 from scratch in `prod/`: venv, `pip install -r requirements.txt` (exit 0), `python -m engine scan` (exit 0), `pnpm i --frozen-lockfile` (exit 0), `pnpm build` with `DEMO_MODE` unset and every key empty: `BUILD_EXIT=0`.
- `next start -p 4420` served every page with 200 (item 3 crawl), with no error lines in the server log. The only server log line besides startup is Node 26's `ExperimentalWarning: localStorage is not available because --localstorage-file was not provided` (a note: some module touches `globalThis.localStorage` on the server).
- Paid buttons on `/pricing` say "Coming soon" (2 matches in the HTML). No dev or demo banner on any page (crawl token check). `/api/trade/config` returns `{"enabled":false,"env":null,…}`.
- The scan moved the committed data into `flags-prev.json` / `markets-prev.json` (`scanned_at` 1794895125, 25 h older than the new scan). The "first update shortly" state was checked in run 3 and its code (`lib/data/respond.ts` `loadStore`) now serves `/api/meta` too; `test/delay.test.ts` covers it.

## 3. Every page × every state: PASS

`crawl.mjs` (logged out) and `crawl2.mjs` (signed in; the same checks with shorter waits, because the dev mock is slow) visit 33 routes at 390 and 1440 px and then request every internal link they found. On each page they flag:
- console errors;
- NaN, undefined, null, "[object Object]" or lorem ipsum on screen;
- dev or demo banners;
- a missing footer disclaimer;
- horizontal scroll;
- a 5xx or 429 status.

Routes: every public page, every account page, the 5 `/admin*` pages, a 404, 3 market pages, an event page, an open drawer (`/?m=…`) and a search (`/?q=bar`). A 404 counts as expected only where the state should get it (`/admin*` for non-admins). `/api/me` is read before the crawl and after each width, and the result is in the "tier checks" column.

| State | Server | Views | Issues | Links checked | Bad links | Tier checks |
|---|---|---|---|---|---|---|
| logged out | prod 4420 | 66 | 0 | 101 | 0 | free ×3 (no user) |
| free | mock 4430 | 66 | 0 | 98 | 0 | free ×3 |
| pro | mock 4430 | 66 | 0 | 279 | 0 | pro ×3 |
| premium | mock 4430 | 66 | 0 | 281 | 0 | premium ×3 |
| admin | mock 4430 | 66 | 0 | 110 | 1 (expected) | free+admin ×3 |

- The mock dev server restarted on its memory threshold ("⚠ Server is approaching the used memory threshold, restarting…") while the first premium and admin crawls were running. A restart wipes the mock's in-memory users. I stopped those crawls, re-seeded premium and admin and crawled them again one at a time. The table shows the re-crawls. Free and pro had finished first, and their tier checks show the session held the whole time.
- The admin re-crawl saw one more restart during its final link pass, after its third tier check. `/api/account/export` still returned 200 in that pass, so the session was still valid when it ran. As in run 3, this is the `next dev` mock harness, not the app.
- Admin: all 5 admin pages returned 200 at both widths, with h1 "Admin", the disclaimer, no console errors and no horizontal scroll. The one bad link is `/api/admin/export` → 403 to a plain GET. That is the deliberate same-site guard (`sameSiteRequest`, `app/api/admin/export/route.ts:22`), checked by hand in run 3, and it is unchanged since.
- For non-admins every `/admin*` page is the styled 404 ("This page doesn't exist") with the disclaimer.
- Screenshots: `docs/screenshots/audit/audit4-<state>-<page>-<390|1440>.png`, for example `audit4-anon-home-390.png`, `audit4-free-markets-1440.png`, `audit4-premium-m_6970277-390.png` and `audit4-admin-admin_health-1440.png`.
- Static checks on the shipped code: `grep -rn "TODO\|FIXME"` over `apps/web/{app,components,lib}` and `apps/extension/src` finds 0; `console.log` only in `lib/execution.test.ts`; "lorem" 0.

## 4. Quality: PASS

**Lighthouse** (`npx lighthouse@12` = 12.8.2, `--form-factor=mobile`, default simulated throttling, Playwright Chromium 1255 headless) on the 4450 production build (`DEMO_MODE` unset, `NEXT_PUBLIC_SITE_URL=http://localhost:4450`). I ran both batches after the item 3 crawls, with the prod (4420) and mock (4430) servers stopped and nothing else of mine running. Scores are performance / accessibility / best practices / SEO. `uptime` is the 1/5/15-minute load average just before each page's 3 runs.

Batch 1:

| Page | `uptime` | Run 1 | Run 2 | Run 3 | Perf median |
|---|---|---|---|---|---|
| `/` | 8.10 10.33 10.12 | 92 / 100 / 100 / 91 | 92 / 100 / 100 / 91 | 92 / 100 / 100 / 91 | 92 |
| `/about` | 5.94 9.45 9.81 | 93 / 100 / 100 / 91 | 98 / 100 / 100 / 91 | 93 / 100 / 100 / 91 | 93 |
| `/pricing` | 6.94 9.26 9.72 | 94 / 100 / 100 / 91 | 94 / 100 / 100 / 91 | 94 / 100 / 100 / 91 | 94 |

Batch 2:

| Page | `uptime` | Run 1 | Run 2 | Run 3 | Perf median |
|---|---|---|---|---|---|
| `/` | 5.33 8.61 9.47 | 92 / 100 / 100 / 100 | 92 / 100 / 100 / 91 | 92 / 100 / 100 / 91 | 92 |
| `/about` | 5.54 8.28 9.30 | 93 / 100 / 100 / 91 | 93 / 100 / 100 / 91 | 93 / 100 / 100 / 91 | 93 |
| `/pricing` | 5.30 7.87 9.10 | 94 / 100 / 100 / 91 | 94 / 100 / 100 / 91 | 94 / 100 / 100 / 91 | 94 |

- **Performance: every run of every page is 92 or more** (run 3 fail 5 fixed). Medians over the 6 runs: `/` 92, `/about` 93, `/pricing` 94. TBT fell to 120–181 ms (run 3: 215–481 ms). LCP is 2.3–3.1 s and is now the largest remaining deduction. The load (5–8) was lower than in run 3 (11–28), so part of the gain is the machine, but TBT is far below run 3 even at its worst run.
- Accessibility 100 and best practices 100 on every run. The best-practices CSP `eval` issue from run 3 is gone (T-204, zod jitless in the browser). Note: `Function("")` still appears as text in two shipped chunks (`main-*.js`, `6266-*.js`), but Lighthouse logs no CSP violation, so it is not run on these pages.
- SEO 91 on 17 of 18 runs. The one deduction is `meta-description`, as in run 3. The tag is in the server HTML, but on `/about` and `/pricing` Next 15 streams it into the body (byte 33703 and 25875, after `</head>` at about 1970). On `/` it is inside `<head>` (byte 2392 < 3943), yet Lighthouse still misses it on 5 of 6 runs. 91 meets the bar. Note, not a fail.

**axe:** zero serious or critical violations. `e2e/a11y.spec.ts` (21 pages, the event page, a market page and the open drawer) passed in both demo runs.

**Keyboard-only walkthrough** (`kbd.mjs`, prod 4420, logged out, `reducedMotion: "reduce"`):
- `/` focuses the search; "barcelona", ArrowDown, Enter → `/?q=FC+Barcelona`.
- A result's title link is reached in 24 Tabs; Enter opens the "Market details" dialog with focus inside (`audit4-kbd-drawer-1440.png`).
- "Save" is reached in 5 Tabs; Enter → "Saved", focus kept, dialog open (`audit4-kbd-save-1440.png`).
- After Esc, "Pricing" in 25 Tabs; Enter → `/pricing`.
- Focus trap and focus return: `a11y.spec.ts`, passed twice. Signed in: `s7-upgrade.spec.ts:78` (search → drawer → save → upgrade), passed twice.

**Reduced motion:** with `prefers-reduced-motion: reduce` emulated, `matchMedia` matched and the longest animation and transition durations on the page were 0.01 ms.

**Design review:** I compared the screenshots (`audit4-anon-home-1440.png`, `audit4-anon-home-390.png`, `audit4-anon-m_*-390.png`, `audit4-kbd-drawer-1440.png`, `audit4-pro-*`, the OG images) with `docs/design/project/Hybrid.dc.html` and `MobileHybrid.dc.html`. They match the chosen design: dark theme, emerald accent, rounded-xl cards with thin borders, 16 px mobile gutters and the card anatomy. One cosmetic nit: in the home side card a long title wraps as "Mancheste… 33¢ · / 3.0x", with the multiplier on its own line. Not a fail.

## 5. Data correctness: PASS

- **Free tier is capped and delayed on the server.** `probe.py` against 4420 (logged out) sent `ps`, `page`, `page_size`, `tier`, an `x-tier` header and forged tier cookies to `/api/flags` and `/api/markets`. All 7 responses: 200, at most 25 rows, page 1, every row banded. The newest scan was 7.4 min old, and the 25 anonymous `/api/flags` rows equalled `flags-prev.json` (25 checked, 0 mismatched).
- Anonymous `/api/markets/<id>` for a market outside the top 25: band floors only (`roi_pct: 10` with `ranges.roi_pct [10, 20]`, `win_prob` floored), `stakes: null`. `/api/combos` anonymous: band floors (`q 0.75`, `ret 0.2`, legs `q 0.9`).
- **Cards equal the API.** `cards.mjs` on 4420: 16 API rows, 13 cards on `/` matched (price, Pays, wins about, won before, return band), 0 mismatched.
- **Fees and returns match the engine formulas** (`fees.mjs`, Pro user on the mock, 20 bets, 40 sides, `fee = FEE_RATE[cat]·p·(1−p)` from `pipeline/common.py`, `edge = q − (p + fee)`, `roi = edge / cost · 100`, compared with the API and `output/flags.json`). Fee and edge match on all 40. Three sides differ by 0.02–0.03 roi points (asks 0.08, 0.11 and 0.16); 4-decimal rounding of `edge` (±0.00005) over a cost near 0.1 moves roi by up to about ±0.06. Same note as run 3; pass.
- **Freshness pill: PASS (run 3 fail 1 fixed).**
  - Logged out on 4420, 4 min after the scan: `/api/meta` returned `scanned_at 1794895125` (the prev scan) and `delay_min 15`. The pill read "Updated 25 h ago · data may be stale" with the title "…On the Free plan you see prices 15 minutes behind.", and Best bets read "Scanned 25 h ago." That matches the rows served (`audit4-anon-freshness-home-1440.png`).
  - Free signed-in on the mock, 12 min after the scan: the same prev `scanned_at`, "Updated 25 h ago" (`audit4-free-freshness-home-1440.png`).
  - Pro on the mock at the same time: `scanned_at 1794985198` (the new scan), `delay_min 0`, "Updated 13 min ago" (`audit4-pro-freshness-home-1440.png`).
  - After the 15-minute mark the logged-out crawl shows the new scan's age ("17 min ago", `audit4-anon-home-390.png`).
  - The pill, Best bets empty state, `/about` and `/status` now say prices refresh "about every 10 minutes". `docs/setup-notes/ops.md` makes the engine container (scan every 600 s, `ops/scheduler.py:17`) the primary path and `refresh.yml` (every 2 h) the fallback, so the wording is right for the documented setup. On the fallback-only path it overstates the cadence (note, not a fail; `lib/freshness.ts` documents it).
  - `/status` still dates the newest scan for everyone, with an added line that Free sees each scan 15 minutes later. Acceptable: it describes the system, not the tier's data.
- No `NaN` or closed market shown (item 3 crawl token check).

## 6. Security: PASS

- **Headers** (`curl -I` on 4420): `Strict-Transport-Security: max-age=63072000; includeSubDomains`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()`, and a CSP with a per-request nonce and `strict-dynamic`. `e2e/headers.spec.ts` (frame-ancestors, nonce) passed in both demo runs.
- **Hidden routes** (4420, logged out): `/admin`, `/admin/users`, `/api/admin`, `/api/admin/export`, `/e2e-mock/supabase/_inbox`, `/api/data` → 404; `/api/admin` POST/PUT/PATCH/DELETE → 404; `/api/settle/run`, `/api/alerts/run` → 401. Non-admin users: `admin.spec.ts:72` passed twice.
- **Paid data as anon/free:** see item 5 (banded and capped server-side).
- **Another user's rows:** `test/rls.test.ts` (PGlite with the real migrations) passed in the unit run, including "user B sees none of user A's rows" and "anon sees nothing". Live check under Owner verification.
- **Rate limits** (`hammer.py`, prod 4420; the mock is exempt by design, `lib/abuse.ts:124` applies limits only when `NODE_ENV=production` and not demo, so its all-200 result is expected):
  - `/api/markets` ×40: 27×200 then 13×429, `Retry-After: 59`.
  - `/api/flags` ×40: 40×429 (that minute already spent).
  - `/api/suggest?q=bar` ×250: 120×200, 130×429.
  - A different `X-Forwarded-For`/`X-Real-IP` on each request: 40×429, so spoofing does not reset the limit.
  - `smoke-prod.sh` on 4450: 40× POST `/api/ext/telemetry` → 429 after the burst.
  - `/api/health` → 503 `{"ok":false}` without Upstash (by design).
- **Crawlers:** GPTBot, ClaudeBot, CCBot, PerplexityBot, Google-Extended, Bytespider → 403 on `/` and `/api/markets`. HeadlessChrome, python-requests, curl → 200 (BotID runs only on Vercel; Owner verification).
- **Stripe webhooks** (`webhook.mjs`, mock, real `stripe` signing): unsigned, wrong secret, 1-hour-old timestamp and body changed after signing → 400. Replayed event id → `{"duplicate":true}`. A raw unsigned `client_reference_id` is ignored (a subscription for that customer with no linked user gets 500 "Retry" so Stripe retries).
- **Dependencies:** `apps/web` `pnpm audit --prod`: none. Full `pnpm audit`: 1 moderate (minimatch, eslint only). `apps/extension`: none. `pip-audit -r requirements.txt`: none.
- **Secrets in history:** no gitleaks/trufflehog on this machine; the regex scanner (`secrets_scan.py`, gitleaks-equivalent rules) over `git log --all -p`, 262 commits: 21 hits, all the known fakes (`FAKEFAKE` keys, `whsec_mocksecret…`, the test JWTs signed with the literal "signature", the `AAAA` PEM test body and the PEM placeholder label). The 12 commits since run 3: 0 hits.
- **Client bundles:** `pnpm check:bundle` on the prod build: "126 files in .next/static, no secrets". My grep for `SUPABASE_SERVICE_ROLE`, `STRIPE_SECRET_KEY`, `sk_live_`, `sk_test_`, `whsec_`, `UPSTASH_REDIS_REST_TOKEN`, `CRON_SECRET`, `EXT_SIGNING_SECRET`, `UNSUBSCRIBE_SECRET`, `service_role` in `.next/static`: 0 files.
- **Cookies:** mock auth cookies are `HttpOnly` and `SameSite=Lax`; `Secure` is `NODE_ENV === "production"` (`middleware.ts:10`), and the mock runs in dev, so not observable here (Owner verification). The prod build sets no cookie on `/`, `/markets`, `/login`.

## 7. Multipliers and combos: FAIL

- **Combo math** (run 3's hand-computed cases as a scratch vitest on this commit): all pass.
  - Two legs: price (0.5+0.0125)(0.4+0.012) = 0.21115, ret 0.3/0.21115 − 1 = 0.420791, `has_edge` true.
  - Three legs at 0.8 + 0.008 fee: price 0.808³ = 0.527514, ret 0.164187, `has_edge` false (q_low 0.512 < price).
  - Same-event legs: `same_event` is `["Game X"]`. `e2e/multipliers.spec.ts:38` (the warning in the UI) passed twice.
  - Kalshi combo at 30¢ with Q 0.4: fee 0.02, edge 0.08, ret 0.25.
- `test/multipliers.test.ts`: "the 10x bet with a 14% chance shows in tier edge (chance floor off)" and "hides a leg count that lost money in testing; Free gets bands" pass. In the real scan, the three ≥10x sides with an 11% chance and a 4-point edge are in tier `best` (shown in both tiers). Tier split 767 best / 1,089 edge; best is 4.4% of 17,355 markets.
- `formatCount` never rounds up: 999, 1K, 1.9K, 9.9K, 99K, 999K, 1.9M, 1.4M, 9.9B for 999 … 9,999,999,999.
- **Run 3 fail 3 fixed at the two named places:** `SearchCombobox.tsx:132` and `JournalView.tsx:63,88` now use `formatCount`; T-201 also fixed DayStrip and My list.
- **A raw count remains (fail 1):**
  - `apps/web/components/screener/FilterPanel.tsx:225`, the `Chip` component, prints `{count}` raw. It is used for the "Part of the game" period chips (`:120`, `count={facets?.periods[p]}`). On `/markets` → More filters, logged out shows **"Full game 8545"** and Pro shows **"Full game 13855"**, two rows below "Spreads 2.6K" and "Totals 2.1K", which go through the `Count` helper at `:207-208` (`formatCount` with an `exactCount` title). Screenshot: `audit4-anon-period-chips-1440.png`.
  - Smaller, same rule: `apps/web/components/alerts/AlertsView.tsx:80` prints `Inbox (${unread} new)`. `unread` counts every unread alert event (`components/alerts/Inbox.tsx:13`, not capped), so a Premium user with many rules can pass 999. The header bell caps it at "99+" (`components/header/Bell.tsx:34`).
  - Checked and bounded (not fails): `Rules (${rules.length})` (≤100 by plan), TopicsPicker chosen count, combo leg counts, the 12-bet calculator, AuthBoot's guest-import summary (Free quotas: watchlist 10, presets 1), admin pages (deliberately `exactCount`).

## 8. Trading safety: PASS

- Prod 4420: `/api/trade/config` → `{"enabled":false,"env":null,…}`; POST `/api/trade/nonce` → 404 "Trading is off."; POST `/api/trade/nonce/verify` → 404.
- Run 3's scratch spec with the real extension (`trade/`, demo build on 4440, extension built with `KISMET_ORIGIN`, loaded in a clean Chromium profile, Kalshi demo API mocked with real Ed25519 signature checks): **1 passed** (1.7 m).
  - A key with `write::transfer` is rejected: "This key also allows write::transfer. For safety Kismet only accepts trade-only keys…" (`audit4-ext-transfer-scope-rejected.png`).
  - Over the $25 per-order cap: "Over your $25 per-order limit." in the ticket; 0 orders reached Kalshi (`audit4-ext-cap-refused.png`).
  - Confirm required: 0 orders at Kalshi on the confirm screen, 1 after the click.
  - Keys never leave the extension: 73 requests to 3 hosts (the extension, the app, demo Kalshi); the PEM in 0 requests, the key id in 0 requests outside Kalshi; extension storage held only `{"spend":{"cents":198,…}}`; page storage held neither PEM nor key id.
- `e2e/trading-paper.spec.ts:99` (connect key, resting order, cancel, marketable order, fill in My bets) passed in both demo runs.
- Code review: `apps/extension` and `lib/trade` are unchanged since run 3 except a `zod-jitless` import in `lib/trade/intent.ts`. The only order-creating call is the POST in the confirm handler (run 3's grep and review stand; `scopeError` and `capError` unit tests pass in the extension suite).

## 9. Billing: PASS (mock)

`webhook.mjs` on the mock, signed with the test secret:
- `checkout.session.completed` with a signed `client_reference_id` linked the customer (Payment Link path); `customer.subscription.created` premium → tier premium.
- Replay of the same event id → `{"duplicate":true}`, tier unchanged.
- Portal cancel (`cancel_at_period_end=true`) → still premium. `customer.subscription.deleted` → free. Replaying the deletion → duplicate.
- S7 (sign up → Checkout → webhook → Pro unlocks) passed in both paid runs; account delete with a live subscription cancels it (`s7-upgrade.spec.ts:60`, both runs).
- Observation, unchanged from run 3: `lib/billing/stripe.ts` `handleEvent` has no event-ordering guard. An older subscription event with a new id, delivered late, overwrote newer state (pro → premium in my test). Listed under Owner verification.

## 10. Legal and wording: PASS (placeholders listed)

- Footer disclaimer "Market analytics, not financial advice. Based on past results. 18+." on every crawled view in every state (item 3), on 11 pages checked by `curl` (2 matches each, HTML and RSC payload), in the extension popup (`audit4-ext-popup.png`), on the OG images and in every email.
- `/terms`, `/privacy`, `/refunds`, `/disclaimer`, `/contact`, `/status` → 200, linked from the footer.
- `/disclaimer` names 1-800-GAMBLER and ncpgambling.org.
- 18+ gate: `/login` "I'm 18 or older and agree to the Terms" checkbox; server side `accept: z.literal(true)` (`app/api/auth/magic-link/route.ts`, unchanged since run 3).
- Emails rendered with a scratch vitest (`audit4-email-alert-600.png`, `audit4-email-signin-600.png`, `audit4-email-payfail-600.png`): all three have Unsubscribe and the disclaimer in both the HTML and text parts, and none matches guarantee/sure thing/can't lose/pick/lock/expected profit. Alert text: "Yes at 68¢ · won 92% before · estimated return +33% · …".
- Banned words: `grep -rniE "\b(picks?|locks?|guaranteed?|sure thing|can.?t lose)\b"` over `apps/web/app`, `components`, `lib/email` and `apps/extension/src` finds only code identifiers (`Pick<>`, `pick()`, `LOCK` svg, `locked`) and the negation on `/terms` ("We give no guarantee…"). New copy since run 3 (T-200, T-205: "Prices refresh about every 10 minutes", "On the Free plan you see prices 15 minutes behind") makes no profit claim.
- Placeholders (listed, not failed), as rendered by the prod build: `/terms` `[[GOVERNING_STATE]] [[LAST_UPDATED]] [[OPERATOR_NAMES]] [[SUPPORT_EMAIL]]`; `/privacy` `[[LAST_UPDATED]] [[OPERATOR_NAMES]] [[SUPPORT_EMAIL]]`; `/refunds` adds `[[REFUND_POLICY]] [[RESPONSE_TIME]]`; `/disclaimer` `[[LAST_UPDATED]] [[OPERATOR_NAMES]]`; `/contact` `[[LAST_UPDATED]] [[OPERATOR_NAMES]] [[RESPONSE_TIME]] [[SUPPORT_EMAIL]]`; every page's footer `[[OPERATOR_NAMES]]`; the email CTA `https://[[DOMAIN]]/…`.

## 11. Publication readiness: PASS

- `robots.txt` 200: disallows the AI user agents and `/api/`, `/auth/`, `/login`, `/onboarding`, `/account`, `/settings`, `/watchlist`, `/journal`, `/alerts`, `/dashboards`, `/admin`; has a `Sitemap:` line. `sitemap.xml` 200 with 12 `<loc>`; on 4420 (no `NEXT_PUBLIC_SITE_URL`) they point at `http://localhost:3000`, on 4450 at the right origin (`smoke-prod.sh`).
- No test users, seed data or debug routes in prod: `/e2e-mock/*` and `/api/data` → 404; `/admin*` → 404.
- 404 is the styled not-found page inside the shell (crawl). `app/error.tsx` is the styled 500 boundary; no `app/global-error.tsx` (note, as run 3).
- Favicon: `<link rel="icon" href="/icon.svg…">` → 200 `image/svg+xml`; `/favicon.ico` → 404 (harmless).
- OG images: `/opengraph-image` 200 PNG (`audit4-og-site.png`); the longest title in this scan (market 4664134, 125 characters) wraps to three lines with an ellipsis and nothing cut off (`audit4-og-longest-4664134.png`).
- Extension: `KISMET_ORIGIN=https://kismetodds.example pnpm ext:zip` wrote `kismet-extension-0.1.0.zip`. Manifest: MV3, permissions `storage`, `sidePanel`; hosts the app origin and `external-api.demo.kalshi.co`; extension pages CSP `script-src 'self'; object-src 'self'`; 0 files with `eval(` or `new Function`. Loaded unpacked in a clean Chromium profile: service worker registered, popup renders "Signed out … Paper trading Off … Market analytics, not financial advice. Based on past results. 18+." (`audit4-ext-popup.png`); the only console error is DNS for the placeholder domain.
- **Owner scripts, default (dry-run) mode**, in the worktree with no env file:
  - `node ops/secrets.mjs`: "Dry run (add --yes to write)", lists the 3 secrets. Exit 0.
  - `node ops/site-config.mjs --domain kismetodds.example --support-email …`: shows what is still missing. Exit 0. `config/site.json` md5 unchanged.
  - `node ops/stripe-setup.mjs --domain kismetodds.example` (no key): prints the plan (4 prices, 2 products, webhook with 5 events, portal). Exit 0.
  - `node ops/preflight.mjs`: 24 blockers, 6 warnings, all expected on an unconfigured clone. Exit 1 by design.
  - `bash ops/supabase-setup.sh abcdefghijklmnopqrst`: prints the plan and the dashboard checklist. Exit 0.
  - `node ops/vercel-env.mjs`: "Refusing: no env file. Create apps/web/.env.prod … or pass --env <file>." Exit 2. With a test env file holding `PATH`, `HOME`, `FOO`, `E2E_MOCK`, a Supabase URL and a fake Stripe key, it planned only the 2 documented keys × 2 targets (the Stripe key `--sensitive` and masked), and listed "Not pushed (test-only): E2E_MOCK" and "Not pushed (not in apps/web/.env.example): FOO, HOME, PATH". Exit 0. (Run 3 fail 4 fixed.)
  - `python ops/checks.py prod/output`: "data checks ok", exit 0.
  - `python ops/upload.py` without credentials: "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required", exit 1, nothing uploaded.
  - `ops/scheduler.py` has no dry run; `plan()` evaluated without running jobs on a clean copy: `bootstrap, backtest, update, fit, grade, scan`.
- **`ops/smoke-prod.sh`**, the documented way (`DEMO_MODE=false NEXT_PUBLIC_SITE_URL=http://localhost:4450` build, `SMOKE_EXPECT_HEALTH=503 ops/smoke-prod.sh http://localhost:4450`): **18 passed, 0 failed**.
- `SETUP.md` from scratch reaches a running app (item 2).

## Fails to fix

1. **Raw counts without `formatCount` remain** (item 7). Run 3's two named places are fixed, but the rule is not met app-wide.
   - Where:
     - `apps/web/components/screener/FilterPanel.tsx:225`, the `Chip` component: `{label}{count !== undefined && <span className="ml-1 text-xs text-muted">{count}</span>}`. It is used for the period facets at `:120` (`count={facets?.periods[p]}`).
     - `apps/web/components/alerts/AlertsView.tsx:80`: `` `Inbox (${unread} new)` ``, where `unread` is not capped (`components/alerts/Inbox.tsx:13`).
   - Symptom: on `/markets`, More filters, "Part of the game": logged out shows "Full game 8545" and Pro shows "Full game 13855", next to "Spreads 2.6K" and "Totals 2.1K", which use the `Count` helper (`FilterPanel.tsx:207-208`, `formatCount` with an `exactCount` title). Screenshots: `audit4-anon-period-chips-1440.png`, `audit4-pro-period-chips-1440.png`.
   - Repro: start the prod build, open `/markets`, click "More filters", and read the "Part of the game" chips. Or run `grep -n "{count}</span>" apps/web/components/screener/FilterPanel.tsx`.
2. **The paid e2e harness 500s on HEAD requests, so the paid suite never exercises the plan-quota fast path** (item 1).
   - Where: `apps/web/app/e2e-mock/[...path]/route.ts:36` exports only GET, POST, PATCH and DELETE. Next answers HEAD through GET with `req.method === "HEAD"`. `rest()` matches no branch, falls into the POST insert path, and `await req.json()` at `:175` throws on the empty body. The PATCH branch at `:164` is just as unguarded.
   - Symptom: `SyntaxError: Unexpected end of JSON input` at `rest (app/e2e-mock/[...path]/route.ts:175:27)`, once in every paid run. The request is `HEAD /e2e-mock/supabase/rest/v1/watchlist?select=id` with `Prefer: count=exact`, from `apps/web/lib/repo/server.ts:68` (`select("id", { count: "exact", head: true })` in `insertRow`). The mock answers 500, `count` is null, and `(count ?? 0) >= limit` is false, so the quota check is skipped and the test passes anyway.
   - Not a product bug: product routes read bodies through `lib/body.ts` `readJson` (400 on bad JSON), `/e2e-mock` is 404 in production, and real PostgREST answers HEAD. It is a test-harness bug that hides quota regressions from the paid suite.
   - Repro: `cd apps/web && PW_PORT=4412 pnpm exec playwright test -c playwright.paid.config.ts e2e-paid/s7-upgrade.spec.ts:78`, then look for `Unexpected end of JSON input` in the webserver output.

## Fixed since run 3

I re-checked each of run 3's 5 fails on `1546929`:

1. **Freshness pill shows the newest scan's age to Free: fixed** (T-200).
   - `app/api/meta/route.ts` now resolves the tier (`getMe`) and serves `scanned_at` from `withStore(…, tier)`, plus a `delay_min`.
   - Logged out and Free see the prev scan's `scanned_at` (1794895125, "Updated 25 h ago"), with a tooltip saying Free is 15 minutes behind. Pro sees the new scan (1794985198, "13 min ago"). The anonymous `/api/flags` rows equal `flags-prev.json`, so the pill and the rows now agree (item 5).
   - The tooltip no longer says "about every 2 hours".
2. **Paid e2e `admin.spec.ts:69` fails: fixed** (T-203). The same test, now `admin.spec.ts:72`, and `:35` passed in both full paid runs (load 33 and 12.7). "Skip setup" is disabled until hydrated and runs once (`components/onboarding/Onboarding.tsx:41-51`, a `started` ref); the sign-in helpers no longer re-click inside `toPass`.
3. **Raw counts: fixed at the two named places, not fixed app-wide.** `SearchCombobox.tsx:132` and `JournalView.tsx:63,88` use `formatCount` (T-201). New fail 1 lists two raw counts that remain (`FilterPanel.tsx:225`, `AlertsView.tsx:80`).
   - **T-206 (JournalView count test, 2,734 → 1,200 rows):** not materially weaker.
     - The old test timed out alone on this machine (7.8 s against the 5 s default, load about 10). The new one passes in 3.8 s with a 30 s timeout.
     - It still forces both counts over 1,000 (200 settled + 1,000 open). It asserts "1.2K · 1K open" and `not.toContain("1200")`, so a raw count still fails it.
     - Neither the old nor the new test checks that rounding goes down; the `formatCount` unit tests cover that.
     - Nit: 1,200 and 1,000 sit exactly on round values, so a formatter that rounds up would also print "1.2K". A value such as 1,999 would also catch rounding up.
4. **`ops/vercel-env.mjs` pushes the whole shell environment: fixed** (T-202). With no env file it refuses with exit 2. With an env file it pushes only the keys in `apps/web/.env.example`, skips test-only keys and lists the rest as "Not pushed" (item 11).
5. **Lighthouse mobile performance below 90: fixed.** Over 2 batches of 3 runs, every run scored 92 or more. The medians are `/` 92, `/about` 93 and `/pricing` 94. TBT is 120–181 ms. Best practices is now 100, because the zod CSP `eval` probe is gone (T-204). The load average was 5–8 during the runs (item 4).

So all 5 of run 3's fails are fixed, with one caveat: under fail 3, the rule is still broken at two other places. Run 4 found 2 new fails.

## Owner verification

These need live accounts. The mocks cover only the code path. Unchanged from run 3.

- **Supabase:**
  - Run the RLS checks against the live project with the anon key (user B cannot read user A's rows).
  - Send a real magic-link email.
  - Run `ops/supabase-setup.sh <ref> --yes`.
  - After a real sign-in on the deployed site, confirm the auth cookies carry `Secure; HttpOnly; SameSite=Lax`.
  - Confirm the `plan_quota` trigger blocks an 11th Free watchlist row on the live database. The paid e2e cannot show this (fail 2).
- **Stripe test mode end to end:**
  - Checkout.
  - Webhook delivery to the deployed URL.
  - Customer Portal cancel.
  - A real Payment Link, if `stripe.mode` is `links`.
  - Decide whether out-of-order subscription events need a `created`/`current_period` guard (item 9).
- **Upstash:** set the Redis keys, so that the shared limiter replaces the in-memory one and `/api/health` reports ok.
- **Vercel:**
  - Confirm BotID challenges headless browsers and scripted clients on the deployed site.
  - Set Root Directory to `apps/web`.
  - Push env with `node ops/vercel-env.mjs --env apps/web/.env.prod` and check the plan lists only the expected keys.
- **Kalshi demo:** place one demo order from the extension with a real demo key.
- **Domain and `config/site.json`:**
  - Fill the placeholders listed in item 10.
  - Set `NEXT_PUBLIC_SITE_URL`, so the sitemap, canonical URLs and OG URLs stop using `http://localhost:3000`.
- **Scan cadence:** run the engine container (10-minute scans), as `docs/setup-notes/ops.md` describes. With only the `refresh.yml` fallback (every 2 h), the "about every 10 minutes" wording is wrong.
- **Chrome Web Store:** publish the extension and set `NEXT_PUBLIC_EXTENSION_ID`.


# Audit run 5

Kismet final audit, fifth run.

Auditor: a fresh agent that built none of this code. It checked and fixed nothing.
Target: branch `final` at `748b70e` ("T-211: e2e mock answers HEAD count=exact, so the paid suite exercises the plan-quota fast path"), checked out as worktree `audit5`.
Date: 2026-11-18.
Spec: `docs/OVERNIGHT.md` §3, items 1–11, plus the brief's extra checks (run 4's two fails, an app-wide raw-count sweep, the Lighthouse protocol, two runs of each e2e suite with the paid webserver log, ops dry runs, `smoke-prod.sh`).

Since run 4 (`1546929`) the product changed in 2 commits: T-210 (`FilterPanel.tsx` `Chip` and the `AlertsView.tsx` Inbox tab now use `formatCount`) and T-211 (the e2e mock exports HEAD, answers it with `content-range`, and answers an empty POST/PATCH body with 400). Everything below was still re-run on `748b70e`.

How the audit ran:
- Everything ran outside `~/Desktop`, in a scratch directory:
  - `audit5/` is a git worktree at `748b70e`. Unit tests, lint, typecheck and both e2e suites (twice each) ran here, after `pnpm i --frozen-lockfile` (exit 0 for web and extension). The main checkout has no `output/*-prev.json`, so there was nothing extra to copy.
  - `prod/`, `mock/`, `lh/` and `trade/` are `git archive` copies of `748b70e`.
- `prod/` followed `SETUP.md` §0 from scratch: a new Python venv, `pip install -r requirements.txt`, `pytest`, `python -m engine scan` (03:25:18, 17,848 markets, 1,987 flags; it moved the committed scan into `*-prev.json`), `pnpm i --frozen-lockfile`, and `pnpm build` with `DEMO_MODE` and `NEXT_PUBLIC_DEMO_MODE` unset and every key empty (`BUILD_EXIT=0`). Served with `next start` on port 4620.
- `lh/` is the same commit with a copy of `prod/output`, built with `DEMO_MODE=false NEXT_PUBLIC_SITE_URL=http://localhost:4650` (the `ops/ship.md` "Smoke test against a local production build" recipe; `DEMO_MODE=false` and unset are the same, only exactly `true` turns demo on, `SETUP.md:62`). Served on 4650. Used for Lighthouse, `smoke-prod.sh` and OG images.
- `mock/` ran the `E2E_MOCK=1` dev server on 4630 with the paid-config env, `ADMIN_EMAILS=admin-audit5@example.com`, `KALSHI_TRADING_ENV=demo` and `DATA_DIR=prod/output`. Seeded users (free, pro, premium, admin, and a separate webhook user) were created through the mock magic link and the mock Stripe checkout and saved as Playwright storage states.
  - The first mock instance restarted on Next's memory threshold ("⚠ Server is approaching the used memory threshold, restarting…") during the pro crawl, which wiped the mock's in-memory users. I discarded that crawl, restarted the mock with `NODE_OPTIONS=--max-old-space-size=8192`, re-seeded pro, premium and admin, and crawled them again. Free had finished before the restart; its three tier checks show the session held. Checks that ran on the first instance (quota, webhooks, fees, inbox, chips) all ran before the restart and print the tier they saw.
  - The second instance restarted the same way during the premium crawl's 1440 pass, and a concurrent admin crawl caused a dev-compiler race. I started a third instance, re-seeded, and re-ran admin and premium 1440 alone (item 3).
- `trade/` ran run 3's scratch extension spec (`e2e-audit/trade-audit.spec.ts`, not committed) against a demo build on 4640.
- Only ports 4600–4699 were used. Every server I started was stopped before the commit.
- `uptime` is recorded next to each e2e run and each Lighthouse batch.
- No Supabase, Stripe, Upstash, Vercel or Kalshi account exists. Where the in-repo mocks fully cover a check it is marked PASS; each live step is under "Owner verification".
- I did not accept commit messages, STATUS.md or run 4's text as proof.
- Scratch helpers stayed in the scratch directory and are not committed (run 4's `crawl.mjs`, `crawl2.mjs`, `seed.mjs`, `probe.py`, `cards.mjs`, `fees.mjs`, `webhook.mjs`, `hammer.py`, `kbd.mjs`, `fresh.mjs`, `chips.mjs`, `lh.sh` with ports and paths changed; new: `quota.mjs`, `inbox.mjs`, `chips2.mjs`, `me.mjs`, `get.mjs`, `recheck.mjs`, `crawl4.mjs`; two scratch vitest files, deleted after use; the trade spec).

## Summary

| # | Item | Result |
|---|------|--------|
| 1 | Tests | PASS |
| 2 | Production build | PASS |
| 3 | Every page × every state | PASS |
| 4 | Quality | PASS |
| 5 | Data correctness | PASS |
| 6 | Security | PASS |
| 7 | Multipliers and combos | PASS |
| 8 | Trading safety | PASS |
| 9 | Billing | PASS (mock) |
| 10 | Legal and wording | PASS (placeholders listed) |
| 11 | Publication readiness | PASS |

**No fails this run.** Both of run 4's fails are fixed (see "Fixed since run 4"). Two crawl problems on the mock dev server were proven environment-only by solo re-runs (item 3). Lighthouse medians: `/` 92, `/about` 93, `/pricing` 94.

## 1. Tests: PASS

- `pytest -q` (new venv in `prod/`): 43 passed.
- `apps/web` in the worktree:
  - `pnpm i --frozen-lockfile`: exit 0.
  - `pnpm typecheck`: exit 0.
  - `pnpm lint` (`eslint . --max-warnings 0`): exit 0.
  - `pnpm test`: vitest 57 files, 361 tests passed (run 4: 360; the new one is `test/e2e-mock.test.ts` "answers HEAD with the row count, and an empty insert with 400"); ops node tests 26 of 26 passed.
- `apps/extension`: `pnpm i --frozen-lockfile` exit 0, typecheck exit 0, 6 files, 42 tests passed.
- **Demo e2e** (`playwright.config.ts`, production build of the fixture data), 52 tests each run: S1–S6 (`s1-landing`, `s2-filters`, `s3-drawer`, `s4-presets`, `s5-mylist`, `s6-tools`, `s6`), S8 (`alerts.spec.ts`), search (7), trading-paper, multipliers (4), headers/CSP (2) and `a11y.spec.ts` (25: axe on 21 pages plus the event page, a market page and the open drawer, and the keyboard specs).
  - Run 1, PW_PORT 4610: **52 passed** (1.6 m). `uptime` load 5.11 before, 6.53 after (the `lh/` build was running at the same time).
  - Run 2, PW_PORT 4613: **52 passed** (56 s). Load 5.48 before, 6.46 after.
- **Paid e2e** (`playwright.paid.config.ts`, `E2E_MOCK=1` dev server), 6 tests each run: `admin.spec.ts:35`, `admin.spec.ts:72`, `paywall-pages.spec.ts:8`, `s7-upgrade.spec.ts:30` (S7), `s7-upgrade.spec.ts:60` (account delete), `s7-upgrade.spec.ts:78` (keyboard only: search → drawer → save → upgrade).
  - Run 1, PW_PORT 4611: **6 passed** (1.4 m). Load 5.86 after.
  - Run 2, PW_PORT 4614: **6 passed** (1.4 m). Load 6.46 before, 4.64 after.
  - No failure in any of the four runs, so no solo re-runs were needed.
- **Paid webserver log** (both runs with `DEBUG=pw:webserver`, 888 `[WebServer]` lines in run 1): no `SyntaxError`, no `Unexpected end of JSON input`, no `⨯`, no `TypeError`, no 5xx. The only stderr lines are Node 26's `ExperimentalWarning: localStorage is not available…`. Every non-2xx response, tallied per path, is expected: the 6 `/admin*` pages → 404 twice each (`admin.spec.ts:72`, non-admin and anonymous), `GET /api/data` → 401 (anonymous), `GET /e2e-mock/supabase/auth/v1/user` → 401 (signed-out check), `/auth/callback` and the mock Stripe pay page → 303. The quota request now reads `HEAD /e2e-mock/supabase/rest/v1/watchlist?select=id 200` (once per run).

## 2. Production build: PASS

- `SETUP.md` §0 from scratch in `prod/`: venv, `pip install -r requirements.txt` (exit 0), `pytest` (43 passed), `python -m engine scan` (exit 0: "open markets fetched: 80182 … scanned 17848 markets, 1987 flags"), `pnpm i --frozen-lockfile` (exit 0), `pnpm build` with `DEMO_MODE` unset and every key empty: `BUILD_EXIT=0`.
- `next start -p 4620` served every page with 200 (item 3 crawl). Server log, besides startup: the Node 26 `localStorage` ExperimentalWarning and `[abuse] UPSTASH_REDIS_REST_URL/TOKEN not set: rate limits are per instance (in memory)` (expected without Upstash). No error lines.
- Paid buttons on `/pricing` say "Coming soon" (2 matches in the HTML). No dev or demo banner on any page (crawl token check). `/api/trade/config` → `{"enabled":false,"env":null,"extensionId":"","riskUrl":"https://kalshi.com/regulatory"}`.

## 3. Every page × every state: PASS

`crawl.mjs` (logged out) and `crawl2.mjs` (signed in; same checks, shorter waits because the mock is exempt from rate limits) visit 33 routes at 390 and 1440 px with light CDP throttling (40 ms latency, 10 Mbit/s down), then request every internal link they found. On each page they flag console errors and warnings, page errors, NaN/undefined/null/"[object Object]"/lorem/TODO/FIXME on screen, dev or demo banners, a missing footer disclaimer, horizontal scroll, and any 5xx or 429. Routes: every public page, every account page, the 5 `/admin*` pages, a 404, 3 market pages, an event page, an open drawer (`/?m=…`) and a search (`/?q=bar`). `/api/me` is read before the crawl and after each width ("tier checks"; `nouser:` means no session).

| State | Server | Views | Issues | Internal links | Bad links | Tier checks |
|---|---|---|---|---|---|---|
| Logged out | prod 4620 | 66 | 0 | 105 | 0 | nouser:free ×3 |
| Free | mock 4630, instance 1 | 66 | 0 | 128 | 0 | free ×3 |
| Pro | mock 4630, instance 2 | 66 | 1 (environment, see below) | 282 | 0 | pro ×3 |
| Premium, 390 | mock 4630, instance 2 | 33 | 0 | — | — | premium |
| Premium, 1440 (solo re-run) | mock 4630, instance 3 | 33 | 0 | 135 | 0 | premium ×2 |
| Admin (solo) | mock 4630, instance 3 | 66 | 0 | 112 | 1 (expected, see below) | free+admin ×3 |

- **Pro, `/m/6970279` at 1440: environment-only.** On instance 2 I ran the admin crawl at the same time as the pro crawl. The dev compiler raced and logged `⨯ [TypeError: __webpack_modules__[moduleId] is not a function]`. The pro page showed "Switched to client rendering because the server rendering errored", and admin `/account` at 390 returned 500 (`logs/crawl-admin-c.log`). I stopped the concurrent crawl. On instance 3, run alone, `recheck.mjs` loaded pro `/m/6970279` at 1440 and admin `/account` at 390 twice each: 200, h1 "Como 1907 vs. AEK: O/U 4.5" and "Account", no console lines, no page errors. The full admin crawl, run alone, had 0 issues. The instance 3 log has 0 `webpack_modules` lines, 0 restarts and 0 5xx. Neither the paid e2e runs nor instance 1 logged the error. The production build (4620) never showed it.
- **Premium, 1440 pass on instance 2: environment-only.** Instance 2 restarted on the dev memory threshold at `/m/6970279` (ERR_CONNECTION_REFUSED). The rest of the pass ran signed out, so `/api/account/export` returned 401 and the last tier check read `nouser:free`. I discarded that pass and re-ran 1440 alone on instance 3, with a fresh seed: 33 views, 0 issues, 135 links, 0 bad, tier premium before and after. The 390 pass ran before the restart: 33 views, 0 issues.
- **Admin, `/api/admin/export` → 403: expected.** The crawler's plain GET sends no `Sec-Fetch-Site`, and the route refuses it on purpose (`sameSiteRequest`, `apps/web/app/api/admin/export/route.ts:22`, as in runs 3 and 4). By hand as admin: no header → 403, `cross-site` → 403, `same-origin` → 200 `text/csv; charset=utf-8`, `attachment; filename="kismet-users-2026-11-18.csv"`, header row `id,email,created_at,last_sign_in_at,tier,status,comp_tier,comp_expires_at`.
- Admin: all 5 `/admin*` pages returned 200 at both widths, with the disclaimer, no console errors and no horizontal scroll.

- For non-admins every `/admin*` page is the styled 404 ("This page doesn't exist") with the disclaimer; the only console line there is the 404 resource load itself, which the crawler counts as expected.
- Screenshots: `docs/screenshots/audit/audit5-<state>-<page>-<390|1440>.png`, for example `audit5-anon-home-390.png`, `audit5-free-markets-1440.png`, `audit5-pro-m_5747718-390.png`, `audit5-admin-admin_health-1440.png`.
- Static checks on the shipped code: `grep -rn "TODO\|FIXME"` over `apps/web/{app,components,lib}` and `apps/extension/src`: 0. `console.log` outside tests: 0. "lorem": 0.

## 4. Quality: PASS

**Lighthouse: PASS.** `npx lighthouse@12` (12.8.2), `--form-factor=mobile`, default simulated throttling, Playwright Chromium 1255 headless, on the 4650 production build (`DEMO_MODE` unset, `NEXT_PUBLIC_SITE_URL=http://localhost:4650`). It ran after all crawls, with 4620 and 4630 stopped and nothing else of mine running. Scores are performance / accessibility / best practices / SEO. `uptime` is the 1/5/15-minute load average just before each page's 3 runs.

| Page | Load (uptime) | Run 1 | Run 2 | Run 3 | Median perf |
|---|---|---|---|---|---|
| `/` | 7.31 8.79 8.85 | 92/100/100/91 (TBT 179, LCP 2987) | 92/100/100/91 (TBT 160, LCP 3062) | 90/100/100/91 (TBT 362, LCP 2276) | **92** |
| `/about` | 6.72 8.38 8.69 | 93/100/100/91 (TBT 121, LCP 3032) | 93/100/100/91 (TBT 121, LCP 3030) | 93/100/100/91 (TBT 122, LCP 3031) | **93** |
| `/pricing` | 5.27 7.79 8.46 | 94/100/100/91 (TBT 124, LCP 2883) | 98/100/100/91 (TBT 121, LCP 2109) | 94/100/100/91 (TBT 121, LCP 2881) | **94** |

- Every median is 92 or more, so one batch was enough. The load average was high (5–9) and the scores still passed.
- SEO is 91 on all 9 runs. The one deduction is `meta-description`, as in runs 3 and 4: Next 15 streams the tag, and Lighthouse misses it. 91 meets the bar. Note, not a fail.

**axe:** zero serious or critical violations. `e2e/a11y.spec.ts` passed in both demo runs.

**Keyboard-only walkthrough** (`kbd.mjs`, prod 4620, logged out, `reducedMotion: "reduce"`):
- `/` focuses the search; "barcelona", ArrowDown, Enter → `/?q=FC+Barcelona`.
- A result's title link is reached in 24 Tabs; Enter opens the "Market details" dialog with focus inside (`audit5-kbd-drawer-1440.png`).
- "Save" is reached in 5 Tabs; Enter → "Saved", focus kept, dialog open (`audit5-kbd-save-1440.png`).
- "Pricing" in 25 Tabs; Enter → `/pricing`.
- Signed in: `s7-upgrade.spec.ts:78` (search → drawer → save → upgrade) passed in both paid runs.

**Reduced motion:** with `prefers-reduced-motion: reduce` emulated, `matchMedia` matched and the longest animation and transition durations were 0.01 ms.

**Design review:** I compared `audit5-anon-home-1440.png`, `audit5-anon-home-390.png`, `audit5-anon-m_*-390.png`, `audit5-anon-period-chips-1440.png`, `audit5-premium-inbox-count-1440.png` and the OG images with `docs/design/project/Hybrid.dc.html` / `MobileHybrid.dc.html`: dark theme, emerald accent, rounded-xl cards with thin borders, 16 px mobile gutters, card anatomy all match. Cosmetic nit (not a fail, same kind as run 4's): on a market page at 390 px the other-side card truncates the name and wraps the multiplier ("CE Sabad… 40¢ · / 2.5x", `audit5-anon-m_5747718-390.png`).

## 5. Data correctness: PASS

- **Free tier is capped and delayed on the server.** `probe.py` against 4620 (logged out) sent `ps`, `page`, `page_size`, `tier`, an `x-tier` header and forged tier cookies to `/api/flags` and `/api/markets`. All 7 responses: 200, 25 rows, page 1, every row banded.
- **Delay window.** The scan finished at 03:25:18 (`scanned_at 1794990318`); the committed scan became `*-prev.json` (`scanned_at 1794895125`, 26.4 h older).
  - At 03:27, logged out, `/api/meta` returned `scanned_at 1794895125` (the prev scan), `markets_scanned 13971`, `flags 2778`.
  - The logged-out crawl (started about 10 min after the scan) shows "Updated 27 h ago · data may be stale" and "These prices are from a scan 27 h ago" (`audit5-anon-home-1440.png`, `audit5-anon-home-390.png`).
  - After the 15-minute mark (03:41) the same probe saw the new scan: 25 anonymous rows checked against the newest scan, 0 mismatches. `fresh.mjs` at 03:54: pill "Updated 29 min ago", title ending "On the Free plan you see prices 15 minutes behind.", `delay_min 15`.
  - Signed in on the mock: free → `delay_min 15`; pro and premium → `delay_min 0` (`me.mjs`). `test/delay.test.ts` covers the in-window split for paid tiers; I did not catch a Pro read inside the 15-minute window this run.
- **Cards equal the API.** `cards.mjs` on 4620: 25 API rows, 11 cards on `/` matched (price, Pays, wins about, won before, return band), 0 mismatched.
- **Fees and returns match the engine formulas** (`fees.mjs`, Pro user on the mock, 20 bets, 40 sides, `fee = FEE_RATE[cat]·p·(1−p)` from `pipeline/common.py`, `edge = q − (p + fee)`, `roi = edge / cost · 100`, against the API and `output/flags.json`): fee and edge match on all 40. Three sides differ by 0.02–0.03 roi points (asks 0.09, 0.13, 0.16); that is 4-decimal rounding of `edge` over a small cost, the same pattern as runs 3 and 4. Pass.
- No `NaN` or closed market shown (item 3 token check).

## 6. Security: PASS

- **Headers** (`curl -I` on 4620): `Strict-Transport-Security: max-age=63072000; includeSubDomains`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()`, CSP with a per-request nonce and `strict-dynamic`. `e2e/headers.spec.ts` passed in both demo runs.
- **Hidden routes** (4620, logged out): `/admin`, `/admin/users`, `/api/admin`, `/api/admin/export`, `/e2e-mock/supabase/_inbox`, `/api/data` → 404; `/api/admin` POST/PUT/PATCH/DELETE → 404; POST `/api/settle/run`, `/api/alerts/run` → 401. Non-admins: `admin.spec.ts:72` passed twice.
- **Paid data as anon/free:** item 5.
- **Another user's rows:** `test/rls.test.ts` (PGlite with the real migrations) passed in the unit run. Live check under Owner verification.
- **Rate limits** (`hammer.py`, prod 4620):
  - `/api/markets` ×40: 27×200 then 13×429, `Retry-After: 59`.
  - `/api/flags` ×40: 40×429 (that minute already spent).
  - `/api/suggest?q=bar` ×250: 120×200, 130×429.
  - A new `X-Forwarded-For`/`X-Real-IP` per request: 40×429, so spoofing does not reset the limit.
  - `smoke-prod.sh` on 4650: 40× POST `/api/ext/telemetry` → 429 after the burst.
  - `/api/health` → 503 `{"ok":false}` without Upstash (by design).
- **Crawlers:** GPTBot, ClaudeBot, CCBot, PerplexityBot, Google-Extended, Bytespider → 403 on `/` and `/api/markets`. HeadlessChrome, python-requests, curl → 200 (BotID runs only on Vercel; Owner verification).
- **Stripe webhooks** (`webhook.mjs`, mock, real `stripe` signing): unsigned, wrong secret, 1-hour-old timestamp and body changed after signing → 400. Replayed event id → `{"duplicate":true}`. A raw unsigned `client_reference_id` is ignored; a subscription for that unlinked customer gets 500 "Retry".
- **Dependencies:** `apps/web` `pnpm audit --prod`: no known vulnerabilities. Full `pnpm audit`: 1 moderate (minimatch, dev tooling). `apps/extension`: none. `pip-audit -r requirements.txt`: none.
- **Secrets in history:** the regex scanner (`secrets_scan.py`, gitleaks-equivalent rules) over `git log --all -p`, 266 commits: 21 hits, the same known fakes as run 4 (`FAKEFAKE` keys, `whsec_mocksecret…`, test JWTs, the `AAAA` PEM test body, the PEM placeholder label). Commits since run 4 (`1546929..748b70e`): 0 hits.
- **Client bundles:** `pnpm check:bundle` on the prod build: "126 files in .next/static, no secrets". My grep for `SUPABASE_SERVICE_ROLE`, `STRIPE_SECRET_KEY`, `sk_live_`, `sk_test_`, `whsec_`, `UPSTASH_REDIS_REST_TOKEN`, `CRON_SECRET`, `EXT_SIGNING_SECRET`, `UNSUBSCRIBE_SECRET`, `service_role` in `.next/static`: 0 files.
- **Cookies:** the prod build sets no cookie on `/`, `/markets`, `/login`. `Secure` on auth cookies is production-only (`middleware.ts`), so it is under Owner verification.

## 7. Multipliers and combos: PASS

- **Combo math** (scratch vitest, hand-computed cases): 4 of 4 pass.
  - Two legs: price (0.5+0.0125)(0.4+0.012) = 0.21115, ret 0.3/0.21115 − 1, `has_edge` true.
  - Three legs at 0.8 + 0.008 fee: price 0.808³ = 0.527514, `has_edge` false (q_low 0.512 < price).
  - Same-event legs: `same_event` is `["Game X"]`. `e2e/multipliers.spec.ts` (the warning in the UI) passed twice.
  - Kalshi combo at 30¢ with Q 0.4: fee 0.02, edge 0.08, ret 0.25.
- `test/multipliers.test.ts` (13 tests): "the 10x bet with a 14% chance shows in tier edge (chance floor off)" and "hides a leg count that lost money in testing; Free gets bands" pass. In the real scan one side is ≥10x with a 10–20% chance and a ≥4-point edge (market 6841253, ask 0.06, q 0.108), in tier `best` (shown in both tiers). Tier split 775 best / 1,212 edge.
- `formatCount` rounds down (`lib/format.ts:121-129`, integer tenths); its unit tests pass. Live: "Full game" 14,219 shows "14K" with the exact number as the title.
- **Raw-count sweep (the rule failed in runs 3 and 4).** I grepped every file under `apps/web/components`, `apps/web/app` and `apps/extension/src` for template strings and JSX holding counts (`length`, `count`, `total`, `n`, `unread`, `bets`, `entries`, `wins`, `events`, `flags`, …), `String(n)` and `toLocaleString`, then read each of the 95 + 18 hits, plus the email templates and both `opengraph-image.tsx` files. Every count that can pass 999 on a production page goes through `formatCount` (directly, through `Count`, or through local aliases: `nf` in `BestBets.tsx:27`, `n` in `status/page.tsx:11` and `about/page.tsx:22`, `int` in `lib/trackRecord.ts:11`). Admin pages use `exactCount` on purpose, as accepted in runs 3 and 4. Judged, not fails (the owner can overrule):
  - `components/trade/TradeTicket.tsx:170,229`: `count.toLocaleString("en-US")` for the contract quantity on the order ticket and the confirm screen. Up to 2,500 at 1¢ under the $25 cap. This is an order quantity on a money path, not a count of bets, markets or events (`docs/18` §4's scope); rounding it down to "2.5K" would misstate the order.
  - `components/header/Bell.tsx:26`: `aria-label="Alerts, 1234 unread"` (seen live). The visible badge is capped at "99+". Screen-reader text only.
  - `app/track-record/Charts.tsx:44`: the "Bets" chart tooltip uses `toLocaleString`; the axis uses `formatCount`. That matches §4's "hover shows the exact number".
  - `components/alerts/AlertsView.tsx:70` (`${n} new alerts`) and `:80` (`Rules (${rules.length})`): "Run now" renders only when `DEV || DEMO` (`:76`). In production rules are capped at 20/100 by `plan_quota`. In local demo mode (no quotas in `LocalRepo`) both could pass 999. Not shipped; listed for completeness.
  - `components/journal/JournalView.tsx:129,131` (`#${n}`, "After bet #n"): an ordinal, not a count.
  - `apps/extension/src/content.ts:87` (`${n} best bets on this page`): one event page's flags; the largest event in this scan has 41 flags (285 markets). The side panel shows the same number through `formatCount`. Bounded in practice.
  - Bounded as in run 4: TopicsPicker chosen count, combo leg counts (≤6), dashboard panel counts, AuthBoot's guest-import summary (guests cannot insert: `guestRepo` sends inserts to login), "Last {n} alerts" (sliced to 50, `Inbox.tsx:12`).

## 8. Trading safety: PASS

- Prod 4620: `/api/trade/config` → `{"enabled":false,"env":null,…}`; POST `/api/trade/nonce` → 404 `{"error":"Trading is off."}`; POST `/api/trade/nonce/verify` → 404.
- Run 3's scratch spec with the real extension (`trade/`, demo build on 4640, extension built with `KISMET_ORIGIN`, clean Chromium profile, Kalshi demo API mocked with real Ed25519 signature checks): **1 passed** (1.5 m).
  - A key with `write::transfer` is rejected: "This key also allows write::transfer. For safety Kismet only accepts trade-only keys…" (`audit5-ext-transfer-scope-rejected.png`).
  - Over the $25 per-order cap: "Over your $25 per-order limit." in the ticket; 0 orders reached Kalshi (`audit5-ext-cap-refused.png`).
  - Confirm required: 0 orders at Kalshi on the confirm screen, 1 after the click.
  - Keys never leave the extension: 73 requests to 3 hosts (the extension, the app, demo Kalshi); the PEM in 0 requests, the key id in 0 requests outside Kalshi; extension storage held only `{"spend":{"cents":198,…}}`; page storage held neither.
- `e2e/trading-paper.spec.ts` passed in both demo runs.
- Code review: `apps/extension`, `lib/trade` and `components/trade` are unchanged since run 4 (`git diff 1546929..748b70e` touches only the 3 files named at the top). Run 3's grep and review stand.

## 9. Billing: PASS (mock)

`webhook.mjs` on the mock, signed with the test secret, separate user:
- `checkout.session.completed` with a signed `client_reference_id` linked the customer (Payment Link path); `customer.subscription.created` premium → tier premium.
- Replay of the same event id → `{"duplicate":true}`, tier unchanged.
- Portal cancel (`cancel_at_period_end=true`) → still premium. `customer.subscription.deleted` → free. Replaying the deletion → duplicate.
- S7 (sign up → Checkout → webhook → Pro unlocks) and account delete with a live subscription (`s7-upgrade.spec.ts:60`) passed in both paid runs.
- Observation, unchanged from runs 3 and 4 and reproduced again: `lib/billing/stripe.ts` `handleEvent` has no event-ordering guard. A pro update, then an older premium update with a new id delivered late, left the user on premium. Under Owner verification.

## 10. Legal and wording: PASS (placeholders listed)

- Footer disclaimer "Market analytics, not financial advice. Based on past results. 18+." on every crawled view in every state (item 3), on 11 pages by `curl` (2 matches each), in the extension popup (`audit5-ext-popup.png`), on both OG images and in all three emails.
- `/terms`, `/privacy`, `/refunds`, `/disclaimer`, `/contact`, `/status` → 200, all linked from the footer.
- `/disclaimer` names 1-800-GAMBLER and ncpgambling.org.
- 18+ gate: on the mock `/login` shows "I'm 18 or older and agree to the Terms"; POST `/api/auth/magic-link` with `accept:false` or without `accept` → 400 "Enter a valid email and tick the box" (`accept: z.literal(true)`, `app/api/auth/magic-link/route.ts:14`). On the keyless prod build the route answers 503 "Accounts are not set up yet".
- Emails rendered with a scratch vitest from `lib/email/templates.ts` (`audit5-email-alert-600.png`, `audit5-email-signin-600.png`, `audit5-email-payfail-600.png`): each has Unsubscribe and the disclaimer in both the HTML and the text part; 0 matches for guarantee / sure thing / can't lose / pick / lock / expected profit / risk-free. Alert line: "Yes at 68¢ · won 92% before · estimated return +33% · …".
- Banned words: `grep -rniE "\b(picks?|locks?|guaranteed?|sure thing|can.?t lose|risk.?free|expected profit)\b"` over `apps/web/app`, `components`, `lib/email` and `apps/extension/src`: only code comments and identifiers (`pick`, "Sentry picks errors up", "the owner picks the policy") and the negation on `/terms` ("We give no guarantee…").
- Placeholders (listed, not failed), as rendered by the prod build: `/terms` `[[GOVERNING_STATE]] [[LAST_UPDATED]] [[OPERATOR_NAMES]] [[SUPPORT_EMAIL]]`; `/privacy` `[[LAST_UPDATED]] [[OPERATOR_NAMES]] [[SUPPORT_EMAIL]]`; `/refunds` `[[LAST_UPDATED]] [[OPERATOR_NAMES]] [[REFUND_POLICY]] [[RESPONSE_TIME]] [[SUPPORT_EMAIL]]`; `/disclaimer` `[[LAST_UPDATED]] [[OPERATOR_NAMES]]`; `/contact` `[[LAST_UPDATED]] [[OPERATOR_NAMES]] [[RESPONSE_TIME]] [[SUPPORT_EMAIL]]`; every page's footer `[[OPERATOR_NAMES]]`; the email CTA `https://[[DOMAIN]]/…`.

## 11. Publication readiness: PASS

- `robots.txt` 200: disallows the AI user agents (`Disallow: /`) and `/api/`, `/auth/`, `/login`, `/onboarding`, `/account`, `/settings`, `/watchlist`, `/journal`, `/alerts`, `/dashboards`, `/admin`; has a `Sitemap:` line. `sitemap.xml` 200 with 12 `<loc>`; on 4620 (no `NEXT_PUBLIC_SITE_URL`) they point at `http://localhost:3000`, on 4650 at `http://localhost:4650`.
- No test users, seed data or debug routes in prod: `/e2e-mock/*`, `/api/data`, `/admin*` → 404.
- 404 is the styled "This page doesn't exist" inside the shell. `app/error.tsx` is the styled error boundary.
- Favicon: `<link rel="icon">` → 200 `image/svg+xml`; `/favicon.ico` → 404 (harmless, as run 4).
- OG images (4650): `/opengraph-image` 200 PNG (`audit5-og-site.png`); the longest title (market 4664134, 125 characters) wraps to three lines with an ellipsis, nothing cut off, disclaimer at the bottom (`audit5-og-longest-4664134.png`).
- Extension: `KISMET_ORIGIN=https://kismetodds.example pnpm ext:zip` wrote `kismet-extension-0.1.0.zip` (26 KB). Manifest: MV3, permissions `storage`, `sidePanel`; hosts the app origin and `external-api.demo.kalshi.co`; extension pages CSP `script-src 'self'; object-src 'self'`; 0 files with `eval(` or `new Function`. Unzipped and loaded in a clean Chromium profile: the service worker registered and the popup renders "Signed out … Paper trading Off … Market analytics, not financial advice. Based on past results. 18+." (`audit5-ext-popup.png`). The only console error is DNS for the placeholder domain.
- **Owner scripts, default (dry-run) mode**, in the worktree, with a clean environment (`env -i PATH HOME`) and no env file:
  - `node ops/secrets.mjs`: "Dry run (add --yes to write)". Exit 0.
  - `node ops/site-config.mjs --domain kismetodds.example --support-email help@kismetodds.example`: dry run of the two changes. Exit 0. `config/site.json` md5 unchanged.
  - `node ops/stripe-setup.mjs --domain kismetodds.example` (no key): prints the plan. Exit 0.
  - `node ops/preflight.mjs`: 24 blockers, 6 warnings, all expected on an unconfigured clone. Exit 1 by design.
  - `bash ops/supabase-setup.sh abcdefghijklmnopqrst`: prints the plan. Exit 0.
  - `node ops/vercel-env.mjs`: "Refusing: no env file…". Exit 2. With a test env file holding `PATH`, `HOME`, `FOO`, `E2E_MOCK`, a Supabase URL and a fake Stripe key, it planned only the 2 documented keys × 2 targets (Stripe key `--sensitive` and masked) and listed "Not pushed (test-only): E2E_MOCK" and "Not pushed (not in apps/web/.env.example): FOO, HOME, PATH". Exit 0.
  - `python ops/checks.py prod/output`: "data checks ok", exit 0.
  - `python ops/upload.py` without credentials: "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required", exit 1, nothing uploaded.
  - `ops/scheduler.py` has no dry run; `plan(now, {})` evaluated without running jobs: `bootstrap, backtest, update, fit, grade, scan`.
  - `git status` after the dry runs: no tracked file changed.
- **`ops/smoke-prod.sh`** the documented way (`DEMO_MODE=false NEXT_PUBLIC_SITE_URL=http://localhost:4650` build, `SMOKE_EXPECT_HEALTH=503 ops/smoke-prod.sh http://localhost:4650`): **18 passed, 0 failed**, exit 0.
- `SETUP.md` from scratch reaches a running app (item 2).

## Fails to fix

None. No item failed on `748b70e`. The notes that are not fails are the 390 px multiplier wrap (item 4), the `meta-description` SEO deduction (item 4), and the count-rule exceptions to confirm (Owner verification).

## Fixed since run 4

I re-checked both of run 4's fails on `748b70e`:

1. **Raw counts in the FilterPanel `Chip` and the AlertsView Inbox tab: fixed** (T-210).
   - `FilterPanel.tsx:225` now renders `formatCount(count)` with `title={exactCount(count)}` and `tabular-nums`. Live on `/markets` → More filters → "Part of the game", both logged out (4620) and Pro (mock): "Full game **14K**" (title "14,219"), 1H 479, 2H 185, 1Q 179, 2Q 170, 3Q 162, 4Q 170 (`chips2.mjs`; `audit5-anon-period-chips-1440.png`). Run 4 showed "Full game 8545". Logged out and Pro show the same number now because the scan was past the 15-minute delay by then, so both read the newest scan; it is not a tier leak (item 5).
   - `AlertsView.tsx:80` now renders `Inbox (${formatCount(unread)} new)`. I seeded 1,234 unread `alert_events` for the premium user straight into the mock database (`inbox.mjs`). `/alerts` shows the tabs `["Rules (0)", "Inbox (1.2K new)"]`; the bell badge shows "99+"; the list header "Last 50 alerts" (`audit5-premium-inbox-count-1440.png`).
   - The app-wide sweep (item 7) found no other production count that can pass 999 without `formatCount`.
2. **Paid e2e mock answered HEAD with 500: fixed** (T-211).
   - `app/e2e-mock/[...path]/route.ts:36` exports HEAD; `:155` answers it with 200 and `content-range: */<n>`; `:166-167` and `:178-179` answer an empty PATCH/POST body with 400 `PGRST102` instead of throwing.
   - Both paid runs log `HEAD /e2e-mock/supabase/rest/v1/watchlist?select=id 200` and no `SyntaxError` / `Unexpected end of JSON input` (item 1). So the plan-quota fast path in `lib/repo/server.ts:68` now runs in the paid suite with a real count.
   - By curl on 4630: HEAD with `Prefer: count=exact` → 200, `content-range: */0`; empty POST and empty PATCH → 400.
   - The refusal itself: `quota.mjs` signed in as Free POSTed watchlist rows to `/api/data/watchlist` on the mock. Rows 1–10 → 200, rows 11 and 12 → 403 `{"error":"Your plan allows 10","upgrade":true,"limit":10}`, each after a `HEAD … 200`. The mock has no `plan_quota` trigger, so this 403 is the fast path.
   - Caveat, not a fail: no paid e2e test asserts that 403; the suite only passes through the fast path. The refusal is shown by my scratch script, `test/e2e-mock.test.ts` (HEAD count) and the PGlite `plan_quota` tests (`test/rls.test.ts`, `test/redteam.test.ts`).

## Owner verification

These need live accounts. The mocks cover only the code path. Unchanged from run 4, except that the paid e2e now exercises the quota fast path.

- **Supabase:**
  - Run the RLS checks against the live project with the anon key (user B cannot read user A's rows).
  - Send a real magic-link email.
  - Run `ops/supabase-setup.sh <ref> --yes`.
  - After a real sign-in on the deployed site, confirm the auth cookies carry `Secure; HttpOnly; SameSite=Lax`.
  - Confirm the `plan_quota` trigger blocks an 11th Free watchlist row on the live database (the trigger, not the fast path).
- **Stripe test mode end to end:**
  - Checkout.
  - Webhook delivery to the deployed URL.
  - Customer Portal cancel.
  - A real Payment Link, if `stripe.mode` is `links`.
  - Decide whether out-of-order subscription events need a `created`/`current_period` guard (item 9; reproduced again this run).
- **Upstash:** set the Redis keys, so the shared limiter replaces the in-memory one and `/api/health` reports ok.
- **Vercel:**
  - Confirm BotID challenges headless browsers and scripted clients on the deployed site.
  - Set Root Directory to `apps/web`.
  - Push env with `node ops/vercel-env.mjs --env apps/web/.env.prod` and check the plan lists only the expected keys.
- **Kalshi demo:** place one demo order from the extension with a real demo key.
- **Domain and `config/site.json`:**
  - Fill the placeholders listed in item 10.
  - Set `NEXT_PUBLIC_SITE_URL`, so the sitemap, canonical URLs and OG URLs stop using `http://localhost:3000`.
- **Scan cadence:** run the engine container (10-minute scans), as `docs/setup-notes/ops.md` describes. With only the `refresh.yml` fallback (every 2 h), the "about every 10 minutes" wording is wrong.
- **Chrome Web Store:** publish the extension and set `NEXT_PUBLIC_EXTENSION_ID`.
- **Count rule exceptions (item 7):** confirm that the exact contract quantity on the trade ticket and the exact unread count in the bell's `aria-label` are wanted.

# Audit run 6

Kismet final audit, sixth run.

Auditor: a fresh agent that built none of this code. It checked and fixed nothing.
Target: branch `final` at `4aa0400` ("T-240: pricing says Free is at least 15 minutes behind (true minimum after T-232)"), checked out as worktree `audit6`.
Date: 2026-11-18, 06:01–07:12 local. The Mac then slept until 12:55, past the 08:15 cut-off; I only stopped the servers and wrote this report after that.
Spec: `docs/OVERNIGHT.md` §3, items 1–11, plus the brief's extra checks: re-run of the red-team run 3 proofs, the slow-down state, normal browsing and a Googlebot-style crawl, the Free delay with two fresh scans, a raw-count sweep, the Lighthouse protocol, two runs of each e2e suite, ops dry runs and `smoke-prod.sh`.

Since run 5 (`748b70e`), `final` gained 30 commits: the polish pass (T-220–T-232, branch `polish`), the red-team run 3 report and its fixes (T-230–T-238, branch `fix-rt3`, RT3-01..09), and T-240 (pricing copy). The polish and fix branches both use the titles T-230/T-231/T-232. That is a numbering clash, not a fail.

How the audit ran:
- Everything ran outside `~/Desktop`, in a scratch directory:
  - `audit6/` is a git worktree at `4aa0400`. Unit tests, lint, typecheck and both e2e suites (twice each) ran here, after `pnpm i --frozen-lockfile` (exit 0 for web and extension). The main checkout has no `output/*-prev*.json`, so only the 8 committed output files were copied (none of the `* 2.json` duplicates).
  - `a6/prod/` and `a6/mock/` are `git archive` copies of `4aa0400`.
- `a6/prod/` followed `SETUP.md` §0: a new Python venv, `pip install -r requirements.txt` (exit 0), `pytest` (45 passed), `pnpm i --frozen-lockfile` (exit 0), `pnpm build` with `DEMO_MODE` and `NEXT_PUBLIC_DEMO_MODE` unset, no `.env*` file except `.env.example`, and no Supabase/Stripe/Upstash/cron/extension variable in the environment (`BUILD_EXIT=0`). One difference from run 5: there was one production build, not two. It was built with `NEXT_PUBLIC_SITE_URL=http://localhost:4950` (the `ops/ship.md` smoke recipe), and the same build served item 2, the logged-out crawl, Lighthouse and `smoke-prod.sh`. It ran as `next start -p 4950` with `DATA_DIR=a6/prod/output`.
- Five fresh scans ran into `a6/prod/output` while the server ran (`python -m engine scan`):
  - scan 1 at 06:05:08 and scan 2 at 06:07:05, one minute after scan 1 finished;
  - scans 3–5 at 06:23:08, 06:24:00 and 06:24:20, back to back, to test a burst.
- `a6/mock/` ran the `E2E_MOCK=1` dev server on 4930 with the paid-config env, `ADMIN_EMAILS=admin-audit6@example.com`, `KALSHI_TRADING_ENV=demo` and `DATA_DIR=a6/prod/output`. The free, pro, premium, admin and a separate webhook user were seeded through the mock magic link and the mock Stripe checkout (`seed.mjs`).
- Only ports 4900–4999 were used. Every server I started was stopped before the commit.
- No Supabase, Stripe, Upstash, Vercel or Kalshi account exists. Where the in-repo mocks fully cover a check it is marked PASS; each live step is under "Owner verification".
- I did not accept commit messages, STATUS.md or run 5's text as proof.
- The machine was heavily loaded for most of the run: the 1-minute load average reached 102 (8 cores) while the mock dev server recompiled routes under memory pressure. `uptime` is recorded next to each e2e run and each Lighthouse batch.
- Scratch helpers stayed in the scratch directory and are not committed. Reused from run 5 with ports and paths changed: `crawl.mjs`, `crawl2.mjs`, `seed.mjs`, `probe.py`, `cards.mjs`, `fees.mjs`, `webhook.mjs`, `hammer.py`, `kbd.mjs`, `fresh.mjs`, `me.mjs`, `extload.mjs`, `emailshot.mjs`, `lh.sh`. New: `poll.py` (delay poller), `human.mjs` (a person browsing), `gbot.py` (Googlebot-style crawl), `scrape2.sh`/`one.sh` (`page_scrape.sh` with the page classified), `slowshot.mjs`, `pendshot.mjs`, `curve_check.py`/`curve_check2.py`/`curve_check3.py` (RT3-01 measurement), `ops.sh`, and two scratch vitest files (emails, combo math), deleted after use.

## Summary

| # | Item | Result |
|---|------|--------|
| 1 | Tests | PASS |
| 2 | Production build | PASS |
| 3 | Every page × every state | PARTIAL (Pro, Premium, admin not run) |
| 4 | Quality | PASS |
| 5 | Data correctness | **FAIL** (wording) |
| 6 | Security | **FAIL** (RT3-01 residual) |
| 7 | Multipliers and combos | PASS |
| 8 | Trading safety | PASS |
| 9 | Billing | PASS (mock) |
| 10 | Legal and wording | PASS (placeholders listed) |
| 11 | Publication readiness | PASS |

Two fails, both low to medium and both from the red-team run 3 fixes: RT3-01 is only partly closed, and the Free delay copy is still exact where it should say "at least". Item 3 is partial: the Pro, Premium and admin crawls did not run (heavy load, then the machine slept past the 08:15 cut-off). Everything else passed.

Fails, in short (details and repro under "Fails to fix"):
1. **RT3-01 is only partly fixed.** The per-market curve is gone for Free/anon and niche curves answer 403. But the public `all`/`cat:` curves, rounded to 5 pp, still give the exact win chance (within 0.5 pp) for **44 of the 98** flagged bets modelled at `all`/`cat` level. The "band + mid" baseline gets 6 of them. The fix was measured over all 18,614 markets, where it holds (20.5% vs 29.9%); over the flagged bets, which are the paid data, it does not.
2. **The Free delay copy is still not truthful in two places.** The freshness pill says "On the Free plan you see prices 15 minutes behind" while the same pill shows 21 min. The pending state says "Free data refreshes every 15 minutes; first update shortly", but it lasted 13 minutes on a cold instance. T-240 fixed only the pricing page.

## Changes since run 5

Each red-team run 3 fix, re-checked against my builds. The proofs in `ops/redteam/run3/` were re-run as they are, plus my own measurement where the proof script no longer measures the right thing.

| ID | Fix | Holds? | Evidence |
|---|---|---|---|
| RT3-01 | curve withheld from Free/anon; public curves coarse | **Partly** (fail, item 6) | see below |
| RT3-02 | rate limit + row budget on `/m` and `/event`, slow-down state | Yes | see below |
| RT3-03 | Free gets the newest scan ≥ 15 min old (prev/prev2) | Yes (notes) | see below |
| RT3-04 | CSV formula guard in the shared `cell()` | Yes | `lib/csv.ts:46-51`: text starting `= + - @ \t \r` gets a leading `'`; numbers untouched. `lib/csv.test.ts` passed. `toCsv` and the admin export both go through `cell()`. |
| RT3-05 | admin audit row before the change | Yes | `app/api/admin/route.ts:73,94,103,113,121`: `audit()` runs before each `upsert`/`rpc`/`deleteAccount`/`generateLink`; `.done` row after (`:61`). The settings `before` value is read from the table (`:70`), not the cache. `test/admin-audit-first.test.ts` passed. |
| RT3-06 | optional `ADMIN_REQUIRE_MFA` (aal2) | Yes | `lib/admin/server.ts:16-18` and `middleware.ts:71` require `aal2` only when the flag is set. `test/admin-mfa.test.ts` passed. Default off: under Owner verification. |
| RT3-07 | `/status` shows the scan the tier is served | Yes | Mock, 06:39: Free `/status` "Last market scan … 11:07 AM UTC · 32 min ago" with "you see each scan at least 15 minutes after it runs"; Pro "11:24 AM UTC · 14 min ago". |
| RT3-08 | stripe-setup masks the webhook secret | Yes | `ops/stripe-setup.mjs:161` masks it always. `ops/tests/stripe-setup.test.mjs` runs the real script against a local Stripe stand-in with no env file: "the webhook secret is never printed; the env file ends up 0600" passed. |
| RT3-09 | signed client ref lasts 7 days | Yes | `lib/billing/stripe.ts:42` `CLIENT_REF_TTL_MS = 7 * 86_400_000`. `lib/billing/stripe.test.ts` passed. Signed ref linked the customer in `webhook.mjs` (item 9). |

DB proofs: `ops/redteam/run3/rt3-db.test.ts`, `ops/redteam/rt2-db.test.ts` and `test/rls.test.ts` copied into `apps/web/test/` and run together: **3 files, 25 tests passed** (copies deleted afterwards).

**RT3-01 (curve + mid).**
- `curve_unband.py http://localhost:4930 free.jar pro.jar <12 ids>` (mock, Free session): **0/12**, each "no curve". Free `/api/markets/<id>` → `"curve": null`.
- `curve_unband.py … --list` (anonymous): crashes on `HTTP Error 403` from `/api/model/curve` for the niche segment. On prod 4950 anonymous: `segment=soccer:spreads` → 403, `soccer` → 403, `all` → 200, `cat:sports` → 200. The `all` curve's win chances are on a 5 pp grid (`0.05, 0.05, 0.1, 0.15, 0.15, 0.2, 0.25, 0.35, …`).
- The proof script can no longer run end to end, so I measured the attack it describes with `curve_check2.py`/`curve_check3.py`. For each market, take Free's band, interpolate the coarse public curve that Free may fetch (only for `all`/`cat:` models) at the exact `mid` (still in every Free row), clamp to the band, and compare with the exact win chance. Baseline = the mid clamped to the band, the same rule as `test/paywall.test.ts:222-247`. Scan `1795001060` (scan 5):

  | Population | n | Attack within 0.5 pp | Band + mid baseline |
  |---|---|---|---|
  | All markets, best side (the test's population) | 18,614 | 34.8% | 35.1% |
  | All markets modelled at `all`/`cat` | 703 | 20.5% | 29.9% |
  | Flagged bets, best side | 2,099 | 8.3% | 6.5% |
  | **Flagged bets modelled at `all`/`cat`** | **98** | **44.9% (44)** | **6.1% (6)** |

  Over all markets the claim in STATUS.md ("on `all`/`cat` markets alone, 5 pp gives 20% against a 28% baseline") reproduces. But the paid data is the flagged bets: there, the price sits away from the win chance by design, so the mid tells Free little, and the coarse curve tells it a lot. Also, `lib/data/model.ts:44` says "test/curve-coarse.test.ts measures it over the scan"; that file does not exist (`git log --all` has no such path). The measurement is in `test/paywall.test.ts:222`, over all markets of the fixture scan.

**RT3-02 (page rate limit, row budget, slow-down state).** Production build 4950, anonymous (off Vercel every anonymous caller shares the key `ip:local`, `lib/abuse.ts:137`).
- `ops/redteam/run3/page_scrape.sh http://localhost:4950 markets-prev2.json 1600 8`: "API detail 30 × 200; Page /m/<id> for 1600 distinct markets: 1600 200 nocurve; elapsed 24s". The script counts HTTP codes and the curve only, and the slow-down state is HTTP 200, so I re-ran it with each page classified (`scrape2.sh`, after a restart to clear the limiter): **58 pages with market data, 1,542 "Slow down a little" + `noindex`**, 15 s. In run 3 all 1,600 pages had data.
- **The slow-down state renders correctly.** 70 quick requests, then `/m/6117510` and `/event/1195475` at 390 and 1440 (`slowshot.mjs`): HTTP 200, title "Market · Kismet" / "Event · Kismet", `<meta name="robots" content="noindex">`, a `role="status"` card "Slow down a little · You're opening market pages faster than we allow. Wait a minute, then reload this page.", the footer disclaimer, no horizontal scroll, no console errors (`audit6-slowdown-m-390.png`, `-m-1440`, `-event-390`, `-event-1440`).
- **Normal browsing is not throttled.** `human.mjs` with a real browser: home, the screener, then 20 markets over 195 s, mixing full market pages (`/m/<id>`, 10), the drawer (`/markets?m=<id>`, 5) and event pages (5), about 6 s on each, back to the screener every third.
  - Logged out on prod 4950: **20/20 rendered**, 0 slow-down, 0 responses ≥ 400.
  - Free on the mock (4930): 20/20 rendered, 0 responses ≥ 400. The mock is a dev server and rate limits are off outside production (`lib/abuse.ts:124-129`), so this run shows only that Free shaping renders. Free's limits use the same rules with the key `u:<id>`: `test/page-limits.test.ts` (2 tests) passed.
- **Googlebot-style crawl** (`gbot.py`, Googlebot UA, 1 request/s): the 12 sitemap URLs plus the 4 internal links found on them (`/` and three `/m/<id>`): **16 × 200, no slow-down, no `noindex`**. A faster crawl of 120 distinct `/m/<id>` at about 2/s: the first 60 got the page (67 in all), then 53 got the slow-down page with `noindex` (see Owner verification).

**RT3-03 (Free ≥ 15 min).** `poll.py` read `/api/meta` every 20 s, logged out on 4950 (93 reads) and as Free and Pro on the mock (101 reads each), from 06:05 to 06:50, across all five scans.
- **Free and logged out were never served a scan younger than 15 minutes.** Smallest age served: 15.1 min (logged out) and 15.0 min (Free). Switches: logged out to scan 1 at 06:20:16 (15.1 min) and scan 2 at 06:22:17 (15.2 min); Free to scan 1 at 06:20:08 and scan 2 at 06:22:10. Pro saw each new scan within the 120 s store TTL (smallest age 1.6 min).
- The poller flagged one read: "06:20:08 free … scanned_at=1794999908 age=15.0min … BAD<15min". This is my poller, not the app. It takes `now` before it sends the request, and the mock dev server answers in seconds. 15.0 means 897–900 s at send time, so the server's own clock was past 900 s when it chose the scan. The server's rule is exact (`lib/data/store.ts:252-254`, `scanned_at <= now − delay`), and `test/delay.test.ts` "a prev copy younger than the delay is not served" passed. Not a fail.
- The burst (scans 3–5 within 74 s) was handled two ways:
  - On a warm instance, Free kept an older in-memory copy. Free on the mock read scan 2 (32 min old at 06:39).
  - On a cold instance (prod restarted at 06:25:15), every published copy was younger than 15 min, so logged-out readers got the pending state: `/api/meta` and `/api/flags` → 503 `delayed_pending` for **13 minutes** (06:25:17–06:38:04, 39 polls). The pages showed "New prices are on the way · Free data refreshes every 15 minutes; first update shortly." (`audit6-anon-pending-*`). At 06:38:12 prod served scan 3 (15.07 min old).
  - STATUS.md calls this "a few minutes of the pending state". It was 13 minutes, the worst case for a burst on a fresh instance. Note, not a fail.
- Note: `scanned_at` is stamped when the scan starts (`engine/scan.py:61`), and prices are fetched after that. Scan 1 ran 56 s (06:05:08–06:06:04). So at the 15-minute switch, some prices Free sees were fetched as little as about 14 min earlier.

## 1. Tests: PASS

- `pytest -q` (new venv in `a6/prod`): 45 passed.
- `apps/web` in the worktree: `pnpm i --frozen-lockfile` exit 0; `pnpm typecheck` exit 0; `pnpm lint` (`eslint . --max-warnings 0`) exit 0; `pnpm test`: vitest **60 files, 378 tests passed**; ops node tests **27 of 27** passed.
- `apps/extension`: `pnpm i --frozen-lockfile` exit 0, typecheck exit 0, **6 files, 42 tests passed**.
- **Demo e2e** (`playwright.config.ts`: production build of the fixture data, S1–S6, S8 `alerts.spec.ts`, search, trading-paper, multipliers, headers/CSP, `a11y.spec.ts`):
  - Run 1, PW_PORT 4910, 06:03:44: **52 passed** (1.2 m). Load 6.42 before, 5.36 after.
  - Run 2, PW_PORT 4912, 06:06:50: **52 passed** (1.0 m). Load 6.54 before, 9.18 after.
- **Paid e2e** (`playwright.paid.config.ts`, `E2E_MOCK=1` dev server; admin ×2, paywall pages, S7, account delete, keyboard search → drawer → save → upgrade):
  - Run 1, PW_PORT 4911, 06:04:55: **6 passed** (1.9 m). Load 5.36 before, 6.54 after.
  - Run 2, PW_PORT 4913, 06:07:53: **6 passed** (1.6 m). Load 9.18 before, 8.01 after.
  - No failure in any of the four runs, so no solo re-runs were needed.
- **Paid webserver log** (`DEBUG=pw:webserver`, 912 and 898 `[WebServer]` lines): 0 `SyntaxError`, `Unexpected end of JSON`, `⨯` or `TypeError`; no 5xx. Every non-2xx is expected: the 6 `/admin*` pages → 404 twice each (non-admin and anonymous), `/auth/callback` and the mock Stripe pay page → 303, and in run 1 `GET /api/data` → 401 and `GET /e2e-mock/supabase/auth/v1/user` → 401 (signed-out checks).

## 2. Production build: PASS

- `SETUP.md` §0 in `a6/prod` (see the top): `BUILD_EXIT=0`.
- `next start -p 4950` served every page with 200 in the logged-out crawl (item 3). Server log: only the expected `[abuse] UPSTASH_REDIS_REST_URL/TOKEN not set: rate limits are per instance (in memory)` and Node's localStorage ExperimentalWarning.
- `/pricing` and `/about` show "Coming soon" on the paid buttons (2 matches each). No dev or demo banner (crawl token check; 0 matches for "demo mode" in `/`).
- `/api/trade/config` → `{"enabled":false,"env":null,"extensionId":"","riskUrl":"https://kalshi.com/regulatory"}`.

## 3. Every page × every state: PARTIAL (Pro, Premium, admin not run)

Crawler `crawl2.mjs`: 33 routes (every page, 3 market pages, an event page, the drawer `/?m=`, a search) at 390 and 1440 px, with light CDP throttling. On each view it checks for console errors and warnings, page errors, bad tokens on screen (`NaN`, `undefined`, `null`, `[object Object]`, lorem, TODO…), the footer disclaimer, horizontal scroll, and any 5xx/429. Then it requests every internal link it found, in the same session.

| State | Server | Views | Problems | Links checked | Result |
|---|---|---|---|---|---|
| Logged out | prod 4950 | 66 | 0 | 104 of 104, 0 bad | PASS |
| Free | mock 4930 | 63 of 66 logged (below) | 0 | 82 (stopped early): 80 × 200, 2 timeouts | PASS |
| Pro | mock 4930 | 1 | – | – | **not run** |
| Premium | mock 4930 | 0 | – | – | **not run** |
| Admin | mock 4930 | 5 | – | – | **not run** |

- Logged out: every page 200 except `/admin*` and `/no-such-page` (404, styled), disclaimer on every view, no horizontal scroll, no console error. `/api/me` read `nouser:free` before, between and after the widths.
- Free: same, with only the expected `/admin*` and `/no-such-page` 404s. My own stdout redirect overwrote the first three 390 px rows (`/`, `/markets`, `/about`) in the log; the 1440 px rows for those pages and `audit6-free-home-390.png` / `audit6-free-markets-390.png` show no problem. I stopped the link check at 82 links to free the machine. The 2 timeouts (`/disclaimer`, `/event/1325077`) were the dev server compiling under memory pressure: both pages rendered 200 in the view pass and in the logged-out crawl.
- **Pro, Premium and admin crawls: not run.**
  - The first Pro attempt (06:29), run in parallel with Premium and admin, crashed when the dev server reloaded during a page evaluation. I stopped Premium and admin to save the machine.
  - A solo retry at 07:08 (load 42) crashed the same way after 1 view. A third run (admin → Pro → Premium, with a retry around the evaluation) logged 5 admin views (`/`, `/markets`, `/about`, `/pricing`, `/tools`, all clean) at about one view a minute.
  - Then the Mac went to sleep (`net::ERR_NETWORK_IO_SUSPENDED` on `/track-record`) and woke at 12:55, after the 08:15 cut-off, so I stopped.
  - What still covers signed-in pages: the paid e2e suite passed twice (admin pages as admin and as non-admin, the paywall pages per tier, S7 upgrade, account delete), and the Pro and Premium data checks in item 5 (`fees.mjs`, `me.mjs`, `/status`). A full Pro/Premium/admin crawl at 390 and 1440 is under Owner verification.

## 4. Quality: PASS

**Lighthouse: PASS.** `npx lighthouse@12` (12.8.2), `--form-factor=mobile`, default simulated throttling, Playwright Chromium 1255 headless, on the 4950 production build (`DEMO_MODE` unset, `NEXT_PUBLIC_SITE_URL=http://localhost:4950`). The mock dev server was paused (`SIGSTOP`) and nothing else of mine ran. Scores are performance / accessibility / best practices / SEO. `uptime` is the 1/5/15-minute load average just before each page's 3 runs.

Batch 1 (06:57–07:01), during a load spike from outside the audit:

| Page | uptime | Run 1 | Run 2 | Run 3 | Perf median |
|---|---|---|---|---|---|
| `/` | 26.54 49.19 41.46 | 82/100/100/100 | 72/100/100/91 | 82/100/100/91 | 82 |
| `/about` | 17.44 42.65 39.49 | 73/100/100/91 | 82/100/100/91 | 83/100/100/91 | 82 |
| `/pricing` | 10.58 36.89 37.54 | 86/100/100/91 | 87/100/100/91 | 84/100/100/91 | 86 |

Total blocking time was 421–1,853 ms here; with 26–49 runnable processes on 8 cores the main thread was starved. I do not count batch 1 as a valid measurement.

Batch 2 (07:02–07:04), once the load had dropped:

| Page | uptime | Run 1 | Run 2 | Run 3 | Perf median |
|---|---|---|---|---|---|
| `/` | 5.62 23.56 31.91 | 91/100/100/100 | 94/100/100/91 | 95/100/100/91 | **94** |
| `/about` | 4.27 20.68 30.42 | 92/100/100/91 | 92/100/100/91 | 97/100/100/91 | **92** |
| `/pricing` | 3.45 18.42 29.14 | 94/100/100/91 | 98/100/100/91 | 94/100/100/91 | **94** |

- Performance median ≥ 90 on every page (TBT 120–220 ms, LCP 2.1–3.1 s, FCP 0.76–0.91 s).
- Accessibility 100 and best practices 100 on all 18 runs.
- SEO 91 on 8 of 9 batch 2 runs. The one deduction is `meta-description`, as in runs 3–5 (Next 15 streams the tag; Lighthouse misses it). Note, not a fail.
- JSON reports: `a6/lh-out/b{1,2}_*.json` (scratch).

**axe:** zero serious or critical violations. `e2e/a11y.spec.ts` passed in both demo runs.

**Keyboard-only walkthrough** (`kbd.mjs`, prod 4950, logged out, `reducedMotion: "reduce"`):
- `/` focuses the search; "barcelona", ArrowDown, Enter → `/?q=FC+Barcelona`.
- A result's title link is reached in 24 Tabs; Enter opens the "Market details" dialog with focus inside.
- "Save" in 5 Tabs; Enter → "Saved", focus kept, dialog open.
- "Pricing" in 26 Tabs; Enter → `/pricing` (`audit6-kbd-drawer-1440.png`, `audit6-kbd-save-1440.png`).
- Signed in: `s7-upgrade.spec.ts:78` passed in both paid runs.

**Reduced motion:** `matchMedia` matched; the longest animation and transition durations were 0.01 ms.

**Design review of the polish pass** (crawl screenshots at 390 and 1440 against `docs/design/project/Hybrid.dc.html` / `MobileHybrid.dc.html`):
- Dark theme, emerald accent, rounded-xl cards, 16 px gutters: all hold.
- Run 5's nit is fixed (T-220): the other-side card at 390 now stacks the name over "33¢ · 3.0x" with no truncation (`audit6-anon-m_6707271-390.png`).
- The market actions fit one row at 390 (T-231).
- The compare-plans table keeps the feature column pinned (T-228, `audit6-anon-pricing-390.png`).
- I found no new alignment, truncation or contrast problem.

## 5. Data correctness: **FAIL** (wording)

- **Free is capped and delayed on the server.** `probe.py` against 4950, logged out, with `ps`, `page`, `page_size`, `tier`, an `x-tier` header and forged tier cookies on `/api/flags` and `/api/markets`. All 7 responses: 200, 25 rows, page 1, every row banded. 25 anonymous rows checked against the scan they were served from: 0 mismatches.
- **Delay:** holds (RT3-03 above). Pro inside the window: at 06:39 on the mock, Pro read scan 5 (`1795001060`) while Free read scan 2 (`1795000025`, `delay_min 15`) (`me.mjs`). Premium matched Pro. Run 5 could not catch this.
- **Cards equal the API.** `cards.mjs` on 4950: 25 API rows, 12 cards on `/` matched, 0 mismatched.
- **Fees and returns match the engine formulas** (`fees.mjs`, Pro on the mock, 20 bets, 40 sides, `fee = FEE_RATE[cat]·p·(1−p)` from `pipeline/common.py`, `edge = q − (p + fee)`, `roi = edge / cost · 100`): fee and edge match on all 40. Two sides (asks 0.17 and 0.11) differ by 0.02–0.03 roi points: 4-decimal rounding of `edge` over a small cost, the same pattern as runs 3–5. Pass.
- **Freshness pill: the number is right, the copy is not.**
  - At 06:45 logged out: the pill showed "Updated 21 min ago", the Best bets line "Scanned 22 min ago", and `/api/meta` `scanned_at 1795001060` (22.7 min).
  - The pill's title said: "Prices and win chances were last checked 21 min ago. Prices refresh about every 10 minutes. On the Free plan you see prices 15 minutes behind."
  - Since RT3-03 (T-232) Free is "at least" 15 minutes behind: 15–25 min at the 10-minute cadence, 32 min in my burst test on a warm instance. T-240 corrected `/pricing` and `Plans.tsx` for exactly this reason. The pill (`components/header/FreshnessPill.tsx:30`) and the pending line (`lib/api.ts:89`, "Free data refreshes every 15 minutes; first update shortly.", shown for 13 minutes on a cold instance) were not corrected.
  - The brief requires the UI copy to be truthful, so this is a fail (low severity). See "Fails to fix" 2.

## 6. Security: **FAIL** (RT3-01 residual)

- **Paid data as free/anon:** item 5 (rows capped and banded). But the exact win chance of 44 of 98 flagged bets modelled at `all`/`cat` level can be rebuilt within 0.5 pp from the public coarse curve plus the mid ("Changes since run 5", RT3-01). See "Fails to fix" 1.
- **Headers** (`curl -I` on 4950): `Strict-Transport-Security: max-age=63072000; includeSubDomains`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()`, CSP with a per-request nonce and `strict-dynamic`. `e2e/headers.spec.ts` passed in both demo runs.
- **Hidden routes** (4950, logged out): `/admin`, `/admin/users`, `/api/admin`, `/api/admin/export`, `/e2e-mock/supabase/_inbox`, `/e2e-mock/supabase/auth/v1/user`, `/api/data` → 404. `/api/admin` POST/PUT/PATCH/DELETE → 404. POST `/api/settle/run`, `/api/alerts/run` → 401. Non-admins: `admin.spec.ts:72` passed twice.
- **Another user's rows:** `test/rls.test.ts`, `rt2-db.test.ts`, `rt3-db.test.ts` (PGlite with the real migrations): 25 passed. Live check under Owner verification.
- **Rate limits:** `hammer.py` on 4950 (production build, in-memory limiter):
  - `/api/markets` ×40 → 27 × 200 then 13 × 429 (`Retry-After: 48`).
  - `/api/flags` ×40 right after → 40 × 429 (same anonymous key, window still open).
  - `/api/suggest?q=bar` ×250 → 120 × 200, 130 × 429.
  - `/api/markets` ×40 with a new `X-Forwarded-For`/`X-Real-IP` each → 40 × 429: spoofed headers do not reset the limit.
  - Page limits: RT3-02 above. `smoke-prod.sh`: 40 × POST `/api/ext/telemetry` → 429 after the burst.
- **Crawlers:** GPTBot, ClaudeBot, CCBot, PerplexityBot, Google-Extended, Bytespider → 403 on `/` and `/api/markets`. HeadlessChrome, python-requests, curl → 200 (BotID runs only on Vercel; Owner verification).
- **Stripe webhooks** (`webhook.mjs`, mock, real `stripe` signing, separate user): unsigned → 400 "Not configured or unsigned"; wrong secret, 1-hour-old timestamp, body changed after signing → 400 "Bad signature". Replayed event id → `{"duplicate":true}`. A raw unsigned `client_reference_id` is ignored; a subscription for that unlinked customer gets 500 "Retry".
- **Dependencies:** `apps/web` `pnpm audit --prod`: no known vulnerabilities. Full `pnpm audit`: 1 moderate (dev tooling, GHSA-g3hv-75wg-m249). `apps/extension`: none. `pip-audit -r requirements.txt` (installed into the `a6/prod` venv): "No known vulnerabilities found".
- **Secrets in history:** the regex scanner (`secrets_scan.py`, gitleaks-equivalent rules) over `git log --all -p`, 296 commits: 22 hits. That is run 5's 21 known fakes plus one new one in `7df1a92`: `STRIPE_SECRET_KEY: "sk_test_FAKEFAKEFAKEFAKE"` in `ops/tests/stripe-setup.test.mjs`, a known fake. Commits since run 5: that 1 hit only.
- **Client bundles:** `pnpm check:bundle` on the prod build: "127 files in .next/static, no secrets". My grep for `SUPABASE_SERVICE_ROLE`, `STRIPE_SECRET_KEY`, `sk_live_`, `sk_test_`, `whsec_`, `UPSTASH_REDIS_REST_TOKEN`, `CRON_SECRET`, `EXT_SIGNING_SECRET`, `UNSUBSCRIBE_SECRET`, `service_role` in `.next/static`: 0 files.
- **Cookies:** the prod build sets no cookie on `/` or `/login`. `Secure` on auth cookies is production-only; under Owner verification.
- RT3-04 to RT3-09: hold ("Changes since run 5").

## 7. Multipliers and combos: PASS

- **Combo math** (scratch vitest against `lib/combos.ts`, hand-computed): 4 of 4 pass.
  - Two legs: price (0.5+0.0125)(0.4+0.012), ret (0.6/0.5125)(0.5/0.412) − 1, `has_edge` true.
  - Three legs at 0.8 + 0.008 fee: price 0.808³, `has_edge` false.
  - Same-event legs → `same_event: ["Game X"]`. `e2e/multipliers.spec.ts` (the warning in the UI) passed twice.
  - Kalshi combo at 30¢ with Q 0.4: fee 0.02, edge 0.08, ret 0.25.
- `test/multipliers.test.ts` passed: "the 10x bet with a 14% chance shows in tier edge (chance floor off)" and "hides a leg count that lost money in testing; Free gets bands". In scan 5 one side is ≥10x with a 10–20% chance and a ≥4-point edge: market 6841253, ask 0.06, win 0.108, edge 0.045, tier `best`. Tier split: 735 best / 1,312 edge.
- **Raw-count sweep.** Re-read every hit of a grep for counts in JSX and template strings (`length`, `count`, `total`, `unread`, `n`, `toLocaleString`, `String(`) over `apps/web/app`, `apps/web/components` and `apps/extension/src`, plus the full diff since run 5.
  - New or changed count displays since run 5: TopicsPicker (`formatCount(n ?? 0) open`), DayStrip (`formatCount(closing.length)`), `/status` (`n` = `formatCount` alias). All use `formatCount`. The new SlowDownState and the `/status` delay line hold no counts.
  - `track-record/page.tsx:202,207` render `{n}`, where `n = formatCount(ledger.entries)` (`:196`).
  - The exceptions judged in run 5 are unchanged: the trade ticket quantity, the bell `aria-label`, the chart tooltip, the dev/demo-only "Run now" message, the journal ordinal, and the extension pill.
  - **No production count that can pass 999 shows without `formatCount`.** Live: "Full game 14K" (period chips), "18K" markets and "2K" best bets on `/status`, "16K past bets tested" on `/`.

## 8. Trading safety: PASS

- Prod 4950: `/api/trade/config` → `{"enabled":false,"env":null,…}`; POST `/api/trade/nonce` → `{"error":"Trading is off."}`.
- `git diff 748b70e..4aa0400 --stat -- apps/extension apps/web/lib/trade apps/web/components/trade` is empty. Run 5's live extension spec (transfer-scope key rejected, $25 cap, confirm required, keys never leave the extension) and the grep review stand. I did not re-run that spec.
- `e2e/trading-paper.spec.ts` passed in both demo runs.

## 9. Billing: PASS (mock)

`webhook.mjs` on the mock, signed with the test secret, separate user (`webhook-audit6@example.com`):
- `checkout.session.completed` with a signed `client_reference_id` linked the customer (Payment Link path); `customer.subscription.created` premium → tier premium.
- Replay of the same event id → `{"duplicate":true}`, tier unchanged.
- Portal cancel (`cancel_at_period_end=true`) → still premium. `customer.subscription.deleted` → free. Replaying the deletion → duplicate.
- S7 and account delete with a live subscription (`s7-upgrade.spec.ts:60`) passed in both paid runs.
- Unchanged observation (runs 3–5), reproduced again: an older premium update delivered after a newer pro one leaves the user on premium (`lib/billing/stripe.ts` `handleEvent` has no ordering guard). Under Owner verification.

## 10. Legal and wording: PASS (placeholders listed)

- Footer disclaimer "Market analytics, not financial advice. Based on past results. 18+." on every crawled view in every state (item 3), on the slow-down and pending states, in the extension popup (`audit6-ext-popup.png`) and in all three emails.
- `/terms`, `/privacy`, `/refunds`, `/disclaimer`, `/contact`, `/status` → 200, all linked from the footer. `/disclaimer` names 1-800-GAMBLER and ncpgambling.org.
- 18+ gate: on the mock, POST `/api/auth/magic-link` with `accept:false` or without `accept` → 400 "Enter a valid email and tick the box". On the keyless prod build → 503 "Accounts are not set up yet".
- Emails rendered from `lib/email/templates.ts` with a scratch vitest (`audit6-email-alert-600.png`, `-signin-`, `-payfail-`). Each has Unsubscribe and the disclaimer in both parts, and none of the banned words. Alert line: "Under at 70¢ · won 95% before · estimated return +34% · closes Tue 3:00 PM (6 days)".
- Banned words: `grep -rniE "\b(picks?|locks?|guaranteed?|sure thing|can.?t lose|risk.?free|expected profit)\b"` over `apps/web/app`, `components`, `lib/email` and `apps/extension/src`: only code comments and identifiers (`Pick<…>`, `pick()`, "Sentry picks errors up", `locked`, `LOCK` icon) and the negation on `/terms` ("We give no guarantee…").
- The new pricing copy (T-240, "At least 15 minutes behind, top 25 rows") and the `/status` and sign-in-unavailable copy ("at least 15 minutes") are truthful. The two places that still say "15 minutes" exactly are the item 5 fail.
- Placeholders (listed, not failed), as rendered by the prod build: `/terms` `[[GOVERNING_STATE]] [[LAST_UPDATED]] [[OPERATOR_NAMES]] [[SUPPORT_EMAIL]]`; `/privacy` `[[LAST_UPDATED]] [[OPERATOR_NAMES]] [[SUPPORT_EMAIL]]`; `/refunds` `[[LAST_UPDATED]] [[OPERATOR_NAMES]] [[REFUND_POLICY]] [[RESPONSE_TIME]] [[SUPPORT_EMAIL]]`; `/disclaimer` `[[LAST_UPDATED]] [[OPERATOR_NAMES]]`; `/contact` `[[LAST_UPDATED]] [[OPERATOR_NAMES]] [[RESPONSE_TIME]] [[SUPPORT_EMAIL]]`; every footer `[[OPERATOR_NAMES]]`.

## 11. Publication readiness: PASS

- `robots.txt` 200: disallows the AI user agents and `/api/`, `/auth/`, `/login`, `/onboarding`, `/account`, `/settings`, `/watchlist`, `/journal`, `/alerts`, `/dashboards`, `/admin`; has `Sitemap: http://localhost:4950/sitemap.xml`. `sitemap.xml` 200 with 12 `<loc>` on `http://localhost:4950`.
- The slow-down state and the pending state are `noindex` / not indexable pages; the 12 sitemap pages never hit the limit at crawl pace (RT3-02).
- No test users, seed data or debug routes in prod: `/e2e-mock/*`, `/api/data`, `/admin*` → 404.
- 404 is the styled "This page doesn't exist" inside the shell.
- Favicon `<link rel="icon" href="/icon.svg…">` → 200 `image/svg+xml`; `/favicon.ico` → 404 (harmless, as runs 4–5).
- OG images: `/opengraph-image` 200 PNG (`audit6-og-site.png`), `/m/6117510/opengraph-image` 200 PNG (`audit6-og-market-6117510.png`).
- Extension: `KISMET_ORIGIN=https://kismetodds.example pnpm ext:zip` wrote `kismet-extension-0.1.0.zip` (26,267 bytes). Manifest: MV3, permissions `storage`, `sidePanel`, hosts the app origin and `external-api.demo.kalshi.co`, CSP `script-src 'self'; object-src 'self'`; 0 files with `eval(` or `new Function`. Loaded unpacked in a clean Chromium profile: the service worker registered and the popup renders "Signed out … Paper trading Off … Market analytics, not financial advice. Based on past results. 18+." The only console error is DNS for the placeholder domain.
- **Owner scripts, dry-run mode**, in the worktree with `env -i PATH HOME` and no env file (`ops.sh`):
  - `node ops/secrets.mjs`: dry-run plan. Exit 0.
  - `node ops/site-config.mjs --domain … --support-email …`: dry run, lists the still-missing legal fields. Exit 0. `config/site.json` md5 unchanged.
  - `node ops/stripe-setup.mjs --domain kismetodds.example`: prints the plan. Exit 0.
  - `node ops/preflight.mjs`: 24 blockers, 6 warnings, all expected on an unconfigured clone. Exit 1 by design.
  - `bash ops/supabase-setup.sh abcdefghijklmnopqrst`: prints the plan. Exit 0.
  - `node ops/vercel-env.mjs`: "Refusing: no env file…". Exit 2. With a test env file (`PATH`, `HOME`, `FOO`, `E2E_MOCK`, a Supabase URL, a fake Stripe key): only the 2 documented keys × 2 targets, the Stripe key `--sensitive` and masked, "Not pushed (test-only): E2E_MOCK", "Not pushed (not in apps/web/.env.example): FOO, HOME, PATH". Exit 0.
  - `python ops/checks.py a6/prod/output` (after 5 fresh scans): "data checks ok", exit 0.
  - `python ops/upload.py` without credentials: "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required", exit 1, nothing uploaded.
  - `ops/scheduler.py` `plan(now, {})`: `bootstrap, backtest, update, fit, grade, scan`.
  - `git status` after the dry runs: no tracked file changed.
- **`ops/smoke-prod.sh`**: `SMOKE_EXPECT_HEALTH=503 ops/smoke-prod.sh http://localhost:4950` (no Upstash, so health is 503 by design): **18 passed, 0 failed**, exit 0. Checks: health, `/`, the 5 security headers, cron routes 401, robots with Sitemap, sitemap urlset, `og:image`, `/admin`, `/api/admin/export` and both `/e2e-mock/*` → 404, `/api/meta` 200, telemetry rate limit.
- `SETUP.md` from scratch reaches a running app (item 2).

## Fails to fix

1. **RT3-01 residual: the public coarse curve still un-bands about half of the flagged bets modelled at `all`/`cat` level.** (Medium-low: 44 bets in scan 5.)
   - Where:
     - `apps/web/app/api/model/curve/route.ts:21-29`: Free and anonymous callers get `all` and `cat:<category>` curves, rounded to 5 pp.
     - `apps/web/lib/data/model.ts:45` (`coarseCurve`).
     - `apps/web/lib/data/gate.ts`: Free rows keep the exact `mid`, `model_level`, `category` and `horizon_h`.
     - `lib/data/model.ts:44` cites a test file that does not exist.
   - Repro: on any build, logged out:
     1. `GET /api/flags` (or the scan's `flags.json` for the population).
     2. For each row with `best.model_level` in `all`/`cat`, `GET /api/model/curve?segment=<all|cat:category>&h=<horizon_h>`.
     3. Interpolate the points at `best.mid` and clamp to the Free band `[win_prob, win_prob + 0.05)`.
   - On scan `1795001060`: 44/98 flagged bets land within 0.5 pp of the exact win chance, against 6/98 for the band + mid baseline (`curve_check2.py`).
   - Over both sides of the flagged bets at `all`/`cat` level (195 sides): 75 (38.5%) within 0.5 pp, median error 0.61 pp, against 29 (14.9%) for the band midpoint (`curve_unband`-style check, `logs/rt3-01-coarse.log`).
   - `test/paywall.test.ts:222` passes only because it averages over every market, most of which have no edge.
   - Fix direction (owner's call): measure on flagged bets; drop `mid` (or `model_level`) from Free rows of `all`/`cat` markets, or coarsen those curves further.
2. **Free delay copy says "15 minutes", not "at least 15 minutes".** (Low.)
   - `apps/web/components/header/FreshnessPill.tsx:30`: "On the Free plan you see prices 15 minutes behind."
     - Repro: logged out on a production build, about 20 min after a scan, hover the header pill: it reads "Updated 21 min ago" and the title says 15 minutes behind.
   - `apps/web/lib/api.ts:89`: "Free data refreshes every 15 minutes; first update shortly."
     - Repro: on a production build, run `python -m engine scan` three times back to back, then restart `next start`. The logged-out `/`, `/markets`, `/status` and `/m/<id>` show this line, and `/api/meta` returns 503 for about 13 minutes.
     - Free data does not refresh every 15 minutes; it follows the scan cadence with a delay of at least 15.

## Changes since run 5 (summary)

- Polish pass T-220–T-232: checked in screenshots (item 4). Run 5's 390 px other-side card nit is fixed.
- RT3-02 to RT3-09: hold. RT3-01: partly (fail 1). RT3-03's copy: partly (fail 2).
- T-240 pricing copy: truthful.

## Owner verification

Unchanged from run 5, plus the new items (marked new):

- **Supabase:**
  - Run the RLS checks against the live project with the anon key (user B cannot read user A's rows).
  - Send a real magic-link email.
  - Run `ops/supabase-setup.sh <ref> --yes`.
  - After a real sign-in on the deployed site, confirm the auth cookies carry `Secure; HttpOnly; SameSite=Lax`.
  - Confirm the `plan_quota` trigger blocks an 11th Free watchlist row on the live database.
  - (new) Decide whether to set `ADMIN_REQUIRE_MFA=true` (RT3-06), and if so enrol TOTP for every admin first (`docs/setup-notes/admin.md`).
- **Stripe test mode end to end:**
  - Checkout.
  - Webhook delivery to the deployed URL.
  - Customer Portal cancel.
  - A real Payment Link, if `stripe.mode` is `links`.
  - Decide whether out-of-order subscription events need a `created`/`current_period` guard (reproduced again).
- **Upstash:** set the Redis keys, so the shared limiter replaces the in-memory one (the page limits of RT3-02 are per instance without it) and `/api/health` reports ok.
- **Vercel:**
  - Confirm BotID challenges headless browsers and scripted clients.
  - Set Root Directory to `apps/web`.
  - Push env with `node ops/vercel-env.mjs --env apps/web/.env.prod`.
  - (new) On Vercel the page limit is keyed per IP + JA4, not the single local key used here. Check that a shared office/NAT IP is not throttled in normal use.
- (new) **Search crawlers on market pages:** past 60 `/m/` or `/event/` loads a minute from one key, the slow-down page is HTTP 200 with `noindex` (a Server Component can't send 429; STATUS.md). A crawler that fetches market pages faster than that may see `noindex` and drop those pages, where a 429/503 would make it retry. The 12 sitemap pages are not affected. Decide whether that is acceptable or whether known search-engine crawlers need a 503 or a separate budget.
- (new) **Burst scans:** a cold instance after back-to-back scans shows Free the pending state until the oldest kept copy is 15 min old (13 min here). Avoid manual re-runs right after a scheduled scan, or keep more copies.
- **Kalshi demo:** place one demo order from the extension with a real demo key.
- **Domain and `config/site.json`:**
  - Fill the placeholders listed in item 10.
  - Set `NEXT_PUBLIC_SITE_URL`.
- **Scan cadence:** run the engine container (10-minute scans). With only the `refresh.yml` fallback (every 2 h), "about every 10 minutes" is wrong, and Free would be 2 h + behind.
- **Chrome Web Store:** publish the extension and set `NEXT_PUBLIC_EXTENSION_ID`.
- (new) **Signed-in crawl:** run `crawl2.mjs`-style checks (every page at 390 and 1440, console errors, disclaimer, horizontal scroll) as Pro, Premium and admin. Not run in audit 6.
- **Count rule exceptions (item 7):** confirm the exact contract quantity on the trade ticket and the exact unread count in the bell's `aria-label`.

# Audit run 7

Kismet final audit, seventh run.

Auditor: a fresh agent that built none of this code. It checked and fixed nothing.
Target: branch `final` at `30e7362` ("T-242: Free delay copy says at least 15 minutes everywhere (audit run 6 fail 2)"), checked out as worktree `audit7` (branch `audit7`).
Date: 2026-11-18, 13:02–14:35 local.
Spec: `docs/OVERNIGHT.md` §3, items 1–11, plus the brief's priorities: re-check run 6's two fails, run the Pro, Premium and admin crawls that run 6 could not, two runs of each e2e suite, the Lighthouse protocol, ops dry runs, `smoke-prod.sh` against a local production build, `pnpm audit` and a raw-count sweep.

Since run 6 (`4aa0400`), `final` gained 2 product commits plus the run 6 report:
- T-241 (`cc57728`): the public model curve for Free and signed-out callers is now 10 points (one per 10¢ of price, at 5¢, 15¢ … 95¢), win chance rounded to 10 pp (`lib/data/model.ts:42-55`). New test in `test/paywall.test.ts:247-267`.
- T-242 (`30e7362`): the freshness pill and the pending line say "at least 15 minutes" (`components/header/FreshnessPill.tsx:30`, `lib/api.ts:89`).
- `git diff --stat 4aa0400 30e7362 -- apps` touches 4 files: those three and the test. Nothing in `apps/extension`, trading, billing, email or combos changed.

How the audit ran:
- Everything ran outside `~/Desktop`, in a scratch directory:
  - `audit7/` is a git worktree at `30e7362`. Unit tests, lint, typecheck and both e2e suites (twice each) ran here, after `pnpm i --frozen-lockfile` (exit 0 for web and extension). The main checkout has no `output/*-prev*.json`, so only the 8 committed output files were copied (none of the `* 2.json` iCloud duplicates).
  - `a7/prod/` and `a7/mock/` are `git archive` copies of `30e7362`.
- `a7/prod/` followed `SETUP.md` §0: a new venv (Python 3.13.1; there is no 3.12 on this Mac), `pip install -r requirements.txt` (exit 0), `pytest -q` (45 passed), `pnpm i --frozen-lockfile` (exit 0), and `pnpm build` with `DEMO_MODE` and `NEXT_PUBLIC_DEMO_MODE` unset, no `.env*` file except `.env.example`, no Supabase/Stripe/Upstash/cron/Kalshi variable in the environment, and `NEXT_PUBLIC_SITE_URL=http://localhost:5050` (`BUILD_EXIT=0`). It ran as `next start -p 5050` with `DATA_DIR=a7/prod/output`. The same build served item 2, the logged-out crawl, Lighthouse, the probes and `smoke-prod.sh`.
- One fresh scan ran into `a7/prod/output` at 13:05:57–13:06:49 (`python -m engine scan`: 22,710 markets, 1,777 flags, `scanned_at 1795025158`). The committed scan (`1794895125`) became `*-prev.json`.
- For the pending state I ran a second instance of the same build on 5051, with a copy of the output whose `scanned_at` I set to "now" and no `*-prev` copies (a cold instance with nothing 15 minutes old). This replaces run 6's three back-to-back scans and a restart.
- `a7/mock/` ran the `E2E_MOCK=1` dev server on 5030 with the paid-config env (as `playwright.paid.config.ts`), `ADMIN_EMAILS=admin-audit7@example.com`, `KALSHI_TRADING_ENV=demo` and `DATA_DIR=a7/prod/output`. Users were seeded through the mock magic link and the mock Stripe checkout (`seed.mjs`).
- Only ports 5010–5051 were used (5000 is taken by macOS AirPlay). Every server I started was stopped before the commit.
- No Supabase, Stripe, Upstash, Vercel or Kalshi account exists. Where the in-repo mocks fully cover a check it is marked PASS; each live step is under "Owner verification".
- I did not accept commit messages, STATUS.md or run 6's text as proof.
- The machine was lightly loaded for most of the run (1-minute load 2–8; one spike to 34 at 13:22 from macOS `mds`/`spindump`/iCloud). `uptime` is recorded next to each e2e run, crawl and Lighthouse batch.
- Scratch helpers stayed in the scratch directory and are not committed. Reused from run 6 with ports and paths changed: `crawl2.mjs`, `seed.mjs`, `probe.py`, `cards.mjs`, `fees.mjs`, `webhook.mjs`, `hammer.py`, `kbd.mjs`, `me.mjs`, `extload.mjs`, `poll.py`, `scrape2.sh`/`one.sh`, `pendshot.mjs`, `lh.sh`, `ops.sh`, `secrets_scan.py`. New: `curve_check4.py` (RT3-01 attack over flagged bets, both sides, three baselines), `pill.mjs` (reads the freshness pill's title), `crawl1.sh` (restart the mock, warm it, seed one user, crawl).

## Summary

| # | Item | Result |
|---|------|--------|
| 1 | Tests | PASS |
| 2 | Production build | PASS |
| 3 | Every page × every state | PASS |
| 4 | Quality | PASS |
| 5 | Data correctness | PASS |
| 6 | Security | **FAIL** (RT3-01 residual, low) |
| 7 | Multipliers and combos | PASS |
| 8 | Trading safety | PASS |
| 9 | Billing | PASS (mock) |
| 10 | Legal and wording | PASS (placeholders listed) |
| 11 | Publication readiness | PASS |

One fail, low severity. Run 6's fail 2 (Free delay copy) is fixed. Run 6's fail 1 (RT3-01) is smaller but not closed: T-241 cut the curve attack on flagged bets from 45% to about 30% within 0.5 pp, but a 10-point public curve plus the exact mid still places the exact win chance better than any guess from the band alone, which is the bar T-241's own comment and test set. The new test passes only because it averages over every market at `all`/`cat` level, most of which are not flagged bets, the same population gap as run 6.

Run 6's missing crawls ran: Pro, Premium and admin, each at 390 and 1440 px, on a mock dev server restarted and reseeded before each one (the first Pro attempt lost its user to a dev-server memory restart and was discarded, see item 3).

Fails, in short (details and repro under "Fails to fix"):
1. **RT3-01 residual: the coarse public curve still beats a band-only guess on flagged bets modelled at `all`/`cat` level.** Two scans, best side: 46/147 (31.3%) and 39/131 (29.8%) within 0.5 pp, against 20 (13.6%) and 18 (13.7%) for the middle of the band; the bar in `test/paywall.test.ts:266` is max(mid-band, 20%) + 3 pp = 23%. Mean absolute error 1.11–1.22 pp against 1.37–1.40 pp for the band middle.

## Fixed since run 6

| Run 6 fail | Fix | Holds? | Evidence |
|---|---|---|---|
| 1. RT3-01 residual (coarse curve un-bands 44/98 flagged `all`/`cat` bets) | T-241: public curve = 10 points at 10 pp | **Partly** (still a fail, item 6) | See below. |
| 2. Free delay copy says "15 minutes", not "at least" | T-242: pill and pending line say "at least" | **Yes** | See below. |

**Run 6 fail 2, Free delay copy: fixed.**
- Every user-facing delay string, by `grep -rniE "delay|15.?min|fifteen|behind"` over `apps/web/app`, `components`, `lib`, `apps/extension/src` and `config`:
  - `components/header/FreshnessPill.tsx:30` "On the Free plan you see prices at least 15 minutes behind."
  - `lib/api.ts:89` "Free prices run at least 15 minutes behind; the first update is on its way."
  - `app/status/page.tsx:50` "…you see each scan at least 15 minutes after it runs…"
  - `app/pricing/page.tsx:10` "At least 15 minutes behind, top 25 rows"; `components/pricing/Plans.tsx:12` "…at least 15 minutes behind, top 25 rows"
  - `lib/auth/server.ts:23` "…every open market, at least 15 minutes behind, top 25 rows…"
  - The admin hint (`components/admin/Controls.tsx:188`) "Free sees the scan from at least this long ago."
  - No other match is a delay claim ("Every 15 min" is a market frequency filter; "expires in 15 minutes" is the sign-in link). The extension has no delay copy.
- Rendered, production build 5050, logged out:
  - 13:10, Free still on the committed scan: pill "Updated 36 h ago · data may be stale", title "The last scan was 36 h ago. Prices may have moved since, so check the market before betting. On the Free plan you see prices at least 15 minutes behind." (`audit7-anon-pill-1440.png`)
  - 13:21, right after Free switched to the fresh scan: pill "Updated 15 min ago", title "Prices and win chances were last checked 15 min ago. Prices refresh about every 10 minutes. On the Free plan you see prices at least 15 minutes behind." (`audit7-anon-pill-fresh-1440.png`)
- Pending state (5051, cold instance, newest scan stamped "now", no `*-prev`): `/api/meta` → 503 `{"error":"Free prices run at least 15 minutes behind; the first update is on its way.","code":"delayed_pending"}`. `/`, `/markets`, `/status` and `/m/6117510` at 390 and 1440 all show the card "New prices are on the way · Free prices run at least 15 minutes behind; the first update is on its way. Paid plans see live prices. See plans" (`audit7-anon-pending-{home,markets,status,m_6117510}-{390,1440}.png`).
- Is "at least 15 minutes" true? `poll.py` read `/api/meta` logged out every 20 s from 13:07:52 to 13:32 (74 reads, all 200): 39 reads of the committed scan, then the switch to the 13:05:58 scan at 13:20:59, 15.0 min after it (912 s when I checked 10 s later). Never younger than 15 min (`BAD_TOTAL 0`). The server rule is unchanged (`lib/data/store.ts:262-290`).
- Note, not a fail: the hard-coded "15" in `/pricing`, `Plans.tsx` and `lib/auth/server.ts` does not follow the admin setting `free_delay_min` (0–60). If an admin ever sets it below 15, those three strings become false; above 15 they stay true. The pill, the pending line and `/status` use the setting.
- Nit: on `/markets` in the pending state, the subtitle under "All markets" still says "Loading markets…" above the pending card (`audit7-anon-pending-markets-1440.png`).

**Run 6 fail 1, RT3-01: partly fixed.**
- What changed: `GET /api/model/curve?segment=all&h=24`, logged out, now returns exactly 10 points, prices 0.05…0.95, win chances on a 10 pp grid: `0, 0.1, 0.2, 0.3, 0.4, 0.6, 0.7, 0.8, 0.9, 1`. Niche segments still 403 (`segment=soccer` → 403). Pro gets the exact curve (`test/paywall.test.ts` "Pro gets every segment exact" passed).
- What a signed-out caller still gets per market: `GET /api/markets/6591800` (logged out, 5050) → `best.mid 0.905`, `best.win_prob 0.95` (Free band [0.95, 1.00)), `model_level "all"`, `horizon_h 168`, `category "weather"`, `curve null`. That is every input the attack needs.
- The attack, as in run 6 (`curve_check4.py`): for each flagged bet whose side is modelled at `all`/`cat`, fetch the public curve for its segment and horizon (logged out), interpolate at `mid`, clamp to Free's band `[lo, lo + 0.05)`, and compare with the exact win chance from the scan. Baselines: the mid clamped to the band (run 6's), and the middle of the band `lo + 0.025` (T-241's).

  | Scan | Population | n | Attack within 0.5 pp | Mid clamped | Mid-band guess | Attack median error |
  |---|---|---|---|---|---|---|
  | `1794895125` (committed) | flagged, best side | 147 | **46 (31.3%)** | 19 (12.9%) | 20 (13.6%) | 0.99 pp |
  | | flagged, every side | 294 | 87 (29.6%) | 41 (13.9%) | 45 (15.3%) | 1.04 pp |
  | `1795025158` (fresh) | flagged, best side | 131 | **39 (29.8%)** | 11 (8.4%) | 18 (13.7%) | 0.96 pp |
  | | flagged, every side | 262 | 70 (26.7%) | 27 (10.3%) | 41 (15.6%) | 1.05 pp |

- Worked example: market 6591800. Exact win chance 0.9563. Free band [0.95, 1.00), mid 0.905. The public `all` curve at h=168 has (0.85, 0.9) and (0.95, 1.0), so interpolation gives 0.955: 0.13 pp from the exact value. The band middle (0.975) is 1.9 pp off.
- T-241's own test, applied to the real scans (`curve-allmarkets.log`), bar = max(mid-band, 20%) + 3 pp:
  - every market at `all`/`cat`: 70/632 (11.1%) and 98/717 (13.7%): pass, as in the unit test;
  - flagged bets only: 39/131 (29.8%) and 46/147 (31.3%) against a bar of 23.0%: **fail**;
  - unflagged only: 6.2% and 9.1%.
  `test/paywall.test.ts:253` loops over `s.markets`, not `s.flags`, so it measures the population where the leak does not matter. Run 6 named this exact gap.
- How much of the gain is the curve? Flagged win chances sit low inside their 5 pp band, so a constant guess can beat the band middle too. The best constant, chosen with the answers in hand, gets 42/147 and 34/131. Learned on one scan and applied to the other, a constant gets 28/131 (21.4%) and 41/147 (27.9%), with a mean absolute error of 1.63–1.87 pp. The curve attack still wins on both scans: 39 and 46 hits, mean absolute error 1.22 and 1.11 pp, against 1.37–1.40 pp for the band middle (`curve-xval.log`). So the curve still adds real information, though much less than in run 6.
- Severity: low. The leak is now about 0.2–0.3 pp of mean error on roughly 130–150 bets per scan, against 0.5 pp or better for 45% of them in run 6. Whether this is acceptable is the owner's call; by the bar T-241 set itself, it is not closed.

## 1. Tests: PASS

- `pytest -q` (new venv in `a7/prod`): 45 passed.
- `apps/web` in the worktree: `pnpm i --frozen-lockfile` exit 0; `pnpm typecheck` exit 0; `pnpm lint` (`eslint . --max-warnings 0`) exit 0.
- `pnpm test`, run 1 (13:05:39): 1 failed, 378 passed. The failure was `test/api.test.ts:115` "apply() timing > p95 < 150 ms over 15k rows" (270 ms, then 195 ms on retry). The fresh `engine scan` was running on the same CPU at that moment (13:05:57–13:06:49). Run 2 (13:07, nothing else of mine running): **60 files, 379 tests passed**. A timing test that fails under a concurrent CPU-bound job: note, not a fail.
- `apps/extension`: `pnpm i --frozen-lockfile` exit 0, typecheck exit 0, **6 files, 42 tests passed**.
- **Demo e2e** (`playwright.config.ts`: production build of the fixture data; S1–S6, S8 `alerts.spec.ts`, search, trading-paper, multipliers, headers/CSP, `a11y.spec.ts`):
  - Run 1, PW_PORT 5010: **52 passed** (1.5 m), ended 13:09:33, load 12.59.
  - Run 2, PW_PORT 5012: **52 passed** (50 s), ended 13:12:03, load 4.67.
- **Paid e2e** (`playwright.paid.config.ts`, `E2E_MOCK=1` dev server; admin ×2, paywall pages, S7, account delete, keyboard search → drawer → save → upgrade):
  - Run 1, PW_PORT 5011: **6 passed** (1.6 m), ended 13:11:12, load 6.31.
  - Run 2, PW_PORT 5013: **6 passed** (1.3 m), ended 13:13:22, load 3.38.
  - No failure or retry in any of the four runs.
- **Paid webserver log** (`DEBUG=pw:webserver`, 916 and 892 `[WebServer]` lines): 0 `SyntaxError`, `Unexpected end of JSON`, `⨯` or `TypeError`; 0 responses 5xx. Every non-2xx is expected: the 6 `/admin*` pages → 404 twice each (non-admin and anonymous) in both runs; in run 2 `GET /api/data` → 401 and `GET /e2e-mock/supabase/auth/v1/user` → 401 (signed-out checks).
- DB proofs: `ops/redteam/run3/rt3-db.test.ts`, `ops/redteam/rt2-db.test.ts` and `test/rls.test.ts` copied into `apps/web/test/` and run together: first try at load 34 (13:22, a macOS `mds`/`spindump` spike) 4 tests timed out at vitest's 5 s default; re-run with `--testTimeout=60000`: **3 files, 25 tests passed** (copies deleted afterwards).

## 2. Production build: PASS

- `SETUP.md` §0 in `a7/prod` (see the top): `BUILD_EXIT=0`.
- `next start -p 5050` served every page with 200 in the logged-out crawl (item 3). Server log: only the expected `[abuse] UPSTASH_REDIS_REST_URL/TOKEN not set` line and Node's localStorage ExperimentalWarning.
- `/pricing` and `/about` show "Coming soon" on the paid buttons (2 matches each). No dev or demo banner (0 matches for "demo mode" in `/`).
- `/api/trade/config` → `{"enabled":false,"env":null,"extensionId":"","riskUrl":"https://kalshi.com/regulatory"}`; POST `/api/trade/nonce` → `{"error":"Trading is off."}`.
- POST `/api/auth/magic-link` → `{"error":"Accounts are not set up yet"}` (keyless build).

## 3. Every page × every state: PASS

Crawler `crawl2.mjs` (as run 6): 33 routes (every page, 3 market pages, an event page, the drawer `/?m=`, a search) at 390 and 1440 px, with light CDP throttling (40 ms, 10 Mbit/s). On each view it checks console errors and warnings, page errors, bad tokens on screen (`NaN`, `undefined`, `null`, `[object Object]`, lorem, TODO, FIXME…), the footer disclaimer, horizontal scroll, and any 5xx/429. Then it requests every internal link it found, in the same session. `tiers` is `/api/me` before, between and after the two widths.

| State | Server | Start (load) | Views | Problems | Links checked | `tiers` | Result |
|---|---|---|---|---|---|---|---|
| Logged out | prod 5050 | 13:15:41 (2.24) | 66 | 0 | 99, 0 bad | `nouser:free` ×3 | PASS |
| Free | mock 5030 | 13:20:26 (7.15) | 66 | 0 | 130, 0 bad | `free` ×3 | PASS |
| Pro | mock 5030 (restarted, reseeded) | 13:43:48 (4.07) | 66 | 0 | 274, 0 bad | `pro` ×3 | PASS |
| Premium | mock 5030 (restarted, reseeded) | 13:59:09 (3.49) | 66 | 0 | 274, 0 bad | `premium` ×3 | PASS |
| Admin | mock 5030 (restarted, reseeded) | 14:14:31 (6.01) | 66 | 0 | 115, 1 by design (below) | `free+admin` ×3 | PASS |

- Logged out and Free: every page 200 except `/admin*` and `/no-such-page` (404, styled). Pro and Premium: same; their `/watchlist`, `/journal`, `/alerts`, `/dashboards`, `/account` render (200) with the user's own data.
- Admin: `/admin`, `/admin/users`, `/admin/health`, `/admin/settings`, `/admin/audit` → 200 with h1 "Admin" at both widths, no console error.
- The one admin link the crawler flagged is `/api/admin/export` → 403 `{"error":"Open the export from the admin page"}`. That is the RT2-01 same-site guard (`app/api/admin/export/route.ts:20`): the crawler's request carries no `Sec-Fetch-Site`. A real click on "Export CSV" in `/admin/users` as the admin downloads `kismet-users-2026-11-18.csv` with the header `id,email,created_at,last_sign_in_at,tier,status,comp_tier,comp_expires_at` (`exportclick.mjs`). Not a fail.
- Disclaimer in the footer, no horizontal scroll and no console error or warning on all 330 views.
- **How the signed-in crawls were kept honest.** The first Pro crawl (13:34, right after Free on the same server) lost its user: the dev server logged "Server is approaching the used memory threshold, restarting..." (`mock.log:4740`), the in-memory mock users were wiped, and from the 13th view on the crawler was browsing as a signed-out visitor (`/e2e-mock/supabase/auth/v1/user` 401 from then on). I discarded that run. Each of Pro, Premium and admin then ran on a freshly started mock (`crawl1.sh`: start, warm the routes, seed the one user through the UI, crawl). Their server logs show 0 restarts, 0 `auth/v1/user` 401s, 0 `⨯`/`TypeError`/`SyntaxError`, and no 5xx. The Free crawl finished before the restart (`tiers` `free` ×3).
- Screenshots: `audit7-{anon,free,pro,premium,admin}-{home,markets,pricing,account,admin_health,m_<id>}-{390,1440}.png`.

## 4. Quality: PASS

**Lighthouse: PASS.** `npx lighthouse@12` (12.8.2), `--form-factor=mobile`, default simulated throttling, Playwright Chromium headless, on the 5050 production build. Nothing else of mine ran (the e2e suites had finished, the mock was not started yet). Scores are performance / accessibility / best practices / SEO; `uptime` is the 1/5/15-minute load average just before each page's 3 runs.

| Page | uptime | Run 1 | Run 2 | Run 3 | Perf median |
|---|---|---|---|---|---|
| `/` | 2.93 11.60 25.81 | 93/100/100/91 | 92/100/100/91 | 92/100/100/91 | **92** |
| `/about` | 2.47 10.39 24.72 | 93/100/100/91 | 93/100/100/91 | 93/100/100/91 | **93** |
| `/pricing` | 2.17 9.46 23.80 | 95/100/100/91 | 94/100/100/91 | 94/100/100/91 | **94** |

- One batch, at a 1-minute load of 2–3 (below 15), so no batch was discarded. TBT 117–162 ms, LCP 2.7–3.2 s, FCP 0.76–0.91 s.
- Accessibility 100 and best practices 100 on all 9 runs.
- SEO 91 on all 9: the only deduction is `meta-description`, as in runs 3–6. The tag is in the HTML (`curl /about` → `<meta name="description" content="Prediction-market analytics: …"/>`); Next 15 streams it and Lighthouse misses it. Note, not a fail.

**axe:** zero serious or critical violations: `e2e/a11y.spec.ts` passed in both demo runs.

**Keyboard-only walkthrough** (`kbd.mjs`, prod 5050, logged out, `reducedMotion: "reduce"`):
- `/` focuses the search; "barcelona", ArrowDown, Enter → `/?q=FC+Barcelona`.
- A result's title link in 24 Tabs; Enter opens the "Market details" dialog with focus inside.
- "Save" in 5 Tabs; Enter → "Saved", focus kept, dialog open.
- "Pricing" in 37 Tabs; Enter → `/pricing`.
- Signed in: `s7-upgrade.spec.ts` (keyboard search → drawer → save → upgrade) passed in both paid runs.

**Reduced motion:** `matchMedia` matched; the longest animation and transition durations were 0.01 ms.

**Design review** of the crawl screenshots at 390 and 1440 (all four states now, plus the pending cards) against `docs/design/project/Hybrid.dc.html` / `MobileHybrid.dc.html`: dark theme, emerald accent, rounded-xl cards, 16 px gutters hold. Pro market page at 390 (`audit7-pro-m_6970279-390.png`): hero card, both side cards and "Why it's a good price" bars fit without truncation; Pro `/markets` at 1440 shows grouped events with "+29 more in this event". No new alignment, truncation or contrast problem. The Next.js dev-tools "N" button overlaps the first bottom-nav item in mock screenshots; it exists only in `next dev` (not in the 5050 production screenshots).

## 5. Data correctness: PASS

- **Free is capped and delayed on the server.** `probe.py` against 5050, logged out, with `ps`, `page`, `page_size`, `tier`, an `x-tier` header and forged tier cookies on `/api/flags` and `/api/markets`: all 7 responses 200, 25 rows, page 1, every row banded. The 25 rows matched the scan they were served from (the committed scan, while the fresh one was 5.2 min old): 0 mismatches.
- **Delay:** see "Fixed since run 6": Free switched to the fresh scan at 15.0 min, never earlier.
- **Pro and Premium are live while Free is delayed** (`me.mjs`, mock 5030, after a second fresh scan `1795030129` at 14:28:49): at 14:30:16, signed out and Free read scan `1795025158` (`delay_min 15`); Pro and Premium read `1795030129` (`delay_min 0`). The production build (5050), signed out, also read `1795025158`.
- **Cards equal the API.** `cards.mjs` on 5050: 16 API rows, 13 cards on `/` matched, 0 mismatched.
- **Fees and returns match the engine formulas** (`fees.mjs`, Pro on the mock, 20 bets, 40 sides, `fee = FEE_RATE[cat]·p·(1−p)` from `pipeline/common.py`, `edge = q − (p + fee)`, `roi = edge / cost · 100`): fee matches on all 40, edge within 0.0001 on all 40. Three sides with small asks (0.25, 0.17, 0.131) differ by 0.02–0.03 roi points: 4-decimal rounding of `edge` over a small cost, the same pattern as runs 3–6. Pass.
- **Freshness pill:** number and copy now both right (see "Fixed since run 6").

## 6. Security: **FAIL** (RT3-01 residual, low)

- **Paid data as free/anon:** rows capped and banded (item 5). But the coarse public curve still narrows the exact win chance of flagged bets modelled at `all`/`cat` level beyond Free's band ("Fixed since run 6", fail 1).
- **RT3-02 page limits still hold:** `scrape2.sh` on 5050, 300 distinct `/m/<id>` with 8 in parallel: **59 pages with market data, 241 "Slow down a little" with `noindex`**, 4 s.
- **Headers** (`curl -I` on 5050): `Strict-Transport-Security: max-age=63072000; includeSubDomains`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()`, CSP with a per-request nonce and `strict-dynamic`. `e2e/headers.spec.ts` passed in both demo runs.
- **Hidden routes** (5050, logged out): `/admin`, `/admin/users`, `/api/admin`, `/api/admin/export`, `/e2e-mock/supabase/_inbox`, `/e2e-mock/supabase/auth/v1/user`, `/api/data` → 404. `/api/admin` POST/PUT/PATCH/DELETE → 404. POST `/api/settle/run`, `/api/alerts/run` → 401.
- **Another user's rows:** `test/rls.test.ts`, `rt2-db.test.ts`, `rt3-db.test.ts` (PGlite, real migrations): 25 passed (item 1). Live check under Owner verification.
- **Rate limits** (`hammer.py` on 5050, in-memory limiter):
  - `/api/markets` ×40 → 27 × 200 then 13 × 429 (`Retry-After: 59`).
  - `/api/flags` ×40 right after → 40 × 429.
  - `/api/suggest?q=bar` ×250 → 120 × 200, 130 × 429.
  - `/api/markets` ×40 with a new `X-Forwarded-For`/`X-Real-IP` each → 40 × 429.
  - `smoke-prod.sh`: 40 × POST `/api/ext/telemetry` → 429 after the burst.
- **Crawlers:** GPTBot, ClaudeBot, CCBot, PerplexityBot, Google-Extended, Bytespider → 403 on `/` and `/api/markets`. HeadlessChrome, python-requests, curl → 200 (BotID runs only on Vercel; Owner verification).
- **Stripe webhooks:** unsigned, wrong secret, stale timestamp and altered body all rejected (400); replay → duplicate (item 9).
- **Dependencies:** `apps/web` `pnpm audit --prod`: no known vulnerabilities. Full `pnpm audit`: 1 moderate (dev tooling, `minimatch`). `apps/extension`: none. `pip-audit -r requirements.txt` (in the `a7/prod` venv): "No known vulnerabilities found".
- **Secrets in history:** `secrets_scan.py` (gitleaks-equivalent rules) over `git log --all -p`, 300 commits: 23 hits = run 6's 22 known fakes + 1 in `bb2cb59` (the run 6 report quoting the fake `sk_test_FAKEFAKEFAKEFAKE`). Commits since run 6: that one hit only.
- **Client bundles:** `pnpm check:bundle` on the prod build: "127 files in .next/static, no secrets". My grep for `SUPABASE_SERVICE_ROLE`, `STRIPE_SECRET_KEY`, `sk_live_`, `sk_test_`, `whsec_`, `UPSTASH_REDIS_REST_TOKEN`, `CRON_SECRET`, `EXT_SIGNING_SECRET`, `UNSUBSCRIBE_SECRET`, `service_role` in `.next/static`: 0 files.
- **Cookies:** the prod build sets no cookie on `/` (no `Set-Cookie` in `curl -I`). `Secure` on auth cookies is production-only; under Owner verification.

## 7. Multipliers and combos: PASS

- No change since run 6 in `lib/combos.ts`, the multiplier tiers or the combo UI (`git diff 4aa0400 30e7362 -- apps` touches only the 4 files above). `test/multipliers.test.ts` and the combo tests passed in `pnpm test`; `e2e/multipliers.spec.ts` (same-event warning in the UI) passed in both demo runs.
- Live: in the fresh scan one side is ≥10x with a 10–20% chance and a ≥4-point edge: market 6841253, ask 0.06, win 0.1077, edge 0.0448, tier `best`. Tier split: 769 best / 1,008 edge.
- **Raw-count sweep.** The diff since run 6 adds no count display. Grep for counts in JSX and template strings (`.length`, `.count`, `.total`, `.unread`, `toLocaleString()`) over `apps/web/app`, `apps/web/components` and `apps/extension/src`, without `formatCount`: every hit is either wrapped in `<Count>` (which calls `formatCount`, `components/kit/index.tsx:18-22`) or bounded far below 1,000: combo legs (`MAX_LEGS = 6`), dashboard panels, the inbox (`slice(0, 50)`), chosen topics, the 280-character banner counter, chart aria-labels, `colSpan`. Live: "621 bets where the odds lean your way" (Free), "766 bets…" (Pro), "18K markets match · 22K open" (Pro `/markets`), "16K past bets tested". **No production count that can pass 999 shows without `formatCount`.**

## 8. Trading safety: PASS

- Prod 5050: `/api/trade/config` → `{"enabled":false,"env":null,…}`; POST `/api/trade/nonce` → `{"error":"Trading is off."}`.
- `git diff 4aa0400 30e7362 -- apps/extension apps/web/lib/trade apps/web/components/trade` is empty; run 5's live extension spec and grep review stand. `e2e/trading-paper.spec.ts` passed in both demo runs.

## 9. Billing: PASS (mock)

`webhook.mjs` on the mock (5030), signed with the test secret (real `stripe` signing code), separate user `webhook-audit7@example.com`:
- Unsigned → 400 "Not configured or unsigned"; wrong secret, 1-hour-old timestamp, body changed after signing → 400 "Bad signature".
- `checkout.session.completed` with a raw unsigned `client_reference_id` → 200 but not linked; a subscription for that customer → 500 "Retry".
- `checkout.session.completed` with a signed `client_reference_id` linked the customer (Payment Link path); `customer.subscription.created` premium → tier premium.
- Replay of the same event id → `{"duplicate":true}`, tier unchanged.
- Portal cancel (`cancel_at_period_end=true`) → still premium. `customer.subscription.deleted` → free. Replaying the deletion → duplicate.
- S7 (checkout → tier up) and account delete with a live subscription (`s7-upgrade.spec.ts`) passed in both paid runs; the seed flow upgraded Pro and Premium users through the mock Checkout four times.
- Unchanged observation (runs 3–6), reproduced again: a newer `pro` event followed by an older `premium` event (created 10 min earlier) leaves the user on premium (`lib/billing/stripe.ts` `handleEvent` has no ordering guard). Under Owner verification.

## 10. Legal and wording: PASS (placeholders listed)

- Footer disclaimer "Market analytics, not financial advice. Based on past results. 18+." on every crawled view in every state (item 3), on the pending state, and in the extension popup.
- `/terms`, `/privacy`, `/refunds`, `/disclaimer`, `/contact`, `/status` → 200, all linked from the footer. `/disclaimer` names 1-800-GAMBLER and ncpgambling.org.
- 18+ gate: the keyless prod build answers 503 "Accounts are not set up yet"; on the mock the seed flow must tick the box (`seed.mjs` `getByRole("checkbox").check()`), and `s7-upgrade.spec.ts` passed twice. Email templates are unchanged since run 6 (`git diff 4aa0400 30e7362 -- apps/web/lib/email` empty); run 6's render stands.
- Banned words: `grep -rniE "\b(picks?|locks?|guaranteed?|sure thing|can.?t lose|risk.?free|expected profit)\b"` over `apps/web/app`, `components`, `lib/email` and `apps/extension/src`: only comments and identifiers (`pick`, "Sentry picks errors up", "never picks", "The owner picks the policy") and the negation on `/terms` ("We give no guarantee…").
- All Free-delay copy is now truthful ("Fixed since run 6").
- TODO/FIXME and `console.log` in shipped code (`apps/web/app`, `components`, `lib`, `apps/extension/src`, tests excluded): 0 and 0.
- Placeholders (listed, not failed), as rendered by the prod build: `/terms` `[[GOVERNING_STATE]] [[LAST_UPDATED]] [[OPERATOR_NAMES]] [[SUPPORT_EMAIL]]`; `/privacy` `[[LAST_UPDATED]] [[OPERATOR_NAMES]] [[SUPPORT_EMAIL]]`; `/refunds` `[[LAST_UPDATED]] [[OPERATOR_NAMES]] [[REFUND_POLICY]] [[RESPONSE_TIME]] [[SUPPORT_EMAIL]]`; `/disclaimer` `[[LAST_UPDATED]] [[OPERATOR_NAMES]]`; `/contact` `[[LAST_UPDATED]] [[OPERATOR_NAMES]] [[RESPONSE_TIME]] [[SUPPORT_EMAIL]]`; every footer `[[OPERATOR_NAMES]]`.

## 11. Publication readiness: PASS

- `robots.txt` 200: disallows the AI user agents and `/api/`, `/auth/`, `/login`, `/onboarding`, `/account`, `/settings`, `/watchlist`, `/journal`, `/alerts`, `/dashboards`, `/admin`; `Sitemap: http://localhost:5050/sitemap.xml`. `sitemap.xml` 200 with 12 `<loc>`.
- No test users, seed data or debug routes in prod: `/e2e-mock/*`, `/api/data`, `/admin*` → 404.
- 404 is the styled "This page doesn't exist" inside the shell (crawl, all states).
- Favicon `/icon.svg` → 200 `image/svg+xml`; `/favicon.ico` → 404 (harmless, as runs 4–6). `/opengraph-image` → 200 `image/png`.
- Extension: `KISMET_ORIGIN=https://kismetodds.example pnpm ext:zip` wrote `kismet-extension-0.1.0.zip` (26,267 bytes; moved out of the worktree). Manifest: MV3, permissions `storage`, `sidePanel`, hosts the app origin and `external-api.demo.kalshi.co`, CSP `script-src 'self'; object-src 'self'`; 0 files with `eval(` or `new Function`. Loaded unpacked in a clean Chromium profile: the service worker registered and the popup reads "Kismet Signed out … Paper trading Off … Market analytics, not financial advice. Based on past results. 18+." The only console error is DNS for the placeholder domain.
- **Owner scripts, dry-run mode** (`ops.sh`, in the worktree with `env -i PATH HOME`, no env file):
  - `node ops/secrets.mjs`: dry-run plan, exit 0.
  - `node ops/site-config.mjs --domain … --support-email …`: dry run, lists the missing legal fields, exit 0. `config/site.json` md5 unchanged (`bda0c50c…`).
  - `node ops/stripe-setup.mjs --domain kismetodds.example`: prints the plan, exit 0.
  - `node ops/preflight.mjs`: 24 blockers, 6 warnings, all expected on an unconfigured clone. Exit 1 by design.
  - `bash ops/supabase-setup.sh abcdefghijklmnopqrst`: prints the plan, exit 0.
  - `node ops/vercel-env.mjs`: "Refusing: no env file…", exit 2. With a test env file: only the 2 documented keys × 2 targets, the Stripe key `--sensitive` and masked (`sk_t…(24 chars)`), "Not pushed (test-only): E2E_MOCK", "Not pushed (not in apps/web/.env.example): FOO, HOME, PATH", exit 0.
  - `python ops/checks.py a7/prod/output` (after the fresh scan): "data checks ok", exit 0.
  - `python ops/upload.py` without credentials: "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required", exit 1, nothing uploaded.
  - `ops/scheduler.py` `plan(now, {})`: `bootstrap, backtest, update, fit, grade, scan`.
  - `git status` after the dry runs: no tracked file changed.
- **`ops/smoke-prod.sh`**: `SMOKE_EXPECT_HEALTH=503 ops/smoke-prod.sh http://localhost:5050` (no Upstash, so health is 503 by design): **18 passed, 0 failed**, exit 0.
- `SETUP.md` from scratch reaches a running app (item 2).

## Fails to fix

1. **RT3-01 residual: the coarse public curve still beats a band-only guess on flagged bets modelled at `all`/`cat` level.** (Low: about 130–150 bets per scan; mean error 1.1–1.2 pp against 1.4 pp for the band middle.)
   - Where:
     - `apps/web/lib/data/model.ts:42-55` (`coarseCurve`): 10 points, 10 pp. The comment claims interpolation "is no better than guessing the middle of Free's band"; on flagged bets it is better.
     - `apps/web/app/api/model/curve/route.ts:24-26`: Free and signed-out callers get `all` and `cat:<category>` curves.
     - `apps/web/lib/data/gate.ts:25-37` (`rangeSide`): Free rows keep the exact `mid`, `model_level`, `category` and `horizon_h`.
     - `apps/web/test/paywall.test.ts:250-267`: loops over `s.markets` (`:253`), so most rows are unflagged and the test passes; it never measures `s.flags`.
   - Repro, on any build, logged out:
     1. Take flagged ids (`/api/flags`, search, event pages; or the scan's `flags.json` for the full population).
     2. `GET /api/markets/<id>` → `best.mid`, `best.win_prob` (band low end), `best.model_level`, `horizon_h`, `category`. Keep rows with `model_level` `all` or `cat`.
     3. `GET /api/model/curve?segment=<all | cat:category>&h=<horizon_h>`.
     4. Interpolate the points at `mid`; clamp to `[win_prob, win_prob + 0.05)`.
     - Example: `/api/markets/6591800` → mid 0.905, band [0.95, 1.00), `all`, h 168; curve points (0.85, 0.9), (0.95, 1.0) → 0.955. Exact 0.9563.
   - Result: 46/147 (31.3%) and 39/131 (29.8%) within 0.5 pp, against 20 and 18 for the band middle; the test's bar is 23%.
   - Fix direction (owner's call): measure on `s.flags`; then drop `mid` from Free rows modelled at `all`/`cat` (or round it to the 10¢ step), or withhold the curve's interpolation inputs another way. Or decide this residual is acceptable and say so in the test.

## Owner verification

Unchanged from run 6, with run 6's "signed-in crawl" item now done:

- **Supabase:**
  - Run the RLS checks against the live project with the anon key (user B cannot read user A's rows).
  - Send a real magic-link email.
  - Run `ops/supabase-setup.sh <ref> --yes`.
  - After a real sign-in on the deployed site, confirm the auth cookies carry `Secure; HttpOnly; SameSite=Lax`.
  - Confirm the `plan_quota` trigger blocks an 11th Free watchlist row on the live database.
  - Decide whether to set `ADMIN_REQUIRE_MFA=true` (RT3-06), and if so enrol TOTP for every admin first.
- **Stripe test mode end to end:** Checkout; webhook delivery to the deployed URL; Customer Portal cancel; a real Payment Link if `stripe.mode` is `links`; decide whether out-of-order subscription events need a `created`/`current_period` guard.
- **Upstash:** set the Redis keys, so the shared limiter replaces the in-memory one and `/api/health` reports ok.
- **Vercel:** confirm BotID challenges headless browsers and scripted clients; set Root Directory to `apps/web`; push env with `node ops/vercel-env.mjs --env apps/web/.env.prod`; check that a shared office/NAT IP is not throttled by the per-IP + JA4 page limit.
- **Search crawlers on market pages:** past 60 `/m/` or `/event/` loads a minute from one key, the slow-down page is HTTP 200 with `noindex`. Decide whether known search-engine crawlers need a 503 or a separate budget.
- **Burst scans:** a cold instance after back-to-back scans shows Free the pending state until a kept copy is 15 min old.
- (new) **Free delay setting:** if `free_delay_min` is ever set below 15 in admin, update the hard-coded "at least 15 minutes" in `app/pricing/page.tsx:10`, `components/pricing/Plans.tsx:12` and `lib/auth/server.ts:23`.
- (new) **RT3-01 residual:** decide whether the fail above is fixed or accepted.
- **Kalshi demo:** place one demo order from the extension with a real demo key.
- **Domain and `config/site.json`:** fill the placeholders listed in item 10; set `NEXT_PUBLIC_SITE_URL`.
- **Scan cadence:** run the engine container (10-minute scans). With only the `refresh.yml` fallback (every 2 h), "about every 10 minutes" is wrong, and Free would be 2 h + behind.
- **Chrome Web Store:** publish the extension and set `NEXT_PUBLIC_EXTENSION_ID`.
- **Count rule exceptions (item 7):** confirm the exact contract quantity on the trade ticket and the exact unread count in the bell's `aria-label`.

# Accepted risks (owner decision, Nov 18; bar set by the owner after audit run 8)

## RT3-01 residual: public win-chance chart + public price
- **What:** a signed-out visitor can combine the coarse public curve (`/api/model/curve` `all` / `cat:` segments, the
  `/track-record` charts) with the market price, which is public on Polymarket anyway, to estimate the exact win chance of
  flagged bets modelled at `all` / `cat` level. That is a little better than Free's 5 pp band: audit run 7 measured a
  mean error of 1.1–1.2 pp, against 1.4 pp for guessing the middle of the band (about 30% vs 14% within 0.5 pp).
- **Why accepted:** any public calibration chart plus a public price leaks this much. Hiding the charts would remove the
  public track record. The owner chose to keep the charts.
- **Approved by the owner (Nov 18), with the bar at 1.05 pp measured on live flagged rows** (the rows the attack works
  on), not on the test fixture. Audit run 8 measured 1.089–1.125 pp on three live scans.
- **Guard:** `apps/web/test/chart-leak.test.ts` reads the committed live scan in `output/`, runs the attack on every
  flagged bet modelled at `all` / `cat` level (best side, 147 rows on scan of Nov 18: 1.11 pp), and fails if the mean
  error drops below 1.05 pp. Niche curves stay paid-only, and the per-market curve is never sent to Free or signed-out users.
- **Audits:** this item is no longer counted as a fail while the guard test passes.

# Audit run 8

Kismet final audit, eighth run.

Auditor: a fresh agent that built none of this code. It checked and fixed nothing.
Target: branch `final` at `88a24a6` ("T-246: search engines Vercel has verified skip the market-page rate limit and row budget"), checked out as worktree `audit8` (branch `audit8`).
Date: 2026-11-18, 18:06–20:25 local.
Spec: `docs/OVERNIGHT.md` §3, items 1–11, plus the brief: verify T-243 to T-246, two runs of each e2e suite, the Lighthouse protocol, crawls in all 5 states, ops dry runs, `smoke-prod.sh` against a local production build, `pnpm audit` and the raw-count sweep.

Owner decisions applied (Nov 18), not counted as fails:
- RT3-01 chart leak is an accepted risk ("Accepted risks" above). Item 6 fails on it only if the attack's mean error on flagged `all`/`cat` rows of the live scan is below 1.2 pp, or the guard test fails.
- `ADMIN_REQUIRE_MFA` stays off.

Since run 7 (`3eb8132`), `final` gained 4 product commits (`git diff --stat 30e7362 88a24a6 -- apps`: 13 files):
- T-243 (`3f3b0ec`): accepted-risk record; `test/paywall.test.ts:247-269` now asserts a mean error ≥ 1.2 pp (`ACCEPTED_MEAN_ERR`, `:251`).
- T-244 (`7efa4df`): subscription events set the tier from `stripe.subscriptions.retrieve` (`lib/billing/stripe.ts:129-139`, `:165`). Two new tests in `lib/billing/stripe.test.ts:146-171`.
- T-245 (`6335dc5`): `/pricing`, `/about`, `Plans`, `accountsOffNote` take the delay from `free_delay_min` (`app/pricing/page.tsx:10-11,37`, `components/pricing/Plans.tsx:12,57`, `lib/auth/server.ts:21-24`). New `test/delay-setting.test.ts`.
- T-246 (`88a24a6`): `verifiedBot()` (`lib/abuse.ts:184-194`) lets BotID-verified bots skip `pageStore`'s rate limit and `pageBudget`'s row budget (`lib/data/respond.ts:79-92`). New test in `test/page-limits.test.ts:51-66`.

How the audit ran:
- Everything ran outside `~/Desktop`, in the scratch directory:
  - `audit8/` is a git worktree at `88a24a6`. Unit tests, lint, typecheck and both e2e suites (twice each) ran here, after `pnpm i --frozen-lockfile` (exit 0 for web and extension). The main checkout has no `output/*-prev*.json`; its 8 committed output files are byte-identical to the worktree's (`cmp`), so nothing was copied and none of the `* 2.json` iCloud duplicates were touched.
  - `a8/prod/` and `a8/mock/` are `git archive` copies of `88a24a6`.
- `a8/prod/` followed `SETUP.md` §0: a new venv (Python 3.13.1; there is no 3.12 on this Mac), `pip install -r requirements.txt` (exit 0), `pytest -q` (45 passed), `pnpm i --frozen-lockfile` (exit 0), and `pnpm build` with `DEMO_MODE`/`NEXT_PUBLIC_DEMO_MODE` unset, no `.env*` file except `.env.example`, no Supabase/Stripe/Upstash/cron/Kalshi variable in the environment, `NEXT_PUBLIC_SITE_URL=http://localhost:5150` (`BUILD_EXIT=0`). It ran as `next start -p 5150` with `DATA_DIR=a8/prod/output` and served item 2, the logged-out crawl, Lighthouse, the probes and `smoke-prod.sh`.
- Two fresh scans ran into `a8/prod/output`: 18:16:52–18:17:41 (24,173 markets, 1,781 flags, `scanned_at 1795043812`; the committed scan `1794895125` became `*-prev.json`) and 20:07:27–20:08:18 (18,798 markets, 1,718 flags, `1795050448`).
- Extra instances of the same build: 5151 (cold, a copy of the output stamped "now", no `*-prev`: the pending state) and 5152 (`VERCEL=1`, for T-246).
- `a8/mock/` ran the `E2E_MOCK=1` dev server on 5130 with the paid-config env (as `playwright.paid.config.ts`), `ADMIN_EMAILS=admin-audit8@example.com`, `KALSHI_TRADING_ENV=demo`, `DATA_DIR=a8/prod/output`; restarted and reseeded (`crawl1.sh`) before each signed-in crawl. A second mock on 5131 used the pending copy (T-245 pending line). Users were seeded through the mock magic link and mock Stripe Checkout (`seed.mjs`).
- Only ports 5110–5152 were used. Every server I started was stopped before the commit (no listener on 5100–5199 afterwards).
- No Supabase, Stripe, Upstash, Vercel or Kalshi account exists. Where the in-repo mocks fully cover a check it is marked PASS; each live step is under "Owner verification".
- I did not accept commit messages, STATUS.md, test names or run 7's text as proof.
- 1-minute load stayed 2–7 except 15.0 at the start of the first scan (nothing else of mine ran then). `uptime` is recorded next to each e2e run, crawl and Lighthouse batch.
- Scratch helpers stayed in the scratch directory and are not committed. Reused from run 7 with ports and paths changed: `crawl2.mjs`, `crawl1.sh`, `seed.mjs`, `probe.py`, `cards.mjs`, `fees.mjs`, `webhook.mjs`, `hammer.py`, `kbd.mjs`, `me.mjs`, `extload.mjs`, `exportclick.mjs`, `poll.py`, `scrape2.sh`/`one.sh`, `pendshot.mjs`, `pill.mjs`, `lh.sh`, `ops.sh`, `secrets_scan.py`, `curve_check4.py` (now also prints mean errors). New: `wh8.mjs` and `wh8b.mjs` (T-244 with subscriptions that exist in the mock Stripe store), `t245.mjs` (changes `free_delay_min` through the admin settings UI, then reads every delay string signed out), `stamp.py` (pending copy).

## Summary

| # | Item | Result |
|---|------|--------|
| 1 | Tests | PASS |
| 2 | Production build | PASS |
| 3 | Every page × every state | PASS |
| 4 | Quality | PASS |
| 5 | Data correctness | PASS |
| 6 | Security | **FAIL** (RT3-01 accepted-risk bar: live mean error 1.09–1.13 pp < 1.2 pp) |
| 7 | Multipliers and combos | PASS |
| 8 | Trading safety | PASS |
| 9 | Billing | **FAIL** (T-244: a late event for a user's earlier subscription still rolls the plan back) |
| 10 | Legal and wording | PASS (placeholders listed) |
| 11 | Publication readiness | PASS |

Two fails. T-245 and T-246 hold. T-244 fixes the case it tested (an older event for the *same* subscription) but not a late event for an *earlier* subscription of the same user: after cancel → resubscribe, a Stripe retry of the old subscription's event drops a paying Premium user to Free. T-243's bar is set at the top of run 7's measured range, so the live scans sit below it; the leak is no worse than run 7 (the committed scan gives exactly run 7's 1.110 pp), but by the owner's stated rule it is a fail, and the guard test cannot see it.

Fails, in short (details and repro under "Fails to fix"):
1. **RT3-01 accepted-risk bar not met on the live scan.** Attack mean error on flagged bets modelled at `all`/`cat` (best side): 1.110 pp (committed scan `1794895125`), 1.125 pp (`1795043812`), 1.089 pp (`1795050448`); bar 1.2 pp. The guard test passes because it measures every `all`/`cat` row of the fixture scan (~2.1 pp), never live flagged rows.
2. **T-244: out-of-order events can still roll a plan back across subscriptions.** `wh8b.mjs` on the mock: Pro (sub A) → cancel → Premium (sub B) → Stripe retries an old A event → `/api/me` tier `free`, row points at the canceled A.

## Fixed since run 7

| Item | Change | Holds? | Evidence |
|---|---|---|---|
| Run 7 fail 1 (RT3-01) | T-243: accepted risk, guard test | **No by the stated bar** (item 6, fail 1) | Below. |
| Run 7 observation (out-of-order webhooks) | T-244: tier from the current subscription | **Partly** (item 9, fail 2) | Below. |
| Run 7 owner item (hard-coded "15") | T-245: delay strings from `free_delay_min` | **Yes** | Below. |
| Run 7 owner item (search crawlers on `/m/`) | T-246: BotID-verified bots skip page limits | **Yes** (spoof still limited) | Below. |

**T-243, RT3-01 guard: the live scans are below the bar.**
- `curve_check4.py`, logged out against the 5150 production build: for each flagged bet whose side is modelled at `all`/`cat`, fetch `/api/model/curve?segment=…&h=…` (200, 10 points), interpolate at the Free row's `mid`, clamp to Free's band, compare with the exact win chance. The curve depends only on `model.json`, which a scan does not change, so every scan's flags can be measured against the same server.

  | Scan | Population | n | Attack within 0.5 pp | Mid-band within 0.5 pp | Attack mean error | Mid-band mean error |
  |---|---|---|---|---|---|---|
  | `1794895125` (committed) | flagged, best side | 147 | 46 (31.3%) | 20 (13.6%) | **1.110 pp** | 1.401 pp |
  | | flagged, every side | 294 | 87 (29.6%) | 45 (15.3%) | 1.154 pp | 1.373 pp |
  | `1795043812` (fresh 1) | flagged, best side | 140 | 48 (34.3%) | 25 (17.9%) | **1.125 pp** | 1.264 pp |
  | | flagged, every side | 280 | 84 (30.0%) | 50 (17.9%) | 1.214 pp | 1.252 pp |
  | `1795050448` (fresh 2) | flagged, best side | 125 | 44 (35.2%) | 22 (17.6%) | **1.089 pp** | 1.303 pp |
  | | flagged, every side | 250 | 80 (32.0%) | 47 (18.8%) | 1.184 pp | 1.276 pp |

- Not worse than run 7: on the committed scan the numbers equal run 7's to the digit (46/147, 1.110 pp). Run 7's two scans gave 1.11 and 1.22 pp; T-243 put the bar at 1.2, the top of that range, and the comment at `test/paywall.test.ts:251` calls 1.2 "the live scan in audit run 7". So the bar is above what the live scans normally give.
- The guard cannot detect the leak: `vitest.config.mts:10` pins `DATA_DIR` to `test/fixtures`, and the test loops `s.markets` (`test/paywall.test.ts:256`), not flagged rows; its own comment says the fixtures measure ~2.1 pp. The test passed (`pnpm test`, verbose run: "chart leak on flagged all / cat rows: attack mean error stays >= the accepted level").
- By the owner's rule ("below 1.2 pp on the live scan = fail") this is fail 1. The owner should decide whether the bar is 1.1 pp (what the scans give) or the rule applies to something else; see "Fails to fix".

**T-244, Stripe out-of-order events: holds for one subscription, not across subscriptions.**
- Unit tests pass (`stripe.test.ts` "an older event delivered late can't overwrite the current plan", "a deleted subscription Stripe no longer returns falls back to the event").
- The paid e2e Checkout works with the new path: both paid runs passed S7 and account delete; the webserver log shows `GET /v1/subscriptions/<id> 200` twice per run (the mock behind `STRIPE_API_BASE`), i.e. the webhook retrieved the subscription.
- `wh8.mjs` on the 5130 mock with subscriptions that exist in the mock Stripe store (so `retrieve` returns them; run 7's `webhook.mjs` uses ids the store does not have and now only exercises the `resource_missing` fallback):
  1. Mock Checkout Pro → sub A, tier `pro`.
  2. Late older event "A = premium" → tier stays `pro`. **Holds.**
  3. Late older "A deleted" while A is active at Stripe → stays `pro`. **Holds.**
  4. Second Checkout (Premium, via the API) → sub B, tier `premium`.
  5. Late older event for A → tier **`pro`**, row now `sub A, trialing`.
  6. A canceled at Stripe, A.deleted delivered → tier **`free`** while B (premium) is active.
  7. Any later B event → `premium` again.
- `wh8b.mjs`, the normal user path (the UI sends paying users to the portal, `components/pricing/Plans.tsx:85`, but a canceled user is Free and sees "Start trial"):
  1. Checkout Pro → sub A, `pro`. 2. A canceled, A.deleted → `free`. 3. Checkout Premium → sub B, `premium`. 4. Stripe retries an earlier A event (created 2 h before) → **`free`**, row `sub A, canceled`, while sub B is active and paying.
- Cause: `currentSubscription` retrieves the subscription named in the event (`lib/billing/stripe.ts:131-139`), and `upsertSubscription` writes one row per user (`lib/billing/db.ts:25-27`, `onConflict: "user_id"`), so any event for any of the user's subscriptions overwrites the row. This is item 9, fail 2.
- `webhook.mjs` (run 7's) results are unchanged: forged/stale/altered → 400; replay → duplicate; its out-of-order step still ends on `premium` because `sub_link` is not in the mock store (fallback to the event). With real Stripe a subscription id is always retrievable, so that step is a mock artefact, not a fail.

**T-245, Free delay from the setting: holds.**
- Build: `/pricing` and `/about` are dynamic (`ƒ` in the route table), so the setting is not baked in at build time.
- 5130 mock, admin `admin-audit8@example.com` changed "Free plan data delay" on `/admin/settings` (real UI, "Save changes" → "Saved. Live on this server now…"), then signed out:
  - 25 → `/pricing` plan card and compare table "At least 25 minutes behind, top 25 rows"; `/about` plan card the same; `/status` "at least 25 minutes after it runs"; pill title "…On the Free plan you see prices at least 25 minutes behind."; `/api/meta` `delay_min 25` (`audit8-t245-25-{admin-settings,pricing,about,home}-1440.png`).
  - 15 restored → every string back to 15, `delay_min 15`.
- 5131 mock on the pending copy, admin set 25: the pending card reads "Free prices run at least 25 minutes behind; the first update is on its way. Paid plans see live prices." and `/api/meta` → 503 with the same line (`audit8-t245-pending-25-home-1440.png`).
- `grep -rniE "minutes? behind|behind|delay|15.?min"` over `apps/web/app`, `components`, `lib`, `apps/extension/src`, `config`: no hard-coded delay claim left ("Every 15 min" is a frequency filter, "expires in 15 minutes" the sign-in link; the admin hint says "Default 15").
- Production build (no DB, default 15): `/pricing` and `/about` "at least 15 minutes behind"; `/login` "Sign-in isn't available yet… at least 15 minutes behind…"; pill "…at least 15 minutes behind." (`audit8-anon-pill-1440.png`); pending (5151) "Free prices run at least 15 minutes behind…" on `/`, `/markets`, `/status`, `/m/6117510` at 390 and 1440 (`audit8-anon-pending-*.png`).
- Nit: at 1 minute the copy reads "at least 1 minutes behind" (pill, `/pricing`, `/about`, `/status`); at 0, `/pricing` would say "At least 0 minutes behind". Not a fail (the default is 15).

**T-246, verified search bots: holds; a spoofed Googlebot is still limited.**
- Production build 5150 (no `VERCEL`): 300 `/m/<id>` with `Googlebot/2.1` user agent, 8 in parallel → **60 with market data, 240 "Slow down a little" with `noindex`**. Same as `curl` (60 / 240).
- Second instance of the same build with `VERCEL=1` (so `verifiedBot()` really calls `checkBotId()`), Googlebot UA, ids from the scan Free is served → **60 / 240**: the spoof is limited. (A first attempt with ids from the newest scan gave 1 page + 59 404 + 240 slow-downs: those ids are not in Free's delayed scan; discarded.)
- Unit test "a bot Vercel verified (search engine) skips the limits; an unverified bot doesn't" passed.
- Note: on the `VERCEL=1` instance every `/m` load printed BotID's "Possible misconfiguration of Vercel BotId … 'POST <your protected endpoint>'" block (300 for 300 loads). `verifiedBot()` calls `checkBotId()` on page GETs that carry no BotID client token. Whether Vercel then reports `isVerifiedBot` for real Googlebot, and whether this warns on every market page in production logs, can only be checked on Vercel (Owner verification).

## 1. Tests: PASS

- `pytest -q` (new venv in `a8/prod`): 45 passed.
- `apps/web` in the worktree: `pnpm typecheck` exit 0; `pnpm lint` (`eslint . --max-warnings 0`) exit 0; `pnpm test`: **61 files, 384 tests passed** (plus the node ops tests: 27 pass, 0 fail, 0 skipped).
- `apps/extension`: typecheck exit 0, **6 files, 42 tests passed**.
- **Demo e2e** (`playwright.config.ts`: S1–S6, S8, search, trading-paper, multipliers, headers/CSP, a11y):
  - Run 1, PW_PORT 5110: **52 passed** (1.1 m), ended 18:12:30, load 4.57.
  - Run 2, PW_PORT 5112: **52 passed** (52.6 s), ended 18:14:51, load 6.84.
- **Paid e2e** (`playwright.paid.config.ts`, `E2E_MOCK=1`: admin ×2, paywall pages, S7, account delete, keyboard search → drawer → save → upgrade):
  - Run 1, PW_PORT 5111: **6 passed** (1.5 m), ended 18:13:58, load 4.68.
  - Run 2, PW_PORT 5113: **6 passed** (1.5 m), ended 18:16:19, load 6.89.
  - No failure, retry or flaky test in any of the four runs.
- **Paid webserver log** (`DEBUG=pw:webserver`, 903 and 886 lines): 0 `SyntaxError`, `Unexpected end of JSON`, `⨯` or `TypeError`; 0 responses 5xx. Every non-2xx is expected: the 6 `/admin*` pages → 404 twice each; in run 2 `GET /api/data` → 401 and `auth/v1/user` → 401 (signed-out checks).
- DB proofs: `ops/redteam/run3/rt3-db.test.ts`, `ops/redteam/rt2-db.test.ts` and `test/rls.test.ts` run together (`--testTimeout=60000`, load 3.8): **3 files, 25 tests passed** (copies deleted afterwards).

## 2. Production build: PASS

- `SETUP.md` §0 in `a8/prod` (see the top): `BUILD_EXIT=0`.
- `next start -p 5150` served every page with 200 in the logged-out crawl. Server log: only `[abuse] UPSTASH_REDIS_REST_URL/TOKEN not set` and Node's localStorage ExperimentalWarning.
- `/pricing` and `/about`: "Coming soon" ×2 each. No demo banner (0 matches for "demo mode" on `/`).
- `/api/trade/config` → `{"enabled":false,"env":null,"extensionId":"","riskUrl":"https://kalshi.com/regulatory"}`; POST `/api/trade/nonce` → `{"error":"Trading is off."}`; POST `/api/auth/magic-link` → `{"error":"Accounts are not set up yet"}`.

## 3. Every page × every state: PASS

Crawler `crawl2.mjs` (as run 7): 33 routes at 390 and 1440 px with light CDP throttling (40 ms, 10 Mbit/s); checks console errors/warnings, page errors, bad tokens, footer disclaimer, horizontal scroll, 5xx/429; then requests every internal link found. `tiers` is `/api/me` before, between and after the two widths.

| State | Server | Start (load) | Views | Problems | Links checked | `tiers` | Result |
|---|---|---|---|---|---|---|---|
| Logged out | prod 5150 | 18:18:43 (7.83) | 66 | 0 | 99, 0 bad | `nouser:free` ×3 | PASS |
| Free | mock 5130 (fresh) | 18:54:15 (2.72) | 66 | 0 | 112, 0 bad | `free` ×3 | PASS |
| Pro | mock 5130 (restarted, reseeded) | 19:06:35 (4.10) | 66 | 0 | 274, 0 bad | `pro` ×3 | PASS |
| Premium | mock 5130 (restarted, reseeded) | 19:21:11 (5.30) | 66 | 0 | 274, 0 bad | `premium` ×3 | PASS |
| Admin | mock 5130 (restarted, reseeded) | 19:40:12 (4.05) | 66 | 0 | 118, 1 by design | `free+admin` ×3 | PASS |

- Each signed-in crawl ran on a freshly started mock (one crawl per server). Mock logs: 0 "restarting", 0 `auth/v1/user` 401, 0 5xx in all four. One `⨯ [Error: aborted]` in the Premium mock log comes from the seeding step (the browser navigated away mid-request), before the crawl.
- Admin: `/admin`, `/admin/users`, `/admin/health`, `/admin/settings`, `/admin/audit` → 200 with h1 "Admin" at both widths. The one flagged link is `/api/admin/export` → 403 (RT2-01 same-site guard, no `Sec-Fetch-Site` on the crawler's request). A real click on "Export CSV" (`exportclick.mjs`) downloaded `kismet-users-2026-11-19.csv` with the header `id,email,created_at,last_sign_in_at,tier,status,comp_tier,comp_expires_at`.
- Disclaimer in the footer, no horizontal scroll and no console error or warning on all 330 views. 404 pages are the styled "This page doesn't exist".
- Screenshots: `audit8-{anon,free,pro,premium,admin}-{home,markets,pricing,account,admin_health,m_<id>}-{390,1440}.png`.

## 4. Quality: PASS

**Lighthouse: PASS.** `npx lighthouse@12`, `--form-factor=mobile`, default simulated throttling, Playwright Chromium headless, 5150 production build, nothing else of mine running. Performance / accessibility / best practices / SEO; `uptime` is the 1/5/15-minute load before each page.

| Page | uptime | Run 1 | Run 2 | Run 3 | Perf median |
|---|---|---|---|---|---|
| `/` | 2.49 3.99 4.51 | 88/100/100/91 | 91/100/100/91 | 96/100/100/91 | **91** |
| `/about` | 2.49 3.78 4.40 | 93/100/100/91 | 98/100/100/91 | 93/100/100/91 | **93** |
| `/pricing` | 2.68 3.66 4.33 | 94/100/100/91 | 94/100/100/91 | 94/100/100/91 | **94** |

- One batch at load 2.5–2.7 (below 15), none discarded. TBT 121–290 ms, LCP 2.3–3.2 s, FCP 0.76–0.91 s. `/` run 1 (88) had TBT 290 ms; the median is 91.
- Accessibility and best practices 100 on all 9. SEO 91 on all 9, only `meta-description` (streamed by Next 15; the tag is in the HTML), as runs 3–7. Note, not a fail.

**axe:** zero serious/critical (`e2e/a11y.spec.ts` passed in both demo runs).

**Keyboard-only** (`kbd.mjs`, 5150, logged out): `/` focuses search; "barcelona" ↓ Enter → `/?q=FC+Barcelona`; a result link in 24 Tabs, Enter opens "Market details" with focus inside; "Save" in 5 Tabs → "Saved", focus kept; "Pricing" in 10 Tabs → `/pricing`. Signed in: `s7-upgrade.spec.ts` passed in both paid runs.

**Reduced motion:** `matchMedia` matched; longest animation/transition 0.01 ms.

**Design review** of the crawl and T-245 screenshots against the Chosen design: dark theme, emerald accent, rounded-xl cards, 16 px gutters hold; the Free plan card wraps "at least 15 minutes behind, top 25 rows" cleanly at 390 (`audit8-anon-pricing-390.png`); a Pro user sees "Your plan" on Pro and "Switch to Premium" (`audit8-pro-pricing-1440.png`). No new alignment, truncation or contrast problem. The Next dev-tools "N" button shows only in mock (dev) screenshots.

## 5. Data correctness: PASS

- **Free capped and delayed on the server** (`probe.py`, 5150, logged out, `ps`/`page`/`page_size`/`tier` params and an `x-tier` header): 7 responses, all 200, 25 rows, page 1, every row banded; the rows matched the scan they were served from (the committed scan, while the fresh one was 9.9 min old): 0 mismatches.
- **Delay:** `poll.py` read `/api/meta` logged out every 20 s, 18:27:12–18:36: Free switched from `1794895125` to `1795043812` at 18:31:54, **15.0 min** after the scan; `BAD_TOTAL 0`.
- **Pro and Premium live, Free delayed** (`me.mjs`, mock, 20:10, after scan `1795050448` at 20:08): signed out → `1795043812` (`delay_min 15`); Pro and Premium → `1795050448` (`delay_min 0`); the 5150 build signed out → `1795043812`.
- **Cards equal the API** (`cards.mjs`, 5150): 16 API rows, 13 cards matched, 0 mismatched.
- **Fees and returns** (`fees.mjs`, Pro on the mock, 20 bets, 40 sides, newest scan): fee and edge match on all 40, 0 mismatches; roi differs by 0.01 on a few sides (4-decimal rounding), as before.
- **Freshness pill:** "Updated 23 min ago", title "…last checked 23 min ago. Prices refresh about every 10 minutes. On the Free plan you see prices at least 15 minutes behind." (`audit8-anon-pill-1440.png`).

## 6. Security: **FAIL** (RT3-01 accepted-risk bar)

- **Paid data as free/anon:** rows capped and banded (item 5). The chart leak is measured above ("Fixed since run 7", T-243): live mean error 1.089–1.125 pp on flagged best sides, below the owner's 1.2 pp bar. Fail 1. Niche segments are still paid-only (`segment=soccer` → 403) and the per-market `curve` is `null` for Free.
- **Page limits (RT3-02) and T-246:** 300 `/m/` loads → 60 / 240 slow-down with `noindex`, for curl and for a spoofed Googlebot, with and without `VERCEL=1` (above).
- **Headers** (`curl -I`, 5150): HSTS `max-age=63072000; includeSubDomains`, `nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()`, CSP with a per-request nonce and `strict-dynamic`. `e2e/headers.spec.ts` passed twice.
- **Hidden routes** (5150, logged out): `/admin`, `/admin/users`, `/api/admin`, `/api/admin/export`, `/e2e-mock/supabase/_inbox`, `/e2e-mock/supabase/auth/v1/user`, `/api/data` → 404; `/api/admin` POST/PUT/PATCH/DELETE → 404; POST `/api/settle/run`, `/api/alerts/run` → 401.
- **Another user's rows:** 25 DB tests passed (item 1). Live check under Owner verification.
- **Rate limits** (`hammer.py`, 5150): `/api/markets` ×40 → 23 × 200 then 17 × 429 (`Retry-After: 48`); `/api/flags` ×40 → 40 × 429; `/api/suggest?q=bar` ×250 → 120 × 200, 130 × 429; `/api/markets` ×40 with a new `X-Forwarded-For`/`X-Real-IP` each → 40 × 429; `smoke-prod.sh`: 40 × POST `/api/ext/telemetry` → 429 after the burst.
- **Crawlers:** GPTBot, ClaudeBot, CCBot, PerplexityBot, Google-Extended, Bytespider → 403 on `/` and `/api/*`. HeadlessChrome, python-requests, curl → 200 (BotID runs only on Vercel; Owner verification).
- **Stripe webhooks:** unsigned, wrong secret, 1-hour-old timestamp, altered body → 400; replay → duplicate (item 9).
- **Dependencies:** `apps/web` `pnpm audit --prod`: no known vulnerabilities; full `pnpm audit`: 1 moderate (`minimatch`, dev tooling). `apps/extension`: none. `pip-audit -r requirements.txt`: none.
- **Secrets in history:** `secrets_scan.py` over `git log --all -p`, 306 commits: 24 hits = run 7's 23 known fakes + 1 in `3eb8132` (the run 7 report quoting the fake `sk_test_FAKEFAKEFAKEFAKE`). The 4 commits since run 7: 0 hits.
- **Client bundles:** `pnpm check:bundle`: "127 files in .next/static, no secrets"; grep for `SUPABASE_SERVICE_ROLE`, `STRIPE_SECRET_KEY`, `sk_live_`, `sk_test_`, `whsec_`, `UPSTASH_REDIS_REST_TOKEN`, `CRON_SECRET`, `EXT_SIGNING_SECRET`, `UNSUBSCRIBE_SECRET`, `service_role`: 0 files. `checkBotId`/`isVerifiedBot` are server-only (0 files in `.next/static`).
- **Cookies:** no `Set-Cookie` on `/` in the prod build. Auth-cookie flags under Owner verification.

## 7. Multipliers and combos: PASS

- No change since run 7 in `lib/combos.ts`, the multiplier tiers or the combo UI; `test/multipliers.test.ts` and the combo tests passed; `e2e/multipliers.spec.ts` passed twice.
- Live (scan `1795050448`): market 6771195 (and 6841253), ask 0.06 (≥10x), win 0.1077, edge 0.0448, tier `best`. Tier split 909 best / 809 edge.
- **Raw-count sweep:** the diff since run 7 adds no count display (`Plans.tsx` and `/pricing` add only the delay number). Grep for `{….length|count|total|unread}` and `toLocaleString()` in `apps/web/app`, `components`, `apps/extension/src` without `formatCount`: 19 hits, the same bounded set as run 7 (combo legs ≤ 6, dashboard panels, the inbox ≤ 50, chosen topics, the 280-char banner counter, `colSpan`, a chart aria-label, a date `toLocaleString()`, and two `<Count>` uses that call `formatCount`). No count that can pass 999 shows raw.

## 8. Trading safety: PASS

- 5150: `/api/trade/config` → `enabled:false`; POST `/api/trade/nonce` → "Trading is off.".
- `git diff 30e7362 88a24a6 -- apps/extension apps/web/lib/trade apps/web/components/trade` is empty; `e2e/trading-paper.spec.ts` passed twice.

## 9. Billing: **FAIL** (T-244 cross-subscription rollback)

- `webhook.mjs` on the mock, user `webhook-audit8@example.com`: unsigned → 400 "Not configured or unsigned"; wrong secret, 1-hour-old timestamp, changed body → 400 "Bad signature"; raw unsigned `client_reference_id` → 200, not linked; subscription for that customer → 500 "Retry"; signed `client_reference_id` (Payment Link path) linked the customer; `customer.subscription.created` premium → premium; replay → `{"duplicate":true}`; portal cancel (`cancel_at_period_end`) → still premium; `customer.subscription.deleted` → free; replayed deletion → duplicate.
- S7 (checkout → tier up) and account delete with a live subscription passed in both paid runs; the seed flow upgraded Pro and Premium users through mock Checkout 4 more times.
- Out-of-order events: T-244 holds for one subscription and fails across two ("Fixed since run 7"). **Fail 2.**

## 10. Legal and wording: PASS (placeholders listed)

- Footer disclaimer "Market analytics, not financial advice. Based on past results. 18+." on all 330 crawled views, on the pending state and in the extension popup.
- `/terms`, `/privacy`, `/refunds`, `/disclaimer`, `/contact`, `/status` → 200, linked from the footer.
- 18+ gate: keyless build answers "Accounts are not set up yet"; on the mock every seeded user had to tick the box (`seed.mjs`), and S7 passed twice. Email templates unchanged since run 7.
- Banned words (`grep -rniE "\b(picks?|locks?|guaranteed?|sure thing|can.?t lose|risk.?free|expected profit)\b"` over `apps/web/app`, `components`, `lib/email`, `apps/extension/src`): only comments, identifiers (`pick`, `Pick<…>`) and the negation on `/terms`.
- Every Free delay string follows the setting (T-245).
- TODO/FIXME and `console.log` in shipped code: 0 and 0.
- Placeholders (listed, not failed): unchanged from run 7 (`[[GOVERNING_STATE]] [[LAST_UPDATED]] [[OPERATOR_NAMES]] [[SUPPORT_EMAIL]] [[REFUND_POLICY]] [[RESPONSE_TIME]]` on the legal pages, `[[OPERATOR_NAMES]]` in every footer); `ops/site-config.mjs` still lists them as missing.

## 11. Publication readiness: PASS

- `robots.txt` 200: AI user agents `Disallow: /`; everyone else `Allow: /` with `/api/`, `/auth/`, `/login`, `/onboarding`, `/account`, `/settings`, `/watchlist`, `/journal`, `/alerts`, `/dashboards`, `/admin` disallowed; `Sitemap: http://localhost:5150/sitemap.xml` (12 `<loc>`).
- No test users, seed data or debug routes in prod (`/e2e-mock/*`, `/api/data`, `/admin*` → 404).
- Styled 404; `/icon.svg` 200 `image/svg+xml`; `/favicon.ico` 404 (harmless, as before); `/opengraph-image` 200 `image/png`.
- Extension: `KISMET_ORIGIN=https://kismetodds.example pnpm ext:zip` → `kismet-extension-0.1.0.zip` (26,267 bytes, moved out of the worktree). MV3, permissions `storage`, `sidePanel`, hosts the app origin and `external-api.demo.kalshi.co`, CSP `script-src 'self'; object-src 'self'`, 0 files with `eval(`/`new Function`. Loaded unpacked in a clean Chromium profile: service worker registered; popup "Kismet Signed out … Paper trading Off … Market analytics, not financial advice. Based on past results. 18+." (`audit8-ext-popup.png`); only console error is DNS for the placeholder domain.
- **Ops dry runs** (`ops.sh`, `env -i PATH HOME`): `secrets.mjs` plan, exit 0; `site-config.mjs` dry run, exit 0, `config/site.json` md5 unchanged (`bda0c50c…`); `stripe-setup.mjs` plan, exit 0; `preflight.mjs` 24 blockers / 6 warnings, exit 1 by design; `supabase-setup.sh` plan, exit 0; `vercel-env.mjs` "Refusing: no env file…" exit 2, and with a test env file only the documented keys, the Stripe key `--sensitive` and masked (`sk_t…(24 chars)`), `E2E_MOCK` and non-example keys not pushed, exit 0; `checks.py a8/prod/output` "data checks ok"; `upload.py` without credentials exit 1, nothing uploaded; `scheduler.plan` → `bootstrap, backtest, update, fit, grade, scan`. `git status` after: no tracked file changed.
- **`ops/smoke-prod.sh`**: `SMOKE_EXPECT_HEALTH=503 ops/smoke-prod.sh http://localhost:5150` → **18 passed, 0 failed**, exit 0.
- `SETUP.md` from scratch reaches a running app (item 2).

## Fails to fix

1. **RT3-01 accepted risk: the live scan is below the owner's 1.2 pp bar, and the guard test cannot see it.** (Severity unchanged from run 7: low. The leak did not get worse.)
   - Where:
     - `apps/web/test/paywall.test.ts:251` `ACCEPTED_MEAN_ERR = 0.012` (comment: "the live scan in audit run 7"; run 7's live scans were 1.11 and 1.22 pp).
     - `apps/web/test/paywall.test.ts:256` loops `s.markets` of the fixture scan (`apps/web/vitest.config.mts:10` `DATA_DIR: "test/fixtures"`), not flagged rows; the fixtures give ~2.1 pp, so the test passes whatever the live scan does.
     - The leak itself: `lib/data/model.ts:42-55` (`coarseCurve`), `app/api/model/curve/route.ts`, `lib/data/gate.ts` (`rangeSide` keeps `mid`, `model_level`, `category`, `horizon_h`), as in run 7.
   - Repro (any build, logged out): run 7's 4 steps (`/api/markets/<id>` → `best.mid`, band, `model_level`, `horizon_h`; `/api/model/curve?segment=<all|cat:…>&h=…`; interpolate at `mid`; clamp to the band) over the scan's flagged bets at `all`/`cat`. Result, best side: mean error 1.110 pp (`1794895125`), 1.125 pp (`1795043812`), 1.089 pp (`1795050448`).
   - Fix direction (owner's call): either set the bar to what the scans give today (about 1.05 pp, so a worse leak still trips it) and make the test measure flagged rows (a fixture with flagged `all`/`cat` rows, or a data check over `output/flags.json` in `ops/checks.py`), or keep 1.2 and reduce the leak.

2. **T-244: a late event for a user's earlier subscription overwrites the current plan.** (Medium: a paying user can lose access until their next subscription event; happens only after cancel → resubscribe plus a delayed or retried Stripe delivery, or with two live subscriptions.)
   - Where:
     - `apps/web/lib/billing/stripe.ts:131-139` (`currentSubscription` retrieves the subscription named by the event) and `:121-127`, `:165` (`applySubscription` upserts it as the user's plan).
     - `apps/web/lib/billing/db.ts:25-27` (`upsertSubscription`: one row per user, `onConflict: "user_id"`, no check that the event's subscription is the user's current one).
     - `apps/web/app/api/stripe/checkout/route.ts:22-42` (no server-side "already paying" refusal; only the UI routes paying users to the portal, `components/pricing/Plans.tsx:85`).
   - Repro (`E2E_MOCK=1` dev server, `wh8b.mjs`):
     1. Sign in a new user; mock Checkout `pro_monthly` → sub A; `/api/me` `pro`.
     2. `DELETE /e2e-mock/stripe/v1/subscriptions/<A>`; deliver signed `customer.subscription.deleted` for A → `free`.
     3. Mock Checkout `premium_monthly` → sub B; `/api/me` `premium`.
     4. Deliver a signed `customer.subscription.updated` for A with a new event id and `created` 2 h ago (a Stripe retry of a delivery that failed earlier) → `/api/me` **`free`**; `subscriptions` row `sub A, canceled`, while B is active.
     - With two live subscriptions (`wh8.mjs` steps 4–6): a late A event → `pro`; A ending → `free` while B (premium) is active.
   - Fix direction: ignore (or only record) events whose subscription is not the user's current one, e.g. skip the upsert when the row already holds a different subscription that is paying and the event's subscription is not; or pick the tier from the customer's paying subscriptions (`stripe.subscriptions.list({ customer, status: "all" })`) instead of the one in the event. Add a test with two subscription ids.

## Owner verification

Unchanged from run 7 except where marked:

- **Supabase:** run the RLS checks against the live project with the anon key; send a real magic-link email; run `ops/supabase-setup.sh <ref> --yes`; after a real sign-in confirm auth cookies carry `Secure; HttpOnly; SameSite=Lax`; confirm the `plan_quota` trigger blocks an 11th Free watchlist row. (`ADMIN_REQUIRE_MFA` stays off by owner decision.)
- **Stripe test mode end to end:** Checkout; webhook delivery to the deployed URL; Customer Portal cancel and plan switch; a real Payment Link if `stripe.mode` is `links`. (changed) After fail 2 is fixed: cancel, resubscribe, then use "Resend" on an old subscription's event in the Stripe dashboard and confirm the plan does not change.
- **Upstash:** set the Redis keys so the shared limiter replaces the in-memory one and `/api/health` reports ok.
- **Vercel:** confirm BotID challenges headless browsers and scripted clients; Root Directory `apps/web`; push env with `node ops/vercel-env.mjs --env apps/web/.env.prod`; check a shared office/NAT IP is not throttled by the per-IP + JA4 page limit.
- (changed) **Search crawlers on market pages (T-246):** on a Vercel preview, confirm `checkBotId()` reports `isVerifiedBot: true` for real Googlebot/Bingbot page loads of `/m/` and `/event/` (Search Console "URL inspection" → live test), that a spoofed Googlebot UA is still limited, and decide whether the BotID "Possible misconfiguration" warning on every market page load (seen locally with `VERCEL=1`) is acceptable log noise.
- **Burst scans:** a cold instance after back-to-back scans shows Free the pending state until a kept copy is `free_delay_min` old.
- (changed) **Free delay setting:** the copy now follows `free_delay_min` (T-245). If it is ever set to 1, the copy says "1 minutes"; at 0, `/pricing` says "At least 0 minutes behind".
- (changed) **RT3-01:** decide the bar for fail 1 (1.2 pp is above today's live scans) and whether the guard should measure live flagged rows.
- **Kalshi demo:** place one demo order from the extension with a real demo key.
- **Domain and `config/site.json`:** fill the placeholders listed in item 10; set `NEXT_PUBLIC_SITE_URL`.
- **Scan cadence:** run the engine container (10-minute scans); with only the `refresh.yml` fallback (every 2 h), "about every 10 minutes" is wrong.
- **Chrome Web Store:** publish the extension and set `NEXT_PUBLIC_EXTENSION_ID`.
- **Count rule exceptions (item 7):** confirm the exact contract quantity on the trade ticket and the exact unread count in the bell's `aria-label`.

# Audit run 9 (billing and pricing only, owner decision Nov 18)

Scope set by the owner: after the price change (Pro $11.99/mo or $99.99/yr, Premium $19.99/mo or $169.99/yr, 7-day
trial on both), re-run only the billing and pricing checks (items 9 and 10 as they touch pricing). Fresh auditor, read-only,
worktree `audit9b` at `8a9beda`.

| Check | Result | Evidence |
|---|---|---|
| A. Prices everywhere | FAIL, then fixed (T-251) | site.json, /pricing cards (monthly, yearly, "save 29%"), /terms, /refunds and docs matched. The /pricing compare-table headers were hard-coded "Pro · $19" / "Premium · $29". They now read from `config/site.json`, and `e2e/s6.spec.ts` asserts "Pro · $11.99" and "Premium · $19.99" (4/4 pass on a production build). |
| Tier feature split unchanged | PASS | `lib/entitlements.ts` has no diff since `3008332`. Plan points differ only in the Free delay wording (T-249). |
| B. ops/stripe-setup.mjs | PASS | The dry run prints $11.99/month, $99.99/year, $19.99/month, $169.99/year. `node --test ops/tests/`: 27/27. |
| C. Webhook tier mapping | PASS | `tierFromPrice` compares cents. 1199 and 9999 map to pro, 1999 and 16999 to premium, and 1900 to null (`lib/billing/stripe.test.ts`). |
| D. Trial | PASS (read) | `app/api/stripe/checkout/route.ts:39` sends `trial_period_days: 7` for every plan unless `trialed_at` is set. |
| E. e2e | PASS | s6 4/4. Paid suite 6/6. The first run had one admin-spec cold-compile flake, outside billing scope; the rerun was clean. |
| F. Wording | PASS | The disclaimer footer is on /pricing, /terms and /refunds, and those pages contain no banned words. |

Notes, added to `docs/setup-notes/lane-l.md`:
- A price change needs the new `STRIPE_PRICE_*` ids pasted by hand, because stripe-setup never overwrites a set id.
- In Payment Links mode, the trial is set on each link in the Stripe dashboard.

Result after T-251: zero fails in scope.

# Audit run 10

Kismet final audit, tenth run (full audit, items 1–11).

Auditor: a fresh agent that built none of this code. It checked and fixed nothing.
Target: branch `final` at `772ac10` ("T-258: cleanup: delete stale docs/LANE_RULES.md, …"), checked out as worktree `audit10` (branch `audit10`).
Date: 2026-11-19, 00:12–01:50 local.
Spec: `docs/OVERNIGHT.md` §3, items 1–11, with run 8's protocols. Verified specifically: T-247 (run 8 fail 2), T-248 (chart-leak guard), T-249–T-251 (delay copy, prices), T-252 (rename), T-253 (owner values, legal pages), T-254 (`ops/ship.md`, `vercel.json`), T-255/255b (brand, badge "K"), T-256–T-258 (cleanup).

Owner decisions applied, not counted as fails:
- RT3-01 chart leak is an accepted risk. Item 6 fails on it only if `apps/web/test/chart-leak.test.ts` fails (mean attack error on live flagged rows < 1.05 pp).
- `ADMIN_REQUIRE_MFA` stays off.
- The site runs on the committed scan, so "data may be stale" banners are expected.
- A test that fails once and passes on an immediate rerun is a flake. None happened.

How the audit ran:
- Everything ran in the scratch directory, outside `~/Desktop`. Only ports 5310–5352 were used. Every server was stopped at the end: no listener on 5300–5399.
  - `audit10/` (worktree): `pnpm i --frozen-lockfile` (web and extension, exit 0), unit tests, lint, typecheck, both e2e suites twice each, extension zip.
  - `a10/prod/` (a `git archive` copy): new venv (Python 3.13.1; there is no 3.12 on this Mac), `pip install -r requirements.txt`, `pytest -q` (45 passed), production `pnpm build` with no `DEMO_MODE`, no `.env*` except `.env.example`, no Supabase/Stripe/Upstash/Kalshi variable (`BUILD_EXIT=0`). It ran as `next start -p 5350`, with `DATA_DIR=a10/prod/output`.
  - `a10/mock/` (a `git archive` copy): `E2E_MOCK=1` dev server on 5330 with the paid-config env and `ADMIN_EMAILS=admin-audit10@example.com`. It was restarted and reseeded (`crawl1.sh`) before each signed-in crawl.
  - `a10/clone/` (a real `git clone` of the branch): `SETUP.md` §0 from scratch (item 11).
- One fresh scan ran into `a10/prod/output` at 00:25:59–00:26:53: 18,075 markets, 1,807 flags, `scanned_at 1795065960`. The committed scan `1794895125` (13,971 markets, 2,778 flags, unchanged since run 8) became `*-prev.json`. The worktree's `output/` was not touched, and neither were the `* 2*` files.
- Helpers were reused from run 8 (`a8/` to `a10/`, with ports and paths rewritten). The crawler also flags `[[`, the word "draft" and the old product name (regex `market[ _-]?edge`) on screen. New helpers: `wh10.mjs` (T-247 and a late `checkout.session.completed`) and a one-off render of the 3 email templates.
- `git log --all` fails in this worktree because of a broken ref, `refs/remotes/origin/final 2` (an iCloud duplicate, left untouched). The secret scan therefore enumerated the valid refs with `git for-each-ref`.

## Summary

| # | Item | Result |
|---|------|--------|
| 1 | Tests | PASS |
| 2 | Production build | PASS |
| 3 | Every page × every state | PASS |
| 4 | Quality | PASS |
| 5 | Data correctness | PASS |
| 6 | Security | PASS |
| 7 | Multipliers and combos | PASS |
| 8 | Trading safety | PASS |
| 9 | Billing | **FAIL** (a late retry of an old `checkout.session.completed` rolls a paying user back to Free) |
| 10 | Legal and wording | PASS (no placeholder, no draft banner, values match `config/site.json`) |
| 11 | Publication readiness | **FAIL** (the extension build step in `ops/ship.md` fails as written) |

Two fails.
- T-247 fixes run 8's repro: late subscription events for an old subscription no longer change the plan. But the `checkout.session.completed` branch still applies the session's own subscription instead of the customer's current one.
- `ops/ship.md` step 15 (and `SETUP.md` §3.5, `LAUNCH_TODO.md` #9) runs `pnpm ext:zip` from the repo root. There it fails with `Command "ext:zip" not found`.

Everything else in the brief holds:
- rename grep: 0 hits;
- owner values on every legal page;
- no `[[` or "draft" on any page or email;
- emails send from `EMAIL_FROM` and set `reply_to` to support;
- new brand assets;
- badge "K";
- chart-leak guard passes, with the live error above the bar.

## Changes since run 8

| Change | Holds? | Evidence |
|---|---|---|
| T-247: tier from the customer's paying subscriptions | **Partly** (item 9, fail 1) | `wh8.mjs` and `wh8b.mjs` now end on `premium`. `wh10.mjs` step 5 → `free`. |
| T-248: chart-leak guard on live flagged rows, bar 1.05 pp | Yes | `test/chart-leak.test.ts` passed. Live 1.110 pp (committed scan) and 1.126 pp (fresh scan). |
| T-249–T-251: delay copy, new prices, compare table from config | Yes | `/pricing` "$11.99 / month", "$19.99 / month", "Pro · $11.99", "Premium · $19.99", "7-day free trial"; `/terms` all 4 prices. `git grep -nE '\$(19\|29)\b'` (outside AUDIT.md): 0. |
| T-252: rename | Yes | `git grep -niE "market[ _-]?edge"`: 0 lines. `git grep ME_ORIGIN` (outside `KISMET_ORIGIN`): 0. Lookup keys `kismet_pro_monthly` … `kismet_premium_yearly` (`ops/stripe-setup.mjs` dry run). The crawler found the old name on 0 of 330 views. |
| T-253: owner values, legal pages, `reply_to` | Yes | Item 10. `lib/email/index.ts:54` `reply_to: site.support_email`. `EMAIL_FROM=Kismet <noreply@kismetodds.com>` in `SETUP.md:71`, `apps/web/.env.example:30`, `ops/ship.md` step 5. |
| T-254: `ops/ship.md`, `apps/web/vercel.json` | **Partly** (item 11, fail 2) | One numbered list (steps 1–15), team `kismet9`, project `kismet`, `kismetodds.com`. `vercel.json`: Next.js, frozen install, `iad1`, 2 crons. Both cron routes → 401 without `CRON_SECRET`. Step 15 fails as written. |
| T-255/255b: brand | Yes | Wordmark and tagline in the header, footer ("Kismet. Less luck, more math.") and OG image (`audit10-og.png`, 1200×630). `/icon.svg` "K" mark 200; `/apple-icon.png` 180×180 200; `/twitter-image` 200. Extension icons 16/32/48/128 PNG. Content-script badge literal `"K"` (`apps/extension/src/content.ts`, T-255b). |
| T-256–T-258: cleanup | Yes | Item 8 reviewed the diff (exports removed, rename). All tests pass. |

## 1. Tests: PASS

- `pytest -q`: 45 passed (`a10/prod` and the fresh clone).
- `apps/web`:
  - `pnpm typecheck` exit 0.
  - `pnpm lint` (`--max-warnings 0`) exit 0.
  - `pnpm test`: **62 files, 389 tests passed**, plus node ops tests (27 pass, 0 fail).
- `apps/extension`: typecheck exit 0, **6 files, 42 tests passed**.
- **Demo e2e** (`pnpm exec playwright test`: S1–S6, S8, search, trading-paper, multipliers, headers/CSP, a11y):
  - Run 1, `PW_PORT=5310`: **52 passed** (1.8 m).
  - Run 2, `PW_PORT=5312`: **52 passed** (58 s).
- **Paid e2e** (`-c playwright.paid.config.ts`: admin ×2, paywall pages, S7, account delete, keyboard search → drawer → save → upgrade):
  - Run 1, `PW_PORT=5311`: **6 passed** (1.8 m).
  - Run 2, `PW_PORT=5313`: **6 passed** (1.4 m).
- No failure, retry or flake in the four runs. Paid webserver logs (1,746 and 1,724 lines): 0 `SyntaxError`, `TypeError`, `⨯` or 5xx.
- Load during e2e was 7–20, from my own parallel work at the start. Every run still passed.

## 2. Production build: PASS

- `pnpm build` exit 0 (above). `next start -p 5350` served every crawled page with 200 (404 only where expected).
- Server log contained only the Upstash in-memory warning, Node's localStorage ExperimentalWarning and the smoke test's telemetry lines.
- `/pricing` and `/about`: "Coming soon" ×2 each. "demo mode" on `/`: 0.
- `/api/trade/config` → `enabled:false`. POST `/api/trade/nonce` → "Trading is off.". POST `/api/auth/magic-link` → "Accounts are not set up yet".

## 3. Every page × every state: PASS

`crawl2.mjs`:
- 33 routes at 390 and 1440 px with light CDP throttling (40 ms, 10 Mbit/s).
- Checks console errors and warnings, page errors, and on-screen tokens (`NaN`, `undefined`, `null`, `[object Object]`, lorem, TODO, FIXME, `[[`, "draft", the old name).
- Also checks the footer disclaimer, horizontal scroll and 5xx/429, then requests every internal link.

| State | Server | Start (load) | Views | Problems | Links checked | `tiers` | Result |
|---|---|---|---|---|---|---|---|
| Logged out | prod 5350 | 00:25:59 (2.87) | 66 | 0 | 98, 0 bad | `nouser:free` ×3 | PASS |
| Free | mock 5330 | 00:33:31 (3.97) | 66 | 0 | 125, 1 artefact | `free` ×3 | PASS |
| Pro | mock 5330, restarted | 00:52:51 (12.4) | 66 | 0 | 276, 0 bad | `pro` ×3 | PASS |
| Premium | mock 5330, restarted | 01:09:39 (11.0) | 66 | 0 | 276, 0 bad | `premium` ×3 | PASS |
| Admin | mock 5330, restarted | 01:26:12 (13.3) | 66 | 0 | 113, 1 by design | `free+admin` ×3 | PASS |

- Free artefact: `/m/6117522` → 404 (styled). It is a link from a page rendered on the committed scan. The link was requested after Free switched to the fresh scan at 00:41, and the fresh scan does not contain that market (it is in `1794895125`, not in `1795065960`). Not a fail.
- Admin: the `/admin*` pages → 200 with h1 "Admin" at both widths. `/api/admin/export` → 403 by design (RT2-01 same-site guard). A real click on "Export CSV" (`exportclick2.mjs`) downloaded `kismet-users-2026-11-19.csv` (header `id,email,created_at,last_sign_in_at,tier,status,comp_tier,comp_expires_at`).
- Mock logs (all four): 0 "restarting", 0 `auth/v1/user 401`, 0 5xx.
- Static checks on shipped code: 0 `TODO`/`FIXME`, 0 `console.log`, 0 lorem.
- Screenshots: `docs/screenshots/audit/audit10-{anon,free,pro,premium,admin}-{home,markets,pricing,account,admin_health,terms,privacy,refunds,disclaimer,contact,m_<id>}-{390,1440}.png` (137 files with the `audit10-` prefix).

## 4. Quality: PASS

**Lighthouse** (`lighthouse@12`, mobile, default throttling, 5350 production build, run right after e2e with only that server up). Scores are performance / accessibility / best practices / SEO.

| Page | uptime before | Run 1 | Run 2 | Run 3 | Perf median |
|---|---|---|---|---|---|
| `/` | 5.81 9.37 11.32 | 92/100/100/91 | 91/100/100/91 | 95/100/100/91 | **92** |
| `/about` | 4.92 8.61 10.93 | 93/100/100/91 | 93/100/100/91 | 93/100/100/91 | **93** |
| `/pricing` | 3.93 7.91 10.57 | 94/100/100/91 | 94/100/100/91 | 94/100/100/91 | **94** |

- SEO is 91 on all 9 runs. The only failing audit is `meta-description` (Next 15 streams it; the tag is in the HTML), as in runs 3–8.
- TBT 120–193 ms, LCP 2.4–3.2 s.
- **axe**: zero serious/critical (`e2e/a11y.spec.ts`, both demo runs).
- **Keyboard-only** (`kbd.mjs`, 5350):
  - `/` focuses search; "barcelona" ↓ Enter → `/?q=FC+Barcelona`.
  - A row link in 24 Tabs; Enter opens "Market details" with focus inside.
  - "Save" in 5 Tabs → "Saved".
  - "Pricing" in 10 Tabs → `/pricing`.
  - Signed in, `s7-upgrade.spec.ts` keyboard test passed twice.
- **Reduced motion**: matched; longest animation and transition 0.01 ms.
- **Design review** of the crawl screenshots: dark theme, emerald accent, rounded-xl cards and 16 px gutters hold.
  - The new K mark and wordmark are aligned in the header at 390 and 1440.
  - Legal pages read cleanly at 390 (`audit10-anon-contact-390.png`).
  - Extension popup: `audit10-ext-popup.png`.

## 5. Data correctness: PASS

- **Free capped and banded on the server** (`probe.py`, 5350, logged out; `ps`/`page`/`page_size`/`tier` params and `x-tier` header): 7 responses, all 200, 25 rows, page 1, every row banded. The 25 rows equal the scan Free is served: 0 mismatches.
- **Delay** (`poll.py`, `/api/meta` logged out every 20 s, 00:27–00:46): Free switched from `1794895125` to `1795065960` at 00:41:12, **15.2 min** after the scan (20 s granularity). `BAD_TOTAL 0`.
- **Pro live, Free delayed** (`me.mjs`, mock, 01:4x): Pro → `1795065960`, `delay_min 0`; signed out → `delay_min 15`.
- **Cards equal the API** (`cards.mjs`, 5350): 25 API rows, 12 cards matched, 0 mismatched.
- **Fees and returns** (`fees.mjs`, Pro on the mock, 20 bets, 40 sides, fresh scan):
  - fee and edge match on all 40 sides;
  - `roi` differs on 1 side by 0.02 (−60.57 vs −60.55, 4-decimal rounding), as in run 8.
- **Freshness pill**: "Updated 47 h ago · data may be stale" on the committed scan (`audit10-anon-home-1440.png`). Expected (owner note).
- `ops/checks.py a10/prod/output`: "data checks ok".

## 6. Security: PASS

- **RT3-01 chart leak (accepted risk):**
  - `test/chart-leak.test.ts` passed: "the attack's mean error stays at or above 1.05 pp", 626 ms, on the live `output/`.
  - Independent measurement (`curve_check4.py` against 5350, flagged best sides at `all`/`cat`):
    - committed scan `1794895125`: n=147, mean error **1.110 pp**;
    - fresh scan `1795065960`: n=115, mean error **1.126 pp**.
  - Both are above 1.05. Niche curves stay paid-only (`segment=soccer` → 403).
- **Paid data as anon:** capped and banded (item 5). Paywall pages spec passed twice.
- **Page limits:** 300 `/m/<id>` loads, 8 in parallel. curl → 60 with market data + 240 "Slow down a little" `noindex`. Spoofed Googlebot UA → 60 / 240 (no `VERCEL`, so no verified-bot pass).
- **Rate limits** (`hammer.py`):
  - `/api/markets` ×40 → 27 × 200 then 13 × 429 (`Retry-After: 57`);
  - `/api/flags` ×40 → 40 × 429;
  - `/api/suggest` ×250 → 120 × 200, 130 × 429;
  - spoofed `X-Forwarded-For`/`X-Real-IP` → 40 × 429;
  - `smoke-prod.sh` telemetry burst → 429.
- **Crawlers:** GPTBot, ClaudeBot, CCBot, PerplexityBot, Google-Extended, Bytespider → 403 on `/` and `/api/*`. HeadlessChrome, python-requests, curl → 200 (BotID runs only on Vercel; owner verification).
- **Headers** (`curl -I /`):
  - HSTS `max-age=63072000; includeSubDomains`;
  - `nosniff`;
  - `Referrer-Policy: strict-origin-when-cross-origin`;
  - `X-Frame-Options: DENY`;
  - `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()`;
  - CSP with a per-request nonce and `strict-dynamic`.
  - `e2e/headers.spec.ts` passed twice.
- **Hidden routes:**
  - `/admin`, `/admin/users`, `/api/admin`, `/api/admin/export`, `/e2e-mock/*`, `/api/data` → 404;
  - `/api/admin` POST/PUT/PATCH/DELETE → 404;
  - POST `/api/settle/run` and `/api/alerts/run` → 401.
- **Webhooks:** forged, stale and altered → 400; replay → duplicate (item 9).
- **Another user's rows:** `test/rls.test.ts` (part of `pnpm test`, rerun verbose) passed 17/17. Among them: "user B sees none of user A's rows", "every public table: B can't read, change or delete A's rows, or insert as A; anon sees nothing", "users can't write their own tier", and "security definer functions pin search_path". A live check with the anon key stays under owner verification.
- **Dependencies:**
  - `apps/web` `pnpm audit --prod`: no known vulnerabilities. Full `pnpm audit`: 1 moderate (`minimatch`, dev tooling).
  - `apps/extension`: none.
  - `pip-audit -r requirements.txt`: none.
- **Secrets in history** (`secrets_scan.py` over `git log <every valid ref> -p`): 321 commits, 25 hits = run 8's 24 known fakes + 1 in `c387baa` (run 8's report quoting the fake `sk_test_FAKEFAKEFAKEFAKE`). The 14 product commits since run 8: 0 hits.
- **Client bundles:**
  - `pnpm check:bundle`: "128 files in .next/static, no secrets".
  - grep for `SUPABASE_SERVICE_ROLE|STRIPE_SECRET_KEY|sk_live_|sk_test_|whsec_|UPSTASH_REDIS_REST_TOKEN|CRON_SECRET|EXT_SIGNING_SECRET|UNSUBSCRIBE_SECRET|service_role|RESEND_API_KEY|checkBotId`: 0 files.
- **Cookies:** no `Set-Cookie` on `/` in the prod build. Auth cookie flags stay under owner verification.

## 7. Multipliers and combos: PASS

- `test/multipliers.test.ts` passed, including "the 10x bet with a 14% chance shows in tier edge" (fixture `9900010`). `e2e/multipliers.spec.ts` passed twice.
- No live flag has ask ≤ 10¢, chance ≥ 14% and edge ≥ 4 pts in either scan, so the docs/18 example is proven by the fixture only. Nearest live rows: `6841253` (6¢, 10.8%, +4.5 pts, `best`) and `6771197` (3.1¢, 8.2%, +4.9 pts, `edge`).
- **Combos** (`lib/combos.test.ts`, `lib/kalshiCombo.test.ts`, rerun verbose, 8/8):
  - "two independent legs" and "three legs: bigger return, lower chance" match hand-computed cases;
  - "warns on same-event legs"; the Kalshi check "refuses same-event legs";
  - suggested combos for a leg count whose combo backtest lost money are hidden (`lib/data/combos.ts:43`, asserted in `test/multipliers.test.ts:36`).
- Tier split: committed 1,070 best / 1,708 edge; fresh 916 / 891.
- **Raw-count sweep:**
  - The diff since run 8 adds no count display.
  - A grep for `{….length|count|total|unread}` / `toLocaleString()` in `app`, `components` and `apps/extension/src` without `formatCount` finds bounded counts only: combo legs, dashboard panels, event-group flagged, inbox, chosen topics, the banner counter, `colSpan`, a chart aria-label, a date. The trade ticket uses `toLocaleString("en-US")` for an exact contract count (documented exception).
  - The large counts use `formatCount` or `<Count>` (`MarketsScreener.tsx:71`, `BestBets.tsx:192`, `panels.tsx:98`).

## 8. Trading safety: PASS

- 5350: trading off without `KALSHI_TRADING_ENV` (item 2).
- `git diff 88a24a6 HEAD -- apps/extension/src apps/web/lib/trade apps/web/components/trade` covers the rename, removed unused exports (`DASH`, `DISCLAIMER`, `norm`, `labels`, `StakeRow`), `__KISMET_ORIGIN__` and the badge literal. No change to order placement, confirmation, caps or key handling.
- Tests passed:
  - `no-auto-trade.test.ts` (extension, 42/42);
  - `e2e/trading-paper.spec.ts` twice.
- Zip manifest:
  - `permissions` are `storage`, `sidePanel`;
  - host permissions are `https://kismetodds.com/*` and `https://external-api.demo.kalshi.co/*`;
  - `externally_connectable` is `https://kismetodds.com/*` only.

## 9. Billing: **FAIL**

- `webhook.mjs` (mock, user `webhook-audit10@example.com`):
  - unsigned → 400; wrong secret, 1 h old and altered → 400 "Bad signature";
  - raw unsigned `client_reference_id` → ignored; subscription with no linked user → 500 "Retry";
  - signed `client_reference_id` (Payment Link path) → linked; `subscription.created` premium → premium;
  - replay → `duplicate:true`;
  - portal cancel (`cancel_at_period_end`) → still premium; `subscription.deleted` → free; replayed deletion → duplicate.
  - Its last "older event" step ends on premium because `sub_link` is not in the mock Stripe store (fallback to the event). This is a mock artefact, as in run 8.
- S7 (checkout → tier up) and account delete with a live subscription passed in both paid runs.
- Prices: `ops/stripe-setup.mjs --domain kismetodds.com` dry run → $11.99/month, $99.99/year, $19.99/month, $169.99/year, lookup keys `kismet_*`, products "Kismet Pro" and "Kismet Premium". `trial_period_days: 7` per run 9.
- **T-247, run 8's repros now hold:**
  - `wh8.mjs` (two live subscriptions): late A events and A ending while B is active → stays **premium**, steps 5–7.
  - `wh8b.mjs` (cancel → resubscribe → retry of an old A subscription event) → **premium**.
- **New gap (`wh10.mjs`), fail 1:**
  1. Checkout Pro → sub A.
  2. A canceled → free.
  3. Checkout Premium → sub B → premium.
  4. Late `customer.subscription.updated` for A → premium (holds).
  5. Stripe retries the earlier `checkout.session.completed` for A: signed `client_reference_id`, `subscription: A`, created 2 h ago, new event id → `/api/me` **`free`**, and the `subscriptions` row becomes `sub A, canceled`, while B is active and paying.
  6. Only the next B event restores premium.

## 10. Legal and wording: PASS

- `/terms`, `/privacy`, `/refunds`, `/disclaimer`, `/contact`, `/status` → 200, linked from the footer.
- Each legal page, fetched as HTML on the prod build:
  - `[[`: 0;
  - "draft": 0;
  - "Last updated November 18, 2026";
  - "Kiumars Momtaz and Marc Yamin" on all five.
- `/terms`:
  - "individuals (sole proprietors), in the United States";
  - "18 or older";
  - "governed by the laws of the State of Indiana, United States";
  - Pro $11.99/mo or $99.99/yr, Premium $19.99/mo or $169.99/yr;
  - 7-day free trial; cancel any time and keep the plan to the end of the period paid for;
  - `kismetodds@gmail.com`.
- `/refunds`:
  - "7-day free trial: cancel during it and you aren't charged";
  - "If you ask within 7 days of your first paid charge, we refund it in full. Renewal charges are not refunded; cancelling stops future renewals, and you keep your plan until the period you paid for ends";
  - reply within 2 business days. Consistent with `/terms`.
- `/contact`: email and response time. **No "Mailing address" section** (`app/contact/page.tsx:16` renders it only when set; `mailing_address` is "").
- The crawler found 0 `[[`, 0 "draft" and 0 old name on all 330 views.
- Footer disclaimer "Market analytics, not financial advice. Based on past results. 18+." on all 330 views and in the extension popup. The OG image also carries it.
- `/disclaimer`: 1-800-GAMBLER and NCPG resources.
- 18+ gate: every seeded user ticked the box (`seed.mjs`); keyless build → "Accounts are not set up yet".
- **Emails** (alert, admin sign-in link, payment failed; rendered from `lib/email/templates.ts`, `audit10-email-*-600.png`):
  - each has "Unsubscribe" and the disclaimer;
  - 0 `[[`, 0 profit/guarantee wording;
  - subjects "Alert: …", "Your Kismet sign-in link", "Your Kismet payment didn't go through".
- Banned words (`grep -rniE "\b(picks?|locks?|guaranteed?|sure thing|can.?t lose|risk.?free|expected profit)\b"` over `app`, `components`, `lib`, `apps/extension/src`, `config`): only comments, identifiers (`Pick<…>`, `pick`), a test that asserts their absence, and the negation "We give no guarantee" on `/terms`.
- Meta, OG and Twitter descriptions are facts only ("Contracts priced below how often similar bets have won, after fees and the spread."). OG alt: "Kismet: Less luck, more math. …".

## 11. Publication readiness: **FAIL** (doc step)

- `robots.txt`: 30+ AI user agents `Disallow: /`; everyone else `Allow: /` with `/api/`, `/auth/`, `/login`, `/onboarding`, `/account`, `/settings`, `/watchlist`, `/journal`, `/alerts`, `/dashboards`, `/admin` disallowed; `Sitemap:` line. `sitemap.xml`: 12 `<loc>`.
- No test users, seed data or debug routes in prod (item 6). Styled 404 and error pages.
- Icons: `/icon.svg`, `/apple-icon.png`, `/opengraph-image`, `/twitter-image` → 200. `/favicon.ico` → 404 (browsers use `<link rel="icon" href="/icon.svg">`; same as before).
- **`ops/smoke-prod.sh`**: `SMOKE_EXPECT_HEALTH=503 ops/smoke-prod.sh http://localhost:5350` → **18 passed, 0 failed**.
- **Ops dry runs** (`env -i PATH HOME`). `config/site.json` md5 unchanged (`26ba0be4…`); no tracked file changed.
  - `secrets.mjs` plan, exit 0.
  - `site-config.mjs --from config/site.json` "no changes", exit 0. It notes the empty `mailing_address` (CAN-SPAM, marketing mail only).
  - `stripe-setup.mjs` plan, exit 0.
  - `preflight.mjs` 17 blockers / 6 warnings, exit 1 by design (no keys).
  - `supabase-setup.sh` plan, exit 0.
  - `vercel-env.mjs` refuses without an env file (exit 2). With a test file it pushes only documented keys, sensitive and masked; `E2E_MOCK` is not pushed.
  - `checks.py` ok.
  - `upload.py` without credentials exit 1.
  - `scheduler.plan` → `bootstrap, update, fit, grade, scan`.
- **Extension**:
  - `KISMET_ORIGIN=https://kismetodds.com pnpm ext:zip` (run in `apps/extension`) → `kismet-extension-0.1.0.zip`, 23,154 bytes (moved out of the worktree).
  - MV3, name "Kismet for Polymarket", CSP `script-src 'self'; object-src 'self'`, 0 `eval(`/`new Function`.
  - Loaded unpacked in a clean Chromium profile: service worker registered. Popup: "Kismet · Signed out · Can't reach kismetodds.com · Paper trading Off · … Market analytics, not financial advice. Based on past results. 18+." (`audit10-ext-popup.png`). The only console error is the connection to the not-yet-deployed domain.
- **`SETUP.md` §0 from a fresh clone** (`git clone --branch audit10` → `a10/clone`), reaching a running app:
  - `pip install -r requirements.txt` exit 0;
  - `pytest -q` 45 passed;
  - `python3 -m engine scan` → 18,075 markets, 1,806 flags, `markets-prev.json` kept;
  - `cd apps/web && pnpm i --frozen-lockfile` exit 0;
  - `pnpm dev -p 5340` → `/`, `/markets`, `/pricing`, `/account` 200, `/api/me` `{"tier":"premium","demo":true}`, 0 errors in the log.
- **`ops/ship.md` (T-254), fail 2:** step 15 says `KISMET_ORIGIN=https://kismetodds.com pnpm ext:zip`, and the header says "Run them from the repo root". From the repo root this prints `× Command "ext:zip" not found`: there is no root `package.json`, and the script is in `apps/extension/package.json:10`. Step 1 also installs only `apps/web`, so `apps/extension` has no `node_modules` on a fresh machine.

## Fails to fix

1. **A late retry of an old `checkout.session.completed` rolls a paying user back to Free.** Severity: medium. It needs cancel → resubscribe plus a delayed or retried delivery of the first checkout's event; the user loses access until B's next event.
   - Where: `apps/web/lib/billing/stripe.ts:162`. The `checkout.session.completed` branch calls `applySubscription(db, await stripe.subscriptions.retrieve(subId), userId)`. That writes the session's own subscription (now canceled), bypassing `currentSubscription()` (`:134`), which T-247 added for the `customer.subscription.*` events only (`:165-168`). `lib/billing/db.ts` `upsertSubscription` keeps one row per user (`onConflict: "user_id"`).
   - Repro (`E2E_MOCK=1` dev server, `a10/wh10.mjs`):
     1. Checkout Pro → sub A.
     2. Cancel A, deliver A.deleted → free.
     3. Checkout Premium → sub B → premium.
     4. Deliver a signed `checkout.session.completed` `{client_reference_id: <valid signed ref>, customer: <A's customer>, subscription: A}` with a new event id, created 2 h ago → `/api/me` `free`, row `sub A, canceled`. The new id stands for a first delivery that returned non-2xx, so it was never recorded in the dedup table. Stripe retries exactly those deliveries for up to 3 days. Meanwhile the user still got Pro from the companion `customer.subscription.created`, so nothing looked wrong.
   - Suggested fix: in the checkout branch, after `linkCustomer`, apply `await currentSubscription(stripe, await stripe.subscriptions.retrieve(subId))` instead of the retrieved subscription. Add a `stripe.test.ts` case: user on B (premium, active), late checkout event for canceled A → stays premium.

2. **`ops/ship.md` step 15 fails as written.** Severity: low (docs; the owner runs this verbatim at launch).
   - Where: `ops/ship.md:43` (step 15). The same command without a directory is at `SETUP.md:110` (§3, step 5) and `LAUNCH_TODO.md:25` (#9). The script lives in `apps/extension/package.json:10`. `ops/ship.md` step 1 (`:8-9`) installs only `apps/web`.
   - Repro: from the repo root, `KISMET_ORIGIN=https://kismetodds.com pnpm ext:zip` → `× Command "ext:zip" not found`.
   - Suggested fix: write `cd apps/extension && pnpm i --frozen-lockfile && KISMET_ORIGIN=https://kismetodds.com pnpm ext:zip && cd ../..` in all three places (or add `apps/extension` to step 1's install).

## Notes

- The home page `<title>` and `og:title` are "Best bets", without "· Kismet". `app/page.tsx:5` sets a plain title, and the root layout's `%s · Kismet` template does not apply to the root page. Every other page has "· Kismet". Suggest `title: { absolute: "Best bets · Kismet" }`.
- `config/site.json` `mailing_address` is empty by owner decision and hidden on `/contact`. `ops/site-config.mjs`/`preflight.mjs` warn it is required before any *marketing* email (CAN-SPAM). Today's mails are user-requested alerts and account mail.
- `vercel.json` schedules `/api/alerts/run` every 5 minutes. That needs Vercel Pro, which `ops/ship.md` step 2 says the team will have.
- `git log --all` fails in this worktree because of the broken ref `refs/remotes/origin/final 2`, an iCloud duplicate (`.git/refs/remotes/origin/final 2`). It is harmless for the app but breaks `--all` tooling, e.g. a gitleaks run on the owner's machine. Deleting that duplicate ref is the owner's call.
- No live flag matches the docs/18 "10x, 14%, +4 pts" example in either scan; the fixture test covers it.
- Owner verification (live Supabase RLS and cookies, Stripe test mode end to end, Upstash, Vercel BotID and verified search bots, Kalshi demo order, Chrome Web Store, scan cadence) is unchanged from run 8. Add: after fix 1, cancel → resubscribe in Stripe test mode, then "Resend" the first checkout's `checkout.session.completed` and confirm the plan stays.

# Audit run 11 (scoped: run 10 fails, changes since, full suites, CI)

Auditor: a fresh agent that built none of this code. It checked and fixed nothing.
Target: `c65166e` ("T-262: home page title …"), worktree `audit11`. Date: 2026-11-19, 01:55–02:12 local.
Scope: item 9 (Billing) and item 11 (Publication readiness) of `docs/OVERNIGHT.md` §3, re-run in full with run 10's
method; the 4 commits since run 10 (T-259 to T-262); all test suites; CI.

How it ran:
- Ports 5410–5450 only. Every server was stopped at the end: no listener on 5400–5499.
- Scratch dir `a11/`: run 10's helpers copied with paths and ports rewritten (`seed.mjs`, `webhook.mjs`, `wh8.mjs`,
  `wh8b.mjs`, `wh10.mjs`, `mock.sh`, `prod.sh`, `extload.mjs`).
  - `a11/prod/` (`git archive`): Python 3.13.1 venv, production `pnpm build` with no `DEMO_MODE`, no `.env*` except
    `.env.example`, no Supabase/Stripe/Upstash/Kalshi variable (`BUILD_EXIT=0`). Served by `next start -p 5450`.
  - `a11/mock/` (`git archive`): `E2E_MOCK=1` dev server on 5430 with the paid-config env.
  - `a11/clone-ship`, `a11/clone-setup`, `a11/clone-launch`: three fresh `git clone --branch audit11`.
- The `* 2*` files were not touched. Only `AUDIT.md` changed in the worktree (this section, uncommitted).

## Summary

| # | Check | Result |
|---|---|---|
| 1 | Item 9 Billing (run 10 fail 1, wh8/wh8b, webhook suite, T-260 review) | PASS |
| 2 | Item 11 Publication readiness (run 10 fail 2, ship/SETUP/LAUNCH_TODO zip steps, fresh clone) | PASS |
| 3 | Home title "Best bets · Kismet"; other pages keep "%s · Kismet" | PASS |
| 4 | Full suites (lint, typecheck, unit, build, demo e2e, paid e2e, extension, ops, pytest) | PASS (no flake) |
| 5 | CI on `c65166e` (web, python, supply-chain) | PASS |

Zero fails. Both run 10 fails are fixed.

## 1. Item 9 Billing: PASS

- **Run 10 fail 1** (`node a11/wh10.mjs http://localhost:5430 a11/states/wh10.json`, user `wh10-audit11@example.com`):
  ```
  1. Checkout Pro (sub A)                                    | /api/me tier pro     | row pro trialing sub_4062cff3
  2. A ended (expect free)                                   | /api/me tier free    | row free canceled sub_4062cff3
  3. Checkout Premium (sub B)                                | /api/me tier premium | row premium active sub_3d91f8e4
  4. late retry of an old A event after B exists            | /api/me tier premium | row premium active sub_3d91f8e4
  5. late retry of the old checkout.session.completed       | /api/me tier premium | row premium active sub_3d91f8e4
  6. after a later B event                                   | /api/me tier premium | row premium active sub_3d91f8e4
  ```
  Step 5 was `free` / `sub A, canceled` in run 10. It now stays on premium with sub B.
- **Run 8 repros**: `wh8.mjs` steps 2–7 end pro, pro, premium, premium, premium, premium (as expected at each step).
  `wh8b.mjs` step 4 → premium, row `sub B active`.
- **`webhook.mjs`**:
  - unsigned → 400; wrong secret, 1 h old and altered body → 400 "Bad signature";
  - raw unsigned `client_reference_id` → ignored (free); subscription with no linked user → 500 "Retry";
  - signed `client_reference_id` (Payment Link path) → linked; `subscription.created` premium → premium;
  - replay → `duplicate:true`;
  - portal cancel (`cancel_at_period_end`) → still premium; `subscription.deleted` → free; replayed deletion → duplicate.
  - The last "older event" step ends on premium because `sub_link` is not in the mock Stripe store. This is the same
    mock artefact as in runs 8 and 10.
- **Prices** (`node ops/stripe-setup.mjs --domain kismetodds.com`, dry run): $11.99/month, $99.99/year, $19.99/month,
  $169.99/year, lookup keys `kismet_pro_monthly`, `kismet_pro_yearly`, `kismet_premium_monthly`,
  `kismet_premium_yearly`. No pricing file changed since run 10.
- **Paid e2e**: "S7 sign up → upgrade with Stripe → Pro unlocks …" and "account delete: type the email, everything
  goes, signed out" passed (both paid runs below).
- **T-260 diff review** (`git show d445111`): `apps/web/lib/billing/stripe.ts:163` now wraps the retrieved
  subscription in `currentSubscription()`. The new unit test is in `stripe.test.ts:189-199`.
  - Regression cases, run as a throwaway vitest file in `a11/mock` (deleted afterwards, worktree untouched),
    7/7 passed together with the 13 existing `stripe.test.ts` tests:
    - first-ever checkout, Stripe lists the new sub → pro, sub id set, customer linked;
    - first-ever checkout in trial (trialing premium) → premium;
    - Stripe lists nothing (`data: []`) → falls back to the retrieved sub → pro;
    - `subscriptions.list` throws → 500, event not marked seen; the retry → pro;
    - first payment `incomplete` → free;
    - checkout without a subscription id → only links the customer;
    - upgrade with Pro A still active and Premium B checkout → premium B.
  - Also live on the mock: `wh10.mjs` step 1 (first-ever checkout) → pro, and S7.
  - The re-link guard (`stripe.ts:153-156`) runs before the new code, so `currentSubscription` only lists the
    customer just linked to this user. No regression found.

## 2. Item 11 Publication readiness: PASS

- **Run 10 fail 2.** In three fresh clones with no `node_modules` in `apps/extension`, each doc's command ran from the
  repo root as written (`<domain>` = `kismetodds.com`):
  - `ops/ship.md:43` step 15: `cd apps/extension && pnpm i --frozen-lockfile && KISMET_ORIGIN=https://kismetodds.com pnpm ext:zip` → exit 0, `[ext:zip] wrote apps/extension/kismet-extension-0.1.0.zip`, 23,154 bytes.
  - `SETUP.md:110` (§3 step 5): same command → exit 0, same zip, 23,154 bytes.
  - `LAUNCH_TODO.md:25` (#9): same command → exit 0, same zip, 23,154 bytes.
- **Zip** (`clone-ship`):
  - MV3, "Kismet for Polymarket", `permissions` `storage`, `sidePanel`;
  - host permissions `https://kismetodds.com/*`, `https://external-api.demo.kalshi.co/*`;
  - `externally_connectable` `https://kismetodds.com/*`; CSP `script-src 'self'; object-src 'self'`;
  - no dev `key`; 0 `eval(` / `new Function`; 0 `localhost`.
  - Loaded unpacked in a clean Chromium profile (`a11/extload.mjs`): service worker `background.js` registered.
    Popup: "Kismet · Signed out · Can't reach kismetodds.com · Paper trading Off … Market analytics, not financial
    advice. Based on past results. 18+." (`a11/audit11-ext-popup.png`). Only console error:
    `net::ERR_CONNECTION_CLOSED` (domain not deployed yet).
- **`ops/ship.md`**: still one numbered list, steps 1–15, ~45 lines. It names team `kismet9`, project `kismet`,
  Root Directory `apps/web`, `kismetodds.com`. That matches `apps/web/vercel.json`: `nextjs`,
  `pnpm install --frozen-lockfile`, `pnpm build`, region `iad1`, crons `/api/alerts/run` `*/5 * * * *` and
  `/api/settle/run` `30 7 * * *`.
- **`SETUP.md` §0 from a fresh clone** (`clone-setup`):
  - `pip install -r requirements.txt` exit 0;
  - `python3 -m pytest -q engine/tests ops/tests` 45 passed;
  - `python3 -m engine scan` exit 0, 18,707 markets, 1,877 flags, `markets-prev.json` and `flags-prev.json` kept;
  - `cd apps/web && pnpm i --frozen-lockfile` exit 0;
  - `pnpm dev -p 5440` → `/`, `/markets`, `/pricing`, `/account` 200, `/api/me` `{"tier":"premium","demo":true,…}`,
    0 errors in the log.
- **Prod build** (5450):
  - `SMOKE_EXPECT_HEALTH=503 ops/smoke-prod.sh http://localhost:5450` → **18 passed, 0 failed**.
  - `robots.txt` 200: 38 `User-Agent` lines (AI bots `Disallow: /`), `Disallow: /admin`, `Sitemap:` line.
    `sitemap.xml` 200, 12 `<loc>`.
  - `/icon.svg`, `/apple-icon.png`, `/opengraph-image`, `/twitter-image` → 200. `/favicon.ico` → 404 (same as before).
  - `/admin`, `/e2e-mock/supabase/_inbox`, `/api/data` → 404. `/no-such` → styled 404, h1 "This page doesn't exist",
    title "Page not found · Kismet".
- **Ops dry runs** (`env -i PATH HOME`, worktree): `config/site.json` md5 `26ba0be4…` before and after; no tracked file
  changed.
  - `secrets.mjs` plan, exit 0.
  - `site-config.mjs --from config/site.json` "no changes", exit 0, with the `mailing_address` note.
  - `stripe-setup.mjs --domain kismetodds.com` plan, exit 0.
  - `preflight.mjs` 17 blockers / 6 warnings, exit 1 by design (no keys).
  - `supabase-setup.sh` checklist, exit 0.
  - `vercel-env.mjs` refuses with no env file, exit 2.
  - `checks.py` "data checks ok".
  - `upload.py` exit 1 without credentials.
- Email templates: no change since run 10 (`git diff --stat 772ac10 HEAD` touches only the 7 files of T-259–T-262).
  Their unit tests pass in `pnpm test`.

## 3. Home title: PASS

Production build on 5450, `curl` of the HTML:

| Page | `<title>` | `og:title` |
|---|---|---|
| `/` | Best bets · Kismet | Best bets · Kismet (`twitter:title` same) |
| `/markets` | All markets · Kismet | All markets · Kismet |
| `/pricing` | Pricing · Kismet | Pricing · Kismet |
| `/about` | How it works · Kismet | How it works · Kismet |
| `/terms` | Terms of use · Kismet | Terms of use · Kismet |
| `/track-record` | Results · Kismet | Results · Kismet |
| `/tools` | Tools · Kismet | Tools · Kismet |
| `/m/6841253` | Will RC Celta de Vigo win on 2026-11-21? · Kismet | — |
| `/no-such` | Page not found · Kismet | — |

No doubled suffix. The diff is `app/page.tsx:5`, `title: { absolute: "Best bets · Kismet" }`.

## 4. Full suites: PASS

All in the worktree `audit11` after `pnpm i --frozen-lockfile` (web and extension, exit 0) and
`find .next -name "* 2*" -delete`. Logs are in `a11/logs/`.

| Suite | Command | Result |
|---|---|---|
| Web lint | `pnpm lint` | exit 0 |
| Web typecheck | `pnpm typecheck` | exit 0 |
| Web unit | `pnpm test` | **62 files, 390 tests passed** (run 10: 389; +1 is T-260's test), plus node ops tests 27 pass / 0 fail |
| Web build | `pnpm build` (production, `a11/prod`) | exit 0 |
| Demo + paid e2e | `PW_PORT=5410 pnpm e2e` | **52 passed** (1.1 m), then **6 passed** (1.4 m) |
| Paid e2e | `PW_PORT=5411 pnpm exec playwright test -c playwright.paid.config.ts` | **6 passed** (1.3 m); 0 `SyntaxError`/`TypeError`/`⨯` in the log |
| Extension | `pnpm i --frozen-lockfile && pnpm test && pnpm build` | exit 0, **6 files, 42 tests passed**, both vite builds OK |
| Ops | `node --test ops/tests` | 27 tests, 27 pass, 0 fail |
| Python | `pytest -q` (venv, Python 3.13.1) | **45 passed** |

No failure, retry or flake. Note: `pnpm e2e` runs both configs (`package.json:13`), so the paid suite ran twice.

## 5. CI: PASS

`gh pr checks 2`: PR 2 head is `final` at `c65166ea3a52…` (= `origin/final`).

| Run | Event | web | python | supply-chain |
|---|---|---|---|---|
| 44475670108 | push | pass (10m51s) | pass (17s) | pass (29s) |
| 44475677439 | pull_request | pass (8m19s) | pass (24s) | pass (38s) |

Both runs: `headSha c65166e…`, workflow `web-ci`, conclusion `success`. The web job includes T-259's
`pnpm i --frozen-lockfile` in `apps/extension` before e2e.

## Notes (not fails)

- `ops/ship.md:43` step 15 does not end with `&& cd ../..`, unlike steps 1, 8, 9 and 14. If the owner runs the second
  half of step 15 ("`node ops/vercel-env.mjs --yes`") in the same shell, it runs from `apps/extension` and fails
  with "module not found". The header says "Run them from the repo root". Suggest appending `&& cd ../..`.
- `docs/setup-notes/trading-extension.md:54` (§5, linked from `SETUP.md:110`) gives the command without `pnpm i`.
  Tested in a fourth fresh clone (`a11/clone-te`): it still exits 0 and writes the zip, because pnpm installs the
  missing deps itself before running the script (log: "Packages: +43"). No change needed.
- The `webhook.mjs` "older event" mock artefact is unchanged (see run 10).
- Run 10's report is not in this file: this `AUDIT.md` ends at run 9 before this section. Run 10's report is in the
  `audit10` scratch worktree only. The owner checks listed there still apply. Add: in Stripe test mode, cancel and resubscribe. Then "Resend" the first
  checkout's `checkout.session.completed`. The plan must stay on the new subscription.
