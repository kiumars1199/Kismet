import { eventBody, notFound, withStore } from "@/lib/data/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withStore((store) => {
    const markets = store.byEvent.get(id);
    return markets ? Response.json(eventBody(store, markets)) : notFound("Event");
  });
}
