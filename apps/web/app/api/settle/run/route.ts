// /api/settle/run — daily journal settlement + CLV, Vercel Cron (docs/05 F-12, apps/web/vercel.json).
// Needs the cron secret. The demo journal settles client-side via POST /api/settle; the server job over
// Supabase journal rows belongs to the accounts lane (docs/10 T-46) and plugs in here.
import { DEMO_MODE } from "@/lib/config";
import { cronAuthorized, unauthorized } from "@/lib/cron";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function run(req: Request): Promise<Response> {
  if (!cronAuthorized(req)) return unauthorized();
  if (DEMO_MODE) return Response.json({ ran: false, reason: "demo mode settles the journal on page load" });
  return Response.json({ ran: false, reason: "server settlement not installed yet (T-46)" });
}

export const GET = run;
export const POST = run;
