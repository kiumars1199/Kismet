// F9: GET /api/state reads the httpOnly us_state cookie for static pages (the layout of a prerendered page has no cookies).
import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/state/route";

const req = (cookie?: string) => new Request("http://localhost/api/state", { headers: cookie ? { cookie } : {} });

describe("GET /api/state", () => {
  it("returns the state and the three statuses from the cookie, never cached", async () => {
    const res = await GET(req("us_state=NV"));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect(await res.json()).toEqual({ state: "NV", stateName: "Nevada", statuses: { kalshi: "unverified", polymarket_us: "restricted", polymarket_intl: "restricted" } });
  });
  it("no cookie or a bad one: nulls", async () => {
    for (const c of [undefined, "us_state=ZZ", "us_state=__proto__"])
      expect(await (await GET(req(c))).json(), String(c)).toEqual({ state: null, stateName: null, statuses: null });
  });
});
