# #54 1979f82: PASS with notes
Diff: /api/trade/config returns pausedResponse(await getMe()) first (423, private no-store, Vary: Cookie); new test 2/2 pass locally. CI all green.
Notes: 1) getMe() now runs on every config call, before the tradingEnv/extensionId check: on a deploy with trading off, each page that mounts
TradeButton costs a subscriptions + profiles read for a route that will answer enabled:false anyway. Check tradingEnv() && extensionId() first.
2) getMe throws on a failed subscriptions read -> this route 500s -> useTradeConfig null (button hidden): acceptable.
