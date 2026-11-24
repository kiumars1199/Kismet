// T-ci1: the e2e mocks (Supabase/Stripe stand-ins, the /v1 rewrite, the device header, the Stripe base URL, no rate limit)
// may run in a PRODUCTION BUILD (`next build && next start`) only when the e2e run asks twice (E2E_MOCK=1 and E2E_PROD_BUILD=1)
// and it is not a Vercel deployment. A real production deploy sets neither, so none of it is reachable there.
import { afterEach, describe, expect, it, vi } from "vitest";
import { e2eMockOn } from "@/lib/e2e-mock";

afterEach(() => vi.unstubAllEnvs());
const env = (o: Record<string, string>) => ({ NODE_ENV: "production", ...o }) as unknown as NodeJS.ProcessEnv;

describe("e2eMockOn", () => {
  it("is off without E2E_MOCK, in dev and in production", () => {
    expect(e2eMockOn(env({ NODE_ENV: "development" }))).toBe(false);
    expect(e2eMockOn(env({}))).toBe(false);
    expect(e2eMockOn(env({ E2E_PROD_BUILD: "1" }))).toBe(false);
  });
  it("is on in dev/test with E2E_MOCK=1 (as before)", () => {
    expect(e2eMockOn(env({ NODE_ENV: "development", E2E_MOCK: "1" }))).toBe(true);
    expect(e2eMockOn(env({ NODE_ENV: "test", E2E_MOCK: "1" }))).toBe(true);
  });
  it("in production, E2E_MOCK=1 alone stays off (the existing guard)", () => {
    expect(e2eMockOn(env({ E2E_MOCK: "1" }))).toBe(false);
  });
  it("in production, on only with both flags and off Vercel", () => {
    expect(e2eMockOn(env({ E2E_MOCK: "1", E2E_PROD_BUILD: "1" }))).toBe(true);
    expect(e2eMockOn(env({ E2E_MOCK: "1", E2E_PROD_BUILD: "1", VERCEL: "1" }))).toBe(false);
    expect(e2eMockOn(env({ E2E_MOCK: "1", E2E_PROD_BUILD: "1", VERCEL_ENV: "production" }))).toBe(false);
    expect(e2eMockOn(env({ E2E_MOCK: "1", E2E_PROD_BUILD: "0" }))).toBe(false);
  });
});

describe("every mock gate follows it", () => {
  it("the /e2e-mock route: 404 in production unless both flags; 200 with them", async () => {
    const { GET } = await import("@/app/e2e-mock/[...path]/route");
    const call = () => GET(new Request("http://test/e2e-mock/supabase/_inbox?email=a@b.c"), { params: Promise.resolve({ path: ["supabase", "_inbox"] }) });
    vi.stubEnv("E2E_MOCK", "1");
    vi.stubEnv("NODE_ENV", "production");
    expect((await call()).status).toBe(404);
    vi.stubEnv("E2E_PROD_BUILD", "1");
    expect((await call()).status).toBe(200);
    vi.stubEnv("VERCEL", "1");
    expect((await call()).status).toBe(404);
  });
  it("the Stripe client honours STRIPE_API_BASE in a production e2e build and never on a real deploy", async () => {
    const { stripeClient } = await import("@/lib/billing/stripe");
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_x");
    vi.stubEnv("STRIPE_API_BASE", "http://localhost:3100");
    vi.stubEnv("NODE_ENV", "production");
    const host = () => (stripeClient() as unknown as { getApiField(k: string): string }).getApiField("host");
    expect(host()).toBe("api.stripe.com");          // production, no e2e flags
    vi.stubEnv("E2E_MOCK", "1"); vi.stubEnv("E2E_PROD_BUILD", "1");
    expect(host()).toBe("localhost");               // the e2e production build
    vi.stubEnv("VERCEL", "1");
    expect(host()).toBe("api.stripe.com");          // a Vercel deploy: never
  });
  it("the rate limiter: real production keeps the in-memory limiter (also with E2E flags on Vercel); only an e2e production build skips it", async () => {
    let n = 0;   // the in-memory fallback lives on globalThis: a fresh key per run
    const run = async (envs: Record<string, string>) => {
      vi.resetModules();
      vi.unstubAllEnvs();   // each run starts clean: VERCEL / VERCEL_ENV from the run before must not leak
      for (const [k, v] of Object.entries({ NODE_ENV: "production", DEMO_MODE: "false", UPSTASH_REDIS_REST_URL: "", UPSTASH_REDIS_REST_TOKEN: "", ...envs })) vi.stubEnv(k, v);
      const { rateLimit, setLimiter } = await import("@/lib/abuse");
      setLimiter(undefined);
      n++;
      const out: (number | null)[] = [];
      for (let i = 0; i < 8; i++) out.push((await rateLimit("auth_ip", `ip-${n}`))?.status ?? null);   // auth_ip: 5 a minute
      return out;
    };
    const limited = [null, null, null, null, null, 429, 429, 429];
    expect(await run({})).toEqual(limited);                                                       // real production
    expect(await run({ E2E_MOCK: "1" })).toEqual(limited);                                        // one flag is not enough
    expect(await run({ E2E_MOCK: "1", E2E_PROD_BUILD: "1", VERCEL: "1" })).toEqual(limited);      // both flags on Vercel: still limited
    expect(await run({ E2E_MOCK: "1", E2E_PROD_BUILD: "1", VERCEL_ENV: "production" })).toEqual(limited);
    expect(await run({ E2E_MOCK: "1", E2E_PROD_BUILD: "1" })).toEqual(Array(8).fill(null));         // the e2e production build: as dev today
  });
  it("the signed-out device header counts only when the mock is on", async () => {
    const { deviceOf } = await import("@/lib/check/limit");
    const req = new Request("http://x", { headers: { "x-e2e-device": "t1" } });
    vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("E2E_MOCK", "1");
    expect(deviceOf(req)).toBe("local");
    vi.stubEnv("E2E_PROD_BUILD", "1");
    expect(deviceOf(req)).toBe("e2e:t1");
  });
});

