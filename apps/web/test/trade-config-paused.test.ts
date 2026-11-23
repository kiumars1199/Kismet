// F8 follow-up: /api/trade/config answers 423 while the account is paused, like the other data routes.
import { afterEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ paused_until: null as string | null }));
vi.mock("@/lib/auth/server", () => ({ getMe: async () => ({ user: { id: "u1", email: "u@x.test" }, tier: "free", beta: false, paused_until: h.paused_until }) }));

const load = async () => { vi.resetModules(); return (await import("@/app/api/trade/config/route")).GET; };
const req = () => new Request("http://localhost/api/trade/config");

describe("/api/trade/config while paused", () => {
  afterEach(() => { h.paused_until = null; });

  it("423 with the end time and no caching while paused", async () => {
    h.paused_until = new Date(Date.now() + 3_600_000).toISOString();
    const res = await (await load())(req());
    expect(res.status).toBe(423);
    expect(await res.json()).toMatchObject({ code: "paused", until: h.paused_until });
    expect(res.headers.get("cache-control")).toContain("no-store");
  });

  it("200 when not paused or the pause has ended", async () => {
    expect((await (await load())(req())).status).toBe(200);
    h.paused_until = new Date(Date.now() - 1000).toISOString();
    expect((await (await load())(req())).status).toBe(200);
  });
});
