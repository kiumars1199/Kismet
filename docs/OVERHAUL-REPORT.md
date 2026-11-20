# Overhaul report (Nov 20, 2026)

Evidence for every item in `docs/OVERHAUL.md` (sections 0, A–G). Raw lane notes: `docs/overhaul-evidence/<lane>/NOTES.md`.
Before screenshots and prod headers (taken 16:58 UTC, before any change): `docs/overhaul-evidence/before/`.

## Decisions made without Q
1. **Push once at the end.** Q chose this when asked; recorded here because CLAUDE.md now says every push to `final` deploys prod. All lanes merge on local `overhaul`; one push to `final` after all gates pass on the merged tree.
2. **Playwright browser path.** The pinned Playwright (1.65.1) wants Chromium build 1255; the sandbox has 1243. Added an opt-in `PW_CHROMIUM_PATH` launch override to both Playwright configs (unset = old behaviour, CI unaffected). WebKit 27.2 was downloaded for §D after opening the Playwright CDN on the session network.
3. **Network.** Created a personal cloud environment "MarketEdge" for this session (Playwright CDN, kismetodds.com, Polymarket hosts, research sources). No secrets added.
4. **Lane F1 superseded by `claude/us-venue`** (Q's instruction). F1's own WIP fetcher (`worktree-agent-aef7f199d3acc4117`, `pipeline/fetch_polymarket_us.py`) is not merged, to avoid duplicate matcher code. Its live findings (gateway endpoints, slug patterns, 27% exact-bet coverage, 46/46 side agreement) are kept in the F1 evidence notes.
5. **Migration numbering.** `alert_events(rule_id)` index renumbered to `20261120000400_…` so it doesn't collide with lane F2–4's `…0200_funnel_events.sql`.
6. **Banned-word rule** (§A/§B checks): one helper, `apps/web/lib/banned.ts`. Whole words, case-insensitive, on visible text + `<title>` + meta/og/twitter descriptions; scripts, RSC payloads and URLs excluded (so "scripts" ≠ pts, "event" ≠ EV). Landing also bans counts above 3 digits (times and years excluded).

## Waiting for Q
- Apply Supabase migrations `20261120000200_funnel_events.sql`, `20261120000300_lifecycle_emails.sql`, `20261120000400_alert_events_rule_id_index.sql` to the live project (not applied by agents).
- Set secrets: GitHub `RESEND_API_KEY`, `ALARM_EMAIL_FROM`; Vercel `RESEND_API_KEY`, `EMAIL_FROM`, `UNSUBSCRIBE_SECRET`, `CRON_SECRET`. Rerun `node ops/stripe-setup.mjs` so the webhook subscribes to `invoice.paid` (touches live Stripe config).
- `vercel.json` now has 3 crons; confirm the Vercel plan allows it (fallback: run trial reminders from `/api/settle/run`).

## Merged
- PR #3 `claude/us-venue` (kiumars1199/Kismet): merged via `overhaul` (3 commits: 29282c9, d40090f, ddf9cfd).
