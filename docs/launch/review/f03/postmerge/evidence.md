# F3 post-merge production check (final 9ad7713), Nov 22 2026 ~23:38 UTC
- Vercel production dpl_BNPEzPQno3fZW1tnwb9bNPjtLdiD READY on 9ad7713; Railway deploy 6871fc5d SUCCESS on 9ad7713 (23:35 UTC).
- First /api/meta after the Vercel deploy (23:36): counts.kalshi = 2000 (fallback: top of kalshi.json; kalshi_index.json not yet written). meta-prod-before-kalshi-index.json
- After the Railway scan + Kalshi crawl uploaded kalshi_index.json (23:38): counts = {markets 15686, polymarket 15686, kalshi 172680}. meta-prod.json
  -> polymarket >= 15000 and kalshi >= 150000: MET.
- /api/markets (all queries) -> 401 signed out; /markets?q=…, /markets?ven=kalshi, /bets?topic=<id> -> 307 /signup. Search across all markets and the
  Kalshi topic tree on production need a signed-in production account (no account was made: no writes to live Supabase). Same features were checked on the PR
  (review/f03/round2: e2e 27/27, Jokic direct load, Kalshi NFL topic).
