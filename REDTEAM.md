# Red-team run 2 (2026-11-17)

Scope: `origin/final` checked out as `redteam2`, attacked on localhost only (ports 3900–3999). This run
treats every claim in run 1's `REDTEAM.md` and in `STATUS.md` as unverified and tries to bypass each fix,
and attacks the new admin dashboard (`/admin`, `/api/admin/**`, `app_settings`, `admin_audit_log`,
comp tiers, maintenance mode).

Targets and method
- **Target B (primary), dev + in-app mock:** `next dev -p 3900` with the env from `playwright.paid.config.ts`
  (`DEMO_MODE=false`, `E2E_MOCK=1`, mock Supabase + Stripe, `ADMIN_EMAILS=admin-e2e@example.com`), plus
  `KALSHI_TRADING_ENV=demo`, `EXT_SIGNING_SECRET`, `CRON_SECRET`, `UNSUBSCRIBE_SECRET`, real `output/` data.
  Sessions built with `ops/redteam/login.sh`: `free@x.test` (Free), `pro@x.test` (Pro, trialing),
  `premium@x.test` (Premium), `admin-e2e@example.com` (Admin).
- **Database layer:** `ops/redteam/rt2-db.test.ts` loads **every** `supabase/migrations/*.sql` into PGlite (so the
  T-140 admin tables and the RT fix triggers are live) and attacks them as a plain `authenticated` JWT, the way a
  user would hit PostgREST directly. `ops/redteam/ext-cap-race.test.ts` runs the real extension `background.ts`
  with a stubbed `chrome.*`.
- **Target A (production build):** the production-only controls (RT-02 falls back to the in-memory limiter rather
  than off; the e2e mock and `DEMO_MODE` are gated on `NODE_ENV !== "production"`; admin fails closed to `notFound()`
  when Supabase keys are empty) were confirmed by reading the code paths, building on run 1's confirmation that a
  production build with empty keys fails closed. No external service (Polymarket, Kalshi, Stripe, Resend) was
  contacted.

## Findings

| ID | Severity | Title |
|---|---|---|
| RT2-01 | Low | `GET /api/admin/export` has no same-origin check (the admin mutation route does) |

### RT2-01 · Low · Admin CSV export lacks the same-origin check its sibling mutation route enforces

- **Where:** `apps/web/app/api/admin/export/route.ts:16-19`. The export `GET` calls `requireAdmin()` and the rate
  limit, but not `sameOrigin(req)`. `POST /api/admin` (`apps/web/app/api/admin/route.ts:37`) does check it.
- **Repro (admin session cookie, forged `Origin`):**
  ```
  POST /api/admin   Origin: https://evil.test  -> 403 Bad origin
  GET  /api/admin/export  Origin: https://evil.test  -> 200  text/csv; charset=utf-8
       CSV first line: id,email,created_at,last_sign_in_at,tier,status,comp_tier,comp_expires_at
       rows: 4
  ```
- **Observed:** the export returns the full user list (id, email, tier, status, comp tier — PII) regardless of the
  request `Origin`, and writes a `users.export` row to `admin_audit_log` on every call.
- **Impact:** limited. The session cookie is `SameSite=Lax`, so a silent cross-site `fetch`/`<img>` does not carry
  it, and CORS stops any cross-origin reader from seeing the body; the realistic vector is tricking a signed-in
  admin into a **top-level navigation** to the URL (a link), which downloads the CSV to the admin's own disk and
  writes an audit entry and a full-table scan server-side. No cross-origin exfiltration. Adding `sameOrigin(req)`
  (and ideally making export a `POST`) makes it consistent with every other admin mutation.

## Attempted and held

Admin dashboard — access control (Target B, live requests)
- `GET /admin` as anon, Free, Pro, Premium → **404**; as Admin → **200**. Same for `/admin/users`,
  `/admin/settings`, `/admin/audit`, `/admin/health` (404 for Free). The guard returns `notFound()`, never 403, so
  the panel's existence is not revealed (`lib/admin/server.ts:22`).
- `POST /api/admin` (settings/comp/…) as anon, Free, Pro, Premium → **404**; as Admin → **200**.
  `GET /api/admin/export` as anon, Free, Pro, Premium → **404**; as Admin → **200**.
