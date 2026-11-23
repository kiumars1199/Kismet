# Reviewer: F13 #51 cd2e444 (E2E mock; the invites migration is not on live)
The builder's own evidence is in ../f13/evidence.md on the branch. This folder holds the reviewer's evidence only.

## Checks
- typecheck, lint: pass. vitest for lib/invites, test/invites-sql (PGlite), og-bet, lib/share and rls: 6 files, 61/61 pass (checks.log).
- build and check:js: / is 142.6 kB, under the 150 kB budget (build.log).
- e2e-paid launch-f13-invite: 3/3. CLS on /account at 390 is 0.0005 (e2e-paid.log).

## Done when
1. `GET /api/og/bet/<id>` returns a 1200×630 PNG with the multiplier and %, no cents: **met only when signed in** (og-probe.log, og-*.png).
   - The image matches the drawer: "Pays 1.49x", 80% (390-drawer-6674176.png). Unknown ids return 404.
   - **Signed out it returns 401** (Finding 1).
2. Self-referral unit with at least 5 cases: MET. There are 9 guard cases (same account, same email, inviter's address, same domain and IP within 24 h, after 24 h, different domain or IP, unverified email, no salt).
3. The reward is granted once at 5, stacks on an existing comp end date, and never lowers a paid plan: MET (invites-sql: once, stacks, expired comp, paid Pro, paid Premium, open-ended comp).
4. The migration is additive (3 new tables and 1 function), and RLS keeps rows private to the inviter: MET (invites-sql: A sees their own rows, B sees none, clients can't write, clients can't call grant).

## Findings
1. **MEDIUM. The share image route is not public.**
   - `/api/og/bet` is missing from PUBLIC_API in lib/auth/public-paths.ts, so signed out it returns 401.
   - That means the "OG image route" can't be fetched by link-preview crawlers (iMessage, X, TikTok) or by signed-out viewers.
   - The link that Share and Copy link send is `/m/<id>`, whose og:image is the older `/m/<id>/opengraph-image`, not this route. So the new share image never appears in a link preview.
   - The route's own comment ("a signed-out crawler learns nothing a Free account doesn't see") says it was meant to be public.
   - Fix: add `/api/og/bet` to PUBLIC_API, and point the `/m/<id>` og:image at it (or reuse its renderer).
2. **LOW. "Pending" invites are never promoted.**
   - recordSignup runs once, at first sign-in. An invitee whose email is unconfirmed then stays `pending` forever and never counts.
   - This only matters if live allows a password sign-in before the email is confirmed.
3. **LOW. Self-referral IP checks are weak.**
   - The IP rules need INVITE_IP_SALT set on Vercel; unset, the IP checks are skipped.
   - "Inviter's own sessions" only means the last 5 addresses where the inviter opened /api/invite (/account or the share sheet).
4. **LOW. Shared bet links don't carry the invite code.**
   - Share and Copy link send `/m/<id>` without the invite code, so a friend who arrives from a shared bet never counts toward the reward.
5. **NOTE. Merge conflicts.**
   - The branch conflicts with final 651462b in apps/web/app/account/page.tsx (F8 added the /account help line).
   - It conflicts with #49 in apps/web/test/rls.test.ts (both add a function to the list).
   - The drawer screenshot has no RiskNote because the branch predates F8.

## Addendum: invite UI (from the builder's screenshots: account-390, share-sheet-390 and share-sheet-3-of-5-1440 on the branch)
- The QR code, the "n of 5" counter with its bar, and the link field render with no cents and no overflow at 390 or 1440.
6. **LOW. The share image disagrees with the drawer** (builder-share-sheet-3-of-5-1440.png).
   - The image says "10% chance to win".
   - The drawer for the same side says "wins about 1 in 7" and "won 15% before". The banded chance rounds 14–15% down to 10%.
   - The shared side is also one the drawer marks "Priced above… −59%, Not recommended": the share button shares whichever side is open.
7. **LOW. A trial ends the reward for good.**
   - In grant_invite_reward, a user on a Premium trial (status 'trialing') or on paid Premium when their 5th invite verifies gets a `skipped_paid_premium` row.
   - The invite_rewards primary key then blocks any later grant, so a trial user whose trial lapses never gets the month.
