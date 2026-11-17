// sitemap.xml (docs/14 §6, T-76): public pages only. /about is Lane S's landing page.
import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

const PUBLIC_PAGES = ["/", "/about", "/pricing", "/track-record", "/terms", "/privacy", "/refunds", "/disclaimer", "/contact"];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return PUBLIC_PAGES.map((p) => ({ url: `${base}${p === "/" ? "" : p}`, changeFrequency: p === "/" ? "hourly" : "monthly", priority: p === "/" ? 1 : 0.5 }));
}
