# Audit: OVERNIGHT §3, run 2

Final audit of Kismet, run 2 of this series.

- **Auditor:** a fresh agent that built none of this code. It changed no product code; it only checked and reported.
- **Target:** `origin/final` at `cb2f21e` ("T-284: audit run 1 fixes"), checked out as branch `agent/audit2`.
- **Date:** 2026-11-20.
- **Spec:** `docs/OVERNIGHT.md` §3, items 1–11. Also used: `docs/README.md`, `docs/12-test-plan.md`, `docs/15-security.md`, `docs/01-product.md` (Compliance), `CLAUDE.md`.

**Verdicts:**
- **PASS:** checked and met.
- **FAIL:** not met. Each one gives the file and line.
- **BLOCKED:** needs something this environment cannot provide (a live Supabase, Stripe, Vercel or Upstash account, or network access to Polymarket). Each one says what would unblock it.

When in-repo mocks or unit tests cover a check and only the live part is blocked, the check is PASS for what was tested and BLOCKED for the live remainder. Both parts are listed.

## Setup

**Clean clone.** `$S/clean2` is a `git clone` at `cb2f21e`:
- a new Python venv (Python 3.13.18; CLAUDE.md says 3.12 and SETUP.md says 3.12+);
- Node v22.23.5 and pnpm 10.28.0;
- `pnpm i --frozen-lockfile`.

**Production server** on `:3161`:
- `pnpm build` and then `next start`, run under `env -i`;
- `DEMO_MODE` unset and no keys at all (env: `NODE_ENV=production DATA_SOURCE=local DATA_CLOCK=scan LIVE_REPRICE=0`);
- the data is the committed `output/`;
- the server process timezone is UTC.

**E2E mock server** on `:3160`:
- `E2E_MOCK=1 next dev`, run from the worktree;
- the in-repo Supabase and Stripe mock (`app/e2e-mock/[...path]/route.ts`) with the paid-config env (`STRIPE_WEBHOOK_SECRET=whsec_e2e`);
- `KALSHI_TRADING_ENV=demo`, `TRADING_ALLOWLIST=audit2-premium@example.com`, `ADMIN_EMAILS=audit2-admin@example.com`.

**Seeded users.** `audit2-{free,pro,premium}@example.com` were created through the mock magic link and the mock Stripe checkout (which sends signed webhooks), then saved as Playwright storage states.

**Ports and browser.** Only ports 3160 and 3161 were used. All browser checks used Playwright Chromium.

**Restarts.** The mock keeps its users in memory, and the dev server restarted at least four times:
- Most restarts were at Next's "approaching the used memory threshold", during long crawls.
- One was when a background job hit its time limit (`item3/mock-run1-restart.txt`).

Each time, I seeded the users again and re-ran the affected signed-in crawls and axe passes. Only runs whose sessions were confirmed valid are reported. "Valid" means:
- `/api/me` shows the right email and tier after the run;
- no page was redirected to `/signup`.

The Premium crawl was finally run alone on a freshly restarted mock.

**Evidence.** Everything is under `audit-evidence/`, with one folder per item. Helper scripts needed to reproduce a result are copied next to their output. `$S` is the session scratchpad, which is not committed.

## Summary

| # | Item | Verdict |
|---|------|---------|
| 1 | Tests on a clean clone | PASS |
| 2 | Production build, no keys | PASS |
| 3 | Every page × every state | **FAIL** (1) |
| 4 | Quality: Lighthouse, axe, keyboard, reduced motion, design | PASS (observations) |
| 5 | Data correctness | PASS |
| 6 | Security | **FAIL** (1); the rest PASS; live parts BLOCKED |
| 7 | Multipliers and combos | PASS |
| 8 | Trading safety | PASS |
| 9 | Billing | PASS on the mock; Stripe test mode BLOCKED |
| 10 | Legal and wording | **FAIL** (1); the rest PASS |
| 11 | Publication readiness | PASS; the engine scan and Chrome Web Store review are BLOCKED |

---

## 1. Tests: PASS

**How checked:** I ran every command on the clean clone `$S/clean2` at `cb2f21e`. Logs are in `audit-evidence/item1/`, and `summary.txt` lists every exit code.

| Check | Result | Evidence |
|---|---|---|
| `pip install -r requirements.txt` | exit 0 | `item1/pip.txt` |
| `pytest -q` | `66 passed` | `item1/pytest.txt` |
| `pnpm i --frozen-lockfile` (web) | exit 0 | `item1/pnpm_i.txt`, `item1/clean-web-install.txt` |
| `pnpm typecheck` | exit 0 | `item1/typecheck.txt` |
| `pnpm lint` (`--max-warnings 0`) | exit 0, no warnings | `item1/lint.txt` |
| `pnpm test` | vitest `Test Files 79 passed (79)`, `Tests 509 passed (509)`, plus the ops node tests 27/27 | `item1/unit.txt` |
| Extension: `pnpm i --frozen-lockfile`, typecheck, test | exit 0; 42 tests passed | `item1/ext_i.txt`, `item1/ext_tc.txt`, `item1/ext_test.txt` |
| `pnpm e2e` (demo config) | `56 passed (1.7m)` | `item1/e2e_demo.txt` |
| `pnpm e2e`, paid config (`PW_PORT=3160`) | `10 passed (3.8m)` | `item1/e2e_paid.txt` |
| Earlier full `pnpm e2e` run (both configs) | `56 passed`, `10 passed`, `EXIT 0` | `item1/e2e.txt` |

**What the demo e2e covers:**
- S1 to S6: `s1-landing`, `s2-filters`, `s3-drawer`, `s4-presets`, `s5-mylist`, `s6`, `s6-tools`;
- S8, alerts: `alerts.spec.ts`;
- search (7 tests), trading-paper, headers and multipliers;
- `a11y.spec.ts`: axe on 24 pages, plus the drawer focus trap and Escape.

