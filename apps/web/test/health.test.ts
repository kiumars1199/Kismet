import { afterEach, describe, expect, it, vi } from "vitest";

const load = async () => (await import("@/app/api/health/route")).GET;

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("/api/health", () => {
  it("200 in local dev with no DB or Stripe configured; flags the old fixture scan as stale", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    const res = await (await load())();
    expect(res.status).toBe(200);
    const b = await res.json();
    expect(b).toMatchObject({ ok: true, db: "not configured", stripe: "not configured" });
    expect(b.data).toMatchObject({ scanned_at: expect.any(Number), stale: true, max_age_minutes: 30 });
  });

  it("503 when the DB is configured but unreachable; never echoes the key", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abc.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "svc-secret");
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_x");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 503 })));
    const res = await (await load())();
    expect(res.status).toBe(503);
    const text = await res.text();
    expect(text).not.toContain("svc-secret");
    expect(text).not.toContain("supabase.co");
    expect(JSON.parse(text)).toMatchObject({ ok: false, db: "unreachable", stripe: "configured" });
  });

  it("200 when the DB answers", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abc.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "svc-secret");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("[]", { status: 200 })));
    expect((await (await load())()).status).toBe(200);
  });

  it("503 when a remote scan is older than the limit", async () => {
    vi.stubEnv("DATA_SOURCE", "github"); // the fixture store is already cached in memory
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    const res = await (await load())();
    expect(res.status).toBe(503);
    expect((await res.json()).data.stale).toBe(true);
  });
});
