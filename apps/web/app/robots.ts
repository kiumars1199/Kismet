// robots.txt (docs/14 §6, T-76). AI crawlers may ignore this; middleware also refuses them (lib/bots.ts, docs/15).
import type { MetadataRoute } from "next";
import { AI_BOTS } from "@/lib/bots";
import { siteUrl } from "@/lib/site";

/** Signed-in app pages and plumbing: nothing for a search engine there. */
const PRIVATE = ["/api/", "/auth/", "/login", "/onboarding", "/account", "/settings", "/watchlist", "/journal", "/alerts", "/dashboards", "/admin"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: AI_BOTS, disallow: "/" },
      { userAgent: "*", allow: "/", disallow: PRIVATE },
    ],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
