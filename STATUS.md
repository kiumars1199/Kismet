# MarketEdge — status

Branch `final` (from `demo`), built overnight by one agent per lane, merged by the lead. `SETUP.md` covers accounts and
deploy; `LAUNCH_TODO.md` covers owner-only steps; `AUDIT.md` holds the final audit.

## How to run
See `SETUP.md` §0. Short version: `python3 -m engine scan`, then `cd apps/web && pnpm i --frozen-lockfile && pnpm dev`.
Checks: `python3 -m pytest -q engine/tests ops/tests`, then in `apps/web`: `pnpm lint && pnpm typecheck && pnpm test && pnpm e2e`.
Extension: `pnpm ext:zip` (see `docs/setup-notes/trading-extension.md`).

## What works
- **Engine (Lane A):** 2-year history (1,484,104 resolved markets, 1,738,882 bets), 52 weekly walk-forward folds,
  90-day half-life. Best bets +13.9% ROI, t = 34.7. Two tiers on every flag (`best`, `edge`), `by_pays` breakdown,
  combo backtest (2-leg +16.9%, 3-leg +25.7%). `engine update` paginates by date window (T-85), no Gamma offset error.
- **App (Lanes S, C, U):** Best bets home at `/`, landing at `/about`, smart search with suggestions, five pills,
  Pays pill on both tiers, "Biggest payout" sort, 2x+/5x+/10x+ chips, "More bets with an edge", `formatCount`,
  combo tray and suggested combos (hidden when the combo backtest loses), docs/17 polish, live price pulse,
  New badge, closing-soon strip, results ticker, Today card. Lighthouse mobile 99/100/96/91 on `/`, `/about`, `/pricing`;
  axe 0 serious/critical. Screenshots of every page at 390 and 1440 px in `docs/screenshots/final/`.
- **Accounts and billing (Lane L):** Supabase Auth (Google + magic link), 18+/Terms checkbox, onboarding saved to the
  account and honoring a safe `next`, `/account` export/delete/sign-out-everywhere, local→account import, 3-session
  limit, Stripe Checkout and Payment Links, verified idempotent webhook, portal, 7-day trial, server entitlements,
  "Coming soon" when keys are empty, legal pages from `config/site.json`, SEO, 404/500.
- **Trading (Lane K, paper only):** keys only in the extension (non-extractable WebCrypto, transfer/full-write keys rejected),
  one-time server nonces, order ticket with confirm every time, caps, `client_order_id`, demo exchange only.
- **Extension (Lane E):** popup, side panel, sign-in handoff, Premium gate, key vault, disclaimer, `docs/STORE_LISTING.md`.
- **Ops (Lane O):** engine Dockerfile + Railway/Fly config, private Supabase bucket, data fallback chain, refresh.yml,
  web CI, `/api/health`, Sentry with PII scrubbing, PostHog cookieless, Resend with one-click unsubscribe, Vercel crons.
- **Security (Lane X):** server paywall and row trimming, Upstash rate limits, BotID/Firewall rules, AI-crawler blocks,
  RLS with cross-user tests, CSP nonce + headers, CSRF, zod on every input, webhook signatures, pinned dependencies.

## Behind a flag
- `DEMO_MODE=true`: no login, everything unlocked (default outside production; production needs exactly `true`).
- `KALSHI_TRADING_ENV=demo` (+ `TRADING_ALLOWLIST`): paper trading on Kalshi's demo exchange. Empty = off. No prod path.
- `KALSHI_DATA_PERMISSION=true`: Kalshi combo price check. Off until Kalshi grants permission in writing.
- `E2E_MOCK=1`: in-app Supabase/Stripe mock for paid e2e; refused in production.

## Needs an owner value
`config/site.json` (domain, support email, operator names, state, address, refund policy, response time, Payment
Links) shows as `[[PLACEHOLDER]]` until filled. Every key in `SETUP.md` §2. Lawyer review of legal pages (`LAUNCH_TODO.md`).

## Known issues
- Vercel Hobby rejects the 5-minute alerts cron; needs Pro (in `LAUNCH_TODO.md`).
- Kalshi fee formula in the order ticket is unverified against a live Kalshi fill.
- Kalshi combo check never shows today: the engine emits no `kalshi_ticker`.
- `pnpm audit --prod`: 1 high, picomatch <=4.0.7 ReDoS (GHSA-fc5q-39xc-vjpf), no patched release exists (4.0.7 is latest). Reached only through Sentry's build tooling (`@rollup/plugin-commonjs`, `@sentry/cloudflare > vite`) on globs we write; never on user input or at runtime. Dependabot will bump it when a fix ships. Glob/minimatch moderates are fixed by overrides.
- Vercel OWASP managed ruleset needs Enterprise; other firewall rules apply.
- Lighthouse SEO 91: Next 15 streams the meta description into `<body>` for normal browsers (`htmlLimitedBots: /.*/` fixes it but costs ~15 performance points).
- Lighthouse best practices 96: one undetailed CSP entry in Chrome's Issues panel; no console violations.
- No 500 screenshot (no route can be forced to fail); `app/error.tsx` checked in code.
- Edge tier 2–3x, 5–10x and 10x+ lost money in the backtest; those bands are shown with their record, not promoted.
- Closing-soon strip and results ticker are empty on current data (nothing closes within 3 h; nothing settled yet).
- `volume_24h` is null for most markets (Gamma omits it); the 24h-volume filter matches only markets that report it.
- With "My list only" on, rows are filtered per fetched page, so a page can come back short.

