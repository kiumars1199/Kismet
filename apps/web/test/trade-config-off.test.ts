// Review note on #54: with trading off on the deploy, /api/trade/config must not read the user's profile at all.
import { describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ env: null as string | null, id: null as string | null, getMe: vi.fn() }));
vi.mock("@/lib/auth/server", () => ({ getMe: h.getMe }));
vi.mock("@/lib/trade/server", () => ({
  tradingEnv: () => h.env, extensionId: () => h.id, tradingAllowed: () => true, currentUser: async () => null,
}));

const call = async () => { vi.resetModules(); return (await import("@/app/api/trade/config/route")).GET(new Request("http://localhost/api/trade/config")); };

describe("/api/trade/config with trading off", () => {
  it.each([["no env", null, "abc"], ["no extension id", "demo", null]])("%s: disabled, no profile read", async (_n, env, id) => {
    h.env = env; h.id = id; h.getMe.mockClear();
    const res = await call();
    expect(res.status).toBe(200);
    expect((await res.json()).enabled).toBe(false);
    expect(h.getMe).not.toHaveBeenCalled();
  });
});
