import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
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
    expect(all.disallow).toEqual(expect.arrayContaining(["/api/", "/account", "/login", "/reset-password"]));
  });
  it("lists public pages only", () => {
    const urls = sitemap().map((e) => new URL(e.url).pathname);
    expect(urls).toEqual(expect.arrayContaining(["/", "/pricing", "/terms", "/privacy", "/refunds", "/disclaimer", "/contact"]));
    for (const u of urls) expect(["/api", "/account", "/login", "/reset-password", "/settings", "/journal"].some((p) => u.startsWith(p))).toBe(false);
  });
  it("lists every static public page in app/ (audit fail 10)", () => {
    const disallow = [rules.find((r) => r.userAgent === "*")!.disallow ?? []].flat();
    const NOT_FOR_SEARCH = ["/maintenance", "/ext/connect", "/e2e-mock"];   // noindex, extension handshake, test mock
    const app = path.resolve(import.meta.dirname, "../app");
    const pages = (readdirSync(app, { recursive: true }) as string[])
      .filter((f) => /(^|\/)page\.tsx$/.test(f) && !f.includes("["))
      .map((f) => "/" + path.dirname(f).replace(/^\.$/, "").split(path.sep).filter((s) => !/^\(.*\)$/.test(s)).join("/"))
      .filter((p) => !disallow.some((d) => p === d.replace(/\/$/, "") || p.startsWith(d.endsWith("/") ? d : `${d}/`)))
      .filter((p) => !NOT_FOR_SEARCH.some((x) => p.startsWith(x)));
    expect(pages).toContain("/about");
    const urls = sitemap().map((e) => new URL(e.url).pathname);
    expect(urls.sort()).toEqual(pages.sort());
  });
  it("every page gets a 1200×630 share image: site default plus a large Twitter card (audit fail 11)", async () => {
    const og = await import("@/app/opengraph-image");
    const tw = await import("@/app/twitter-image");
    expect(og.size).toEqual({ width: 1200, height: 630 });
    expect(tw.default).toBe(og.default);
    const src = readFileSync(path.resolve(import.meta.dirname, "../app/layout.tsx"), "utf8");
    expect(src).toMatch(/twitter: \{ card: "summary_large_image"/);
    expect(src).toMatch(/openGraph: \{[^}]*images:/);
  });
  it("the market share card wraps instead of running off the 1200 px edge (audit run 2 fail 5)", () => {
    const src = readFileSync(path.resolve(import.meta.dirname, "../app/m/[id]/opengraph-image.tsx"), "utf8");
    expect(src).toMatch(/fontSize: 54[^}]*lineClamp: 3/);                       // question: 3 lines, then …
    expect(src).toMatch(/flexShrink: 0, maxWidth: 420/);                         // left column has a width cap
    expect(src).toMatch(/fontSize: 32, flex: 1, minWidth: 0/);                    // right column takes the rest and can shrink
    expect(src.match(/lineClamp: 2/g)?.length).toBe(2);                          // bet line and won-before wrap, 2 lines max
    expect(src).not.toMatch(/of the time before/);                               // the shorter copy
  });
});