**What the paid e2e covers:**
- S7, sign up, upgrade through the Stripe mock, Pro unlocks: `e2e-paid/s7-upgrade.spec.ts`;
- account delete;
- the keyboard-only path search → drawer → save → upgrade;
- password (2 tests), paywall pages (3 tests) and admin (2 tests).

`admin.spec.ts:69` and `:124`, which failed in an earlier series, now pass. A grep for `.skip`, `.only` and `.fixme` in the e2e and test folders found nothing.

## 2. Production build, DEMO_MODE off, empty keys: PASS

**How checked:**
- The build ran under `env -i`. The only environment variables were HOME, PATH, PWD, SHLVL, NODE_ENV, the proxy variables and NODE_EXTRA_CA_CERTS.
- There are no `.env*` files except `.env.example`.
- `pnpm build` exited 0. The only warnings were webpack cache-string warnings (`item1/prod-build.txt`).
- The build was served with `next start` on `:3161`, and every page was crawled (item 3).

**Results:**
- `/pricing` shows "Start free" and two "Coming soon" buttons where the paid plans would be. There is no demo or dev banner (`item2/prod-pricing-1440.jpg`).
- `/account` says "Sign-in isn't available yet…".
- The Free tier works: delayed and capped data is served (item 5).
- No crashes, and no 5xx on any page.

**Observation (not a fail):** `/api/health` answers `503 {"ok":false}`. This is by design: `lib/health.ts:31-33` marks a production deploy without Upstash as degraded (`rlDown`). It turns green once `UPSTASH_*` is set.

## 3. Every page × every state: FAIL (1)

**How checked:** `item3/crawl.cjs`, a Playwright crawler, ran at 390×844 and at 1440×900, with CDP throttling (40 ms latency, 1.25 MB/s down). For each page it records:
- console errors and warnings, page errors and failed requests;
- `NaN`, `undefined`, `null`, `[object Object]`, lorem, TODO and FIXME in the visible text;
- banned words;
- whether the footer has the disclaimer;
- horizontal scroll.

It collects every internal `<a href>` and fetches each one. The pages are 36 static routes plus a market page, an event page, an unknown dashboard id and `/no-such-page`. `item3/summ.py` prints the summaries.

| State | Server | Page loads | Links checked | Broken | Evidence |
|---|---|---|---|---|---|
| Logged out | production | 76 | 51 + 42 | 0 | `item3/crawl-prod-anon-summary.txt` |
| Logged out | mock (auth on) | 74 | 40 | 0 | `item3/crawl-mock-anon-summary.txt` |
| Free | mock | 76 | 74 | 0 | `item3/crawl-mock-free-summary.txt` |
| Pro | mock | 76 | 274 | 0 | `item3/crawl-mock-pro-summary.txt` |
| Premium (app routes) | mock (fresh restart) | 46 | 270 | 0 | `item3/crawl-mock-premium-summary.txt` |

**Notes on the Premium run:**
- **Earlier attempts don't count.** Two earlier Premium crawls lost their session partway through when the dev mock restarted (Next's "approaching the used memory threshold"), and are not reported.
- **The reported run:** I stopped and restarted the mock to get a fresh heap, then seeded the users again and crawled Premium on its own.
- **Session checks:** `/api/me` showed `audit2-premium@example.com` / `premium` before and after the run. No page redirected to `/signup`, and the server log shows 0 restarts during the run (the end of the evidence file).
- **Results:** the only non-ok rows are the by-design 404s (`/admin`, `/combos`, `/kalshi`, `/no-such-page`), the `/m/*` `/api/book` 502 (Polymarket is blocked), and the benign "pick" on `/track-record`.

**Results in every state:**
- The disclaimer is in the footer of every page.
- There is no `NaN`, `undefined`, `null`, `[object Object]` or lorem in the visible text.
- There is no horizontal scroll at 390 px.
- The only console errors that are not the hydration error below are expected:
  - 404s by design: `/admin*` for non-admins, `/no-such-page`, and `/combos` and `/kalshi` for everyone who isn't a beta tester, Premium included. Both are on the beta list (`lib/beta-list.ts`, `BETA_FEATURES = ["combos", "kalshi"]`), so only admins or users with a live comp grant can see them (`lib/beta.ts:18` `canBeta`; `app/combos/page.tsx:14`, `app/kalshi/page.tsx:14`). This is by design, but my crawls never rendered either page signed in, because I had no admin or comp-grant state. Where they were rendered: the demo e2e (`e2e/multipliers.spec.ts:79` and axe in `e2e/a11y.spec.ts:8`, since demo mode gives everyone `beta: true`) and the admin e2e (`e2e-paid/admin.spec.ts:76`), all passing in item 1. The `/combos` row in the Premium axe pass is the 404 page.
  - `/m/*` calls to `/api/book` return 502. This is an environment block: the proxy refuses `clob.polymarket.com` with `403 CONNECT`. The page handles it and shows "The live order book didn't answer".
- The banned-word hits are benign:
  - `/terms`: "We give no guarantee that any estimate is right".
  - `/track-record`: the verb "pick" in "when you pick a payout".

**Static checks:** a grep over `apps/web/{app,components,lib}` and `apps/extension/src` found:
- no `TODO` or `FIXME` in shipped code;
- no `console.log` outside tests (the only hit is `lib/execution.test.ts`);
- no lorem ipsum.

**Dev-only noise (not counted):**
- `[Fast Refresh] performing full reload` warnings.
- In the first mock run, one `TypeError: __webpack_modules__[moduleId] is not a function` and a 500 on `/about`. This is a dev-compiler race that happened while two crawlers compiled routes at the same time (`item3/mock-run1-restart.txt`). `/about` is 200 everywhere else, including on the production build.

### FAIL 3-a: React hydration error #418 on `/`, `/bets` and `/m/:id` for any visitor whose timezone isn't the server's

**What happens:** bet cards are client components that are rendered on the server. They print the game time with `toLocaleString` and no `timeZone`, so the server (UTC) and the browser format different times. React throws #418, discards the server HTML for that tree and renders it again on the client.

