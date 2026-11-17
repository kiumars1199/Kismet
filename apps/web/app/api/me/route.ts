// Who am I + plan (docs/08 useEntitlements). Polled by the checkout success page, so never cached.
import { authEnabled, getMe } from "@/lib/auth/server";
import { billingMode } from "@/lib/billing/stripe";
import { DEMO_MODE } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const me = await getMe();
  return Response.json(
    { ...me, demo: DEMO_MODE, auth: authEnabled(), billing: billingMode() !== null },
    { headers: { "Cache-Control": "no-store" } },
  );
}
