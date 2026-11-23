// F10: the site installs to the home screen: manifest, 192/512 icons (one maskable), a service worker that only handles push.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";
import { PUBLIC_FILES, signedOutAccess } from "@/lib/auth/public-paths";
import { csp } from "@/middleware";

const root = join(__dirname, "..");

describe("installable app (F10)", () => {
  const m = manifest();
  it("has the fields Chrome and iOS need", () => {
    expect(m).toMatchObject({ name: "Kismet", short_name: "Kismet", display: "standalone", start_url: "/", scope: "/", theme_color: "#070a09" });
    expect(m.background_color).toBe("#070a09");
  });
  it("lists 192 and 512 PNG icons plus a maskable one, and the files exist", () => {
    const sizes = (m.icons ?? []).map((i) => `${i.sizes}:${i.type}:${i.purpose ?? "any"}`);
    expect(sizes).toEqual(expect.arrayContaining(["192x192:image/png:any", "512x512:image/png:any", "512x512:image/png:maskable"]));
    for (const i of m.icons ?? []) expect(existsSync(join(root, "public", i.src))).toBe(true);
  });
  it("service worker handles push and notification clicks, and caches nothing", () => {
    const sw = readFileSync(join(root, "public/sw.js"), "utf8");
    expect(sw).toMatch(/addEventListener\(\s*["']push["']/);
    expect(sw).toMatch(/addEventListener\(\s*["']notificationclick["']/);
    expect(sw).not.toMatch(/caches\.|addEventListener\(\s*["']fetch["']/);
  });
  it("the manifest, the worker and the icons are public (signed-out installability) and the CSP allows the worker", () => {
    expect(PUBLIC_FILES).toEqual(expect.arrayContaining(["/manifest.webmanifest", "/sw.js", "/icons"]));
    for (const p of ["/manifest.webmanifest", "/sw.js", "/icons/icon-192.png"]) expect(signedOutAccess(p)).toBe("public");
    expect(csp("abc", false)).toMatch(/worker-src 'self'/);
  });
});
