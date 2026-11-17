// GET /api/combos → CombosResponse: suggested combos, the same for everyone (docs/18 §5.2), shaped per tier.
import { gateCombos, suggestCombos } from "@/lib/data/combos";
import { withTier } from "@/lib/data/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = () => withTier((store, tier) => Response.json(gateCombos(suggestCombos(store), tier)));