**Where:**
- `apps/web/lib/format.ts:201-207` `gameTime()`: `d.toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" })`, with no `timeZone`;
- called during SSR from `apps/web/components/market/BetCard.tsx:62`, which is used on the landing teaser, `/bets` and the "Other markets" list on `/m/:id`;
- also called from `components/market/MarketCard.tsx:27` and `components/market/MarketDetail.tsx:145` (which also has `title={new Date(...).toLocaleString()}`).

**Evidence:** `item3/hydration.txt`, script `item3/hyd.cjs`.
- **Production build, `timezoneId: America/New_York`:**
  - `/bets` logs `Minified React error #418; visit https://react.dev/errors/418?args[]=text&args[]=`;
  - `/m/6654466` and `/` log #418 as well;
  - `/markets` is clean.
- **Production build, default timezone (UTC, the same as the server):** 0 errors on the same pages in 2 runs each. That is why the UTC crawl, the e2e suite and Lighthouse all missed it.
- **Dev server, full React message** (the free user's `/bets`, and the logged-out `/`):

```
Hydration failed because the server rendered text didn't match the client. ...
  <Cards slots={[...]} desktop={true} pro={false} dim={false}>
    <li className="row-span-2...">
      <BetCard r={{...}} pro={false}>
        <article ... data-market-id="6823885" data-tier="best" ...>
          <div className="-mt-1">
            <p className="mt-1 text-..." title="Closes in 41h">
+             Sat 3:30 PM
-             Sat 8:30 PM
```

**A possible second cause (unconfirmed):** `closesLine()` (`lib/format.ts:119`) and `gameTime()` (`:201`) both default `now = Date.now()`, so they read the clock during render. The UTC dev crawl as the free user hit one hydration mismatch on `/bets` at 390 px with no timezone difference (full message in `item3/hydration.txt`; the captured diff is cut off before the differing text). Four re-runs didn't reproduce it, and it wasn't checked on a production build. A render-time clock race, such as `closesLine` rounding to a different hour or minute between server render and hydration, is the likely explanation, but I didn't confirm it.

**Why it matters:**
- It breaks the item 3 rule "no console errors or warnings" for nearly every real visitor, since US users are not on UTC.
- The client re-render is expected to cost LCP and CLS on the main pages (not measured; Lighthouse ran in UTC).

**Fix:** format game times in a fixed zone, as `Teaser.tsx` and `Landing.tsx` already do with `timeZone: "America/New_York"`, or render times only after mount. Pass a `now` snapshot from the server for the relative times.

**Observation (not a fail):** with auth on, a signed-out visitor to an unknown URL (`/no-such-page`, `/dashboards/does-not-exist`) is sent to `/signup?next=…` instead of the styled 404. This comes from `middleware.ts:112` (T-276: "app pages go to sign-up"). Signed-in users and the production build with no auth get the styled 404 for unknown routes. An unknown dashboard id (`/dashboards/does-not-exist`) returns 200 with an in-app "Dashboard not found" page (`components/dashboards/Dashboards.tsx:88`). For crawlers, this is a soft 404 on mistyped URLs.

## 4. Quality: PASS (with observations)

### Lighthouse: PASS

Lighthouse 12.8.2, mobile preset with simulated throttling, on the production build, 5 runs per page. The table shows medians (`lighthouse-median.txt`).

| Page | Performance | Accessibility | Best practices | SEO |
|---|---|---|---|---|
| `/` | 92 | 98 | 100 | 91 |
| `/about` | 95 | 100 | 100 | 91 |
| `/pricing` | 95 | 100 | 100 | 91 |

All scores are at least 90.

Observations:
- SEO is 91 on all three because of the `meta-description` audit. The tag exists, but for browser user agents Next 15 streams metadata into `<body>`; crawler user agents get it in `<head>`.
- On `/`, accessibility loses points for `heading-order`, which is moderate.
- Lighthouse ran in UTC, so it didn't see the FAIL 3-a client re-render.

### axe: PASS

axe ran through `@axe-core/playwright` on new `browser.newContext()` pages, with the wcag2a/aa, wcag21a/aa and best-practice rules.
- **Production build, logged out:** 26 routes at 2 widths, 0 serious or critical (`item4/axe-prod-anon.txt`).
- **Mock server:** Free, Pro and Premium, 16 app routes at 2 widths each (32 page loads per tier): 0 serious or critical in every tier (`item4/axe-mock-{free,pro,premium}.txt`). Every session was checked as still valid after its run. The first premium pass lost its session in a mock restart and was re-run.
- **Moderate findings only:**
  - `heading-order` on `/`, `/bets`, and the "Why" section of the drawer;
  - `landmark-unique` on the `/pricing` compare region.
- The run-1 `color-contrast` serious finding on the landing "Market says" bar is fixed.

### Keyboard-only walkthrough (search → drawer → save → upgrade): PASS

- `e2e-paid/s7-upgrade.spec.ts:82` drives the whole path with the keyboard only (no `.click()`). It passed in item 1.
- `e2e/a11y.spec.ts:49` "keyboard: the drawer traps focus and Escape returns it to the opener" also passed.

### prefers-reduced-motion: PASS

**How checked:** pages were loaded with `reducedMotion: "reduce"` and with `"no-preference"`, sampling `document.getAnimations()` on every DOM change (`item4/reduced-motion.txt`).

**Results:**
- The landing pulse (2400 ms) runs only under no-preference.
- Under reduce, no animation longer than 1 ms ran on these pages:
  - production: `/`, `/about`, `/pricing`, `/track-record`, `/markets`;
  - Pro: `/bets`, `/m/:id`, `/dashboards`, `/journal`.

**How the code handles it:**
- `app/globals.css:152` has a global reduce rule.
- Recharts 3.10.1 bars default to `isAnimationActive: 'auto'`, which follows the media query.
- `Tour.tsx` uses `motion-reduce:`.
- The admin Edit scroll checks the media query.

### Screenshots against the chosen design: PASS (with observations)

**Reviewed:** `shots/` (production, logged out, at 390 and 1440: `/`, `/markets`, `/pricing`, `/m/:id` and the 404), the crawl screenshots and the email and extension renders.

**What matches:**
- dark theme, emerald accent, rounded-xl cards;
- consistent spacing and borders;
- no truncation that hides values;
- no overlap and no horizontal scroll at 390 px.

**Observations:**
- On `/m/:id`, "Price check ✓ fair fill" is shown next to "The live order book didn't answer". The check is from the last scan, but next to that sentence it reads as contradictory.
- The free-tier range for a losing side reads "under 0%" in red. That is correct, but terse.

## 5. Data correctness: PASS

### Fees and returns on 20 sampled bets: PASS

**How checked:** 20 flags were drawn from `output/flags.json` with seed 20261120. For each, I recomputed:
- `fee = pipeline.common.taker_fee(category, ask)`;
- `edge = q − (ask + fee)`;
- `edge_low = q_low − (ask + fee)`;
- `roi = (q − cost) / cost × 100`.

**Result:** 0 mismatches. Every difference is at most 0.0001, or 0.01 percentage points, from rounding (`item5-engine-formulas.txt`).

### Numbers on cards match `/api` and `output/*.json`: PASS

- **API against the output files:** for Pro, `/api/markets?ps=50` returned 168 rows. For each side, ask, fee, win_prob, win_prob_low, edge, edge_low and roi_pct match `output/flags.json` (157 rows) or `output/markets.json` (11 rows). That is 2,352 fields with 0 mismatches. The `execution` blocks match byte for byte.
- **Page against the API:** `/m/6674492`, rendered for Pro, shows the API values rounded:
  - 70¢, pays 1.4x, +22 pts, +30%;
  - won 93%, cautious 89%;
  - No at 31¢, 8%;
  - stake table `$100 → $137 +$26.77`, which equals `execution.stakes`;
  - capacity `$24,282`.
- Evidence: `item5/cards-vs-api.txt` and `item5/apicmp.cjs`.

### Freshness pill correct; the Free tier is really delayed and capped in the server response: PASS

The run-3 fail is fixed.

**Delay test setup:** a production server ran on a copy of `output/` (`DATA_DIR`):
- the newest questions were tagged `NEWSCAN`;
- `*-prev.json` held a scan 20 minutes older;
- the clock was moved with a `Date.now` preload.

**Free results:**
- These responses contained 0 `NEWSCAN` rows:
  - API: `/api/markets`, `/api/flags`, `?p=2`, `/api/suggest`, `/api/markets/:id`, `/api/events/:id`;
  - page HTML: `/`, `/markets`, `/m/:id`, `/event/:id`, `/status`, `/track-record`.
- `/api/meta` and the `/markets` HTML carry the older `scanned_at`.
- `/status` shows the 5:38 scan as "25 min ago".
- The FreshnessPill reads `/api/meta`, so it shows the delayed age.

**Pro:** gets the newest `scanned_at` (`1794895125`) (`item5/cards-vs-api.txt`).

Evidence for the delay test: `item5/free-delay.txt`.

**Caps** (enforced server-side in `lib/data/gate.ts`; evidence `item6/paywall-mock.txt`):
- 10 rows;
- page 1 only;
- `ps` is clamped;
- ranges instead of exact numbers, with `win_prob` floored to 5%;
- no stakes and no capacity.

**Spec note:** `docs/12` has the data check "every flag edge_low > 0", but `flags.json` has 1,708 tier-`edge` flags with `edge_low < 0`. `docs/18` §2 defines them that way. The docs disagree with each other; the code follows `docs/18`.

## 6. Security: FAIL (1); live parts BLOCKED

| Sub-check | Verdict | Evidence |
|---|---|---|
| Paid data as anonymous or Free, through the API | **PASS** | `item6/paywall-mock.txt` (details below) |
| Another user's rows through Supabase with the anon key | **BLOCKED** | details below |
| Forged webhook | **PASS** | `item9/billing-mock.txt` B1–B5 (details below) |
| Replayed webhook | **PASS** | `item9/billing-mock.txt` C1–C2 (details below) |
| Rate limits under a hammer | **PASS** anonymous on the production build; signed-in **unit-tested**; live **BLOCKED** | `item6/hammer-prod.txt` (details below) |
| Known AI crawler user agent | **PASS** | `item6/bots-prod.txt` (details below) |
| Headless bot user agent | **BLOCKED** | `item6/bots-prod.txt` (details below) |
| Headers with `curl -I` | **PASS** | `item6/headers-prod.txt` (details below) |
| `pnpm audit` | **PASS** | `pnpm-audit-web-prod.txt`, `pnpm-audit-ext-prod.txt`, `pnpm-audit-web-all.txt` (details below) |
| `pip-audit` | **PASS** | `pip-audit.txt` |
| gitleaks over the full history | **PASS** | `gitleaks-with-ignore.txt`, `gitleaks-ignored-findings.txt`, `gitleaks-run-log.txt` (details below) |
| Client bundles grepped for secrets | **PASS** | `item6/bundle-grep.txt`, `item10/meta-og.txt` (details below) |
| Cookies HttpOnly, Secure, SameSite | **PASS** in code; live **BLOCKED** | details below |
| Rate-limit values match `docs/15` | **FAIL** | FAIL 6-a below |

**Paid data as anonymous or Free:**
- Anonymous callers get 401 on `/api/markets`, `/api/flags`, `/api/markets/:id`, `/api/events/:id`, `/api/model/curve`, `/api/combos`, `/api/kalshi`, `/api/account/export` and `/api/data/*`.
- Free gets 10 rows on page 1. `ps=1000` and `p=2` return the same 10 rows. Free gets ranges only, with no stakes or capacity; the niche curve is 403 and `/api/kalshi` is 404.
- Pro: `p=99999` gives 400, and `ps=201` is clamped to 50.
- `/api/admin/export` is 404 for everyone.
- No theta or covariance appears anywhere.
- Unit tests: `test/redteam-paywall.test.ts`, `test/account-wall.test.ts`.

**Another user's rows (BLOCKED):** this needs a live Supabase project. What the repo has:
- RLS policies in `supabase/migrations/*`;
- `test/rls.test.ts`, which runs on PGlite and passed in item 1, including "keeps at most 3 sessions";
- `supabase/tests/rls.test.sql`, a pgTAP test that I did not run (no Postgres or Supabase CLI here).

To unblock: run `supabase db test`, then call REST with the anon key and user A's JWT, asking for user B's rows.

**Forged webhook** (on the mock):
- B1, wrong secret: `400 {"error":"Bad signature"}`.
- B2, unsigned: 400.
- B3, garbage `v1`: 400.
- B4, a valid HMAC with a timestamp 10 minutes old: 400 (300 s tolerance).
- B5, a valid signature whose body claims premium: 200, but the tier stays `pro`, because the tier is re-read from Stripe and not taken from the event.

**Replayed webhook:** the same signed `evt_` id was sent twice. The second reply is `200 {"received":true,"duplicate":true}` and nothing changes; events are deduplicated by id in `stripe_events`.

**Rate limits** (production build, anonymous):
- `/api/markets` returns 429 from request 31 (the `list_free` 30/min rule).
- `/api/suggest` returns 429 from request 121.
- `/api/book` returns 429 from request 31.
- `Retry-After` is present in every case.
- The auth limit (5/min/IP) was **not** hammered live: on the keyless build `POST /api/auth/magic-link` answers 503 (sign-in is off), so there is nothing to limit. It is covered only by `test/ratelimit.test.ts`; the live check is BLOCKED (needs Supabase auth on a deploy).

Signed-in limits can't be hammered here:
- the dev mock turns limits off outside production (`lib/abuse.ts:120-131`);
- the production build has no users.

`test/ratelimit.test.ts`, which passed, covers them. Live per-user and per-IP limits need Upstash and a deploy with Supabase, so they are BLOCKED.

**AI crawlers:** GPTBot, ClaudeBot, CCBot, PerplexityBot, Google-Extended and Bytespider get 403 on `/` and on `/api/markets`. `middleware.ts` does this with `isAiBot`. `robots.txt` still answers 200 and disallows them.

**Headless bots (BLOCKED):** HeadlessChrome, `python-requests` and `curl` user agents get 200. The defense is Vercel BotID (`checkBotId()` in `lib/abuse.ts`), which only runs when `process.env.VERCEL` is set. To unblock: deploy to Vercel with BotID and Firewall Bot Protection on, then repeat the requests.

**Headers** (checked on `/`, `/markets` and `/api/meta`):
- CSP with a per-request nonce and `strict-dynamic`, no `unsafe-eval`, `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`;
- `Strict-Transport-Security: max-age=63072000; includeSubDomains`;
- `X-Frame-Options: DENY`;
- `X-Content-Type-Options: nosniff`;
- `Referrer-Policy: strict-origin-when-cross-origin`;
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()`.

**`pnpm audit`:**
- `pnpm audit --prod`: "No known vulnerabilities found" for both web and the extension.
- The full web audit, dev dependencies included: 1 moderate (minimatch, through eslint), no high or critical.

**gitleaks** (8.24.3, full history):
- With `.gitleaksignore`: 331 commits, "no leaks found".
- In a fresh clone with `.gitleaksignore` deleted: 18 findings, exactly the 18 ignored fingerprints. I inspected each one, and all are fake:
  - Stripe-shaped strings whose bodies are `FAKE…`, `SECRETVALUE` or `123456789012` (values redacted in `gitleaks-ignored-findings.txt` so this commit doesn't add new findings);
  - JWTs whose payload is `{"role":"anon"}` or `{"role":"service_role"}`, with signatures that are plain ASCII text.

**Client bundles:**
- A grep of the production `.next/static` for service-key and secret names and shapes (`SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `service_role`, `sk_live_`, `sk_test_`, `whsec_`, `rk_live_`, the JWT prefix `eyJhbGciOi`) found 0 hits.
- `scripts/check-bundle.mjs` reports "140 files in .next/static, no secrets".
- A grep for seed or test identities found only input placeholders such as `you@example.com`.

