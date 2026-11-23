# #75 1b4db4e: StateLink next=/index fix

Setup: next build + next start, playwright webServer env (DEMO_MODE=true, DATA_DIR=test/fixtures, HISTORY_LIVE=off), plus NEXT_PUBLIC_DEMO_MODE=true.
- 3315 = wt75 (1b4db4e); 3316 = wtf40 (final 40acce0).

| Check | 1b4db4e | 40acce0 |
|---|---|---|
| "/" build mode | static (○, revalidate 5m) | static (○, revalidate 5m) |
| prerendered index.html state hrefs | 4x /state?next=%2F | 4x /state?next=%2F |
| served "/" with no JS (curl) | 12x /state?next=%2F | 12x /state?next=%2F |
| /index | 404 | 404 |

- Prod kismetodds.com "/" (40acce0): 4x /state?next=%2Findex, and /index returns 200.
- The bug does NOT reproduce under local next start. It is specific to Vercel, which serves "/" from the /index output.
- vitest lib/state-next.test.ts: 5/5 pass.
- Preview kismet-git-fix-statelink-index-kismet9.vercel.app: not reachable from this sandbox (curl 000).
