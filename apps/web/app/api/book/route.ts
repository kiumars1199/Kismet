// GET /api/book?token=<clob token id>&q=<win prob>&cat=<category>&stake=<optional usd>
// Live execution check (docs/07-execution.md). Book cached 5 s per token.
import { z } from "zod";
import { guard } from "@/lib/abuse";
import { getMe } from "@/lib/auth/server";
import { getBook, MIN_EDGE } from "@/lib/book";
import { check, edgeWarning, feeRate, STAKES } from "@/lib/execution";
import { freeExecution } from "@/lib/data/gate";
import { can } from "@/lib/entitlements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bad = (error: string, status = 400) => Response.json({ error }, { status });

// docs/15: zod on every input, unknown keys rejected, numbers bounded.
const Query = z.object({
  token: z.string().trim().regex(/^\d{1,100}$/, "token must be a CLOB token id"),
  q: z.coerce.number().gt(0, "q must be a win probability between 0 and 1").lt(1, "q must be a win probability between 0 and 1"),
  cat: z.string().max(40).optional(),
  stake: z.union([z.literal(""), z.coerce.number().gt(0).max(1e7, "stake must be a positive USD amount")]).optional(),
}).strict();

export async function GET(req: Request): Promise<Response> {
  const parsed = Query.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) return bad(parsed.error.issues[0]?.message ?? "bad query");
  const { token, q, cat } = parsed.data;
  const stake = typeof parsed.data.stake === "number" ? parsed.data.stake : null;
  const me = await getMe();
  const refused = await guard(req, "book", me.user?.id);   // BotID + 30/min
  if (refused) return refused;
  try {
    const { at, book } = await getBook(token);
    if (!book) return Response.json({ verdict: "no book", book_ok: false, fetched_at: at });
    const stakes = stake === null || STAKES.includes(stake) ? STAKES : [...STAKES, stake].sort((a, b) => a - b);
    const ex = check(q, book, feeRate(cat ?? null), MIN_EDGE, { stakes });
    const warning = ex.book_ok ? edgeWarning(ex.net_edge) : undefined;
    // Free: verdict and the first share only (docs/08 execution: "verdict")
    const shaped = can(me.tier, "full_execution") ? ex : freeExecution(ex);
    return Response.json({ ...shaped, ...(warning ? { warning } : {}), fetched_at: at });
  } catch (e) {
    return bad(e instanceof Error ? e.message : "order book unavailable", 502);
  }
}
