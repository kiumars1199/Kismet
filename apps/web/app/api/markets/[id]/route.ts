import type { MarketResponse } from "@/lib/api";
import { categoryRecord, curve, segmentOf } from "@/lib/data/model";
import { gateMarket } from "@/lib/data/gate";
import { notFound, withTier } from "@/lib/data/respond";
import { reveal } from "@/lib/data/reveals";
import { can } from "@/lib/entitlements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ?detail=1 = the details panel opening. Free: exact numbers for 3 markets a day (docs/08), ranges otherwise.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = new URL(req.url).searchParams.get("detail") === "1";
  return withTier(async (store, tier, me) => {
    const m = store.byId.get(id) ?? store.flagsById.get(id);
    if (!m) return notFound("Market");
    let shown = tier;
    let reveals_left: number | undefined;
    if (!can(tier, "exact_edge") && detail) {
      const r = await reveal(tier, me.user, id);
      if (r.ok) shown = "pro";
      reveals_left = r.left;
    }
    const segment = segmentOf(m);
    const body: MarketResponse = {
      market: gateMarket(store.flagsById.get(id) ?? m, shown),   // the flag row carries best.realistic_edge
      segment,
      curve: curve(store.model, segment, m.horizon_h),
      backtest: categoryRecord(store.backtest, m.category),
      event_markets: (store.byEvent.get(m.event_id) ?? []).filter((x) => x.id !== id).map((x) => gateMarket(x, tier)),
      ...(reveals_left !== undefined ? { reveals_left } : {}),
    };
    return Response.json(body);
  });
}
