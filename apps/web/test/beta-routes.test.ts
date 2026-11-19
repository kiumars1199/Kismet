// Beta gates on the server (lib/beta.ts), not just the UI: /api/combos and /combos for testers only, any plan.
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Tier } from "@/lib/entitlements";
import type { CombosResponse } from "@/lib/data/combos";

const h = vi.hoisted(() => ({ tier: "premium" as Tier, beta: false }));
vi.mock("@/lib/auth/server", () => ({
  getMe: async () => ({ user: { id: "u1", email: "u@x.test" }, tier: h.tier, beta: h.beta, status: null, current_period_end: null, cancel_at_period_end: false }),
  getTier: async () => h.tier,
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers(), cookies: async () => ({ get: () => undefined, set: () => {} }) }));
vi.mock("botid/server", () => ({ checkBotId: async () => ({ isBot: false }) }));

const { GET } = await import("@/app/api/combos/route");
const { default: Page } = await import("@/app/combos/page");
const combos = async (q = "") => (await (await GET(new Request(`http://t/api/combos${q}`))).json()) as CombosResponse;

afterEach(() => { h.tier = "premium"; h.beta = false; });

describe("combos are beta", () => {
  it("a paying Premium customer who isn't a tester gets none, from the row or the browse page", async () => {
    expect((await combos()).groups).toEqual([]);
    expect((await combos("?pays=2")).groups).toEqual([]);
    await expect(Page()).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;404|NEXT_NOT_FOUND/);
  });
  it("a tester on Free gets them (exact numbers stay a paid feature: Free sees bands)", async () => {
    h.tier = "free"; h.beta = true;
    const g = (await combos("?pays=2")).groups;
    expect(g.length).toBeGreaterThan(0);
    expect(g[0]!.combos[0]!.ret_range).toBeDefined();
    await expect(Page()).resolves.toBeTruthy();
  });
});
