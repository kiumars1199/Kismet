# PR #66 2bddbb4 (fix/trade-config-env) — reviewer
Verdict: PASS with notes (acceptable); CI web in progress at review time.
- Change: /api/trade/config returns {enabled:false, env, extensionId, riskUrl} before getMe() when KALSHI_TRADING_ENV != demo or no extension id.
  Trading on: unchanged order: paused -> 423, else tradingAllowed(email).
- Is 200 enabled:false for a paused user acceptable? Yes: the body is the same constant every caller gets (signed out too), carries no user data and
  enables nothing. F8's "data APIs 423" is about market data; this route is a feature switch. With trading on, a paused user still gets 423
  (trade-config-paused.test now stubs KALSHI_TRADING_ENV=demo to keep testing that path).
- Consumers: lib/trade/ext.ts (null when off), extension vault-ui (enabled false -> no ticket), /ext/connect (reads extensionId). A paused user
  never reaches /ext/connect: the root layout swaps every page for the PauseScreen.
- Tests: trade-config-off (2 cases, getMe not called), trade-config-paused, redteam: 14/14. typecheck, lint pass.
- Out of scope (pre-existing on final, not #66): /api/ext/token and /api/ext/token/refresh have no pause check, so an already-connected extension
  keeps refreshing its token while paused (I did not check whether its token-authenticated data calls are pause-gated).
