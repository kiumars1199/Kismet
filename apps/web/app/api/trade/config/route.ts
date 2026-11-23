// GET /api/trade/config → whether the paper-trading ticket shows for this user (docs/16 §4).
import { getMe } from "@/lib/auth/server";
import { pausedResponse } from "@/lib/account/pause";
import { KALSHI_RISK_URL } from "@/lib/trade/intent";
import { currentUser, extensionId, tradingAllowed, tradingEnv } from "@/lib/trade/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  const paused = pausedResponse(await getMe());   // F8: 423 while paused, like the other data routes
  if (paused) return paused;
  const env = tradingEnv();
  const id = extensionId();   // null in production without NEXT_PUBLIC_EXTENSION_ID: no ticket (RT-14)
  const user = env && id ? await currentUser(req) : null;
  const allowed = !!env && !!id && tradingAllowed(user?.email ?? null);
  return Response.json(
    { enabled: allowed, env, extensionId: id ?? "", riskUrl: KALSHI_RISK_URL },
    { headers: { "cache-control": "no-store" } },
  );
}
