import { eventBody, notFound, withTier } from "@/lib/data/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withTier((store, tier) => {
    const markets = store.byEvent.get(id);
    return markets ? Response.json(eventBody(store, markets, tier)) : notFound("Event");
  });
}
