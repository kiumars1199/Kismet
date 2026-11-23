// The /m action row keeps slots only for the late buttons this user will actually get (server-decided).
import { afterEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ me: { user: null as { id: string; email: string } | null, tier: "free", beta: false } }));
vi.mock("@/lib/auth/server", () => ({ getMe: async () => h.me }));
vi.mock("server-only", () => ({}));

const load = async (env: Record<string, string>) => {
  vi.resetModules();
  vi.stubEnv("DEMO_MODE", "false");
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  return (await import("@/lib/trade/reserve")).actionReserve();
};

describe("actionReserve", () => {
  afterEach(() => { vi.unstubAllEnvs(); h.me = { user: null, tier: "free", beta: false }; });

  it("trading off on the deployment: no Trade slot, whoever the user is", async () => {
    h.me = { user: { id: "u", email: "a@x.test" }, tier: "premium", beta: false };
    expect((await load({ TRADING_ALLOWLIST: "a@x.test" })).trade).toBe(false);
  });

  it("trading on: only allow-listed users get the slot (the /api/trade/config rule)", async () => {
    const env = { KALSHI_TRADING_ENV: "demo", NEXT_PUBLIC_EXTENSION_ID: "abcdefghijklmnopabcdefghijklmnop", TRADING_ALLOWLIST: "ok@x.test" };
    h.me = { user: { id: "u", email: "ok@x.test" }, tier: "premium", beta: false };
    expect((await load(env)).trade).toBe(true);
    h.me = { user: { id: "u2", email: "other@x.test" }, tier: "premium", beta: false };
    expect((await load(env)).trade).toBe(false);
    h.me = { user: null, tier: "free", beta: false };
    expect((await load(env)).trade).toBe(false);
  });

  it("combos slot follows the combo entitlement", async () => {
    h.me = { user: { id: "u", email: "a@x.test" }, tier: "premium", beta: false };
    const pro = (await load({})).combo;
    h.me = { user: { id: "u", email: "a@x.test" }, tier: "free", beta: false };
    const free = (await load({})).combo;
    expect(typeof pro).toBe("boolean");
    expect(free).toBe(false);
  });
});