- **CSRF on the mutation route:** `POST /api/admin` with no `Origin` → **403**; with `Origin: https://evil.test` →
  **403**. Only `sameOrigin` requests pass.
- **Comp-tier abuse:** Admin comps `free@x.test` to premium → `/api/me` reports `premium`; uncomp → back to `free`.
  A Free user calling the same `comp` action on itself → **404** (not an admin). `effectiveTier` honors
  `comp_expires_at`; the `comp` action's zod `refine` rejects a past `expires_at`.
- **Email case / verification / demo / metadata spoofing:** the guard matches the verified `email` claim from
  `supabase.auth.getUser()`, trimmed and lower-cased on both sides (`lib/admin/core.ts`); it ignores
  `user_metadata.email`, requires `email_confirmed_at`, and returns null in `DEMO_MODE`. `/api/me` reports
  `admin:false` for every non-admin session.

Admin dashboard — data layer (`ops/redteam/rt2-db.test.ts`, all migrations in PGlite, as `authenticated`)
- `insert`/upsert into `app_settings` with a user JWT → `new row violates row-level security policy`; `select` → 0
  rows. Same for `admin_audit_log`. Both tables have RLS on with no policies and `revoke all from anon, authenticated`.
- `admin_audit_log` is append-only **even for the service role**: `update`/`delete`/`truncate` →
  `admin_audit_log is append-only` (trigger), while an `insert` succeeds.
- **XSS via the banner:** setting `banner_text` to `<img src=x onerror=alert(1)>` and loading `/` renders it as
  text (`&lt;img src=x onerror=alert(1)&gt;`); the banner is `{banner}` in JSX (`app/layout.tsx:44`), React-escaped,
  and the value is zod `.max(280)`.
- **CSV injection in the export:** `safe()` prefixes a leading `= + - @ \t \r` with `'`
  (`app/api/admin/export/route.ts`), and the only attacker-influenced column (`email`) is validated by GoTrue.
- **Maintenance mode:** with maintenance on, Free and anonymous `/api/markets` → **503**, `/admin` as Admin → **200**
  (the exemption is the same verified-email check). Non-admins cannot escape it.

Run-1 re-attacks (all bypass attempts failed)
- **RT-01 reveal budget** (`reveal_reset.py`): dropping the `me_reveals` cookie no longer grants fresh exact
  reveals — the server-side distinct budget (3/day per IP key) is authoritative; new markets past 3 come back
  `banded, reveals_left=0`.
- **RT-02 fail-open:** the dev branch logs `rate limits are OFF (dev / demo only)`; in production without Upstash
  `limiter()` returns the per-instance `memoryLimiter` (never `noop`), and every `distinct()` budget uses the
  memory fallback even in dev (`lib/abuse.ts:160-170`, `:190-210`).
- **RT-03 row cap:** `listRoute` gates Free with `list_free` (30/min) and `rowBudget` (1,500 distinct markets/hour,
  `lib/abuse.ts:FREE_ROWS_PER_HOUR`), so filter partitioning no longer enumerates the scan unbounded, and the rows
  are banded anyway.
- **RT-04 filter oracle** (`filter_oracle.py`, anon): the binary search now converges on the **banded** values
  (`roi 20.0`, `win 0.85`) not the exact store values (`22.15 / 0.8918`). Free filters/sorts run over `freeView`
  (`lib/data/respond.ts:withTier` → `freeView`, `lib/data/gate.ts`), so thresholds are no longer an oracle.
- **RT-05 client-ref hijack** (live): a Payment Link with an edited `client_reference_id=<victim id>` →
  `checkout with an unsigned or expired client_reference_id ignored`; the victim's tier stays `pro`. The handler
  trusts only `verifyClientRef` (HMAC keyed off the webhook secret, 24 h) and refuses to re-link a user who already
  has another active customer (`lib/billing/stripe.ts:130-145`).
- **RT-06 extension daily cap** (`ext-cap-race.test.ts`): three concurrent $20.70 `place` intents →
  `[true,false,false]`, **1 order placed, 2070¢ spent** against the $25 cap. The `placing` promise chain serializes
  orders and reserves the cost before any await (`background.ts:145`).
