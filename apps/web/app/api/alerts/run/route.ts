// /api/alerts/run — server alert evaluator, Vercel Cron every 5 min (docs/05 F-11, docs/10 T-45, apps/web/vercel.json).
// Vercel Cron sends GET; POST is kept for manual runs and the post-scan trigger. Both need the cron secret.
// Evaluates every user's enabled Supabase alert_rules with the service role (lib/alerts-server.ts).
import { runServerAlerts } from "@/lib/alerts-server";
import { adminEnabled, supabaseAdmin } from "@/lib/auth/server";
import { liveExecution } from "@/lib/book";
import { DEMO_MODE } from "@/lib/config";
import { cronAuthorized, unauthorized } from "@/lib/cron";
import { marketsPage } from "@/lib/data/respond";
import { getStore } from "@/lib/data/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function run(req: Request): Promise<Response> {
  if (!cronAuthorized(req)) return unauthorized();
  if (DEMO_MODE) return Response.json({ ran: false, reason: "demo mode evaluates alerts in the browser" });
  if (!adminEnabled()) return Response.json({ ran: false, reason: "Supabase service role not configured" });
  try {
    const store = await getStore();   // live data: only Pro and Premium rules fire
    const counts = await runServerAlerts(supabaseAdmin(), {
      fetchMarkets: async (q) => marketsPage(store, q),
      fetchMarket: async (id) => store.flagsById.get(id) ?? store.byId.get(id) ?? null,
      fetchBook: liveExecution,
    });
    return Response.json({ ran: true, ...counts });
  } catch (e) {
    console.error("[alerts/run]", (e as Error).message);
    return Response.json({ ran: false, error: "alert run failed" }, { status: 500 });
  }
}

export const GET = run;
export const POST = run;
