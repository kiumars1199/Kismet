// Who am I + plan (docs/08 useEntitlements). Polled by the checkout success page, so never cached.
import { cookies } from "next/headers";
import { isAdminEmail } from "@/lib/admin/core";
import { adminEnabled, authEnabled, getMe, supabaseAdmin } from "@/lib/auth/server";
import { TOPICS_COOKIE } from "@/lib/filters/default-topics";
import { syncTopicsCookie } from "@/lib/repo/server";
import { billingMode } from "@/lib/billing/stripe";
import { DEMO_MODE } from "@/lib/config";
import { navFeatures } from "@/lib/beta";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const me = await getMe();
  // F5: a device that hasn't heard the saved topics yet (new browser, cookie cleared) learns them here, once
  if (me.user && adminEnabled() && !(await cookies()).get(TOPICS_COOKIE)) {
    try {
      const full = await supabaseAdmin().from("profiles").select("favorite_topics, topics_off").eq("user_id", me.user.id).maybeSingle();
      // before the topics_off migration the column is missing: fall back to the topics alone
      const row = full.error ? (await supabaseAdmin().from("profiles").select("favorite_topics").eq("user_id", me.user.id).maybeSingle()).data : full.data;
      await syncTopicsCookie(row);
    } catch { /* best effort */ }
  }
  return Response.json(
    // admin: decided here on the server from ADMIN_EMAILS; only shows or hides the header link (/admin checks again)
    { ...me, demo: DEMO_MODE, auth: authEnabled(), billing: billingMode() !== null, admin: isAdminEmail(me.user, process.env.ADMIN_EMAILS, DEMO_MODE), nav: navFeatures(me) },
    { headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } },
  );
}