**Cookies:**
- Supabase SSR cookies use `COOKIE_OPTIONS`: `httpOnly: true`, `secure` in production, `sameSite: "lax"`. These are set in `middleware.ts:12` and `lib/auth/server.ts:30-35`.
- The other auth cookies (terms, password, reveals) reuse the same options.
- The mock is HTTP in dev, so `secure` is off there, as designed.
- The live check on HTTPS is BLOCKED: it needs a deploy with Supabase.

### FAIL 6-a: the auth email rate limit is 5 per 15 minutes; the spec says 5 per hour

- **The spec:** `docs/15-security.md:26` says "auth 5/min/IP and **5/hour/email**".
- **The code:** `apps/web/lib/abuse.ts:19` has `auth_email: { limit: 5, window: "15 m" }`. That allows 20 sign-in, sign-up or reset emails per hour to one address, four times the spec.
- **Where it came from:** commit `230c31d` ("Sign-in links: 5 per 15 min per email (was 1 h)") changed it without updating `docs/15`.
- **The test:** `apps/web/test/ratelimit.test.ts:64` is named "magic link: 5 a minute per IP and 5 an hour per email", but it only counts to 5 and never checks the window.
- **Fix:** either set the window back to `"1 h"`, or change `docs/15:26` to "5/15 min/email". In both cases, rename the test or make it assert the window.

