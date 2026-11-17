// Used by the Chrome extension (docs/09): open CORS. Premium gating comes with T-44 (not in demo).
import { eventBody, notFound, withStore } from "@/lib/data/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

export const OPTIONS = () => new Response(null, { status: 204, headers: CORS });

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return withStore((store) => {
    const markets = store.bySlug.get(decodeURIComponent(slug).toLowerCase());
    return markets ? Response.json(eventBody(store, markets), { headers: CORS }) : notFound("Event", CORS);
  }, CORS);
}
