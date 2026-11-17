// Session refresh (docs/08, docs/15 § Auth) and sign-in prompt for account-only pages (docs/14 §1).
// Does nothing in demo mode or before Supabase is configured.
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const COOKIE_OPTIONS = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/" };
const SIGNED_IN_ONLY = ["/account", "/watchlist", "/journal", "/alerts", "/dashboards"];

export async function middleware(req: NextRequest) {
  const url = process.env.SUPABASE_URL, anon = process.env.SUPABASE_ANON_KEY;
  if (process.env.DEMO_MODE !== "false" || !url || !anon) return NextResponse.next();

  let res = NextResponse.next({ request: req });
  const supabase = createServerClient(url, anon, {
    cookieOptions: COOKIE_OPTIONS,
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) req.cookies.set(name, value);
        res = NextResponse.next({ request: req });
        for (const { name, value, options } of list) res.cookies.set(name, value, { ...options, ...COOKIE_OPTIONS });
      },
    },
  });
  const { data } = await supabase.auth.getUser();   // refreshes an expired access token; revoked session → null

  const path = req.nextUrl.pathname;
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
