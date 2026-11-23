// F5: a topic filter returns the same flags for everyone. "Your topics" is a filter the user chose, never a pick:
// the API has no user context, so two callers (different devices, different cookies) get identical rows.
import { describe, expect, it } from "vitest";
import { GET as flags } from "@/app/api/flags/route";
import { GET as markets } from "@/app/api/markets/route";
import type { MarketsResponse } from "@/lib/api";

const call = async (h: (r: Request) => Promise<Response>, path: string, who: Record<string, string>) => {
  const res = await h(new Request(`http://test${path}`, { headers: who }));
  expect(res.status).toBe(200);
  return (await res.json()) as MarketsResponse;
};
const A = { "x-forwarded-for": "203.0.113.1", cookie: "sb-user=a" };
const B = { "x-forwarded-for": "198.51.100.2", cookie: "sb-user=b" };

describe("topic filters are the same for every user", () => {
  it("/api/markets?topics=… returns identical rows for two callers", async () => {
    const q = "/api/markets?topics=sports.nfl,politics&view=flags";
    const [a, b] = [await call(markets, q, A), await call(markets, q, B)];
    expect(a.rows.length).toBeGreaterThan(0);
    expect(a.rows.map((r) => `${r.market.id}:${r.side.side_index}`)).toEqual(b.rows.map((r) => `${r.market.id}:${r.side.side_index}`));
    expect(a.total).toBe(b.total);
  });
  it("/api/flags?topics=… returns identical rows for two callers", async () => {
    const q = "/api/flags?topics=sports.nfl";
    const [a, b] = [await call(flags, q, A), await call(flags, q, B)];
    expect(a.rows.map((r) => r.market.id)).toEqual(b.rows.map((r) => r.market.id));
    expect(a.total).toBe(b.total);
  });
});
