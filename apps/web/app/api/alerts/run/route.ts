// /api/alerts/run — server alert evaluator, Vercel Cron every 5 min (docs/05 F-11, apps/web/vercel.json).
// Vercel Cron sends GET; POST is kept for manual runs and the post-scan trigger. Both need the cron secret.
// The evaluator over Supabase alert_rules belongs to the accounts lane (docs/10 T-45); until it lands,
// this answers 200 with ran:false so the cron stays green.
import { DEMO_MODE } from "@/lib/config";
import { cronAuthorized, unauthorized } from "@/lib/cron";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function run(req: Request): Promise<Response> {
  if (!cronAuthorized(req)) return unauthorized();
  if (DEMO_MODE) return Response.json({ ran: false, reason: "demo mode evaluates alerts in the browser" });
  return Response.json({ ran: false, reason: "server evaluator not installed yet (T-45)" });
}

export const GET = run;
export const POST = run;
