// GET /api/kalshi → Kalshi markets (top MAX by volume) and Kalshi Combos from output/kalshi.json (docs/03 § kalshi.json).
// 404 unless canBeta("kalshi") (beta: testers only; live: KALSHI_DATA_PERMISSION=true, docs/16 §2) and the scan wrote the file. Same body for everyone (no tier, no
// cookies), so a shared cache may hold it for one scan cadence.
import { getMe } from "@/lib/auth/server";
import { canBeta, isBeta } from "@/lib/beta";
import { getKalshi } from "@/lib/data/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_MARKETS = 200;

export async function GET(): Promise<Response> {
  const data = canBeta(await getMe(), "kalshi") ? await getKalshi() : undefined;
  if (!data) return Response.json({ error: "Not available" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  return Response.json(
    { ...data, markets: data.markets.slice(0, MAX_MARKETS) },
    // in beta the answer depends on who asks, so no shared cache
    { headers: isBeta("kalshi") ? { "Cache-Control": "private, no-store", Vary: "Cookie" } : { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600" } },
  );
}
