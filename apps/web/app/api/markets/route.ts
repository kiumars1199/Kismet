import { gateMarkets } from "@/lib/data/gate";
import { marketsPage, withTier } from "@/lib/data/respond";
import { can } from "@/lib/entitlements";
import { parse } from "@/lib/filters/url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = (req: Request) =>
  withTier((store, tier) => {
    const f = { ...parse(new URL(req.url).searchParams) };
    // Free: first page only (top 25 rows), exact numbers as ranges (docs/08 LIMITS)
    const page = marketsPage(store, can(tier, "live_data") ? f : { ...f, page: 1 });
    return Response.json(gateMarkets(page, tier));
  });