describe("the middleware /v1 passthrough and the next.config /v1 rewrite follow it", () => {
  // The wall treats an unknown path like /v1/* as public today (#33), which would hide the gate: make every path "needs an
  // account" so only the e2e passthrough can let /v1/* through.
  const stripeCall = async () => {
    vi.doMock("@/lib/auth/public-paths", async (orig) => ({ ...(await orig<typeof import("@/lib/auth/public-paths")>()), signedOutAccess: () => "signup" }));
    const { NextRequest } = await import("next/server");
    const { accountWall } = await import("@/middleware");
    return accountWall(new NextRequest("http://localhost:3100/v1/payment_intents", { method: "POST" }));
  };
  const rewriteSources = async () => {
    vi.resetModules();
    const cfg = (await import("@/next.config")).default as { rewrites?: () => Promise<unknown> };
    const r = cfg.rewrites ? await cfg.rewrites() : [];
    const list = Array.isArray(r) ? r : [...((r as { beforeFiles?: unknown[] }).beforeFiles ?? []), ...((r as { afterFiles?: unknown[] }).afterFiles ?? []), ...((r as { fallback?: unknown[] }).fallback ?? [])];
    return (list as { source: string }[]).map((x) => x.source);
  };
  afterEach(() => vi.doUnmock("@/lib/auth/public-paths"));
  const setEnv = (o: Record<string, string>) => { vi.resetModules(); vi.unstubAllEnvs(); for (const [k, v] of Object.entries({ NODE_ENV: "production", ...o })) vi.stubEnv(k, v); };

  it("middleware: /v1/* skips the account wall only when the gate is on; otherwise the signed-out wall answers", async () => {
    setEnv({});                                                       // production, no flags
    expect(await stripeCall()).not.toBeNull();
    setEnv({ E2E_MOCK: "1" });                                        // one flag
    expect(await stripeCall()).not.toBeNull();
    setEnv({ E2E_MOCK: "1", E2E_PROD_BUILD: "1", VERCEL: "1" });      // both flags on Vercel
    expect(await stripeCall()).not.toBeNull();
    setEnv({ E2E_MOCK: "1", E2E_PROD_BUILD: "1", VERCEL_ENV: "production" });
    expect(await stripeCall()).not.toBeNull();
    setEnv({ E2E_MOCK: "1", E2E_PROD_BUILD: "1" });                   // the e2e production build
    expect(await stripeCall()).toBeNull();
    setEnv({ NODE_ENV: "development", E2E_MOCK: "1" });               // dev, as before
    expect(await stripeCall()).toBeNull();
  });

  it("next.config: the /v1 → /e2e-mock/stripe rewrite exists only when the gate is on", async () => {
    const has = async (o: Record<string, string>) => { setEnv(o); return (await rewriteSources()).includes("/v1/:path*"); };
    expect(await has({})).toBe(false);
    expect(await has({ E2E_MOCK: "1" })).toBe(false);
    expect(await has({ E2E_PROD_BUILD: "1" })).toBe(false);
    expect(await has({ E2E_MOCK: "1", E2E_PROD_BUILD: "1", VERCEL: "1" })).toBe(false);
    expect(await has({ E2E_MOCK: "1", E2E_PROD_BUILD: "1", VERCEL_ENV: "production" })).toBe(false);
    expect(await has({ E2E_MOCK: "1", E2E_PROD_BUILD: "1" })).toBe(true);
    expect(await has({ NODE_ENV: "development", E2E_MOCK: "1" })).toBe(true);
  });
});
