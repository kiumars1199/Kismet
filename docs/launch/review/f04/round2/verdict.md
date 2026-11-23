# F4 #52 42ee0ba round 2 (moved from 17229de/39e3f74): see message
pytest 139; typecheck/lint OK; vitest venues 12/12; build OK (/m 175 kB); check:js 144.4 kB (on 39e3f74; 42ee0ba changes only store/types/schemas/fixture); e2e launch-f04-venues 7/7 (42ee0ba).
Probe (39e3f74 build, probe.log): 6674492 US "Not listed" = card "International only"; 7078474 US 1.34x 73% = card "Pays 1.34x on Polymarket US"; basis expand 44 px with source, time, match %; no cents; no hscroll; disclaimer.
/m CLS 390: 0.17-0.19 with KALSHI_TRADING_ENV=demo (paper Trade button), 0.004 without (probe-nopaper.log); 1440 0.002-0.007.
Merged f01b 3f4f74e locally: git merge clean but tsc fails: types.ts duplicate kalshi_matched_ticker (f01b `string | null` vs #52 `string`). After removing f01b's line: tsc OK, vitest parse-link/kalshi-price/venues-store 23/23, build OK, POST /api/check kalshi.com/.../KXFIXTURE-6674492 -> 6674492, KXFIXTURE-7077573 -> 7077573 (merged-f01b/).
