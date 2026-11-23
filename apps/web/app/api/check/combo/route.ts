// POST /api/check/combo { legs: [{ m, side }] } (SPEC F2): the combo's inputs, one entry per leg (chance, sample, price, fee,
// basis). The whole combo is ONE check against the same daily Free allowance as /api/check, counted under a key of the
// sorted market:side list: re-scoring the same set is free; a different combo, or a single check after it, is the next
// check and answers 429 { code: "check_limit" }. Same for every account.
import { z } from "zod";
import { sameOrigin } from "@/lib/auth/server";
import { readJson, TOO_LARGE, tooLarge } from "@/lib/body";
import { liveMarketBody, withTier } from "@/lib/data/respond";
import { MAX_COMBO_LEGS, MIN_COMBO_LEGS } from "@/lib/check/combo";
import { similarBasis } from "@/components/market/labels";
import { comboKey, countCheck } from "@/lib/check/limit";
import { isOpenIn, NOT_OPEN } from "@/lib/check/open";
import { buildCheck, type ComboLegsResponse } from "@/lib/check/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Leg = z.object({ m: z.string().trim().min(1).max(120), side: z.union([z.literal(0), z.literal(1)]) }).strict();
const Body = z.object({ legs: z.array(Leg).min(MIN_COMBO_LEGS).max(MAX_COMBO_LEGS) }).strict();

export async function POST(req: Request) {
  if (!sameOrigin(req)) return Response.json({ error: "Bad origin" }, { status: 403 });
  const raw = await readJson(req, 8 * 1024);
  if (raw === TOO_LARGE) return tooLarge();
  const parsed = Body.safeParse(raw);
  if (!parsed.success) return Response.json({ error: `A combo has ${MIN_COMBO_LEGS} to ${MAX_COMBO_LEGS} legs`, code: "bad_request" }, { status: 400 });
  const { legs } = parsed.data;
  if (new Set(legs.map((l) => l.m)).size !== legs.length) return Response.json({ error: "A bet can be in a combo once", code: "duplicate" }, { status: 400 });

  return withTier(req, "markets", async (store, tier, me) => {
    const markets = legs.map((l) => store.byId.get(l.m) ?? store.flagsById.get(l.m));
    if (markets.some((m) => !m || !isOpenIn(m, store))) return Response.json({ error: NOT_OPEN, code: "not_found" }, { status: 404 });

    const c = await countCheck(req, tier, me.user?.id, comboKey(legs), 0);
    if (!c.ok) return Response.json({ error: "Free includes 1 check a day. Upgrade for unlimited checks.", code: "check_limit", left: 0 }, { status: 429 });

    const out: ComboLegsResponse["legs"] = [];
    for (const [i, m] of markets.entries()) {
      const body = await liveMarketBody(store, m!, tier, "pro");
      const one = buildCheck(body.market, legs[i]!.side, undefined, 100);
      if (!one) return Response.json({ error: "Side not found", code: "not_found" }, { status: 404 });
      // only what the combo view needs: the leg's inputs and basis (no per-leg chance/edge/score results, no other side)
      const side = one.sides.find((x) => x.index === one.side)!;
      // the leg's basis in the drawer's plain wording ("about 130 similar past bets in NFL match-winner bets")
      const ms = body.market.sides.find((x) => x.side_index === one.side);
      out.push({ m: one.market.id, side: one.side, base: side.base, basis: ms ? similarBasis(body.market, ms) : side.basis });
    }
    return Response.json({ legs: out });
  });
}
