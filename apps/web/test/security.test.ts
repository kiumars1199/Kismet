// docs/15 controls that are plain logic or a grep over the source (Lane X). Evidence map: docs/SECURITY_EVIDENCE.md.
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

  it("robots.txt disallows every blocked crawler", async () => {
    const { AI_BOTS } = await import("@/lib/bots");
    const rules = [(await import("@/app/robots")).default().rules].flat();
    expect(rules.find((r) => r.disallow === "/")?.userAgent).toEqual(AI_BOTS);
  });
});
