# Handoff: polish round (docs/19) — Nov 19, 2026

The owner's machine shuts down at 3:30 PM EST. This file says what is done, what is in progress and what is next,
so a cloud session can continue. Work on `final`; every push to `final` deploys kismetodds.com (Vercel project
`kismet`), so only push green work (web: lint, typecheck, unit, build; Python: pytest).

## Done (on `final`)
- **T-266 (79b3f7d)**: `.github/workflows/refresh.yml` scans every 30 min and uploads `output/*.json` to the Supabase
  bucket `scan` (`ops/upload.py`); a full update + refit runs every 2 h (`17 */2`) and on manual runs. Every refresh
  run had been failing on Gamma's `422 offset too large`; `pipeline/fetch_closed.py` now splits the window instead
  (test: `engine/tests/test_closed_events_offset.py`). The 2 secrets the owner must add are in `LAUNCH_TODO.md` item 12.

## In progress
Lanes started at ~1:05 PM, each on its own branch (pushed to origin before shutdown; names below once known):
- P3 + P4 (free tier 10/day seeded sample + locked cards; card copy "Bet $10 → get $13 if it wins").
- P2 + P8 (Google button behind `NEXT_PUBLIC_GOOGLE_AUTH=1`, Sign up / Log in, admin plan grants, first-run tour).
- P1 (landing page for signed-out visitors).
- Kalshi markets + combo quotes behind `KALSHI_DATA_PERMISSION` (scanner, data contract, app page).
- Research notes (P2 tour, P5, P6 baseline, P7 patterns, P9 friction) in `docs/research/`.

## Next steps
1. Finish and merge any lane branch not yet in `final` (see list above).
2. P5: run `python pipeline/fetch_closed.py --days 730 --per-tag 4000` (resumable), refit, report counts; show
   `by_pays` 2–3x/3–5x/5–10x on /results; plain warning on the Pays filter if those bands lose; combos page per docs/18.
3. P6 speed, P7 UI pass (Impeccable, before/after screenshots at 390/1440 in `docs/screenshots/polish/`), P9 friction fixes.
4. Full audit (`docs/OVERNIGHT.md` §3) by a fresh auditor, loop to zero fails; then `ops/smoke-prod.sh https://kismetodds.com`.

## Environment notes
- `git fetch` fails with `bad object refs/remotes/origin/final 2` (an iCloud duplicate ref on the owner's Mac).
  Use `GIT_REF_PARANOIA=0 git fetch`. A cloud clone doesn't have this ref.
- The GitHub repo is now `kiumars1199/Kismet` (old name redirects).
- Owner actions: the 2 Actions secrets (LAUNCH_TODO item 12); `ADMIN_EMAILS=kismetodds@gmail.com` in Vercel;
  `NEXT_PUBLIC_GOOGLE_AUTH=1` only after Google OAuth is set up in Supabase.
