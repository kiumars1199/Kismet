// Used by the Chrome extension (docs/09): open CORS. Shaped by the caller's plan (T-44): no session = Free.
import { eventBody, notFound, withTier } from "@/lib/data/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

export const OPTIONS = () => new Response(null, { status: 204, headers: CORS });

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // No BotID: the Chrome extension calls this from its worker (no BotID script there); rate limit only.
  return withTier(req, "markets", (store, tier) => {
    const markets = store.bySlug.get(decodeURIComponent(slug).toLowerCase());
    const body = markets && eventBody(store, markets, tier);
    return body ? Response.json(body, { headers: CORS }) : notFound("Event", CORS);
  }, { headers: CORS, bot: false });
}
