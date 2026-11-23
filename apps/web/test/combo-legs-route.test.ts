// T-89c: /api/check/legs stores a leg count in an HttpOnly cookie (path /check) so the next /check/combo can reserve room.
import { describe, expect, it } from "vitest";

const post = (body: unknown, origin = "http://t") => new Request("http://t/api/check/legs", { method: "POST", body: JSON.stringify(body), headers: { origin, "content-type": "application/json" } });

describe("POST /api/check/legs", () => {
  it("sets the count cookie (HttpOnly, /check) for a whole number 0-10 and nothing for anything else", async () => {
    const { POST } = await import("@/app/api/check/legs/route");
    const ok = await POST(post({ n: 2 }));
    expect(ok.status).toBe(204);
    const c = ok.headers.get("set-cookie") ?? "";
    expect(c).toMatch(/kismet_combo_n=2/);
    expect(c).toMatch(/HttpOnly/i);
    expect(c).toMatch(/Path=\/check/i);
    for (const bad of [{ n: 11 }, { n: -1 }, { n: 1.5 }, { n: "2" }, {}, null]) expect((await POST(post(bad))).headers.get("set-cookie"), JSON.stringify(bad)).toBeNull();
  });
  it("ignores another site's origin", async () => {
    const { POST } = await import("@/app/api/check/legs/route");
    expect((await POST(post({ n: 2 }, "https://evil.example"))).headers.get("set-cookie")).toBeNull();
  });
});