## Decisions (overnight final build, Nov 17)
- Branch `final` from `demo`; lanes run in worktrees and the lead merges each with `--no-ff` after typecheck/lint/test.
- Shared data contract (`tier`, `by_pays`, `combos`) written by the lead first (T-79) so lanes A, S and C don't each invent it.
- Data check cap: tier-"best" flags ≤ 10% of scanned markets (was 5% over all flags). The 2-year history validates more categories (7.7% on Nov 17; 52-fold backtest +13.9% ROI, t = 34.7). Tier "edge" has its own rule checks and no cap.
- E2E demo flows run against a production build (`next build && next start`); on-demand compiles under `next dev` timed out at random under parallel load. `PW_DEV=1` switches back. Paid flows stay on dev because the Supabase/Stripe mock is off in production by design.
- "Run now" on /alerts shows in demo mode as well as dev (local test aid; demo is never deployed).
- ESLint `argsIgnorePattern: "^_"`.
- `/flags` permanently redirects to `/` (Best bets is home); every internal link updated.
- `engine update` hit Gamma "offset too large"; fixed test-first by splitting date windows (T-85, touches `pipeline/fetch_closed.py`).
- Onboarding finish waits for the account session and saves `onboarded_at` server-side; falls back to a full load if routing stalls.
- Lane U: `/` renders per request with the headline count in first paint; Recharts loads only with a drawer; Best bets shows one card per game by default (`g=0` shows all) and 12 cards before "Show more"; "unusually high" note only in the drawer; Today card shows only the user's own saved bets/alerts/P&L (not picks).
- Lane A's 2-year history (1.3 GB `data/`) is cloned into the main checkout; the older copy is kept as `data.pre-backfill/` (gitignored).

- picomatch high accepted as build-time-only with no upstream fix; not ignored in the audit config, so `pnpm audit` keeps reporting it until a patch ships.

## Decisions (lead calls, incl. blockers > 20 min)
- Design tokens: the approved artboard wins over the old docs/06 values; docs/06 now lists what the app implements.
- docs/08 said demo runs as `pro`; docs/01 and the brief say `premium`. Went with premium, fixed docs/08.
- Engine warning text says "15c" (scan.py) where docs/07 says "15¢"; UI shows its own plain-language label ("Unusually high — similar past bets returned +X%", or "check details" when unknown), so the raw string is not user-facing.
- LocalRepo adds sync `snapshot()`/`profileSnapshot()` for useSyncExternalStore; SupabaseRepo must serve them from a cache.
- Lane A widened SAMPLE_TAGS and added tag aliases (cbb→ncaab, mma→ufc, formula1→f1) so new niches get history; kept.
- Grouped screener pages over event groups (≤50 per page, best row + up to 3 more each, `size` = full count); docs/04's "paginate groups" sent 2.8 MB pages on real data.
- Worktrees spawned by the agent tool start from `main`, not `demo`; every lane brief begins with `git reset --hard demo`.
- Lanes C and D split in two each (C1 screener+drawer, C2 results/landing/status, D1 presets/list/onboarding/keys/CSV, D2 settings/dashboards/bets/Kelly/tools/alerts) so five teammates work on disjoint files.
- Playwright e2e runs on port 3100 against fixtures (never reuses a real-data server on 3000).
- T-60: fixtures in `apps/web/test/fixtures/` already existed (500 markets, 150 flags); reused as-is.
- `engine fit` needs `data/` (gitignored, ~1 h Polymarket bootstrap). Bootstrap started locally at the start of the night.
- Lead review fixes after the advisor pass: stake table says "You get back if it wins" (it is payout, not profit); "pick"/"edge" removed from casual text (Pro mode and Results keep "edge"); landing hides the ¢-per-share and t-stat tiles (kept on Results); save star is 44px; landing count, Best bets page and the built-in "Best bets right now" view all use worth it + thin.
- Alert channel type gained `"inapp"` (D1's target-price alerts); D2's inbox is always on regardless.
