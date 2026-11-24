// @vitest-environment jsdom
// T-wt2d: a tile's accessible name is its topic ("NBA") before and after the open counts arrive (the count rides in
// aria-describedby), and a tap sticks whether it lands before or after the counts load. Until hydration the tiles are an honest
// not-ready state, like "Skip setup" (disabled, dimmed, cursor-wait, aria-busy on the picker): a tap on the server HTML is dropped by
// the browser, so they must not look tappable. (Nothing waits or replays the tap.)
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
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

  it("server HTML (before hydration): every tile is disabled AND styled as not ready (dimmed, cursor-wait), the picker is aria-busy", () => {
    const host = document.createElement("div");
    host.innerHTML = renderToString(<TopicsPicker />);
    const tiles = [...host.querySelectorAll("fieldset button")];
    expect(tiles.length).toBeGreaterThan(10);
    for (const t of tiles) {
      expect((t as HTMLButtonElement).disabled).toBe(true);
      expect(t.className, "dimmed like Skip setup").toContain("disabled:opacity-60");
      expect(t.className).toContain("disabled:cursor-wait");
      expect(t.className, "no hover affordance while not ready").toContain("enabled:hover:");
    }
    expect(host.querySelector('[data-testid="topics-picker"]')!.getAttribute("aria-busy")).toBe("true");
  });

  it("after hydration: tiles are enabled and the picker is no longer busy", async () => {
    render(<TopicsPicker />);
    expect((screen.getByRole("button", { name: "NFL" }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByTestId("topics-picker").getAttribute("aria-busy")).toBe("false");
  });
});
