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
| 18 live portal | **Blocked, Q decides** | Stripe live mode (acct Kismetodds) has **no Customer Portal configuration** (`GET /v1/billing_portal/configurations` → empty list, read-only check). Stripe refuses portal sessions in live mode until the portal settings are saved once (Dashboard → Settings → Billing → Customer portal: turn on "Cancel subscriptions" and plan switching). Until then the button shows "Couldn't open billing. Try again." No live subscriptions exist yet, so nobody is affected today. I made no Stripe writes. |
| 48 Terms points to the cancel button | Fixed | Terms: "open your account page and choose **Manage billing or cancel** (Stripe's billing page)". Refunds used "Manage billing"; it now uses the button's exact label. Same e2e checks both pages' HTML. |
| 48 FAQ wording | Left to lane B | Lane B owns FAQ copy. /pricing FAQ says "Cancel from your account page", which is right but doesn't name the button. |

## QA-C 1 (also): #32, #30

| Item | Status | Evidence |
|---|---|---|
| 30 Free "Start free" → sign-up | Verified live | `curl https://kismetodds.com/pricing` and `/`: `data-testid="start-free" href="/signup"`. |
| 32 Start trial keeps plan, period and trial through sign-up and lands in checkout | Verified live (links) + in mock (whole flow) | Live hrefs: `/signup?next=%2Fpricing%3Fstart%3Dpro_monthly` and `premium_monthly`. Mock e2e: Yearly toggle → Premium "Start trial" → `/signup?next=…premium_yearly` → magic link → `/onboarding?next=…premium_yearly` → Skip → checkout opens by itself → `/account?checkout=success` → Premium on a trial. |
