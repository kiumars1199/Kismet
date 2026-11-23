// @vitest-environment jsdom
// docs/19 P2c: the first-run tour starts only when asked (after setup, or Replay), Skip is on every step and ends it
// for good, and it still works when a step's target isn't on the page.
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { TOUR_KEY, Tour } from "./Tour";

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} disconnect() {} unobserve() {} } as unknown as typeof ResizeObserver;
  Element.prototype.scrollIntoView ??= () => {};
});
afterEach(() => { localStorage.clear(); history.replaceState(null, "", "/"); document.querySelectorAll('[aria-label="Market details"]').forEach((n) => n.remove()); });

describe("first-run tour", () => {
  it("doesn't show unless started", () => {
    render(<Tour />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("starts after setup, has Skip on every step, and Skip ends it for good", async () => {
    localStorage.setItem(TOUR_KEY, "1");
    render(<Tour />);
    for (let i = 1; i <= 4; i++) {
      expect(await screen.findByText(`${i} of 5`)).toBeTruthy();
      expect(screen.getByRole("button", { name: "Skip tour" })).toBeTruthy();
      act(() => { fireEvent.click(screen.getByRole("button", { name: "Next" })); });
    }
    expect(screen.getByText("5 of 5")).toBeTruthy();
    act(() => { fireEvent.click(screen.getByRole("button", { name: "Skip tour" })); });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(localStorage.getItem(TOUR_KEY)).toBeNull();
  });

  it("replays from /?tour=1 and drops the param from the URL; Escape skips", async () => {
    history.replaceState(null, "", "/?tour=1&view=flags");
    render(<Tour />);
    expect(await screen.findByRole("dialog")).toBeTruthy();
    expect(location.search).toBe("?view=flags");
    act(() => { fireEvent.keyDown(window, { key: "Escape" }); });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("waits while the bet drawer is open (one modal on top) and resumes at the same step once it closes", async () => {
    localStorage.setItem(TOUR_KEY, "1");
    const drawer = document.createElement("div");
    drawer.setAttribute("role", "dialog");
    drawer.setAttribute("aria-label", "Market details");
    document.body.appendChild(drawer);
    render(<Tour />);
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    expect(screen.queryByTestId("tour")).toBeNull();
    expect(localStorage.getItem(TOUR_KEY)).toBe("1");   // not consumed: it is only waiting
    act(() => { fireEvent.keyDown(window, { key: "Escape" }); });
    expect(localStorage.getItem(TOUR_KEY)).toBe("1");   // Escape belongs to the drawer
    act(() => { drawer.remove(); });
    expect(await screen.findByText("1 of 5")).toBeTruthy();
  });
});
