// GET /api/kalshi → Kalshi markets (top MAX by volume) and Kalshi Combos from output/kalshi.json (docs/03 § kalshi.json).
// 404 unless KALSHI_DATA_PERMISSION=true and the scan wrote the file (docs/16 §2). Same body for everyone (no tier, no
// cookies), so a shared cache may hold it for one scan cadence.
import { kalshiDataEnabled } from "@/lib/kalshiCombo";
import { getKalshi } from "@/lib/data/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_MARKETS = 200;

export async function GET(): Promise<Response> {
  const data = kalshiDataEnabled() ? await getKalshi() : undefined;
  if (!data) return Response.json({ error: "Not available" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  return Response.json(
    { ...data, markets: data.markets.slice(0, MAX_MARKETS) },
    { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600" } },
  );
}
