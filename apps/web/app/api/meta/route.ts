import type { MetaResponse } from "@/lib/api";
import { withStore } from "@/lib/data/respond";
import { topicsOf } from "@/lib/taxonomy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = () =>
  withStore((store) => {
    const topics: Record<string, number> = {};
    for (const m of store.markets) for (const id of topicsOf(m)) topics[id] = (topics[id] ?? 0) + 1;
    const body: MetaResponse = {
      meta: store.meta,
      loaded_at: store.loadedAt,
      counts: { markets: store.markets.length, flags: store.flags.length, events: store.byEvent.size },
      facets: { ...store.facets, topics },
      results: store.ledgerSummary ? { graded: store.ledgerSummary.graded, wins: store.ledgerSummary.wins, losses: store.ledgerSummary.losses, avg_pnl: store.ledgerSummary.avg_pnl } : null,
    };
    return Response.json(body);
  });