## 7. Multipliers and combos: PASS

**A 10x bet with a 14% chance and a 4-point edge appears in tier 2: PASS.**
- `test/multipliers.test.ts:84`, "the 10x bet with a 14% chance shows in tier edge (chance floor off)", uses fixture `9900010`: 10¢, 14%, +4 pts, tier `edge`.
- The same bet also appears under Pays 10x+, a typed "10x" search and Biggest payout (`:89`).
- The e2e `multipliers.spec.ts` passed.
- The closest real case in the live data is `6771192`: 10¢, 12.6%, +2.1 pts, tier `edge`.

**Every count uses `formatCount` and never rounds up: PASS.**
- `lib/format.ts:149` rounds down, so 1,299 shows as "1.2K". `lib/format.test.ts` covers this.
- A grep for raw counts in `components/` and `app/` (`{…length}`, `{total}`, `.toLocaleString` on counts) found only small, bounded counts, such as `BestBets.tsx:253` (`{rows.length} of` for one page) and the number of legs.
- The raw counts flagged in run 3 (FilterPanel Chip, AlertsView, SearchCombobox, JournalView, Teaser) now use `formatCount`.

**Combo math matches hand-computed cases: PASS.** I recomputed the cases in `lib/combos.test.ts` by hand.

| Case | Chance | Price | Pays | Return |
|---|---|---|---|---|
| 2 legs | 0.70 × 0.58 = 0.406 | 0.61 × 0.51 = 0.3111 | 3.214x | +30.5% |
| 3 legs | 0.34916 | 0.2513688 | — | +38.9% |

