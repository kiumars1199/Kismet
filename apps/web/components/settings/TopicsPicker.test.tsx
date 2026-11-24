// @vitest-environment jsdom
// T-wt2d: a tile's accessible name is its topic ("NBA") before and after the open counts arrive (the count rides in
// aria-describedby), and a tap sticks whether it lands before or after the counts load. Tiles are disabled until hydration,
// like "Skip setup": a tap on the server HTML would be lost, so it waits instead of pretending.
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const patch = vi.fn(async () => ({}));
let resolveMeta: (v: { facets: { topics: Record<string, number> } }) => void = () => {};
vi.mock("@/lib/api", () => ({ fetchMeta: () => new Promise((r) => { resolveMeta = r as typeof resolveMeta; }) }));
vi.mock("@/lib/repo", () => ({ isRepoReady: () => true, repoReady: Promise.resolve(), getRepo: () => ({ profileSnapshot: () => ({ favorite_topics: [], topics_off: false }), profile: { patch } }) }));
vi.mock("@/lib/repo/hooks", () => ({ useProfile: () => ({ favorite_topics: [] }) }));

const { TopicsPicker } = await import("./TopicsPicker");
afterEach(() => { cleanup(); patch.mockClear(); });

describe("TopicsPicker", () => {
  it("the NBA tile keeps the accessible name 'NBA' when 'none open' arrives, and the count is its description", async () => {
    render(<TopicsPicker />);
    const before = screen.getByRole("button", { name: "NBA" });
    expect(before.getAttribute("aria-describedby")).toBeTruthy();
    await act(async () => { resolveMeta({ facets: { topics: { "sports.nfl": 12 } } }); });
    const after = screen.getByRole("button", { name: "NBA" });   // same name, not "NBA none open"
    expect(after).toBe(before);
    expect(document.getElementById(after.getAttribute("aria-describedby")!)!.textContent).toBe("none open");
    expect(document.getElementById(screen.getByRole("button", { name: "NFL" }).getAttribute("aria-describedby")!)!.textContent).toBe("12 open");
  });

  it("a tap before the counts load and a tap after both save the topic", async () => {
    render(<TopicsPicker />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "NBA" })); });
    expect(patch).toHaveBeenCalledWith({ favorite_topics: ["sports.nba"] });
    await act(async () => { resolveMeta({ facets: { topics: {} } }); });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "NFL" })); });
    expect(patch).toHaveBeenCalledTimes(2);
  });
});
