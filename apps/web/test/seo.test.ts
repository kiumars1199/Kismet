import { describe, expect, it } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";

describe("robots.txt and sitemap.xml (T-76)", () => {
  const rules = [robots().rules].flat();
  it("blocks AI crawlers everywhere and keeps search engines out of the app and API", () => {
    const ai = rules.find((r) => [r.userAgent].flat().includes("GPTBot"))!;
    for (const bot of ["ClaudeBot", "CCBot", "PerplexityBot", "Google-Extended", "Bytespider"]) expect([ai.userAgent].flat()).toContain(bot);
    expect(ai.disallow).toBe("/");
    const all = rules.find((r) => r.userAgent === "*")!;
    expect(all.disallow).toEqual(expect.arrayContaining(["/api/", "/account", "/login"]));
  });
  it("lists public pages only", () => {
    const urls = sitemap().map((e) => new URL(e.url).pathname);
    expect(urls).toEqual(expect.arrayContaining(["/", "/pricing", "/terms", "/privacy", "/refunds", "/disclaimer", "/contact"]));
    for (const u of urls) expect(["/api", "/account", "/login", "/settings", "/journal"].some((p) => u.startsWith(p))).toBe(false);
  });
});