All of them match.

**Same-event legs are warned: PASS.**
- `lib/combos.test.ts`, "warns on same-event legs";
- `multipliers.spec.ts` checks the warning in the tray;
- suggested combos never share an event (`test/multipliers.test.ts:23`).

**Suggested combos are hidden if the combo backtest lost money: PASS.**
- `lib/data/combos.ts:49` skips a leg count unless its `roi_pct > 0`.
- `test/multipliers.test.ts:34` sets the 3-leg `roi_pct` to −4, and only the 2-leg group remains.
- In the current `backtest.json`, 2 legs made +16.87% and 3 legs +25.71%, so both groups show.

## 8. Trading safety: PASS

**Trading is fully off without `KALSHI_TRADING_ENV`: PASS.**
- `lib/trade/server.ts:14`: only the value `"demo"` turns trading on.
- On the production build, `/api/trade/config` answers `enabled:false`.
- `/api/trade/nonce` and `/api/trade/nonce/verify` answer 404 "Trading is off.".
- No trade ticket appears on any page (item 3 crawl).

**With `demo`** (`item8/trade-mock.txt`):
- `/api/trade/config` is `enabled:false` for anonymous, Free and Pro users, and `enabled:true` only for the allow-listed premium user.
- `/api/trade/nonce` answers 401 when signed out and 403 "Trading isn't enabled for this account." for Free and Pro.
- It answers 403 "Bad origin." for a foreign or missing `Origin`.
- Without `EXT_SIGNING_SECRET` it answers 503, which is fail-closed.
- Nonces are single-use, bound to the exact order, and expire. Tampering is rejected (`lib/trade/trade.test.ts:22`, `:31`, `:35`, `:51`, `:70`).

**Every order needs a confirm, and no code path places an order without a user click: PASS** (grep and review).
- In the web app, `components/trade/TradeTicket.tsx:198-238` calls `placeOrder` only from `onConfirm`, the "Place paper order" button on the confirm step.
- In the extension, the place handler in `src/background.ts:140-165` checks the caps, then `/api/trade/nonce/verify` (the web app issues that nonce only after the confirm), then calls `K.placeOrder`.
- No timer, effect or message handler places an order. `apps/extension/test/no-auto-trade.test.ts` covers this.
- The e2e `trading-paper.spec.ts` asserts the "Confirm this paper order" step.

**Caps are enforced: PASS.**
- `background.ts` checks `maxOrderUsd` and `maxDayUsd` before asking for the nonce.
- It records the day's spend and refunds it if the order was never placed.
- `apps/extension/test/trade.test.ts` and `ext-cap-race.test.ts` passed.

**Keys never leave the extension (network and storage inspected): PASS.**
- **Setup** (`item8/keyinspect.cjs`, results in `item8/extension-keys.txt`):
  - the extension was built for `:3160` and loaded into a fresh Chromium profile;
  - the Kalshi demo API was mocked;
  - every page and service-worker request was recorded.
- **Test:** I connected a generated Ed25519 PEM in the side panel.
- **Results:**
  - 0 requests carried key material;
  - the key is not in `chrome.storage.local`, `chrome.storage.session` or page storage;
  - IndexedDB `kismet-vault/keys` holds a `CryptoKey` with `extractable:false` and `usages:["sign"]`;
  - the private-key field is gone after connecting.

**Keys with a transfer scope are rejected: PASS.**
- The same harness tried scopes `["read","write::trade","write::transfer"]` and `["read","write::*"]`.
- Both were refused with "This key also allows write::transfer…" (or `write::*`), and nothing was stored.
- The check is an allow-list: `src/kalshi/trade.ts:80` `scopeError`.

## 9. Billing: PASS on the mock; Stripe test mode end to end BLOCKED

**How checked:** `item9/billing.cjs` ran against the mock. It signs events with `stripe.webhooks.generateTestHeaderString` and `whsec_e2e`, and it uses new users, not the seeded ones. Output: `item9/billing-mock.txt`.

| Step | Result |
|---|---|
| Checkout → webhook → tier up | **PASS.** See A0–A1 below. |
| Portal cancel → tier down at period end | **PASS** on the mock. See D1–D2 below. The real Customer Portal page is BLOCKED: the mock portal just returns `/account`. |
| Payment Link path with `client_reference_id` | **PASS.** See E1–E2 below. |
| Idempotency on duplicate events | **PASS.** C2 answers `{"received":true,"duplicate":true}`. |
| Delete account cancels the subscription | **PASS.** See F1 below. |

**A0–A1, checkout:**
- A0: the tier starts at `free`.
- The user clicks `checkout-pro` and goes through mock Checkout.
- The mock sends signed `checkout.session.completed` and `customer.subscription.created` events.
- A1: the tier is `pro`, status `trialing`, period end in 7 days. The `subscriptions` row has the customer id and the subscription id.

**D1–D2, cancel:**
- D1: `subscription.updated` with `cancel_at_period_end:true` keeps the tier at `pro` until the period ends.
- D2: the subscription was canceled in the mock Stripe, then a signed `customer.subscription.deleted` was sent. The tier became `free`, status `canceled`.

