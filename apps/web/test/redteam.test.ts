// Regression tests for REDTEAM.md (run 1). Each case failed before its fix (T-160).
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => { vi.unstubAllEnvs(); });

describe("RT-07 rate-limit key comes from the platform, not X-Forwarded-For", () => {
  it("rotating X-Forwarded-For buys no extra requests", async () => {
    const { clientKey, memoryLimiter } = await import("@/lib/abuse");
    const lim = memoryLimiter(() => 1_000_000);
    const req = (ip: string) => new Request("http://x/api/markets", { headers: { "x-forwarded-for": ip } });
    let rotated = 0;
    for (let i = 0; i < 61; i++) if ((await lim.limit("markets", clientKey(req(`10.0.${i >> 8}.${i & 255}`)))).ok) rotated++;
    expect(rotated).toBe(60);
  });

  it("on Vercel: keyed by x-real-ip; a spoofed X-Forwarded-For is ignored", async () => {
    vi.stubEnv("VERCEL", "1");
    const { clientKey } = await import("@/lib/abuse");
    const a = clientKey(new Request("http://x", { headers: { "x-real-ip": "1.2.3.4", "x-forwarded-for": "9.9.9.9" } }));
    const b = clientKey(new Request("http://x", { headers: { "x-real-ip": "1.2.3.4", "x-forwarded-for": "8.8.8.8" } }));
    expect(a).toBe("ip:1.2.3.4");
    expect(b).toBe(a);
    expect(clientKey(new Request("http://x", { headers: { "x-vercel-forwarded-for": "5.6.7.8, 10.0.0.1" } }))).toBe("ip:5.6.7.8");
  });
});

describe("RT-02 rate limits never fail open in production", () => {
  it("production without Upstash: per-instance limits (auth 5/min per IP)", async () => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DEMO_MODE", "false");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const abuse = await import("@/lib/abuse");
    abuse.setLimiter(undefined);
    const codes = [];
    for (let i = 0; i < 6; i++) codes.push((await abuse.rateLimit("auth_ip", "ip:prod-test"))?.status ?? 200);
    expect(codes).toEqual([200, 200, 200, 200, 200, 429]);
    warn.mockRestore();
  });

  it("Upstash error: answered by the per-instance limiter, not served unlimited", async () => {
    const abuse = await import("@/lib/abuse");
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    abuse.setLimiter({ limit: async () => { throw new Error("upstash down"); }, rows: async () => 0 } as never);
    const codes = [];
    for (let i = 0; i < 6; i++) codes.push((await abuse.rateLimit("auth_ip", "ip:outage-test"))?.status ?? 200);
    expect(codes.at(-1)).toBe(429);
    abuse.setLimiter(undefined);
    err.mockRestore();
  });
});
