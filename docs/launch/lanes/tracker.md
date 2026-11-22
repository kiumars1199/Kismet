# Lane: tracker (builder, Sonnet, wave 2)
Read `_common.md` first. Feature: **F11** in `SPEC.md`.

**You own:** `apps/web/app/journal/`, `apps/web/components/journal/`, `apps/web/app/api/settle/`, journal parts of
`apps/web/lib/repo/`. **Don't touch:** engine, checker internals, billing. The "I placed this" button on
`BetCard` and in the checker is shared: ask the lead and the checker lane.

**Build on:**
- `public.journal` table in `supabase/migrations/20261117000000_init.sql` (RLS on), repo layer
  `lib/repo/{supabase,local,schemas}.ts` with `useCollection`, page `components/journal/JournalView.tsx` (+ test).
- Settlement: `app/api/settle/run` and the engine ledger (`engine/ledger.py`, `output/ledger.jsonl`) already
  grade flags; reuse their result source for user bets. Polymarket US grading fields are in `lib/types.ts`
  (`us_result`, `us_settled_by`).
- P&L math: `lib/calc.ts` (fees), money stored as integer cents, shown as dollars and multipliers.
- Closing price: store the last price before close; "Beat the closing price" = your price < closing price.
- `journal` is a Pro feature (`lib/entitlements.ts`).

**Tests:** e2e `launch-f11-log`, unit settlement (≥ 6 cases incl. fees), RLS test in `supabase/tests`,
`components/journal/JournalView.test.tsx` keeps passing.
