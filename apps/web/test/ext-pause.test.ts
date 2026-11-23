// F8 follow-up: a paused account gets no extension data either. Token issue, refresh, bearer data calls and the
// trade nonce answer 423 while paused (like the data routes); they work again when the pause ends.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ paused_until: null as string | null }));

vi.mock("@/lib/auth/server", async (orig) => ({
  ...(await orig<typeof import("@/lib/auth/server")>()),
  authEnabled: () => true,
  adminEnabled: () => true,
  sameOrigin: () => true,
  getUser: async () => null,
  getMe: async () => ({ user: { id: "u1", email: "u@x.test" }, tier: "premium", beta: false, paused_until: h.paused_until }),
  pausedUntilForUser: async () => h.paused_until,
  pausedUntilOf: async () => h.paused_until,
  supabaseAdmin: () => ({
    auth: { admin: { getUserById: async () => ({ data: { user: { id: "u1", email: "u@x.test" } }, error: null }) } },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { tier: "pro", status: "active", paused_until: h.paused_until }, error: null }) }) }) }),
  }),
}));
vi.mock("@/lib/data/respond", async (orig) => ({
  ...(await orig<typeof import("@/lib/data/respond")>()),
  withTier: async () => Response.json({ ok: true }),   // the by-slug body itself is not under test
}));

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("DEMO_MODE", "false");
  vi.stubEnv("EXT_SIGNING_SECRET", "x".repeat(40));
  vi.stubEnv("KALSHI_TRADING_ENV", "demo");
  vi.stubEnv("TRADING_ALLOWLIST", "u@x.test");
  h.paused_until = null;
});
afterEach(() => vi.unstubAllEnvs());

const pause = () => { h.paused_until = new Date(Date.now() + 3_600_000).toISOString(); };
const token = async () => (await import("@/lib/trade/server")).issueExtToken({ id: "u1", email: "u@x.test" }, "premium")!.token;
const post = (path: string, headers: Record<string, string> = {}, body?: unknown) =>
  new Request(`http://t${path}`, { method: "POST", headers: { origin: "http://t", ...headers }, body: body ? JSON.stringify(body) : undefined });
const expect423 = async (res: Response) => {
  expect(res.status).toBe(423);
  expect(await res.json()).toMatchObject({ code: "paused", until: h.paused_until });
  expect(res.headers.get("cache-control")).toContain("no-store");
};

describe("extension routes while paused", () => {
  it("POST /api/ext/token: 423 paused, 200 otherwise", async () => {
    const { POST } = await import("@/app/api/ext/token/route");
    expect((await POST(post("/api/ext/token"))).status).toBe(200);
    pause();
    await expect423(await POST(post("/api/ext/token")));
  });

  it("POST /api/ext/token/refresh: 423 paused, 200 otherwise", async () => {
    const { POST } = await import("@/app/api/ext/token/refresh/route");
    const t = await token();
    expect((await POST(post("/api/ext/token/refresh", { authorization: `Bearer ${t}` }))).status).toBe(200);
    pause();
    await expect423(await POST(post("/api/ext/token/refresh", { authorization: `Bearer ${t}` })));
  });

  it("GET /api/events/by-slug with a bearer token and no cookie: 423 paused, with CORS so the worker can read it", async () => {
    const { GET } = await import("@/app/api/events/by-slug/[slug]/route");
    const call = async () => GET(new Request("http://t/api/events/by-slug/x", { headers: { authorization: `Bearer ${await token()}` } }), { params: Promise.resolve({ slug: "x" }) });
    expect((await call()).status).toBe(200);
    pause();
    const res = await call();
    await expect423(res);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });

  it("POST /api/trade/nonce: 423 paused", async () => {
    const { POST } = await import("@/app/api/trade/nonce/route");
    const order = { action: "cancel", payload: { orderId: "o1" } };
    const ok = await POST(post("/api/trade/nonce", {}, order));
    expect(ok.status).not.toBe(423);
    pause();
    await expect423(await POST(post("/api/trade/nonce", {}, order)));
  });
});
