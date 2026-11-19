// GET /api/combos → CombosResponse: suggested combos, the same for every Premium user (docs/18 §5.2); other plans get
// none (docs/19 P3: combos are Premium), so the Combos row hides.
import { gateCombos, suggestCombos } from "@/lib/data/combos";
import { withTier } from "@/lib/data/respond";
import { can } from "@/lib/entitlements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = (req: Request) => withTier(req, "markets", (store, tier) => Response.json(can(tier, "combos") ? gateCombos(suggestCombos(store), tier) : { groups: [] }));
