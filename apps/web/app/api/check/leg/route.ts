// POST /api/check/leg { m | link, side? } (SPEC F2): looks up one leg for the combo checker. A whole combo counts as ONE check
// against the same daily Free allowance as /api/check (one fixed id for the day), so adding or changing legs is free once
// the combo is open; Free's second distinct check of the day, combo or single, answers 429 { code: "check_limit" }.
import { z } from "zod";
import { sameOrigin } from "@/lib/auth/server";
import { readJson, TOO_LARGE, tooLarge } from "@/lib/body";
import { notFound, liveMarketBody, withTier } from "@/lib/data/respond";
import { countCheck } from "@/lib/check/limit";
import { parseLink, resolveLink } from "@/lib/check/parse-link";
import { buildCheck } from "@/lib/check/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  m: z.string().trim().min(1).max(120).optional(),
  link: z.string().trim().min(1).max(500).optional(),
  side: z.union([z.literal(0), z.literal(1)]).default(0),
}).strict().refine((b) => !!b.m !== !!b.link, { message: "Send m or link" });

export async function POST(req: Request) {
  if (!sameOrigin(req)) return Response.json({ error: "Bad origin" }, { status: 403 });
  const raw = await readJson(req, 4 * 1024);
  if (raw === TOO_LARGE) return tooLarge();
  const parsed = Body.safeParse(raw);
  if (!parsed.success) return Response.json({ error: "Send a market id or a link", code: "bad_request" }, { status: 400 });
  const { m: id, link, side } = parsed.data;

  return withTier(req, "markets", async (store, tier, me) => {
    let market = id ? (store.byId.get(id) ?? store.flagsById.get(id)) : undefined;
    if (link) {
      const p = parseLink(link);
      market = p ? (resolveLink(p, store) ?? undefined) : undefined;
    }
    if (!market) return Response.json({ error: "We couldn't find an open market at that link", code: "not_found" }, { status: 404 });
    if (!market.sides.some((s) => s.side_index === side)) return notFound("Side");

    const c = await countCheck(req, tier, me.user?.id, "combo", 0);
    if (!c.ok) return Response.json({ error: "Free includes 1 check a day. Upgrade for unlimited checks.", code: "check_limit", left: 0 }, { status: 429 });

    const body = await liveMarketBody(store, market, tier, "pro");
    const out = buildCheck(body.market, side, undefined, 100);
    return out ? Response.json(out) : notFound("Side");
  });
}
