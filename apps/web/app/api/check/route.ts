// POST /api/check { m | link, side?, price?, stake? } (SPEC F1). One check = one call; editing price or stake on the page
// recomputes in the browser (lib/check/compute.ts) and does not come back here. Free: 1 check a day (lib/check/limit.ts),
// the second answers 429 { code: "check_limit" } and computes nothing. The body depends only on market/side/price/stake.
import { z } from "zod";
import { sameOrigin } from "@/lib/auth/server";
import { readJson, TOO_LARGE, tooLarge } from "@/lib/body";
import { notFound, liveMarketBody, withTier } from "@/lib/data/respond";
import { MAX_STAKE, MIN_STAKE, validate } from "@/lib/check/compute";
import { CHECK_USED_COOKIE, CHECK_USED_MAX_AGE, checkUsedCookie, countCheck } from "@/lib/check/limit";
import { isOpenIn, NOT_OPEN } from "@/lib/check/open";
import { parseLink, resolveLink } from "@/lib/check/parse-link";
import { buildCheck } from "@/lib/check/response";
import { kalshiOwnPrices } from "@/lib/check/kalshi-price";
import { getKalshiIndex } from "@/lib/data/store";
import { kalshiDataEnabled } from "@/lib/kalshiCombo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  m: z.string().trim().min(1).max(120).optional(),
  link: z.string().trim().min(1).max(500).optional(),
  side: z.union([z.literal(0), z.literal(1)]).default(0),
  price: z.number().optional(),
  stake: z.number().default(100),
}).strict().refine((b) => !!b.m !== !!b.link, { message: "Send m or link" });

export async function POST(req: Request) {
  if (!sameOrigin(req)) return Response.json({ error: "Bad origin" }, { status: 403 });
  const raw = await readJson(req, 4 * 1024);
  if (raw === TOO_LARGE) return tooLarge();
  const parsed = Body.safeParse(raw);
  if (!parsed.success) return Response.json({ error: "Send a market id or a link", code: "bad_request" }, { status: 400 });
  const { m: id, link, side, price, stake } = parsed.data;
  const bad = validate(price ?? 0.5, stake);   // price omitted = the market's own, checked below
  if (bad) return Response.json({ error: bad === "stake_range" ? `Stake must be between $${MIN_STAKE} and $${MAX_STAKE.toLocaleString("en-US")}.` : "Price must be between 1% and 99%.", code: bad }, { status: 400 });

  return withTier(req, "markets", async (store, tier, me) => {
    let kalshiParts: string[] | null = null;
    let market = id ? (store.byId.get(id) ?? store.flagsById.get(id)) : undefined;
    if (link) {
      const p = parseLink(link);
      market = p ? (resolveLink(p, store) ?? undefined) : undefined;
      if (p?.venue === "kalshi") kalshiParts = p.parts.map((x) => x.toLowerCase());
    }
    if (!market || !isOpenIn(market, store)) return Response.json({ error: NOT_OPEN, code: "not_found" }, { status: 404 });
    if (!market.sides.some((s) => s.side_index === side)) return notFound("Side");

    const c = await countCheck(req, tier, me.user?.id, market.id, side);
    if (!c.ok) return Response.json({ error: "Free includes 1 check a day. Upgrade for unlimited checks.", code: "check_limit", left: 0 }, { status: 429 });

    // exact numbers for a check, like the Free drawer reveal: the same figures the Pro card and drawer show
    const body = await liveMarketBody(store, market, tier, "pro");
    const out = buildCheck(body.market, side, price, stake);
    if (!out) return notFound("Side");
    // A Kalshi link also shows Kalshi's own Yes price for the pasted ticker (same for every account: gated by the data permission only)
    if (kalshiParts && kalshiDataEnabled()) {
      const bs = body.market.best;
      const own = kalshiOwnPrices((await getKalshiIndex())?.rows ?? [], kalshiParts, { index: bs.side_index as 0 | 1, outcome: bs.outcome });
      if (own) out.kalshi = own;
    }
    // Free, allowance now used: tell the /check page (a hint cookie) so the next different check opens on the limit card at once
    const headers: Record<string, string> = c.left === 0
      ? { "Set-Cookie": `${CHECK_USED_COOKIE}=${encodeURIComponent(checkUsedCookie(market.id, side))}; Path=/; Max-Age=${CHECK_USED_MAX_AGE}; SameSite=Lax; HttpOnly${process.env.NODE_ENV === "production" && !process.env.E2E_MOCK ? "; Secure" : ""}` }
      : {};
    return Response.json(out, { headers });
  });
}
