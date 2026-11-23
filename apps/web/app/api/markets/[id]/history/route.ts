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
import { can } from "@/lib/entitlements";
import { downsample } from "@/lib/history/downsample";
import { pointsOf } from "@/lib/history/points";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withTier(req, "markets", async (store, tier) => {
    const m = store.byId.get(id) ?? store.flagsById.get(id);
    if (!m) return notFound("Market");
    const side = m.best.side_index;
    const cut = store.meta.scanned_at;
    // A bucket's price is the last raw price inside it, so a bucket that ENDS after the cut can carry a price from after it.
    // A delayed tier (Free) therefore keeps only buckets that end at or before the cut; a live tier keeps the one that starts
    // before it. On the live CLOB path the raw points are cut first and downsampled after, so neither case can leak.
    const delayed = !can(tier, "live_data");
    const file = await getHistory();
    const held = file?.series[id];
    let series = held && held.side === side ? held : null;
    let source: "file" | "live" = "file";
    let points = series ? pointsOf(series).filter((x) => (delayed ? x.t + series!.dt <= cut : x.t <= cut)) : [];
    if (!series && m.venue !== "us") {   // US-native rows have no international token
      const raw = await liveHistory(m.tokens?.[side] || undefined, side);
      series = raw ? downsample(raw.filter((x) => x.t <= cut), cut, side) : null;
      source = "live";
      points = series ? pointsOf(series) : [];
    }
    const last = points.at(-1);
    return Response.json({
      id, side: last ? series!.side : null, interval_s: last ? series!.dt : null, venue: "Polymarket",
      source: last ? source : null,
      // the value is the last price inside its bucket: the bucket's end (never past the cut) says how new it can be
      as_of: last ? Math.min(last.t + series!.dt, cut) : null,
      points,
    });
  });
}
