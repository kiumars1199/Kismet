// GET /api/check/search?q=<words> (SPEC F1): public, minimal word lookup for the checker, so a signed-out visitor can find a
// market. Returns at most 4 rows of id, title, side and payout multiplier, nothing else (no edge, return, chance or bands).
// Rate-limited like /api/suggest (the "suggest" rule, per IP signed out / per user) and BotID-checked via withTier.
import { z } from "zod";
import { withTier } from "@/lib/data/respond";
import { apply, paysOf } from "@/lib/filters/apply";
import { FilterState } from "@/lib/filters/state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface CheckSearchResponse { markets: { id: string; question: string; side_index: 0 | 1; outcome: string; pays: number | null }[] }

const Query = z.object({ q: z.string().trim().min(2).max(120) }).strict();

export async function GET(req: Request): Promise<Response> {
  const parsed = Query.safeParse({ q: new URL(req.url).searchParams.get("q") ?? "" });
  if (!parsed.success) return Response.json({ error: "Type at least 2 characters (at most 120)" }, { status: 400 });
  return withTier(req, "suggest", (store) => {
    const page = apply(store, FilterState.parse({ q: parsed.data.q, view: "markets", group_by_event: false, page_size: 4 }));
    const markets = page.rows.map((r) => ({
      id: r.market.id, question: r.market.question, side_index: r.side.side_index, outcome: r.side.outcome, pays: paysOf(r.side),
    }));
    return Response.json({ markets } satisfies CheckSearchResponse, { headers: { "Cache-Control": "private, max-age=30" } });
  });
}
