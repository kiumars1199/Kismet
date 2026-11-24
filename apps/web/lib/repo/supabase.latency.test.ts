// T-wt2j: SupabaseRepo.profile.patch under network latency. A patch shows in the snapshot at once (every reader, the filter
// bar included, sees the new topics), patches reach the server in the order made, and a failed one rolls back to the
// last confirmed profile without losing the ones queued after it.
import { afterEach, describe, expect, it, vi } from "vitest";
import { SupabaseRepo } from "./supabase";
import { DEFAULT_PROFILE } from "./types";

/** A /api/data whose profile PATCH answers after a delay, so several can be in flight at once. */
function slowProfile(delays: number[]) {
  let profile: Record<string, unknown> = { ...DEFAULT_PROFILE };
  let n = 0;
  const fetcher = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    if (init?.method === "GET") return new Response(JSON.stringify({ profile }), { status: 200 });
    const mine = n++;
    const body = JSON.parse(String(init?.body));
    await new Promise((r) => setTimeout(r, delays[mine] ?? 0));
    if (body.favorite_topics?.includes("boom")) return new Response(JSON.stringify({ error: "x" }), { status: 400 });
    profile = { ...profile, ...body };
    return new Response(JSON.stringify(profile), { status: 200 });
  });
  return { fetcher, server: () => profile };
}
const make = (api: ReturnType<typeof slowProfile>) => new SupabaseRepo("/api/data", api.fetcher as unknown as typeof fetch).load();

afterEach(() => vi.useRealTimers());

describe("SupabaseRepo profile.patch under latency", () => {
  it("the snapshot shows a patch at once, before the server answers", async () => {
    vi.useFakeTimers();
    const repo = await make(slowProfile([300]));
    const done = repo.profile.patch({ favorite_topics: ["sports.nba"] });
    expect(repo.profileSnapshot().favorite_topics).toEqual(["sports.nba"]);
    await vi.advanceTimersByTimeAsync(400);
    await done;
    expect(repo.profileSnapshot().favorite_topics).toEqual(["sports.nba"]);
  });

  it("patches reach the server in the order made, even when an earlier one is slower", async () => {
    vi.useFakeTimers();
    const api = slowProfile([300, 10, 10]);
    const repo = await make(api);
    const ps = [["a"], ["a", "b"], ["a", "b", "c"]].map((t) => repo.profile.patch({ favorite_topics: t }));
    await vi.advanceTimersByTimeAsync(1_000);
    await Promise.all(ps);
    expect(api.server().favorite_topics).toEqual(["a", "b", "c"]);
    expect(repo.profileSnapshot().favorite_topics).toEqual(["a", "b", "c"]);
  });

  it("a failed patch rolls the snapshot back to the confirmed profile, and later patches still apply", async () => {
    const repo = await make(slowProfile([]));
    await repo.profile.patch({ favorite_topics: ["a"] });
    await expect(repo.profile.patch({ favorite_topics: ["boom"] })).rejects.toThrow();
    expect(repo.profileSnapshot().favorite_topics).toEqual(["a"]);
    await repo.profile.patch({ favorite_topics: ["a", "b"] });
    expect(repo.profileSnapshot().favorite_topics).toEqual(["a", "b"]);
  });
});
