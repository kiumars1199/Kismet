# Kismet launch status

Created Nov 22, 2026 as Phase 0 of Q's launch plan. The plan text itself never reached this session, so these
rows and walk-throughs are a **provisional draft**. They are taken from root `STATUS.md` ("What works") and
`docs/12-test-plan.md`. Replace them with the plan's own definitions once it's pasted.

Rule: a row says "passed review" only after a separate reviewer, who gets the code, the running app and the
acceptance checks but not the builder's conclusion, has signed off. Every row cites its evidence.

## Features

| # | Feature | Status | Evidence |
|---|---------|--------|----------|
| 1 | Best bets home (`/`): flags, pills, sort, payout chips | not reviewed | |
| 2 | Search with suggestions and filters (`/m`) | not reviewed | |
| 3 | "Why this bet?" basis one tap away | not reviewed | |
| 4 | Combo tray and suggested combos | not reviewed | |
| 5 | Landing (`/about`) and pricing (`/pricing`) | not reviewed | |
| 6 | Sign-in (Google, email + password, magic link), 18+/Terms, onboarding | not reviewed | |
| 7 | Account page: export, delete, sign out everywhere | not reviewed | |
| 8 | Billing: Checkout, trial, webhook, portal, entitlements (mock) | not reviewed | |
| 9 | Server paywall and row trimming (Free vs Premium) | not reviewed | |
| 10 | Alerts and email (unsubscribe) | not reviewed | |
| 11 | Extension: popup, side panel, Premium gate, disclaimer | not reviewed | |
| 12 | Admin (`/admin`), 404 for non-admins | not reviewed | |
| 13 | Legal pages, footer disclaimer on every page, SEO, 404/500 | not reviewed | |
| 14 | Security: RLS, CSP, CSRF, rate limits, input checks | not reviewed | |
| 15 | Data refresh and `/api/health` | not reviewed | |

## Owner-only (cannot be reviewed in a cloud container)
Live Stripe charge, live Kalshi fill and fee formula, Vercel Pro 5-minute cron, lawyer review of the legal pages.
These are kept out of the feature table on purpose, so a mock can't pass them.

## Walk-through 1: signed out, phone (390 px)
Status: not yet walked.
Problems:
- (none logged yet: not walked)

## Walk-through 2: Free account, phone (390 px)
Status: not yet walked.
Problems:
- (none logged yet: not walked)

## Walk-through 3: Premium account, phone (390 px)
Status: not yet walked.
Problems:
- (none logged yet: not walked)

## Fixed log
(empty)
