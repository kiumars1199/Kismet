// docs/15 controls that are plain logic or a grep over the source (Lane X). Evidence map: docs/SECURITY_EVIDENCE.md.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { demoFlag } from "@/lib/config";

describe("DEMO_MODE fails safe", () => {
  it("is on only when explicitly true, or unset outside production", () => {
    expect(demoFlag("true", "production")).toBe(true);
    expect(demoFlag(undefined, "production")).toBe(false);   // forgotten var on a production deploy
    expect(demoFlag("", "production")).toBe(false);
    expect(demoFlag("false", "development")).toBe(false);
    expect(demoFlag("1", "development")).toBe(false);
    expect(demoFlag(undefined, "development")).toBe(true);   // pnpm dev with no .env
    expect(demoFlag(undefined, "test")).toBe(true);
  });
});

describe("AI crawlers (docs/14 §6, docs/15 § Bots)", () => {
  it("middleware refuses AI user agents with 403, people pass", async () => {
    const { NextRequest } = await import("next/server");
    const { middleware } = await import("@/middleware");
    const hit = (ua: string) => middleware(new NextRequest("http://t/api/markets", { headers: { "user-agent": ua } }));
    for (const ua of ["Mozilla/5.0 (compatible; GPTBot/1.2; +https://openai.com/gptbot)", "ClaudeBot/1.0", "CCBot/2.0", "PerplexityBot/1.0"])
      expect((await hit(ua)).status, ua).toBe(403);
    expect((await hit("Mozilla/5.0 (Macintosh) Chrome/131.0")).status).toBe(200);
  });

  it("robots.txt disallows every blocked crawler (same list as the middleware)", async () => {
    const { AI_BOTS } = await import("@/lib/bots");
    const rules = [(await import("@/app/robots")).default().rules].flat();
    expect(rules.find((r) => r.disallow === "/")?.userAgent).toEqual(AI_BOTS);
  });
});

// ---------------------------------------------------------------- source greps (docs/15 § Web hardening)

const SRC = ["app", "lib", "components", "middleware.ts", "instrumentation-client.ts"];
const files = (): string[] =>
  SRC.flatMap((p) => (statSync(p).isDirectory() ? readdirSync(p, { recursive: true }).map((f) => join(p, String(f))) : [p]))
    .filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\.tsx?$/.test(f));
const read = (f: string) => readFileSync(f, "utf8");
const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;

describe("web hardening greps", () => {
  it("no dangerouslySetInnerHTML anywhere", () => {
    expect(files().filter((f) => read(f).includes("dangerouslySetInnerHTML"))).toEqual([]);
  });

  it("server fetches only allow-listed hosts (plus Supabase from env)", () => {
    const ALLOWED = ["api.github.com", "api.resend.com", "clob.polymarket.com", "gamma-api.polymarket.com"];
    const hosts = files().filter((f) => /\bfetch\(/.test(read(f)))
      .flatMap((f) => [...read(f).matchAll(/https?:\/\/([a-z0-9.-]+)/gi)].map((m) => `${m[1]} (${f})`));
    expect(hosts.filter((h) => !ALLOWED.includes(h.split(" ")[0]!))).toEqual([]);
  });

  it("every mutating route checks Origin, or has a credential a browser can't forge", () => {
    const EXEMPT: Record<string, string> = {
      "app/api/stripe/webhook/route.ts": "Stripe signature",
      "app/api/unsubscribe/route.ts": "signed token, RFC 8058 one-click from the mail client",
      "app/api/ext/token/refresh/route.ts": "Bearer token, no cookies",
      "app/api/ext/telemetry/route.ts": "no auth, no state: logs a slug and a count",
      "app/api/trade/nonce/verify/route.ts": "the nonce is the credential",
      "app/api/alerts/run/route.ts": "CRON_SECRET",
      "app/api/settle/run/route.ts": "CRON_SECRET",
      "app/e2e-mock/[...path]/route.ts": "404 unless E2E_MOCK=1 outside production",
    };
    const routes = files().filter((f) => f.endsWith("route.ts") && /export (async )?(function|const) (POST|PUT|PATCH|DELETE)\b/.test(read(f)));
    expect(routes.length).toBeGreaterThan(10);
    expect(routes.filter((f) => !EXEMPT[f] && !/sameOrigin\(|siteOrExtension\(|withUser\(/.test(read(f)))).toEqual([]);
    for (const f of Object.keys(EXEMPT)) expect(existsSync(f), f).toBe(true);
  });

  it("every zod object that parses a request is .strict()", () => {
    const inputs = files().filter((f) => f.startsWith("app/api/") || f === "lib/trade/intent.ts" || f === "lib/repo/schemas.ts");
    const loose = inputs.filter((f) => count(read(f), /z\.object\(/g) !== count(read(f), /\.strict\(\)/g));
    expect(loose).toEqual([]);
    expect(inputs.reduce((n, f) => n + count(read(f), /\.strict\(\)/g), 0)).toBeGreaterThan(15);
  });
});

describe("Origin checks", () => {
  const post = (origin?: string, body = "{}") =>
    new Request("http://t/api/x", { method: "POST", body, headers: origin ? { origin } : {} });

  it("/api/settle refuses other sites and unknown keys", async () => {
    const { POST } = await import("@/app/api/settle/route");
    expect((await POST(post("https://evil.example"))).status).toBe(403);
    expect((await POST(post())).status).toBe(403);
    expect((await POST(post("http://t", JSON.stringify({ ids: ["1"], x: 1 })))).status).toBe(400);
  });

  it("/api/ext/token: our site or our extension only", async () => {
    const { siteOrExtension, extensionId } = await import("@/lib/trade/server");
    expect(siteOrExtension(post("http://t"))).toBe(true);
    expect(siteOrExtension(post(`chrome-extension://${extensionId()}`))).toBe(true);
    expect(siteOrExtension(post("chrome-extension://abcdefghijklmnopabcdefghijklmnop"))).toBe(false);
    expect(siteOrExtension(post("https://evil.example"))).toBe(false);
    const { POST } = await import("@/app/api/ext/token/route");
    expect((await POST(post("https://evil.example"))).status).toBe(403);
  });
});
