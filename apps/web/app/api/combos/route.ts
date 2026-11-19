// GET /api/combos → CombosResponse: suggested combos, the same for every Premium user (docs/18 §5.2); other plans get
// none (docs/19 P3: combos are Premium), so the Combos row hides.
import { COMBO_PAYS, browseCombos, gateCombos, suggestCombos, type ComboPays } from "@/lib/data/combos";
import { withTier } from "@/lib/data/respond";
import { can } from "@/lib/entitlements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ?pays=2|3|5|10: the Combos page (docs/19 P5), combos paying at least that much; anything else is the Best bets row.
export const GET = (req: Request) => withTier(req, "markets", (store, tier) => {
  if (!can(tier, "combos")) return Response.json({ groups: [] });
  const pays = Number(new URL(req.url).searchParams.get("pays"));
  const groups = COMBO_PAYS.includes(pays as ComboPays) ? browseCombos(store, pays as ComboPays) : suggestCombos(store);
  return Response.json(gateCombos(groups, tier));
});
