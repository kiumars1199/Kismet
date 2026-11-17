// robots.txt (docs/14 §6, T-76). AI crawlers may ignore this; docs/15 enforces it server-side (Lane X).
import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

const AI_BOTS = [
  "GPTBot", "ChatGPT-User", "OAI-SearchBot", "ClaudeBot", "Claude-Web", "anthropic-ai", "CCBot", "PerplexityBot",
  "Perplexity-User", "Google-Extended", "Applebot-Extended", "Bytespider", "Amazonbot", "meta-externalagent",
  "FacebookBot", "cohere-ai", "Diffbot", "ImagesiftBot", "Omgilibot", "Timpibot", "YouBot",
];

/** Signed-in app pages and plumbing: nothing for a search engine there. */
const PRIVATE = ["/api/", "/auth/", "/login", "/onboarding", "/account", "/settings", "/watchlist", "/journal", "/alerts", "/dashboards"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: AI_BOTS, disallow: "/" },
      { userAgent: "*", allow: "/", disallow: PRIVATE },
    ],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
