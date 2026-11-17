// POST /api/settle  body { ids: string[] } (Polymarket market ids from the local My bets journal)
// → { [id]: { resolved, winner_side_index: 0|1|null, closing_prices: [p0|null, p1|null] } }
// Demo-mode settlement (docs/05 F-12, docs/10 demo deltas). winner null + resolved = void (50/50).
// closing price = each side's last trade price before the market's end (CLOB prices-history), for CLV.
import type { Settlement } from "@/lib/journal";
import { settleOne } from "@/lib/settle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_IDS = 200;

export async function POST(req: Request): Promise<Response> {
  let ids: unknown;
  try { ids = ((await req.json()) as { ids?: unknown }).ids; } catch { /* fall through */ }
  if (!Array.isArray(ids) || !ids.every((x) => typeof x === "string" && /^[\w-]{1,80}$/.test(x)))
    return Response.json({ error: "body must be { ids: string[] }" }, { status: 400 });
  const unique = [...new Set(ids as string[])].slice(0, MAX_IDS);
  const out: Record<string, Settlement> = {};
  // ponytail: 8 concurrent Gamma calls; fine for a personal journal
  for (let i = 0; i < unique.length; i += 8) {
    const chunk = unique.slice(i, i + 8);
    const res = await Promise.all(chunk.map(settleOne));
    chunk.forEach((id, j) => { out[id] = res[j]!; });
  }
  return Response.json(out);
}
