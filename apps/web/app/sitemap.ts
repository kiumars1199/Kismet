// sitemap.xml (docs/14 §6, T-76): public pages only. Add "/about" when Lane S moves the landing there.
import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

const PUBLIC_PAGES = ["/", "/pricing", "/track-record", "/terms", "/privacy", "/refunds", "/disclaimer", "/contact"];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return PUBLIC_PAGES.map((p) => ({ url: `${base}${p === "/" ? "" : p}`, changeFrequency: p === "/" ? "hourly" : "monthly", priority: p === "/" ? 1 : 0.5 }));
}
