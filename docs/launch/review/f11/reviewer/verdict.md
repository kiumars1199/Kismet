# F11 #58 31bf544: FAIL (merge conflict with final; code passes Done-when)

Head 31bf544 unchanged. CI web/python/supply-chain green. Unit journal-f11 + journal + rls 40/40.
Probe: paid mock (next dev), 390 and 1440, signed out / Free / Pro / Premium (probe.log, PNGs here).
Baseline: merge base 34f672f, same probe, free+pro at 390 (base-final/probe.log).

1. BLOCKER: now conflicts with final (after #45/#64 merged) in apps/web/components/market/BetCard.tsx:
   final adds the "Check" link (checkHref), PR adds <LogBetButton>. Keep both.
2. Checker integration missing: SPEC says "on any card or the checker". /check (F2 #45) is now on final, so the
   rebase should add "I placed this" there too (or record a deferral in decisions.md).
3. New layout shift at 390 for Pro/Premium: CLS 0.063 (DIV.mx-auto ... max-w-[140 y215->146 at ~3-6 s).
   Base 34f672f Pro 390 = 0.000; Free is 0.064 on both (pre-existing). Under the 0.1 bar, but introduced by F11.
   Premium 1440 0.040 (same element y147->85).
4. "Profit by sport" groups by category (Sports/Politics), not by sport; topic labels read "Cfb" vs chart "CFB".
5. Free sees a "Track your bets with Pro" link on every card (10 per page): consider one upsell, not per card.
Passing: one tap logs $100 at 69% on 7077574 (shares 142.715, fee 0.0107) -> row on /journal, totals match (+$42.72);
settlement unit cases with fees (>= 6, incl. split); RLS SQL B-vs-A on journal; sport and topic totals add up to P&L;
signed out sees no button; disclaimer everywhere; no horizontal scroll.
Gap: signed-in steps on the E2E mock only (no live test accounts).
