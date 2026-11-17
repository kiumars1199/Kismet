// GET /api/book?token=<clob token id>&q=<win prob>&cat=<category>&stake=<optional usd>
// Live execution check (docs/07-execution.md). Book cached 5 s per token.
import { getBook, MIN_EDGE } from "@/lib/book";
import { check, edgeWarning, feeRate, STAKES } from "@/lib/execution";
import { getTier } from "@/lib/auth/server";
import { freeExecution } from "@/lib/data/gate";
import { can } from "@/lib/entitlements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bad = (error: string, status = 400) => Response.json({ error }, { status });

export async function GET(req: Request): Promise<Response> {
  try {
    const p = new URL(req.url).searchParams;
    const token = p.get("token")?.trim();
    const q = Number(p.get("q"));
    const stakeRaw = p.get("stake");
    const stake = stakeRaw == null || stakeRaw === "" ? null : Number(stakeRaw);
    if (!token || !/^\d+$/.test(token)) return bad("token must be a CLOB token id");
    if (!(q > 0 && q < 1)) return bad("q must be a win probability between 0 and 1");
    if (stake !== null && !(stake > 0 && stake <= 1e7)) return bad("stake must be a positive USD amount");

    const { at, book } = await getBook(token);
    if (!book) return Response.json({ verdict: "no book", book_ok: false, fetched_at: at });
    const stakes = stake === null || STAKES.includes(stake) ? STAKES : [...STAKES, stake].sort((a, b) => a - b);
    const ex = check(q, book, feeRate(p.get("cat")), MIN_EDGE, { stakes });
    const warning = ex.book_ok ? edgeWarning(ex.net_edge) : undefined;
    // Free: verdict and the first share only (docs/08 execution: "verdict")
    const shaped = can(await getTier(), "full_execution") ? ex : freeExecution(ex);
    return Response.json({ ...shaped, ...(warning ? { warning } : {}), fetched_at: at });
  } catch (e) {
    return bad(e instanceof Error ? e.message : "order book unavailable", 502);
  }
}
