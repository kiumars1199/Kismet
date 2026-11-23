# F14 #53 59831df: FAIL
Delta 341f340..59831df: app/m/[id]/page.tsx (reserveTrade), MarketDetail, TradeButton (invisible slot), e2e spec. History route/downsample/as_of
unchanged since 341f340 (code-reviewed then: Free cut, live path cut before downsample, as_of correct; 341f340 unit 16/16).
1. Permanent hole for users not on the trading allow-list: slot shows while cfg is null, but /api/trade/config answers enabled:false for them, so
   useTradeConfig stays null forever. Paid env + KALSHI_TRADING_ENV=demo + TRADING_ALLOWLIST, Pro user: slot still there after 6 s
   (390: 125x46 at x16; 1440: 303x46), no Trade button; allow-listed user: slot replaced by button. notlisted-390-m.png. (Prod impact only if prod
   sets KALSHI_TRADING_ENV=demo and NEXT_PUBLIC_EXTENSION_ID.) Fix: decide on the server (tradingAllowed for the request) or drop the slot on enabled:false.
2. The 50 px jump at 390 is not fixed: demo next start, trading on, 6 fresh-browser loads each: /m/7078474 0.185-0.186, /m/6674492 0.151-0.163
   (+0.432 footer swap on 3 of 12, #62's). row-probe: first paint row = [slot][star][Alert][link] one line; late = Trade + "Add to combo" -> 2 lines,
   headline y445 -> 495. AddToCombo mounts after useEntitlements (Premium/demo), same shape of bug. 1440: 0.002-0.003 except footer swap.
3. PR #53 is mergeable=false (dirty vs final): no CI ran for 59831df. Also conflicts with #62 70d8f6b on the same <Suspense>/<MarketDetail> lines in app/m/[id]/page.tsx.
4. Spec now drops footer-only shifts from the CLS e2e: fine only once #62 lands.
