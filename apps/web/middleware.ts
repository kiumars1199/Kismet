// Session refresh (docs/08, docs/15 § Auth) and sign-in prompt for account-only pages (docs/14 §1).
// Refuses AI crawlers always (docs/15); the session part does nothing in demo mode or before Supabase is configured.
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isAdminEmail, mfaRequired } from "@/lib/admin/core";
import { maintenanceOn } from "@/lib/maintenance";
import { isAiBot } from "@/lib/bots";
import { DEMO_MODE } from "@/lib/config";

const COOKIE_OPTIONS = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/" };
const SIGNED_IN_ONLY = ["/account", "/watchlist", "/journal", "/alerts", "/dashboards"];
// Reachable during maintenance (T-142): sign-in (so an admin can always get back in), session, uptime check.
const MAINTENANCE_OPEN = ["/login", "/auth", "/api/auth", "/api/me", "/api/health", "/maintenance"];
const under = (path: string, list: string[]) => list.some((p) => path === p || path.startsWith(p + "/"));
const hidden = () => Response.json({ error: "Not found" }, { status: 404, headers: { "Cache-Control": "private, no-store" } });


/** docs/15 § Headers. Per-request nonce: Next stamps it on its own scripts (every page renders dynamically,
 *  see app/layout.tsx). 'strict-dynamic' lets those scripts load chunks, Sentry, PostHog and BotID. */
export function csp(nonce: string, dev = process.env.NODE_ENV !== "production") {
  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "") ?? "";
  const posthog = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://js.stripe.com https://va.vercel-scripts.com${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",   // React style={} attributes (charts, virtual rows)
    "img-src 'self' data: blob: https:",
    "font-src 'self'",
    `connect-src 'self' ${supabase} ${supabase.replace(/^https/, "wss")} ${posthog} https://*.posthog.com https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://api.stripe.com https://vitals.vercel-insights.com${dev ? " ws:" : ""}`.replace(/ +/g, " "),
    "frame-src https://js.stripe.com https://checkout.stripe.com",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
  ].join("; ");
}

export async function middleware(req: NextRequest) {
  // AI crawlers get nothing, demo mode included (robots.txt itself stays reachable: not matched below).
  if (isAiBot(req.headers.get("user-agent"))) return new NextResponse("Automated access is not allowed.", { status: 403 });
  const policy = csp(btoa(crypto.randomUUID()));
  // Next reads the nonce from the request's CSP header; the browser enforces the response's.
  const next = () => {
    const headers = new Headers(req.headers);
    headers.set("content-security-policy", policy);
    const r = NextResponse.next({ request: { headers } });
    r.headers.set("content-security-policy", policy);
    return r;
  };
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // /api/admin* for a non-admin: 404 before routing, whatever the method or path (the routes' requireAdmin()
  // stays the real guard). With no auth configured, or in demo mode, nobody is an admin.
  const adminApi = under(req.nextUrl.pathname, ["/api/admin"]);
  if (DEMO_MODE || !url || !anon) return adminApi ? hidden() : next();

  let res = next();
  const supabase = createServerClient(url, anon, {
    cookieOptions: COOKIE_OPTIONS,
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) req.cookies.set(name, value);
        res = next();
        for (const { name, value, options } of list) res.cookies.set(name, value, { ...options, ...COOKIE_OPTIONS });
      },
    },
  });
  const { data } = await supabase.auth.getUser();   // refreshes an expired access token; revoked session → null

  const path = req.nextUrl.pathname;
  const admin = isAdminEmail(data.user && { email: data.user.email, verified: !!data.user.email_confirmed_at }, process.env.ADMIN_EMAILS, DEMO_MODE) &&
    (!mfaRequired(process.env.ADMIN_REQUIRE_MFA) || (await supabase.auth.mfa.getAuthenticatorAssuranceLevel()).data?.currentLevel === "aal2");   // RT3-06
  if (adminApi && !admin) return hidden();
  if (!under(path, MAINTENANCE_OPEN) && (await maintenanceOn(url))) {
    if (!admin) {
      if (path.startsWith("/api/")) {
        return Response.json({ error: "MarketEdge is down for maintenance. Try again shortly." }, { status: 503, headers: { "Retry-After": "300" } });
      }
      const headers = new Headers(req.headers);
      headers.set("content-security-policy", policy);
      const to = req.nextUrl.clone();
      to.pathname = "/maintenance";
      to.search = "";
      const r = NextResponse.rewrite(to, { request: { headers }, status: 503 });
      r.headers.set("content-security-policy", policy);
      r.headers.set("Retry-After", "300");
      return r;
    }
  }
  if (!data.user && SIGNED_IN_ONLY.some((p) => path === p || path.startsWith(p + "/"))) {
    const to = req.nextUrl.clone();
    to.pathname = "/login";
    to.search = `?next=${encodeURIComponent(path + req.nextUrl.search)}`;
    return NextResponse.redirect(to);
  }
  return res;
}

export const config = {
  // pages and API routes; skip static assets, images, the Stripe webhook (raw body, no session) and e2e mock
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|opengraph-image|robots.txt|sitemap.xml|api/stripe/webhook|e2e-mock).*)"],
};
