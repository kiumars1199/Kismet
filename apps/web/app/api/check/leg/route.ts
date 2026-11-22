// POST /api/check/leg { m | link, side? } (SPEC F2): looks up one leg for the combo checker. It returns lookup data only
// (title, side, price, venue): no chance, edge, score or sample, so it is not a free check. Scoring is POST /api/check/combo.
import { z } from "zod";
import { sameOrigin } from "@/lib/auth/server";
import { readJson, TOO_LARGE, tooLarge } from "@/lib/body";
import { notFound, withTier } from "@/lib/data/respond";
import { isOpenIn, NOT_OPEN } from "@/lib/check/open";
import { parseLink, resolveLink } from "@/lib/check/parse-link";
import { buildLeg } from "@/lib/check/response";

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

  return withTier(req, "markets", (store) => {
    let market = id ? (store.byId.get(id) ?? store.flagsById.get(id)) : undefined;
    if (link) {
      const p = parseLink(link);
      market = p ? (resolveLink(p, store) ?? undefined) : undefined;
    }
    if (!market || !isOpenIn(market, store)) return Response.json({ error: NOT_OPEN, code: "not_found" }, { status: 404 });
    const out = buildLeg(market, side);
    return out ? Response.json(out) : notFound("Side");
  });
}
