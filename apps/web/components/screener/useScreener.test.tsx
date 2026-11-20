// @vitest-environment jsdom
// T-291 #11: after a filter change the hook hands back no rows until this URL's own answer arrives (the list shows
// its skeleton), and a failed fetch never relabels the previous filter's rows as the answer.
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MarketsResponse } from "@/lib/api";

let search = new URLSearchParams("");
vi.mock("next/navigation", () => ({ useSearchParams: () => search, usePathname: () => "/" }));
vi.mock("@/lib/softNav", () => ({ softNav: vi.fn() }));
vi.mock("@/lib/repo/hooks", () => ({ useCollection: () => [], useProfile: () => ({ favorite_topics: [] }) }));
const pending: { resolve: (d: MarketsResponse) => void; reject: (e: Error) => void }[] = [];
vi.mock("@/lib/api", () => ({
  fetchFlags: () => new Promise((resolve, reject) => pending.push({ resolve, reject })),
  fetchMarkets: vi.fn(), fetchMeta: vi.fn(),
}));
const { useScreener } = await import("./useScreener");

const page = (id: string) => ({ rows: [{ market: { id }, side: { side_index: 0 } }], total: 1, page: 1, page_size: 50, pages: 1, facets: { tag: id } }) as unknown as MarketsResponse;
afterEach(() => { cleanup(); pending.length = 0; search = new URLSearchParams(""); });

describe("useScreener while a filter loads", () => {
  it("returns no rows (loading) until the new answer, then the new rows", async () => {
    const { result, rerender } = renderHook(() => useScreener("flags", page("old")));
    expect(result.current.data?.rows[0]!.market.id).toBe("old");
    search = new URLSearchParams("cat=sports");
    rerender();
    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeUndefined();               // never the old list
    expect(result.current.facets).toEqual({ tag: "old" });     // pills keep their last counts
    await waitFor(() => expect(pending).toHaveLength(1));
    await act(async () => pending[0]!.resolve(page("new")));
    expect(result.current.data?.rows[0]!.market.id).toBe("new");
  });

  it("a failed fetch shows the error, not the old rows", async () => {
    const { result, rerender } = renderHook(() => useScreener("flags", page("old")));
    search = new URLSearchParams("cat=crypto");
    rerender();
    await waitFor(() => expect(pending).toHaveLength(1));
    await act(async () => pending[0]!.reject(new Error("boom")));
    expect(result.current.error).toBe("boom");
    expect(result.current.data).toBeUndefined();
  });
});
