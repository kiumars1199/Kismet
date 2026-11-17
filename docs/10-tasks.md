# 10 · Build tasks

Run lanes in parallel (one agent per lane). Inside a lane, go in order. **★ = needed for tonight's demo.**
Each task: one PR named `T-xx: title`, done only when its checks pass.

## Lane A — Engine & data (Python)
| ID | Task | Spec | Done when |
|---|---|---|---|
| T-01 ★ | Publish `output/*.json` to `live` branch now (run workflow once by hand: Actions → refresh → Run) | 02 | `live` branch exists with all 5 files |
| T-02 | Scan adds `volume_24h` (Gamma `volume24hr`), `created_at` (`createdAt`), `ask_size`/`bid_size` (`bestAsk` size via book for flags only), `competitive = abs(mid-0.5)` | 04 parity | fields present in `markets.json`; types updated |
| T-03 | Extend `NICHE_TAGS`/`CATEGORY_PRIORITY` (mlb, ncaab, ufc, boxing, golf, f1, cricket, xrp, fed, economy) and re-fit | 03 §2 | new niches appear in `model.json` |
| T-04 | Flag ledger: append flags each scan to `output/ledger.jsonl`; daily grader (result, pnl, CLV); summary `output/ledger_summary.json` | F-29 | after 2 scans, ledger has rows; grader unit test on fixture |
| T-05 | Event endpoint data: `output/events.json` index {slug → event_id, market ids} for the extension | 09 | lookup by slug works |
| T-06 | Engine tests: `engine/tests/` for `execution.check`, `fill`, `capacity`, model fit on synthetic data (perfect calibration recovers θ≈[0,1,0,0,0]) | 07 | `pytest` green in CI |
| T-07 | Workflow hardening: retry, run `pytest` before publish, fail if `markets_scanned < 1000`, upload logs as artifact | 02 | a forced failure keeps the previous `live` data |
| T-08 | Weather history: fetch fidelity-60 history for weather within 30 days of resolution so older weather enters backtest | README limits | weather folds > 3 weeks in backtest |

## Lane B — Web foundation
| ID | Task | Spec | Done when |
|---|---|---|---|
| T-10 ★ | Scaffold `apps/web`: Next 15, TS strict, Tailwind, shadcn/ui, theme tokens (06), app shell with header/footer/disclaimer, mobile tab bar | 06 | `pnpm dev` shows shell; Lighthouse a11y ≥ 90 |
| T-11 ★ | Types + zod schemas from `03` §1; `lib/data/store.ts` (GitHub or local source, 120 s cache, in-flight dedupe, indexes, derived fields, search index) | 02, 03, 04 | unit tests: load fixture, derive period/city/frequency, search "jaguars" finds the NFL game |
| T-12 ★ | `lib/execution.ts` TS port of `engine/execution.py` + `/api/book` (5 s cache, Polymarket `POST /books`) | 07 | matches Python on `engine/tests/fixtures/book_expected.json` to 4 decimals |
| T-13 ★ | `lib/filters/*`: FilterState schema, URL serialize/parse, `apply()`, facets, grouping, sort comparators, taxonomy tree (`03` §2) | 04 | property test round-trips; facet counts correct on fixture |
| T-14 ★ | API routes: `/api/meta`, `/api/markets`, `/api/markets/[id]`, `/api/flags`, `/api/events/[id]`, `/api/events/by-slug/[slug]`, `/api/model/curve`, `/api/backtest` | 02 | contract tests with fixture store; p95 < 150 ms for 15k rows |
| T-15 ★ | `lib/repo` interface with `LocalRepo` (localStorage) for presets, watchlist, favorites, journal, display prefs | 03 §3 | swap-able with SupabaseRepo later; unit tests |

## Lane C — Screener & core pages
| ID | Task | Spec | Done when |
|---|---|---|---|
| T-20 ★ | `/markets`: MarketTable (virtualized, grouped by event, sortable, column chooser), mobile cards, applied pills, pagination | F-01 | 15k rows scroll smoothly; URL drives state |
| T-21 ★ | FilterPanel with all sections + quick chips + facet counts | F-03, 04 | every FilterState field reachable in UI |
| T-22 ★ | Search box (`/`), paste-URL jump | F-02 | |
| T-23 ★ | MarketDrawer: both sides, verdict card, stake table + custom stake, CurveChart, why-text, track record, warnings, event links | F-04, F-05, 07 | live book refresh every 5 s while open |
| T-24 ★ | `/flags` page with VerdictStrip | F-06 | |
| T-25 ★ | `/event/[id]` and `/m/[id]` (+ OG image route) | F-16, F-26 | |
| T-26 ★ | `/track-record`: tiles, fold chart, edge buckets, calibration chart, limitations, methodology | F-14 | numbers equal `backtest.json` |
| T-27 ★ | `/tools` calculators | F-15 | unit tests for each formula |
| T-28 ★ | Landing `/` and `/pricing` | F-20 | live counters from `/api/meta` |
| T-29 ★ | FreshnessPill + `/status` | F-24 | thresholds amber 3 h, red 6 h |

