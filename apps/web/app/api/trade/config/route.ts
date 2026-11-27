// GET /api/trade/config → whether the paper-trading ticket shows for this user (docs/16 §4).
import { getMe } from "@/lib/auth/server";
import { pausedResponse } from "@/lib/account/pause";
import { KALSHI_RISK_URL } from "@/lib/trade/intent";
import { currentUser, extensionId, tradingAllowed, tradingEnv } from "@/lib/trade/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  const env = tradingEnv();
  const id = extensionId();   // null in production without NEXT_PUBLIC_EXTENSION_ID: no ticket (RT-14)
  const off = { enabled: false, env, extensionId: id ?? "", riskUrl: KALSHI_RISK_URL };
  // Trading off on this deploy: answer before reading anyone's profile.
  if (!env || !id) return Response.json(off, { headers: { "cache-control": "no-store" } });
  const paused = pausedResponse(await getMe());   // F8: 423 while paused, like the other data routes
  if (paused) return paused;
  const user = await currentUser(req);
  const allowed = tradingAllowed(user?.email ?? null);
  return Response.json(
    { enabled: allowed, env, extensionId: id ?? "", riskUrl: KALSHI_RISK_URL },
    { headers: { "cache-control": "no-store" } },
  );
}