- **RT-07 IP key:** `clientKey` never reads a client `X-Forwarded-For`; off-Vercel every anon caller shares
  `ip:local`, on-Vercel it uses `x-real-ip` / `x-vercel-forwarded-for` (`lib/abuse.ts:clientIp`). PGlite/unit proof.
- **RT-08 quotas** (DB): on Free, parallel-style inserts stop at the plan limit — `presets` 1, `alert_rules` 0,
  `watchlist` 10 — enforced by the `enforce_plan_quota` trigger with a per-user advisory lock
  (`20261118000100_plan_quotas.sql`).
- **RT-09 Kalshi scopes** (`ext-cap-race.test.ts`): `WRITE::TRANSFER`, `transfer`, `write:transfer`, `admin` are all
  **rejected** now (allow-list: `read`, `read::*`, `write::trade` only — `kalshi/trade.ts:scopeError`).
- **RT-10 extension token:** `verifyExtToken` refuses pre-RT-10 tokens (no `uid`/`iat0`) and anything past
  `EXT_TOKEN_MAX_AGE_MS` (7 days from first sign-in); `/api/ext/token/refresh` re-reads the account (deleted/banned →
  401) and re-derives the tier with the service role (`lib/trade/server.ts`, `token/refresh/route.ts`).
- **RT-11 own-row RLS** (DB): `update`/upsert of `subscriptions.tier` and `comp_tier` with a user JWT → 0 rows / RLS
  violation (no write policy); forging `profiles.accepted_terms_at` → `accepted_terms_at and created_at are set by
  the server` (trigger); `journal` insert on Free → RLS violation (insert policy requires a paid/comped plan).
- **RT-13 redirect:** signed-in `/login?next=<non-ASCII>` → **307** to `/` (no 500); `//evil.test` → `/`.
  `safeNext` is printable-ASCII and same-origin-relative only.
- **RT-14 info exposure:** `GET /api/health` unauthenticated → `{"ok":true}` only (component details need the cron
  bearer). In production without `NEXT_PUBLIC_EXTENSION_ID`, `extensionId()` is null, so no
  `chrome-extension://` origin is trusted.
- **RT-15 cache:** `/api/markets` and `/api/combos` send `Cache-Control: private, no-store` and `Vary: Cookie`.

## Run-1 fixes verified

| ID | How verified | Verdict |
|---|---|---|
| RT-01 | `reveal_reset.py` live on :3900 | Fixed |
| RT-02 | code (`limiter()` → memory in prod); dev log line | Fixed |
| RT-03 | code (`rowBudget` + `list_free` in `listRoute`); banding via `freeView` | Fixed |
| RT-04 | `filter_oracle.py` live (returns banded, not exact) | Fixed |
| RT-05 | live client-ref hijack (victim unchanged; log line) | Fixed |
| RT-06 | `ext-cap-race.test.ts` (1 order, 2070¢) | Fixed |
| RT-07 | `rt2-db.test.ts` / `clientKey` (`ip:local`) | Fixed |
| RT-08 | `rt2-db.test.ts` (quota trigger, all migrations) | Fixed |
| RT-09 | `ext-cap-race.test.ts` (scope allow-list) | Fixed |
| RT-10 | code (`verifyExtToken` + refresh re-check) | Fixed |
| RT-11 | `rt2-db.test.ts` (comp/tier/terms/journal) | Fixed |
| RT-12 | not re-exercised (body-size; Vercel 4.5 MB caps it) | Unchanged, Low |
| RT-13 | live `/login?next=` | Fixed |
| RT-14 | live `/api/health` → `{ok}` only | Fixed |
| RT-15 | live response headers | Fixed |

## Notes (not security findings)
- Maintenance mode has a ~30 s edge-cache lag (`lib/maintenance.ts` MAINT_TTL_MS) before enabling/disabling takes
  effect in middleware; observed ~11 s to enforce here. Availability toggle, not a security control.
- Off Vercel the rate-limit key and the 1,500-rows/hour distinct budget collapse to a single `ip:local` shared by
  all anonymous callers — more restrictive than per-IP, so a defensive posture rather than a bypass.
