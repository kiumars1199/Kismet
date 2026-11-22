// F14: GET /api/markets/<id>/history -> the best side's price history for the drawer chart (output/history.json).
// Gated like /api/markets/[id]: same rate limit, store and 404 for an unknown market; a price history is the market's
// public price, not a model number, so every tier gets it and no reveal is spent. No history = points [].
import { getHistory } from "@/lib/data/history";
import { notFound, withTier } from "@/lib/data/respond";
import { pointsOf } from "@/lib/history/points";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withTier(req, "markets", async (store) => {
    if (!(store.byId.get(id) ?? store.flagsById.get(id))) return notFound("Market");
    const file = await getHistory();
    const s = file?.series[id];
    return Response.json({
      id, side: s?.side ?? null, interval_s: s?.dt ?? null, venue: "Polymarket",
      points: s ? pointsOf(s) : [],
    });
  });
}
