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