**E1–E2, Payment Link:**
- E2: a signed reference (`<uid>_<expiry>_<hmac>`) upgrades the user to `pro`.
- E1: a raw, unsigned user id is ignored. The log shows `[stripe] checkout with an unsigned or expired client_reference_id ignored`, and the tier stays `free`.

**F1, delete account:**
- `DELETE /api/account` answers `200 {"deleted":true}`.
- The mock Stripe subscription becomes `canceled` with `canceled_at` set.
- `/api/me` then returns a null user.
- `e2e-paid/s7-upgrade.spec.ts` asserts this too.

**Observation (by design):** after E1, the `customer.subscription.created` event for a customer with no linked user returns 500 so that Stripe retries (`lib/billing/stripe.ts:122-124`, `RetryLater`). Stripe gives up after about 3 days. That is harmless, but every forged Payment Link checkout leaves a failing delivery in the Stripe dashboard.

**BLOCKED:** real Stripe test mode end to end: Checkout, the hosted Portal cancel, the Payment Link, and real webhook delivery and retries. To unblock: a Stripe test account with `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` and the price ids, plus a webhook endpoint (a deploy or `stripe listen`).

## 10. Legal and wording: FAIL (1)

| Sub-check | Verdict | Evidence |
|---|---|---|
| All legal pages present, linked in the footer, filled from config | **PASS** | `/terms`, `/privacy`, `/refunds`, `/disclaimer` and `/contact` answer 200 in every state, and every footer links them (item 3 crawls). |
| Placeholders (listed, not failed) | listed | `config/site.json` → `legal.mailing_address` is `""`. |
| Disclaimer on every page | **PASS** | "Market analytics, not financial advice. Based on past results. 18+." is in the footer of every crawled page in every state, and on the OG images (`item11/og-root.png`). |
| Disclaimer in the extension popup | **PASS** | The store build's popup shows the exact text (`item11/extension-zip.txt`, `item11/ext-popup-store.jpg`). |
| 18+ gate at signup | **PASS** | The Terms/18+ checkbox is required: `input[type=checkbox]:invalid` has a count of 1 until it is checked (`e2e-paid/s7-upgrade.spec.ts:13`). `test/password-auth.test.ts` covers the API side. |
| Banned words | **PASS** | The crawl regex over every page and state found only benign hits (item 3). The emails contain no banned words (`item10/emails.txt`, `test/email.test.ts:35`). |
| No claim of guaranteed or expected profit (meta tags, OG images, emails) | **PASS** | The `description`, `og:*` and `twitter:*` tags on `/`, `/about`, `/pricing`, `/m/:id` and `/track-record` were fetched and grepped, with 0 hits (`item10/meta-og.txt`). The OG image carries the disclaimer. The emails say "estimated return … based on past results". |
| Responsible-gambling resources on `/disclaimer` | **PASS** | 1-800-GAMBLER and ncpgambling.org are present. |
| Unsubscribe in every email | **FAIL** | FAIL 10-a below. |

### FAIL 10-a: the Supabase auth emails have no unsubscribe link

**The rule:** OVERNIGHT §3 item 10 says "unsubscribe in every email".

**What's wrong:** these four templates have the disclaimer and a "Manage your account" link, but no unsubscribe link:
- `supabase/templates/confirmation.html`
- `supabase/templates/magic_link.html`
- `supabase/templates/recovery.html`
- `supabase/templates/email_change.html`

**Where it comes from:** `apps/web/lib/email/templates.ts:79-105`. `AUTH_EMAILS` calls `layout(…, "Manage your account")` with the account URL in the unsubscribe slot. `apps/web/test/auth-email-templates.test.ts:14` only asserts "disclaimer, account link".

**The other emails pass:** the alert, admin sign-in and payment-failed emails all have a signed unsubscribe link and List-Unsubscribe headers (`item10/emails.txt`, `item10/email-alert.jpg`, `item10/email-auth-magic-link.jpg`).

**Judgement:** `docs/14-launch.md:64` calls auth mail transactional, and CAN-SPAM doesn't require an opt-out for transactional mail, so the owner may accept this as is. But the audit rule says "every email" with no exception, so this is a literal FAIL, of low severity.

**Fix:** add an unsubscribe or email-preferences link, or change OVERNIGHT and `docs/14` to exempt transactional auth mail.

**Delivery is BLOCKED:** the templates take effect only after the owner pastes them into Supabase Auth → Email Templates, which needs a live Supabase project.

## 11. Publication readiness: PASS; engine scan and Web Store review BLOCKED

| Sub-check | Verdict | Evidence |
|---|---|---|
| robots and sitemap | **PASS** | `robots.txt` disallows `/api/` and blocks GPTBot, ClaudeBot, CCBot, PerplexityBot, Google-Extended and others. `sitemap.xml` lists the 11 public URLs on the canonical domain, with no app or admin pages (`item11/prod-discovery.txt`). |
| No test users, seed data or debug routes in production | **PASS** | `/e2e-mock/*` is 404 in production (the route answers 404 unless `E2E_MOCK=1` and not production). `/admin*` and `/api/admin/export` are 404 for non-admins. The bundles contain no seed identities (`item10/meta-og.txt`). |
| Error pages styled | **PASS** | The styled 404 has the header, the footer and the disclaimer (`shots/prod-anon-*-_no_such_page.jpg`). See also the item 3 observation on signed-out unknown URLs. |
| Favicon and OG images | **PASS** | `icon.svg` and `apple-icon` answer 200 and are linked. The OG image renders with the disclaimer (`item11/og-root.png`). There is no `/favicon.ico` (404), but nothing links to it. |
| Email templates render | **PASS** | All 7 templates were rendered, and 2 were screenshotted (`item10/emails.txt`, `item10/*.jpg`). The committed `supabase/templates/*.html` equal `authEmailHtml()` except for a trailing newline. |
| Extension zip installs on a clean Chrome profile and passes the MV3 checks | **PASS** locally; Web Store review **BLOCKED** | details below |
| `SETUP.md` §0 from scratch in a fresh clone reaches a running app | **PASS**; the engine scan step is **BLOCKED** | details below |

