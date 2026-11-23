// Which late-arriving buttons of the /m action row this user will get, decided on the server so the row keeps their slots from the
// first paint (TradeButton and AddToCombo render nothing until /api/trade/config and /api/me answer; mounting them re-wrapped the row
// and moved the page below by 50 px at 390 px). Trade uses the same check as /api/trade/config; combos the same rule as the button.
import "server-only";
import { getMe } from "@/lib/auth/server";
import { canBeta } from "@/lib/beta";
import type { ActionReserve } from "@/components/market/MarketDetail";
import { extensionId, tradingAllowed, tradingEnv } from "./server";

export async function actionReserve(): Promise<ActionReserve> {
  const me = await getMe();
  return {
    trade: !!tradingEnv() && !!extensionId() && tradingAllowed(me.user?.email ?? null),
    combo: canBeta(me, "combos"),
  };
}
