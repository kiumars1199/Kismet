// REDTEAM.md regression tests for the Free/anon data paywall (RT-01, RT-03, RT-04, RT-15). Each failed before its fix.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Tier } from "@/lib/entitlements";

const h = vi.hoisted(() => ({ tier: "free" as Tier, user: null as null | { id: string; email: string }, jar: new Map<string, string>() }));
vi.mock("@/lib/auth/server", () => ({
  COOKIE_OPTIONS: { httpOnly: true, sameSite: "lax", path: "/" },
  getMe: async () => ({ user: h.user, tier: h.tier, status: null, current_period_end: null, cancel_at_period_end: false }),
  getTier: async () => h.tier,
  supabaseServer: async () => ({
    from: () => ({ select: () => ({ eq: async () => ({ data: [] }) }), insert: async () => ({ error: null }) }),
  }),
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (k: string) => (h.jar.has(k) ? { value: h.jar.get(k)! } : undefined),
    set: (k: string, v: string) => void h.jar.set(k, v),
  }),
}));

const abuse = await import("@/lib/abuse");
const { GET: markets } = await import("@/app/api/markets/route");
const { getStore } = await import("@/lib/data/store");
const { band } = await import("@/lib/data/gate");

const req = (p: string, init?: RequestInit) => new Request(`http://test${p}`, init);
const total = async (p: string) => ((await (await markets(req(p))).json()) as { total: number }).total;

beforeEach(() => { abuse.setLimiter(abuse.memoryLimiter()); h.tier = "free"; h.user = null; h.jar.clear(); });

describe("RT-04 Free filters and sorts see the banded numbers, not the exact ones", () => {
  it("a return threshold inside one band can't tell markets in that band apart", async () => {
    const store = await getStore();
    const cuts = [0, 5, 10, 20, 50];
    // a market whose exact return sits strictly inside a band, with room for a threshold on each side
    const m = store.markets.find((x) => {
      const [lo, hi] = band(x.best.roi_pct, cuts);
      return lo !== null && hi !== null && x.best.roi_pct - lo > 0.2 && hi - x.best.roi_pct > 0.2;
    })!;
    expect(m, "fixture has a market inside a band").toBeTruthy();
    const [lo] = band(m.best.roi_pct, cuts);
    const below = await total(`/api/markets?g=0&wp=0&roi=${lo! + 0.1}`);
    const above = await total(`/api/markets?g=0&wp=0&roi=${m.best.roi_pct + 0.1}`);
    expect(above).toBe(below);   // exact filtering drops m (and others) between the two thresholds
  });

  it("the win-chance filter works on the 5-point floor Free is shown", async () => {
    const store = await getStore();
    const m = store.markets.find((x) => x.best.win_prob * 20 % 1 > 0.2 && x.best.win_prob * 20 % 1 < 0.8)!;
    const lo = Math.floor(m.best.win_prob * 20) / 20;
    expect(await total(`/api/markets?g=0&wp=${m.best.win_prob + 0.002}`)).toBe(await total(`/api/markets?g=0&wp=${lo + 0.002}`));
  });
});
