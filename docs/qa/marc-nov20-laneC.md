# Marc's QA list (Nov 20, 2026): lane C log

Lane C items: 18, 48 (cancel), 32, 30, 17, 73, 33, 9, 19, 53, 21, 22, 23, 64, 38, 58, 72, 39.
Branches are stacked (each one starts from the previous), so they merge in order. "Verified live" means checked on
kismetodds.com; "verified in mock" means the paid e2e mock (DEMO_MODE=false, app/e2e-mock Supabase + Stripe).

Baseline: on origin/final (67faeaf) `test/teaser.test.ts` "one bet per game" already fails (3 vs 4) before any lane C
change. It depends on the fixture date, not on these files; left for its owner.

## QA-C 1: #18, #48 (cancel part)

| Item | Status | Evidence |
|---|---|---|
| 18 /account: plan, renewal or trial-end date, Manage billing or cancel | Done (in code since #4), verified in mock | `e2e-paid/qa-c-billing.spec.ts`: after a Premium trial checkout /account shows "Premium", "Free trial", "Trial ends <Month D, YYYY>", the `manage-billing` button "Manage billing or cancel", and the button gets a portal URL (200). |
| 18 live portal | **Not verified live; Q checks** | Production's price IDs (`STRIPE_PRICE_*` in Vercel, `price_1UdRkcHpG4ZG7Gys…`) belong to a Stripe account the Stripe connector can't see: on the account it can see (Kismetodds, live mode) they are "No such price". That live account has no Customer Portal configuration and no subscriptions. Q: in the account production uses, open Dashboard → Settings → Billing → Customer portal, turn on "Cancel subscriptions" (and plan switching) and save once; without a saved portal configuration Stripe refuses portal sessions and the button shows "Couldn't open billing. Try again." No Stripe writes made. |
| 48 Terms points to the cancel button | Fixed | Terms: "open your account page and choose **Manage billing or cancel** (Stripe's billing page)". Refunds used "Manage billing"; it now uses the button's exact label. Same e2e checks both pages' HTML. |
| 48 FAQ wording | Left to lane B | Lane B owns FAQ copy. /pricing FAQ says "Cancel from your account page", which is right but doesn't name the button. |

## QA-C 1 (also): #32, #30

| Item | Status | Evidence |
|---|---|---|
| 30 Free "Start free" → sign-up | Verified live | `curl https://kismetodds.com/pricing` and `/`: `data-testid="start-free" href="/signup"`. |
| 32 Start trial keeps plan, period and trial through sign-up and lands in checkout | Verified live (links) + in mock (whole flow) | Live hrefs: `/signup?next=%2Fpricing%3Fstart%3Dpro_monthly` and `premium_monthly`. Mock e2e: Yearly toggle → Premium "Start trial" → `/signup?next=…premium_yearly` → magic link → `/onboarding?next=…premium_yearly` → Skip → checkout opens by itself → `/account?checkout=success` → Premium on a trial. |

## QA-C 2: #33 (branch claude/qa-c-404)

| Item | Status | Evidence |
|---|---|---|
| 33 unknown URL signed out → 404 page, not /signup | Fixed, verified in mock | Before (live): `curl -I https://kismetodds.com/nope-xyz` → 307 to `/signup?next=%2Fnope-xyz`. Now `lib/auth/public-paths.ts` lists the app pages (`APP_PAGES`); only those go to sign-up, any other path falls through to Next's 404 page. Fails closed: `test/account-wall.test.ts` reads `app/` and fails if a page folder is in no list. `e2e-paid/qa-c-404.spec.ts`: `/nope-xyz`, `/pricingx`, `/some/deep/path` → 404 with the 404 page, header and disclaimer; `/bets`, `/account`, `/kalshi` still → `/signup?next=…`. |

Note: `e2e-paid/admin.spec.ts` "normal user and anonymous visitor" failed twice here, at the **signed-in** non-tester check
`/api/combos/kalshi → enabled false` (line 47), which this change doesn't touch (signedOutAccess only runs with no
session). The signed-out part (`/combos`, `/kalshi` → sign-up) passes in qa-c-404.spec.ts. Flagged to main.

## QA-C 3: #17, #73 (branch claude/qa-c-header)

| Item | Status | Evidence |
|---|---|---|
| 17/73 signed-in header the same on every page (Combos, Kalshi, Account, Admin for admins, Updated clock), /kalshi and 404 included | Fixed, verified in mock | Cause: the header was signed out in the server HTML and filled in Account, Admin and the beta links only when `/api/me` answered, so pages looked different while loading, and at 1280 px the nav overflowed (Kalshi clipped, search squashed). Now the root layout passes a server hint (`getMe`, React `cache()`d) to Header, MobileNav and AccountLink; the gated links come from `lib/beta.ts navFeatures` on the server (the Kalshi rule reads a server-only env var, so the browser can't decide it); beta pill is a dot below 2xl; the Updated pill holds its space while loading. Measured at 1280 px: nav 591/591 on /bets, /kalshi, /nope-xyz and after a soft navigation. `e2e-paid/qa-c-header.spec.ts`: admin sees Combos, Kalshi, Admin, Account in the first HTML of /bets, /kalshi, /pricing, and on /nope-xyz and /kalshi with `/api/me` blocked; a normal user sees Account, no Admin or beta links. Fails on the old layout. |

Note: the 404 page's body (header included) streams from the RSC payload, not the first HTML, in production too
(`curl https://kismetodds.com/nope-xyz` has no `<header>`); that is Next's not-found rendering, unchanged here. With the
hint it renders signed in at once instead of after `/api/me`.

Gates: tsc, lint OK; vitest 1081/1082 (only the known teaser test); `check:js` landing 149.6 kB (budget 150); demo e2e
s1-landing, s6, s6-tools, t291-ui, headers 13/13; paid qa-c-header 2/2. Paid `admin.spec.ts` timed out here on dev compiles
(shared container); main's run passes.