## Lane D — User features
| ID | Task | Spec | Done when |
|---|---|---|---|
| T-30 ★ | Presets: built-ins, save/rename/duplicate/delete/default/share, dirty state, reorder | F-07 | survives reload; share link reproduces view |
| T-31 ★ | Favorite topics picker + pinned chips + favorites filter | F-08 | |
| T-32 ★ | Watchlist: star everywhere, `/watchlist` with "since saved", target price field | F-09 | |
| T-33 | Onboarding (3 steps) | F-19 | skippable; sets favorites |
| T-34 | Display settings (odds format, density, timezone, theme) | F-17 | odds converter unit-tested |
| T-35 | Keyboard shortcuts + help dialog | F-27 | |
| T-36 | Dashboards (react-grid-layout, panel kinds) | F-10 | layout persists |
| T-37 | Journal: log from drawer, table, tiles, charts, CSV import/export | F-12 | P&L math tests |
| T-38 | Kelly sizing in drawer + `/tools` | F-13 | capped by capacity |
| T-39 | CSV export of current view | F-18 | 5k row cap |

## Lane E — Paid infrastructure
| ID | Task | Spec | Done when |
|---|---|---|---|
| T-40 | Supabase project, SQL migrations from `03` §3, RLS policies, signup trigger | 03, 08 | RLS test: user A can't read user B rows |
| T-41 | Auth pages (magic link, Google), session in server components, 18+/terms checkbox, local→account import | 08 | |
| T-42 | `SupabaseRepo` implementing `lib/repo` | 03 | same tests as LocalRepo pass |
| T-43 | Stripe: products/prices script, checkout, portal, webhook, `stripe_events` idempotency | 08 | test-mode end-to-end upgrade + cancel |
| T-44 | Entitlements + server-side gating in API routes + `<UpgradeGate>` | 08 | free user gets trimmed payloads (contract test) |
| T-45 | Alerts: rule editor, evaluator route + Vercel Cron, Resend email templates, web push (VAPID, service worker), webhooks (Premium), inbox | F-11, F-23 | dedupe test; unsubscribe link works |
| T-46 | Journal settlement + CLV daily job | F-12 | settles a fixture market |
| T-47 | Settings pages incl. billing, data export, delete account | F-21 | |
| T-48 | Admin page | F-28 | allow-list only |

## Lane F — Chrome extension (after T-14, T-44)
| ID | Task | Spec | Done when |
|---|---|---|---|
| T-50 | Scaffold MV3 (Vite + CRX plugin), popup with sign-in state + disclaimer | 09 | loads unpacked |
| T-51 | Content script: slug → API → badges in shadow DOM; SPA navigation | 09 | badges on 5 sample event pages (NFL, soccer, weather, crypto, politics) |
| T-52 | Side panel drawer (shared components) | 09 | |
| T-53 | `/ext/connect` token handoff, tier lock | 09 | non-Premium sees lock |
| T-54 | Telemetry for selector breakage + floating pill fallback | 09 | |
| T-55 | Store assets + listing text + privacy disclosures | 09 | |

## Lane G — Quality & launch
| ID | Task | Spec | Done when |
|---|---|---|---|
| T-60 ★ | Fixtures: `apps/web/test/fixtures/{markets,flags,model,backtest}.json` (500-row slices of real output) | 12 | used by unit + e2e |
| T-61 ★ | Playwright smoke flows S1–S6 | 12 | green in CI |
| T-62 | GitHub Actions CI for web (lint, typecheck, test, e2e on preview) | 12 | required check |
| T-63 | Legal pages: Terms, Privacy, Disclaimer (plain-language drafts, marked for review) | 01 | linked in footer |
| T-64 | Analytics (PostHog): page views, filter usage, preset saves, upgrade funnel | — | events visible |
| T-65 | Launch checklist in `12-test-plan.md` complete | 12 | |

## Tonight's critical path (demo)
T-01 → T-10 → T-11 → T-13 → T-14 → T-20 → T-21 → T-23 → T-24 → T-30/31/32 → T-26 → T-28 → T-61.
Parallel: T-12 (execution port) with T-13; T-27, T-29 anytime after T-10; T-60 first thing in Lane G.
Demo runs with `DATA_SOURCE=local` (reads `../../output`) or `github` once T-01 is done, no auth,
`LocalRepo`, tier forced to `pro`.
