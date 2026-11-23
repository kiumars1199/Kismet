// F14: GET /api/markets/<id>/history -> the best side's price history for the drawer chart.
// Source: output/history.json (the engine's series for Best bets rows) first, else one live fetch from Polymarket's public
// CLOB for any other market the store holds (lib/data/history-live.ts: <= 200 points, <= 90 days, 10 min cache, 3 s timeout).
// Gated like /api/markets/[id]: same rate limit, store and 404 for an unknown market; a price history is the market's public
// price, not a model number, so every tier gets it and no reveal is spent. The tier's delay applies: points newer than the
// scan the tier's store is from are cut (Free's data is delayed, its chart must not be fresher than its numbers).
// No history (none exists, fetch failed, not on Polymarket) = points [].
import { getHistory } from "@/lib/data/history";
import { liveHistory } from "@/lib/data/history-live";
import { notFound, withTier } from "@/lib/data/respond";
import { pointsOf } from "@/lib/history/points";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withTier(req, "markets", async (store) => {
    const m = store.byId.get(id) ?? store.flagsById.get(id);
    if (!m) return notFound("Market");
    const side = m.best.side_index;
    const file = await getHistory();
    const held = file?.series[id];
    let series = held && held.side === side ? held : null;
    let source: "file" | "live" = "file";
    if (!series && m.venue !== "us") {   // US-native rows have no international token
      series = await liveHistory(m.tokens?.[side] || undefined, side);
      source = "live";
    }
    const cut = store.meta.scanned_at;
    const points = series ? pointsOf(series).filter((x) => x.t <= cut) : [];
    return Response.json({
      id, side: points.length ? series!.side : null, interval_s: points.length ? series!.dt : null, venue: "Polymarket",
      source: points.length ? source : null, as_of: points.length ? points.at(-1)!.t : null,
      points,
    });
  });
}
