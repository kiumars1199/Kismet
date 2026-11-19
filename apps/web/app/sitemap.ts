// sitemap.xml (docs/14 §6, T-76): every public page. test/seo.test.ts fails when a new public page is missing.
import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

const PUBLIC_PAGES = ["/", "/bets", "/about", "/markets", "/tools", "/pricing", "/track-record", "/status", "/terms", "/privacy", "/refunds", "/disclaimer", "/contact", "/signup"];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return PUBLIC_PAGES.map((p) => ({ url: `${base}${p === "/" ? "" : p}`, changeFrequency: p === "/" ? "hourly" : "monthly", priority: p === "/" ? 1 : 0.5 }));
}
