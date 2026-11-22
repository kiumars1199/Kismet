// F13: GET /api/og/bet/<id> returns a 1200x630 PNG for a real fixture bet, the same bytes for everyone, 404 for an unknown id.
import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/og/bet/[id]/route";
import { getStoreFor } from "@/lib/data/store";

const call = (id: string, qs = "") => GET(new Request(`http://test/api/og/bet/${id}${qs}`), { params: Promise.resolve({ id }) });

describe("/api/og/bet/<id>", () => {
  it("serves a 1200x630 PNG", async () => {
    const store = await getStoreFor("free");
    const id = [...store.flagsById.keys()][0]!;
    const res = await call(id);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    const png = Buffer.from(await res.arrayBuffer());
    expect(png.subarray(1, 4).toString()).toBe("PNG");
    expect(png.readUInt32BE(16)).toBe(1200);   // IHDR width
    expect(png.readUInt32BE(20)).toBe(630);    // IHDR height
  });
  it("is the same image for every caller (no cookies, no user)", async () => {
    const store = await getStoreFor("free");
    const id = [...store.flagsById.keys()][1]!;
    const [a, b] = await Promise.all([call(id), call(id)]);
    expect(Buffer.from(await a.arrayBuffer()).equals(Buffer.from(await b.arrayBuffer()))).toBe(true);
  });
  it("404s for an unknown bet", async () => {
    expect((await call("nope-not-a-market")).status).toBe(404);
  });
});
