import type { MarketResponse } from "@/lib/api";
import { categoryRecord, curve, segmentOf } from "@/lib/data/model";
import { notFound, withStore } from "@/lib/data/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withStore((store) => {
    const m = store.byId.get(id) ?? store.flagsById.get(id);
    if (!m) return notFound("Market");
    const segment = segmentOf(m);
    const body: MarketResponse = {
      market: store.flagsById.get(id) ?? m,   // the flag row carries best.realistic_edge
      segment,
      curve: curve(store.model, segment, m.horizon_h),
      backtest: categoryRecord(store.backtest, m.category),
      event_markets: (store.byEvent.get(m.event_id) ?? []).filter((x) => x.id !== id),
    };
    return Response.json(body);
  });
}
