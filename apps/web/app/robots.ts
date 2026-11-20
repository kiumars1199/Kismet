// robots.txt (docs/14 §6, T-76). AI crawlers may ignore this; middleware also refuses them (lib/bots.ts, docs/15).
import type { MetadataRoute } from "next";
import { AI_BOTS } from "@/lib/bots";
import { siteUrl } from "@/lib/site";

/** Signed-in app pages and plumbing: nothing for a search engine there. */
const PRIVATE = ["/api/", "/auth/", "/login", "/reset-password", "/onboarding", "/account", "/settings", "/watchlist", "/journal", "/alerts", "/dashboards", "/admin",
  "/kalshi",   // Kalshi data page: behind KALSHI_DATA_PERMISSION (docs/16 §2), not for search
  "/bets", "/markets", "/combos", "/tools", "/ext/"];   // T-276: account-only (signed out they redirect to /signup)

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: AI_BOTS, disallow: "/" },
      { userAgent: "*", allow: "/", disallow: PRIVATE },
    ],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