**Extension zip** (`item11/extension-zip.txt`, `item11/ext-popup-store.jpg`):
- `KISMET_ORIGIN=https://kismetodds.com pnpm ext:zip` builds `kismet-extension-0.1.0.zip`: 15 files, 43 KB.
- Without `KISMET_ORIGIN` it warns "fine for loading unpacked, not for the store".
- **MV3 checks:**
  - `manifest_version` is 3;
  - the store build has no `key`;
  - the only permissions are `storage` and `sidePanel`;
  - the only hosts are the web origin and the Kalshi demo API;
  - `externally_connectable` lists only the origin;
  - the CSP is `script-src 'self'; object-src 'self'`;
  - there is no `eval`, no `new Function` and no remote script.
- **Install:** I unpacked the zip into a fresh Chromium profile. The service worker registered and the popup renders with the disclaimer.
- **Blocked:** the Chrome Web Store's own review and upload. To unblock: a developer account.

**SETUP.md §0 from scratch** (`item11/setup-from-scratch.txt`):
- `pip install` exits 0.
- `python3 -m engine scan` exits 1 with `RuntimeError: gave up: https://gamma-api.polymarket.com/events`. The proxy refuses `gamma-api.polymarket.com` (`CONNECT 403`). The failed scan left `output/` untouched (`git status` is clean). This step is BLOCKED; access to `gamma-api.polymarket.com` and `clob.polymarket.com` unblocks it.
- `pytest engine/tests ops/tests`: 66 passed.
- `pnpm i --frozen-lockfile` exits 0.
- `pnpm dev`, on port 3161 instead of 3000, reaches a running app in demo mode on the committed `output/`. `/`, `/bets`, `/markets` and `/pricing` answer 200, and `/api/markets` has 7,391 rows.

---

## FAIL list

| # | What | Where |
|---|------|-------|
| 3-a | React hydration error #418 on `/`, `/bets` and `/m/:id`, on the production build, for any visitor not in the server's timezone (shown with America/New_York). The game time is formatted with `toLocaleString` and no `timeZone` inside SSR'd client components. A render-time `Date.now()` race on the same line may also cause it in UTC (seen once, unconfirmed). | `apps/web/lib/format.ts:201-207` (`gameTime`) and `:119` (`closesLine`), used at `apps/web/components/market/BetCard.tsx:62`, `MarketCard.tsx:27` and `MarketDetail.tsx:145` |
| 6-a | The auth email rate limit is 5 per 15 minutes per address; the spec says 5 per hour. The test name says "an hour" but never checks the window. | `apps/web/lib/abuse.ts:19` vs `docs/15-security.md:26`; `apps/web/test/ratelimit.test.ts:64` |
| 10-a | The Supabase auth emails (confirm, magic link, recovery, email change) have no unsubscribe link, but the rule is "unsubscribe in every email". Low severity, since they are transactional. | `apps/web/lib/email/templates.ts:79-105` → `supabase/templates/*.html`; `apps/web/test/auth-email-templates.test.ts:14` |

## BLOCKED list

| Check | What unblocks it |
|---|---|
| Live Polymarket order book on `/m/*` (`/api/book` 502), and `python -m engine scan` | Network access to `clob.polymarket.com` and `gamma-api.polymarket.com`; the proxy answers 403 CONNECT here. |
| Headless-bot defense (BotID) and the Vercel Firewall rules (Bot Protection, AI Bots deny, OWASP) | A Vercel deploy with BotID and the Firewall rules on, then a repeat with HeadlessChrome and a scripted client. |
| Live rate limits (per user when signed in, across instances) | An Upstash Redis (`UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`) plus a production deploy with Supabase auth, then a hammer test as Free and as Pro. |
| Supabase RLS with the anon key against another user's rows; pgTAP `supabase/tests/rls.test.sql`; live HTTPS cookie flags; auth email templates and auth settings applied | A live Supabase project (URL, anon key, service key) and the Supabase CLI. |
| Stripe test mode end to end (Checkout, the hosted Customer Portal cancel, the Payment Link, real webhook delivery and retries) | A Stripe test account (secret key, webhook secret, price ids, Payment Link) and a webhook endpoint (a deploy or `stripe listen`). |
| Chrome Web Store review of the extension zip | A Chrome Web Store developer account and an upload. |

## Observations (not fails)

1. `/api/health` answers 503 on a production build without Upstash. This is intended (`lib/health.ts:31-33`), but uptime monitors will alert until Upstash is set.
2. When auth is on, signed-out visitors to unknown URLs get `/signup?next=…` instead of the 404 (`middleware.ts:112`).
3. Lighthouse SEO is 91 because of `meta-description`: for browser user agents, Next 15 streams metadata into `<body>`.
4. `docs/12` and `docs/18` disagree on `edge_low > 0` for every flag.
5. An unsigned Payment Link checkout leaves a webhook answering 500 for about 3 days of Stripe retries (`RetryLater`).
6. The market OG image says "Sign up free to see it" even on a build where sign-in isn't available yet.
7. There is no `/favicon.ico` file; the icons are served through `<link rel=icon>`.
8. Python 3.13 was used, not CLAUDE.md's 3.12. SETUP.md says 3.12+, and everything passed.
9. The Free delay uses `Date.now()`, not `DATA_CLOCK` (`lib/data/store.ts:272-302`). This is correct in production; it only matters when replaying old scans locally.
10. On `/m/:id`, "Price check ✓ fair fill" sits next to "The live order book didn't answer".
11. On the committed `output/` (scanned Nov 17, three days before this audit), a market that has already closed can still show as a bet, and the freshness pill turns red with "Updated 3 days ago". This is correct behaviour for stale data. The scheduled refresh is meant to prevent it, but here it can't run because Polymarket is blocked.
