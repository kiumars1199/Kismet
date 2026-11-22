# Lane: checker (builder, Sonnet)
Read `_common.md` first. Features: **F1**, **F2**, **F6** in `SPEC.md`.

**You own:** `apps/web/app/check/`, `apps/web/components/check/`, `apps/web/app/api/check/`, `apps/web/lib/check/`,
`apps/web/lib/venues/guides.ts`. **Don't touch:** engine, journal, billing, onboarding. `BetCard` (the "Check" and
"How to bet this" links) is shared: ask the lead, and do it as its own task.

**Build on:**
- Numbers must equal what cards and the drawer show. Reuse, don't recompute: `apps/web/lib/betFigures.ts`
  (`sideChance`), `lib/format.ts` (`pct`, `ret`, multiplier formatting), `lib/calc.ts` (edge, fees, odds),
  `lib/execution.ts` (net edge after spread). The drawer is `components/market/MarketDetail.tsx`.
- Market lookup: `lib/api.ts` `fetchMarket`, `/api/markets/[id]`, `/api/suggest` for search (`components/search/`).
- Combos: `apps/web/lib/combos.ts` and `components/combo/ComboTray.tsx` already multiply leg chances; F2's
  numbers must agree with the tray.
- Daily Free limit counted on the server: copy the pattern of the Free "3 exact reveals a day" in
  `apps/web/lib/data/reveals.ts` and the rate limiting in `lib/abuse.ts`. Plan checks: `lib/entitlements.ts`
  (`can`, `quota`; adding a quota key is a shared-file task).
- Score formula and its text: SPEC F1 (also in `decisions.md`). Put it in `lib/check/score.ts`.

**Order:** F1 (blocks launch), F2 (blocks launch), then F6.

**Tests:** unit `lib/check/parse-link.test.ts`, `score.test.ts`, `combo.test.ts`, guides test; e2e
`launch-f01-checker`, `launch-f02-combo`, `launch-f06-howto`; paid e2e `launch-f01-limit`.
