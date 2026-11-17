// GET  /api/combos/kalshi → { enabled } (whether the combo tray offers the Kalshi check)
// POST /api/combos/kalshi { legs: [{ ticker, side }] } → ComboQuote. 404 unless KALSHI_DATA_PERMISSION=true (docs/18 §5.3).
import { ComboCheckBody, kalshiDataEnabled, lookupCombo } from "@/lib/kalshiCombo";
import { sameOrigin } from "@/lib/trade/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = () => Response.json({ enabled: kalshiDataEnabled() }, { headers: { "cache-control": "no-store" } });

export async function POST(req: Request): Promise<Response> {
  if (!kalshiDataEnabled()) return Response.json({ error: "Not available" }, { status: 404 });
  if (!sameOrigin(req)) return Response.json({ error: "Bad origin" }, { status: 403 });
  const body = ComboCheckBody.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Pick 2 to 6 Kalshi legs" }, { status: 400 });
  return Response.json(await lookupCombo(body.data), { headers: { "cache-control": "no-store" } });
}
